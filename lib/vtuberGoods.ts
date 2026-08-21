import { getAdminDb } from "./firebaseAdmin";

// 掲載中VTuber(プレミアムプランのみ)が自分のグッズを1枠掲載できる機能。
// 任意URLを登録できるため、運営が承認するまで公開しない(status:"pending")。
// ドキュメントIDは streamer_id と同一にして1人1枠を構造的に保証する。
export const vtuberGoodsCollection = "vtuber_goods";

export type VtuberGoodsStatus = "pending" | "approved" | "rejected";

export type VtuberGoods = {
  streamer_id: string;
  streamer_name: string;
  title: string;
  /** グッズ購入先URL(BOOTH等)。中間リダイレクトを挟まず直接遷移させる */
  url: string;
  description: string;
  /** base64データURI。スワイプ配信時は /api/goods-image 経由にして payload に載せない */
  image?: string;
  status: VtuberGoodsStatus;
  admin_note?: string;
  created_at?: string;
  updated_at?: string;
  reviewed_at?: string;
};

/** スワイプカードに載せる最小限の形。画像そのものは含めずURLで参照する */
export type VtuberGoodsCard = {
  id: string;
  streamer_id: string;
  streamer_name: string;
  title: string;
  url: string;
  description: string;
  image_url: string;
  updated_at: string;
};

const cacheTtlMs = 5 * 60 * 1000;

type GoodsCache = {
  data: VtuberGoodsCard[];
  expiresAt: number;
};

export function goodsImagePath(streamerId: string, updatedAt?: string) {
  const version = updatedAt ? `?v=${encodeURIComponent(updatedAt)}` : "";
  return `/api/goods-image/${encodeURIComponent(streamerId)}${version}`;
}

/**
 * スワイプに出せる承認済みグッズを返す。
 * 掲載資格(プレミアム)は登録時と承認時に確認するが、プラン変更で資格を失った
 * 場合に出し続けないよう、ここでも streamers 側の現在のプランを突き合わせる。
 */
export async function getApprovedGoodsCards(): Promise<VtuberGoodsCard[]> {
  const cached = getCache();
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const db = getAdminDb();
  if (!db) return [];

  try {
    const snapshot = await db.collection(vtuberGoodsCollection)
      .where("status", "==", "approved")
      .limit(60)
      .get();
    if (snapshot.empty) return setCache([]);

    // 現在もプレミアムかつ掲載中かを確認する(降格・退会・非表示の取りこぼし防止)
    const streamerIds = snapshot.docs.map((doc) => doc.id);
    const streamerDocs = await db.getAll(
      ...streamerIds.map((id) => db.collection("streamers").doc(id)),
      { fieldMask: ["plan_type", "is_visible", "is_deleted", "withdrawal_status", "name"] },
    );
    const eligible = new Map<string, string>();
    streamerDocs.forEach((doc) => {
      const data = doc.data();
      if (!data) return;
      const active = data.is_deleted !== true && data.withdrawal_status !== "requested" && data.is_visible !== false;
      if (active && data.plan_type === "boost") eligible.set(doc.id, String(data.name || ""));
    });

    const cards = snapshot.docs
      .filter((doc) => eligible.has(doc.id))
      .map((doc) => {
        const data = doc.data() || {};
        const updatedAt = toIso(data.updated_at);
        return {
          id: `goods-${doc.id}`,
          streamer_id: doc.id,
          streamer_name: eligible.get(doc.id) || String(data.streamer_name || ""),
          title: String(data.title || "").slice(0, 80),
          url: String(data.url || ""),
          description: String(data.description || "").slice(0, 100),
          image_url: goodsImagePath(doc.id, updatedAt),
          updated_at: updatedAt,
        };
      })
      .filter((card) => /^https:\/\//i.test(card.url));

    return setCache(cards);
  } catch (error) {
    console.error("Failed to read approved vtuber goods:", error instanceof Error ? error.message : String(error));
    return cached?.data || [];
  }
}

function toIso(value: unknown) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && "toDate" in value && typeof (value as { toDate: unknown }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return "";
}

function getCache(): GoodsCache | null {
  return (globalThis as typeof globalThis & { __vtuberMatchGoodsV1?: GoodsCache }).__vtuberMatchGoodsV1 || null;
}

function setCache(data: VtuberGoodsCard[]) {
  (globalThis as typeof globalThis & { __vtuberMatchGoodsV1?: GoodsCache }).__vtuberMatchGoodsV1 = {
    data,
    expiresAt: Date.now() + cacheTtlMs,
  };
  return data;
}

export function invalidateGoodsCache() {
  delete (globalThis as typeof globalThis & { __vtuberMatchGoodsV1?: GoodsCache }).__vtuberMatchGoodsV1;
}
