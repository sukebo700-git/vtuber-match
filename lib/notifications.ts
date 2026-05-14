import { FieldValue, getAdminApp, getAdminDb } from "./firebaseAdmin";

export async function notifyStreamerLike(tokens: string[] | undefined, streamerName: string) {
  if (!tokens?.length) return;
  const app = getAdminApp();
  if (!app) return;

  await app.messaging().sendEachForMulticast({
    tokens,
    notification: {
      title: "新しいいいね",
      body: `${streamerName}さんに視聴者からいいねが届きました`,
    },
    webpush: {
      notification: {
        title: "新しいいいね",
        body: `${streamerName}さんに視聴者からいいねが届きました`,
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

export async function notifyViewerCreatorLike(tokens: string[] | undefined) {
  if (!tokens?.length) return;
  const app = getAdminApp();
  if (!app) return;

  await app.messaging().sendEachForMulticast({
    tokens,
    notification: {
      title: "配信者からいいね",
      body: "マッチした配信者からいいねが届きました",
    },
    webpush: {
      notification: {
        title: "配信者からいいね",
        body: "マッチした配信者からいいねが届きました",
        icon: "/icon.svg",
        badge: "/icon.svg",
      },
      fcmOptions: { link: "/viewer" },
    },
    data: {
      type: "CREATOR_LIKE_CREATED",
      url: "/viewer",
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
