import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminAuth";
import { FieldValue, getAdminDb, stripUndefined } from "@/lib/firebaseAdmin";
import { invalidateStreamerCaches, publicStreamerPath } from "@/lib/streamers";
import { parseYouTubeVideoId } from "@/lib/youtube";

export const dynamic = "force-dynamic";

// 依頼のステータス管理のみを行う。動画制作はローカルの動画ジェネレーターが担当。
// open: 依頼受付(ジェネレーター同期対象) / published: 対応済み / rejected: 見送り(同期対象外)
const allowedStatuses = ["open", "published", "rejected"] as const;
type RequestStatus = (typeof allowedStatuses)[number];

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const db = getAdminDb();
  if (!db) return NextResponse.json({ error: "Firebase admin env is required" }, { status: 501 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const ref = db.collection("short_video_requests").doc(params.id);
  const doc = await ref.get();
  if (!doc.exists) return NextResponse.json({ error: "request not found" }, { status: 404 });

  const status = typeof body.status === "string" && (allowedStatuses as readonly string[]).includes(body.status)
    ? (body.status as RequestStatus)
    : undefined;
  const videoId = parseYouTubeVideoId(body.youtube_video || body.youtube_video_id);

  if (status === undefined && videoId === undefined) {
    return NextResponse.json({ error: "status または youtube_video を指定してください。" }, { status: 400 });
  }

  await ref.set(stripUndefined({
    status,
    youtube_video_id: videoId,
    published_at: status === "published" ? FieldValue.serverTimestamp() : undefined,
    updated_at: FieldValue.serverTimestamp(),
  }), { merge: true });

  if (status === "published") {
    const requestData = doc.data() || {};
    const streamerId = String(requestData.streamer_id || "");
    const effectiveVideoId = videoId || String(requestData.youtube_video_id || "");
    if (streamerId && effectiveVideoId) {
      await db.collection("streamers").doc(streamerId).set({
        promo_video_id: effectiveVideoId,
        updated_at: FieldValue.serverTimestamp(),
      }, { merge: true });
      invalidateStreamerCaches();
      // 静的生成された配信者ページ(revalidate=86400)はこのままだと最大24時間
      // 古い内容のままになるため、公開直後に反映されるよう明示的に再生成する。
      const streamerDoc = await db.collection("streamers").doc(streamerId).get();
      const streamerName = String(streamerDoc.data()?.name || requestData.name || "");
      if (streamerName) {
        revalidatePath(publicStreamerPath({ id: streamerId, name: streamerName }));
      }
    }
  }

  const updated = (await ref.get()).data() || {};
  return NextResponse.json({
    ok: true,
    request: {
      id: params.id,
      status: String(updated.status || "open"),
      youtube_video_id: String(updated.youtube_video_id || ""),
    },
  });
}
