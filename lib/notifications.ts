import { getAdminApp } from "./firebaseAdmin";

export async function notifyStreamerLike(tokens: string[] | undefined, streamerName: string) {
  if (!tokens?.length) return;
  const app = getAdminApp();
  if (!app) return;

  await app.messaging().sendEachForMulticast({
    tokens,
    notification: {
      title: "新しいいいね",
      body: `${streamerName}さんに視聴者からいいねが届きました`
    },
    data: {
      type: "LIKE_CREATED"
    }
  });
}
