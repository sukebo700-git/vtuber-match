import { HeaderAuthStatus } from "@/components/HeaderAuthStatus";
import { SwipeClient } from "@/components/SwipeClient";
import { getTodaysPicks } from "@/lib/dailyPicks";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "本日のおすすめVTuber",
  description: "今日はこの10人をピックアップ。日付が変わると入れ替わります。",
  alternates: {
    canonical: "/recommended",
  },
};

export default async function RecommendedPage() {
  const todaysPicks = await getTodaysPicks();
  const today = new Date().toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "long",
    day: "numeric",
    weekday: "short",
  });

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">VtuberMatch</a>
        <nav className="nav" aria-label="メイン">
          <a href="/swipe">VTuberを探す</a>
          <a href="/viewer">視聴者用</a>
          <a href="/help">ヘルプ</a>
        </nav>
        <HeaderAuthStatus />
      </header>

      <main className="main swipe-page-main">
        <section className="status-band recommended-hero">
          <p className="recommended-hero-kicker">{today}のピックアップ</p>
          <h2>本日のおすすめVTuber10人</h2>
          <p>今日はこの10人だけ。日付が変わると入れ替わります。</p>
        </section>
        <SwipeClient
          initialStreamers={todaysPicks}
          minimal
          redirectOnComplete="/swipe"
        />
      </main>
    </div>
  );
}
