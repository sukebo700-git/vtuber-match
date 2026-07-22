import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { getAdminDb } from "@/lib/firebaseAdmin";

export const dynamic = "force-dynamic";

// 管理: Tシャツ注文一覧（最小）。作成日時の新しい順に返す。
export async function GET(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const db = getAdminDb();
  if (!db) return NextResponse.json({ orders: [] });

  const snapshot = await db
    .collection("orders")
    .where("order_type", "==", "tshirt_kit")
    .get();

  const orders = snapshot.docs
    .map((doc) => {
      const d = doc.data() || {};
      return {
        id: doc.id,
        orderNumber: String(d.orderNumber || ""),
        createdAt: toIso(d.createdAt),
        userId: String(d.userId || ""),
        inputText: String(d.inputText || ""),
        fontDisplayName: String(d.fontDisplayName || ""),
        designSize: String(d.designSize || ""),
        shirtColor: String(d.shirtColor || ""),
        shirtSize: String(d.shirtSize || ""),
        sheetColor: String(d.sheetColor || ""),
        quantity: Number(d.quantity || 0),
        totalAmount: Number(d.totalAmount || 0),
        paymentStatus: String(d.paymentStatus || ""),
        productionStatus: String(d.productionStatus || ""),
      };
    })
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

  return NextResponse.json({ orders });
}

function toIso(value: unknown): string {
  if (!value) return "";
  if (typeof value === "object" && value && "toDate" in value && typeof (value as { toDate: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof value === "string") return value;
  return "";
}
