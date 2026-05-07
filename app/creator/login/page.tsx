import { HeaderAuthStatus } from "@/components/HeaderAuthStatus";
import { AuthVisibility } from "@/components/AuthVisibility";
import { CreatorLoginForm } from "@/components/CreatorLoginForm";

export default function CreatorLoginPage() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">Vtuberマッチ</a>
        <nav className="nav" aria-label="メイン">
          <a href="/creator">配信者用</a>
          <a href="/terms">ヘルプ</a>
        </nav>
        <HeaderAuthStatus />
      </header>
      <main className="main grid-page">
        <AuthVisibility
          role="creator"
          mode="logged-out"
          fallback={
            <section className="status-band">
              <h2>配信者としてログイン中です</h2>
              <p>ログイン画面は未ログインの方だけに表示されます。掲載内容の変更やアップグレードへ進めます。</p>
              <p style={{ marginTop: 12 }}>
                <a className="primary-button" href="/creator">配信者用ページへ</a>
              </p>
            </section>
          }
        >
          <section className="status-band">
            <h2>配信者ログイン</h2>
            <p>申し込み時のメールアドレスとパスワードでログインできます。</p>
          </section>
          <CreatorLoginForm />
        </AuthVisibility>
      </main>
    </div>
  );
}
