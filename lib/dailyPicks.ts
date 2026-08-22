import { getStreamersForSwipe } from "./streamers";
import type { Streamer } from "./types";

// 日別の固定10人。同じ日(JST)は誰が見ても同じ10人になるよう、日付をシードに
// した擬似ランダムで選ぶ。プランによる重み付けはしない(スワイプ側は既に
// 有料プラン優先の並びのため、こちらは無料配信者にも公平な露出機会を作る)。
export async function getTodaysPicks(count = 10): Promise<Streamer[]> {
  const streamers = await getStreamersForSwipe();
  if (!streamers.length) return [];
  const dateKey = jstDateKey();
  return streamers
    .map((streamer) => ({ streamer, tie: seededIndex(`daily-pick:${dateKey}:${streamer.id}`, 1_000_000) }))
    .sort((a, b) => a.tie - b.tie)
    .slice(0, count)
    .map((item) => item.streamer);
}

function jstDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function seededIndex(input: string, modulo: number) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % modulo;
}
