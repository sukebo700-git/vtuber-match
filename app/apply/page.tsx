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
            <h1>VTuberとして掲載を申し込む</h1>
            <p>
              無料プランは申し込み後すぐ掲載できます。画像、名前、配信サイトURL、自己アピール、カテゴリ、タグを登録できます。
              ベーシックプランとプレミアムプランは決済完了後に反映され、上位表示やLo-Fi配信での紹介特典が強化されます。
            </p>
            <ul className="feature-list">
              <li>無料プラン: 紹介ショート動画制作無料</li>
              <li>ベーシックプラン: ショート動画制作無料 + 24時間Lo-Fi配信での宣伝無料</li>
              <li>プレミアムプラン: 夕方から深夜の時間帯を優先して紹介</li>
            </ul>
          </section>
          <ApplicationForm categories={CATEGORIES} tags={TAGS} />
        </AuthVisibility>
      </main>
    </div>
  );
}
