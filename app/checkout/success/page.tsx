export default function CheckoutSuccessPage() {
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
          <h2>決済を受け付けました</h2>
          <p>決済確認後、管理画面の申込データに反映されます。掲載は運営確認後に開始されます。</p>
          <a className="primary-button" href="/">トップへ戻る</a>
        </section>
      </main>
    </div>
  );
}
