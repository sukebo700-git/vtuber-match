import { HeaderAuthStatus } from "@/components/HeaderAuthStatus";
import { PasswordResetRequestForm } from "@/components/PasswordResetRequestForm";

export default function PasswordResetPage({ searchParams }: { searchParams?: { type?: string } }) {
  const defaultType = searchParams?.type === "viewer" ? "viewer" : "creator";

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">Vtuberマッチ</a>
        <nav className="nav" aria-label="メイン">
          <a href="/creator">配信者用</a>
          <a href="/viewer">視聴者用</a>
          <a href="/terms">ヘルプ</a>
        </nav>
        <HeaderAuthStatus />
      </header>
      <main className="main grid-page">
        <section className="status-band">
          <h2>パスワード再設定申請</h2>
          <p>登録メールアドレスと名前を入力してください。運営が本人確認を行い、通常3日以内に新しいパスワードを手動で案内します。</p>
        </section>
        <PasswordResetRequestForm defaultType={defaultType} />
      </main>
    </div>
  );
}
