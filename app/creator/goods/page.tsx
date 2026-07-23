import { HeaderAuthStatus } from "@/components/HeaderAuthStatus";
import { getTShirtSettings } from "@/lib/tshirt/config";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "VTuber限定 オリジナルグッズ作成支援",
  robots: { index: false, follow: false },
};

// 完成済みバナー画像をそのまま（切り抜かず）全幅表示する。
// public/goods/ に画像を置くだけで表示される。端の文字が欠けないよう object-fit は使わない。
function Banner({ src, alt }: { src: string; alt: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      style={{ display: "block", width: "100%", height: "auto", borderRadius: 12 }}
    />
  );
}

export default function CreatorGoodsPage() {
  const settings = getTShirtSettings();
  // 安全策: フラグ無効時は存在しないページとして扱う（公開サイトに露出させない）。
  if (!settings.enabled) notFound();

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">Vtuberマッチ</a>
        <nav className="nav" aria-label="メイン">
          <a href="/creator">配信者トップ</a>
        </nav>
        <HeaderAuthStatus />
      </header>

      <main className="main grid-page">
        {/* ヒーロー */}
        <section className="status-band" style={{ display: "grid", gap: 12 }}>
          <h2 style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
            VTuber限定 オリジナルグッズ作成支援ページ
          </h2>
          <Banner src="/goods/hero.png" alt="VTuber限定 オリジナルグッズ作成支援。あなたの活動名で、世界に1枚のTシャツをVTuber自身の手で" />
        </section>

        {/* 商品: オリジナルネームTシャツ作成キット（説明は画像で行う） */}
        <section className="status-band" style={{ display: "grid", gap: 16 }}>
          <h3 style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
            オリジナルネームTシャツ作成キット
          </h3>
          <Banner src="/goods/tshirt-hero.webp" alt="オリジナルネームTシャツ作成キット。1着1,980円（税込）。選べるシートカラー、ゴールド・シルバーは+300円" />
          <Banner src="/goods/included.webp" alt="セット内容: 5.6オンスヘビーウェイトTシャツ、カット済みの熱転写シート（カス取り前）、圧着方法の説明書、ワンポイント用ミニ熱転写パーツ" />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            <Banner src="/goods/step1.png" alt="STEP1 カス取り: 文字以外の余分なシートを、付属の枠を目印にはがします" />
            <Banner src="/goods/step2.png" alt="STEP2 配置: Tシャツの好きな位置に文字を置きます（位置はご自由に）" />
            <Banner src="/goods/step3.png" alt="STEP3 熱圧着: アイロンまたはヒートプレスで圧着。温度・時間は説明書のとおりに" />
            <Banner src="/goods/step4.png" alt="STEP4 デコる: 仕上げに、ミニパーツで自由にデコれます（ランダムな図柄が複数種類入っています）" />
          </div>

          {/* 申し込み導線 */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              alignItems: "center",
              justifyContent: "center",
              marginTop: 4,
            }}
          >
            <a className="primary-button" href="/creator/tshirt" style={{ padding: "14px 28px", fontSize: 17 }}>
              作成キットを注文する
            </a>
            {settings.enabled ? (
              <span style={{ color: "#555" }}>
                1着 {settings.basePrice.toLocaleString("ja-JP")}円（税込）〜 / 5着以上で送料無料
              </span>
            ) : (
              <span style={{ color: "#a00" }}>現在受付を停止しています。</span>
            )}
          </div>
        </section>

        {/* 今後グッズ種類が増えたらここにカードを追加する */}
      </main>
    </div>
  );
}
