import { NextResponse } from "next/server";
import type { Firestore } from "firebase-admin/firestore";
import { FieldValue, getAdminDb } from "@/lib/firebaseAdmin";
import { readLocalViewerProfilesRaw, readLocalViewerProfilesWithStats, upsertLocalViewerProfile } from "@/lib/localStore";
import { readUserSession, viewerSessionCookie } from "@/lib/userSession";
import type { ViewerProfile } from "@/lib/types";

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  const session = readUserSession<{ id?: string }>(request, viewerSessionCookie);
  if (!session?.id || session.id !== id) return NextResponse.json({ error: "viewer login required" }, { status: 401 });

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
  const session = readUserSession<{ id?: string; email?: string; viewer_login_id?: string }>(request, viewerSessionCookie);
  if (!session?.id || session.id !== id) return NextResponse.json({ error: "viewer login required" }, { status: 401 });

  const db = getAdminDb();
  const existing = db ? await readFirestoreViewerProfile(db, id) : await readLocalViewerProfile(id);
  const viewerPlan = existing?.viewer_plan === "viewer_paid" || existing?.subscription_status === "active" ? "viewer_paid" : "free";
  const isPaid = viewerPlan === "viewer_paid";

  const profile: ViewerProfile = {
    ...existing,
    id,
    email: clean(existing?.email || session.email || body.email, 120).toLowerCase(),
    viewer_login_id: clean(existing?.viewer_login_id || session.viewer_login_id || body.viewer_login_id, 80),
    viewer_plan: viewerPlan,
    subscription_status: existing?.subscription_status === "active" ? "active" : existing?.subscription_status === "canceled" ? "canceled" : undefined,
    stripe_subscription_id: clean(existing?.stripe_subscription_id, 120),
    display_name: clean(body.display_name, 40),
    youtube_display_name: isPaid ? clean(body.youtube_display_name, 60) : "",
    twitter_id: isPaid ? clean(body.twitter_id, 40) : "",
    one_liner: isPaid ? clean(body.one_liner, 30) : "",
    image: clean(body.image, 400000),
    profile: isPaid ? clean(body.profile, 400) : "",
    favorite_categories: isPaid ? sanitizeArray(body.favorite_categories).slice(0, 5) : [],
    visible_to_matched_streamers: isPaid ? body.visible_to_matched_streamers !== false : true
  };

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

async function readLocalViewerProfile(id: string) {
  const profiles = await readLocalViewerProfilesRaw();
  return profiles.find((profile) => profile.id === id) || null;
}

async function readFirestoreViewerProfile(db: Firestore, id: string) {
  const doc = await db.collection("viewer_profiles").doc(id).get();
  return doc.exists ? doc.data() as ViewerProfile : null;
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
