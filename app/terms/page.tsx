import { AdminEntryForm } from "@/components/AdminEntryForm";

export default function TermsPage() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">Vtuberマッチ</a>
        <nav className="nav" aria-label="メイン">
          <a href="/creator">配信者用</a>
          <a href="/viewer">視聴者用</a>
        </nav>
      </header>
      <main className="main grid-page">
        <section className="status-band">
          <h2>ヘルプ</h2>
          <p>Vtuberマッチを安心して使うための案内です。</p>
        </section>

        <section className="terms-list">
          <article className="status-band">
            <h2>サービスについて</h2>
            <p>本サービスは、YouTubeで活動するVtuber配信者と視聴者の出会いを補助する発見サービスです。チャンネル登録、視聴数、収益などの成果を保証するものではありません。</p>
          </article>
          <article className="status-band">
            <h2>掲載プラン</h2>
            <p>無料掲載ではカテゴリ1件、タグ1件のみ選択できます。有料掲載では公式バッジが付き、無料掲載より目立つ位置で表示されやすくなります。さらに上位表示では、視聴者に見つけてもらいやすい掲載枠を強化できます。</p>
          </article>
          <article className="status-band">
            <h2>ログインについて</h2>
            <p>視聴者はログインなしでもスワイプを利用できます。プロフィール登録には視聴者ログインが必要です。配信者は申し込み後に発行されるログインID、またはメールアドレスとパスワードでログインできます。</p>
          </article>
          <article className="status-band">
            <h2>連絡先メール</h2>
            <p>連絡先メールは運営確認、掲載管理、重要連絡のために使用します。公開ページ、スワイプ画面、プロフィール画面には表示されません。</p>
          </article>
          <article className="status-band">
            <h2>外部リンク</h2>
            <p>いいね後やプロフィール画面からYouTubeへ移動します。移動先での利用、登録、コメント、課金などはYouTubeおよび各チャンネルのルールに従ってください。</p>
          </article>
          <article className="status-band">
            <h2>禁止事項</h2>
            <p>虚偽情報の登録、なりすまし、権利侵害、過度な勧誘、迷惑行為、年齢制限や法令に反する内容の掲載は禁止です。</p>
          </article>
        </section>

        <section className="status-band">
          <h2>特定商取引法に基づく表記</h2>
          <p><a href="/commercial-disclosure">特定商取引法に基づく表記はこちら</a></p>
        </section>

        <AdminEntryForm />
      </main>
    </div>
  );
}
