import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { getAdminApp, getAdminDb } from "@/lib/firebaseAdmin";

type NotificationTargetType = "admin" | "creator" | "viewer";

export async function POST(request: Request) {
  const body = await request.json();
  const userId = String(body.user_id || "");
  const targetType: NotificationTargetType = body.target_type === "admin" ? "admin" : body.target_type === "viewer" ? "viewer" : "creator";
  const streamerId = String(body.streamer_id || "");
  const applicationId = String(body.application_id || "");
  const viewerProfileId = String(body.viewer_profile_id || "");

  if (!userId) return NextResponse.json({ error: "user_id is required" }, { status: 400 });
  if (targetType === "admin") {
    const unauthorized = requireAdmin(request);
    if (unauthorized) return unauthorized;
  }

  const db = getAdminDb();
  const app = getAdminApp();
  if (!db || !app) return NextResponse.json({ error: "Firebase Admin設定が未設定です。" }, { status: 501 });

  const tokens = await readTokens(db, { userId, targetType, streamerId, applicationId, viewerProfileId });
  if (!tokens.length) return NextResponse.json({ error: "通知キーが未登録です。先に通知ONにしてください。" }, { status: 404 });

  const url = targetType === "admin" ? "/admin" : targetType === "viewer" ? "/viewer" : "/creator";
  const result = await app.messaging().sendEachForMulticast({
    tokens,
    notification: {
      title: "Vtuberマッチ テスト通知",
      body: "通知設定は有効です。",
    },
    webpush: {
      notification: {
        title: "Vtuberマッチ テスト通知",
        body: "通知設定は有効です。",
        icon: "/icon.svg",
        badge: "/icon.svg",
      },
      fcmOptions: { link: url },
    },
    data: {
      type: "PUSH_TEST",
      url,
    },
  });

  const failureErrors = result.responses
    .filter((response) => !response.success)
    .map((response) => response.error?.message || "unknown error");

  return NextResponse.json({
    ok: result.successCount > 0,
    success_count: result.successCount,
    failure_count: result.failureCount,
    failure_errors: failureErrors,
  }, { status: result.successCount > 0 ? 200 : 502 });
}

async function readTokens(
  db: FirebaseFirestore.Firestore,
  input: { userId: string; targetType: NotificationTargetType; streamerId: string; applicationId: string; viewerProfileId: string },
) {
  const tokenSet = new Set<string>();

  const userDoc = await db.collection("users").doc(input.userId).get();
  const userToken = userDoc.data()?.fcm_token;
  if (typeof userToken === "string") tokenSet.add(userToken);

  if (input.targetType === "admin") {
    const adminDoc = await db.collection("admin_settings").doc("notifications").get();
    addTokens(tokenSet, adminDoc.data()?.fcm_tokens);
  }

  if (input.streamerId) {
    const streamerDoc = await db.collection("streamers").doc(input.streamerId).get();
    addTokens(tokenSet, streamerDoc.data()?.fcm_tokens);
  }

  if (input.applicationId) {
    const applicationDoc = await db.collection("applications").doc(input.applicationId).get();
    addTokens(tokenSet, applicationDoc.data()?.fcm_tokens);
  }

  if (input.viewerProfileId) {
    const viewerDoc = await db.collection("viewer_profiles").doc(input.viewerProfileId).get();
    addTokens(tokenSet, viewerDoc.data()?.fcm_tokens);
  }

  return Array.from(tokenSet);
}

function addTokens(tokenSet: Set<string>, value: unknown) {
  if (!Array.isArray(value)) return;
  value.forEach((item) => {
    if (typeof item === "string" && item) tokenSet.add(item);
  });
}
