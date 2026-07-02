import type { PlanType } from "./types";

export type BillingPlanType = Exclude<PlanType, "free">;
export type OneTimeBillingType = "super_boost_1";
export type CheckoutPlanType = BillingPlanType | OneTimeBillingType;

export const PLAN_AMOUNTS: Record<CheckoutPlanType, number> = {
  paid: 500,
  boost: 980,
  super_boost_1: 220,
};

export function getStripePriceId(planType: CheckoutPlanType, currentPlan?: PlanType) {
  if (planType === "super_boost_1") return process.env.STRIPE_PRICE_SUPER_BOOST_1;
  if (planType === "boost" && currentPlan === "paid") {
    return process.env.STRIPE_PRICE_BOOST_FROM_PAID || process.env.STRIPE_PRICE_BOOST;
  }
  return planType === "paid" ? process.env.STRIPE_PRICE_PAID : process.env.STRIPE_PRICE_BOOST;
}

export function getPlanAmount(planType: CheckoutPlanType, currentPlan?: PlanType) {
  if (planType === "boost" && currentPlan === "paid") return 480;
  return PLAN_AMOUNTS[planType];
}

export function getAppUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").trim().replace(/\/$/, "");
}

export function isPaidPlan(value: string): value is BillingPlanType {
  return value === "paid" || value === "boost";
}

export function isOneTimePlan(value: string): value is OneTimeBillingType {
  return value === "super_boost_1";
}

export function isStreamerPaidPlan(value: string): value is Exclude<PlanType, "free"> {
  return value === "paid" || value === "boost";
}
