import { FieldValue, getAdminDb } from "./firebaseAdmin";

export async function ensureDailyGuestLikes() {
  const db = getAdminDb();
  if (!db) return;

  const date = new Date().toISOString().slice(0, 10);
  const markerRef = db.collection("system_jobs").doc(`daily_guest_likes_${date}`);
  const marker = await markerRef.get();
  if (marker.exists) return;

  await db.runTransaction(async (tx) => {
    const freshMarker = await tx.get(markerRef);
    if (freshMarker.exists) return;
    const snapshot = await tx.get(db.collection("streamers").limit(200));
    snapshot.docs.forEach((doc) => {
      if (doc.data().is_visible !== false && Math.random() < 0.5) {
        tx.update(doc.ref, { likes: FieldValue.increment(1) });
        tx.set(db.collection("notifications").doc(), {
          target_type: "streamer",
          streamer_id: doc.id,
          type: "GUEST_LIKE_CREATED",
          title: "新しいいいね",
          body: "誰かがいいねを贈りました",
          read: false,
          created_at: FieldValue.serverTimestamp(),
        });
      }
    });
    tx.set(markerRef, { date, created_at: FieldValue.serverTimestamp() });
  });
}
