import { promises as fs } from "fs";
import path from "path";
import { mockStreamers } from "./mockData";
import { rankStreamers } from "./ranking";
import type { PaymentRecord, PlanType, Streamer, StreamerApplication, StreamerProfileEdit, ViewerProfile, ViewerProfileWithStats, StreamerReport, PasswordResetRequest } from "./types";

const dataDir = path.join(process.cwd(), "data");
const streamersPath = path.join(dataDir, "local-streamers.json");
const likesPath = path.join(dataDir, "local-likes.json");
const applicationsPath = path.join(dataDir, "local-applications.json");
const paymentsPath = path.join(dataDir, "local-payments.json");
const viewerProfilesPath = path.join(dataDir, "local-viewer-profiles.json");
const profileEditsPath = path.join(dataDir, "local-profile-edits.json");
const reportsPath = path.join(dataDir, "local-reports.json");
const creatorLikesPath = path.join(dataDir, "local-creator-likes.json");
const passwordResetRequestsPath = path.join(dataDir, "local-password-reset-requests.json");
const visitsPath = path.join(dataDir, "local-visits.json");

export async function readLocalStreamers() {
  return rankStreamers(await readAllLocalStreamers());
}

export async function addLocalVisit(date: string) {
  await ensureFiles();
  const raw = await fs.readFile(visitsPath, "utf8");
  const visits = JSON.parse(raw) as Record<string, number>;
  visits[date] = (visits[date] || 0) + 1;
  await fs.writeFile(visitsPath, JSON.stringify(visits, null, 2));
}

export async function readLocalVisitStats() {
  await ensureFiles();
  const raw = await fs.readFile(visitsPath, "utf8");
  const visits = JSON.parse(raw) as Record<string, number>;
  return summarizeVisits(visits);
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
  const updated = streamers.filter((streamer) => streamer.id !== id);
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
  if (application.desired_plan !== "free" && application.payment_status !== "paid") return null;

  const streamer = await addLocalStreamer({
    name: application.name,
    youtube_url: application.youtube_url,
    youtube_channel_id: application.youtube_channel_id,
    x_account: application.x_account,
    thumbnails: application.thumbnails,
    categories: application.categories,
    tags: application.tags,
    description: application.description,
    one_liner: application.one_liner,
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
  if (input.streamer_id && input.plan_type !== "viewer_paid") await updateLocalStreamer(input.streamer_id, { plan_type: input.plan_type });
  if (input.viewer_id && input.plan_type === "viewer_paid") {
    const profiles = await readLocalViewerProfilesRaw();
    await fs.writeFile(viewerProfilesPath, JSON.stringify(profiles.map((profile) => (
      profile.id === input.viewer_id ? { ...profile, viewer_plan: "viewer_paid", subscription_status: "active", updated_at: new Date().toISOString() } : profile
    )), null, 2));
  }
  return payment;
}

export async function approveLocalApplication(applicationId: string) {
  const applications = await readLocalApplications();
  const application = applications.find((item) => item.id === applicationId);
  if (!application) return null;
  if (application.desired_plan !== "free" && application.payment_status !== "paid") return null;

  const streamer = await addLocalStreamer({
    name: application.name,
    youtube_url: application.youtube_url,
    youtube_channel_id: application.youtube_channel_id,
    x_account: application.x_account,
    thumbnails: application.thumbnails,
    categories: application.categories,
    tags: application.tags,
    description: application.description,
    one_liner: application.one_liner,
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

export async function incrementLocalStreamer(id: string, field: "impressions" | "likes" | "viewer_like_boosts") {
  const streamers = await readAllLocalStreamers();
  const updated = streamers.map((streamer) => (
    streamer.id === id ? { ...streamer, [field]: (Number(streamer[field] || 0)) + 1 } : streamer
  ));
  await fs.writeFile(streamersPath, JSON.stringify(updated, null, 2));
}

export async function readAllLocalStreamers() {
  await ensureFiles();
  const raw = await fs.readFile(streamersPath, "utf8");
  const parsed = JSON.parse(raw) as Streamer[];
  if (!parsed.length) {
    await fs.writeFile(streamersPath, JSON.stringify(mockStreamers, null, 2));
    return mockStreamers;
  }
  const migrated = parsed.map((streamer) => ({
    ...streamer,
    plan_type: normalizePlan(streamer.plan_type),
    is_visible: streamer.is_visible !== false
  }));
  await fs.writeFile(streamersPath, JSON.stringify(migrated, null, 2));
  return migrated;
}

function normalizePlan(plan: string): PlanType {
  if (plan === "boost" || plan === "boost_monthly" || plan === "boost_yearly") return "boost";
  if (plan === "paid" || plan === "standard_monthly" || plan === "standard_yearly") return "paid";
  return "free";
}

export async function addLocalLike(userId: string, streamerId: string, viewerProfile?: Record<string, unknown>) {
  await ensureFiles();
  const raw = await fs.readFile(likesPath, "utf8");
  const likes = JSON.parse(raw) as Array<Record<string, unknown>>;
  likes.push({
    user_id: userId,
    streamer_id: streamerId,
    viewer_profile_id: viewerProfile?.id || null,
    viewer_profile: viewerProfile || null,
    timestamp: new Date().toISOString()
  });
  await fs.writeFile(likesPath, JSON.stringify(likes, null, 2));
}

export async function upsertLocalViewerProfile(input: ViewerProfile) {
  await ensureFiles();
  const raw = await fs.readFile(viewerProfilesPath, "utf8");
  const profiles = JSON.parse(raw) as ViewerProfile[];
  const existing = profiles.find((item) => item.id === input.id);
  const profile = { ...existing, ...input, updated_at: new Date().toISOString() };
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
  await fs.writeFile(viewerProfilesPath, JSON.stringify(profiles.filter((profile) => profile.id !== id), null, 2));
  return target;
}

export async function readLocalViewerProfilesWithStats(): Promise<ViewerProfileWithStats[]> {
  await ensureFiles();
  const rawProfiles = await fs.readFile(viewerProfilesPath, "utf8");
  const rawLikes = await fs.readFile(likesPath, "utf8");
  const rawCreatorLikes = await fs.readFile(creatorLikesPath, "utf8");
  const profiles = JSON.parse(rawProfiles) as ViewerProfile[];
  const likes = JSON.parse(rawLikes) as Array<Record<string, unknown>>;
  const creatorLikes = JSON.parse(rawCreatorLikes) as Array<Record<string, unknown>>;
  const counts = new Map<string, number>();
  const streamerLikeCounts = new Map<string, number>();

  for (const like of likes) {
    const profile = like.viewer_profile as Record<string, unknown> | undefined;
    const id = String(like.viewer_profile_id || profile?.id || "");
    if (!id) continue;
    counts.set(id, (counts.get(id) || 0) + 1);
  }
  for (const like of creatorLikes) {
    const id = String(like.viewer_profile_id || "");
    if (!id) continue;
    streamerLikeCounts.set(id, (streamerLikeCounts.get(id) || 0) + 1);
  }

  return profiles.map((profile) => {
    const matchCount = counts.get(profile.id) || profile.match_count || 0;
    return {
      ...profile,
      match_count: matchCount,
      streamer_like_count: streamerLikeCounts.get(profile.id) || profile.streamer_like_count || 0,
      fan_level: fanLevel(matchCount)
    };
  });
}

export async function readLocalViewerProfilesForStreamer(streamerId: string) {
  await ensureFiles();
  const rawLikes = await fs.readFile(likesPath, "utf8");
  const rawProfiles = await fs.readFile(viewerProfilesPath, "utf8");
  const rawCreatorLikes = await fs.readFile(creatorLikesPath, "utf8");
  const likes = JSON.parse(rawLikes) as Array<Record<string, unknown>>;
  const profiles = JSON.parse(rawProfiles) as ViewerProfile[];
  const creatorLikes = JSON.parse(rawCreatorLikes) as Array<Record<string, unknown>>;
  const likedIds = new Set(creatorLikes.filter((like) => like.streamer_id === streamerId).map((like) => String(like.viewer_profile_id || "")));
  const byId = new Map(profiles.map((profile) => [profile.id, profile]));

  return likes
    .filter((like) => like.streamer_id === streamerId)
    .map((like) => {
      const embedded = like.viewer_profile as Partial<ViewerProfile> | undefined;
      const id = String(like.viewer_profile_id || embedded?.id || "");
      const profile = byId.get(id) || embedded;
      if (!profile || profile.visible_to_matched_streamers === false) return null;
      return {
        ...profile,
        id,
        liked_by_streamer: likedIds.has(id)
      };
    })
    .filter(Boolean);
}

export async function addLocalCreatorLike(streamerId: string, viewerProfileId: string) {
  await ensureFiles();
  const raw = await fs.readFile(creatorLikesPath, "utf8");
  const likes = JSON.parse(raw) as Array<Record<string, unknown>>;
  const exists = likes.some((like) => like.streamer_id === streamerId && like.viewer_profile_id === viewerProfileId);
  if (exists) return false;
  likes.push({
    streamer_id: streamerId,
    viewer_profile_id: viewerProfileId,
    timestamp: new Date().toISOString()
  });
  await fs.writeFile(creatorLikesPath, JSON.stringify(likes, null, 2));
  return true;
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
    await fs.access(creatorLikesPath);
  } catch {
    await fs.writeFile(creatorLikesPath, "[]");
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
}
