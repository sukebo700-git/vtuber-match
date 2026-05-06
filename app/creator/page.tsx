export const dynamic = "force-dynamic";

export default function CreatorPage() {
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
          <h2>配信者用ページ</h2>
          <p>掲載申込、プロフィール修正申請、有料掲載へのアップグレードをここから行えます。</p>
        </section>

        <section className="creator-action-grid">
          <a className="creator-action-card" href="/apply">
            <strong>申し込み</strong>
            <span>無料掲載は申し込み後すぐに掲載されます。有料掲載は決済後に掲載されます。</span>
          </a>
          <a className="creator-action-card" href="/creator/edit">
            <strong>修正申請</strong>
            <span>掲載中の名前、画像、自己アピール、カテゴリ、タグの変更を申請できます。</span>
          </a>
          <a className="creator-action-card" href="/creator/upgrade">
            <strong>アップグレード</strong>
            <span>無料掲載から有料掲載、さらに上位表示へ変更できます。</span>
          </a>
        </section>

        <section className="status-band">
          <h2>無料掲載からアップグレード</h2>
          <p>無料掲載ではカテゴリ1件、タグ1件のみです。有料掲載にすると公式バッジが付き、カテゴリは最大3件、タグは最大5件まで選択できます。</p>
        </section>
      </main>
    </div>
  );
}
