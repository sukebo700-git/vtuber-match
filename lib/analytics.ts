export type AdminAnalyticsSummary = {
  swiped_visitors: number;
  total_swipes: number;
  viewer_register_clicks: number;
  creator_register_clicks: number;
  today_swiped_visitors: number;
  today_total_swipes: number;
  today_viewer_register_clicks: number;
  today_creator_register_clicks: number;
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
};

export type AnalyticsEventType = "swiped_visitor" | "swipe_action" | "viewer_register_click" | "creator_register_click";

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
  if (eventType === "viewer_register_click") return "viewer_register_clicks";
  if (eventType === "creator_register_click") return "creator_register_clicks";
  if (eventType === "swipe_action") return "total_swipes";
  return "swiped_visitors";
}
