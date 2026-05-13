import { AdminEntryForm } from "@/components/AdminEntryForm";
import { HeaderAuthStatus } from "@/components/HeaderAuthStatus";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ヘルプ",
  description: "Vtuberマッチの使い方、配信者掲載、視聴者利用、通報、問い合わせについて確認できます。",
  alternates: {
    canonical: "/help",
  },
};

export default function HelpPage() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">Vtuberマッチ</a>
        <HeaderAuthStatus />
      </header>

      <main className="main grid-page">
        <section className="status-band">
          <h1>ヘルプ</h1>
          <p>Vtuberマッチを使う前に確認してほしい案内です。</p>
        </section>

        <section className="terms-list">
          <article className="status-band">
            <h2>サービスについて</h2>
            <p>
              Vtuber配信者と視聴者を、スワイプ形式でつなぐ発見サービスです。
              チャンネル登録、視聴数、収益などの成果は保証していません。
            </p>
          </article>

          <article className="status-band">
            <h2>視聴者の利用</h2>
            <p>
              ログインなしでもスワイプできます。プロフィール登録をすると、名前やアイコンを保存できます。
              視聴者ブーストプランでは、マッチ時に配信者へ一部プロフィールを開示できます。
            </p>
          </article>

          <article className="status-band">
            <h2>配信者の掲載</h2>
            <p>
              無料プランは写真、名前、YouTubeチャンネルURLのみです。
              ベーシックプランでは公式バッジ、カテゴリ、タグ、メッセージ、上位表示などが使えます。
            </p>
          </article>

          <article className="status-band">
            <h2>通報と問い合わせ</h2>
            <p>
              視聴者通報は、マッチ済みの視聴者に対して配信者側から送信できます。
              問い合わせは <a href="mailto:vtubermatch@gmail.com">vtubermatch@gmail.com</a> までご連絡ください。
            </p>
          </article>

          <article className="status-band">
            <h2>解約と返金</h2>
            <p>
              月額プランはいつでも解約できます。デジタル掲載サービスのため、決済完了後の返金は原則できません。
            </p>
          </article>
        </section>

        <section className="status-band legal-footnote">
          <h2>事業者情報</h2>
          <p><a href="/commercial-disclosure">特定商取引法に基づく表記</a></p>
        </section>

        <AdminEntryForm />
      </main>
    </div>
  );
}
