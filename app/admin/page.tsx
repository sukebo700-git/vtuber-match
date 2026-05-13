import { HeaderAuthStatus } from "@/components/HeaderAuthStatus";
import { AdminDashboard } from "@/components/AdminDashboard";
import { ReportAdminPanel } from "@/components/ReportAdminPanel";
import { ViewerAdminPanel } from "@/components/ViewerAdminPanel";
import { PasswordResetAdminPanel } from "@/components/PasswordResetAdminPanel";
import { VisitStatsPanel } from "@/components/VisitStatsPanel";
import { adminCookieName, verifyAdminSession } from "@/lib/adminSession";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { readAllLocalStreamers, readLocalApplications, readLocalPasswordResetRequests, readLocalReports, readLocalViewerProfilesWithStats, readLocalVisitSourceStats, readLocalVisitStats, summarizeVisitSources, summarizeVisits } from "@/lib/localStore";
import { normalizeStreamer } from "@/lib/streamers";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import type { ApplicationStatus, PlanType, StreamerApplication, StreamerProfileEdit, ViewerProfile, ViewerProfileWithStats, StreamerReport, PasswordResetRequest } from "@/lib/types";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "管理画面",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const hasCookie = verifyAdminSession(cookies().get(adminCookieName)?.value);
  if (!hasCookie) notFound();

  const db = getAdminDb();
  const applications = db ? await readFirestoreApplications() : await readLocalApplications();
  const streamers = db ? await readAllFirestoreStreamers() : await readAllLocalStreamers();
  const viewers = db ? await readFirestoreViewerProfiles() : await readLocalViewerProfilesWithStats();
  const reports = db ? await readFirestoreReports() : await readLocalReports();
  const passwordResetRequests = db ? await readFirestorePasswordResetRequests() : await readLocalPasswordResetRequests();
  const visitStats = db ? await readFirestoreVisitStats() : await readLocalVisitStats();
  const visitSourceStats = db ? await readFirestoreVisitSourceStats() : await readLocalVisitSourceStats();

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">Vtuberマッチ</a>
        <nav className="nav" aria-label="メイン">
          <a href="/viewer">視聴者用</a>
          <a href="/creator">配信者用</a>
          <a href="/help">ヘルプ</a>
        </nav>
        <HeaderAuthStatus />
      </header>
      <main className="main grid-page">
        <VisitStatsPanel stats={visitStats} sources={visitSourceStats} />
        <AdminDashboard initialApplications={applications} initialStreamers={streamers} adminKey="" />
        <ViewerAdminPanel viewers={viewers} />
        <PasswordResetAdminPanel requests={passwordResetRequests} adminKey="" />
        <ReportAdminPanel reports={reports} />
      </main>
    </div>
  );
}

async function readFirestoreVisitStats() {
  const db = getAdminDb();
  if (!db) return { today: 0, week: 0, total: 0 };
  const snapshot = await db.collection("site_visits").limit(500).get();
  const visits: Record<string, number> = {};
  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    visits[String(data.date || doc.id)] = Number(data.count || 0);
  });
  return summarizeVisits(visits);
}

async function readFirestoreVisitSourceStats() {
  const db = getAdminDb();
  if (!db) return { organic: 0, direct: 0, social: 0, referral: 0, ads: 0 };
  const snapshot = await db.collection("site_visit_sources").limit(500).get();
  const sources: Record<string, Record<string, number>> = {};
  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    sources[String(data.date || doc.id)] = {
      organic: Number(data.organic || 0),
      direct: Number(data.direct || 0),
      social: Number(data.social || 0),
      referral: Number(data.referral || 0),
      ads: Number(data.ads || 0),
    };
  });
  return summarizeVisitSources(sources);
}

async function readFirestorePasswordResetRequests(): Promise<PasswordResetRequest[]> {
  const db = getAdminDb();
  if (!db) return [];
  const snapshot = await db.collection("password_reset_requests").orderBy("created_at", "desc").limit(120).get();
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      user_type: data.user_type === "viewer" ? "viewer" : "creator",
      email: data.email || "",
      name: data.name || "",
      application_id: data.application_id || "",
      streamer_id: data.streamer_id || "",
      viewer_id: data.viewer_id || "",
      note: data.note || "",
      status: data.status === "completed" ? "completed" : "open",
      created_at: timestampToIso(data.created_at),
      completed_at: timestampToIso(data.completed_at)
    };
  });
}

async function readFirestoreReports(): Promise<StreamerReport[]> {
  const db = getAdminDb();
  if (!db) return [];
  const snapshot = await db.collection("reports").orderBy("created_at", "desc").limit(120).get();
  return snapshot.docs.map((doc) => {
    const data = doc.data();
      return {
        id: doc.id,
        report_type: data.report_type || "streamer",
        streamer_id: data.streamer_id || "",
        streamer_name: data.streamer_name || "",
        viewer_profile_id: data.viewer_profile_id || "",
        viewer_name: data.viewer_name || "",
        reason: data.reason || "",
      detail: data.detail || "",
      reporter_contact: data.reporter_contact || "",
      status: data.status === "reviewed" ? "reviewed" : "open",
      created_at: typeof data.created_at === "string" ? data.created_at : data.created_at?.toDate?.().toISOString()
    };
  });
}

async function readFirestoreViewerProfiles(): Promise<ViewerProfileWithStats[]> {
  const db = getAdminDb();
  if (!db) return [];
  const [profileSnapshot, likeSnapshot, creatorLikeSnapshot] = await Promise.all([
    db.collection("viewer_profiles").limit(120).get(),
    db.collection("likes").limit(1000).get(),
    db.collection("creator_likes").limit(1000).get()
  ]);

  const counts = new Map<string, number>();
  const streamerLikeCounts = new Map<string, number>();
  likeSnapshot.docs.forEach((doc) => {
    const data = doc.data();
    const id = String(data.viewer_profile_id || data.viewer_profile?.id || "");
    if (!id) return;
    counts.set(id, (counts.get(id) || 0) + 1);
  });
  creatorLikeSnapshot.docs.forEach((doc) => {
    const data = doc.data();
    const id = String(data.viewer_profile_id || "");
    if (!id) return;
    streamerLikeCounts.set(id, (streamerLikeCounts.get(id) || 0) + 1);
  });

  return profileSnapshot.docs.map((doc) => {
    const data = doc.data() as ViewerProfile;
    const matchCount = counts.get(doc.id) || data.match_count || 0;
    return {
      id: doc.id,
      display_name: data.display_name || "",
      youtube_display_name: data.youtube_display_name || "",
      image: data.image || "",
      email: data.email || "",
      viewer_login_id: data.viewer_login_id || "",
      viewer_password_hash: data.viewer_password_hash || "",
      viewer_plan: data.viewer_plan === "viewer_paid" ? "viewer_paid" : "free",
      subscription_status: data.subscription_status,
      stripe_subscription_id: data.stripe_subscription_id || "",
      profile: data.profile || "",
      twitter_id: data.twitter_id || "",
      one_liner: data.one_liner || "",
      favorite_categories: Array.isArray(data.favorite_categories) ? data.favorite_categories : [],
      visible_to_matched_streamers: data.visible_to_matched_streamers !== false,
      updated_at: timestampToIso(data.updated_at),
      match_count: matchCount,
      streamer_like_count: streamerLikeCounts.get(doc.id) || data.streamer_like_count || 0,
      fan_level: fanLevel(matchCount)
    };
  });
}

async function readFirestoreProfileEdits(): Promise<StreamerProfileEdit[]> {
  const db = getAdminDb();
  if (!db) return [];
  const snapshot = await db.collection("profile_edits").orderBy("created_at", "desc").limit(50).get();
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      application_id: data.application_id || "",
      streamer_id: data.streamer_id || "",
      email: data.email || "",
      youtube_url: data.youtube_url || "",
      name: data.name || "",
      image: data.image || "",
      description: data.description || "",
      one_liner: data.one_liner || "",
      stream_time: data.stream_time || "",
      categories: Array.isArray(data.categories) ? data.categories : [],
      tags: Array.isArray(data.tags) ? data.tags : [],
      status: data.status === "reviewed" ? "reviewed" : "pending",
      created_at: typeof data.created_at === "string" ? data.created_at : data.created_at?.toDate?.().toISOString()
    };
  });
}

async function readFirestoreApplications(): Promise<StreamerApplication[]> {
  const db = getAdminDb();
  if (!db) return [];
  const snapshot = await db.collection("applications").orderBy("created_at", "desc").limit(80).get();
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      name: data.name || "",
      email: data.email || "",
      youtube_url: data.youtube_url || "",
      youtube_channel_id: data.youtube_channel_id,
      thumbnails: Array.isArray(data.thumbnails) ? data.thumbnails : [],
      categories: Array.isArray(data.categories) ? data.categories : [],
      tags: Array.isArray(data.tags) ? data.tags : [],
      description: data.description || "",
      one_liner: data.one_liner || "",
      stream_time: data.stream_time,
      desired_plan: normalizePlan(data.desired_plan),
      payment_status: normalizePaymentStatus(data.payment_status, data.desired_plan, data.subscription_status, data.stripe_subscription_id),
      status: normalizeStatus(data.status),
      admin_note: data.admin_note,
      created_at: typeof data.created_at === "string" ? data.created_at : data.created_at?.toDate?.().toISOString(),
      reviewed_at: typeof data.reviewed_at === "string" ? data.reviewed_at : data.reviewed_at?.toDate?.().toISOString(),
      paid_at: typeof data.paid_at === "string" ? data.paid_at : data.paid_at?.toDate?.().toISOString(),
      subscription_status: data.subscription_status,
      stripe_subscription_id: data.stripe_subscription_id,
      streamer_id: data.streamer_id,
      creator_login_id: data.creator_login_id,
      creator_password_hash: data.creator_password_hash
    };
  });
}

async function readAllFirestoreStreamers() {
  const db = getAdminDb();
  if (!db) return [];
  const snapshot = await db.collection("streamers").limit(120).get();
  return snapshot.docs.map((doc) => normalizeStreamer(doc.id, doc.data()));
}

function normalizePlan(plan: string): PlanType {
  if (plan === "boost" || plan === "boost_monthly" || plan === "boost_yearly") return "boost";
  if (plan === "paid" || plan === "standard_monthly" || plan === "standard_yearly") return "paid";
  return "free";
}

function normalizeStatus(status: string): ApplicationStatus {
  if (status === "approved" || status === "rejected") return status;
  return "pending";
}

function normalizePaymentStatus(status: string, plan: string, subscriptionStatus?: string, subscriptionId?: string): StreamerApplication["payment_status"] {
  if (status === "paid" || status === "pending" || status === "not_required") return status;
  if (subscriptionStatus === "active" || subscriptionId) return "paid";
  return plan === "free" ? "not_required" : "pending";
}

function fanLevel(matchCount: number): ViewerProfileWithStats["fan_level"] {
  if (matchCount >= 20) return "super";
  if (matchCount >= 5) return "active";
  return "starter";
}

function formatDate(value?: string) {
  if (!value) return "未記録";
  return new Date(value).toLocaleString("ja-JP");
}

function timestampToIso(value: unknown) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  return undefined;
}

