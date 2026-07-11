import { HeaderAuthStatus } from "@/components/HeaderAuthStatus";
import { AuthVisibility } from "@/components/AuthVisibility";
import { ApplicationForm } from "@/components/ApplicationForm";
import { CATEGORIES, TAGS } from "@/lib/constants";

export default function ApplyPage() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">VtuberMatch</a>
        <nav className="nav" aria-label="メイン">
          <a href="/viewer">視聴者用</a>
          <a href="/creator">配信者用</a>
          <a href="/diagnosis">タイプ診断</a>
          <a href="https://www.youtube.com/@VtuberMatch" target="_blank" rel="noreferrer">公式YouTube</a>
          <a href="/help">ヘルプ</a>
        </nav>
        <HeaderAuthStatus />
      </header>

      <main className="main grid-page">
        <AuthVisibility
          role="creator"
          mode="logged-out"
          fallback={
            <section className="status-band">
              <h2>すでに配信者としてログイン中です</h2>
              <p>掲載内容の変更は、プロフィール修正画面から行えます。</p>
              <p style={{ marginTop: 12 }}>
                <a className="primary-button" href="/creator/edit">プロフィールを修正する</a>
              </p>
            </section>
          }
        >
          <section className="status-band">
            <h1>Lo-Fi配信とショート動画で、あなたを宣伝します</h1>
            <p>
              無料プランに申し込むと、次の3つをまとめて利用できます。むずかしい手続きはなく、申し込み後すぐに掲載が始まります。
            </p>
            <ul className="feature-list">
              <li>Lo-Fi 24時間配信への掲載(20秒CMとして紹介)</li>
              <li>紹介ショート動画での宣伝(YouTube Shortsに無料掲載)</li>
              <li>あなた専用の無料掲載ページを作成</li>
            </ul>
            <p>
              ベーシックプラン・プレミアムプランでは、1〜3分のCM配信、ナレーション付きShorts、優先表示などで宣伝効果がさらに広がります。
            </p>
          </section>
          <ApplicationForm categories={CATEGORIES} tags={TAGS} />
        </AuthVisibility>
      </main>
    </div>
  );
}
