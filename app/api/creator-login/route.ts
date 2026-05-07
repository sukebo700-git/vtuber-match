import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { readLocalApplications } from "@/lib/localStore";
import { hashPassword } from "@/lib/password";

export async function POST(request: Request) {
  const body = await request.json();
  const email = String(body.email || body.identifier || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!email || !email.includes("@") || !password) {
    return NextResponse.json({ error: "メールアドレスとパスワードを入力してください。" }, { status: 400 });
  }

  const passwordHash = hashPassword(password);
  const db = getAdminDb();

  if (!db) {
    const applications = await readLocalApplications();
    const application = applications.find((item) => (
      item.email.toLowerCase() === email &&
      item.creator_password_hash === passwordHash
    ));
    if (!application) return NextResponse.json({ error: "メールアドレスまたはパスワードが違います。" }, { status: 401 });
    return NextResponse.json({
      application_id: application.id,
      streamer_id: application.streamer_id || "",
      creator_login_id: application.creator_login_id || ""
    });
  }

  const emailSnapshot = await db.collection("applications").where("email", "==", email).limit(1).get();
  const doc = emailSnapshot.docs[0];
  const data = doc?.data();
  if (!doc || !data || data.creator_password_hash !== passwordHash) {
    return NextResponse.json({ error: "メールアドレスまたはパスワードが違います。" }, { status: 401 });
  }

  return NextResponse.json({
    application_id: doc.id,
    streamer_id: data.streamer_id || "",
    creator_login_id: data.creator_login_id || ""
  });
}
