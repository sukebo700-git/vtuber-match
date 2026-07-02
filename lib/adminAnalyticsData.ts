import { unstable_cache } from "next/cache";
import { emptyAdminAnalyticsSummary, type AdminAnalyticsSummary, type DiagnosisAnalyticsResult, type VisitAnalyticsDetail } from "./analytics";
import { getAdminDb } from "./firebaseAdmin";
import {
  readLocalAnalyticsSummary,
  readLocalAnalyticsRows,
  readLocalVisitHours,
  readLocalVisitPages,
  readLocalVisitRows,
  readLocalVisitSourceStats,
  readLocalVisitStats,
  summarizeVisitSources,
  summarizeVisits,
} from "./localStore";

const detailedAnalyticsEnabled = process.env.ENABLE_DETAILED_ANALYTICS === "1";

export async function readVisitAnalyticsDetail(): Promise<VisitAnalyticsDetail> {
  return readCachedVisitAnalyticsDetail();
}

const readCachedVisitAnalyticsDetail = unstable_cache(async (): Promise<VisitAnalyticsDetail> => {
  const db = getAdminDb();
  if (!db) {
    const [summary, visits, eventSummary, eventRows, sources, hours, pages] = await Promise.all([
      readLocalVisitStats(),
      readLocalVisitRows(),
      readLocalAnalyticsSummary(),
      readLocalAnalyticsRows(),
      readLocalVisitSourceStats(),
      readLocalVisitHours(),
      readLocalVisitPages(),
    ]);
    return {
      summary: enrichSummary(summary, {}, { creator_visits: 0, viewer_visits: 0, guest_visits: 0 }, 0, 0, eventSummary),
      eventSummary,
      sources,
      daily: buildDailyRows(visits, eventRows),
      hourly: summarizeHours(hours),
      pages: summarizePages(pages),
      diagnosis: emptyDiagnosisAnalytics(),
    };
  }

  const [visitsSnapshot, dailyAnalyticsSnapshot, diagnosisSnapshot] = await Promise.all([
    db.collection("site_visits").limit(500).get(),
    db.collection("analytics_daily").limit(500).get(),
    db.collection("diagnosis_results").limit(500).get(),
  ]);
  const [sourceDocs, hourDocs, pageDocs, pageViewDocs, roleDocs, engagementDocs] = detailedAnalyticsEnabled
    ? await Promise.all([
      db.collection("site_visit_sources").limit(500).get().then((snapshot) => snapshot.docs),
      db.collection("site_visit_hours").limit(500).get().then((snapshot) => snapshot.docs),
      db.collection("site_visit_pages").limit(1000).get().then((snapshot) => snapshot.docs),
      db.collection("site_page_views").limit(500).get().then((snapshot) => snapshot.docs),
      db.collection("site_visit_roles").limit(500).get().then((snapshot) => snapshot.docs),
      db.collection("site_engagement").limit(500).get().then((snapshot) => snapshot.docs),
    ])
    : [[], [], [], [], [], []];

  const visits: Record<string, number> = {};
  visitsSnapshot.docs.forEach((doc) => {
    const data = doc.data();
    visits[String(data.date || doc.id)] = Number(data.count || 0);
  });
  const pageViews: Record<string, number> = {};
  pageViewDocs.forEach((doc) => {
    const data = doc.data();
    pageViews[String(data.date || doc.id)] = Number(data.count || 0);
  });
  const roles = { creator_visits: 0, viewer_visits: 0, guest_visits: 0 };
  roleDocs.forEach((doc) => {
    const data = doc.data();
    roles.creator_visits += Number(data.creator_visits || 0);
    roles.viewer_visits += Number(data.viewer_visits || 0);
    roles.guest_visits += Number(data.guest_visits || 0);
  });
  let duration = 0;
  let sessions = 0;
  engagementDocs.forEach((doc) => {
    const data = doc.data();
    duration += Number(data.total_duration_seconds || 0);
    sessions += Number(data.session_count || 0);
  });

  const sourceRows: Record<string, Record<string, number>> = {};
  sourceDocs.forEach((doc) => {
    const data = doc.data();
    sourceRows[String(data.date || doc.id)] = {
      organic: Number(data.organic || 0),
      direct: Number(data.direct || 0),
      social: Number(data.social || 0),
      referral: Number(data.referral || 0),
      ads: Number(data.ads || 0),
    };
  });

  const analyticsByDate: Record<string, Partial<AdminAnalyticsSummary>> = {};
  dailyAnalyticsSnapshot.docs.forEach((doc) => {
    const data = doc.data();
    analyticsByDate[String(data.date || doc.id)] = {
      swiped_visitors: Number(data.swiped_visitors || 0),
      total_swipes: Number(data.total_swipes || 0),
      viewer_register_clicks: Number(data.viewer_register_clicks || 0),
      creator_register_clicks: Number(data.creator_register_clicks || 0),
    };
  });

  const hourRows: Record<string, Record<string, number>> = {};
  hourDocs.forEach((doc) => {
    const data = doc.data();
    const date = String(data.date || doc.id);
    hourRows[date] = {};
    Array.from({ length: 24 }, (_, hour) => {
      const key = `h${String(hour).padStart(2, "0")}`;
      hourRows[date][String(hour).padStart(2, "0")] = Number(data[key] || 0);
    });
  });

  const pageRows: Record<string, Record<string, number>> = {};
  pageDocs.forEach((doc) => {
    const data = doc.data();
    const date = String(data.date || "");
    const path = String(data.path || "/");
    if (!date) return;
    pageRows[date] = pageRows[date] || {};
    pageRows[date][path] = (pageRows[date][path] || 0) + Number(data.count || 0);
  });

  return {
    summary: enrichSummary(summarizeVisits(visits), pageViews, roles, duration, sessions, summarizeEventAnalytics(analyticsByDate)),
    eventSummary: summarizeEventAnalytics(analyticsByDate),
    sources: summarizeVisitSources(sourceRows),
    daily: buildDailyRows(visits, summarizeEventAnalyticsByDate(analyticsByDate), pageViews),
    hourly: summarizeHours(hourRows),
    pages: summarizePages(pageRows),
    diagnosis: summarizeDiagnosisResults(
      diagnosisSnapshot.docs.map((doc) => ({
        id: doc.id,
        data: doc.data(),
        createTime: doc.createTime?.toDate().toISOString() || null,
        updateTime: doc.updateTime?.toDate().toISOString() || null,
      }))
    ),
  };
}, ["admin-analytics-detail-v2"], { revalidate: 300 });

function summarizeEventAnalytics(rows: Record<string, Partial<AdminAnalyticsSummary>>): AdminAnalyticsSummary {
  const today = new Date().toISOString().slice(0, 10);
  return Object.entries(rows).reduce((summary, [date, counts]) => {
    const swiped = Number(counts.swiped_visitors || 0);
    const totalSwipes = Number(counts.total_swipes || 0);
    const viewer = Number(counts.viewer_register_clicks || 0);
    const creator = Number(counts.creator_register_clicks || 0);
    summary.swiped_visitors += swiped;
    summary.total_swipes += totalSwipes;
    summary.viewer_register_clicks += viewer;
    summary.creator_register_clicks += creator;
    if (date === today) {
      summary.today_swiped_visitors += swiped;
      summary.today_total_swipes += totalSwipes;
      summary.today_viewer_register_clicks += viewer;
      summary.today_creator_register_clicks += creator;
    }
    return summary;
  }, { ...emptyAdminAnalyticsSummary });
}

function summarizeEventAnalyticsByDate(rows: Record<string, Partial<AdminAnalyticsSummary>>) {
  return rows;
}

function buildDailyRows(visits: Record<string, number>, analytics: Record<string, Partial<AdminAnalyticsSummary>>, pageViews: Record<string, number> = {}) {
  return lastDates(14).map((date) => ({
    date,
    visits: Number(visits[date] || 0),
    page_views: Number(pageViews[date] || 0),
    swiped_visitors: Number(analytics[date]?.swiped_visitors || 0),
    total_swipes: Number(analytics[date]?.total_swipes || 0),
    viewer_register_clicks: Number(analytics[date]?.viewer_register_clicks || 0),
    creator_register_clicks: Number(analytics[date]?.creator_register_clicks || 0),
  }));
}

function enrichSummary(
  summary: { today: number; week: number; total: number },
  pageViews: Record<string, number>,
  roles: { creator_visits: number; viewer_visits: number; guest_visits: number },
  duration: number,
  sessions: number,
  events: AdminAnalyticsSummary,
) {
  const pageViewTotal = Object.values(pageViews).reduce((sum, count) => sum + Number(count || 0), 0);
  return {
    ...summary,
    page_views: pageViewTotal,
    ...roles,
    average_duration_seconds: sessions ? Math.round(duration / sessions) : 0,
    average_swipes: summary.total ? Math.round((events.total_swipes / summary.total) * 10) / 10 : 0,
  };
}

function summarizeHours(rows: Record<string, Record<string, number>>) {
  const targets = new Set(lastDates(14));
  const totals = Array.from({ length: 24 }, (_, hour) => ({ hour, visits: 0 }));
  Object.entries(rows).forEach(([date, counts]) => {
    if (!targets.has(date)) return;
    totals.forEach((row) => {
      row.visits += Number(counts[String(row.hour).padStart(2, "0")] || 0);
    });
  });
  return totals;
}

function summarizePages(rows: Record<string, Record<string, number>>) {
  const targets = new Set(lastDates(14));
  const totals = new Map<string, number>();
  Object.entries(rows).forEach(([date, counts]) => {
    if (!targets.has(date)) return;
    Object.entries(counts).forEach(([path, count]) => {
      totals.set(path, (totals.get(path) || 0) + Number(count || 0));
    });
  });
  return Array.from(totals.entries())
    .map(([path, visits]) => ({ path, visits }))
    .sort((a, b) => b.visits - a.visits)
    .slice(0, 12);
}

function lastDates(days: number) {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (days - index - 1));
    return date.toISOString().slice(0, 10);
  });
}

function emptyDiagnosisAnalytics(): VisitAnalyticsDetail["diagnosis"] {
  return {
    total: 0,
    streamer: 0,
    viewer: 0,
    advanced: 0,
    byType: [],
    recent: [],
  };
}

function summarizeDiagnosisResults(
  rows: Array<{ id: string; data: Record<string, unknown>; createTime?: string | null; updateTime?: string | null }>
): VisitAnalyticsDetail["diagnosis"] {
  const results = rows.map(({ id, data, createTime, updateTime }) => normalizeDiagnosisResult(id, data, createTime, updateTime));
  const byTypeMap = new Map<string, number>();
  results.forEach((row) => {
    byTypeMap.set(row.lightType, (byTypeMap.get(row.lightType) || 0) + 1);
  });

  const recent = results
    .sort((a, b) => timestampValue(b.createdAt) - timestampValue(a.createdAt))
    .slice(0, 80);

  return {
    total: results.length,
    streamer: results.filter((row) => row.diagnosisMode === "light").length,
    viewer: results.filter((row) => row.diagnosisMode === "viewer").length,
    advanced: results.filter((row) => row.diagnosisMode === "advanced").length,
    byType: Array.from(byTypeMap.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count),
    recent,
  };
}

function normalizeDiagnosisResult(
  id: string,
  data: Record<string, unknown>,
  createTime?: string | null,
  updateTime?: string | null
): DiagnosisAnalyticsResult {
  const createdAt =
    normalizeTimestamp(data.createdAt) ||
    normalizeTimestamp(data.created_at) ||
    normalizeTimestamp(data.updatedAt) ||
    normalizeTimestamp(data.updated_at) ||
    createTime ||
    updateTime ||
    null;

  return {
    id,
    vtuberName: String(data.vtuberName || "未入力"),
    diagnosisMode: String(data.diagnosisMode || (data.viewerCompleted ? "viewer" : data.advancedCompleted ? "advanced" : "light")),
    lightType: String(data.lightType || "不明"),
    lightTypeCode: String(data.lightTypeCode || ""),
    createdAt,
    lightScores: normalizeNumberMap(data.lightScores),
    answers: normalizeNumberMap(data.answers),
    answerDetails: Array.isArray(data.answerDetails)
      ? data.answerDetails.map((item: Record<string, unknown>, index: number) => ({
          number: Number(item.number || index + 1),
          questionId: String(item.questionId || ""),
          question: String(item.question || ""),
          axis: String(item.axis || ""),
          answer: Number(item.answer || 0),
        }))
      : [],
  };
}

function normalizeNumberMap(value: unknown) {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, count]) => [key, Number(count || 0)])
  );
}

function normalizeTimestamp(value: unknown) {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof (value as { toDate?: unknown }).toDate === "function") {
    return ((value as { toDate: () => Date }).toDate()).toISOString();
  }
  if (typeof value === "object" && "seconds" in value) {
    return new Date(Number((value as { seconds: number }).seconds) * 1000).toISOString();
  }
  return null;
}

function timestampValue(value: string | null) {
  if (!value) return 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}
