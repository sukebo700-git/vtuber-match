import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { findLocalApplicationByEmail } from "@/lib/localStore";
import { hashPassword } from "@/lib/password";

export async function POST(request: Request) {
  const body = await request.json();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const planType = String(body.plan_type || "");

  if (!email || !email.includes("@")) return NextResponse.json({ error: "メールアドレスを入力してください。" }, { status: 400 });
  if (!password) return NextResponse.json({ error: "パスワードを入力してください。" }, { status: 400 });
  if (planType !== "paid" && planType !== "boost") return NextResponse.json({ error: "プランを選択してください。" }, { status: 400 });

  const passwordHash = hashPassword(password);
  const db = getAdminDb();

  if (!db) {
    const application = await findLocalApplicationByEmail(email);
    if (!application || application.creator_password_hash !== passwordHash) {
      return NextResponse.json({ error: "メールアドレスまたはパスワードが違います。" }, { status: 401 });
    }
    if (!application.streamer_id) {
      return NextResponse.json({ error: "掲載後にアップグレードできます。" }, { status: 400 });
    }
    return NextResponse.json({
      application_id: application.id,
      streamer_id: application.streamer_id,
      payer_email: application.email,
      plan_type: planType,
      source: "local"
    });
  }

  const snapshot = await db.collection("applications").where("email", "==", email).limit(1).get();
  const doc = snapshot.docs[0];
  const data = doc?.data();
  if (!doc || !data || data.creator_password_hash !== passwordHash) {
    return NextResponse.json({ error: "メールアドレスまたはパスワードが違います。" }, { status: 401 });
  }
  if (!data.streamer_id) {
    return NextResponse.json({ error: "掲載後にアップグレードできます。" }, { status: 400 });
  }

  return NextResponse.json({
    application_id: doc.id,
    streamer_id: data.streamer_id,
    payer_email: data.email || email,
    plan_type: planType,
    source: "firestore"
  });
}
