import { HeaderAuthStatus } from "@/components/HeaderAuthStatus";
import { AdminAnalyticsDashboard } from "@/components/AdminAnalyticsDashboard";
import { adminCookieName, verifyAdminSession } from "@/lib/adminSession";
import { readVisitAnalyticsDetail } from "@/lib/adminAnalyticsData";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "訪問者分析",
  robots: { index: false, follow: false },
};

export default async function AdminAnalyticsPage() {
  const hasCookie = verifyAdminSession(cookies().get(adminCookieName)?.value);
  if (!hasCookie) notFound();
  const data = await readVisitAnalyticsDetail();

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">Vtuberマッチ</a>
        <nav className="nav" aria-label="メイン">
          <a href="/admin">管理画面</a>
          <a href="/viewer">視聴者用</a>
          <a href="/creator">配信者用</a>
          <a href="/diagnosis">タイプ診断</a>
          <a href="https://www.youtube.com/@VtuberMatch" target="_blank" rel="noreferrer">公式YouTube</a>
          <a href="/help">ヘルプ</a>
        </nav>
        <HeaderAuthStatus />
      </header>
      <main className="main admin-main grid-page">
        <AdminAnalyticsDashboard data={data} />
      </main>
    </div>
  );
}
