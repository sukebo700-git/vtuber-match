import { getAdminDb } from "../lib/firebaseAdmin";

const targetCollections = [
  "viewer_profiles",
  "streamers",
  "applications",
  "profile_edits",
  "reports",
  "password_reset_requests",
  "payments",
  "likes",
  "super_boosts",
  "viewer_activities",
  "notifications"
];

const fallbackCreatedAt = new Date("2026-01-01T00:00:00.000Z");

async function main() {
  const apply = process.argv.includes("--apply");
  const db = getAdminDb();
  if (!db) {
    throw new Error("Firebase Admin env is required.");
  }

  let totalMissing = 0;
  let totalUpdated = 0;

  for (const collectionName of targetCollections) {
    const snapshot = await db.collection(collectionName).get();
    const missingDocs = snapshot.docs.filter((doc) => doc.data().created_at === undefined);
    totalMissing += missingDocs.length;

    if (!apply) {
      console.log(`${collectionName}: ${missingDocs.length} missing created_at`);
      continue;
    }

    let batch = db.batch();
    let pending = 0;

    for (const doc of missingDocs) {
      const data = doc.data();
      batch.set(doc.ref, { created_at: data.updated_at ?? fallbackCreatedAt }, { merge: true });
      pending += 1;
      totalUpdated += 1;

      if (pending >= 450) {
        await batch.commit();
        batch = db.batch();
        pending = 0;
      }
    }

    if (pending > 0) {
      await batch.commit();
    }
    console.log(`${collectionName}: updated ${missingDocs.length}`);
  }

  if (apply) {
    console.log(`Backfill completed. Updated ${totalUpdated} docs.`);
  } else {
    console.log(`Dry run completed. ${totalMissing} docs would be updated. Use --apply to write changes.`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
