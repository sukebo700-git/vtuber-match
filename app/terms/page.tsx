import { AdminEntryForm } from "@/components/AdminEntryForm";

export default function TermsPage() {
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
          <h2>ヘルプ</h2>
          <p>Vtuberマッチを安心して使うための案内です。</p>
        </section>

        <section className="terms-list">
          <article className="status-band">
            <h2>サービスについて</h2>
            <p>本サービスは、YouTubeで活動する配信者と視聴者の出会いを補助する発見サービスです。配信内容、チャンネル運営、外部サイト上の行為を保証するものではありません。</p>
          </article>
          <article className="status-band">
            <h2>掲載内容</h2>
            <p>配信者が申込時に送信した画像、自己アピール、カテゴリ、タグを掲載します。運営は不適切と判断した内容を非表示、修正依頼、掲載停止にできます。</p>
          </article>
          <article className="status-band">
            <h2>掲載プラン</h2>
            <p>無料掲載ではカテゴリ1件、タグ1件のみ選択できます。有料掲載では公式バッジが付き、カテゴリ最大3件、タグ最大5件まで選択できます。</p>
          </article>
          <article className="status-band">
            <h2>画像の権利</h2>
            <p>申込者は、本人が使用権限を持つ画像のみアップロードしてください。第三者の権利を侵害する画像、無断転載画像、公序良俗に反する画像は掲載できません。</p>
          </article>
          <article className="status-band">
            <h2>連絡先メール</h2>
            <p>連絡先メールは運営確認、掲載審査、重要連絡のために使用します。公開ページ、スワイプ画面、プロフィール画面には表示しません。</p>
          </article>
          <article className="status-band">
            <h2>外部リンク</h2>
            <p>いいね後やプロフィール画面からYouTubeへ移動します。移動先での利用、登録、コメント、課金などはYouTubeおよび各チャンネルのルールに従ってください。</p>
          </article>
          <article className="status-band">
            <h2>禁止事項</h2>
            <p>虚偽情報の登録、なりすまし、権利侵害、過度な勧誘、迷惑行為、年齢制限や法令に反する内容の掲載は禁止です。</p>
          </article>
          <article className="status-band">
            <h2>免責</h2>
            <p>本サービスの利用によって生じた利用者間のトラブル、外部サービス上の問題、掲載情報の変更や停止による損害について、運営は可能な範囲で対応しますが、すべての結果を保証するものではありません。</p>
          </article>
        </section>

        <AdminEntryForm />
      </main>
    </div>
  );
}
