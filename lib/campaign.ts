// Xキャンペーン(フォロー&リポストでAmazonギフトカードが当たる)の掲載終了日時。
// 2026-08-01: 予定(8/2 0時)より前に手動で導線を終了。既に応募済みのステータス
// 表示(admin/プロフィール画面の「応募済み」)はisXCampaignActive()を参照して
// いないため、この変更による影響を受けない。
export const X_CAMPAIGN_END_AT = "2026-08-01T00:00:00+09:00";

export function isXCampaignActive(now: Date = new Date()): boolean {
  return now.getTime() < new Date(X_CAMPAIGN_END_AT).getTime();
}
