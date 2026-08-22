import { HeaderAuthStatus } from "@/components/HeaderAuthStatus";
import { getTodaysPicks } from "@/lib/dailyPicks";
import { streamerImagePath } from "@/lib/streamers";
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

      <main className="main grid-page">
        <section className="status-band">
          <h1>本日のおすすめVTuber</h1>
          <p>今日はこの10人をピックアップしました。日付が変わると入れ替わります。</p>
        </section>

        {todaysPicks.length > 0 ? (
          <section className="status-band">
            <div className="daily-picks-grid">
              {todaysPicks.map((streamer) => (
                <a className="daily-pick-card" href={`/detail/${streamer.id}`} key={streamer.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={streamerImagePath(streamer)} alt={streamer.name} className="daily-pick-thumb" />
                  <span className="daily-pick-name">{streamer.name}</span>
                </a>
              ))}
            </div>
          </section>
        ) : (
          <section className="status-band">
            <p>本日のおすすめを準備中です。</p>
          </section>
        )}

        <section className="status-band">
          <p className="inline-actions">
            <a className="primary-button" href="/swipe">もっと探す</a>
          </p>
        </section>
      </main>
    </div>
  );
}
