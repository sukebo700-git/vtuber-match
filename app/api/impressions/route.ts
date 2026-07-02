import { NextResponse } from "next/server";
import { FieldValue, getAdminDb } from "@/lib/firebaseAdmin";
import { incrementLocalStreamer } from "@/lib/localStore";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const streamerIds = normalizeStreamerIds(body);
    if (!streamerIds.length) return NextResponse.json({ error: "streamer_id is required" }, { status: 400 });

    const db = getAdminDb();
    if (!db) {
      if (process.env.NODE_ENV !== "production") {
        await Promise.all(streamerIds.map((streamerId) => (
          incrementLocalStreamer(streamerId, "impressions").catch((error) => {
            console.error("Failed to record local impression:", safeErrorMessage(error));
          })
        )));
      }
      return NextResponse.json({ ok: true, skipped: true });
    }

    const weekKey = jstWeekKey(new Date());
    const impressionCounts = countStreamerIds(streamerIds);
    const refs = Array.from(impressionCounts.keys()).map((streamerId) => db.collection("streamers").doc(streamerId));
    const docs = await db.getAll(...refs);
    const batch = db.batch();
    docs.forEach((doc, index) => {
      const incrementBy = impressionCounts.get(refs[index].id) || 1;
      const patch: Record<string, unknown> = {
        impressions: FieldValue.increment(incrementBy),
        [`weekly_impressions.${weekKey}`]: FieldValue.increment(incrementBy),
      };
      Object.assign(patch, pruneWeeklyImpressions(doc.data()?.weekly_impressions));
      batch.set(refs[index], patch, { merge: true });
    });
    await batch.commit();

    return NextResponse.json({ ok: true, count: streamerIds.length, source: "firestore" });
  } catch (error) {
    console.error("Skipped impression write:", safeErrorMessage(error));
    return NextResponse.json({ ok: true, skipped: true });
  }
}

function normalizeStreamerIds(body: Record<string, unknown>) {
  const raw = Array.isArray(body.streamer_ids) ? body.streamer_ids : [body.streamer_id];
  return raw.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 40);
}

function countStreamerIds(streamerIds: string[]) {
  const counts = new Map<string, number>();
  streamerIds.forEach((streamerId) => {
    counts.set(streamerId, (counts.get(streamerId) || 0) + 1);
  });
  return counts;
}

function pruneWeeklyImpressions(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const keep = new Set(recentJstWeekKeys(12));
  return Object.fromEntries(
    Object.keys(value as Record<string, unknown>)
      .filter((key) => /^\d{4}-\d{2}-\d{2}$/.test(key) && !keep.has(key))
      .map((key) => [`weekly_impressions.${key}`, FieldValue.delete()])
  );
}

function recentJstWeekKeys(weeks: number) {
  const keys: string[] = [];
  for (let index = 0; index < weeks; index += 1) {
    keys.push(jstWeekKey(new Date(Date.now() - index * 7 * 24 * 60 * 60 * 1000)));
  }
  return keys;
}

function jstWeekKey(date: Date) {
  const jstDate = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  const base = new Date(`${jstDate}T00:00:00+09:00`);
  const day = base.getUTCDay() || 7;
  base.setUTCDate(base.getUTCDate() - day + 1);
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(base);
}

function safeErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || "unknown error");
}
