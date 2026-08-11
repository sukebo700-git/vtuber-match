import { HeaderAuthStatus } from "@/components/HeaderAuthStatus";
import { PasswordResetConfirmForm } from "@/components/PasswordResetConfirmForm";

export default function PasswordResetConfirmPage({ searchParams }: { searchParams?: { id?: string; token?: string } }) {
  const requestId = searchParams?.id || "";
  const token = searchParams?.token || "";

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">Vtuberマッチ</a>
        <nav className="nav" aria-label="メイン">
          <a href="/creator">配信者用</a>
          <a href="/viewer">視聴者用</a>
          <a href="/diagnosis">タイプ診断</a>
          <a href="https://www.youtube.com/@VtuberMatch" target="_blank" rel="noreferrer">公式YouTube</a>
          <a href="/help">ヘルプ</a>
        </nav>
        <HeaderAuthStatus />
      </header>
      <main className="main grid-page">
        <section className="status-band">
          <h2>新しいパスワードの設定</h2>
          <p>メールに記載のリンクからアクセスしています。新しいパスワードを入力してください(有効期限は申請から1時間です)。</p>
        </section>
        <PasswordResetConfirmForm requestId={requestId} token={token} />
      </main>
    </div>
  );
}
