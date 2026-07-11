import { NextResponse } from "next/server";
import type { Firestore } from "firebase-admin/firestore";
import { diagnosisTypes } from "@/lib/diagnosis";
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
  const profile = profileDoc.exists ? profileDoc.data() : {};
  if (profile?.is_admin_viewer === true) {
    return NextResponse.json({
      profile: sanitizeProfile({
        id,
        ...profile,
        match_count: 0,
        streamer_like_count: 0,
        fan_level: "starter"
      })
    });
  }
  const likes = await db.collection("likes").where("viewer_profile_id", "==", id).limit(1000).get();
  const matchCount = likes.size;

  return NextResponse.json({
    profile: sanitizeProfile({
      id,
      ...profile,
      match_count: matchCount,
      streamer_like_count: 0,
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
  const profile: ViewerProfile = {
    ...existing,
    id,
    email: clean(existing?.email || session.email || body.email, 120).toLowerCase(),
    viewer_login_id: clean(existing?.viewer_login_id || session.viewer_login_id || body.viewer_login_id, 80),
    viewer_plan: "free",
    subscription_status: "canceled",
    payment_state: "active",
    stripe_subscription_id: "",
    is_admin_viewer: existing?.is_admin_viewer === true,
    display_name: clean(body.display_name, 40),
    youtube_display_name: clean(body.youtube_display_name, 60),
    twitter_id: clean(body.twitter_id, 40),
    one_liner: clean(body.one_liner, 20),
    image: clean(body.image, 400000),
    profile: clean(body.profile, 400),
    favorite_categories: sanitizeArray(body.favorite_categories).slice(0, 5),
    visible_to_matched_streamers: body.visible_to_matched_streamers !== false,
    ...buildVtypePatch(body),
  };

  if (!db) {
    const saved = await upsertLocalViewerProfile(profile);
    return NextResponse.json({ profile: saved, source: "local" });
  }

  await db.collection("viewer_profiles").doc(id).set({
    ...stripUndefined(profile),
    ...(existing ? {} : { created_at: FieldValue.serverTimestamp(), registered_at: FieldValue.serverTimestamp() }),
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

function buildVtypePatch(body: Record<string, unknown>) {
  const type = diagnosisTypes.find((item) => item.id === Number(body.vtype_id));
  if (!type) return {};
  return {
    vtype_id: type.id,
    vtype_code: type.code,
    vtype_name: type.name,
    vtype_scores: normalizeScoreMap(body.vtype_scores),
    vtype_mode: clean(body.vtype_mode, 20) || "viewer",
    vtype_result_id: clean(body.vtype_result_id, 120),
    vtype_updated_at: clean(body.vtype_updated_at, 50) || new Date().toISOString(),
  };
}

function normalizeScoreMap(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const entries = Object.entries(value as Record<string, unknown>)
    .map(([key, score]) => [key, Math.max(0, Math.min(100, Math.round(Number(score))))] as const)
    .filter(([, score]) => Number.isFinite(score));
  return entries.length ? Object.fromEntries(entries) : undefined;
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

function stripUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}
