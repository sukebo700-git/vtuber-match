"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="main error-page-main">
      <section className="status-band service-error-panel">
        <p className="eyebrow">VtuberMatch</p>
        <h1>アクセス集中により表示できません。</h1>
        <p>少し時間をおいて再読み込みしてください。</p>
        <div className="empty-swipe-actions">
          <button className="primary-button" type="button" onClick={() => reset()}>
            再読み込み
          </button>
          <a className="secondary-button" href="/">
            TOPへ戻る
          </a>
        </div>
      </section>
    </main>
  );
}
