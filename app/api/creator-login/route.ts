import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { readLocalApplications } from "@/lib/localStore";
import { hashPassword } from "@/lib/password";

export async function POST(request: Request) {
  const body = await request.json();
  const identifier = String(body.identifier || "").trim();
  const password = String(body.password || "");
  if (!identifier || !password) {
    return NextResponse.json({ error: "identifier and password are required" }, { status: 400 });
  }

  const passwordHash = hashPassword(password);
  const db = getAdminDb();

  if (!db) {
    const applications = await readLocalApplications();
    const application = applications.find((item) => (
      (item.creator_login_id === identifier || item.email === identifier) &&
      item.creator_password_hash === passwordHash
    ));
    if (!application) return NextResponse.json({ error: "ログイン情報が違います" }, { status: 401 });
    return NextResponse.json({
      application_id: application.id,
      streamer_id: application.streamer_id || "",
      creator_login_id: application.creator_login_id || ""
    });
  }

  const loginSnapshot = await db.collection("applications").where("creator_login_id", "==", identifier).limit(1).get();
  const emailSnapshot = loginSnapshot.empty ? await db.collection("applications").where("email", "==", identifier).limit(1).get() : null;
  const doc = !loginSnapshot.empty ? loginSnapshot.docs[0] : emailSnapshot?.docs[0];
  const data = doc?.data();
  if (!doc || !data || data.creator_password_hash !== passwordHash) {
    return NextResponse.json({ error: "ログイン情報が違います" }, { status: 401 });
  }

  return NextResponse.json({
    application_id: doc.id,
    streamer_id: data.streamer_id || "",
    creator_login_id: data.creator_login_id || ""
  });
}
