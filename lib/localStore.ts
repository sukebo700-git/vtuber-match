import { promises as fs } from "fs";
import path from "path";
import { mockStreamers } from "./mockData";
import { rankStreamers } from "./ranking";
import type { PaymentRecord, PlanType, Streamer, StreamerApplication, StreamerProfileEdit, ViewerProfile } from "./types";

const dataDir = path.join(process.cwd(), "data");
const streamersPath = path.join(dataDir, "local-streamers.json");
const likesPath = path.join(dataDir, "local-likes.json");
const applicationsPath = path.join(dataDir, "local-applications.json");
const paymentsPath = path.join(dataDir, "local-payments.json");
const viewerProfilesPath = path.join(dataDir, "local-viewer-profiles.json");
const profileEditsPath = path.join(dataDir, "local-profile-edits.json");

export async function readLocalStreamers() {
  return rankStreamers(await readAllLocalStreamers());
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

export async function updateLocalStreamer(id: string, patch: Partial<Pick<Streamer, "is_visible" | "plan_type" | "is_initial_scout">>) {
  const streamers = await readAllLocalStreamers();
  const updated = streamers.map((streamer) => (
    streamer.id === id ? { ...streamer, ...patch } : streamer
  ));
  await fs.writeFile(streamersPath, JSON.stringify(updated, null, 2));
  return updated.find((streamer) => streamer.id === id) || null;
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
  if (input.streamer_id) await updateLocalStreamer(input.streamer_id, { plan_type: input.plan_type });
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
    thumbnails: application.thumbnails,
    categories: application.categories,
    tags: application.tags,
    description: application.description,
    one_liner: application.one_liner,
    stream_time: application.stream_time,
    plan_type: application.desired_plan,
    is_initial_scout: false,
    is_visible: true
  });

  const updated = applications.map((item) => (
    item.id === applicationId
      ? { ...item, status: "approved" as const, reviewed_at: new Date().toISOString() }
      : item
  ));
  await fs.writeFile(applicationsPath, JSON.stringify(updated, null, 2));

  return streamer;
}

export async function incrementLocalStreamer(id: string, field: "impressions" | "likes") {
  const streamers = await readAllLocalStreamers();
  const updated = streamers.map((streamer) => (
    streamer.id === id ? { ...streamer, [field]: (streamer[field] || 0) + 1 } : streamer
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
  likes.push({ user_id: userId, streamer_id: streamerId, viewer_profile: viewerProfile || null, timestamp: new Date().toISOString() });
  await fs.writeFile(likesPath, JSON.stringify(likes, null, 2));
}

export async function upsertLocalViewerProfile(input: ViewerProfile) {
  await ensureFiles();
  const raw = await fs.readFile(viewerProfilesPath, "utf8");
  const profiles = JSON.parse(raw) as ViewerProfile[];
  const profile = { ...input, updated_at: new Date().toISOString() };
  const next = [profile, ...profiles.filter((item) => item.id !== input.id)];
  await fs.writeFile(viewerProfilesPath, JSON.stringify(next, null, 2));
  return profile;
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
}
