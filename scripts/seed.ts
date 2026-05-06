import { getAdminDb, FieldValue } from "../lib/firebaseAdmin";
import { mockStreamers } from "../lib/mockData";

async function main() {
  const db = getAdminDb();
  if (!db) {
    throw new Error("Firebase admin env is required. Copy .env.example and set FIREBASE_* values.");
  }

  const batch = db.batch();
  for (const streamer of mockStreamers) {
    const ref = db.collection("streamers").doc(streamer.id);
    batch.set(ref, {
      ...streamer,
      created_at: FieldValue.serverTimestamp()
    });
  }

  await batch.commit();
  console.log(`Seeded ${mockStreamers.length} streamers.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
