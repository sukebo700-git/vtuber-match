import { HeaderAuthStatus } from "@/components/HeaderAuthStatus";
import { ViewerStreamerLikesList } from "@/components/ViewerStreamerLikesList";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "VTuberからのいいね",
  robots: { index: false, follow: false },
};

export default function ViewerLikesPage() {
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
        <ViewerStreamerLikesList />
      </main>
    </div>
  );
}
