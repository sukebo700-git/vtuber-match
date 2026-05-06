import type { PlanType } from "./types";

export const PLAN_AMOUNTS: Record<Exclude<PlanType, "free">, number> = {
  paid: 500,
  boost: 980
};

export function getStripePriceId(planType: Exclude<PlanType, "free">) {
  return planType === "paid" ? process.env.STRIPE_PRICE_PAID : process.env.STRIPE_PRICE_BOOST;
}

export function getAppUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function isPaidPlan(value: string): value is Exclude<PlanType, "free"> {
  return value === "paid" || value === "boost";
}
