import { FieldValue, getAdminDb } from "./firebaseAdmin";

// VTuber→リスナーの「いいね返し」。streamer_likes は視聴者側からの likes とは
// 別コレクションにする(方向が逆のため混同すると誤集計になる)。
// 件数はviewer_profilesに保存せず、都度count()クエリで数える
// (以前streamer_like_countをストア型カウンタで持っていた際、更新漏れで実数と
// 乖離する不具合が発生したため。matchesのmatch_countと同じ方針)。
const collectionName = "streamer_likes";

export type LikeCandidate = {
  viewer_profile_id: string;
  display_name: string;
  image: string;
  liked_at: string | null;
};

/** そのVTuberにいいねしたが、まだいいね返ししていない視聴者候補を返す。 */
export async function getLikeCandidates(streamerId: string, limit = 50): Promise<LikeCandidate[]> {
  const db = getAdminDb();
  if (!db || !streamerId) return [];

  const [likesSnap, likedBackSnap] = await Promise.all([
    db.collection("likes").where("streamer_id", "==", streamerId).orderBy("timestamp", "desc").limit(200).get(),
    db.collection(collectionName).where("streamer_id", "==", streamerId).get(),
  ]);
  const likedBackIds = new Set(likedBackSnap.docs.map((doc) => String(doc.data().viewer_profile_id || "")));

  const seen = new Set<string>();
  const candidates: LikeCandidate[] = [];
  for (const doc of likesSnap.docs) {
    const data = doc.data();
    const viewerId = String(data.viewer_profile_id || "");
    if (!viewerId || seen.has(viewerId) || likedBackIds.has(viewerId)) continue;
    seen.add(viewerId);
    const profile = data.viewer_profile || {};
    if (profile.visible_to_matched_streamers === false) continue;
    candidates.push({
      viewer_profile_id: viewerId,
      display_name: String(profile.display_name || profile.youtube_display_name || "") || "匿名の視聴者",
      image: String(profile.image || ""),
      liked_at: toIso(data.timestamp),
    });
    if (candidates.length >= limit) break;
  }
  return candidates;
}

/** VTuber→視聴者への「いいね返し」を1件作成する。既にあれば何もしない(冪等)。 */
export async function likeViewerBack(streamerId: string, viewerProfileId: string): Promise<{ created: boolean }> {
  const db = getAdminDb();
  if (!db || !streamerId || !viewerProfileId) return { created: false };
  const ref = db.collection(collectionName).doc(`${streamerId}_${viewerProfileId}`);
  const doc = await ref.get();
  if (doc.exists) return { created: false };
  await ref.set({
    streamer_id: streamerId,
    viewer_profile_id: viewerProfileId,
    created_at: FieldValue.serverTimestamp(),
  });
  return { created: true };
}

export async function getStreamerLikeCount(viewerProfileId: string): Promise<number> {
  const db = getAdminDb();
  if (!db || !viewerProfileId) return 0;
  const snap = await db.collection(collectionName).where("viewer_profile_id", "==", viewerProfileId).count().get();
  return snap.data().count;
}

/** 管理画面の一覧向け。count()クエリはstreamer側ごとに1 read課金なので、
 * 表示するページぶんだけ並列実行する(全件走査はしない)。 */
export async function getStreamerLikeCounts(viewerProfileIds: string[]): Promise<Map<string, number>> {
  const db = getAdminDb();
  const result = new Map<string, number>();
  const uniqueIds = Array.from(new Set(viewerProfileIds.filter(Boolean)));
  if (!db || !uniqueIds.length) return result;

  const counts = await Promise.all(
    uniqueIds.map((id) => db.collection(collectionName).where("viewer_profile_id", "==", id).count().get()),
  );
  uniqueIds.forEach((id, index) => result.set(id, counts[index].data().count));
  return result;
}

export type ReceivedLike = {
  streamer_id: string;
  streamer_name: string;
  streamer_thumbnail: string;
  liked_at: string | null;
};

/** エリートファン向け: 誰からいいねされたかの詳細一覧。 */
export async function getReceivedLikes(viewerProfileId: string, limit = 50): Promise<ReceivedLike[]> {
  const db = getAdminDb();
  if (!db || !viewerProfileId) return [];
  const snap = await db.collection(collectionName)
    .where("viewer_profile_id", "==", viewerProfileId)
    .orderBy("created_at", "desc")
    .limit(limit)
    .get();
  if (snap.empty) return [];

  const streamerIds = Array.from(new Set(snap.docs.map((doc) => String(doc.data().streamer_id || "")))).filter(Boolean);
  const streamerRefs = streamerIds.map((id) => db.collection("streamers").doc(id));
  // fieldMaskで必要最小限だけ転送(thumbnailsはbase64画像を含み最大130KB/枚)。
  const streamerDocs = streamerRefs.length ? await db.getAll(...streamerRefs, { fieldMask: ["name", "thumbnails"] }) : [];
  const streamerMap = new Map(streamerDocs.map((doc) => [doc.id, doc.data() || {}]));

  return snap.docs.map((doc) => {
    const data = doc.data();
    const streamerId = String(data.streamer_id || "");
    const streamer = streamerMap.get(streamerId) || {};
    const thumbnails = Array.isArray(streamer.thumbnails) ? streamer.thumbnails : [];
    return {
      streamer_id: streamerId,
      streamer_name: String(streamer.name || ""),
      streamer_thumbnail: String(thumbnails[0] || ""),
      liked_at: toIso(data.created_at),
    };
  });
}

function toIso(value: unknown): string | null {
  if (value && typeof value === "object" && "toDate" in value && typeof (value as { toDate: unknown }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return null;
}
