import { CreatorProfileEditForm } from "@/components/CreatorProfileEditForm";

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
          <p>新しい視聴者に見つけてもらうための掲載申込と、掲載後のプロフィール修正申請ができます。</p>
          <p style={{ marginTop: 12 }}>
            <a className="primary-button" href="/apply">掲載を申し込む</a>
          </p>
        </section>
        <section className="status-band">
          <h2>プロフィールを修正する</h2>
          <p>掲載中の名前、画像、自己アピール、カテゴリ、タグなどを変更したい場合はこちらから申請してください。</p>
        </section>
        <CreatorProfileEditForm />
        <section className="status-band">
          <h2>無料掲載からアップグレード</h2>
          <p>無料掲載ではカテゴリ1件、タグ1件のみです。有料掲載にすると公式バッジが付き、カテゴリは最大3件、タグは最大5件まで選択できます。</p>
        </section>
      </main>
    </div>
  );
}
