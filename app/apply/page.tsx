import { HeaderAuthStatus } from "@/components/HeaderAuthStatus";
import { AuthVisibility } from "@/components/AuthVisibility";
import { ApplicationForm } from "@/components/ApplicationForm";
import { CATEGORIES, TAGS } from "@/lib/constants";

export default function ApplyPage() {
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
      <main className="main grid-page">
        <AuthVisibility
          role="creator"
          mode="logged-out"
          fallback={
            <section className="status-band">
              <h2>すでに配信者としてログイン中です</h2>
              <p>申し込み画面は未ログインの方だけに表示されます。掲載内容の変更はプロフィール修正から行えます。</p>
              <p style={{ marginTop: 12 }}>
                <a className="primary-button" href="/creator/edit">プロフィールを修正する</a>
              </p>
            </section>
          }
        >
          <section className="status-band">
            <h2>掲載を申し込む</h2>
            <p>プロフィール画像、自己アピール、カテゴリ、タグを登録できます。無料プランは申し込み後すぐ掲載され、ベーシックプランとプレミアムプランは決済完了後に反映されます。</p>
          </section>
          <ApplicationForm categories={CATEGORIES} tags={TAGS} />
        </AuthVisibility>
      </main>
    </div>
  );
}
