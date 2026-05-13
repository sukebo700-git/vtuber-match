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
              無料プランでは写真、名前、YouTubeチャンネルURLを掲載できます。ベーシックプランでは公式バッジ、カテゴリ、タグ、メッセージ、マッチ数表示、上位表示などが使えます。プレミアムプランではさらにおすすめアーカイブ表示と視聴者へのいいね機能が使えます。
            </p>
          </article>

          <article className="status-band">
            <h2>通報・問い合わせ</h2>
            <p>
              不適切なプロフィール、なりすまし、迷惑行為を見つけた場合は、通報機能またはメールでご連絡ください。
            </p>
            <p>
              問い合わせ・通報先: <a href="mailto:vtubermatch@gmail.com">vtubermatch@gmail.com</a>
            </p>
          </article>

          <article className="status-band">
            <h2>禁止事項</h2>
            <p>
              虚偽登録、なりすまし、権利侵害、過度な勧誘、迷惑行為は禁止です。違反確認時は掲載停止または削除します。
            </p>
          </article>

          <article className="status-band">
            <h2>返金について</h2>
            <p>
              決済完了後の返金は原則できません。ただし、サービス不具合により掲載が提供されなかった場合は個別に確認します。
            </p>
          </article>
        </section>

        <AdminEntryForm />
      </main>
    </div>
  );
}
