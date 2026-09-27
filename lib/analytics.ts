export type AdminAnalyticsSummary = {
  swiped_visitors: number;
  total_swipes: number;
  viewer_register_clicks: number;
  creator_register_clicks: number;
  today_swiped_visitors: number;
  today_total_swipes: number;
  today_viewer_register_clicks: number;
  today_creator_register_clicks: number;
  // 2026-09-22: 管理画面の分析タブを「今日 / 7日間」のファネル表示にしたため、
  // 直近7日間の合計も返す(従来は累計と今日しか無く、増減が読めなかった)。
  week_swiped_visitors: number;
  week_total_swipes: number;
  week_viewer_register_clicks: number;
  week_creator_register_clicks: number;
  // 2026-09-26: 申込フォームで画像が解像度制限に弾かれた回数。
  // 登録が止まった原因の切り分けに使う。
  apply_image_rejected: number;
  today_apply_image_rejected: number;
  week_apply_image_rejected: number;
  // 2026-09-27: Google認証の通過状況。rendered と success の差が
  // 「Googleボタンまで来たのに認証できなかった人数」になる。
  google_auth_rendered: number;
  google_auth_clicked: number;
  google_auth_success: number;
  google_auth_unavailable: number;
  week_google_auth_rendered: number;
  week_google_auth_clicked: number;
  week_google_auth_success: number;
  week_google_auth_unavailable: number;
};

export const emptyAdminAnalyticsSummary: AdminAnalyticsSummary = {
  swiped_visitors: 0,
  total_swipes: 0,
  viewer_register_clicks: 0,
  creator_register_clicks: 0,
  today_swiped_visitors: 0,
  today_total_swipes: 0,
  today_viewer_register_clicks: 0,
  today_creator_register_clicks: 0,
  week_swiped_visitors: 0,
  week_total_swipes: 0,
  week_viewer_register_clicks: 0,
  week_creator_register_clicks: 0,
  apply_image_rejected: 0,
  today_apply_image_rejected: 0,
  week_apply_image_rejected: 0,
  google_auth_rendered: 0,
  google_auth_clicked: 0,
  google_auth_success: 0,
  google_auth_unavailable: 0,
  week_google_auth_rendered: 0,
  week_google_auth_clicked: 0,
  week_google_auth_success: 0,
  week_google_auth_unavailable: 0,
};

export type AnalyticsEventType =
  | "swiped_visitor"
  | "swipe_action"
  | "viewer_register_click"
  | "creator_register_click"
  // 2026-09-26: 申込フォームの画像が解像度制限で弾かれた回数。
  // 9/16以降の新規登録が11日間ゼロになった原因を切り分けるために追加した。
  // 弾かれた実数が分からないと、制限が原因かどうかを推測でしか言えないため。
  | "apply_image_rejected"
  | GoogleAuthAnalyticsEvent;

// 2026-09-27: Google認証の計測。ボタンが描画された(rendered)、押された(clicked、
// iframeへのフォーカス移動による近似)、IDトークンを受け取れた(success)、
// スクリプトが読めずフォールバックした(unavailable)を別々に数える。
export type GoogleAuthAnalyticsEvent =
  | "google_auth_rendered"
  | "google_auth_clicked"
  | "google_auth_success"
  | "google_auth_unavailable";

export type VisitAnalyticsDetail = {
  summary: {
    today: number;
    week: number;
    total: number;
    page_views: number;
    creator_visits: number;
    viewer_visits: number;
    guest_visits: number;
    average_duration_seconds: number;
    average_swipes: number;
  };
  eventSummary: AdminAnalyticsSummary;
  sources: {
    organic: number;
    direct: number;
    social: number;
    referral: number;
    ads: number;
  };
  daily: Array<{
    date: string;
    visits: number;
    page_views: number;
    swiped_visitors: number;
    total_swipes: number;
    viewer_register_clicks: number;
    creator_register_clicks: number;
  }>;
  hourly: Array<{
    hour: number;
    visits: number;
  }>;
  pages: Array<{
    path: string;
    visits: number;
  }>;
  diagnosis: {
    total: number;
    streamer: number;
    viewer: number;
    advanced: number;
    byType: Array<{
      type: string;
      count: number;
    }>;
    recent: DiagnosisAnalyticsResult[];
  };
};

export type DiagnosisAnalyticsResult = {
  id: string;
  vtuberName: string;
  diagnosisMode: "light" | "advanced" | "viewer" | string;
  lightType: string;
  lightTypeCode?: string;
  createdAt: string | null;
  lightScores: Record<string, number>;
  answers: Record<string, number>;
  answerDetails: Array<{
    number: number;
    questionId: string;
    question: string;
    axis: string;
    answer: number;
  }>;
};

export function analyticsFieldForEvent(eventType: AnalyticsEventType) {
  if (eventType.startsWith("google_auth_")) return eventType;
  if (eventType === "apply_image_rejected") return "apply_image_rejected";
  if (eventType === "viewer_register_click") return "viewer_register_clicks";
  if (eventType === "creator_register_click") return "creator_register_clicks";
  if (eventType === "swipe_action") return "total_swipes";
  return "swiped_visitors";
}
