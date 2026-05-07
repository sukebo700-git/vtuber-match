import { NextResponse } from "next/server";
import { FieldValue, getAdminDb } from "@/lib/firebaseAdmin";
import { readLocalViewerProfilesRaw, upsertLocalViewerProfile } from "@/lib/localStore";
import { hashPassword, makeViewerLoginId } from "@/lib/password";
import type { ViewerProfile } from "@/lib/types";

export async function POST(request: Request) {
  const body = await request.json();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const displayName = String(body.display_name || "").trim().slice(0, 40);

  if (!email || !email.includes("@")) return NextResponse.json({ error: "email is required" }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "password must be at least 8 characters" }, { status: 400 });

  const passwordHash = hashPassword(password);
  const db = getAdminDb();

  if (!db) {
    const profiles = await readLocalViewerProfilesRaw();
    const existing = profiles.find((profile) => profile.email?.toLowerCase() === email);
    if (existing?.viewer_password_hash && existing.viewer_password_hash !== passwordHash) {
      return NextResponse.json({ error: "invalid credentials" }, { status: 401 });
    }
    const profile: ViewerProfile = {
      ...existing,
      id: existing?.id || `viewer-${Date.now()}`,
      email,
      viewer_login_id: existing?.viewer_login_id || makeViewerLoginId(),
      viewer_password_hash: existing?.viewer_password_hash || passwordHash,
      viewer_plan: existing?.viewer_plan || "free",
      subscription_status: existing?.subscription_status,
      stripe_subscription_id: existing?.stripe_subscription_id,
      display_name: displayName || existing?.display_name || "",
      visible_to_matched_streamers: existing?.visible_to_matched_streamers !== false
    };
    const saved = await upsertLocalViewerProfile(profile);
    return NextResponse.json({ profile: publicProfile(saved), source: "local" });
  }

  const snapshot = await db.collection("viewer_profiles").where("email", "==", email).limit(1).get();
  const existingDoc = snapshot.docs[0];
  const existing = existingDoc?.data() as ViewerProfile | undefined;
  if (existing?.viewer_password_hash && existing.viewer_password_hash !== passwordHash) {
    return NextResponse.json({ error: "invalid credentials" }, { status: 401 });
  }

  const id = existingDoc?.id || `viewer-${Date.now()}`;
  const profile: ViewerProfile = {
    id,
    email,
    viewer_login_id: existing?.viewer_login_id || makeViewerLoginId(),
    viewer_password_hash: existing?.viewer_password_hash || passwordHash,
    viewer_plan: existing?.viewer_plan || "free",
    subscription_status: existing?.subscription_status,
    stripe_subscription_id: existing?.stripe_subscription_id,
    display_name: displayName || existing?.display_name || "",
    youtube_display_name: existing?.youtube_display_name || "",
    twitter_id: existing?.twitter_id || "",
    one_liner: existing?.one_liner || "",
    image: existing?.image || "",
    profile: existing?.profile || "",
    favorite_categories: Array.isArray(existing?.favorite_categories) ? existing?.favorite_categories : [],
    visible_to_matched_streamers: existing?.visible_to_matched_streamers !== false
  };

  await db.collection("viewer_profiles").doc(id).set({
    ...profile,
    updated_at: FieldValue.serverTimestamp()
  }, { merge: true });

  return NextResponse.json({ profile: publicProfile(profile), source: "firestore" });
}

function publicProfile(profile: ViewerProfile) {
  const { viewer_password_hash, ...safeProfile } = profile;
  return safeProfile;
}
