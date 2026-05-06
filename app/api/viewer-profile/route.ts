import { NextResponse } from "next/server";
import { FieldValue, getAdminDb } from "@/lib/firebaseAdmin";
import { upsertLocalViewerProfile } from "@/lib/localStore";
import type { ViewerProfile } from "@/lib/types";

export async function POST(request: Request) {
  const body = await request.json();
  const id = String(body.id || "");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const profile: ViewerProfile = {
    id,
    display_name: clean(body.display_name, 40),
    youtube_display_name: clean(body.youtube_display_name, 60),
    image: clean(body.image, 400000),
    profile: clean(body.profile, 400),
    favorite_categories: sanitizeArray(body.favorite_categories).slice(0, 5),
    visible_to_matched_streamers: body.visible_to_matched_streamers !== false
  };

  const db = getAdminDb();
  if (!db) {
    const saved = await upsertLocalViewerProfile(profile);
    return NextResponse.json({ profile: saved, source: "local" });
  }

  await db.collection("viewer_profiles").doc(id).set({
    ...profile,
    updated_at: FieldValue.serverTimestamp()
  }, { merge: true });

  return NextResponse.json({ profile, source: "firestore" });
}

function clean(value: unknown, max: number) {
  return String(value || "").trim().slice(0, max);
}

function sanitizeArray(value: unknown) {
  return Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean) : [];
}
