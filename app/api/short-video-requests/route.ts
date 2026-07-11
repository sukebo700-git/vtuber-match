import { NextResponse } from "next/server";
import { FieldValue, getAdminDb, stripUndefined } from "@/lib/firebaseAdmin";
import { creatorSessionCookie, readUserSession } from "@/lib/userSession";

type CreatorSession = {
  application_id?: string;
  streamer_id?: string;
  creator_login_id?: string;
  email?: string;
};

const maxAppealLength = 300;
const maxNotesLength = 200;

export async function GET(request: Request) {
  const session = readUserSession<CreatorSession>(request, creatorSessionCookie);
  if (!session?.application_id && !session?.streamer_id && !session?.email) {
    return NextResponse.json({ error: "配信者ログイン後に利用できます。" }, { status: 401 });
  }

  const db = getAdminDb();
  if (!db) {
    return NextResponse.json({ request: null, source: "local" });
  }

  const requestId = resolveRequestId(session);
  if (!requestId) return NextResponse.json({ request: null, source: "firestore" });

  const doc = await db.collection("short_video_requests").doc(requestId).get();
  if (!doc.exists) return NextResponse.json({ request: null, source: "firestore" });

  const data = doc.data() || {};
  return NextResponse.json({
    request: {
      id: doc.id,
      status: String(data.status || "open"),
      appeal_points: String(data.appeal_points || ""),
      notes: String(data.notes || ""),
      intro_text: String(data.intro_text || ""),
      youtube_video_id: String(data.youtube_video_id || ""),
      requested_at: toIso(data.requested_at),
      updated_at: toIso(data.updated_at),
    },
    source: "firestore",
  });
}

export async function POST(request: Request) {
  const session = readUserSession<CreatorSession>(request, creatorSessionCookie);
  if (!session?.application_id && !session?.streamer_id && !session?.email) {
    return NextResponse.json({ error: "配信者ログイン後に利用できます。" }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    // Allow empty-body requests from the legacy popup button.
  }
  const appealPoints = String(body.appeal_points || "").trim().slice(0, maxAppealLength);
  const notes = String(body.notes || "").trim().slice(0, maxNotesLength);

  const db = getAdminDb();
  if (!db) {
    return NextResponse.json({ ok: true, source: "local" });
  }

  const streamerId = String(session.streamer_id || "");
  const applicationId = String(session.application_id || "");
  const email = String(session.email || "");
  const [streamerDoc, applicationDoc] = await Promise.all([
    streamerId ? db.collection("streamers").doc(streamerId).get() : Promise.resolve(null),
    applicationId ? db.collection("applications").doc(applicationId).get() : Promise.resolve(null),
  ]);
  const streamer = streamerDoc?.data() || {};
  const application = applicationDoc?.data() || {};
  const name = String(streamer.name || application.name || email || streamerId || applicationId || "登録済み配信者");
  const requestId = resolveRequestId(session);
  if (!requestId) return NextResponse.json({ error: "配信者情報を確認できませんでした。" }, { status: 400 });
  const now = FieldValue.serverTimestamp();

  const existing = await db.collection("short_video_requests").doc(requestId).get();
  const existingStatus = String(existing.data()?.status || "");
  if (existing.exists && ["approved", "rendering", "uploaded", "published"].includes(existingStatus)) {
    return NextResponse.json({
      error: "この依頼はすでに制作フローに入っています。内容の変更は運営までお問い合わせください。",
      status: existingStatus,
    }, { status: 409 });
  }

  await db.collection("short_video_requests").doc(requestId).set(stripUndefined({
    streamer_id: streamerId || undefined,
    application_id: applicationId || undefined,
    creator_login_id: session.creator_login_id || undefined,
    name,
    email: email || streamer.creator_email || application.email || undefined,
    youtube_url: String(streamer.youtube_url || application.youtube_url || "") || undefined,
    x_account: String(streamer.x_account || application.x_account || "") || undefined,
    one_liner: String(streamer.one_liner || application.one_liner || "") || undefined,
    plan_type: String(streamer.plan_type || application.desired_plan || "free"),
    appeal_points: appealPoints || undefined,
    notes: notes || undefined,
    status: "open",
    requested_at: existing.exists ? existing.data()?.requested_at : now,
    updated_at: now,
  }), { merge: true });

  return NextResponse.json({ ok: true, status: "open" });
}

function resolveRequestId(session: CreatorSession) {
  return String(session.streamer_id || "") || String(session.application_id || "") || (session.email ? encodeURIComponent(String(session.email)) : "");
}

function toIso(value: unknown) {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value && "toDate" in value && typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return undefined;
}
