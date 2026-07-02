import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { absoluteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const db = getAdminDb();
  if (!db) {
    return NextResponse.json({ vtubers: [] });
  }

  const snapshot = await db
    .collection("streamers")
    .where("plan_type", "in", ["paid", "boost"])
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
    .limit(300)
    .get();

  const vtubers = snapshot.docs
    .map((doc) => {
      const d = doc.data();
      return {
        id:            doc.id,
        name:          String(d.name || ""),
        x_account_url: normalizeXUrl(d.x_account),
        youtube_url:   String(d.youtube_url || ""),
        plan:          d.plan_type === "boost" ? "premium" : "standard",
        email:         String(d.creator_email || ""),
        avatar_url:    absoluteUrl(`/api/streamer-image/${encodeURIComponent(doc.id)}?i=0`),
        description:   String(d.description || ""),
        one_liner:     String(d.one_liner || ""),
        yomi:          String(d.yomi || ""),
        _visible:      d.is_visible !== false,
        _deleted:      d.is_deleted === true,
        _withdrawal:   String(d.withdrawal_status || ""),
      };
    })
    .filter((v) => v._visible && !v._deleted && v._withdrawal !== "requested")
    .map(({ _visible, _deleted, _withdrawal, ...v }) => v);

  return NextResponse.json({ vtubers });
}

function normalizeXUrl(value: unknown): string {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  const handle = raw.replace(/^@/, "");
  return handle ? `https://x.com/${handle}` : "";
}
