import { HeaderAuthStatus } from "@/components/HeaderAuthStatus";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ヘルプ",
  description: "VtuberMatchの使い方、配信者掲載、視聴者利用、通知、問い合わせについて確認できます。",
  alternates: {
    canonical: "/help",
  },
};

export default function HelpPage() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">VtuberMatch</a>
        <HeaderAuthStatus />
      </header>

      <main className="main grid-page">
        <section className="status-band">
          <h1>ヘルプ</h1>
          <p>VtuberMatchを使う前に確認してほしい案内です。</p>
        </section>

        <section className="terms-list">
          <article className="status-band">
            <h2>サービスについて</h2>
            <p>
              VtuberMatchは、VTuber配信者と視聴者をスワイプ形式でつなぐ発見サービスです。
              フォロー、登録者数、視聴数、収益などの成果を保証するものではありません。
            </p>
          </article>

          <article className="status-band">
            <h2>視聴者の利用</h2>
            <p>
              ログインなしでもスワイプを試せます。無料登録すると、プロフィール保存、配信者プロフィール閲覧、
              配信リンクへの移動、スーパーいいねの履歴確認が使いやすくなります。
            </p>
          </article>

          <article className="status-band">
            <h2>配信者の掲載</h2>
            <p>
              無料プランでは基本プロフィールを掲載できます。ベーシックプラン、プレミアムプランでは、
              上位表示や公式チャンネルでの紹介特典が強化されます。
            </p>
          </article>

          <article className="status-band">
            <h2>通知と問い合わせ</h2>
            <p>
              通知はいいね、スーパーいいね、重要なお知らせを受け取るために使います。
              問い合わせは <a href="mailto:vtubermatch@gmail.com">vtubermatch@gmail.com</a> までご連絡ください。
            </p>
          </article>

          <article className="status-band">
            <h2>退会申請</h2>
            <p><a href="/withdrawal">退会申請と有料プラン解約へ進む</a></p>
          </article>
        </section>
      </main>
    </div>
  );
}
