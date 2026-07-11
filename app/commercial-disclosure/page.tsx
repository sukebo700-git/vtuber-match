import type { ReactNode } from "react";
import { HeaderAuthStatus } from "@/components/HeaderAuthStatus";

export const dynamic = "force-dynamic";

const sellerName = process.env.NEXT_PUBLIC_LEGAL_SELLER_NAME || "VtuberMatch";
const representative = process.env.NEXT_PUBLIC_LEGAL_REPRESENTATIVE || "運営者";
const address = process.env.NEXT_PUBLIC_LEGAL_ADDRESS || "北海道札幌市";
const phone = process.env.NEXT_PUBLIC_LEGAL_PHONE || "07090493193";
const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "vtubermatch@gmail.com";

export default function CommercialDisclosurePage() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">VtuberMatch</a>
        <nav className="nav" aria-label="メイン">
          <a href="/creator">配信者用</a>
          <a href="/diagnosis">タイプ診断</a>
          <a href="https://www.youtube.com/@VtuberMatch" target="_blank" rel="noreferrer">公式YouTube</a>
          <a href="/help">ヘルプ</a>
        </nav>
        <HeaderAuthStatus />
      </header>
      <main className="main grid-page">
        <section className="status-band legal-hero">
          <h1>特定商取引法に基づく表示</h1>
          <p>VtuberMatchのベーシックプラン、プレミアムプラン、スーパーいいねに関する表示です。</p>
        </section>

        <section className="legal-table">
          <DisclosureRow title="販売事業者">{sellerName}</DisclosureRow>
          <DisclosureRow title="運営責任者">{representative}</DisclosureRow>
          <DisclosureRow title="所在地">{address}</DisclosureRow>
          <DisclosureRow title="電話番号">{phone}</DisclosureRow>
          <DisclosureRow title="メールアドレス">{supportEmail}</DisclosureRow>
          <DisclosureRow title="商品・サービス内容">
            VTuber配信者のプロフィール、画像、動画・配信サイトリンク等をVtuberMatch内に掲載し、視聴者がスワイプ形式で見つけられるようにするサービスです。
            スーパーいいねでは、対象配信者の表示を一定期間目立たせる機能を提供します。
          </DisclosureRow>
          <DisclosureRow title="販売価格">
            無料プラン: 0円、ベーシックプラン: 月額500円、プレミアムプラン: 月額980円、スーパーいいね: 1回220円。表示価格は税込です。
          </DisclosureRow>
          <DisclosureRow title="商品代金以外の必要料金">インターネット接続料金、通信料金等は利用者の負担となります。</DisclosureRow>
          <DisclosureRow title="支払方法">クレジットカード決済。決済処理はStripeが提供する安全な決済ページで行われます。</DisclosureRow>
          <DisclosureRow title="支払時期">申込み時に初回決済が行われ、以後は選択した月額プランに応じて毎月自動で決済されます。</DisclosureRow>
          <DisclosureRow title="サービス提供時期">決済完了後、通常は即時から数営業日以内に掲載またはプラン反映を行います。</DisclosureRow>
          <DisclosureRow title="キャンセル・解約">月額プランはいつでも解約できます。解約後、次回更新日以降の請求は発生しません。</DisclosureRow>
          <DisclosureRow title="返品・返金">デジタル掲載サービスの性質上、決済完了後の返金は原則受け付けていません。ただし、サービス不具合により提供されなかった場合は個別に確認します。</DisclosureRow>
          <DisclosureRow title="動作環境">最新のChrome、Safari、Edgeなどの主要ブラウザを推奨します。</DisclosureRow>
          <DisclosureRow title="表現および効果に関する注意">本サービスは登録者数、再生数、収益、チャンネル成長などの成果を保証するものではありません。</DisclosureRow>
        </section>
      </main>
    </div>
  );
}

function DisclosureRow({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="legal-row">
      <h2>{title}</h2>
      <p>{children}</p>
    </article>
  );
}
