import { getAdminDb } from "./firebaseAdmin";

// スワイプ画面に差し込む広告カードの設定。
// 頻度と広告カード一覧を1ドキュメントにまとめ、スワイプページ表示時の
// 読み取りを1 readで済ませる(件数分のreadを発生させない)。
const settingsCollection = "app_settings";
const settingsDocId = "swipe_ads";
const cacheTtlMs = 5 * 60 * 1000;

/** 在庫状態。sold_out のカードはスワイプに出さない */
export type SwipeAdStockStatus = "in_stock" | "sold_out" | "unknown";

export type SwipeAdCard = {
  id: string;
  /** 表示名(管理用。カード上には出さない) */
  label: string;
  title: string;
  /** 画像URL。楽天/Yahoo!の商品画像URLをそのまま使う(自前保存しない) */
  image_url: string;
  /** アフィリエイトURL。中間リダイレクトを挟まず、この完全なURLへ直接遷移させる */
  url: string;
  provider: "rakuten" | "yahoo" | "other";
  is_active: boolean;
  /** 楽天APIで確認した在庫状態。未確認は unknown(=表示する) */
  stock_status?: SwipeAdStockStatus;
  stock_checked_at?: string;
};

export type SwipeAdSettings = {
  enabled: boolean;
  /** 未登録ユーザー: VTuberカードを何人見たら広告を1枚出すか */
  guest_interval: number;
  /** 無料登録ユーザー: 同上 */
  free_interval: number;
  cards: SwipeAdCard[];
};

export const SWIPE_AD_DEFAULTS: SwipeAdSettings = {
  enabled: false,
  guest_interval: 10,
  free_interval: 25,
  cards: [],
};

type SettingsCache = {
  data: SwipeAdSettings;
  expiresAt: number;
};

export async function getSwipeAdSettings(): Promise<SwipeAdSettings> {
  const cached = getCache();
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const db = getAdminDb();
  if (!db) return SWIPE_AD_DEFAULTS;

  try {
    const doc = await db.collection(settingsCollection).doc(settingsDocId).get();
    if (!doc.exists) return setCache(SWIPE_AD_DEFAULTS);
    return setCache(normalizeSwipeAdSettings(doc.data()));
  } catch (error) {
    console.error("Failed to read swipe ad settings:", error instanceof Error ? error.message : String(error));
    return cached?.data || SWIPE_AD_DEFAULTS;
  }
}

export function normalizeSwipeAdSettings(value: unknown): SwipeAdSettings {
  const data = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  return {
    enabled: data.enabled === true,
    guest_interval: clampInterval(data.guest_interval, SWIPE_AD_DEFAULTS.guest_interval),
    free_interval: clampInterval(data.free_interval, SWIPE_AD_DEFAULTS.free_interval),
    cards: Array.isArray(data.cards)
      ? data.cards.map(normalizeCard).filter((card): card is SwipeAdCard => card !== null).slice(0, 50)
      : [],
  };
}

/** 広告の出しすぎ・実質無効化を防ぐため 3〜200人 の範囲に収める */
function clampInterval(value: unknown, fallback: number) {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(3, Math.min(200, parsed));
}

function normalizeCard(value: unknown): SwipeAdCard | null {
  if (!value || typeof value !== "object") return null;
  const card = value as Record<string, unknown>;
  const url = String(card.url || "").trim();
  const imageUrl = String(card.image_url || "").trim();
  // 中間リダイレクトを挟まない方針のため、httpsの完全URLのみ受け付ける
  if (!/^https:\/\//i.test(url)) return null;
  return {
    id: String(card.id || "").trim() || `ad-${Math.random().toString(36).slice(2, 10)}`,
    label: String(card.label || "").trim().slice(0, 60),
    title: String(card.title || "").trim().slice(0, 80),
    image_url: /^https:\/\//i.test(imageUrl) ? imageUrl : "",
    url,
    provider: card.provider === "rakuten" || card.provider === "yahoo" ? card.provider : "other",
    is_active: card.is_active !== false,
    // 在庫状態は管理画面からの保存で消えないよう必ず引き継ぐ
    stock_status: normalizeStockStatus(card.stock_status),
    stock_checked_at: String(card.stock_checked_at || "").slice(0, 40) || undefined,
  };
}

function normalizeStockStatus(value: unknown): SwipeAdStockStatus {
  return value === "in_stock" || value === "sold_out" ? value : "unknown";
}

/**
 * スワイプに出せる広告カード。
 * 売り切れが確認できたものだけを除外する(未確認 unknown は表示する)。
 */
export function activeSwipeAdCards(settings: SwipeAdSettings) {
  return settings.cards.filter((card) => card.is_active && card.url && card.stock_status !== "sold_out");
}

function getCache(): SettingsCache | null {
  return (globalThis as typeof globalThis & { __vtuberMatchSwipeAdsV1?: SettingsCache }).__vtuberMatchSwipeAdsV1 || null;
}

function setCache(data: SwipeAdSettings) {
  (globalThis as typeof globalThis & { __vtuberMatchSwipeAdsV1?: SettingsCache }).__vtuberMatchSwipeAdsV1 = {
    data,
    expiresAt: Date.now() + cacheTtlMs,
  };
  return data;
}

export function invalidateSwipeAdSettingsCache() {
  delete (globalThis as typeof globalThis & { __vtuberMatchSwipeAdsV1?: SettingsCache }).__vtuberMatchSwipeAdsV1;
}
