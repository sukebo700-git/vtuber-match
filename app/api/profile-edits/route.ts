import { NextResponse } from "next/server";
import { FieldValue, getAdminDb } from "@/lib/firebaseAdmin";
import { addLocalProfileEdit, findLocalApplicationByEmail } from "@/lib/localStore";
import { hashPassword } from "@/lib/password";

export async function POST(request: Request) {
  const body = await request.json();
  const email = clean(body.email, 120).toLowerCase();
  const password = String(body.password || "");

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "登録メールアドレスを入力してください。" }, { status: 400 });
  }
  if (!password) {
    return NextResponse.json({ error: "パスワードを入力してください。" }, { status: 400 });
  }

  const passwordHash = hashPassword(password);
  const db = getAdminDb();

  if (!db) {
    const application = await findLocalApplicationByEmail(email);
    if (!application || application.creator_password_hash !== passwordHash) {
      return NextResponse.json({ error: "メールアドレスまたはパスワードが違います。" }, { status: 401 });
    }

    const edit = await addLocalProfileEdit(buildPayload(body, {
      email,
      application_id: application.id,
      streamer_id: application.streamer_id || "",
      youtube_url: application.youtube_url
    }));
    return NextResponse.json({ edit, source: "local" }, { status: 201 });
  }

  const snapshot = await db.collection("applications").where("email", "==", email).limit(1).get();
  const applicationDoc = snapshot.docs[0];
  const application = applicationDoc?.data();
  if (!applicationDoc || !application || application.creator_password_hash !== passwordHash) {
    return NextResponse.json({ error: "メールアドレスまたはパスワードが違います。" }, { status: 401 });
  }

  const payload = buildPayload(body, {
    email,
    application_id: applicationDoc.id,
    streamer_id: application.streamer_id || "",
    youtube_url: application.youtube_url || ""
  });

  const doc = await db.collection("profile_edits").add({
    ...payload,
    status: "pending",
    created_at: FieldValue.serverTimestamp()
  });

  return NextResponse.json({ id: doc.id, source: "firestore" }, { status: 201 });
}

function buildPayload(body: Record<string, unknown>, source: { email: string; application_id: string; streamer_id: string; youtube_url: string }) {
  const youtubeUrl = clean(body.youtube_url, 240) || source.youtube_url;
  return {
    application_id: source.application_id,
    streamer_id: source.streamer_id,
    email: source.email,
    youtube_url: youtubeUrl,
    name: clean(body.name, 80),
    image: clean(body.image, 400000),
    description: clean(body.description, 800),
    one_liner: clean(body.one_liner, 80),
    stream_time: clean(body.stream_time, 80),
    categories: sanitizeArray(body.categories).slice(0, 3),
    tags: sanitizeArray(body.tags).slice(0, 5)
  };
}

function clean(value: unknown, max: number) {
  return String(value || "").trim().slice(0, max);
}

function sanitizeArray(value: unknown) {
  return Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean) : [];
}
