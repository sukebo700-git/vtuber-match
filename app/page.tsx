import { SwipeClient } from "@/components/SwipeClient";
import { getStreamersForSwipe } from "@/lib/streamers";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const streamers = await getStreamersForSwipe();

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
      <main className="main">
        <SwipeClient initialStreamers={streamers} />
      </main>
    </div>
  );
}
