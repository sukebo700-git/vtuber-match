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
  pro: 3980,
  super_boost_1: 220,
  elite_fan: 500,
};

export const PLAN_LABELS: Record<CheckoutPlanType, string> = {
  paid: "ベーシックプラン",
  boost: "プレミアムプラン",
  pro: "PROプラン",
  super_boost_1: "スーパーいいね",
  elite_fan: "エリートファン",
};

export function getStripePriceId(planType: CheckoutPlanType, currentPlan?: PlanType) {
  if (planType === "super_boost_1") return process.env.STRIPE_PRICE_SUPER_BOOST_1;
  if (planType === "elite_fan") return process.env.STRIPE_PRICE_ELITE_FAN;
  if (planType === "boost" && currentPlan === "paid") {
    return process.env.STRIPE_PRICE_BOOST_FROM_PAID || process.env.STRIPE_PRICE_BOOST;
  }
  // プレミアムからPROへ上がる時の差額プラン。未作成なら通常価格にフォールバック
  if (planType === "pro" && currentPlan === "boost") {
    return process.env.STRIPE_PRICE_PRO_FROM_BOOST || process.env.STRIPE_PRICE_PRO;
  }
  if (planType === "pro") return process.env.STRIPE_PRICE_PRO;
  return planType === "paid" ? process.env.STRIPE_PRICE_PAID : process.env.STRIPE_PRICE_BOOST;
}

export function getPlanAmount(planType: CheckoutPlanType, currentPlan?: PlanType) {
  // 差額プランを Stripe に用意している時だけ差額を返す。用意していない時は
  // 通常価格で決済されるので、記録する金額も通常価格に合わせる
  if (planType === "boost" && currentPlan === "paid" && process.env.STRIPE_PRICE_BOOST_FROM_PAID) return 480;
  if (planType === "pro" && currentPlan === "boost" && process.env.STRIPE_PRICE_PRO_FROM_BOOST) return 3000;
  return PLAN_AMOUNTS[planType];
}

export function getAppUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").trim().replace(/\/$/, "");
}

export function isPaidPlan(value: string): value is BillingPlanType {
  return value === "paid" || value === "boost" || value === "pro";
}

export function isOneTimePlan(value: string): value is OneTimeBillingType {
  return value === "super_boost_1";
}

export function isStreamerPaidPlan(value: string): value is Exclude<PlanType, "free"> {
  return isPaidPlan(value);
}

export function isViewerSubscriptionPlan(value: string): value is ViewerBillingType {
  return value === "elite_fan";
}
