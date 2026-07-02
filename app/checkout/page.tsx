import { HeaderAuthStatus } from "@/components/HeaderAuthStatus";
import { notFound } from "next/navigation";
import { CheckoutForm } from "@/components/CheckoutForm";
import { getPlanAmount } from "@/lib/billing";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { findLocalApplication } from "@/lib/localStore";
import type { ApplicationStatus, PlanType, StreamerApplication } from "@/lib/types";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "決済",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage({ searchParams }: { searchParams: { application_id?: string; streamer_id?: string; viewer_id?: string; plan?: string } }) {
  const applicationId = searchParams.application_id;
  const streamerId = searchParams.streamer_id;
  const viewerId = searchParams.viewer_id;
  const upgradePlan = searchParams.plan;

  const application = applicationId ? await getApplication(applicationId) : null;
  if (applicationId && (!application || application.desired_plan === "free")) notFound();
  if (!applicationId && !viewerId && (!streamerId || (upgradePlan !== "paid" && upgradePlan !== "boost"))) notFound();
  if (viewerId) notFound();

  const planType = application ? application.desired_plan as Exclude<PlanType, "free"> : upgradePlan as "paid" | "boost";

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">Vtuberマッチ</a>
        <nav className="nav" aria-label="メイン">
          <a href="/creator">配信者用</a>
          <a href="/diagnosis">タイプ診断</a>
          <a href="https://www.youtube.com/@VtuberMatch" target="_blank" rel="noreferrer">公式YouTube</a>
          <a href="/help">ヘルプ</a>
        </nav>
        <HeaderAuthStatus />
      </header>
      <main className="main grid-page">
        <section className="status-band">
          <h2>掲載プランの決済</h2>
          <p>決済完了後、運営確認へ進みます。カード情報はVtuberマッチでは保存されません。</p>
        </section>
        <CheckoutForm
          applicationId={application?.id}
          streamerId={streamerId}
          viewerId={viewerId}
          planType={planType}
          amount={getPlanAmount(planType)}
          email={application?.email || ""}
          name={application?.name || "掲載プランのアップグレード"}
        />
      </main>
    </div>
  );
}

async function getApplication(id: string): Promise<StreamerApplication | null> {
  const db = getAdminDb();
  if (!db) return findLocalApplication(id);

  const doc = await db.collection("applications").doc(id).get();
  if (!doc.exists) return null;
  const data = doc.data() || {};
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
    payment_status: normalizePaymentStatus(data.payment_status),
    status: normalizeStatus(data.status),
    admin_note: data.admin_note
  };
}

function normalizePlan(plan: string): PlanType {
  if (plan === "paid" || plan === "boost") return plan;
  return "free";
}

function normalizePaymentStatus(status: string): StreamerApplication["payment_status"] {
  if (status === "paid" || status === "pending") return status;
  return "not_required";
}

function normalizeStatus(status: string): ApplicationStatus {
  if (status === "approved" || status === "rejected") return status;
  return "pending";
}
