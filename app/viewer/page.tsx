import { ViewerProfileForm } from "@/components/ViewerProfileForm";

export const dynamic = "force-dynamic";

export default function ViewerPage() {
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
          <h2>視聴者用ページ</h2>
          <p>プロフィールは未入力でも利用できます。入力すると、いいねした配信者があなたの好きなジャンルやYouTube表示名、マッチ数を確認できます。</p>
          <p style={{ marginTop: 12 }}>
            <a className="primary-button" href="/">スワイプ画面へ戻る</a>
          </p>
        </section>
        <section className="status-band">
          <h2>積極的なファンとしてアピール</h2>
          <p>マッチ数が増えるほど、配信者から「よく推しを探している視聴者」として見えやすくなります。プロフィール共有をオンにした場合だけ、マッチした配信者に表示されます。</p>
        </section>
        <ViewerProfileForm />
      </main>
    </div>
  );
}
