import { requireAdmin } from "@/lib/adminAuth";
import { getAdminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 管理: 生成済みカット用SVGを配信する（streamer-imageルートと同型）。
// variant=mirror（管理者が実際に使う左右反転版）/ normal。
export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const db = getAdminDb();
  if (!db) return new Response("database unavailable", { status: 503 });

  const variant = new URL(request.url).searchParams.get("variant") || "mirror";
  const doc = await db.collection("tshirt_order_assets").doc(params.id).get();
  if (!doc.exists) return new Response("not found", { status: 404 });
  const data = doc.data() || {};

  const orderNumber = await readOrderNumber(db, params.id);

  const svg = variant === "normal" ? String(data.svgNormal || "") : String(data.svgMirror || "");
  if (!svg) return new Response("not found", { status: 404 });

  const suffix = variant === "normal" ? "NORMAL" : "MIRROR";
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "private, no-store",
      "Content-Disposition": `inline; filename="${orderNumber}_${suffix}.svg"`,
    },
  });
}

async function readOrderNumber(db: FirebaseFirestore.Firestore, orderId: string): Promise<string> {
  const doc = await db.collection("orders").doc(orderId).get();
  const raw = String(doc.data()?.orderNumber || orderId);
  // ファイル名に使えない文字を除去（ヘッダインジェクション防止）。
  return raw.replace(/[^A-Za-z0-9_.-]/g, "");
}
