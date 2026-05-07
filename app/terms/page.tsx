import { AdminEntryForm } from "@/components/AdminEntryForm";
import { HeaderAuthStatus } from "@/components/HeaderAuthStatus";

export default function TermsPage() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">Vtuberマッチ</a>
        <HeaderAuthStatus />
      </header>

      <main className="main grid-page">
        <section className="status-band">
          <h2>ヘルプ・利用上の注意</h2>
          <p>Vtuberマッチを安心して利用するための案内です。</p>
        </section>

        <section className="terms-list">
          <article className="status-band">
            <h2>サービスについて</h2>
            <p>
              Vtuberマッチは、YouTubeで活動するVtuber配信者と視聴者の出会いを補助する発見サービスです。チャンネル登録、視聴数、収益などの成果を保証するものではありません。
            </p>
          </article>

          <article className="status-band">
            <h2>掲載プラン</h2>
            <p>
              無料掲載では写真、名前、YouTubeチャンネルURLを掲載できます。有料掲載では公式バッジ、カテゴリ、タグ、メッセージ、マッチ数表示、上位表示などが使えます。プレミアムプランではさらにおすすめアーカイブ表示と視聴者へのいいね機能が使えます。
            </p>
          </article>

          <article className="status-band">
            <h2>視聴者応援プラン</h2>
            <p>
              視聴者応援プランは月額330円です。マッチした配信者に名前、YouTube表示名、X / Twitter ID、一言メッセージを開示でき、応援していることを伝えやすくなります。
            </p>
          </article>

          <article className="status-band">
            <h2>通報・問い合わせ</h2>
            <p>
              不適切なプロフィール、なりすまし、迷惑行為、掲載内容の問題を見つけた場合は、管理画面の通報機能またはメールでご連絡ください。
            </p>
            <p>
              問い合わせ・通報先: <a href="mailto:vtubermatch@gmail.com">vtubermatch@gmail.com</a>
            </p>
          </article>

          <article className="status-band">
            <h2>禁止事項</h2>
            <p>
              虚偽情報の登録、なりすまし、権利侵害、過度な勧誘、迷惑行為、公序良俗または法令に反する内容の掲載は禁止です。違反が確認された場合、掲載停止または削除を行うことがあります。
            </p>
          </article>

          <article className="status-band">
            <h2>返金について</h2>
            <p>
              デジタル掲載サービスの性質上、決済完了後の返金は原則として受け付けておりません。ただし、当サービスの不具合により掲載が提供されなかった場合は、状況を確認のうえ返金または代替対応を行います。
            </p>
          </article>
        </section>

        <section className="status-band legal-footnote">
          <h2>その他</h2>
          <p><a href="/commercial-disclosure">特定商取引法に基づく表記</a></p>
        </section>

        <AdminEntryForm />
      </main>
    </div>
  );
}
