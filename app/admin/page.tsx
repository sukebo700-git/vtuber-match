import { AdminDashboard } from "@/components/AdminDashboard";
import { ReportAdminPanel } from "@/components/ReportAdminPanel";
import { ViewerAdminPanel } from "@/components/ViewerAdminPanel";
import { adminCookieName, verifyAdminSession } from "@/lib/adminSession";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { readAllLocalStreamers, readLocalApplications, readLocalReports, readLocalViewerProfilesWithStats } from "@/lib/localStore";
import { normalizeStreamer } from "@/lib/streamers";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import type { ApplicationStatus, PlanType, StreamerApplication, StreamerProfileEdit, ViewerProfile, ViewerProfileWithStats, StreamerReport } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const hasCookie = verifyAdminSession(cookies().get(adminCookieName)?.value);
  if (!hasCookie) notFound();

  const db = getAdminDb();
  const applications = db ? await readFirestoreApplications() : await readLocalApplications();
  const streamers = db ? await readAllFirestoreStreamers() : await readAllLocalStreamers();
  const profileEdits = db ? await readFirestoreProfileEdits() : [];
  const viewers = db ? await readFirestoreViewerProfiles() : await readLocalViewerProfilesWithStats();
  const reports = db ? await readFirestoreReports() : await readLocalReports();

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">Vtuberマッチ</a>
        <nav className="nav" aria-label="メイン">
          <a href="/viewer">視聴者用</a>
          <a href="/creator">配信者用</a>
          <a href="/terms">ヘルプ</a>
        </nav>
      </header>
      <main className="main grid-page">
        <ReportAdminPanel reports={reports} />
        <ViewerAdminPanel viewers={viewers} />

        <section className="status-band">
          <h2>プロフィール修正申請</h2>
          <p>配信者用画面から届いた修正申請です。メール、YouTube URL、画像、自己アピール、カテゴリ、タグを確認できます。</p>
        </section>
        <section className="admin-list wide-list">
          {profileEdits.length ? profileEdits.map((edit) => (
            <article className="admin-card" key={edit.id}>
              <div className="admin-card-head">
                <h3>{edit.name || "名前未入力"}</h3>
                <span className={`state ${edit.status === "reviewed" ? "approved" : "pending"}`}>{edit.status === "reviewed" ? "確認済み" : "未確認"}</span>
              </div>
              <dl className="data-list">
                <div><dt>申請ID</dt><dd>{edit.id}</dd></div>
                <div><dt>登録メール</dt><dd>{edit.email}</dd></div>
                <div><dt>YouTube URL</dt><dd>{edit.youtube_url}</dd></div>
                <div><dt>一言</dt><dd>{edit.one_liner || "未入力"}</dd></div>
                <div><dt>自己アピール</dt><dd>{edit.description || "未入力"}</dd></div>
                <div><dt>配信時間帯</dt><dd>{edit.stream_time || "未入力"}</dd></div>
                <div><dt>カテゴリ</dt><dd>{edit.categories?.join(" / ") || "未選択"}</dd></div>
                <div><dt>タグ</dt><dd>{edit.tags?.map((tag) => `#${tag}`).join(" ") || "未選択"}</dd></div>
                <div><dt>申請日</dt><dd>{formatDate(edit.created_at)}</dd></div>
              </dl>
              {edit.image && (
                <div className="image-preview-row">
                  <img src={edit.image} alt="修正申請画像" />
                </div>
              )}
            </article>
          )) : (
            <article className="admin-card">
              <h3>現在の修正申請はありません</h3>
              <p>配信者から申請が届くとここに表示されます。</p>
            </article>
          )}
        </section>

        <AdminDashboard initialApplications={applications} initialStreamers={streamers} adminKey="" />
      </main>
    </div>
  );
}

async function readFirestoreReports(): Promise<StreamerReport[]> {
  const db = getAdminDb();
  if (!db) return [];
  const snapshot = await db.collection("reports").orderBy("created_at", "desc").limit(120).get();
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      streamer_id: data.streamer_id || "",
      streamer_name: data.streamer_name || "",
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
  const [profileSnapshot, likeSnapshot] = await Promise.all([
    db.collection("viewer_profiles").limit(120).get(),
    db.collection("likes").limit(1000).get()
  ]);

  const counts = new Map<string, number>();
  likeSnapshot.docs.forEach((doc) => {
    const data = doc.data();
    const id = String(data.viewer_profile_id || data.viewer_profile?.id || "");
    if (!id) return;
    counts.set(id, (counts.get(id) || 0) + 1);
  });

  return profileSnapshot.docs.map((doc) => {
    const data = doc.data() as ViewerProfile;
    const matchCount = counts.get(doc.id) || data.match_count || 0;
    return {
      id: doc.id,
      display_name: data.display_name || "",
      youtube_display_name: data.youtube_display_name || "",
      image: data.image || "",
      profile: data.profile || "",
      favorite_categories: Array.isArray(data.favorite_categories) ? data.favorite_categories : [],
      visible_to_matched_streamers: data.visible_to_matched_streamers !== false,
      updated_at: timestampToIso(data.updated_at),
      match_count: matchCount,
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
      stripe_subscription_id: data.stripe_subscription_id
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
