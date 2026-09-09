import { HeaderAuthStatus } from "@/components/HeaderAuthStatus";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ヘルプ",
  description: "VtuberMatchの使い方、配信者掲載、視聴者利用、通知、問い合わせについてまとめています。",
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
          <p>VtuberMatchを使う前に知っておきたいことをまとめました。</p>
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
              配信リンクへの移動、スーパーいいねの履歴確認がしやすくなります。
            </p>
          </article>

          <article className="status-band">
            <h2>配信者の掲載</h2>
            <p>
              無料プランでは基本プロフィール(画像1枚・自己アピール100文字)を掲載できます。プレミアムプラン(月額980円)では
              画像5枚・常時優先表示・プレミアムフレームなどの特典が、PROプラン(月額3,980円)ではプレミアムの特典に加えて
              切り抜きショート動画を毎月4本まで追加料金なしで作成できます。ベーシックプランは新規受付を終了しており、
              既存にご利用中の方のみ対象です。プランの詳細は<a href="/creator/apply">配信者向け無料掲載</a>のページで比較できます。
            </p>
          </article>

          <article className="status-band">
            <h2>切り抜き動画の依頼</h2>
            <p>
              配信URLと切り抜きたい範囲を送るだけで、縦動画変換・自動字幕・無音カット・演出付けまで自動で制作します。
              無料プランの方は初回1本無料(2本目以降は1本2,000円)、プレミアム会員は毎月1本目が1,000円引き、PRO会員は
              毎月4本まで追加料金なしでご利用いただけます。VtuberMatchに登録していない方でも、単発購入(1本2,000円)で
              依頼できます。納品後7日以内・2回まで、テロップ文言の無料修正を受け付けています。詳しくは
              <a href="/clip">切り抜き動画作成</a>のページをご覧ください。
            </p>
          </article>

          <article className="status-band">
            <h2>お支払い・解約について</h2>
            <p>
              月額プラン(プレミアム・PRO)はクレジットカードでの自動更新です。申込み時に初回決済が行われ、以後は毎月
              自動で決済されます。解約はいつでも可能で、解約後は次回更新日以降の請求は発生しません(日割り返金はありません)。
              切り抜き動画の単発購入は依頼時に都度決済されます。詳しい条件は
              <a href="/commercial-disclosure">特定商取引法に基づく表示</a>をご確認ください。
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
