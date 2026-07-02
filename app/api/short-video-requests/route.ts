import { NextResponse } from "next/server";
import { FieldValue, getAdminDb, stripUndefined } from "@/lib/firebaseAdmin";
import { creatorSessionCookie, readUserSession } from "@/lib/userSession";

const shortVideoFormUrl = process.env.NEXT_PUBLIC_SHORT_VIDEO_FORM_URL || "https://t.co/RvMn6IQife";

type CreatorSession = {
  application_id?: string;
  streamer_id?: string;
  creator_login_id?: string;
  email?: string;
};

export async function POST(request: Request) {
  const session = readUserSession<CreatorSession>(request, creatorSessionCookie);
  if (!session?.application_id && !session?.streamer_id && !session?.email) {
    return NextResponse.json({ error: "配信者ログイン後に利用できます。" }, { status: 401 });
  }

  const db = getAdminDb();
  if (!db) {
    return NextResponse.json({ ok: true, source: "local", form_url: shortVideoFormUrl });
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
  const requestId = streamerId || applicationId || encodeURIComponent(email);
  const now = FieldValue.serverTimestamp();

  await db.collection("short_video_requests").doc(requestId).set(stripUndefined({
    streamer_id: streamerId || undefined,
    application_id: applicationId || undefined,
    creator_login_id: session.creator_login_id || undefined,
    name,
    email: email || streamer.creator_email || application.email || undefined,
    status: "open",
    form_url: shortVideoFormUrl,
    requested_at: now,
    updated_at: now,
  }), { merge: true });

  return NextResponse.json({ ok: true, form_url: shortVideoFormUrl });
}
