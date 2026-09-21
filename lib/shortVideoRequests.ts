import type { DocumentSnapshot, Firestore } from "firebase-admin/firestore";

export const shortVideoRequestCollection = "short_video_requests";

type RequestOwner = {
  streamerId?: string;
  applicationId?: string;
  email?: string;
};

// 紹介動画(Lo-Fi掲載+紹介ショート動画)の依頼は配信者1人につき1件まで。
// ドキュメントIDは streamer_id を正とするが、過去に streamer_id が未確定の状態で
// application_id / email をIDにして作られた依頼が残っている可能性がある。
// 重複判定はこの候補すべてに対して行い、同じ配信者の依頼が2件登録されるのを防ぐ。
export function shortVideoRequestIdCandidates(owner: RequestOwner) {
  const ids = [
    String(owner.streamerId || ""),
    String(owner.applicationId || ""),
    owner.email ? encodeURIComponent(String(owner.email)) : "",
  ];
  return Array.from(new Set(ids.filter(Boolean)));
}

// 候補IDのうち、実際に依頼が登録されている最初のドキュメントを返す(なければ null)。
export async function findShortVideoRequest(db: Firestore, owner: RequestOwner): Promise<DocumentSnapshot | null> {
  const candidates = shortVideoRequestIdCandidates(owner);
  if (!candidates.length) return null;
  const docs = await Promise.all(
    candidates.map((id) => db.collection(shortVideoRequestCollection).doc(id).get()),
  );
  return docs.find((doc) => doc.exists) || null;
}
