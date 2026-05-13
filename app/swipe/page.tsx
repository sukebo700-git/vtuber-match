import { HeaderAuthStatus } from "@/components/HeaderAuthStatus";
import { SwipeClient } from "@/components/SwipeClient";
import { getStreamersForSwipe } from "@/lib/streamers";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Vtuberをスワイプで探す",
  description: "登録なしでVtuberをスワイプ。気になる配信者を直感で見つけてYouTubeチャンネルへ移動できます。",
  alternates: {
    canonical: "/swipe",
  },
};

export default async function SwipePage() {
  const streamers = await getStreamersForSwipe();

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
      <main className="main">
        <SwipeClient initialStreamers={streamers} />
      </main>
    </div>
  );
}
