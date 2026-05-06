export const dynamic = "force-dynamic";

export default function CreatorPage() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">Vtuberマッチ</a>
        <nav className="nav" aria-label="メイン">
          <a href="/creator">配信者用</a>
          <a href="/terms">ヘルプ</a>
        </nav>
      </header>
      <main className="main grid-page">
        <section className="status-band">
          <h2>配信者用ページ</h2>
          <p>新しい視聴者に見つけてもらうための掲載申込はこちらから行えます。</p>
          <p style={{ marginTop: 12 }}>
            <a className="primary-button" href="/apply">掲載を申し込む</a>
          </p>
        </section>
        <section className="status-band">
          <h2>無料掲載からアップグレード</h2>
          <p>無料掲載ではカテゴリ1件、タグ1件のみです。有料掲載にすると公式バッジが付き、カテゴリは最大3件、タグは最大5件まで選択できます。</p>
        </section>
      </main>
    </div>
  );
}
