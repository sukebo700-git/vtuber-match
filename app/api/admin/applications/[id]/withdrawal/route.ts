import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { FieldValue, getAdminDb } from "@/lib/firebaseAdmin";

// 退会申請の重要通知「対応済みにする」用。申込(applications)と、紐づく配信者
// (streamers)両方のwithdrawal_statusを"none"に戻す。実際の退会処理(アカウントの
// 非表示化・削除)はここでは行わない — それは管理画面の既存の配信者管理操作で
// 個別に行う、意図的に分離された操作。ここは「対応済みフラグを下げる」だけ。
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const db = getAdminDb();
  if (!db) return NextResponse.json({ error: "Firebase admin env is required" }, { status: 501 });

  const applicationRef = db.collection("applications").doc(params.id);
  const applicationDoc = await applicationRef.get();
  if (!applicationDoc.exists) return NextResponse.json({ error: "application not found" }, { status: 404 });

  const streamerId = String(applicationDoc.data()?.streamer_id || "");

  await applicationRef.set({
    withdrawal_status: "none",
    updated_at: FieldValue.serverTimestamp(),
  }, { merge: true });

  if (streamerId) {
    await db.collection("streamers").doc(streamerId).set({
      withdrawal_status: "none",
      updated_at: FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  return NextResponse.json({ ok: true });
}
