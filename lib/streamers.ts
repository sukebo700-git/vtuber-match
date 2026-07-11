import { getAdminDb } from "./firebaseAdmin";
import { FieldPath } from "firebase-admin/firestore";
import { findLocalStreamer, readLocalStreamers } from "./localStore";
import { mockStreamers } from "./mockData";
import { rankStreamers } from "./ranking";
import type { AdminPlacement, Streamer } from "./types";

const isProduction = process.env.NODE_ENV === "production";
const swipeCacheTtlMs = 30 * 60 * 1000;
const publicSeoCacheTtlMs = 24 * 60 * 60 * 1000;

type SwipeStreamerCache = {
  data: Streamer[];
  expiresAt: number;
};

type PublicStreamerCache = {
  data: Streamer[];
  expiresAt: number;
};

export async function getStreamersForSwipe(): Promise<Streamer[]> {
  const cached = getSwipeStreamerCache();
  if (cached && cached.expiresAt > Date.now()) return rankSwipeStreamers(cached.data);

  const db = getAdminDb();
  if (!db) {
    if (cached?.data.length) return rankSwipeStreamers(cached.data);
    if (isProduction) return [];
    return rankSwipeStreamers(cacheSwipeStreamers((await safeReadLocalStreamers()).map(lightenStreamerForSwipe)));
  }

  try {
    const snapshot = await db.collection("streamers")
      .select(
        "name",
        "youtube_url",
        "archive_url",
        "x_account",
        "categories",
        "tags",
        "one_liner",
        "stream_time",
        "plan_type",
        "admin_placement",
        "is_dummy",
        "dummy_reason",
        "dummy",
        "test",
        "fictional",
        "isHidden",
        "is_visible",
        "is_deleted",
        "super_boost_until",
        "super_boost_effect",
        "basic_premium_trial_until",
        "elite_boost_days",
        "likes",
        "weekly_impressions",
        "latest_video_id",
        "vtype_id",
        "vtype_code",
        "vtype_name",
        "vtype_scores",
        "vtype_mode",
        "vtype_result_id",
        "vtype_updated_at",
        "updated_at",
      )
      .limit(500)
      .get();
    const streamers = snapshot.docs
      .map((doc) => normalizeStreamer(doc.id, doc.data()))
      .filter((streamer) => streamer.is_visible !== false && streamer.is_deleted !== true && streamer.is_dummy !== true);
    if (!streamers.length) {
      if (cached?.data.length) return rankSwipeStreamers(cached.data);
      return isProduction ? [] : rankSwipeStreamers(cacheSwipeStreamers(mockStreamers.map(lightenStreamerForSwipe)));
    }
    return rankSwipeStreamers(cacheSwipeStreamers(streamers.map(lightenStreamerForSwipe)));
  } catch (error) {
    console.error("Failed to read streamers for swipe:", safeErrorMessage(error));
    if (cached?.data.length) return rankSwipeStreamers(cached.data);
    return isProduction ? [] : rankStreamers(mockStreamers).map(lightenStreamerForSwipe);
  }
}

export async function getStreamerById(id: string): Promise<Streamer | null> {
  const db = getAdminDb();
  if (!db) {
    if (isProduction) return null;
    return findLocalStreamer(id).catch(() => mockStreamers.find((streamer) => streamer.id === id) || null);
  }

  try {
    const doc = await db.collection("streamers").doc(id).get();
    return doc.exists ? normalizeStreamer(doc.id, doc.data() || {}) : null;
  } catch (error) {
    console.error("Failed to read streamer detail:", safeErrorMessage(error));
    return isProduction ? null : mockStreamers.find((streamer) => streamer.id === id) || null;
  }
}

export async function getPublicStreamerBySlug(slug: string): Promise<Streamer | null> {
  const id = parsePublicStreamerId(slug);
  if (!id) return null;

  const db = getAdminDb();
  if (!db) {
    if (isProduction) return null;
    const streamer = await findLocalStreamer(id).catch(() => mockStreamers.find((item) => item.id === id) || null);
    return streamer && isPublicSeoStreamer(streamer) ? streamer : null;
  }

  try {
    const snapshot = await db.collection("streamers")
      .where(FieldPath.documentId(), "==", id)
      .select(
        "name",
        "youtube_url",
        "x_account",
        "categories",
        "tags",
        "one_liner",
        "stream_time",
        "description",
        "plan_type",
        "promo_video_id",
        "is_dummy",
        "dummy_reason",
        "dummy",
        "test",
        "fictional",
        "isHidden",
        "is_visible",
        "is_deleted",
        "updated_at",
        "created_at",
        "registered_at",
        "registeredAt",
        "createdAt",
        "vtype_id",
        "vtype_code",
        "vtype_name",
        "vtype_scores",
        "vtype_mode",
        "vtype_result_id",
        "vtype_updated_at",
      )
      .limit(1)
      .get();
    const doc = snapshot.docs[0];
    if (!doc?.exists) return null;
    const streamer = normalizeStreamer(doc.id, doc.data() || {});
    return isPublicSeoStreamer(streamer) ? streamer : null;
  } catch (error) {
    console.error("Failed to read public streamer page:", safeErrorMessage(error));
    return null;
  }
}

export async function getPublicStreamersForSeo(): Promise<Streamer[]> {
  const cached = getPublicStreamerCache();
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const db = getAdminDb();
  if (!db) {
    if (isProduction) return [];
    const streamers = await safeReadLocalStreamers();
    return cachePublicStreamers(streamers.filter(isPublicSeoStreamer).slice(0, 300));
  }

  try {
    const snapshot = await db.collection("streamers")
      .select(
        "name",
        "youtube_url",
        "x_account",
        "categories",
        "tags",
        "one_liner",
        "description",
        "plan_type",
        "is_dummy",
        "dummy_reason",
        "dummy",
        "test",
        "fictional",
        "isHidden",
        "is_visible",
        "is_deleted",
        "updated_at",
        "created_at",
        "registered_at",
        "registeredAt",
        "createdAt",
        "vtype_id",
        "vtype_code",
        "vtype_name",
        "vtype_scores",
        "vtype_mode",
        "vtype_result_id",
        "vtype_updated_at",
      )
      .limit(300)
      .get();
    return cachePublicStreamers(snapshot.docs
      .map((doc) => normalizeStreamer(doc.id, doc.data() || {}))
      .filter(isPublicSeoStreamer));
  } catch (error) {
    console.error("Failed to read public streamer sitemap data:", safeErrorMessage(error));
    const cached = getPublicStreamerCache();
    return cached?.data || [];
  }
}

export function publicStreamerPath(streamer: Pick<Streamer, "id" | "name">) {
  return `/vtuber/${publicStreamerSlug(streamer)}`;
}

export function publicStreamerSlug(streamer: Pick<Streamer, "id" | "name">) {
  const base = slugifyStreamerName(streamer.name || "vtuber");
  return `${base}--${encodeURIComponent(streamer.id)}`;
}

function parsePublicStreamerId(slug: string) {
  const value = decodeURIComponent(String(slug || "").trim());
  if (!value) return "";
  if (value.includes("--")) return value.split("--").pop() || "";
  return value;
}

function slugifyStreamerName(value: string) {
  const slug = value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "vtuber";
}

function isPublicSeoStreamer(streamer: Streamer) {
  return streamer.is_visible !== false && streamer.is_deleted !== true && streamer.is_dummy !== true && streamer.withdrawal_status !== "requested";
}

export function normalizeStreamer(id: string, data: Record<string, any>): Streamer {
  const fcmTokens = Array.isArray(data.fcm_tokens) ? data.fcm_tokens.map(String).filter(Boolean) : [];
  const dummyReason = detectDummyReason(id, data);
  return {
    id,
    name: data.name || "",
    creator_email: data.creator_email || data.email || "",
    youtube_url: data.youtube_url || "",
    youtube_channel_id: data.youtube_channel_id,
    archive_url: data.archive_url || "",
    x_account: data.x_account || data.twitter_id || "",
    thumbnails: Array.isArray(data.thumbnails) ? data.thumbnails.slice(0, 3) : [],
    categories: Array.isArray(data.categories) ? data.categories : [],
    tags: Array.isArray(data.tags) ? data.tags.slice(0, 5) : [],
    description: data.description || "",
    one_liner: String(data.one_liner || data.description || "").slice(0, 20),
    stream_time: data.stream_time,
    latest_video_id: data.latest_video_id,
    last_video_date: toIso(data.last_video_date),
    last_youtube_checked_at: toIso(data.last_youtube_checked_at),
    plan_type: data.plan_type || "free",
    admin_placement: normalizeAdminPlacement(data.admin_placement),
    is_initial_scout: Boolean(data.is_initial_scout),
    x_introduced_at: toIso(data.x_introduced_at),
    is_dummy: Boolean(data.is_dummy || dummyReason),
    dummy_reason: typeof data.dummy_reason === "string" ? data.dummy_reason : dummyReason,
    is_visible: data.is_visible !== false,
    withdrawal_status: data.withdrawal_status === "requested" ? "requested" : "none",
    withdrawal_requested_at: typeof data.withdrawal_requested_at === "string" ? data.withdrawal_requested_at : data.withdrawal_requested_at?.toDate?.().toISOString(),
    is_deleted: data.is_deleted === true,
    deleted_at: toIso(data.deleted_at),
    grant_source: data.grant_source === "stripe" ? "stripe" : data.grant_source === "admin" ? "admin" : undefined,
    has_payment_history: Boolean(data.has_payment_history),
    impressions: Number(data.impressions || 0),
    weekly_impressions: normalizeWeeklyImpressions(data.weekly_impressions),
    likes: Number(data.likes || 0),
    viewer_like_boosts: Number(data.viewer_like_boosts || 0),
    elite_boost_days: normalizeEliteBoostDays(data.elite_boost_days),
    super_boost_count: Number(data.super_boost_count || 0),
    super_boost_until: toIso(data.super_boost_until),
    super_boost_effect: normalizeSuperBoostEffect(data.super_boost_effect),
    basic_premium_trial_until: toIso(data.basic_premium_trial_until),
    basic_premium_trial_last_month: typeof data.basic_premium_trial_last_month === "string" ? data.basic_premium_trial_last_month : "",
    fcm_tokens: fcmTokens,
    notification_enabled: fcmTokens.length > 0,
    last_creator_login_at: toIso(data.last_creator_login_at),
    creator_login_count: Number(data.creator_login_count || 0),
    registered_at: toIso(data.registered_at ?? data.registeredAt ?? data.createdAt ?? data.created_at ?? data.updated_at),
    createdAt: toIso(data.createdAt),
    registeredAt: toIso(data.registeredAt),
    created_at: toIso(data.created_at ?? data.registered_at ?? data.registeredAt ?? data.createdAt ?? data.updated_at),
    updated_at: toIso(data.updated_at),
    source_application_id: data.source_application_id,
    promo_video_id: typeof data.promo_video_id === "string" ? data.promo_video_id : "",
    vtype_id: Number.isFinite(Number(data.vtype_id)) ? Number(data.vtype_id) : undefined,
    vtype_code: typeof data.vtype_code === "string" ? data.vtype_code : "",
    vtype_name: typeof data.vtype_name === "string" ? data.vtype_name : "",
    vtype_scores: normalizeVtypeScores(data.vtype_scores),
    vtype_mode: typeof data.vtype_mode === "string" ? data.vtype_mode : "",
    vtype_result_id: typeof data.vtype_result_id === "string" ? data.vtype_result_id : "",
    vtype_updated_at: toIso(data.vtype_updated_at),
  };
}

function detectDummyReason(id: string, data: Record<string, any>) {
  if (data.dummy) return "dummy";
  if (data.test) return "test";
  if (data.fictional) return "fictional";
  if (data.isHidden) return "isHidden";
  const name = String(data.name || "");
  const source = `${id} ${name}`.toLowerCase();
  if (/(^|\b)(seed|demo|test)[-_ ]?\d*\b/.test(source)) return "seed/demo";
  if (/^seed[-_ ]?\d+$/i.test(name.trim())) return "seed/demo";
  return "";
}

function normalizeSuperBoostEffect(value: unknown) {
  if (value === "shine" || value === "shake") return value;
  return undefined;
}

function normalizeWeeklyImpressions(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => /^\d{4}-\d{2}-\d{2}$/.test(key))
      .map(([key, count]) => [key, Number(count || 0)])
  );
}

function normalizeEliteBoostDays(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => /^\d{4}-\d{2}-\d{2}$/.test(key))
      .map(([key, count]): [string, number] => [key, Math.max(0, Number(count || 0))])
      .filter(([, count]) => Number.isFinite(count) && count > 0)
  );
}

function normalizeVtypeScores(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, score]) => [key, Number(score)] as const)
      .filter(([, score]) => Number.isFinite(score))
  );
}

function normalizeAdminPlacement(value: unknown): AdminPlacement {
  if (value === "top" || value === "bottom") return value;
  return "normal";
}

function lightenStreamerForSwipe(streamer: Streamer): Streamer {
  return {
    ...streamer,
    thumbnails: [streamerImagePath(streamer)],
    description: "",
  };
}

export function streamerImagePath(streamer: Pick<Streamer, "id" | "updated_at">, index = 0) {
  const version = streamer.updated_at ? `&v=${encodeURIComponent(streamer.updated_at)}` : "";
  return `/api/streamer-image/${encodeURIComponent(streamer.id)}?i=${index}${version}`;
}

function getSwipeStreamerCache(): SwipeStreamerCache | null {
  return (globalThis as typeof globalThis & { __vtuberMatchSwipeStreamersV3?: SwipeStreamerCache }).__vtuberMatchSwipeStreamersV3 || null;
}

function cacheSwipeStreamers(data: Streamer[]) {
  if (data.length) {
    (globalThis as typeof globalThis & { __vtuberMatchSwipeStreamersV3?: SwipeStreamerCache }).__vtuberMatchSwipeStreamersV3 = {
      data,
      expiresAt: Date.now() + swipeCacheTtlMs,
    };
  }
  return data;
}

function getPublicStreamerCache(): PublicStreamerCache | null {
  return (globalThis as typeof globalThis & { __vtuberMatchPublicSeoStreamersV1?: PublicStreamerCache }).__vtuberMatchPublicSeoStreamersV1 || null;
}

function cachePublicStreamers(data: Streamer[]) {
  (globalThis as typeof globalThis & { __vtuberMatchPublicSeoStreamersV1?: PublicStreamerCache }).__vtuberMatchPublicSeoStreamersV1 = {
    data,
    expiresAt: Date.now() + publicSeoCacheTtlMs,
  };
  return data;
}

export function invalidateStreamerCaches() {
  const cacheScope = globalThis as typeof globalThis & {
    __vtuberMatchSwipeStreamersV3?: SwipeStreamerCache;
    __vtuberMatchPublicSeoStreamersV1?: PublicStreamerCache;
  };
  delete cacheScope.__vtuberMatchSwipeStreamersV3;
  delete cacheScope.__vtuberMatchPublicSeoStreamersV1;
}

function rankSwipeStreamers(streamers: Streamer[]) {
  return rankStreamers(streamers, `swipe:${Date.now()}:${Math.random()}`);
}

async function safeReadLocalStreamers() {
  try {
    const streamers = await readLocalStreamers();
    return streamers.length ? streamers : mockStreamers;
  } catch (error) {
    console.error("Failed to read local streamers:", safeErrorMessage(error));
    return mockStreamers;
  }
}

function safeErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || "unknown error");
}

function toIso(value: unknown) {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  return undefined;
}
