import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { FieldValue, getAdminDb, stripUndefined } from "@/lib/firebaseAdmin";

export const dynamic = "force-dynamic";

// 管理者が配信者IDを指定して、本人に代わって紹介動画の希望を登録する(バックフィル/代理登録用)。
// 既に依頼がある場合はステータスを上書きしない(進行中の依頼を巻き戻さないため)。
export async function POST(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => ({}));
  const streamerId = String(body.streamer_id || "").trim();
  if (!streamerId) {
    return NextResponse.json({ error: "streamer_id を指定してください。" }, { status: 400 });
  }

  const db = getAdminDb();
  if (!db) return NextResponse.json({ error: "db unavailable" }, { status: 500 });

  const streamerDoc = await db.collection("streamers").doc(streamerId).get();
  if (!streamerDoc.exists) {
    return NextResponse.json({ error: "指定の配信者が見つかりません。" }, { status: 404 });
  }
  const streamer = streamerDoc.data() || {};

  const requestRef = db.collection("short_video_requests").doc(streamerId);
  const existing = await requestRef.get();
  const statusPatch = existing.exists ? {} : { status: "open", requested_at: FieldValue.serverTimestamp() };

  await requestRef.set(stripUndefined({
    streamer_id: streamerId,
    name: String(streamer.name || ""),
    email: String(streamer.creator_email || ""),
    youtube_url: streamer.youtube_url || undefined,
    x_account: streamer.x_account || undefined,
    one_liner: streamer.one_liner || undefined,
    plan_type: streamer.plan_type || "free",
    appeal_points: body.appeal_points || streamer.description || undefined,
    notes: body.notes || "管理者による代理登録",
    ...statusPatch,
    updated_at: FieldValue.serverTimestamp(),
  }), { merge: true });

  return NextResponse.json({ ok: true, already_existed: existing.exists });
}

export async function GET(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const db = getAdminDb();
  if (!db) return NextResponse.json({ requests: [], source: "local" });

  const snapshot = await db.collection("short_video_requests")
    .select(
      "streamer_id",
      "application_id",
      "name",
      "email",
      "youtube_url",
      "x_account",
      "one_liner",
      "plan_type",
      "appeal_points",
      "notes",
      "intro_text",
      "status",
      "youtube_video_id",
      "requested_at",
      "approved_at",
      "uploaded_at",
      "updated_at",
    )
    .limit(200)
    .get();

  const requests = snapshot.docs
    .map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        streamer_id: String(data.streamer_id || ""),
        application_id: String(data.application_id || ""),
        name: String(data.name || ""),
        email: String(data.email || ""),
        youtube_url: String(data.youtube_url || ""),
        x_account: String(data.x_account || ""),
        one_liner: String(data.one_liner || ""),
        plan_type: String(data.plan_type || "free"),
        appeal_points: String(data.appeal_points || ""),
        notes: String(data.notes || ""),
        intro_text: String(data.intro_text || ""),
        status: String(data.status || "open"),
        youtube_video_id: String(data.youtube_video_id || ""),
        requested_at: toIso(data.requested_at),
        approved_at: toIso(data.approved_at),
        uploaded_at: toIso(data.uploaded_at),
        updated_at: toIso(data.updated_at),
      };
    })
    .sort((a, b) => safeTime(b.requested_at) - safeTime(a.requested_at));

  return NextResponse.json({ requests, source: "firestore" });
}

function toIso(value: unknown) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "toDate" in value && typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return undefined;
}

function safeTime(value?: string) {
  if (!value) return 0;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}
