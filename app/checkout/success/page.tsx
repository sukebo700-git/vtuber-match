import { HeaderAuthStatus } from "@/components/HeaderAuthStatus";
import { ClearTshirtDraftOnMount } from "@/components/ClearTshirtDraftOnMount";

const lofiChannelFormUrl = "https://forms.gle/BFn6Wti8aCBUHV41A";

export default function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams?: { role?: string; flow?: string; order_number?: string };
}) {
  const targetType = searchParams?.role === "viewer" ? "viewer" : "creator";
  const destination = targetType === "viewer" ? "/viewer" : "/creator";
  const isTshirtKit = searchParams?.flow === "tshirt_kit";
  const message = targetType === "viewer"
    ? "スーパーいいねの決済が完了しました。"
    : isTshirtKit
      ? "オリジナルネームTシャツ作成キットのご注文を受け付けました。"
      : "プランを反映しました。";

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
                  <p style={{ marginTop: 10 }}><strong>Lo-Fiチャンネル掲載希望の方はこちらの登録もお願いします。</strong></p>
                  <p className="inline-actions" style={{ marginTop: 12 }}>
                    <a className="primary-button" href={lofiChannelFormUrl} target="_blank" rel="noreferrer">Lo-Fi掲載フォームを開く</a>
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
