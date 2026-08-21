import { requireAdmin } from "@/lib/adminAuth";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { vtuberGoodsCollection } from "@/lib/vtuberGoods";

// 公開用の /api/goods-image は承認済みしか配信しないため、審査中の画像を
// 管理者が確認できるよう、認証付きの専用ルートを分けて用意する。
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const db = getAdminDb();
  if (!db) return new Response("unavailable", { status: 503 });

  const doc = await db.collection(vtuberGoodsCollection).doc(params.id).get();
  if (!doc.exists) return new Response("not found", { status: 404 });

  const source = String(doc.data()?.image || "").trim();
  if (!source) return new Response("not found", { status: 404 });

  if (/^https:\/\//i.test(source)) {
    return new Response(null, { status: 302, headers: { Location: source, "Cache-Control": "no-store" } });
  }

  const match = source.match(/^data:([^;,]+);base64,(.+)$/);
  if (!match) return new Response("not found", { status: 404 });

  return new Response(Buffer.from(match[2] || "", "base64"), {
    headers: {
      "Content-Type": match[1] || "image/jpeg",
      // 審査中の未公開データなのでキャッシュさせない
      "Cache-Control": "private, no-store",
    },
  });
}
