import { HeaderAuthStatus } from "@/components/HeaderAuthStatus";
import { AdminDashboard } from "@/components/AdminDashboard";
import { ShortVideoAdminPanel } from "@/components/ShortVideoAdminPanel";
import { ReportAdminPanel } from "@/components/ReportAdminPanel";
import { ViewerAdminPanel } from "@/components/ViewerAdminPanel";
import { PasswordResetAdminPanel } from "@/components/PasswordResetAdminPanel";
import { VisitStatsPanel } from "@/components/VisitStatsPanel";
import { AdminAnalyticsPanel } from "@/components/AdminAnalyticsPanel";
import { AdminImportantNotifications, type AdminImportantNotification } from "@/components/AdminImportantNotifications";
import { emptyAdminAnalyticsSummary, type AdminAnalyticsSummary } from "@/lib/analytics";
import { adminCookieName, verifyAdminSession } from "@/lib/adminSession";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { readAllLocalStreamers, readLocalAnalyticsSummary, readLocalApplications, readLocalPasswordResetRequests, readLocalReports, readLocalViewerProfilesWithStats, readLocalVisitSourceStats, readLocalVisitStats, summarizeVisits } from "@/lib/localStore";
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

type AdminTab = "streamers" | "viewers" | "sales" | "analytics" | "inbox";

const adminTabs: Array<{ id: AdminTab; label: string }> = [
  { id: "streamers", label: "配信者" },
  { id: "viewers", label: "視聴者" },
  { id: "sales", label: "申込/課金" },
  { id: "analytics", label: "分析" },
  { id: "inbox", label: "問い合わせ" },
];

type AdminPageSearchParams = {
  tab?: string;
  cursor?: string;
  x?: string;
};

type PagedResult<T> = {
  items: T[];
  nextCursor?: string;
  totalCount?: number;
  // ページング対象外でも、有料/上位プランの配信者はクライアント側の
  // 「有料登録のみ」フィルタが全件を絞り込めるよう、全ページ横断で別途返す。
  paidItems?: T[];
};

export default async function AdminPage({ searchParams }: { searchParams?: AdminPageSearchParams }) {
  const hasCookie = verifyAdminSession(cookies().get(adminCookieName)?.value);
  if (!hasCookie) notFound();

  const db = getAdminDb();
  const activeTab = normalizeAdminTab(searchParams?.tab);
  const needsStreamerData = activeTab === "streamers" || activeTab === "sales";
  const needsViewerData = activeTab === "viewers";
  const needsAnalyticsData = activeTab === "analytics";
  const needsInboxData = activeTab === "inbox";
  const cursor = searchParams?.cursor;
  const xFilter = searchParams?.x === "unintroduced" ? "unintroduced" : "all";

  const applications = needsStreamerData ? (db ? await readFirestoreApplications() : await readLocalApplications()) : [];
  const streamerPage = needsStreamerData ? (db ? await readAllFirestoreStreamers({ cursor, xFilter }) : { items: await readAllLocalStreamers() }) : { items: [] };
  const viewerPage = needsViewerData ? (db ? await readFirestoreViewerProfiles({ cursor }) : { items: await readLocalViewerProfilesWithStats() }) : { items: [] };
  const streamers = streamerPage.items;
  const viewers = viewerPage.items;
  const streamerTotalCount = streamerPage.totalCount ?? streamers.length;
  const viewerTotalCount = viewerPage.totalCount ?? viewers.length;
  const reports = needsInboxData ? (db ? await readFirestoreReports() : await readLocalReports()) : [];
  const passwordResetRequests = needsInboxData ? (db ? await readFirestorePasswordResetRequests() : await readLocalPasswordResetRequests()) : [];
  const importantNotifications = db ? await readImportantNotifications() : [];
  const visitStats = needsAnalyticsData ? (db ? await readFirestoreVisitStats() : await readLocalVisitStats()) : { today: 0, week: 0, total: 0 };
  const visitSourceStats = needsAnalyticsData ? (db ? await readFirestoreVisitSourceStats() : await readLocalVisitSourceStats()) : { organic: 0, direct: 0, social: 0, referral: 0, ads: 0 };
  const analyticsStats = needsAnalyticsData ? (db ? await readFirestoreAnalyticsSummary() : await readLocalAnalyticsSummary()) : emptyAdminAnalyticsSummary;

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">Vtuberマッチ</a>
        <nav className="nav" aria-label="メイン">
          <a href="/viewer">視聴者用</a>
          <a href="/creator">配信者用</a>
          <a href="/diagnosis">タイプ診断</a>
          <a href="https://www.youtube.com/@VtuberMatch" target="_blank" rel="noreferrer">公式YouTube</a>
          <a href="/help">ヘルプ</a>
        </nav>
        <HeaderAuthStatus />
      </header>
      <main className="main admin-main grid-page">
        <AdminImportantNotifications notifications={importantNotifications} />
        <nav className="admin-filter-row" aria-label="管理画面タブ">
          {adminTabs.map((tab) => (
            <a className={activeTab === tab.id ? "selected secondary-button" : "secondary-button"} href={`/admin?tab=${tab.id}`} key={tab.id}>
              {tab.label}
            </a>
          ))}
        </nav>
        {activeTab === "streamers" && (
          <nav className="admin-filter-row" aria-label="配信者絞り込み">
            <a className={xFilter === "all" ? "selected secondary-button" : "secondary-button"} href="/admin?tab=streamers">全件</a>
            <a className={xFilter === "unintroduced" ? "selected secondary-button" : "secondary-button"} href="/admin?tab=streamers&x=unintroduced">X未紹介</a>
          </nav>
        )}
        <section className="status-band admin-registration-summary">
          <h2>登録状況</h2>
          <div className="metric-grid">
            <div className="metric">
              <strong>{activeTab === "viewers" ? viewerTotalCount.toLocaleString("ja-JP") : "—"}</strong>
              <span>視聴者数（全体）</span>
            </div>
            <div className="metric">
              <strong>{needsStreamerData ? streamerTotalCount.toLocaleString("ja-JP") : "—"}</strong>
              <span>{xFilter === "unintroduced" ? "配信者数（X未紹介）" : "配信者数（全体）"}</span>
            </div>
          </div>
        </section>
        {activeTab === "analytics" && (
          <>
            <VisitStatsPanel stats={visitStats} sources={visitSourceStats} />
            <AdminAnalyticsPanel analytics={analyticsStats} />
          </>
        )}
        {activeTab === "streamers" && <ShortVideoAdminPanel adminKey="" />}
        {needsStreamerData && <AdminDashboard initialApplications={applications} initialStreamers={streamers} initialPaidStreamers={streamerPage.paidItems ?? []} adminKey="" />}
        {activeTab === "viewers" && <ViewerAdminPanel viewers={viewers} />}
        {(activeTab === "streamers" || activeTab === "viewers") && (
          <AdminPagination
            activeTab={activeTab}
            nextCursor={activeTab === "streamers" ? streamerPage.nextCursor : viewerPage.nextCursor}
            xFilter={xFilter}
          />
        )}
        {activeTab === "inbox" && (
          <>
            <PasswordResetAdminPanel requests={passwordResetRequests} adminKey="" />
            <ReportAdminPanel reports={reports} />
          </>
        )}
      </main>
    </div>
  );
}

function AdminPagination({ activeTab, nextCursor, xFilter }: { activeTab: "streamers" | "viewers"; nextCursor?: string; xFilter: "all" | "unintroduced" }) {
  const params = new URLSearchParams({ tab: activeTab });
  if (activeTab === "streamers" && xFilter === "unintroduced") params.set("x", "unintroduced");
  const firstHref = `/admin?${params.toString()}`;
  if (nextCursor) params.set("cursor", nextCursor);
  return (
    <nav className="admin-pagination" aria-label="管理画面ページ送り">
      <a className="secondary-button" href={firstHref}>先頭へ</a>
      {nextCursor ? (
        <a className="primary-button" href={`/admin?${params.toString()}`}>次の100件</a>
      ) : (
        <span className="help-text">次ページはありません</span>
      )}
    </nav>
  );
}

function normalizeAdminTab(value: string | undefined): AdminTab {
  if (value === "viewers" || value === "sales" || value === "analytics" || value === "inbox") return value;
  return "streamers";
}

async function readImportantNotifications(): Promise<AdminImportantNotification[]> {
  const db = getAdminDb();
  if (!db) return [];
  const [passwordResets, applicationDocs, streamerDocs, shortVideoDocs] = await Promise.all([
    db.collection("password_reset_requests")
      .select("email", "name", "user_type", "status", "created_at", "updated_at")
      .limit(40)
      .get(),
    db.collection("applications")
      .select("name", "email", "withdrawal_status", "withdrawal_requested_at", "payment_state", "subscription_status", "stripe_subscription_id", "created_at", "updated_at")
      .limit(80)
      .get(),
    db.collection("streamers")
      .select("name", "creator_email", "withdrawal_status", "withdrawal_requested_at", "payment_state", "subscription_status", "stripe_subscription_id", "created_at", "updated_at")
      .limit(80)
      .get(),
    db.collection("short_video_requests")
      .select("name", "email", "streamer_id", "application_id", "status", "requested_at", "updated_at", "form_url")
      .limit(80)
      .get(),
  ]);

  const items: AdminImportantNotification[] = [];
  passwordResets.docs.forEach((doc) => {
    const data = doc.data();
    if (data.status === "completed") return;
    items.push({
      id: `password_reset:${doc.id}`,
      type: "password_reset",
      title: "パスワード再発行",
      body: `${data.user_type === "viewer" ? "視聴者" : "配信者"} / ${data.email || data.name || doc.id}`,
      created_at: timestampToIso(data.created_at ?? doc.createTime ?? data.updated_at ?? doc.updateTime),
      href: "/admin?tab=inbox",
    });
  });
  applicationDocs.docs.forEach((doc) => {
    const data = doc.data();
    if (data.withdrawal_status === "requested") {
      items.push({
        id: `application_withdrawal:${doc.id}`,
        type: "withdrawal",
        title: "退会申請",
        body: `${data.name || data.email || doc.id} から退会申請があります。`,
        created_at: timestampToIso(data.withdrawal_requested_at ?? data.updated_at ?? data.created_at),
        href: "/admin?tab=sales",
      });
    }
    if (data.payment_state === "past_due") {
      items.push({
        id: `application_payment_failed:${doc.id}`,
        type: "payment_failed",
        title: "支払い失敗",
        body: `${data.name || data.email || doc.id} の支払い確認が必要です。`,
        created_at: timestampToIso(data.updated_at ?? data.created_at),
        href: "/admin?tab=sales",
      });
    }
  });
  streamerDocs.docs.forEach((doc) => {
    const data = doc.data();
    if (data.withdrawal_status === "requested") {
      items.push({
        id: `streamer_withdrawal:${doc.id}`,
        type: "withdrawal",
        title: "退会申請",
        body: `${data.name || data.creator_email || doc.id} から退会申請があります。`,
        created_at: timestampToIso(data.withdrawal_requested_at ?? data.updated_at ?? data.created_at),
        href: "/admin?tab=streamers",
      });
    }
    if (data.payment_state === "past_due") {
      items.push({
        id: `streamer_payment_failed:${doc.id}`,
        type: "payment_failed",
        title: "支払い失敗",
        body: `${data.name || data.creator_email || doc.id} の支払い確認が必要です。`,
        created_at: timestampToIso(data.updated_at ?? data.created_at),
        href: "/admin?tab=streamers",
      });
    }
  });
  shortVideoDocs.docs.forEach((doc) => {
    const data = doc.data();
    if (["handled", "published", "rejected"].includes(String(data.status || ""))) return;
    items.push({
      id: `short_video:${doc.id}`,
      type: "short_video",
      title: "ショート動画希望",
      body: `${data.name || data.email || data.streamer_id || data.application_id || doc.id} が無料ショート動画作成を希望しています。`,
      created_at: timestampToIso(data.requested_at ?? data.updated_at),
      href: "/admin?tab=streamers",
    });
  });

  return items.sort((a, b) => safeTime(b.created_at) - safeTime(a.created_at)).slice(0, 20);
}

async function readFirestoreAnalyticsSummary(): Promise<AdminAnalyticsSummary> {
  const db = getAdminDb();
  if (!db) return emptyAdminAnalyticsSummary;
  const today = new Date().toISOString().slice(0, 10);
  const [totalsDoc, todayDoc] = await Promise.all([
    db.collection("aggregates").doc("analytics_totals").get(),
    db.collection("analytics_daily").doc(today).get()
  ]);
  const totals = totalsDoc.data() || {};
  const todayData = todayDoc.data() || {};
  return {
    swiped_visitors: Number(totals.swiped_visitors || 0),
    total_swipes: Number(totals.total_swipes || 0),
    viewer_register_clicks: Number(totals.viewer_register_clicks || 0),
    creator_register_clicks: Number(totals.creator_register_clicks || 0),
    today_swiped_visitors: Number(todayData.swiped_visitors || 0),
    today_total_swipes: Number(todayData.total_swipes || 0),
    today_viewer_register_clicks: Number(todayData.viewer_register_clicks || 0),
    today_creator_register_clicks: Number(todayData.creator_register_clicks || 0),
  };
}

async function readFirestoreVisitStats() {
  const db = getAdminDb();
  if (!db) return { today: 0, week: 0, total: 0 };
  const dates = recentDateIds(7);
  const [totalsDoc, ...dailyDocs] = await Promise.all([
    db.collection("aggregates").doc("analytics_totals").get(),
    ...dates.map((date) => db.collection("site_visits").doc(date).get())
  ]);
  const visits: Record<string, number> = {};
  dailyDocs.forEach((doc) => {
    const data = doc.data() || {};
    visits[String(data.date || doc.id)] = Number(data.count || 0);
  });
  const summary = summarizeVisits(visits);
  return { ...summary, total: Number(totalsDoc.data()?.site_visits_total || summary.total) };
}

async function readFirestoreVisitSourceStats() {
  const db = getAdminDb();
  if (!db) return { organic: 0, direct: 0, social: 0, referral: 0, ads: 0 };
  const data = (await db.collection("aggregates").doc("analytics_totals").get()).data() || {};
  return {
    organic: Number(data.source_organic || 0),
    direct: Number(data.source_direct || 0),
    social: Number(data.source_social || 0),
    referral: Number(data.source_referral || 0),
    ads: Number(data.source_ads || 0),
  };
}

async function readFirestorePasswordResetRequests(): Promise<PasswordResetRequest[]> {
  const db = getAdminDb();
  if (!db) return [];
  const snapshot = await db.collection("password_reset_requests").limit(300).get();
  return snapshot.docs.map<PasswordResetRequest>((doc) => {
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
      created_at: timestampToIso(data.created_at ?? doc.createTime ?? data.updated_at ?? doc.updateTime),
      completed_at: timestampToIso(data.completed_at)
    };
  }).sort(sortByCreatedDesc).slice(0, 120);
}

async function readFirestoreReports(): Promise<StreamerReport[]> {
  const db = getAdminDb();
  if (!db) return [];
  const snapshot = await db.collection("reports").limit(300).get();
  return snapshot.docs.map<StreamerReport>((doc) => {
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
      created_at: timestampToIso(data.created_at ?? data.updated_at)
    };
  }).sort(sortByCreatedDesc).slice(0, 120);
}

async function readFirestoreViewerProfiles({ cursor }: { cursor?: string }): Promise<PagedResult<ViewerProfileWithStats>> {
  const db = getAdminDb();
  if (!db) return { items: [] };
  const profileSnapshot = await db.collection("viewer_profiles")
    .select(
      "display_name",
      "youtube_display_name",
      "email",
      "viewer_login_id",
      "viewer_password_hash",
      "twitter_id",
      "one_liner",
      "favorite_categories",
      "visible_to_matched_streamers",
      "is_deleted",
      "deleted_at",
      "created_at",
      "registered_at",
      "registeredAt",
      "createdAt",
      "updated_at",
      "match_count",
      "streamer_like_count",
      "super_like_stock",
      "super_like_purchase_count",
      "has_paid_history",
      "fcm_tokens",
      "notification_enabled",
      "last_viewer_activity_at",
      "last_viewer_login_at",
    )
    .limit(500)
    .get();
  const decodedCursor = decodeAdminCursor(cursor);
  const sorted = profileSnapshot.docs
    .filter((doc) => doc.data().is_deleted !== true)
    .map((doc) => viewerDocToAdminRow(doc.id, doc.data() as ViewerProfile, timestampToIso(doc.createTime ?? doc.updateTime)))
    .sort(sortViewerAdminRows);
  const pageBase = decodedCursor ? sorted.filter((viewer) => isViewerAfterAdminCursor(viewer, decodedCursor)) : sorted;
  const items = pageBase.slice(0, 100);
  const hasNext = pageBase.length > 100;
  return { items, nextCursor: hasNext && items.length ? encodeViewerAdminCursor(items[items.length - 1]) : undefined, totalCount: sorted.length };
}

function viewerDocToAdminRow(id: string, data: ViewerProfile & Record<string, unknown>, documentCreatedAt?: string): ViewerProfileWithStats {
  const matchCount = Number(data.match_count || 0);
  const fcmTokens = Array.isArray(data.fcm_tokens) ? data.fcm_tokens.map(String).filter(Boolean) : [];
  const createdAt = timestampToIso(
    data.created_at ?? data.registered_at ?? data.registeredAt ?? data.createdAt,
  );
  return {
    id,
    display_name: data.display_name || "",
    youtube_display_name: data.youtube_display_name || "",
    image: "",
    email: data.email || "",
    viewer_login_id: data.viewer_login_id || "",
    viewer_password_hash: data.viewer_password_hash || "",
    viewer_plan: "free",
    subscription_status: undefined,
    stripe_subscription_id: "",
    profile: "",
    twitter_id: data.twitter_id || "",
    one_liner: data.one_liner || "",
    favorite_categories: Array.isArray(data.favorite_categories) ? data.favorite_categories : [],
    visible_to_matched_streamers: data.visible_to_matched_streamers !== false,
    is_deleted: data.is_deleted === true,
    deleted_at: timestampToIso(data.deleted_at),
    created_at: createdAt || documentCreatedAt || timestampToIso(data.updated_at),
    updated_at: timestampToIso(data.updated_at),
    match_count: matchCount,
    streamer_like_count: Number(data.streamer_like_count || 0),
    super_like_stock: Number(data.super_like_stock || 0),
    super_like_purchase_count: Number(data.super_like_purchase_count || 0),
    has_paid_history: data.has_paid_history === true || Number(data.super_like_purchase_count || 0) > 0,
    fcm_tokens: fcmTokens,
    notification_enabled: data.notification_enabled === true || fcmTokens.length > 0,
    last_viewer_activity_at: timestampToIso(data.last_viewer_activity_at ?? data.last_viewer_login_at ?? data.updated_at),
    fan_level: fanLevel(matchCount),
  };
}

async function readFirestoreProfileEdits(): Promise<StreamerProfileEdit[]> {
  const db = getAdminDb();
  if (!db) return [];
  const snapshot = await db.collection("profile_edits").limit(200).get();
  return snapshot.docs.map<StreamerProfileEdit>((doc) => {
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
      created_at: timestampToIso(data.created_at ?? data.updated_at)
    };
  }).sort(sortByCreatedDesc).slice(0, 50);
}

async function readFirestoreApplications(): Promise<StreamerApplication[]> {
  const db = getAdminDb();
  if (!db) return [];
  // Legacy application docs can miss updated_at, so avoid orderBy for now and keep the query lightweight with select().
  const snapshot = await db.collection("applications")
    .select(
      "name",
      "email",
      "youtube_url",
      "youtube_channel_id",
      "x_account",
      "categories",
      "tags",
      "one_liner",
      "stream_time",
      "desired_plan",
      "payment_status",
      "status",
      "admin_note",
      "created_at",
      "updated_at",
      "reviewed_at",
      "paid_at",
      "subscription_status",
      "stripe_subscription_id",
      "withdrawal_status",
      "withdrawal_requested_at",
      "streamer_id",
      "creator_login_id",
      "creator_password_hash",
      "claim_status",
      "claim_target_streamer_id",
      "claim_verification_code",
      "claim_x_account",
      "claim_requested_at",
      "claim_expires_at",
      "claim_verified_at",
    )
    .limit(160)
    .get();
  return snapshot.docs.map<StreamerApplication>((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      name: data.name || "",
      email: data.email || "",
      youtube_url: data.youtube_url || "",
      youtube_channel_id: data.youtube_channel_id,
      x_account: data.x_account || "",
      thumbnails: [],
      categories: Array.isArray(data.categories) ? data.categories : [],
      tags: Array.isArray(data.tags) ? data.tags : [],
      description: "",
      one_liner: data.one_liner || "",
      stream_time: data.stream_time,
      desired_plan: normalizePlan(data.desired_plan),
      payment_status: normalizePaymentStatus(data.payment_status, data.desired_plan, data.subscription_status, data.stripe_subscription_id),
      status: normalizeStatus(data.status),
      admin_note: data.admin_note,
      created_at: timestampToIso(data.created_at ?? data.updated_at),
      reviewed_at: typeof data.reviewed_at === "string" ? data.reviewed_at : data.reviewed_at?.toDate?.().toISOString(),
      paid_at: typeof data.paid_at === "string" ? data.paid_at : data.paid_at?.toDate?.().toISOString(),
      subscription_status: data.subscription_status,
      stripe_subscription_id: data.stripe_subscription_id,
      withdrawal_status: data.withdrawal_status === "requested" ? "requested" : "none",
      withdrawal_requested_at: timestampToIso(data.withdrawal_requested_at),
      streamer_id: data.streamer_id,
      creator_login_id: data.creator_login_id,
      creator_password_hash: data.creator_password_hash,
      claim_status: data.claim_status,
      claim_target_streamer_id: data.claim_target_streamer_id,
      claim_verification_code: data.claim_verification_code,
      claim_x_account: data.claim_x_account,
      claim_requested_at: timestampToIso(data.claim_requested_at),
      claim_expires_at: timestampToIso(data.claim_expires_at),
      claim_verified_at: timestampToIso(data.claim_verified_at),
    };
  }).sort(sortByCreatedDesc).slice(0, 80);
}

async function readAllFirestoreStreamers({ cursor, xFilter }: { cursor?: string; xFilter: "all" | "unintroduced" }): Promise<PagedResult<ReturnType<typeof normalizeStreamer>>> {
  const db = getAdminDb();
  if (!db) return { items: [] };
  let query = db.collection("streamers")
    .select(
      "name",
      "creator_email",
      "youtube_url",
      "youtube_channel_id",
      "archive_url",
      "x_account",
      "categories",
      "tags",
      "one_liner",
      "stream_time",
      "plan_type",
      "admin_placement",
      "is_initial_scout",
      "x_introduced_at",
      "is_dummy",
      "dummy_reason",
      "dummy",
      "test",
      "fictional",
      "isHidden",
      "is_visible",
      "withdrawal_status",
      "withdrawal_requested_at",
      "is_deleted",
      "deleted_at",
      "grant_source",
      "has_payment_history",
      "impressions",
      "weekly_impressions",
      "likes",
      "elite_boost_days",
      "super_boost_count",
      "super_boost_until",
      "super_boost_effect",
      "fcm_tokens",
      "notification_enabled",
      "last_creator_login_at",
      "creator_login_count",
      "registered_at",
      "registeredAt",
      "createdAt",
      "created_at",
      "updated_at",
      "source_application_id",
    )
    .limit(300);
  const snapshot = await query.get();
  const decodedCursor = decodeAdminCursor(cursor);
  const sorted = snapshot.docs
    .filter((doc) => doc.data().is_deleted !== true)
    .map((doc) => {
      const data = doc.data();
      const streamer = normalizeStreamer(doc.id, { ...data, thumbnails: [], description: "" });
      const documentCreatedAt = timestampToIso(doc.createTime ?? data.updated_at ?? doc.updateTime);
      return {
        ...streamer,
        created_at: streamer.created_at || documentCreatedAt,
        registered_at: streamer.registered_at || documentCreatedAt,
      };
    })
    .filter((streamer) => xFilter !== "unintroduced" || !streamer.x_introduced_at)
    .sort(sortStreamerAdminRows);
  const pageBase = decodedCursor ? sorted.filter((streamer) => isAfterAdminCursor(streamer, decodedCursor)) : sorted;
  const items = pageBase.slice(0, 100);
  const hasNext = pageBase.length > 100;
  // 有料/上位プランは全ページ横断で別途返す(クライアントの「有料登録のみ」
  // フィルタが2ページ目以降の有料配信者も絞り込めるようにするため)。
  const paidItems = sorted.filter((streamer) => streamer.plan_type === "paid" || streamer.plan_type === "boost");
  return { items, nextCursor: hasNext && items.length ? encodeAdminCursor(items[items.length - 1]) : undefined, totalCount: sorted.length, paidItems };
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

function sortByCreatedDesc<T extends { created_at?: string }>(a: T, b: T) {
  return safeTime(b.created_at) - safeTime(a.created_at);
}

function safeTime(value?: string) {
  if (!value) return 0;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

type AdminCursor = {
  time: number;
  id: string;
};

function sortStreamerAdminRows(
  a: ReturnType<typeof normalizeStreamer>,
  b: ReturnType<typeof normalizeStreamer>,
) {
  const timeDiff = safeTime(b.created_at) - safeTime(a.created_at);
  if (timeDiff !== 0) return timeDiff;
  return a.id.localeCompare(b.id);
}

function encodeAdminCursor(streamer: ReturnType<typeof normalizeStreamer>) {
  return `${safeTime(streamer.created_at)}:${streamer.id}`;
}

function decodeAdminCursor(value?: string): AdminCursor | null {
  if (!value) return null;
  const [timePart, ...idParts] = value.split(":");
  const time = Number(timePart);
  const id = idParts.join(":");
  if (!Number.isFinite(time)) return null;
  return { time, id };
}

function isAfterAdminCursor(streamer: ReturnType<typeof normalizeStreamer>, cursor: AdminCursor) {
  const time = safeTime(streamer.created_at);
  if (time < cursor.time) return true;
  if (time > cursor.time) return false;
  if (!cursor.id) return time < cursor.time;
  return streamer.id.localeCompare(cursor.id) > 0;
}

function sortViewerAdminRows(a: ViewerProfileWithStats, b: ViewerProfileWithStats) {
  const timeDiff = safeTime(b.created_at) - safeTime(a.created_at);
  if (timeDiff !== 0) return timeDiff;
  return a.id.localeCompare(b.id);
}

function encodeViewerAdminCursor(viewer: ViewerProfileWithStats) {
  return `${safeTime(viewer.created_at)}:${viewer.id}`;
}

function isViewerAfterAdminCursor(viewer: ViewerProfileWithStats, cursor: AdminCursor) {
  const time = safeTime(viewer.created_at);
  if (time < cursor.time) return true;
  if (time > cursor.time) return false;
  if (!cursor.id) return time < cursor.time;
  return viewer.id.localeCompare(cursor.id) > 0;
}

function recentDateIds(days: number) {
  const dates: string[] = [];
  for (let index = 0; index < days; index += 1) {
    const date = new Date(Date.now() - index * 24 * 60 * 60 * 1000);
    dates.push(date.toISOString().slice(0, 10));
  }
  return dates;
}

