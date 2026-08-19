import { NextResponse } from "next/server";
import { FieldValue, getAdminDb } from "@/lib/firebaseAdmin";
import { mergeLocalViewerIdentity, readLocalViewerProfilesRaw, upsertLocalViewerProfile } from "@/lib/localStore";
import { verifyGoogleIdToken } from "@/lib/googleAuth";
import { makeViewerLoginId } from "@/lib/password";
import { createUserSession, userSessionCookieOptions, viewerSessionCookie } from "@/lib/userSession";
import type { ViewerProfile } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const credential = String(body.credential || "");
    const anonymousViewerId = String(body.anonymous_viewer_id || "").trim().slice(0, 120);

    const googleUser = await verifyGoogleIdToken(credential);
    if (!googleUser) {
      return NextResponse.json({ error: "Google認証に失敗しました。時間をおいて再度お試しください。" }, { status: 401 });
    }
    const email = googleUser.email;
    const displayName = googleUser.name.slice(0, 40);

    const db = getAdminDb();

    if (!db && process.env.NODE_ENV === "production") {
      return NextResponse.json({
        error: "ただいまログイン処理を完了できませんでした。時間をおいてもう一度お試しください。",
      }, { status: 503 });
    }

    if (!db) {
      const profiles = await readLocalViewerProfilesRaw();
      const existing = profiles.find((profile) => profile.email?.toLowerCase() === email);
      const created = !existing;
      const id = existing?.id || (anonymousViewerId.startsWith("anon-viewer-") ? anonymousViewerId : `viewer-${Date.now()}`);
      const now = new Date().toISOString();
      const profile: ViewerProfile = {
        ...existing,
        id,
        anonymous_viewer_id: anonymousViewerId || existing?.anonymous_viewer_id,
        email,
        viewer_login_id: existing?.viewer_login_id || makeViewerLoginId(),
        auth_provider: existing?.auth_provider || "google",
        viewer_plan: existing?.viewer_plan || "free",
        subscription_status: existing?.subscription_status || "canceled",
        stripe_subscription_id: existing?.stripe_subscription_id || "",
        display_name: existing?.display_name || displayName,
        visible_to_matched_streamers: existing?.visible_to_matched_streamers !== false,
        last_viewer_login_at: now,
        is_deleted: false,
      };
      const saved = await upsertLocalViewerProfile(profile);
      if (anonymousViewerId && anonymousViewerId !== saved.id) await mergeLocalViewerIdentity(anonymousViewerId, saved.id);
      const response = NextResponse.json({ profile: publicProfile(saved), auth_action: created ? "created" : "logged_in", source: "local" });
      response.cookies.set(viewerSessionCookie, createUserSession({
        id: saved.id,
        email: saved.email,
        viewer_login_id: saved.viewer_login_id,
      }), userSessionCookieOptions());
      return response;
    }

    const snapshot = await db.collection("viewer_profiles").where("email", "==", email).limit(1).get();
    const existingDoc = snapshot.docs[0];
    const existing = existingDoc?.data() as ViewerProfile | undefined;
    const created = !existingDoc;

    const id = existingDoc?.id || (anonymousViewerId.startsWith("anon-viewer-") ? anonymousViewerId : `viewer-${Date.now()}`);
    const profile: ViewerProfile = {
      id,
      anonymous_viewer_id: anonymousViewerId || existing?.anonymous_viewer_id,
      email,
      viewer_login_id: existing?.viewer_login_id || makeViewerLoginId(),
      viewer_password_hash: existing?.viewer_password_hash,
      auth_provider: existing?.auth_provider || "google",
      viewer_plan: existing?.viewer_plan || "free",
      subscription_status: existing?.subscription_status || "canceled",
      stripe_subscription_id: existing?.stripe_subscription_id || "",
      display_name: existing?.display_name || displayName,
      youtube_display_name: existing?.youtube_display_name || "",
      twitter_id: existing?.twitter_id || "",
      registration_source: existing?.registration_source || "google_one_tap",
      one_liner: existing?.one_liner || "",
      image: existing?.image || "",
      profile: existing?.profile || "",
      favorite_categories: Array.isArray(existing?.favorite_categories) ? existing?.favorite_categories : [],
      visible_to_matched_streamers: existing?.visible_to_matched_streamers !== false,
      last_viewer_login_at: new Date().toISOString(),
      is_deleted: false,
    };

    await db.collection("viewer_profiles").doc(id).set({
      ...stripUndefined(profile),
      ...(created ? { created_at: FieldValue.serverTimestamp(), registered_at: FieldValue.serverTimestamp() } : {}),
      last_viewer_login_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    }, { merge: true });
    await db.collection("viewer_login_events").add(stripUndefined({
      viewer_profile_id: id,
      viewer_login_id: profile.viewer_login_id,
      email,
      mode: "google",
      created_at: FieldValue.serverTimestamp(),
    }));
    if (anonymousViewerId && anonymousViewerId !== id) await mergeFirestoreViewerIdentity(db, anonymousViewerId, id);

    const response = NextResponse.json({ profile: publicProfile(profile), auth_action: created ? "created" : "logged_in", source: "firestore" });
    response.cookies.set(viewerSessionCookie, createUserSession({
      id,
      email,
      viewer_login_id: profile.viewer_login_id,
    }), userSessionCookieOptions());
    return response;
  } catch (error) {
    console.error("Viewer Google login failed:", error);
    return NextResponse.json({
      error: "ログイン処理で予期しないエラーが発生しました。再度お試しください。",
    }, { status: 500 });
  }
}

function publicProfile(profile: ViewerProfile) {
  const { viewer_password_hash, ...safeProfile } = profile;
  return safeProfile;
}

function stripUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}

async function mergeFirestoreViewerIdentity(db: FirebaseFirestore.Firestore, fromId: string, toId: string) {
  const [likes, activities] = await Promise.all([
    db.collection("likes").where("viewer_profile_id", "==", fromId).limit(500).get(),
    db.collection("viewer_activities").where("viewer_profile_id", "==", fromId).limit(500).get(),
  ]);

  const batch = db.batch();
  likes.docs.forEach((doc) => batch.set(doc.ref, { viewer_profile_id: toId }, { merge: true }));
  activities.docs.forEach((doc) => {
    const data = doc.data();
    batch.set(db.collection("viewer_activities").doc(`${data.streamer_id}_${toId}_${data.action || "view"}`), {
      ...data,
      viewer_profile_id: toId,
    }, { merge: true });
    batch.delete(doc.ref);
  });
  await batch.commit();
}
