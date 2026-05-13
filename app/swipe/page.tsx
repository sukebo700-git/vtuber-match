import { HeaderAuthStatus } from "@/components/HeaderAuthStatus";
import { SwipeClient } from "@/components/SwipeClient";
import { getStreamersForSwipe } from "@/lib/streamers";

export const dynamic = "force-dynamic";

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
