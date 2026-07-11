import { HeaderAuthStatus } from "@/components/HeaderAuthStatus";

const lofiChannelFormUrl = "https://forms.gle/BFn6Wti8aCBUHV41A";

export default function CheckoutSuccessPage({ searchParams }: { searchParams?: { role?: string } }) {
  const targetType = searchParams?.role === "viewer" ? "viewer" : "creator";
  const destination = targetType === "viewer" ? "/viewer" : "/creator";
  const message = targetType === "viewer"
    ? "スーパーいいねの決済が完了しました。"
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
        </section>
      </main>
    </div>
  );
}
