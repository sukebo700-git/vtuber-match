import { HeaderAuthStatus } from "@/components/HeaderAuthStatus";
import { ShortVideoRequestForm } from "@/components/ShortVideoRequestForm";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "紹介ショート動画の依頼 | VtuberMatch",
  description: "VtuberMatch公式YouTubeチャンネルで公開する紹介ショート動画を、掲載中のVTuberが無料で依頼できます。",
  alternates: {
    canonical: "/creator/short-video",
  },
};

export default function CreatorShortVideoPage() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">VtuberMatch</a>
        <nav className="nav" aria-label="メイン">
          <a href="/swipe">探す</a>
          <a href="/creator">VTuber向け</a>
          <a href="https://www.youtube.com/@VtuberMatch" target="_blank" rel="noreferrer">公式YouTube</a>
          <a href="/help">ヘルプ</a>
        </nav>
        <HeaderAuthStatus />
      </header>

      <main className="main grid-page creator-page-main">
        <section className="status-band creator-hero-panel">
          <span className="creator-page-kicker">For VTubers</span>
          <h1>紹介ショート動画を無料で作成します</h1>
          <p>
            VtuberMatch公式YouTubeチャンネルで、あなたの活動を紹介するショート動画を公開します。
            掲載プロフィールの情報を使うので、紹介してほしい内容を書いて送るだけで依頼できます(AIが自然な紹介文に整えます)。
          </p>
        </section>

        <ShortVideoRequestForm />
      </main>
    </div>
  );
}
