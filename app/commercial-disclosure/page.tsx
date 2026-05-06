export const dynamic = "force-dynamic";

const sellerName = process.env.NEXT_PUBLIC_LEGAL_SELLER_NAME || "Vtuberマッチ運営";
const representative = process.env.NEXT_PUBLIC_LEGAL_REPRESENTATIVE || "請求があった場合には遅滞なく開示します";
const address = process.env.NEXT_PUBLIC_LEGAL_ADDRESS || "請求があった場合には遅滞なく開示します";
const phone = process.env.NEXT_PUBLIC_LEGAL_PHONE || "請求があった場合には遅滞なく開示します";
const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "su06k@gmail.com";

export default function CommercialDisclosurePage() {
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
        <section className="status-band legal-hero">
          <h1>特定商取引法に基づく表記</h1>
          <p>Vtuberマッチで提供する掲載プランおよび上位表示プランに関する表示です。</p>
        </section>

        <section className="legal-table">
          <DisclosureRow title="販売事業者">{sellerName}</DisclosureRow>
          <DisclosureRow title="運営責任者">{representative}</DisclosureRow>
          <DisclosureRow title="所在地">{address}</DisclosureRow>
          <DisclosureRow title="電話番号">{phone}</DisclosureRow>
          <DisclosureRow title="メールアドレス">{supportEmail}</DisclosureRow>
          <DisclosureRow title="商品・サービス内容">Vtuber配信者のプロフィール、画像、カテゴリ、タグ、YouTubeリンクをVtuberマッチ内に掲載し、視聴者がスワイプ形式で発見できるようにするサービスです。有料掲載では公式バッジ表示、さらに上位表示では掲載面での優先表示を提供します。</DisclosureRow>
          <DisclosureRow title="販売価格">無料掲載: 0円、有料掲載: 月額500円、さらに上位表示: 月額980円。表示価格は税込です。</DisclosureRow>
          <DisclosureRow title="商品代金以外の必要料金">インターネット接続料金、通信料金は利用者の負担となります。その他、当サービスが別途請求する手数料はありません。</DisclosureRow>
          <DisclosureRow title="支払方法">クレジットカード決済。決済処理はStripeが提供する安全な決済ページで行われます。</DisclosureRow>
          <DisclosureRow title="支払時期">申し込み時に初回決済が行われ、以後は選択した月額プランに応じて毎月自動で決済されます。</DisclosureRow>
          <DisclosureRow title="サービス提供時期">決済完了後、掲載審査およびシステム処理が完了次第、通常即時から3営業日以内に掲載を開始します。無料掲載は申し込み後に自動掲載されます。</DisclosureRow>
          <DisclosureRow title="キャンセル・解約">月額プランはいつでも解約できます。解約後は次回更新日以降の請求は発生しません。解約手続きは運営への連絡または配信者用ページから行えます。</DisclosureRow>
          <DisclosureRow title="返品・返金">デジタル掲載サービスの性質上、決済完了後の返金は原則として受け付けておりません。ただし、当サービスの不具合により掲載が提供されなかった場合は、状況を確認のうえ返金または代替対応を行います。</DisclosureRow>
          <DisclosureRow title="動作環境">最新版のChrome、Safari、Edgeなどの主要ブラウザ。スマートフォンではiOS Safari、Android Chromeの利用を推奨します。</DisclosureRow>
          <DisclosureRow title="表現および効果に関する注意">本サービスは登録者数、再生数、収益、チャンネル成長などの成果を保証するものではありません。掲載効果には個人差があります。</DisclosureRow>
        </section>
      </main>
    </div>
  );
}

function DisclosureRow({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="legal-row">
      <h2>{title}</h2>
      <p>{children}</p>
    </article>
  );
}
