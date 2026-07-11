import { HeaderAuthStatus } from "@/components/HeaderAuthStatus";

export default function TermsPage() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">VtuberMatch</a>
        <HeaderAuthStatus />
      </header>

      <main className="main grid-page">
        <section className="status-band">
          <h1>利用上の注意</h1>
          <p>VtuberMatchを安心して利用していただくための案内です。</p>
        </section>

        <section className="terms-list">
          <article className="status-band">
            <h2>サービスについて</h2>
            <p>
              VtuberMatchは、動画・配信サイトで活動するVTuber配信者と視聴者の出会いを補助する発見サービスです。
              フォロー、登録者数、視聴数、収益などの成果を保証するものではありません。
            </p>
          </article>

          <article className="status-band">
            <h2>掲載プラン</h2>
            <p>
              無料プランでは基本プロフィールを掲載できます。ベーシックプランでは掲載情報と上位表示が強化されます。
              プレミアムプランでは、優先表示、アーカイブ表示、プレミアムフレームなども利用できます。
            </p>
          </article>

          <article className="status-band">
            <h2>通報・問い合わせ</h2>
            <p>
              不適切なプロフィール、なりすまし、迷惑行為を見つけた場合は、通報機能またはメールでご連絡ください。
              問い合わせ先: <a href="mailto:vtubermatch@gmail.com">vtubermatch@gmail.com</a>
            </p>
          </article>

          <article className="status-band">
            <h2>禁止事項</h2>
            <p>
              虚偽登録、なりすまし、権利侵害、過度な勧誘、迷惑行為は禁止です。
              確認した場合は、掲載停止または削除を行うことがあります。
            </p>
          </article>

          <article className="status-band">
            <h2>返金について</h2>
            <p>
              決済完了後の返金は原則として受け付けていません。ただし、サービス不具合により掲載が提供されなかった場合は個別に確認します。
            </p>
          </article>
        </section>
      </main>
    </div>
  );
}
