import { NextResponse } from "next/server";
import type { Firestore } from "firebase-admin/firestore";
import { FieldValue, getAdminDb } from "@/lib/firebaseAdmin";
import { readLocalApplications, updateLocalStreamer } from "@/lib/localStore";
import { hashPassword } from "@/lib/password";
import type { PlanType, Streamer, StreamerApplication } from "@/lib/types";

type ApplicationMatch = {
  id: string;
  ref?: FirebaseFirestore.DocumentReference;
  data: StreamerApplication;
};

export async function POST(request: Request) {
  const body = await request.json();
  const email = clean(body.email, 120).toLowerCase();
  const password = String(body.password || "");
  const applicationId = clean(body.application_id, 120);
  const streamerId = clean(body.streamer_id, 120);
  const creatorLoginId = clean(body.creator_login_id, 120);

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "登録メールアドレスを入力してください。" }, { status: 400 });
  }
  if (!password) {
    return NextResponse.json({ error: "パスワードを入力してください。" }, { status: 400 });
  }

  const passwordHash = hashPassword(password);
  const db = getAdminDb();

  if (!db) {
    const match = await findLocalApplicationForEdit({ email, applicationId, streamerId, creatorLoginId, passwordHash });
    if (!match || match.data.creator_password_hash !== passwordHash) {
      return NextResponse.json({ error: "メールアドレスまたはパスワードが違います。" }, { status: 401 });
    }
    if (!match.data.streamer_id) {
      return NextResponse.json({ error: "掲載中の配信者データが見つかりません。" }, { status: 404 });
    }

    const patch = buildStreamerPatch(body, match.data.desired_plan);
    const streamer = await updateLocalStreamer(match.data.streamer_id, patch);
    return NextResponse.json({ streamer, source: "local" });
  }

  const match = await findFirestoreApplicationForEdit(db, { email, applicationId, streamerId, creatorLoginId, passwordHash });
  if (!match || match.data.creator_password_hash !== passwordHash) {
    return NextResponse.json({ error: "メールアドレスまたはパスワードが違います。" }, { status: 401 });
  }
  if (!match.data.streamer_id) {
    return NextResponse.json({ error: "掲載中の配信者データが見つかりません。" }, { status: 404 });
  }

  const patch = buildStreamerPatch(body, match.data.desired_plan || "free");
  await db.collection("streamers").doc(match.data.streamer_id).set({
    ...patch,
    updated_at: FieldValue.serverTimestamp(),
  }, { merge: true });

  await match.ref?.set({
    ...buildApplicationPatch(body, match.data.desired_plan || "free"),
    updated_at: FieldValue.serverTimestamp(),
  }, { merge: true });

  const streamerDoc = await db.collection("streamers").doc(match.data.streamer_id).get();
  return NextResponse.json({ id: match.data.streamer_id, streamer: { id: match.data.streamer_id, ...streamerDoc.data() }, source: "firestore" });
}

async function findLocalApplicationForEdit(input: {
  email: string;
  applicationId: string;
  streamerId: string;
  creatorLoginId: string;
  passwordHash: string;
}): Promise<ApplicationMatch | null> {
  const applications = await readLocalApplications();
  const candidates = applications
    .filter((application) => matchesApplication(application, input))
    .map((application) => ({ id: application.id, data: application }));

  return candidates.find((candidate) => candidate.data.creator_password_hash === input.passwordHash) || candidates[0] || null;
}

async function findFirestoreApplicationForEdit(db: Firestore, input: {
  email: string;
  applicationId: string;
  streamerId: string;
  creatorLoginId: string;
  passwordHash: string;
}): Promise<ApplicationMatch | null> {
  const seen = new Set<string>();
  const candidates: ApplicationMatch[] = [];

  function addSnapshot(doc: FirebaseFirestore.DocumentSnapshot) {
    if (!doc.exists || seen.has(doc.id)) return;
    seen.add(doc.id);
    candidates.push({
      id: doc.id,
      ref: doc.ref,
      data: { id: doc.id, ...doc.data() } as StreamerApplication,
    });
  }

  if (input.applicationId) {
    addSnapshot(await db.collection("applications").doc(input.applicationId).get());
  }

  const queries: Array<Promise<FirebaseFirestore.QuerySnapshot>> = [];
  if (input.email) queries.push(db.collection("applications").where("email", "==", input.email).limit(10).get());
  if (input.streamerId) queries.push(db.collection("applications").where("streamer_id", "==", input.streamerId).limit(10).get());
  if (input.creatorLoginId) queries.push(db.collection("applications").where("creator_login_id", "==", input.creatorLoginId).limit(10).get());

  const snapshots = await Promise.all(queries);
  snapshots.forEach((snapshot) => snapshot.docs.forEach(addSnapshot));

  return candidates.find((candidate) => candidate.data.creator_password_hash === input.passwordHash) || candidates[0] || null;
}

function matchesApplication(application: StreamerApplication, input: { email: string; applicationId: string; streamerId: string; creatorLoginId: string }) {
  return (
    application.email?.toLowerCase() === input.email ||
    Boolean(input.applicationId && application.id === input.applicationId) ||
    Boolean(input.streamerId && application.streamer_id === input.streamerId) ||
    Boolean(input.creatorLoginId && application.creator_login_id === input.creatorLoginId)
  );
}

function buildStreamerPatch(body: Record<string, unknown>, plan: PlanType): Partial<Streamer> {
  const maxCategories = plan === "free" ? 1 : 3;
  const maxTags = plan === "free" ? 1 : 5;
  const image = clean(body.image, 400000);
  const patch: Partial<Streamer> = {
    categories: sanitizeArray(body.categories).slice(0, maxCategories),
    tags: sanitizeArray(body.tags).slice(0, maxTags),
  };

  setIfPresent(patch, "name", clean(body.name, 80));
  setIfPresent(patch, "youtube_url", clean(body.youtube_url, 240));
  setIfPresent(patch, "x_account", normalizeXAccount(body.x_account));
  setIfPresent(patch, "description", clean(body.description, 800));
  setIfPresent(patch, "one_liner", clean(body.one_liner, 80));
  setIfPresent(patch, "stream_time", clean(body.stream_time, 80));
  if (image) patch.thumbnails = [image];

  return patch;
}

function buildApplicationPatch(body: Record<string, unknown>, plan: PlanType) {
  const maxCategories = plan === "free" ? 1 : 3;
  const maxTags = plan === "free" ? 1 : 5;
  const image = clean(body.image, 400000);
  const patch: Record<string, unknown> = {
    categories: sanitizeArray(body.categories).slice(0, maxCategories),
    tags: sanitizeArray(body.tags).slice(0, maxTags),
  };

  setIfPresent(patch, "name", clean(body.name, 80));
  setIfPresent(patch, "youtube_url", clean(body.youtube_url, 240));
  setIfPresent(patch, "x_account", normalizeXAccount(body.x_account));
  setIfPresent(patch, "description", clean(body.description, 800));
  setIfPresent(patch, "one_liner", clean(body.one_liner, 80));
  setIfPresent(patch, "stream_time", clean(body.stream_time, 80));
  if (image) patch.thumbnails = [image];

  return patch;
}

function setIfPresent(target: Record<string, unknown>, key: string, value: string) {
  if (value) target[key] = value;
}

function clean(value: unknown, max: number) {
  return String(value || "").trim().slice(0, max);
}

function sanitizeArray(value: unknown) {
  return Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean) : [];
}

function normalizeXAccount(value: unknown) {
  const input = String(value || "").trim();
  if (!input) return "";
  return input.replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//i, "@").replace(/^([^@])/, "@$1").slice(0, 40);
}
