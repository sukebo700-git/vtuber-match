import { HeaderAuthStatus } from "@/components/HeaderAuthStatus";
import { ClearTshirtDraftOnMount } from "@/components/ClearTshirtDraftOnMount";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "決済完了",
  robots: { index: false, follow: false },
};

export default function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams?: { role?: string; flow?: string; order_number?: string };
}) {
  const targetType = searchParams?.role === "viewer" ? "viewer" : "creator";
  const destination = targetType === "viewer" ? "/viewer" : "/creator";
  const isTshirtKit = searchParams?.flow === "tshirt_kit";
  const isEliteFan = searchParams?.flow === "elite_fan";
  const message = isEliteFan
    ? "エリートファンへのお申し込みが完了しました。"
    : targetType === "viewer"
      ? "スーパーいいねの決済が完了しました。"
      : isTshirtKit
        ? "オリジナルネームTシャツ作成キットのご注文を受け付けました。"
        : "プランを反映しました。";

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">VtuberMatch</a>
        <nav className="nav" aria-label="メイン">
          <a href="/creator">配信者用</a>
          <a href="/help">ヘルプ</a>
        </nav>
        <HeaderAuthStatus />
      </header>
      <main className="main grid-page">
        <section className="status-band">
          <h2>決済を反映しました</h2>
          <p>{message}</p>
          {isTshirtKit ? (
            <>
              <ClearTshirtDraftOnMount />
              {searchParams?.order_number && (
                <p style={{ marginTop: 10 }}>注文番号: <strong>{searchParams.order_number}</strong></p>
              )}
              <p style={{ marginTop: 10 }}>
                カット用データの準備が整い次第、順次発送いたします。発送まで今しばらくお待ちください。
              </p>
              <p className="inline-actions" style={{ marginTop: 12 }}>
                <a className="primary-button" href="/creator/goods">グッズ作成支援ページへ</a>
                <a className="secondary-button" href="/creator">配信者ページへ</a>
              </p>
            </>
          ) : (
            <>
              {targetType === "creator" && (
                <>
                  {/* 2026-09-20: 以前はここでLo-Fi掲載の外部Googleフォームを案内していたが、
                      決済のたびに表示されるため同じ配信者が何度も申し込めてしまっていた。
                      紹介動画(Lo-Fi掲載+紹介ショート動画)の依頼はアプリ内で1回だけ受け付ける。 */}
                  <p style={{ marginTop: 10 }}><strong>Lo-Fi配信への掲載・紹介ショート動画をご希望の方は、依頼ページからお申し込みください(お一人様1回)。</strong></p>
                  <p className="inline-actions" style={{ marginTop: 12 }}>
                    <a className="primary-button" href="/creator/short-video">紹介動画の依頼ページへ</a>
                  </p>
                </>
              )}
              <p className="inline-actions" style={{ marginTop: 12 }}>
                <a className="primary-button" href={destination}>{targetType === "viewer" ? "視聴者ページへ" : "配信者ページへ"}</a>
                <a className="secondary-button" href="/">トップへ戻る</a>
              </p>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
