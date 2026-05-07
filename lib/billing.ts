import type { PlanType, ViewerPlanType } from "./types";

export type BillingPlanType = Exclude<PlanType, "free"> | Exclude<ViewerPlanType, "free">;

export const PLAN_AMOUNTS: Record<BillingPlanType, number> = {
  paid: 500,
  boost: 980,
  viewer_paid: 330
};

export function getStripePriceId(planType: BillingPlanType, currentPlan?: PlanType) {
  if (planType === "viewer_paid") return process.env.STRIPE_PRICE_VIEWER_PAID;
  if (planType === "boost" && currentPlan === "paid") {
    return process.env.STRIPE_PRICE_BOOST_FROM_PAID || process.env.STRIPE_PRICE_BOOST;
  }
  return planType === "paid" ? process.env.STRIPE_PRICE_PAID : process.env.STRIPE_PRICE_BOOST;
}

export function getPlanAmount(planType: BillingPlanType, currentPlan?: PlanType) {
  if (planType === "boost" && currentPlan === "paid") return 480;
  return PLAN_AMOUNTS[planType];
}

export function getAppUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").trim().replace(/\/$/, "");
}

export function isPaidPlan(value: string): value is BillingPlanType {
  return value === "paid" || value === "boost" || value === "viewer_paid";
}

export function isStreamerPaidPlan(value: string): value is Exclude<PlanType, "free"> {
  return value === "paid" || value === "boost";
}
