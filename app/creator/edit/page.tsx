import { HeaderAuthStatus } from "@/components/HeaderAuthStatus";
import { AuthVisibility } from "@/components/AuthVisibility";
import { CreatorProfileEditForm } from "@/components/CreatorProfileEditForm";

export const dynamic = "force-dynamic";

export default function CreatorEditPage() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">Vtuberマッチ</a>
        <nav className="nav" aria-label="メイン">
          <a href="/viewer">視聴者用</a>
          <a href="/creator">配信者用</a>
          <a href="/terms">ヘルプ</a>
        </nav>
        <HeaderAuthStatus />
      </header>
      <main className="main grid-page">
        <AuthVisibility
          role="creator"
          mode="logged-in"
          fallback={
            <section className="status-band">
              <h2>ログインが必要です</h2>
              <p>配信者プロフィールの修正は、本人確認のためログイン中のみ利用できます。</p>
              <p style={{ marginTop: 12 }}>
                <a className="primary-button" href="/creator/login">配信者ログインへ</a>
              </p>
            </section>
          }
        >
          <section className="status-band">
            <h2>プロフィール修正</h2>
            <p>掲載中の名前、画像、自己アピール、カテゴリ、タグなどを変更できます。送信後、管理者確認なしで掲載プロフィールへ反映されます。</p>
          </section>
          <CreatorProfileEditForm />
        </AuthVisibility>
      </main>
    </div>
  );
}
