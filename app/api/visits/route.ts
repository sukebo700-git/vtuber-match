import { NextResponse } from "next/server";
import { FieldValue, getAdminDb } from "@/lib/firebaseAdmin";
import { addLocalVisit } from "@/lib/localStore";

export async function POST() {
  const date = new Date().toISOString().slice(0, 10);
  const db = getAdminDb();

  if (!db) {
    await addLocalVisit(date);
    return NextResponse.json({ ok: true, source: "local" });
  }

  await db.collection("site_visits").doc(date).set({
    date,
    count: FieldValue.increment(1),
    updated_at: FieldValue.serverTimestamp(),
  }, { merge: true });

  return NextResponse.json({ ok: true, source: "firestore" });
}
