import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { absoluteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

// 動画ジェネレーター同期用API。
// プラン不問で「ショート動画依頼(short_video_requests)があった人」だけを返す
// (2026-07-15: 有料/プレミアムだから自動的に動画を作る、という無条件対象化をやめ、
// 全プラン共通でチェックボックスによる明示的な希望制に統一した)。
// plan はジェネレーター側の語彙(registered=25秒 / standard / premium)で返す。
export async function GET(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const db = getAdminDb();
  if (!db) {
    return NextResponse.json({ vtubers: [] });
  }

  const [snapshot, requestSnapshot] = await Promise.all([
    db
      .collection("streamers")
      .where("plan_type", "in", ["free", "paid", "boost"])
      .select(
        "name",
        "creator_email",
        "youtube_url",
        "x_account",
        "plan_type",
        "is_visible",
        "is_deleted",
        "withdrawal_status",
        "description",
        "one_liner",
        "yomi"
      )
      .limit(500)
      .get(),
    db
      .collection("short_video_requests")
      .select("streamer_id", "status", "appeal_points", "notes")
      .limit(500)
      .get(),
  ]);

  const requestedStreamerIds = new Set(
    requestSnapshot.docs
      .filter((doc) => String(doc.data().status || "open") !== "rejected")
      .map((doc) => String(doc.data().streamer_id || doc.id))
      .filter(Boolean)
  );
  const appealPointsByStreamerId = new Map(
    requestSnapshot.docs
      .filter((doc) => String(doc.data().status || "open") !== "rejected")
      .map((doc) => [String(doc.data().streamer_id || doc.id), String(doc.data().appeal_points || "")])
  );

  const vtubers = snapshot.docs
    .map((doc) => {
      const d = doc.data();
      return {
        id:            doc.id,
        name:          String(d.name || ""),
        x_account_url: normalizeXUrl(d.x_account),
        youtube_url:   String(d.youtube_url || ""),
        plan:          d.plan_type === "boost" ? "premium" : d.plan_type === "paid" ? "standard" : "registered",
        email:         String(d.creator_email || ""),
        avatar_url:    absoluteUrl(`/api/streamer-image/${encodeURIComponent(doc.id)}?i=0`),
        description:   String(d.description || ""),
        one_liner:     String(d.one_liner || ""),
        yomi:          String(d.yomi || ""),
        appeal_points: appealPointsByStreamerId.get(doc.id) || "",
        _plan_type:    String(d.plan_type || "free"),
        _visible:      d.is_visible !== false,
        _deleted:      d.is_deleted === true,
        _withdrawal:   String(d.withdrawal_status || ""),
      };
    })
    .filter((v) => v._visible && !v._deleted && v._withdrawal !== "requested")
    .filter((v) => requestedStreamerIds.has(v.id))
    .map(({ _plan_type, _visible, _deleted, _withdrawal, ...v }) => v);

  return NextResponse.json({ vtubers });
}

function normalizeXUrl(value: unknown): string {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  const handle = raw.replace(/^@/, "");
  return handle ? `https://x.com/${handle}` : "";
}
