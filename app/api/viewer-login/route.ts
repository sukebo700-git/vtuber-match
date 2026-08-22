import { NextResponse } from "next/server";
import { FieldValue, getAdminDb } from "@/lib/firebaseAdmin";
import { mergeLocalViewerIdentity, readLocalViewerProfilesRaw, upsertLocalViewerProfile } from "@/lib/localStore";
import { hashPassword, makeViewerLoginId } from "@/lib/password";
import { createUserSession, userSessionCookieOptions, viewerSessionCookie } from "@/lib/userSession";
import { mergeFirestoreViewerIdentity } from "@/lib/viewerIdentityMerge";
import type { ViewerProfile } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const displayName = String(body.display_name || "").trim().slice(0, 40);
    const twitterId = String(body.twitter_id || "").trim().slice(0, 60);
    const registrationSource = String(body.registration_source || "").trim().slice(0, 60);
    const anonymousViewerId = String(body.anonymous_viewer_id || "").trim().slice(0, 120);
    const mode = body.mode === "register" ? "register" : "login";

    if (!email || !email.includes("@")) return NextResponse.json({ error: "メールアドレスを入力してください。" }, { status: 400 });
    if (password.length < 8) return NextResponse.json({ error: "パスワードは8文字以上で入力してください。" }, { status: 400 });

    const passwordHash = hashPassword(password);
    const db = getAdminDb();

    if (!db && process.env.NODE_ENV === "production") {
      return NextResponse.json({
        error: "ただいま登録処理を完了できませんでした。時間をおいてもう一度お試しください。解決しない場合はXのDMまたはメールでお問い合わせください。",
        support: {
          x: "https://x.com/vtubermatch",
          email: "vtubermatch@gmail.com",
        },
      }, { status: 503 });
    }

    if (!db) {
      const profiles = await readLocalViewerProfilesRaw();
      const existing = profiles.find((profile) => profile.email?.toLowerCase() === email);
      const created = !existing;
      if (mode === "login" && !existing) {
        return NextResponse.json({ error: "このメールアドレスは未登録です。新規登録を選んでください。" }, { status: 404 });
      }
      if (mode === "register" && existing?.viewer_password_hash) {
        return NextResponse.json({ error: "このメールアドレスは登録済みです。ログインを選んでください。" }, { status: 409 });
      }
      if (existing?.viewer_password_hash && existing.viewer_password_hash !== passwordHash) {
        return NextResponse.json({ error: "メールアドレスまたはパスワードが違います。" }, { status: 401 });
      }
      const id = existing?.id || (anonymousViewerId.startsWith("anon-viewer-") ? anonymousViewerId : `viewer-${Date.now()}`);
      const now = new Date().toISOString();
      const profile: ViewerProfile = {
        ...existing,
        id,
        anonymous_viewer_id: anonymousViewerId || existing?.anonymous_viewer_id,
        email,
        viewer_login_id: existing?.viewer_login_id || makeViewerLoginId(),
        viewer_password_hash: existing?.viewer_password_hash || passwordHash,
        viewer_plan: "free",
        subscription_status: "canceled",
        stripe_subscription_id: "",
        display_name: displayName || existing?.display_name || "",
        twitter_id: twitterId || existing?.twitter_id || "",
        registration_source: existing?.registration_source || registrationSource || "",
        visible_to_matched_streamers: existing?.visible_to_matched_streamers !== false,
        last_viewer_login_at: now,
        is_deleted: false
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
    if (mode === "login" && !existingDoc) {
      return NextResponse.json({ error: "このメールアドレスは未登録です。新規登録を選んでください。" }, { status: 404 });
    }
    if (mode === "register" && existing?.viewer_password_hash) {
      return NextResponse.json({ error: "このメールアドレスは登録済みです。ログインを選んでください。" }, { status: 409 });
    }
    if (existing?.viewer_password_hash && existing.viewer_password_hash !== passwordHash) {
      return NextResponse.json({ error: "メールアドレスまたはパスワードが違います。" }, { status: 401 });
    }

    const id = existingDoc?.id || (anonymousViewerId.startsWith("anon-viewer-") ? anonymousViewerId : `viewer-${Date.now()}`);
    const profile: ViewerProfile = {
      id,
      anonymous_viewer_id: anonymousViewerId || existing?.anonymous_viewer_id,
      email,
      viewer_login_id: existing?.viewer_login_id || makeViewerLoginId(),
      viewer_password_hash: existing?.viewer_password_hash || passwordHash,
      viewer_plan: "free",
      subscription_status: "canceled",
      stripe_subscription_id: "",
      display_name: displayName || existing?.display_name || "",
      youtube_display_name: existing?.youtube_display_name || "",
      twitter_id: twitterId || existing?.twitter_id || "",
      registration_source: existing?.registration_source || registrationSource || "",
      one_liner: existing?.one_liner || "",
      image: existing?.image || "",
      profile: existing?.profile || "",
      favorite_categories: Array.isArray(existing?.favorite_categories) ? existing?.favorite_categories : [],
      visible_to_matched_streamers: existing?.visible_to_matched_streamers !== false,
      last_viewer_login_at: new Date().toISOString(),
      is_deleted: false
    };

    await db.collection("viewer_profiles").doc(id).set({
      ...stripUndefined(profile),
      ...(created ? { created_at: FieldValue.serverTimestamp(), registered_at: FieldValue.serverTimestamp() } : {}),
      last_viewer_login_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp()
    }, { merge: true });
    await db.collection("viewer_login_events").add(stripUndefined({
      viewer_profile_id: id,
      viewer_login_id: profile.viewer_login_id,
      email,
      mode,
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
    console.error("Viewer login/register failed:", error);
    return NextResponse.json({
      error: "登録処理で予期しないエラーが発生しました。再度お試しください。解決しない場合はXのDMまたはメールでお問い合わせください。",
      support: {
        x: "https://x.com/vtubermatch",
        email: "vtubermatch@gmail.com",
      },
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
