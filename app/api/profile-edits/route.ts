import { NextResponse } from "next/server";
import { FieldValue, getAdminDb } from "@/lib/firebaseAdmin";
import { addLocalProfileEdit } from "@/lib/localStore";

export async function POST(request: Request) {
  const body = await request.json();
  const email = clean(body.email, 120);
  const youtubeUrl = clean(body.youtube_url, 240);
  if (!email || !youtubeUrl) {
    return NextResponse.json({ error: "email and youtube_url are required" }, { status: 400 });
  }

  const payload = {
    application_id: clean(body.application_id, 120),
    streamer_id: clean(body.streamer_id, 120),
    email,
    youtube_url: youtubeUrl,
    name: clean(body.name, 80),
    image: clean(body.image, 400000),
    description: clean(body.description, 800),
    one_liner: clean(body.one_liner, 80),
    stream_time: clean(body.stream_time, 80),
    categories: sanitizeArray(body.categories).slice(0, 3),
    tags: sanitizeArray(body.tags).slice(0, 5)
  };

  const db = getAdminDb();
  if (!db) {
    const edit = await addLocalProfileEdit(payload);
    return NextResponse.json({ edit, source: "local" }, { status: 201 });
  }

  const doc = await db.collection("profile_edits").add({
    ...payload,
    status: "pending",
    created_at: FieldValue.serverTimestamp()
  });

  return NextResponse.json({ id: doc.id, source: "firestore" }, { status: 201 });
}

function clean(value: unknown, max: number) {
  return String(value || "").trim().slice(0, max);
}

function sanitizeArray(value: unknown) {
  return Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean) : [];
}
