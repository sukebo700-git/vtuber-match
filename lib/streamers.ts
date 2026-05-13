import { getAdminDb } from "./firebaseAdmin";
import { findLocalStreamer, readLocalStreamers } from "./localStore";
import { mockStreamers } from "./mockData";
import { rankStreamers } from "./ranking";
import { ensureDailyGuestLikes } from "./dailyGuestLikes";
import type { Streamer } from "./types";

export async function getStreamersForSwipe(): Promise<Streamer[]> {
  const db = getAdminDb();
  if (!db) return rankStreamers(await readLocalStreamers());

  await ensureDailyGuestLikes();
  const snapshot = await db.collection("streamers").limit(80).get();
  const streamers = snapshot.docs.map((doc) => normalizeStreamer(doc.id, doc.data()));
  return rankStreamers(streamers.length ? streamers : mockStreamers);
}

export async function getStreamerById(id: string): Promise<Streamer | null> {
  const db = getAdminDb();
  if (!db) return findLocalStreamer(id);

  const doc = await db.collection("streamers").doc(id).get();
  return doc.exists ? normalizeStreamer(doc.id, doc.data() || {}) : null;
}

export function normalizeStreamer(id: string, data: Record<string, any>): Streamer {
  return {
    id,
    name: data.name || "",
    youtube_url: data.youtube_url || "",
    youtube_channel_id: data.youtube_channel_id,
    x_account: data.x_account || data.twitter_id || "",
    thumbnails: Array.isArray(data.thumbnails) ? data.thumbnails.slice(0, 3) : [],
    categories: Array.isArray(data.categories) ? data.categories : [],
    tags: Array.isArray(data.tags) ? data.tags.slice(0, 5) : [],
    description: data.description || "",
    one_liner: data.one_liner || data.description || "",
    stream_time: data.stream_time,
    latest_video_id: data.latest_video_id,
    last_video_date: toIso(data.last_video_date),
    last_youtube_checked_at: toIso(data.last_youtube_checked_at),
    plan_type: data.plan_type || "free",
    is_initial_scout: Boolean(data.is_initial_scout),
    is_visible: data.is_visible !== false,
    impressions: Number(data.impressions || 0),
    likes: Number(data.likes || 0),
    viewer_like_boosts: Number(data.viewer_like_boosts || 0),
    created_at: toIso(data.created_at),
    source_application_id: data.source_application_id
  };
}

function toIso(value: unknown) {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  return undefined;
}
