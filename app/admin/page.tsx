import { AdminDashboard } from "@/components/AdminDashboard";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { readAllLocalStreamers, readLocalApplications } from "@/lib/localStore";
import { normalizeStreamer } from "@/lib/streamers";
import { notFound } from "next/navigation";
import type { ApplicationStatus, PlanType, StreamerApplication } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminPage({ searchParams }: { searchParams: { key?: string } }) {
  const adminKey = process.env.ADMIN_ACCESS_KEY || "kiya0110";
  if (searchParams.key !== adminKey) notFound();

  const db = getAdminDb();
  const applications = db ? await readFirestoreApplications() : await readLocalApplications();
  const streamers = db ? await readAllFirestoreStreamers() : await readAllLocalStreamers();

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">Vtuberマッチ</a>
        <nav className="nav" aria-label="メイン">
          <a href="/creator">配信者用</a>
          <a href="/terms">ヘルプ</a>
        </nav>
      </header>
      <main className="main grid-page">
        <AdminDashboard initialApplications={applications} initialStreamers={streamers} adminKey={adminKey} />
      </main>
    </div>
  );
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
      payment_status: normalizePaymentStatus(data.payment_status, data.desired_plan),
      status: normalizeStatus(data.status),
      admin_note: data.admin_note,
      created_at: typeof data.created_at === "string" ? data.created_at : data.created_at?.toDate?.().toISOString(),
      reviewed_at: typeof data.reviewed_at === "string" ? data.reviewed_at : data.reviewed_at?.toDate?.().toISOString(),
      paid_at: typeof data.paid_at === "string" ? data.paid_at : data.paid_at?.toDate?.().toISOString()
    };
  });
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

function normalizePaymentStatus(status: string, plan: string): StreamerApplication["payment_status"] {
  if (status === "paid" || status === "pending" || status === "not_required") return status;
  return plan === "free" ? "not_required" : "pending";
}

async function readAllFirestoreStreamers() {
  const db = getAdminDb();
  if (!db) return [];
  const snapshot = await db.collection("streamers").limit(120).get();
  return snapshot.docs.map((doc) => normalizeStreamer(doc.id, doc.data()));
}
