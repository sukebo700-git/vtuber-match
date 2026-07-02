import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { readLocalApplications, readLocalStreamers } from "@/lib/localStore";
import { hashPassword } from "@/lib/password";
import { creatorSessionCookie, readUserSession } from "@/lib/userSession";
import type { StreamerApplication } from "@/lib/types";

type CreatorSession = {
  application_id?: string;
  streamer_id?: string;
  creator_login_id?: string;
  email?: string;
};

type Candidate = {
  id: string;
  data: Partial<StreamerApplication> & Record<string, unknown>;
};

const invalidLoginError = "メールアドレスまたはパスワードが違います。";

function normalize(value: unknown) {
  return String(value || "").trim();
}

function normalizeEmail(value: unknown) {
  return normalize(value).toLowerCase();
}

function matchesIdentity(application: Partial<StreamerApplication>, identity: CreatorSession) {
  const email = normalizeEmail(identity.email);
  return (
    (!!identity.application_id && application.id === identity.application_id) ||
    (!!identity.streamer_id && application.streamer_id === identity.streamer_id) ||
    (!!identity.creator_login_id && application.creator_login_id === identity.creator_login_id) ||
    (!!email && normalizeEmail(application.email) === email)
  );
}

function uniqueCandidates(candidates: Candidate[]) {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    if (seen.has(candidate.id)) return false;
    seen.add(candidate.id);
    return true;
  });
}

function findPasswordMatch(candidates: Candidate[], passwordHash: string) {
  return candidates.find((candidate) => candidate.data.creator_password_hash === passwordHash) || null;
}

export async function POST(request: Request) {
  const body = await request.json();
  const session = readUserSession<CreatorSession>(request, creatorSessionCookie);
  const identity: CreatorSession = {
    application_id: normalize(body.application_id || session?.application_id),
    streamer_id: normalize(body.streamer_id || session?.streamer_id),
    creator_login_id: normalize(body.creator_login_id || session?.creator_login_id),
    email: normalizeEmail(body.email || session?.email),
  };
  const password = String(body.password || "");
  const planType = String(body.plan_type || "");

  if (!identity.email && !identity.application_id && !identity.streamer_id && !identity.creator_login_id) {
    return NextResponse.json({ error: "メールアドレスを入力してください。" }, { status: 400 });
  }
  if (identity.email && !identity.email.includes("@")) {
    return NextResponse.json({ error: "メールアドレスを入力してください。" }, { status: 400 });
  }
  if (!password) return NextResponse.json({ error: "パスワードを入力してください。" }, { status: 400 });
  if (planType !== "paid" && planType !== "boost") {
    return NextResponse.json({ error: "プランを選択してください。" }, { status: 400 });
  }

  const passwordHash = hashPassword(password);
  const db = getAdminDb();

  if (!db) {
    const applications = await readLocalApplications();
    const candidates = uniqueCandidates(
      applications
        .filter((application) => matchesIdentity(application, identity))
        .map((application) => ({ id: application.id, data: application })),
    );
    const matched = findPasswordMatch(candidates, passwordHash);
    const application = matched?.data as StreamerApplication | undefined;
    if (!application) {
      return NextResponse.json({ error: invalidLoginError }, { status: 401 });
    }
    if (!application.streamer_id) {
      return NextResponse.json({ error: "掲載後にアップグレードできます。" }, { status: 400 });
    }
    const streamers = await readLocalStreamers();
    const streamer = streamers.find((item) => item.id === application.streamer_id);
    return NextResponse.json({
      application_id: application.id,
      streamer_id: application.streamer_id,
      payer_email: application.email || identity.email,
      plan_type: planType,
      current_plan: streamer?.plan_type || application.desired_plan || "free",
      source: "local",
    });
  }

  const candidates: Candidate[] = [];
  const addDoc = (doc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot) => {
    if (!doc.exists) return;
    candidates.push({ id: doc.id, data: { id: doc.id, ...doc.data() } });
  };

  if (identity.application_id) {
    addDoc(await db.collection("applications").doc(identity.application_id).get());
  }

  const queries: Promise<FirebaseFirestore.QuerySnapshot>[] = [];
  if (identity.email) {
    queries.push(db.collection("applications").where("email", "==", identity.email).limit(20).get());
  }
  if (session?.email && normalizeEmail(session.email) !== identity.email) {
    queries.push(db.collection("applications").where("email", "==", normalizeEmail(session.email)).limit(20).get());
  }
  if (identity.streamer_id) {
    queries.push(db.collection("applications").where("streamer_id", "==", identity.streamer_id).limit(20).get());
  }
  if (identity.creator_login_id) {
    queries.push(db.collection("applications").where("creator_login_id", "==", identity.creator_login_id).limit(20).get());
  }

  const snapshots = await Promise.all(queries);
  snapshots.forEach((snapshot) => snapshot.docs.forEach(addDoc));

  const matched = findPasswordMatch(uniqueCandidates(candidates), passwordHash);
  const data = matched?.data;
  if (!matched || !data) {
    return NextResponse.json({ error: invalidLoginError }, { status: 401 });
  }
  if (!data.streamer_id) {
    return NextResponse.json({ error: "掲載後にアップグレードできます。" }, { status: 400 });
  }

  let currentPlan = data.desired_plan || "free";
  const streamerDoc = await db.collection("streamers").doc(String(data.streamer_id)).get();
  const streamerData = streamerDoc.data();
  if (streamerData?.plan_type) currentPlan = streamerData.plan_type;

  return NextResponse.json({
    application_id: matched.id,
    streamer_id: data.streamer_id,
    payer_email: data.email || identity.email,
    plan_type: planType,
    current_plan: currentPlan,
    source: "firestore",
  });
}
