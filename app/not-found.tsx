import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ページが見つかりません",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">VtuberMatch</a>
        <nav className="nav" aria-label="メイン">
          <a href="/swipe">探す</a>
          <a href="/clip">切り抜き作成</a>
          <a href="/viewer">視聴者向け</a>
          <a href="/creator">VTuber向け</a>
          <a href="/help">ヘルプ</a>
        </nav>
      </header>

      <main className="main error-page-main">
        <section className="status-band service-error-panel">
          <p className="eyebrow">VtuberMatch</p>
          <h1>お探しのページが見つかりません。</h1>
          <p>URLが変更されたか、削除された可能性があります。</p>
          <div className="empty-swipe-actions">
            <a className="primary-button" href="/">
              TOPへ戻る
            </a>
            <a className="secondary-button" href="/swipe">
              VTuberを探す
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}
