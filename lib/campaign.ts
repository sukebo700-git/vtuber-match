// Xキャンペーン(フォロー&リポストでAmazonギフトカードが当たる)の掲載終了日時。
// 8月1日まで掲載のため、8月2日0時(JST)以降は非表示にする。
export const X_CAMPAIGN_END_AT = "2026-08-02T00:00:00+09:00";

export function isXCampaignActive(now: Date = new Date()): boolean {
  return now.getTime() < new Date(X_CAMPAIGN_END_AT).getTime();
}
