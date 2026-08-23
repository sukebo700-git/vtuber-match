import { getStreamersForSwipe } from "./streamers";
import type { Streamer } from "./types";

// 日別の固定10人。同じ日(JST)は誰が見ても同じ10人になるよう、日付をシードに
// した擬似ランダムで選ぶ。有料プラン(paid/boost)に1枠を確約し、残りは無料
// プランのみのプールから選ぶことで、有料配信者に安定した露出機会を作りつつ、
// 無料配信者にも公平な9枠を確保する。
export async function getTodaysPicks(count = 10, paidSlots = 1): Promise<Streamer[]> {
  const streamers = await getStreamersForSwipe();
  if (!streamers.length) return [];
  const dateKey = jstDateKey();

  const isActivePaid = (streamer: Streamer) => streamer.plan_type !== "free" && streamer.subscription_status !== "canceled";
  const paidPool = streamers.filter(isActivePaid);
  const freePool = streamers.filter((streamer) => !isActivePaid(streamer));

  const pickSeeded = (pool: Streamer[], n: number, salt: string) =>
    pool
      .map((streamer) => ({ streamer, tie: seededIndex(`daily-pick:${salt}:${dateKey}:${streamer.id}`, 1_000_000) }))
      .sort((a, b) => a.tie - b.tie)
      .slice(0, Math.max(0, n))
      .map((item) => item.streamer);

  const paidPicks = pickSeeded(paidPool, paidSlots, "paid");
  const freePicks = pickSeeded(freePool, count - paidPicks.length, "free");
  const picks = [...paidPicks, ...freePicks];

  // 配信者総数が少ない初期段階等、有料/無料いずれかのプールだけではcount人に
  // 満たない場合は、まだ選ばれていない残り全体から補って人数を維持する。
  if (picks.length < count) {
    const usedIds = new Set(picks.map((streamer) => streamer.id));
    const fallbackPool = streamers.filter((streamer) => !usedIds.has(streamer.id));
    picks.push(...pickSeeded(fallbackPool, count - picks.length, "fallback"));
  }

  return picks;
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
