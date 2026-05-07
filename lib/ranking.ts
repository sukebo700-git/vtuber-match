import type { PlanType, Streamer } from "./types";

const planOrder: PlanType[] = ["boost", "paid", "free"];

export function rankStreamers(streamers: Streamer[]) {
  const visible = streamers.filter((streamer) => streamer.is_visible !== false);
  return planOrder.flatMap((plan) => shuffle(visible.filter((streamer) => streamer.plan_type === plan)));
}

function shuffle<T>(items: T[]) {
  const copied = [...items];
  for (let index = copied.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [copied[index], copied[randomIndex]] = [copied[randomIndex], copied[index]];
  }
  return copied;
}
