import { HeaderAuthStatus } from "@/components/HeaderAuthStatus";
import { LandingRandomVtuberImage } from "@/components/LandingRandomVtuberImage";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "登録無料で推しVtuberを探せるスワイプ型マッチング",
  description: "VtuberMatchは、スワイプで推しVtuberを探せる視聴者向け体験と、紹介ショート動画・24時間Lo-Fi配信で配信者を宣伝する掲載サービスです。",
  alternates: {
    canonical: "/",
  },
};

export default function HomePage() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">
          <span className="brand-mark" />
          VtuberMatch
        </a>
        <nav className="nav" aria-label="メイン">
          <a href="/swipe">スワイプ</a>
          <a href="/diagnosis">診断</a>
          <a href="/viewer">視聴者用</a>
          <a href="/creator">配信者用</a>
          <a href="https://www.youtube.com/@VtuberMatch" target="_blank" rel="noreferrer">公式YouTube</a>
          <a href="/help">ヘルプ</a>
        </nav>
        <HeaderAuthStatus />
      </header>

      <main className="main landing-main">
        <section className="landing-hero">
          <div className="landing-copy">
            <div className="landing-logo">
              <span className="landing-logo-mark">VT</span>
              <span>
                <strong>VtuberMatch</strong>
                <small>スワイプ + 診断 + Lo-Fi紹介配信</small>
              </span>
            </div>
            <span className="landing-free-label">登録無料 / 紹介ショート動画制作無料</span>
            <div className="landing-milestone" aria-label="登録者200人突破">
              <span>登録者数</span>
              <strong>200人突破</strong>
            </div>
            <h1>診断で見つけて、スワイプで推せる。</h1>
            <p>
              視聴者は無料プロフィール登録だけで、診断・スワイプ・通常いいね・スーパーいいねを使えます。
              配信者は無料掲載から始められて、24時間Lo-Fi配信や公式YouTubeの紹介ショート動画で見つけてもらう機会を増やせます。
            </p>
            <div className="landing-actions">
              <a className="primary-button" href="/swipe">スワイプを始める</a>
              <a className="secondary-button" href="/diagnosis">診断を始める</a>
              <a className="secondary-button" href="/creator/apply">無料で掲載する</a>
              <a className="secondary-button" href="https://www.youtube.com/@VtuberMatch" target="_blank" rel="noreferrer">Lo-Fi配信を見る</a>
            </div>
            <div className="landing-promo-row">
              <a className="landing-campaign-banner" href="/creator/apply">
                <span>Creator</span>
                <strong>無料掲載 + 紹介ショート動画制作無料</strong>
              </a>
              <div className="landing-diagnosis-card" id="diagnosis-menu">
                <span>Diagnosis</span>
                <strong>あなたに合う推しタイプを診断</strong>
                <div>
                  <a href="/diagnosis/viewer">視聴者診断</a>
                  <a href="/diagnosis">Vtuber診断</a>
                  <a href="/diagnosis/advanced">100問診断</a>
                </div>
              </div>
              <div className="landing-diagnosis-card">
                <span>Viewer</span>
                <strong>視聴者プロフィールは無料登録で利用OK</strong>
                <div>
                  <a href="/viewer/register">無料登録</a>
                  <a href="/viewer">視聴者ページ</a>
                </div>
              </div>
              <div className="landing-diagnosis-card">
                <span>Lo-Fi Live</span>
                <strong>24時間Lo-Fi配信でVtuberを紹介</strong>
                <div>
                  <a href="/creator">特典を見る</a>
                  <a href="https://www.youtube.com/@VtuberMatch" target="_blank" rel="noreferrer">公式YouTube</a>
                </div>
              </div>
            </div>
          </div>

          <div className="landing-visual" aria-label="Vtuberカードのプレビュー">
            <div className="landing-phone">
              <div className="landing-card">
                <div className="landing-card-top">
                  <span className="landing-live">LIVE</span>
                  <span className="landing-live">おすすめ</span>
                </div>
                <LandingRandomVtuberImage />
                <p>スワイプ / Lo-Fi紹介 / ショート動画</p>
                <div className="landing-card-tags">
                  <span>200人突破</span>
                  <span>診断</span>
                  <span>24時間配信</span>
                  <span>公式YouTube</span>
                  <span>無料掲載</span>
                </div>
                <div className="landing-swipe-row" aria-hidden="true">
                  <span>×</span>
                  <span>INFO</span>
                  <span>♥</span>
                </div>
              </div>
            </div>
            <p className="landing-visual-copy">
              写真・ひとこと・配信URLから、気になるVtuberをすぐ確認。診断結果から戻って推し探しを続けられます。
            </p>
            <div className="landing-audience-row">
              <span>視聴者: 無料登録でプロフィール、通常いいね、スーパーいいね履歴を使えます</span>
              <span>配信者: 無料掲載、ショート動画制作、24時間Lo-Fi配信特典があります</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
