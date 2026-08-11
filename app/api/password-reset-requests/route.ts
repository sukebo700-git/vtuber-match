import { NextResponse } from "next/server";
import { FieldValue, getAdminDb, stripUndefined } from "@/lib/firebaseAdmin";
import { addLocalPasswordResetRequest, readLocalApplications, readLocalPasswordResetRequests, readLocalStreamers, readLocalViewerProfilesRaw, setLocalPasswordResetToken } from "@/lib/localStore";
import { sendEmail } from "@/lib/email";
import { createResetToken } from "@/lib/passwordResetToken";
import type { PasswordResetRequest } from "@/lib/types";

// 直近このぶんは新規メール送信を省く(同一申請の連打でメールが何通も飛ぶのを防ぐ簡易レート制限)。
const RESEND_COOLDOWN_MS = 5 * 60 * 1000;

export async function POST(request: Request) {
  const body = await request.json();
  const userType = String(body.user_type || "") as PasswordResetRequest["user_type"];
  const email = String(body.email || "").trim().toLowerCase();
  const name = clean(body.name, 120);
  const applicationId = clean(body.application_id, 80);
  const streamerId = clean(body.streamer_id, 80);
  const viewerId = clean(body.viewer_id, 80);
  const note = clean(body.note, 400);

  if (userType !== "creator" && userType !== "viewer") {
    return NextResponse.json({ error: "user_type is required" }, { status: 400 });
  }
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const input = {
    user_type: userType,
    email,
    name,
    application_id: applicationId,
    streamer_id: streamerId,
    viewer_id: viewerId,
    note
  };

  const db = getAdminDb();

  // 対象アカウントの有無に関わらずレスポンス文言は同一にする(メールアドレスの
  // 存在有無を外部に漏らさないため)。実在すればトークンを発行しメール送信する。
  if (!db) {
    const recentOpen = (await readLocalPasswordResetRequests()).find((item) => (
      item.email.toLowerCase() === email &&
      item.user_type === userType &&
      item.status === "open" &&
      item.created_at &&
      Date.now() - new Date(item.created_at).getTime() < RESEND_COOLDOWN_MS
    ));

    const resetRequest = await addLocalPasswordResetRequest(input);

    if (!recentOpen) {
      const target = userType === "creator"
        ? await findLocalCreatorTarget(email, applicationId, streamerId)
        : await findLocalViewerTarget(email, viewerId);

      if (target) {
        const { token, tokenHash, expiresAt } = createResetToken();
        await setLocalPasswordResetToken(resetRequest.id, {
          token_hash: tokenHash,
          token_expires_at: expiresAt,
          ...target,
        });
        await sendResetEmail({ email, name: target.recipientName || name, token, requestId: resetRequest.id });
      }
    }

    return NextResponse.json({ request: resetRequest, source: "local" }, { status: 201 });
  }

  const recentOpenSnapshot = await db.collection("password_reset_requests")
    .where("email", "==", email)
    .where("user_type", "==", userType)
    .where("status", "==", "open")
    .limit(5)
    .get();
  const recentOpen = recentOpenSnapshot.docs.find((doc) => {
    const createdAt = doc.data().created_at;
    const createdAtMs = createdAt && typeof createdAt.toMillis === "function" ? createdAt.toMillis() : 0;
    return createdAtMs && Date.now() - createdAtMs < RESEND_COOLDOWN_MS;
  });

  const doc = await db.collection("password_reset_requests").add(stripUndefined({
    ...input,
    status: "open",
    created_at: FieldValue.serverTimestamp()
  }));

  if (!recentOpen) {
    const target = userType === "creator"
      ? await findFirestoreCreatorTarget(db, email, applicationId, streamerId)
      : await findFirestoreViewerTarget(db, email, viewerId);

    if (target) {
      const { token, tokenHash, expiresAt } = createResetToken();
      await doc.set(stripUndefined({
        token_hash: tokenHash,
        token_expires_at: expiresAt,
        application_id: "application_id" in target ? target.application_id : undefined,
        streamer_id: "streamer_id" in target ? target.streamer_id : undefined,
        viewer_id: "viewer_id" in target ? target.viewer_id : undefined,
      }), { merge: true });
      await sendResetEmail({ email, name: target.recipientName || name, token, requestId: doc.id });
    }
  }

  return NextResponse.json({ id: doc.id, source: "firestore" }, { status: 201 });
}

function clean(value: unknown, max: number) {
  return String(value || "").trim().slice(0, max);
}

async function sendResetEmail(input: { email: string; name: string; token: string; requestId: string }) {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").trim().replace(/\/$/, "");
  const link = `${baseUrl}/password-reset/confirm?id=${input.requestId}&token=${input.token}`;
  await sendEmail({
    to: input.email,
    subject: "【Vtuberマッチ】パスワード再設定のご案内",
    html: `
      <p>${escapeHtml(input.name)} 様</p>
      <p>Vtuberマッチのパスワード再設定申請を受け付けました。以下のリンクから新しいパスワードを設定してください(このリンクの有効期限は1時間です)。</p>
      <p><a href="${link}">${link}</a></p>
      <p>心当たりがない場合は、このメールを無視してください。パスワードは変更されません。</p>
    `.trim(),
  }).catch((error) => {
    console.error("パスワード再設定メールの送信に失敗しました:", error instanceof Error ? error.message : error);
  });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] || char));
}

// --- Firestore側: 実在確認(admin resolve APIのfindCreatorApplication/findViewerProfileと
// 同等のロジック。既存の管理API本体には手を入れず、ここに複製する) ---
async function findFirestoreCreatorTarget(db: FirebaseFirestore.Firestore, email: string, applicationId: string, streamerId: string) {
  if (applicationId) {
    const doc = await db.collection("applications").doc(applicationId).get();
    if (doc.exists && isActiveApplication(doc.data())) {
      return { application_id: doc.id, streamer_id: String(doc.data()?.streamer_id || ""), recipientName: String(doc.data()?.name || "") };
    }
  }
  if (streamerId) {
    const streamerDoc = await db.collection("streamers").doc(streamerId).get();
    if (isActiveStreamer(streamerDoc.data())) {
      const sourceApplicationId = String(streamerDoc.data()?.source_application_id || "");
      if (sourceApplicationId) {
        const doc = await db.collection("applications").doc(sourceApplicationId).get();
        if (doc.exists && isActiveApplication(doc.data())) {
          return { application_id: doc.id, streamer_id: streamerId, recipientName: String(streamerDoc.data()?.name || "") };
        }
      }
      const snapshot = await db.collection("applications").where("streamer_id", "==", streamerId).limit(10).get();
      const active = snapshot.docs.find((d) => isActiveApplication(d.data()));
      if (active) return { application_id: active.id, streamer_id: streamerId, recipientName: String(streamerDoc.data()?.name || "") };
    }
  }
  const [applicationSnapshot, streamerSnapshot] = await Promise.all([
    db.collection("applications").where("email", "==", email).limit(20).get(),
    db.collection("streamers").where("creator_email", "==", email).limit(20).get(),
  ]);
  const activeApplications = applicationSnapshot.docs.filter((doc) => isActiveApplication(doc.data()));
  for (const streamerDoc of streamerSnapshot.docs) {
    if (!isActiveStreamer(streamerDoc.data())) continue;
    const sourceApplicationId = String(streamerDoc.data().source_application_id || "");
    const linked = sourceApplicationId ? activeApplications.find((doc) => doc.id === sourceApplicationId) : undefined;
    if (linked) return { application_id: linked.id, streamer_id: streamerDoc.id, recipientName: String(streamerDoc.data()?.name || linked.data()?.name || "") };
    const byStreamer = activeApplications.find((doc) => String(doc.data().streamer_id || "") === streamerDoc.id);
    if (byStreamer) return { application_id: byStreamer.id, streamer_id: streamerDoc.id, recipientName: String(streamerDoc.data()?.name || byStreamer.data()?.name || "") };
  }
  const fallback = activeApplications[0];
  if (fallback) return { application_id: fallback.id, streamer_id: String(fallback.data()?.streamer_id || ""), recipientName: String(fallback.data()?.name || "") };
  return null;
}

async function findFirestoreViewerTarget(db: FirebaseFirestore.Firestore, email: string, viewerId: string) {
  if (viewerId) {
    const doc = await db.collection("viewer_profiles").doc(viewerId).get();
    if (doc.exists) return { viewer_id: doc.id, recipientName: String(doc.data()?.name || "") };
  }
  const snapshot = await db.collection("viewer_profiles").where("email", "==", email).limit(1).get();
  const doc = snapshot.docs[0];
  if (doc) return { viewer_id: doc.id, recipientName: String(doc.data()?.name || "") };
  return null;
}

function isActiveApplication(data?: FirebaseFirestore.DocumentData | null) {
  return data?.withdrawal_status !== "requested" && data?.is_deleted !== true;
}

function isActiveStreamer(data?: FirebaseFirestore.DocumentData | null) {
  return Boolean(data) && data?.withdrawal_status !== "requested" && data?.is_deleted !== true;
}

// --- ローカル開発フォールバック: 実在確認(簡易版) ---
async function findLocalCreatorTarget(email: string, applicationId: string, streamerId: string) {
  const applications = await readLocalApplications();
  const streamers = await readLocalStreamers();
  const matched = applications.find((application) => (
    (applicationId && application.id === applicationId) ||
    (streamerId && application.streamer_id === streamerId) ||
    application.email.toLowerCase() === email
  ));
  if (!matched) return null;
  const streamer = matched.streamer_id ? streamers.find((item) => item.id === matched.streamer_id) : undefined;
  if (matched.streamer_id && streamer && streamer.withdrawal_status === "requested") return null;
  return { application_id: matched.id, streamer_id: matched.streamer_id || "", recipientName: matched.name || "" };
}

async function findLocalViewerTarget(email: string, viewerId: string) {
  const profiles = await readLocalViewerProfilesRaw();
  const matched = profiles.find((profile) => (viewerId && profile.id === viewerId) || profile.email?.toLowerCase() === email);
  if (!matched) return null;
  return { viewer_id: matched.id, recipientName: matched.display_name || "" };
}
