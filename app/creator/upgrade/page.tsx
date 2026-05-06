import { CreatorUpgradeForm } from "@/components/CreatorUpgradeForm";

export const dynamic = "force-dynamic";

export default function CreatorUpgradePage() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">Vtuberマッチ</a>
        <nav className="nav" aria-label="メイン">
          <a href="/viewer">視聴者用</a>
          <a href="/creator">配信者用</a>
          <a href="/terms">ヘルプ</a>
        </nav>
      </header>
      <main className="main grid-page">
        <section className="status-band">
          <h2>アップグレード</h2>
          <p>申し込み時のメールアドレスとパスワードで本人確認し、有料掲載またはさらに上位表示へ変更できます。</p>
        </section>
        <CreatorUpgradeForm />
      </main>
    </div>
  );
}
