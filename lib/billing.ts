import type { PlanType } from "./types";

export type BillingPlanType = Exclude<PlanType, "free">;
export type OneTimeBillingType = "super_boost_1";
// リスナー向けの月額サブスク。配信者向けプラン(basic/boost)とは体系が別なので
// PlanType(配信者プラン)には含めず、独立した型にする(仕様15: 混同禁止)。
export type ViewerBillingType = "elite_fan";
export type CheckoutPlanType = BillingPlanType | OneTimeBillingType | ViewerBillingType;

export const PLAN_AMOUNTS: Record<CheckoutPlanType, number> = {
  paid: 500,
  boost: 980,
  super_boost_1: 220,
  elite_fan: 500,
};

export const PLAN_LABELS: Record<CheckoutPlanType, string> = {
  paid: "ベーシックプラン",
  boost: "プレミアムプラン",
  super_boost_1: "スーパーいいね",
  elite_fan: "エリートファン",
};

export function getStripePriceId(planType: CheckoutPlanType, currentPlan?: PlanType) {
  if (planType === "super_boost_1") return process.env.STRIPE_PRICE_SUPER_BOOST_1;
  if (planType === "elite_fan") return process.env.STRIPE_PRICE_ELITE_FAN;
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

export function isViewerSubscriptionPlan(value: string): value is ViewerBillingType {
  return value === "elite_fan";
}
