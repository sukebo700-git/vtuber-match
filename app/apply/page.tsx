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
          <section className="status-band apply-plan-comparison">
            <h1 style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" }}>
              Lo-Fi配信とショート動画で、あなたを宣伝します
            </h1>
            <picture>
              <source srcSet="/promo/plan-comparison/plan-comparison.webp" type="image/webp" />
              <img
                src="/promo/plan-comparison/plan-comparison.png"
                alt="プランの違い: 無料プランはLo-Fi 24時間配信への掲載・YouTube Shortsでの宣伝・VtuberMatch宣伝ページ掲載がまとめて0円。ベーシックプラン月額500円は写真3枚・Xアカウント表示・カテゴリタグ設定・紹介動画で上位表示。プレミアムプラン月額980円は写真5枚・常時優先表示・プレミアムフレームで宣伝効果を最大化。"
                loading="eager"
              />
            </picture>
          </section>
          <ApplicationForm categories={CATEGORIES} tags={TAGS} />
        </AuthVisibility>
      </main>
    </div>
  );
}
