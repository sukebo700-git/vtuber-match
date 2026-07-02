import { promises as fs } from "fs";
import path from "path";
import { mockStreamers } from "./mockData";
import { rankStreamers } from "./ranking";
import { emptyAdminAnalyticsSummary, analyticsFieldForEvent, type AdminAnalyticsSummary, type AnalyticsEventType } from "./analytics";
import type { AdminPlacement, PaymentRecord, PlanType, Streamer, StreamerApplication, StreamerProfileEdit, ViewerActivity, ViewerActivityType, ViewerProfile, ViewerProfileWithStats, StreamerReport, PasswordResetRequest } from "./types";

const dataDir = path.join(process.cwd(), "data");
const streamersPath = path.join(dataDir, "local-streamers.json");
const likesPath = path.join(dataDir, "local-likes.json");
const applicationsPath = path.join(dataDir, "local-applications.json");
const paymentsPath = path.join(dataDir, "local-payments.json");
const viewerProfilesPath = path.join(dataDir, "local-viewer-profiles.json");
const profileEditsPath = path.join(dataDir, "local-profile-edits.json");
const reportsPath = path.join(dataDir, "local-reports.json");
const viewerActivitiesPath = path.join(dataDir, "local-viewer-activities.json");
const passwordResetRequestsPath = path.join(dataDir, "local-password-reset-requests.json");
const visitsPath = path.join(dataDir, "local-visits.json");
const visitSourcesPath = path.join(dataDir, "local-visit-sources.json");
const analyticsPath = path.join(dataDir, "local-analytics.json");
const visitHoursPath = path.join(dataDir, "local-visit-hours.json");
const visitPagesPath = path.join(dataDir, "local-visit-pages.json");

export async function readLocalStreamers() {
  return rankStreamers(await readAllLocalStreamers());
}

export async function addLocalVisit(date: string, source = "direct", input: { hour?: number; path?: string } = {}) {
  await ensureFiles();
  const raw = await fs.readFile(visitsPath, "utf8");
  const visits = JSON.parse(raw) as Record<string, number>;
  visits[date] = (visits[date] || 0) + 1;
  await fs.writeFile(visitsPath, JSON.stringify(visits, null, 2));

  const sourcesRaw = await fs.readFile(visitSourcesPath, "utf8");
  const sources = JSON.parse(sourcesRaw) as Record<string, Record<string, number>>;
  sources[date] = sources[date] || {};
  sources[date].total = (sources[date].total || 0) + 1;
  sources[date][source] = (sources[date][source] || 0) + 1;
  await fs.writeFile(visitSourcesPath, JSON.stringify(sources, null, 2));

  const hour = Number.isFinite(input.hour) ? Number(input.hour) : new Date().getHours();
  const hoursRaw = await fs.readFile(visitHoursPath, "utf8");
  const hours = JSON.parse(hoursRaw) as Record<string, Record<string, number>>;
  hours[date] = hours[date] || {};
  hours[date][String(hour).padStart(2, "0")] = (hours[date][String(hour).padStart(2, "0")] || 0) + 1;
  await fs.writeFile(visitHoursPath, JSON.stringify(hours, null, 2));

  const pagePath = normalizeLocalPagePath(input.path);
  const pagesRaw = await fs.readFile(visitPagesPath, "utf8");
  const pages = JSON.parse(pagesRaw) as Record<string, Record<string, number>>;
  pages[date] = pages[date] || {};
  pages[date][pagePath] = (pages[date][pagePath] || 0) + 1;
  await fs.writeFile(visitPagesPath, JSON.stringify(pages, null, 2));
}

export async function readLocalVisitStats() {
  await ensureFiles();
  const raw = await fs.readFile(visitsPath, "utf8");
  const visits = JSON.parse(raw) as Record<string, number>;
  return summarizeVisits(visits);
}

export async function readLocalVisitRows() {
  await ensureFiles();
  const raw = await fs.readFile(visitsPath, "utf8");
  return JSON.parse(raw || "{}") as Record<string, number>;
}

export async function readLocalVisitSourceStats() {
  await ensureFiles();
  const raw = await fs.readFile(visitSourcesPath, "utf8");
  const sources = JSON.parse(raw) as Record<string, Record<string, number>>;
  return summarizeVisitSources(sources);
}

export function summarizeVisits(visits: Record<string, number>) {
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = visits[today] || 0;
  const sevenDays = new Set(
    Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - index);
      return date.toISOString().slice(0, 10);
    }),
  );
  const weekCount = Object.entries(visits).reduce((sum, [date, count]) => sum + (sevenDays.has(date) ? count : 0), 0);
  const totalCount = Object.values(visits).reduce((sum, count) => sum + count, 0);
  return { today: todayCount, week: weekCount, total: totalCount };
}

export function summarizeVisitSources(sources: Record<string, Record<string, number>>) {
  const sevenDays = new Set(
    Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - index);
      return date.toISOString().slice(0, 10);
    }),
  );
  return Object.entries(sources).reduce(
    (summary, [date, counts]) => {
      if (!sevenDays.has(date)) return summary;
      summary.organic += counts.organic || 0;
      summary.direct += counts.direct || 0;
      summary.social += counts.social || 0;
      summary.referral += counts.referral || 0;
      summary.ads += counts.ads || 0;
      return summary;
    },
    { organic: 0, direct: 0, social: 0, referral: 0, ads: 0 },
  );
}

export async function findLocalStreamer(id: string) {
  const streamers = await readAllLocalStreamers();
  return streamers.find((streamer) => streamer.id === id) || null;
}

export async function addLocalStreamer(input: Omit<Streamer, "id" | "impressions" | "likes" | "created_at">) {
  const streamers = await readAllLocalStreamers();
  const streamer: Streamer = {
    ...input,
    id: `local-${Date.now()}`,
    impressions: 0,
    likes: 0,
    created_at: new Date().toISOString()
  };

  await fs.writeFile(streamersPath, JSON.stringify([streamer, ...streamers], null, 2));
  return streamer;
}

export async function updateLocalStreamer(id: string, patch: Partial<Streamer>) {
  const streamers = await readAllLocalStreamers();
  const updated = streamers.map((streamer) => (
    streamer.id === id ? { ...streamer, ...patch } : streamer
  ));
  await fs.writeFile(streamersPath, JSON.stringify(updated, null, 2));
  return updated.find((streamer) => streamer.id === id) || null;
}

export async function deleteLocalStreamer(id: string) {
  const streamers = await readAllLocalStreamers();
  const target = streamers.find((streamer) => streamer.id === id);
  if (!target || target.is_visible) return null;
  const updated = streamers.map((streamer) => (
    streamer.id === id ? { ...streamer, is_deleted: true, deleted_at: new Date().toISOString(), is_visible: false } : streamer
  ));
  await fs.writeFile(streamersPath, JSON.stringify(updated, null, 2));
  return target;
}

export async function readLocalApplications() {
  await ensureFiles();
  const raw = await fs.readFile(applicationsPath, "utf8");
  return JSON.parse(raw) as StreamerApplication[];
}

export async function findLocalApplication(id: string) {
  const applications = await readLocalApplications();
  return applications.find((application) => application.id === id) || null;
}

export async function findLocalApplicationByEmail(email: string) {
  const applications = await readLocalApplications();
  const normalized = email.toLowerCase();
  return applications.find((application) => application.email.toLowerCase() === normalized) || null;
}

export async function recordLocalAnalyticsEvent(eventType: AnalyticsEventType, visitorId: string) {
  await ensureFiles();
  const date = new Date().toISOString().slice(0, 10);
  const raw = await fs.readFile(analyticsPath, "utf8");
  const analytics = JSON.parse(raw || "{}") as Record<string, Record<string, number | string[]>>;
  analytics[date] = analytics[date] || {};

  if (eventType === "swipe_action") {
    const field = analyticsFieldForEvent(eventType);
    analytics[date][field] = Number(analytics[date][field] || 0) + 1;
    await fs.writeFile(analyticsPath, JSON.stringify(analytics, null, 2));
    return;
  }

  const uniqueKey = `${eventType}_unique`;
  const unique = Array.isArray(analytics[date][uniqueKey]) ? analytics[date][uniqueKey] as string[] : [];
  if (unique.includes(visitorId)) return;
  unique.push(visitorId);
  analytics[date][uniqueKey] = unique;

  const field = analyticsFieldForEvent(eventType);
  analytics[date][field] = Number(analytics[date][field] || 0) + 1;
  await fs.writeFile(analyticsPath, JSON.stringify(analytics, null, 2));
}

export async function readLocalAnalyticsSummary(): Promise<AdminAnalyticsSummary> {
  await ensureFiles();
  const today = new Date().toISOString().slice(0, 10);
  const raw = await fs.readFile(analyticsPath, "utf8");
  const analytics = JSON.parse(raw || "{}") as Record<string, Partial<AdminAnalyticsSummary>>;
  return Object.entries(analytics).reduce((summary, [date, counts]) => {
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

export async function readLocalAnalyticsRows() {
  await ensureFiles();
  const raw = await fs.readFile(analyticsPath, "utf8");
  return JSON.parse(raw || "{}") as Record<string, Partial<AdminAnalyticsSummary>>;
}

export async function readLocalVisitHours() {
  await ensureFiles();
  const raw = await fs.readFile(visitHoursPath, "utf8");
  return JSON.parse(raw || "{}") as Record<string, Record<string, number>>;
}

export async function readLocalVisitPages() {
  await ensureFiles();
  const raw = await fs.readFile(visitPagesPath, "utf8");
  return JSON.parse(raw || "{}") as Record<string, Record<string, number>>;
}

export async function recordLocalCreatorLogin(input: { streamer_id?: string; application_id?: string; email?: string; name?: string }) {
  const now = new Date().toISOString();
  if (input.streamer_id) {
    const streamers = await readAllLocalStreamers();
    const updated = streamers.map((streamer) => (
      streamer.id === input.streamer_id
        ? { ...streamer, last_creator_login_at: now, creator_login_count: Number(streamer.creator_login_count || 0) + 1 }
        : streamer
    ));
    await fs.writeFile(streamersPath, JSON.stringify(updated, null, 2));
  }
  if (input.application_id) {
    const applications = await readLocalApplications();
    const updated = applications.map((application) => (
      application.id === input.application_id
        ? { ...application, last_creator_login_at: now, creator_login_count: Number((application as any).creator_login_count || 0) + 1 }
        : application
    ));
    await fs.writeFile(applicationsPath, JSON.stringify(updated, null, 2));
  }
}

export async function updateLocalApplication(id: string, patch: Partial<StreamerApplication>) {
  const applications = await readLocalApplications();
  const updated = applications.map((application) => (
    application.id === id ? { ...application, ...patch } : application
  ));
  await fs.writeFile(applicationsPath, JSON.stringify(updated, null, 2));
  return updated.find((application) => application.id === id) || null;
}

export async function addLocalApplication(input: Omit<StreamerApplication, "id" | "status" | "created_at">) {
  const applications = await readLocalApplications();
  const application: StreamerApplication = {
    ...input,
    id: `app-${Date.now()}`,
    payment_status: input.desired_plan === "free" ? "not_required" : "pending",
    status: "pending",
    created_at: new Date().toISOString()
  };

  await fs.writeFile(applicationsPath, JSON.stringify([application, ...applications], null, 2));
  return application;
}

export async function autoApproveLocalApplication(applicationId: string) {
  const applications = await readLocalApplications();
  const application = applications.find((item) => item.id === applicationId);
  if (!application) return null;
  if (application.streamer_id) return findLocalStreamer(application.streamer_id);
  if (application.desired_plan !== "free" && application.payment_status !== "paid") return null;

  const existingStreamer = (await readAllLocalStreamers()).find((streamer) => (
    streamer.is_deleted !== true &&
    streamer.withdrawal_status !== "requested" &&
    (
      streamer.source_application_id === application.id ||
      (streamer.creator_email && streamer.creator_email.toLowerCase() === application.email.toLowerCase())
    )
  ));
  if (existingStreamer) {
    const updated = applications.map((item) => (
      item.id === applicationId
        ? { ...item, status: "approved" as const, reviewed_at: item.reviewed_at || new Date().toISOString(), streamer_id: existingStreamer.id }
        : item
    ));
    await fs.writeFile(applicationsPath, JSON.stringify(updated, null, 2));
    return existingStreamer;
  }

  const streamer = await addLocalStreamer({
    name: application.name,
    creator_email: application.email.toLowerCase(),
    youtube_url: application.youtube_url,
    youtube_channel_id: application.youtube_channel_id,
    x_account: application.x_account,
    thumbnails: application.thumbnails,
    categories: application.categories,
    tags: application.tags,
    description: application.description,
    one_liner: String(application.one_liner || "").slice(0, 20),
    stream_time: application.stream_time,
    plan_type: application.desired_plan,
    is_initial_scout: false,
    is_visible: true,
    source_application_id: application.id
  });

  const updated = applications.map((item) => (
    item.id === applicationId
      ? { ...item, status: "approved" as const, reviewed_at: new Date().toISOString(), streamer_id: streamer.id }
      : item
  ));
  await fs.writeFile(applicationsPath, JSON.stringify(updated, null, 2));
  return streamer;
}

export async function markLocalApplicationPaid(applicationId: string) {
  const applications = await readLocalApplications();
  const updated = applications.map((application) => (
    application.id === applicationId ? { ...application, payment_status: "paid" as const, paid_at: new Date().toISOString() } : application
  ));
  await fs.writeFile(applicationsPath, JSON.stringify(updated, null, 2));
  return updated.find((application) => application.id === applicationId) || null;
}

export async function addLocalPayment(input: Omit<PaymentRecord, "id" | "status" | "created_at">) {
  await ensureFiles();
  const raw = await fs.readFile(paymentsPath, "utf8");
  const payments = JSON.parse(raw) as PaymentRecord[];
  const payment: PaymentRecord = {
    ...input,
    id: `pay-${Date.now()}`,
    status: "paid",
    created_at: new Date().toISOString()
  };
  await fs.writeFile(paymentsPath, JSON.stringify([payment, ...payments], null, 2));
  if (input.application_id) await markLocalApplicationPaid(input.application_id);
  if (input.streamer_id && (input.plan_type === "paid" || input.plan_type === "boost")) {
    await updateLocalStreamer(input.streamer_id, { plan_type: input.plan_type });
  }
  return payment;
}

export async function hasLocalPaymentHistory(field: "streamer_id" | "viewer_id", id: string) {
  await ensureFiles();
  const raw = await fs.readFile(paymentsPath, "utf8");
  const payments = JSON.parse(raw) as PaymentRecord[];
  return payments.some((payment) => String(payment[field] || "") === id);
}

export async function approveLocalApplication(applicationId: string) {
  const applications = await readLocalApplications();
  const application = applications.find((item) => item.id === applicationId);
  if (!application) return null;
  if (application.streamer_id) return findLocalStreamer(application.streamer_id);
  if (application.desired_plan !== "free" && application.payment_status !== "paid") return null;

  const existingStreamer = (await readAllLocalStreamers()).find((streamer) => (
    streamer.source_application_id === application.id ||
    (streamer.creator_email && streamer.creator_email.toLowerCase() === application.email.toLowerCase())
  ));
  if (existingStreamer) {
    const updated = applications.map((item) => (
      item.id === applicationId
        ? { ...item, status: "approved" as const, reviewed_at: item.reviewed_at || new Date().toISOString(), streamer_id: existingStreamer.id }
        : item
    ));
    await fs.writeFile(applicationsPath, JSON.stringify(updated, null, 2));
    return existingStreamer;
  }

  const streamer = await addLocalStreamer({
    name: application.name,
    creator_email: application.email.toLowerCase(),
    youtube_url: application.youtube_url,
    youtube_channel_id: application.youtube_channel_id,
    x_account: application.x_account,
    thumbnails: application.thumbnails,
    categories: application.categories,
    tags: application.tags,
    description: application.description,
    one_liner: String(application.one_liner || "").slice(0, 20),
    stream_time: application.stream_time,
    plan_type: application.desired_plan,
    is_initial_scout: false,
    is_visible: true,
    source_application_id: application.id
  });

  const updated = applications.map((item) => (
    item.id === applicationId
      ? { ...item, status: "approved" as const, reviewed_at: new Date().toISOString(), streamer_id: streamer.id }
      : item
  ));
  await fs.writeFile(applicationsPath, JSON.stringify(updated, null, 2));

  return streamer;
}

export async function incrementLocalStreamer(id: string, field: "impressions" | "likes") {
  const streamers = await readAllLocalStreamers();
  const updated = streamers.map((streamer) => (
    streamer.id === id ? { ...streamer, [field]: (Number(streamer[field] || 0)) + 1 } : streamer
  ));
  await fs.writeFile(streamersPath, JSON.stringify(updated, null, 2));
}

export async function readAllLocalStreamers() {
  let raw: string;
  try {
    await fs.access(streamersPath);
  } catch {
    await writeLocalFileIfPossible(streamersPath, JSON.stringify(mockStreamers, null, 2));
    return mockStreamers;
  }

  try {
    raw = await fs.readFile(streamersPath, "utf8");
  } catch {
    return mockStreamers;
  }

  let parsed: Streamer[];
  try {
    parsed = JSON.parse(raw) as Streamer[];
  } catch {
    return mockStreamers;
  }

  if (!parsed.length) {
    await writeLocalFileIfPossible(streamersPath, JSON.stringify(mockStreamers, null, 2));
    return mockStreamers;
  }
  const migrated = parsed.map((streamer) => ({
    ...streamer,
    plan_type: normalizePlan(streamer.plan_type),
    admin_placement: normalizeAdminPlacement(streamer.admin_placement),
    is_visible: streamer.is_visible !== false,
    withdrawal_status: streamer.withdrawal_status === "requested" ? "requested" as const : "none" as const
  }));
  if (JSON.stringify(parsed) !== JSON.stringify(migrated)) {
    await writeLocalFileIfPossible(streamersPath, JSON.stringify(migrated, null, 2));
  }
  return migrated.filter((streamer) => streamer.is_deleted !== true);
}

function normalizePlan(plan: string): PlanType {
  if (plan === "boost" || plan === "boost_monthly" || plan === "boost_yearly") return "boost";
  if (plan === "paid" || plan === "standard_monthly" || plan === "standard_yearly") return "paid";
  return "free";
}

function normalizeAdminPlacement(value: unknown): AdminPlacement {
  if (value === "top" || value === "bottom") return value;
  return "normal";
}

export async function addLocalLike(userId: string, streamerId: string, viewerProfile?: Record<string, unknown>) {
  await ensureFiles();
  const raw = await fs.readFile(likesPath, "utf8");
  const likes = JSON.parse(raw) as Array<Record<string, unknown>>;
  const viewerProfileId = String(viewerProfile?.id || userId || "");
  likes.push({
    user_id: userId,
    streamer_id: streamerId,
    viewer_profile_id: viewerProfileId || null,
    viewer_profile: viewerProfile || null,
    timestamp: new Date().toISOString()
  });
  await fs.writeFile(likesPath, JSON.stringify(likes, null, 2));
}

export async function addLocalViewerActivity(input: {
  streamer_id: string;
  viewer_profile_id: string;
  user_id?: string;
  action: ViewerActivityType;
  viewer_profile?: Record<string, unknown> | null;
}) {
  await ensureFiles();
  const raw = await fs.readFile(viewerActivitiesPath, "utf8");
  const activities = JSON.parse(raw) as ViewerActivity[];
  const id = `${input.streamer_id}_${input.viewer_profile_id}_${input.action}`;
  const now = new Date().toISOString();
  const existing = activities.find((activity) => activity.id === id);
  const activity: ViewerActivity = {
    ...(existing || {}),
    id,
    streamer_id: input.streamer_id,
    viewer_profile_id: input.viewer_profile_id,
    user_id: input.user_id,
    action: input.action,
    viewer_profile: input.viewer_profile || existing?.viewer_profile || undefined,
    created_at: existing?.created_at || now,
    updated_at: now,
  };
  await fs.writeFile(viewerActivitiesPath, JSON.stringify([activity, ...activities.filter((item) => item.id !== id)], null, 2));
  return activity;
}

export async function upsertLocalViewerProfile(input: ViewerProfile) {
  await ensureFiles();
  const raw = await fs.readFile(viewerProfilesPath, "utf8");
  const profiles = JSON.parse(raw) as ViewerProfile[];
  const existing = profiles.find((item) => item.id === input.id);
  const now = new Date().toISOString();
  const profile = { ...existing, ...input, created_at: existing?.created_at || input.created_at || now, updated_at: now };
  const next = [profile, ...profiles.filter((item) => item.id !== input.id)];
  await fs.writeFile(viewerProfilesPath, JSON.stringify(next, null, 2));
  return profile;
}

export async function readLocalViewerProfilesRaw(): Promise<ViewerProfile[]> {
  await ensureFiles();
  const raw = await fs.readFile(viewerProfilesPath, "utf8");
  return JSON.parse(raw) as ViewerProfile[];
}

export async function deleteLocalViewerProfile(id: string) {
  const profiles = await readLocalViewerProfilesRaw();
  const target = profiles.find((profile) => profile.id === id);
  if (!target) return null;
  await fs.writeFile(viewerProfilesPath, JSON.stringify(profiles.map((profile) => (
    profile.id === id ? { ...profile, is_deleted: true, deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() } : profile
  )), null, 2));
  return target;
}

export async function readLocalViewerProfilesWithStats(): Promise<ViewerProfileWithStats[]> {
  await ensureFiles();
  const rawProfiles = await fs.readFile(viewerProfilesPath, "utf8");
  const rawLikes = await fs.readFile(likesPath, "utf8");
  const rawPayments = await fs.readFile(paymentsPath, "utf8");
  const rawActivities = await fs.readFile(viewerActivitiesPath, "utf8");
  const profiles = JSON.parse(rawProfiles) as ViewerProfile[];
  const likes = JSON.parse(rawLikes) as Array<Record<string, unknown>>;
  const payments = JSON.parse(rawPayments) as Array<Record<string, unknown>>;
  const activities = JSON.parse(rawActivities) as ViewerActivity[];
  const counts = new Map<string, number>();
  const lastActivity = new Map<string, string>();
  const paidViewerIds = new Set<string>();

  for (const like of likes) {
    const profile = like.viewer_profile as Record<string, unknown> | undefined;
    const id = String(like.viewer_profile_id || profile?.id || "");
    if (!id) continue;
    counts.set(id, (counts.get(id) || 0) + 1);
  }
  for (const payment of payments) {
    const id = String(payment.viewer_id || "");
    if (id) paidViewerIds.add(id);
  }
  for (const activity of activities) {
    const id = String(activity.viewer_profile_id || "");
    if (!id) continue;
    const timestamp = activity.updated_at || activity.created_at || "";
    const current = lastActivity.get(id);
    if (timestamp && (!current || Date.parse(timestamp) > Date.parse(current))) lastActivity.set(id, timestamp);
  }

  return profiles.filter((profile) => profile.is_deleted !== true).map((profile) => {
    const matchCount = counts.get(profile.id) || profile.match_count || 0;
    const fcmTokens = Array.isArray(profile.fcm_tokens) ? profile.fcm_tokens.map(String).filter(Boolean) : [];
    return {
      ...profile,
      match_count: matchCount,
      streamer_like_count: 0,
      super_like_stock: Number(profile.super_like_stock || 0),
      super_like_purchase_count: Number(profile.super_like_purchase_count || 0),
      has_paid_history: paidViewerIds.has(profile.id) || Number(profile.super_like_purchase_count || 0) > 0,
      fcm_tokens: fcmTokens,
      notification_enabled: fcmTokens.length > 0,
      last_viewer_activity_at: lastActivity.get(profile.id) || profile.last_viewer_login_at,
      fan_level: fanLevel(matchCount)
    };
  });
}

export async function readLocalViewerProfilesForStreamer(streamerId: string) {
  await ensureFiles();
  const rawLikes = await fs.readFile(likesPath, "utf8");
  const rawProfiles = await fs.readFile(viewerProfilesPath, "utf8");
  const rawActivities = await fs.readFile(viewerActivitiesPath, "utf8");
  const likes = JSON.parse(rawLikes) as Array<Record<string, unknown>>;
  const profiles = JSON.parse(rawProfiles) as ViewerProfile[];
  const activities = JSON.parse(rawActivities) as ViewerActivity[];
  const byId = new Map(profiles.map((profile) => [profile.id, profile]));
  const viewers = new Map<string, Record<string, unknown>>();

  function addViewer(id: string, embedded: Record<string, unknown> | undefined, source: "like" | "view", timestamp?: string) {
    if (!id) return;
    const profile = byId.get(id) || embedded || {};
    if (profile.visible_to_matched_streamers === false) return;
    const isAnonymous = Boolean((profile as Record<string, unknown>).is_anonymous) || id.startsWith("anon-viewer-");
    const current = viewers.get(id) || {};
    viewers.set(id, {
      ...current,
      ...profile,
      id,
      is_anonymous: isAnonymous,
      display_name: isAnonymous ? "" : (profile.display_name || current.display_name || ""),
      match_source: current.match_source === "like" ? "like" : source,
      last_matched_at: timestamp || current.last_matched_at || "",
      liked_by_streamer: false,
    });
  }

  likes
    .filter((like) => like.streamer_id === streamerId)
    .forEach((like) => addViewer(
      String(like.viewer_profile_id || (like.viewer_profile as Record<string, unknown> | undefined)?.id || ""),
      like.viewer_profile as Record<string, unknown> | undefined,
      "like",
      String(like.timestamp || ""),
    ));

  activities
    .filter((activity) => activity.streamer_id === streamerId)
    .forEach((activity) => addViewer(
      activity.viewer_profile_id,
      activity.viewer_profile as Record<string, unknown> | undefined,
      activity.action === "like" ? "like" : "view",
      activity.updated_at || activity.created_at,
    ));

  return Array.from(viewers.values());
}

export async function mergeLocalViewerIdentity(fromId: string, toId: string) {
  if (!fromId || !toId || fromId === toId) return;
  await ensureFiles();
  const [likesRaw, activitiesRaw] = await Promise.all([
    fs.readFile(likesPath, "utf8"),
    fs.readFile(viewerActivitiesPath, "utf8"),
  ]);
  const likes = JSON.parse(likesRaw) as Array<Record<string, unknown>>;
  const activities = JSON.parse(activitiesRaw) as ViewerActivity[];
  await Promise.all([
    fs.writeFile(likesPath, JSON.stringify(likes.map((like) => (
      String(like.viewer_profile_id || "") === fromId ? { ...like, viewer_profile_id: toId } : like
    )), null, 2)),
    fs.writeFile(viewerActivitiesPath, JSON.stringify(activities.map((activity) => (
      activity.viewer_profile_id === fromId ? { ...activity, viewer_profile_id: toId, id: `${activity.streamer_id}_${toId}_${activity.action}` } : activity
    )), null, 2)),
  ]);
}

function fanLevel(matchCount: number): ViewerProfileWithStats["fan_level"] {
  if (matchCount >= 20) return "super";
  if (matchCount >= 5) return "active";
  return "starter";
}

export async function addLocalProfileEdit(input: Omit<StreamerProfileEdit, "id" | "status" | "created_at">) {
  await ensureFiles();
  const raw = await fs.readFile(profileEditsPath, "utf8");
  const edits = JSON.parse(raw) as StreamerProfileEdit[];
  const edit: StreamerProfileEdit = {
    ...input,
    id: `edit-${Date.now()}`,
    status: "pending",
    created_at: new Date().toISOString()
  };
  await fs.writeFile(profileEditsPath, JSON.stringify([edit, ...edits], null, 2));
  return edit;
}

export async function addLocalReport(input: Omit<StreamerReport, "id" | "status" | "created_at">) {
  await ensureFiles();
  const raw = await fs.readFile(reportsPath, "utf8");
  const reports = JSON.parse(raw) as StreamerReport[];
  const report: StreamerReport = {
    ...input,
    id: `report-${Date.now()}`,
    status: "open",
    created_at: new Date().toISOString()
  };
  await fs.writeFile(reportsPath, JSON.stringify([report, ...reports], null, 2));
  return report;
}

export async function readLocalReports() {
  await ensureFiles();
  const raw = await fs.readFile(reportsPath, "utf8");
  return JSON.parse(raw) as StreamerReport[];
}

export async function addLocalPasswordResetRequest(input: Omit<PasswordResetRequest, "id" | "status" | "created_at">) {
  await ensureFiles();
  const raw = await fs.readFile(passwordResetRequestsPath, "utf8");
  const requests = JSON.parse(raw) as PasswordResetRequest[];
  const request: PasswordResetRequest = {
    ...input,
    id: `reset-${Date.now()}`,
    status: "open",
    created_at: new Date().toISOString()
  };
  await fs.writeFile(passwordResetRequestsPath, JSON.stringify([request, ...requests], null, 2));
  return request;
}

export async function readLocalPasswordResetRequests() {
  await ensureFiles();
  const raw = await fs.readFile(passwordResetRequestsPath, "utf8");
  return JSON.parse(raw) as PasswordResetRequest[];
}

export async function completeLocalPasswordResetRequest(id: string) {
  const requests = await readLocalPasswordResetRequests();
  const updated = requests.map((request) => (
    request.id === id ? { ...request, status: "completed" as const, completed_at: new Date().toISOString() } : request
  ));
  await fs.writeFile(passwordResetRequestsPath, JSON.stringify(updated, null, 2));
  return updated.find((request) => request.id === id) || null;
}

export async function updateLocalCreatorPassword(input: { email: string; application_id?: string; streamer_id?: string; password_hash: string }) {
  const applications = await readLocalApplications();
  const email = input.email.toLowerCase();
  const updated = applications.map((application) => {
    const matched = (
      application.email.toLowerCase() === email ||
      (input.application_id && application.id === input.application_id) ||
      (input.streamer_id && application.streamer_id === input.streamer_id)
    );
    return matched ? { ...application, creator_password_hash: input.password_hash } : application;
  });
  await fs.writeFile(applicationsPath, JSON.stringify(updated, null, 2));
  return updated.find((application) => application.creator_password_hash === input.password_hash && (
    application.email.toLowerCase() === email ||
    application.id === input.application_id ||
    application.streamer_id === input.streamer_id
  )) || null;
}

export async function updateLocalViewerPassword(input: { email: string; viewer_id?: string; password_hash: string }) {
  const profiles = await readLocalViewerProfilesRaw();
  const email = input.email.toLowerCase();
  const updated = profiles.map((profile) => {
    const matched = profile.email?.toLowerCase() === email || (input.viewer_id && profile.id === input.viewer_id);
    return matched ? { ...profile, viewer_password_hash: input.password_hash } : profile;
  });
  await fs.writeFile(viewerProfilesPath, JSON.stringify(updated, null, 2));
  return updated.find((profile) => profile.viewer_password_hash === input.password_hash && (
    profile.email?.toLowerCase() === email ||
    profile.id === input.viewer_id
  )) || null;
}

async function ensureFiles() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(streamersPath);
  } catch {
    await fs.writeFile(streamersPath, JSON.stringify(mockStreamers, null, 2));
  }
  try {
    await fs.access(likesPath);
  } catch {
    await fs.writeFile(likesPath, "[]");
  }
  try {
    await fs.access(applicationsPath);
  } catch {
    await fs.writeFile(applicationsPath, "[]");
  }
  try {
    await fs.access(paymentsPath);
  } catch {
    await fs.writeFile(paymentsPath, "[]");
  }
  try {
    await fs.access(viewerProfilesPath);
  } catch {
    await fs.writeFile(viewerProfilesPath, "[]");
  }
  try {
    await fs.access(profileEditsPath);
  } catch {
    await fs.writeFile(profileEditsPath, "[]");
  }
  try {
    await fs.access(reportsPath);
  } catch {
    await fs.writeFile(reportsPath, "[]");
  }
  try {
    await fs.access(viewerActivitiesPath);
  } catch {
    await fs.writeFile(viewerActivitiesPath, "[]");
  }
  try {
    await fs.access(passwordResetRequestsPath);
  } catch {
    await fs.writeFile(passwordResetRequestsPath, "[]");
  }
  try {
    await fs.access(visitsPath);
  } catch {
    await fs.writeFile(visitsPath, "{}");
  }
  try {
    await fs.access(visitSourcesPath);
  } catch {
    await fs.writeFile(visitSourcesPath, "{}");
  }
  try {
    await fs.access(visitHoursPath);
  } catch {
    await fs.writeFile(visitHoursPath, "{}");
  }
  try {
    await fs.access(visitPagesPath);
  } catch {
    await fs.writeFile(visitPagesPath, "{}");
  }
  try {
    await fs.access(analyticsPath);
  } catch {
    await fs.writeFile(analyticsPath, "{}");
  }
}

function normalizeLocalPagePath(value?: string) {
  const pathValue = String(value || "/").trim().split("?")[0] || "/";
  return pathValue.slice(0, 120);
}

async function writeLocalFileIfPossible(filePath: string, content: string) {
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.warn(`Local data write skipped for ${path.basename(filePath)}: ${message}`);
  }
}
