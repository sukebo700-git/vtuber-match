import { CreatorViewerLikes } from "@/components/CreatorViewerLikes";

export const dynamic = "force-dynamic";

export default function CreatorPage() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">Vtuberマッチ</a>
        <nav className="nav" aria-label="メイン">
          <a href="/viewer">視聴者用</a>
          <a href="/creator/login">ログイン</a>
          <a href="/terms">ヘルプ・利用規約</a>
        </nav>
      </header>
      <main className="main grid-page">
        <section className="status-band">
          <h2>配信者用ページ</h2>
          <p>掲載申し込み、ログイン、プロフィール修正、上位表示へのアップグレードをここから行えます。ログインには申し込み時のメールアドレスを使います。</p>
        </section>

        <section className="creator-action-grid">
          <a className="creator-action-card featured" href="/apply">
            <strong>申し込み</strong>
            <span>まずはこちら。無料掲載は申し込み後すぐ掲載されます。有料掲載と上位表示は決済完了後に掲載されます。</span>
          </a>
          <a className="creator-action-card" href="/creator/login">
            <strong>ログイン</strong>
            <span>申し込み時のメールアドレスとパスワードで、申し込みデータに紐づいて操作できます。</span>
          </a>
          <a className="creator-action-card" href="/creator/edit">
            <strong>修正申請</strong>
            <span>掲載中の名前、画像、自己アピール、カテゴリ、タグの変更を申請できます。</span>
          </a>
          <a className="creator-action-card" href="/creator/upgrade">
            <strong>アップグレード</strong>
            <span>有料掲載や上位表示へ切り替えて、より見つけてもらいやすい掲載にできます。</span>
          </a>
        </section>

        <section className="status-band">
          <h2>無料掲載からアップグレード</h2>
          <p>無料掲載ではカテゴリ1件、タグ1件のみです。有料掲載にすると公式バッジが付き、無料掲載より目立つ位置で表示されやすくなります。さらに上位表示では、推しを探している視聴者の目に入りやすい掲載枠を強化できます。</p>
        </section>

        <CreatorViewerLikes />
      </main>
    </div>
  );
}
