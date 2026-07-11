import { NextRequest, NextResponse } from "next/server";
import type { Firestore } from "firebase-admin/firestore";

import { FieldValue, getAdminDb, stripUndefined } from "@/lib/firebaseAdmin";
import { advancedQuestions, diagnosisAxes, diagnosisTypes, lightQuestions, viewerQuestions, type DiagnosisScores } from "@/lib/diagnosis";
import { buildVtypeProfileFields, type VtypeProfileFields } from "@/lib/diagnosisProfile";
import {
  readLocalApplications,
  readLocalStreamers,
  readLocalViewerProfilesRaw,
  updateLocalApplication,
  updateLocalStreamer,
  upsertLocalViewerProfile,
} from "@/lib/localStore";
import { creatorSessionCookie, readUserSession, viewerSessionCookie } from "@/lib/userSession";
import type { StreamerApplication, ViewerProfile } from "@/lib/types";

type DiagnosisRequest = {
  vtuberName?: string;
  mode?: "light" | "advanced" | "viewer";
  resultId?: string;
  lightTypeId?: number;
  lightType?: string;
  lightTypeCode?: string;
  lightScores?: Partial<DiagnosisScores>;
  advancedScores?: Partial<DiagnosisScores>;
  answers?: Record<string, number>;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as DiagnosisRequest;
    const vtuberName = String(body.vtuberName || "").trim();

    if (!vtuberName) {
      return NextResponse.json({ ok: false, error: "VTUBER_NAME_REQUIRED" }, { status: 400 });
    }

    if (vtuberName.length > 50) {
      return NextResponse.json({ ok: false, error: "VTUBER_NAME_TOO_LONG" }, { status: 400 });
    }

    const lightScores = normalizeScores(body.lightScores);
    if (!lightScores) {
      return NextResponse.json({ ok: false, error: "SCORES_REQUIRED" }, { status: 400 });
    }

    const diagnosisType = normalizeType(body.lightType, body.lightTypeCode, body.lightTypeId);
    const lightType = diagnosisType.name;
    const lightTypeCode = diagnosisType.code;
    const answers = normalizeAnswers(body.answers);
    const answerDetails = buildAnswerDetails(body.mode || "light", answers);
    const vtypeFields = buildVtypeProfileFields({
      type: diagnosisType,
      scores: lightScores,
      mode: body.mode || "light",
      resultId: body.resultId || "",
    });
    const db = getAdminDb();
    if (!db) {
      const profileSaved = await syncDiagnosisProfile(request, null, body.mode || "light", vtypeFields);
      return NextResponse.json({ ok: true, resultId: null, saved: false, profileSaved });
    }
    const payload = stripUndefined({
      vtuberName,
      diagnosisMode: body.mode || "light",
      lightTypeId: diagnosisType.id,
      lightType,
      lightTypeCode,
      lightScores,
      answers,
      answerDetails,
      advancedCompleted: body.mode === "advanced",
      viewerCompleted: body.mode === "viewer",
      advancedScores: body.mode === "advanced" ? normalizeScores(body.advancedScores || body.lightScores) : undefined,
      createdAt: FieldValue.serverTimestamp(),
    });

    if (body.mode === "advanced" && body.resultId) {
      const ref = db.collection("diagnosis_results").doc(body.resultId);
      await ref.set(
        stripUndefined({
          vtuberName,
          diagnosisMode: body.mode || "advanced",
          lightTypeId: diagnosisType.id,
          lightType,
          lightTypeCode,
          lightScores,
          answers,
          answerDetails,
          advancedCompleted: true,
          advancedScores: normalizeScores(body.advancedScores || body.lightScores),
          updatedAt: FieldValue.serverTimestamp(),
        }),
        { merge: true }
      );
      const profileSaved = await syncDiagnosisProfile(request, db, body.mode, { ...vtypeFields, vtype_result_id: body.resultId });
      return NextResponse.json({ ok: true, resultId: body.resultId, saved: true, profileSaved });
    }

    const doc = await db.collection("diagnosis_results").add(payload);
    const profileSaved = await syncDiagnosisProfile(request, db, body.mode || "light", { ...vtypeFields, vtype_result_id: doc.id });
    return NextResponse.json({ ok: true, resultId: doc.id, saved: true, profileSaved });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error("diagnosis result save failed:", message);
    return NextResponse.json({ ok: true, resultId: null, saved: false });
  }
}

function normalizeScores(value: Partial<DiagnosisScores> | undefined): DiagnosisScores | null {
  if (!value) return null;
  const entries = diagnosisAxes.map((axis) => {
    const score = Number(value[axis.key]);
    return [axis.key, Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : 0];
  });
  return Object.fromEntries(entries) as DiagnosisScores;
}

function normalizeType(typeName: string | undefined, typeCode: string | undefined, typeId: number | undefined) {
  const match = diagnosisTypes.find((type) => (
    type.id === Number(typeId) ||
    type.code === typeCode ||
    type.name === typeName
  ));
  return match || diagnosisTypes[0];
}

function normalizeAnswers(value: Record<string, number> | undefined) {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value).map(([key, answer]) => [
      key,
      Number.isFinite(Number(answer)) ? Math.max(1, Math.min(5, Math.round(Number(answer)))) : 3,
    ])
  );
}

function buildAnswerDetails(mode: DiagnosisRequest["mode"], answers: Record<string, number>) {
  const questions = mode === "advanced" ? advancedQuestions : mode === "viewer" ? viewerQuestions : lightQuestions;
  return questions.map((question, index) => ({
    number: index + 1,
    questionId: question.id,
    question: question.text,
    axis: question.axis,
    answer: answers[question.id] ?? 3,
  }));
}

async function syncDiagnosisProfile(
  request: NextRequest,
  db: Firestore | null,
  mode: DiagnosisRequest["mode"],
  fields: VtypeProfileFields,
) {
  if (mode === "viewer") {
    const session = readUserSession<{ id?: string; email?: string; viewer_login_id?: string }>(request, viewerSessionCookie);
    if (!session?.id) return false;
    if (!db) {
      const profiles = await readLocalViewerProfilesRaw();
      const existing = profiles.find((profile) => profile.id === session.id);
      const profile: ViewerProfile = {
        ...(existing || {}),
        id: session.id,
        email: existing?.email || session.email || "",
        viewer_login_id: existing?.viewer_login_id || session.viewer_login_id || "",
        viewer_plan: "free",
        visible_to_matched_streamers: existing?.visible_to_matched_streamers !== false,
        ...fields,
      };
      await upsertLocalViewerProfile(profile);
      return "viewer";
    }
    await db.collection("viewer_profiles").doc(session.id).set(stripUndefined({
      ...fields,
      viewer_plan: "free",
      updated_at: FieldValue.serverTimestamp(),
      vtype_updated_at: FieldValue.serverTimestamp(),
    }), { merge: true });
    return "viewer";
  }

  const session = readUserSession<{
    email?: string;
    application_id?: string;
    streamer_id?: string;
    creator_login_id?: string;
  }>(request, creatorSessionCookie);
  if (!session?.email && !session?.application_id && !session?.streamer_id && !session?.creator_login_id) return false;

  if (!db) {
    const [applications, streamers] = await Promise.all([readLocalApplications(), readLocalStreamers()]);
    const application = applications.find((item) => matchesCreatorApplication(item, session));
    const streamer = streamers.find((item) => (
      Boolean(session.streamer_id && item.id === session.streamer_id) ||
      Boolean(application?.streamer_id && item.id === application.streamer_id) ||
      Boolean(application?.id && item.source_application_id === application.id) ||
      Boolean(session.email && item.creator_email?.toLowerCase() === String(session.email).toLowerCase())
    ));
    if (streamer) {
      await updateLocalStreamer(streamer.id, fields);
      if (application) await updateLocalApplication(application.id, fields);
      return "creator";
    }
    if (application) {
      await updateLocalApplication(application.id, fields);
      return "creator";
    }
    return false;
  }

  const streamerRef = await findCreatorStreamerRef(db, session);
  const applicationRef = await findCreatorApplicationRef(db, session);
  const patch = stripUndefined({
    ...fields,
    updated_at: FieldValue.serverTimestamp(),
    vtype_updated_at: FieldValue.serverTimestamp(),
  });

  if (streamerRef) {
    await streamerRef.set(patch, { merge: true });
    if (applicationRef) await applicationRef.set(patch, { merge: true });
    return "creator";
  }
  if (applicationRef) {
    await applicationRef.set(patch, { merge: true });
    return "creator";
  }
  return false;
}

function matchesCreatorApplication(application: StreamerApplication, session: { email?: string; application_id?: string; streamer_id?: string; creator_login_id?: string }) {
  return (
    Boolean(session.application_id && application.id === session.application_id) ||
    Boolean(session.streamer_id && application.streamer_id === session.streamer_id) ||
    Boolean(session.creator_login_id && application.creator_login_id === session.creator_login_id) ||
    Boolean(session.email && application.email?.toLowerCase() === String(session.email).toLowerCase())
  );
}

async function findCreatorApplicationRef(db: Firestore, session: { email?: string; application_id?: string; streamer_id?: string; creator_login_id?: string }) {
  if (session.application_id) {
    const doc = await db.collection("applications").doc(String(session.application_id)).get();
    if (doc.exists) return doc.ref;
  }
  const queries: Array<Promise<FirebaseFirestore.QuerySnapshot>> = [];
  if (session.streamer_id) queries.push(db.collection("applications").where("streamer_id", "==", String(session.streamer_id)).limit(1).get());
  if (session.creator_login_id) queries.push(db.collection("applications").where("creator_login_id", "==", String(session.creator_login_id)).limit(1).get());
  if (session.email) queries.push(db.collection("applications").where("email", "==", String(session.email).toLowerCase()).limit(1).get());
  const snapshots = await Promise.all(queries);
  return snapshots.flatMap((snapshot) => snapshot.docs)[0]?.ref || null;
}

async function findCreatorStreamerRef(db: Firestore, session: { email?: string; application_id?: string; streamer_id?: string; creator_login_id?: string }) {
  if (session.streamer_id) {
    const doc = await db.collection("streamers").doc(String(session.streamer_id)).get();
    if (doc.exists) return doc.ref;
  }
  const applicationRef = await findCreatorApplicationRef(db, session);
  const applicationDoc = applicationRef ? await applicationRef.get() : null;
  const applicationData = applicationDoc?.exists ? applicationDoc.data() : null;
  const applicationStreamerId = String(applicationData?.streamer_id || "");
  if (applicationStreamerId) {
    const streamerDoc = await db.collection("streamers").doc(applicationStreamerId).get();
    if (streamerDoc.exists) return streamerDoc.ref;
  }
  if (applicationDoc?.id) {
    const byApplication = await db.collection("streamers").where("source_application_id", "==", applicationDoc.id).limit(1).get();
    if (byApplication.docs[0]) return byApplication.docs[0].ref;
  }
  if (session.email) {
    const byEmail = await db.collection("streamers").where("creator_email", "==", String(session.email).toLowerCase()).limit(1).get();
    if (byEmail.docs[0]) return byEmail.docs[0].ref;
  }
  return null;
}
