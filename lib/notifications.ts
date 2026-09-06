import { FieldValue, getAdminApp, getAdminDb } from "./firebaseAdmin";

export const streamerLikeNotification = {
  title: "新しいいいねが届きました",
  body: "視聴者からいいねが届きました",
};

export async function notifyStreamerLike(tokens: string[] | undefined, sourceName?: string) {
  if (!tokens?.length) return;
  const app = getAdminApp();
  if (!app) return;
  const notification = sourceName
    ? {
      title: "新しいいいねが届きました",
      body: `${sourceName}さんからいいねが届きました`,
    }
    : streamerLikeNotification;

  await app.messaging().sendEachForMulticast({
    tokens,
    notification,
    webpush: {
      notification: {
        ...notification,
        icon: "/icon.svg",
        badge: "/icon.svg",
      },
      fcmOptions: { link: "/creator" },
    },
    data: {
      type: "LIKE_CREATED",
      url: "/creator",
    },
  });
}

// VTuberからいいね返しが届いた視聴者への通知。エリートファンでないと送信元を
// 確認できない仕様(仕様確認済み)のため、本文にVTuber名は含めない。
export async function notifyViewerLikedByStreamer(viewerProfileId: string, fcmTokens: string[] | undefined) {
  const db = getAdminDb();
  if (!db) return;

  const title = "VTuberからいいねが届きました";
  const body = "気になるVTuberからいいねが届いています。エリートファンになると送信元を確認できます。";

  await db.collection("notifications").doc().set({
    target_type: "viewer",
    viewer_profile_id: viewerProfileId,
    type: "STREAMER_LIKE_RECEIVED",
    title,
    body,
    read: false,
    created_at: FieldValue.serverTimestamp(),
  });

  if (!fcmTokens?.length) return;
  const app = getAdminApp();
  if (!app) return;

  await app.messaging().sendEachForMulticast({
    tokens: fcmTokens,
    notification: { title, body },
    webpush: {
      notification: {
        title,
        body,
        icon: "/icon.svg",
        badge: "/icon.svg",
      },
      fcmOptions: { link: "/viewer/likes" },
    },
    data: {
      type: "STREAMER_LIKE_RECEIVED",
      url: "/viewer/likes",
    },
  });
}

export async function notifyAdminNewApplication(input: {
  applicationId: string;
  streamerName: string;
  desiredPlan: string;
}) {
  const db = getAdminDb();
  const app = getAdminApp();
  if (!db || !app) return;

  const tokens = await readAdminTokens();
  await db.collection("notifications").doc().set({
    target_type: "admin",
    type: "STREAMER_APPLICATION_CREATED",
    application_id: input.applicationId,
    streamer_name: input.streamerName,
    desired_plan: input.desiredPlan,
    created_at: FieldValue.serverTimestamp(),
    delivered: tokens.length > 0,
  });

  if (!tokens.length) return;

  await app.messaging().sendEachForMulticast({
    tokens,
    notification: {
      title: "新規配信者登録",
      body: `${input.streamerName}さんから登録がありました`,
    },
    webpush: {
      notification: {
        title: "新規配信者登録",
        body: `${input.streamerName}さんから登録がありました`,
        icon: "/icon.svg",
        badge: "/icon.svg",
      },
      fcmOptions: { link: "/admin" },
    },
    data: {
      type: "STREAMER_APPLICATION_CREATED",
      application_id: input.applicationId,
      url: "/admin",
    },
  });
}

export async function notifyAdminPaymentSucceeded(input: {
  planLabel: string;
  amount: number;
  payerLabel: string;
}) {
  const db = getAdminDb();
  const app = getAdminApp();
  if (!db || !app) return;

  const tokens = await readAdminTokens();
  const title = "課金がありました";
  const body = `${input.payerLabel} が${input.planLabel}を購入しました(¥${input.amount.toLocaleString("ja-JP")})`;

  await db.collection("notifications").doc().set({
    target_type: "admin",
    type: "PAYMENT_SUCCEEDED",
    plan_label: input.planLabel,
    amount: input.amount,
    payer_label: input.payerLabel,
    created_at: FieldValue.serverTimestamp(),
    delivered: tokens.length > 0,
  });

  if (!tokens.length) return;

  await app.messaging().sendEachForMulticast({
    tokens,
    notification: { title, body },
    webpush: {
      notification: {
        title,
        body,
        icon: "/icon.svg",
        badge: "/icon.svg",
      },
      fcmOptions: { link: "/admin" },
    },
    data: {
      type: "PAYMENT_SUCCEEDED",
      url: "/admin",
    },
  });
}

export async function notifyAdminClipRequest(input: {
  plan: string;
  streamer: string;
  clipTitle: string;
}) {
  const db = getAdminDb();
  const app = getAdminApp();
  if (!db || !app) return;

  const planLabel = { free: "無料", individual: "個別購入", premium: "premium", pro: "PRO" }[input.plan] || input.plan;
  const title = "切り抜き依頼が届きました";
  const body = `${input.streamer}さん(${planLabel})「${input.clipTitle}」`;

  const tokens = await readAdminTokens();
  await db.collection("notifications").doc().set({
    target_type: "admin",
    type: "CLIP_REQUEST_CREATED",
    plan: input.plan,
    streamer: input.streamer,
    clip_title: input.clipTitle,
    created_at: FieldValue.serverTimestamp(),
    delivered: tokens.length > 0,
  });

  if (!tokens.length) return;

  const result = await app.messaging().sendEachForMulticast({
    tokens,
    notification: { title, body },
    webpush: {
      notification: {
        title,
        body,
        icon: "/icon.svg",
        badge: "/icon.svg",
      },
      fcmOptions: { link: "/admin" },
    },
    data: {
      type: "CLIP_REQUEST_CREATED",
      url: "/admin",
    },
  });
  // 一時的な調査用ログ。個々のトークンの成否(期限切れ等)が
  // sendEachForMulticast の戻り値でしか分からないため
  result.responses.forEach((r, i) => {
    if (!r.success) {
      console.error("FCM send failed for token", tokens[i]?.slice(0, 12), r.error?.code, r.error?.message);
    } else {
      console.log("FCM send ok for token", tokens[i]?.slice(0, 12));
    }
  });
}

async function readAdminTokens() {
  const db = getAdminDb();
  if (!db) return [];

  const tokenSet = new Set<string>();
  const adminDoc = await db.collection("admin_settings").doc("notifications").get();
  addTokens(tokenSet, adminDoc.data()?.fcm_tokens);

  const users = await db.collection("users").where("type", "==", "admin").limit(20).get();
  users.docs.forEach((doc) => addTokens(tokenSet, [doc.data().fcm_token]));

  return Array.from(tokenSet);
}

function addTokens(tokenSet: Set<string>, value: unknown) {
  if (!Array.isArray(value)) return;
  value.forEach((item) => {
    if (typeof item === "string" && item) tokenSet.add(item);
  });
}
