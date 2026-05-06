import { NextResponse } from "next/server";
import { FieldValue, getAdminDb } from "@/lib/firebaseAdmin";
import { readLocalViewerProfilesWithStats, upsertLocalViewerProfile } from "@/lib/localStore";
import type { ViewerProfile } from "@/lib/types";

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const db = getAdminDb();
  if (!db) {
    const profiles = await readLocalViewerProfilesWithStats();
    const profile = profiles.find((item) => item.id === id);
    return NextResponse.json({ profile: sanitizeProfile(profile || { id, match_count: 0, fan_level: "starter" }) });
  }

  const profileDoc = await db.collection("viewer_profiles").doc(id).get();
  const [likes, streamerLikes] = await Promise.all([
    db.collection("likes").where("viewer_profile_id", "==", id).limit(1000).get(),
    db.collection("creator_likes").where("viewer_profile_id", "==", id).limit(1000).get()
  ]);
  const matchCount = likes.size;
  const streamerLikeCount = streamerLikes.size;
  const profile = profileDoc.exists ? profileDoc.data() : {};

  return NextResponse.json({
    profile: sanitizeProfile({
      id,
      ...profile,
      match_count: matchCount,
      streamer_like_count: streamerLikeCount,
      fan_level: fanLevel(matchCount)
    })
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const id = String(body.id || "");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const profile: ViewerProfile = {
    id,
    email: clean(body.email, 120).toLowerCase(),
    viewer_login_id: clean(body.viewer_login_id, 80),
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

function fanLevel(matchCount: number) {
  if (matchCount >= 20) return "super";
  if (matchCount >= 5) return "active";
  return "starter";
}

function sanitizeProfile<T extends Record<string, unknown>>(profile: T) {
  const { viewer_password_hash, ...safeProfile } = profile;
  return safeProfile;
}
