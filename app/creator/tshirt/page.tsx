import { HeaderAuthStatus } from "@/components/HeaderAuthStatus";
import { TShirtKitOrderForm } from "@/components/TShirtKitOrderForm";
import { getTShirtSettings } from "@/lib/tshirt/config";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "オリジナルネームTシャツ作成キット",
  robots: { index: false, follow: false },
};

export default function CreatorTShirtPage() {
  const settings = getTShirtSettings();
  // 安全策: フラグ無効時は存在しないページとして扱う。
  if (!settings.enabled) notFound();

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">Vtuberマッチ</a>
        <HeaderAuthStatus />
      </header>

      <main className="main grid-page">
        <section className="status-band">
          <h2>VTuberオリジナルネームTシャツ作成キット</h2>
          <p>お名前・ファンネームを入れて、5.6オンスのヘビーウェイトTシャツ作成キットを注文できます。</p>
          {/* 商品ページの重要表示（仕様書13章） */}
          <div style={{ display: "grid", gap: 4, marginTop: 8, padding: 12, borderRadius: 10, background: "#fff6e5", color: "#7a4b00" }}>
            <strong>本商品は完成品Tシャツではありません。</strong>
            <span>熱転写シートはカット線が入ったカス取り前の状態でお届けします。</span>
            <span>カス取り・配置・熱圧着は購入者自身で行ってください。</span>
            <span>注文確定後の文字・フォント・色・サイズ変更はできません。</span>
            <span>{settings.freeShippingQuantity}着以上のご注文で送料無料です。</span>
            <span>お客様のデザインで個別制作する受注生産品のため、お客様都合による返品・キャンセルはお受けできません（不良・破損時を除く）。</span>
            <span>
              詳しくは
              <a href="/commercial-disclosure" style={{ color: "#1e5bd6", textDecoration: "underline" }}>特定商取引法に基づく表示</a>
              をご確認ください。
            </span>
          </div>
        </section>

        {settings.enabled ? (
          <TShirtKitOrderForm settings={settings} />
        ) : (
          <section className="status-band">
            <p>現在この商品は受付を停止しています。</p>
          </section>
        )}
      </main>
    </div>
  );
}
