import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { demoStreamers } from "@/lib/demoStreamers";
import { addLocalStreamer, readAllLocalStreamers } from "@/lib/localStore";

export async function POST(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const db = getAdminDb();
  if (!db) {
    const existing = await readAllLocalStreamers();
    const existingNames = new Set(existing.map((streamer) => streamer.name));
    const created = [];
    for (const streamer of demoStreamers) {
      if (existingNames.has(streamer.name)) continue;
      created.push(await addLocalStreamer(streamer));
    }
    return NextResponse.json({ created: created.length, streamers: created, source: "local" });
  }

  const batch = db.batch();
  let created = 0;
  const streamers = [];
  for (const streamer of demoStreamers) {
    const ref = db.collection("streamers").doc(streamer.id);
    const snapshot = await ref.get();
    if (!snapshot.exists) created += 1;
    batch.set(ref, streamer, { merge: true });
    streamers.push(streamer);
  }
  await batch.commit();

  return NextResponse.json({ created, streamers, source: "firestore" });
}
