import type { Streamer } from "./types";

const planScore = {
  boost: 3000,
  paid: 2000,
  free: 1000
};

export function rankStreamers(streamers: Streamer[]) {
  const now = Date.now();

  return [...streamers]
    .filter((streamer) => streamer.is_visible !== false)
    .sort((a, b) => scoreStreamer(b, now) - scoreStreamer(a, now));
}

function scoreStreamer(streamer: Streamer, now: number) {
  const last = streamer.last_video_date ? new Date(streamer.last_video_date).getTime() : 0;
  const days = last ? (now - last) / 86400000 : 999;
  const freshBonus = days <= 30 ? 400 : -600;
  const scoutBonus = streamer.is_initial_scout ? 80 : 0;
  const engagement = Math.min(300, (streamer.likes || 0) * 2 + (streamer.impressions || 0) * 0.05);

  return planScore[streamer.plan_type] + freshBonus + scoutBonus + engagement;
}
