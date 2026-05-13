import { HeaderAuthStatus } from "@/components/HeaderAuthStatus";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "登録無料で推しVtuberを探せるスワイプ型マッチング",
  description: "Vtuberマッチは、気になるVtuberを直感で見つけられる登録無料のスワイプ型マッチングサービスです。",
  alternates: {
    canonical: "/",
  },
};

export default function HomePage() {
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
      <main className="main landing-main">
        <section className="landing-hero">
          <div className="landing-copy">
            <span className="landing-free-label">登録無料</span>
            <h1>気になるVtuberを、直感で見つける。</h1>
            <div className="landing-actions">
              <a className="primary-button" href="/swipe">スワイプを始める</a>
              <a className="secondary-button" href="/signup">掲載・登録する</a>
            </div>
          </div>

          <div className="landing-phone" aria-hidden="true">
            <div className="landing-card">
              <span className="landing-live">LIVE</span>
              <img className="landing-oshi-image" src="/promo/landing-oshi.png" alt="" />
              <h2>今日の推し候補</h2>
              <p>雑談 / 歌 / ゲーム</p>
              <div className="landing-swipe-row">
                <span>×</span>
                <span>♥</span>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
