import { FieldValue, getAdminDb } from "./firebaseAdmin";

// スワイプカードの既見管理(48hクールダウン): 視聴者1人につき1ドキュメントに
// {streamerId: 最終閲覧ISO時刻} のマップを持たせ、1 readで済むようにする。
// (streamerごとに別ドキュメントにすると視聴者×配信者の組み合わせ分readが必要になり高コスト)
const collectionName = "swipe_state";
const cooldownMs = 48 * 60 * 60 * 1000;

export async function getRecentlySeenStreamerIds(viewerId: string): Promise<Set<string>> {
  if (!viewerId) return new Set();
  const db = getAdminDb();
  if (!db) return new Set();
  const doc = await db.collection(collectionName).doc(viewerId).get();
  if (!doc.exists) return new Set();
  const seen = doc.data()?.seen || {};
  const cutoff = Date.now() - cooldownMs;
  const result = new Set<string>();
  for (const [streamerId, value] of Object.entries(seen)) {
    const time = typeof value === "string" ? Date.parse(value) : NaN;
    if (Number.isFinite(time) && time > cutoff) result.add(streamerId);
  }
  return result;
}

export async function markStreamersSeen(viewerId: string, streamerIds: string[]): Promise<void> {
  if (!viewerId || !streamerIds.length) return;
  const db = getAdminDb();
  if (!db) return;
  const ref = db.collection(collectionName).doc(viewerId);
  const now = new Date().toISOString();
  const cutoff = Date.now() - cooldownMs;

  await db.runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    const existing: Record<string, unknown> = doc.exists ? doc.data()?.seen || {} : {};
    const next: Record<string, string> = {};
    // 48h超の古いエントリはここで間引き、ドキュメントが際限なく肥大化しないようにする。
    for (const [streamerId, value] of Object.entries(existing)) {
      const time = typeof value === "string" ? Date.parse(value) : NaN;
      if (Number.isFinite(time) && time > cutoff) next[streamerId] = value as string;
    }
    for (const streamerId of streamerIds.slice(0, 40)) {
      next[streamerId] = now;
    }
    // merge:trueだとネストしたseenマップがフィールド単位でディープマージされ、
    // nextから間引いたはずの古いキーが消えずに残ってしまう。このドキュメントは
    // seen/updated_atしか持たないため、mergeなしの完全上書きで確実に反映する。
    tx.set(ref, { seen: next, updated_at: FieldValue.serverTimestamp() });
  });
}
