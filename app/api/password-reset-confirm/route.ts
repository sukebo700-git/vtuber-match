import { NextResponse } from "next/server";
import { FieldValue, getAdminDb } from "@/lib/firebaseAdmin";
import { completeLocalPasswordResetRequest, readLocalPasswordResetRequests, updateLocalCreatorPassword, updateLocalViewerPassword } from "@/lib/localStore";
import { hashPassword } from "@/lib/password";
import { isResetTokenValid } from "@/lib/passwordResetToken";

const GENERIC_ERROR = "リンクが無効か、有効期限(1時間)が切れています。もう一度パスワード再設定を申請してください。";

export async function POST(request: Request) {
  const body = await request.json();
  const requestId = String(body.id || "").trim();
  const token = String(body.token || "").trim();
  const newPassword = String(body.new_password || "");

  if (!requestId || !token) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: "新しいパスワードは8文字以上で入力してください。" }, { status: 400 });
  }

  const db = getAdminDb();

  if (!db) {
    const resetRequest = (await readLocalPasswordResetRequests()).find((item) => item.id === requestId);
    if (!resetRequest || resetRequest.status !== "open" || !isResetTokenValid(resetRequest.token_hash, resetRequest.token_expires_at, token)) {
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
    }

    const passwordHash = hashPassword(newPassword);
    const target = resetRequest.user_type === "creator"
      ? await updateLocalCreatorPassword({
        email: resetRequest.email,
        application_id: resetRequest.application_id,
        streamer_id: resetRequest.streamer_id,
        password_hash: passwordHash,
      })
      : await updateLocalViewerPassword({
        email: resetRequest.email,
        viewer_id: resetRequest.viewer_id,
        password_hash: passwordHash,
      });

    if (!target) return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
    await completeLocalPasswordResetRequest(requestId);
    return NextResponse.json({ ok: true, source: "local" });
  }

  const requestRef = db.collection("password_reset_requests").doc(requestId);
  const requestDoc = await requestRef.get();
  if (!requestDoc.exists) return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });

  const resetRequest = requestDoc.data() || {};
  if (resetRequest.status !== "open" || !isResetTokenValid(resetRequest.token_hash, resetRequest.token_expires_at, token)) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  const passwordHash = hashPassword(newPassword);

  if (resetRequest.user_type === "creator") {
    const applicationId = String(resetRequest.application_id || "");
    if (!applicationId) return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
    const applicationDoc = await db.collection("applications").doc(applicationId).get();
    if (!applicationDoc.exists || !isActiveApplication(applicationDoc.data())) {
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
    }
    const streamerId = String(resetRequest.streamer_id || applicationDoc.data()?.streamer_id || "");
    if (streamerId) {
      const streamerDoc = await db.collection("streamers").doc(streamerId).get();
      if (!isActiveStreamer(streamerDoc.data())) {
        return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
      }
    }
    await applicationDoc.ref.set({ creator_password_hash: passwordHash, password_reset_at: FieldValue.serverTimestamp() }, { merge: true });
  } else {
    const viewerId = String(resetRequest.viewer_id || "");
    if (!viewerId) return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
    const viewerDoc = await db.collection("viewer_profiles").doc(viewerId).get();
    if (!viewerDoc.exists) return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
    await viewerDoc.ref.set({ viewer_password_hash: passwordHash, password_reset_at: FieldValue.serverTimestamp() }, { merge: true });
  }

  await requestRef.set({
    status: "completed",
    resolved_via: "self",
    completed_at: FieldValue.serverTimestamp(),
    token_hash: FieldValue.delete(),
    token_expires_at: FieldValue.delete(),
  }, { merge: true });

  return NextResponse.json({ ok: true, source: "firestore" });
}

function isActiveApplication(data?: FirebaseFirestore.DocumentData | null) {
  return data?.withdrawal_status !== "requested" && data?.is_deleted !== true;
}

function isActiveStreamer(data?: FirebaseFirestore.DocumentData | null) {
  return Boolean(data) && data?.withdrawal_status !== "requested" && data?.is_deleted !== true;
}
