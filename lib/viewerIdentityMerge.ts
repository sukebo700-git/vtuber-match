import { FieldValue } from "./firebaseAdmin";

// 未登録(匿名)訪問者が登録すると、匿名IDでの活動履歴を新しい登録IDへ引き継ぐ。
// viewer_profile_idを持つコレクションを追加したら、ここにも追加すること
// (追加を忘れると、そのコレクションだけ匿名IDに孤立したまま残ってしまう)。
export async function mergeFirestoreViewerIdentity(db: FirebaseFirestore.Firestore, fromId: string, toId: string) {
  await Promise.all([
    mergeLikesAndActivities(db, fromId, toId),
    mergeReKeyedCollection(db, fromId, toId, "matches", (streamerId) => `${toId}_${streamerId}`),
    mergeReKeyedCollection(db, fromId, toId, "streamer_likes", (streamerId) => `${streamerId}_${toId}`, "streamer_id"),
    mergeSwipeState(db, fromId, toId),
  ]);
}

async function mergeLikesAndActivities(db: FirebaseFirestore.Firestore, fromId: string, toId: string) {
  const [likes, activities] = await Promise.all([
    db.collection("likes").where("viewer_profile_id", "==", fromId).limit(500).get(),
    db.collection("viewer_activities").where("viewer_profile_id", "==", fromId).limit(500).get(),
  ]);
  if (!likes.docs.length && !activities.docs.length) return;

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

/**
 * ドキュメントIDに視聴者IDを含むコレクション(matches: `${viewerId}_${streamerId}`,
 * streamer_likes: `${streamerId}_${viewerId}`)向け。新しいIDでドキュメントを
 * 作り直し、古い方は削除する。
 */
async function mergeReKeyedCollection(
  db: FirebaseFirestore.Firestore,
  fromId: string,
  toId: string,
  collectionName: string,
  buildNewDocId: (streamerId: string) => string,
  streamerIdField: string = "streamer_id",
) {
  const snapshot = await db.collection(collectionName).where("viewer_profile_id", "==", fromId).limit(500).get();
  if (!snapshot.docs.length) return;

  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    const streamerId = String(data[streamerIdField] || "");
    if (!streamerId) return;
    batch.set(db.collection(collectionName).doc(buildNewDocId(streamerId)), {
      ...data,
      viewer_profile_id: toId,
    }, { merge: true });
    batch.delete(doc.ref);
  });
  await batch.commit();
}

/** swipe_stateは視聴者1人1ドキュメントなので、両者のseenマップを
 * タイムスタンプの新しい方を優先してマージする。 */
async function mergeSwipeState(db: FirebaseFirestore.Firestore, fromId: string, toId: string) {
  const fromRef = db.collection("swipe_state").doc(fromId);
  const fromDoc = await fromRef.get();
  if (!fromDoc.exists) return;
  const fromSeen: Record<string, string> = fromDoc.data()?.seen || {};
  if (!Object.keys(fromSeen).length) {
    await fromRef.delete();
    return;
  }

  const toRef = db.collection("swipe_state").doc(toId);
  const toDoc = await toRef.get();
  const toSeen: Record<string, string> = toDoc.exists ? toDoc.data()?.seen || {} : {};

  const merged: Record<string, string> = { ...toSeen };
  for (const [streamerId, seenAt] of Object.entries(fromSeen)) {
    const existing = merged[streamerId];
    if (!existing || Date.parse(seenAt) > Date.parse(existing)) merged[streamerId] = seenAt;
  }

  await db.runTransaction(async (tx) => {
    tx.set(toRef, { seen: merged, updated_at: FieldValue.serverTimestamp() });
    tx.delete(fromRef);
  });
}
