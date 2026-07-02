import type { PlanType, Streamer } from "./types";

const planScore: Record<PlanType, number> = {
  boost: 3_000_000,
  paid: 2_000_000,
  free: 1_000_000
};

const superBoostScore = 5_000_000;

export function rankStreamers(streamers: Streamer[], seed = rankingSeed()) {
  const visible = streamers.filter((streamer) => streamer.is_visible !== false);
  return visible
    .map((streamer) => ({ streamer, score: score(streamer), tie: seededIndex(`${seed}:${streamer.id}`, 1_000_000) }))
    .sort((a, b) => {
      const scoreDiff = b.score - a.score;
      if (scoreDiff !== 0) return scoreDiff;
      return a.tie - b.tie;
    })
    .map((item) => item.streamer);
}

function score(streamer: Streamer) {
  const basePlan = isBasicPremiumTrialActive(streamer.basic_premium_trial_until) && streamer.plan_type === "paid" ? "boost" : streamer.plan_type;
  const activeSuperBoost = isActiveSuperBoost(streamer.super_boost_until);
  return (planScore[basePlan] || 0) + (activeSuperBoost ? superBoostScore : 0);
}

export function isBasicPremiumTrialActive(value?: string) {
  if (!value) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time > Date.now();
}

function jstDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function rankingSeed(date = new Date()) {
  const dateKey = jstDateKey(date);
  const hourMinute = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  const [hour, minute] = hourMinute.split(":").map(Number);
  const slot = Math.floor(((Number.isFinite(hour) ? hour : 0) * 60 + (Number.isFinite(minute) ? minute : 0)) / 30);
  return `${dateKey}:${slot}`;
}

function isActiveSuperBoost(value?: string) {
  if (!value) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time > Date.now();
}

function seededIndex(input: string, modulo: number) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % modulo;
}
