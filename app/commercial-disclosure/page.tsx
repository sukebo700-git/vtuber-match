import type { Metadata } from "next";
import type { ReactNode } from "react";
import { HeaderAuthStatus } from "@/components/HeaderAuthStatus";
import { getTShirtSettings } from "@/lib/tshirt/config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "特定商取引法に基づく表示",
  alternates: {
    canonical: "/commercial-disclosure",
  },
};

const sellerName = process.env.NEXT_PUBLIC_LEGAL_SELLER_NAME || "VtuberMatch";
const representative = process.env.NEXT_PUBLIC_LEGAL_REPRESENTATIVE || "運営者";
const address = process.env.NEXT_PUBLIC_LEGAL_ADDRESS || "北海道札幌市";
const phone = process.env.NEXT_PUBLIC_LEGAL_PHONE || "07090493193";
// Vercelの環境変数に "NEXT_PUBLIC_SUPPORT_EMAIL=xxx@example.com" のように
// キー名ごと値として設定されてしまうミスがあったため、万一そう入っていても
// メールアドレス部分だけを取り出せるようにしておく
const supportEmail = normalizeSupportEmail(process.env.NEXT_PUBLIC_SUPPORT_EMAIL) || "vtubermatch@gmail.com";

function normalizeSupportEmail(value: string | undefined): string {
  const raw = (value || "").trim();
  const match = raw.match(/[^\s=]+@[^\s=]+/);
  return match ? match[0] : raw;
}

export default function CommercialDisclosurePage() {
  const tshirt = getTShirtSettings();
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
          <p>VtuberMatchのプレミアムプラン、PROプラン、切り抜き動画作成、スーパーいいねに関する表示です。ベーシックプランは新規受付を終了しており、既存にご利用中の方のみ対象です。</p>
        </section>

        <section className="legal-table">
          <DisclosureRow title="販売事業者">{sellerName}</DisclosureRow>
          <DisclosureRow title="運営責任者">{representative}</DisclosureRow>
          <DisclosureRow title="所在地">{address}</DisclosureRow>
          <DisclosureRow title="電話番号">{phone}</DisclosureRow>
          <DisclosureRow title="メールアドレス">{supportEmail}</DisclosureRow>
          <DisclosureRow title="商品・サービス内容">
            VTuber配信者のプロフィール、画像、動画・配信サイトリンク等をVtuberMatch内に掲載し、視聴者がスワイプ形式で見つけられるようにするサービスです。
            切り抜き動画作成では、配信者から預かった配信URLと範囲指定をもとに、縦動画変換・自動字幕・無音カット・演出付けを行った動画を制作し納品します。
            スーパーいいねでは、対象配信者の表示を一定期間目立たせる機能を提供します。
          </DisclosureRow>
          <DisclosureRow title="販売価格">
            無料プラン: 0円、ベーシックプラン(新規受付終了・既存会員のみ): 月額500円、プレミアムプラン: 月額980円、PROプラン: 月額3,980円、
            切り抜き動画(単発購入・登録不要): 1本2,000円(プレミアム会員は毎月1本目1,000円引き、PRO会員は毎月4本目まで0円)、
            スーパーいいね: 1回220円。表示価格は税込です。
          </DisclosureRow>
          <DisclosureRow title="商品代金以外の必要料金">インターネット接続料金、通信料金等は利用者の負担となります。</DisclosureRow>
          <DisclosureRow title="支払方法">クレジットカード決済。決済処理はStripeが提供する安全な決済ページで行われます。</DisclosureRow>
          <DisclosureRow title="支払時期">
            月額プランは申込み時に初回決済が行われ、以後は選択したプランに応じて毎月自動で決済されます。切り抜き動画は依頼時に都度決済されます(月額プランの無料枠分を除く)。
          </DisclosureRow>
          <DisclosureRow title="サービス提供時期">
            月額プランは決済完了後、通常は即時から数営業日以内に掲載またはプラン反映を行います。切り抜き動画は依頼受付後、通常5営業日以内に納品します。
          </DisclosureRow>
          <DisclosureRow title="キャンセル・解約">
            月額プランはいつでも解約でき、解約後は次回更新日以降の請求は発生しません。切り抜き動画は制作着手前であればキャンセルできます。着手後のキャンセルは原則お受けできません。
          </DisclosureRow>
          <DisclosureRow title="返品・返金">
            デジタル掲載サービス・切り抜き動画とも、性質上、提供完了後の返金は原則受け付けていません。ただし、サービス不具合により提供されなかった場合は個別に確認します。
            切り抜き動画は納品後7日以内・2回まで、テロップ文言の修正を無料でお受けします。
          </DisclosureRow>
          <DisclosureRow title="動作環境">最新のChrome、Safari、Edgeなどの主要ブラウザを推奨します。</DisclosureRow>
          <DisclosureRow title="表現および効果に関する注意">本サービスは登録者数、再生数、収益、チャンネル成長などの成果を保証するものではありません。</DisclosureRow>
        </section>

        {tshirt.enabled && (
          <section className="legal-table">
            <h2 style={{ marginTop: 24 }}>オリジナルネームTシャツ作成キット（物販）について</h2>
            <DisclosureRow title="商品内容">
              5.6オンスヘビーウェイトTシャツ、カット済み・カス取り前の熱転写シート、圧着方法の説明書、ワンポイント用ミニ熱転写パーツをセットにした作成キットです。完成品Tシャツではありません。
            </DisclosureRow>
            <DisclosureRow title="販売価格">
              1着 {tshirt.basePrice.toLocaleString("ja-JP")}円（税込）。ゴールド・シルバーの特殊色シートは1着につき+{tshirt.specialColorFee.toLocaleString("ja-JP")}円。表示価格は税込です。
            </DisclosureRow>
            <DisclosureRow title="送料">
              全国一律{tshirt.shippingFee.toLocaleString("ja-JP")}円（税込）。{tshirt.freeShippingQuantity}着以上のご注文で送料無料です。
            </DisclosureRow>
            <DisclosureRow title="支払方法・支払時期">クレジットカード決済（Stripe）。ご注文時に決済が行われます。</DisclosureRow>
            <DisclosureRow title="引渡し時期">ご注文（決済確認）後、通常5〜10営業日以内に発送します。制作状況により前後する場合があります。</DisclosureRow>
            <DisclosureRow title="返品・キャンセル">
              お客様が入力した文字・フォント・色・サイズをもとに個別制作する受注生産品のため、お客様都合による返品・交換・キャンセルはお受けできません。
              万一、商品に不良や配送中の破損があった場合は、商品到着後7日以内にお問い合わせいただければ、代替品の送付または返金にて対応します。
            </DisclosureRow>
            <DisclosureRow title="ご注意">
              熱転写シートはカス取り前の状態でお届けします。カス取り・配置・熱圧着はお客様ご自身で行っていただきます。仕上がりはお客様の作業により異なります。
            </DisclosureRow>
          </section>
        )}
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
