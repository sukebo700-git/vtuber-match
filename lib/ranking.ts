import type { PlanType, Streamer } from "./types";

const planScore: Record<PlanType, number> = {
  boost: 3000,
  paid: 2000,
  free: 1000
};

export function rankStreamers(streamers: Streamer[]) {
  const visible = streamers.filter((streamer) => streamer.is_visible !== false);
  return shuffle(visible).sort((a, b) => score(b) - score(a));
}

function score(streamer: Streamer) {
  const viewerBoosts = streamer.viewer_like_boosts || 0;
  const likeBoostedPlan = getLikeBoostedPlan(streamer.plan_type, viewerBoosts);
  return (planScore[likeBoostedPlan] || 0) + Math.min(viewerBoosts, 999);
}

function getLikeBoostedPlan(planType: PlanType, viewerBoosts: number): PlanType {
  if (viewerBoosts <= 0) return planType;
  if (planType === "free") return "paid";
  if (planType === "paid") return "boost";
  return "boost";
}

function shuffle<T>(items: T[]) {
  const copied = [...items];
  for (let index = copied.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [copied[index], copied[randomIndex]] = [copied[randomIndex], copied[index]];
  }
  return copied;
}
