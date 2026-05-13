import type { ReactNode } from "react";
import { HeaderAuthStatus } from "@/components/HeaderAuthStatus";

export const dynamic = "force-dynamic";

const sellerName = process.env.NEXT_PUBLIC_LEGAL_SELLER_NAME || "VtuberMatch";
const representative = process.env.NEXT_PUBLIC_LEGAL_REPRESENTATIVE || "木谷圭介";
const address = process.env.NEXT_PUBLIC_LEGAL_ADDRESS || "北海道札幌市西区西野4条6丁目1";
const phone = process.env.NEXT_PUBLIC_LEGAL_PHONE || "07090493193";
const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "vtubermatch@gmail.com";

export default function CommercialDisclosurePage() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">Vtuberマッチ</a>
        <nav className="nav" aria-label="メイン">
          <a href="/creator">配信者用</a>
          <a href="/help">ヘルプ</a>
        </nav>
        <HeaderAuthStatus />
      </header>
      <main className="main grid-page">
        <section className="status-band legal-hero">
          <h1>特定商取引法に基づく表記</h1>
          <p>Vtuberマッチで提供するベーシックプラン、プレミアムプラン、視聴者ブーストプランに関する表示です。</p>
        </section>

        <section className="legal-table">
          <DisclosureRow title="販売事業者">{sellerName}</DisclosureRow>
          <DisclosureRow title="運営責任者">{representative}</DisclosureRow>
          <DisclosureRow title="所在地">{address}</DisclosureRow>
          <DisclosureRow title="電話番号">{phone}</DisclosureRow>
          <DisclosureRow title="メールアドレス">{supportEmail}</DisclosureRow>
          <DisclosureRow title="商品・サービス内容">Vtuber配信者のプロフィール、画像、YouTubeリンク等をVtuberマッチ内に掲載し、視聴者がスワイプ形式で発見できるようにするサービスです。無料プランは写真、名前、YouTubeチャンネルURLのみ、ベーシックプランでは公式バッジ、カテゴリ、タグ、メッセージ、マッチ数表示、上位表示等を提供します。プレミアムプランでは、おすすめアーカイブ表示と視聴者へのいいね機能を提供します。視聴者ブーストプランでは、マッチ時に視聴者プロフィールの一部開示を提供します。</DisclosureRow>
          <DisclosureRow title="販売価格">無料プラン: 0円、ベーシックプラン: 月額500円、プレミアムプラン: 月額980円、視聴者ブーストプラン: 月額330円。ベーシックプラン加入中の方がプレミアムプランへ変更する場合は追加月額480円。表示価格は税込です。</DisclosureRow>
          <DisclosureRow title="商品代金以外の必要料金">インターネット接続料金、通信料金等は利用者の負担となります。その他、当サービスが別途請求する手数料はありません。</DisclosureRow>
          <DisclosureRow title="支払方法">クレジットカード決済。決済処理はStripeが提供する安全な決済ページで行われます。</DisclosureRow>
          <DisclosureRow title="支払時期">申し込み時に初回決済が行われ、以後は選択した月額プランに応じて毎月自動で決済されます。</DisclosureRow>
          <DisclosureRow title="サービス提供時期">決済完了後、システム処理が完了次第、通常即時から2営業日以内に掲載を開始します。無料プランは申し込み後に自動掲載されます。</DisclosureRow>
          <DisclosureRow title="キャンセル・解約">月額プランはいつでも解約できます。解約後、次回更新日以降の請求は発生しません。解約手続きは運営への連絡または配信者用ページから行えます。</DisclosureRow>
          <DisclosureRow title="返品・返金">デジタル掲載サービスの性質上、決済完了後の返金は原則として受け付けておりません。ただし、当サービスの不具合により掲載が提供されなかった場合は、状況を確認のうえ返金または代替対応を行います。</DisclosureRow>
          <DisclosureRow title="動作環境">最新版のChrome、Safari、Edgeなどの主要ブラウザ。スマートフォンではiOS Safari、Android Chromeの利用を推奨します。</DisclosureRow>
          <DisclosureRow title="表現および効果に関する注意">本サービスは登録者数、再生数、収益、チャンネル成長などの成果を保証するものではありません。掲載効果には個人差があります。</DisclosureRow>
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
