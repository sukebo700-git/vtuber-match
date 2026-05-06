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
          <p>掲載済みの配信者IDを指定して、有料掲載またはさらに上位表示へ変更できます。</p>
        </section>
        <form className="form checkout-form" action="/checkout">
          <div className="field">
            <label htmlFor="streamer_id">配信者ID</label>
            <input id="streamer_id" name="streamer_id" required placeholder="管理画面の掲載中一覧で確認できます" />
          </div>
          <div className="field">
            <label htmlFor="plan">変更先プラン</label>
            <select id="plan" name="plan" defaultValue="paid">
              <option value="paid">有料掲載 500円</option>
              <option value="boost">さらに上位表示 980円</option>
            </select>
          </div>
          <button className="primary-button" type="submit">決済へ進む</button>
        </form>
      </main>
    </div>
  );
}
