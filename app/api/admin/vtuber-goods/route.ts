import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { vtuberGoodsCollection } from "@/lib/vtuberGoods";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const db = getAdminDb();
  if (!db) return NextResponse.json({ items: [], source: "local" });

  // 画像本体(base64)は一覧に載せず、確認用は /api/goods-image 経由で参照する
  const snapshot = await db.collection(vtuberGoodsCollection)
    .select("streamer_id", "streamer_name", "title", "url", "description", "status", "admin_note", "created_at", "updated_at")
    .limit(100)
    .get();

  const items = snapshot.docs
    .map((doc) => {
      const data = doc.data() || {};
      return {
        id: doc.id,
        streamer_id: String(data.streamer_id || doc.id),
        streamer_name: String(data.streamer_name || ""),
        title: String(data.title || ""),
        url: String(data.url || ""),
        description: String(data.description || ""),
        status: String(data.status || "pending"),
        admin_note: String(data.admin_note || ""),
        updated_at: toIso(data.updated_at),
      };
    })
    .sort((a, b) => statusWeight(a.status) - statusWeight(b.status) || b.updated_at.localeCompare(a.updated_at));

  return NextResponse.json({ items, source: "firestore" });
}

/** 未対応(pending)を先頭に持ってくる */
function statusWeight(status: string) {
  if (status === "pending") return 0;
  if (status === "approved") return 1;
  return 2;
}

function toIso(value: unknown) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && "toDate" in value && typeof (value as { toDate: unknown }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return "";
}
