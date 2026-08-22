import { HeaderAuthStatus } from "@/components/HeaderAuthStatus";
import { CreatorViewerLikesList } from "@/components/CreatorViewerLikesList";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "気になるリスナー",
  robots: { index: false, follow: false },
};

export default function CreatorViewerLikesPage() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">VtuberMatch</a>
        <nav className="nav" aria-label="メイン">
          <a href="/creator">配信者用</a>
          <a href="/help">ヘルプ</a>
        </nav>
        <HeaderAuthStatus />
      </header>

      <main className="main grid-page">
        <CreatorViewerLikesList />
      </main>
    </div>
  );
}
