import { CreatorLoginForm } from "@/components/CreatorLoginForm";

export default function CreatorLoginPage() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">Vtuberマッチ</a>
        <nav className="nav" aria-label="メイン">
          <a href="/creator">配信者用</a>
          <a href="/terms">ヘルプ・利用規約</a>
        </nav>
      </header>
      <main className="main grid-page">
        <section className="status-band">
          <h2>配信者ログイン</h2>
          <p>申し込み時のメールアドレスとパスワードでログインできます。管理IDは運営確認用として保存され、ログインには使いません。</p>
        </section>
        <CreatorLoginForm />
      </main>
    </div>
  );
}
