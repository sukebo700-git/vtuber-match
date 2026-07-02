import { HeaderAuthStatus } from "@/components/HeaderAuthStatus";
import { PushNotificationButton } from "@/components/PushNotificationButton";

export default function CheckoutSuccessPage({ searchParams }: { searchParams?: { role?: string } }) {
  const targetType = searchParams?.role === "viewer" ? "viewer" : "creator";
  const destination = targetType === "viewer" ? "/viewer?notify=1" : "/creator?notify=1";
  const message = targetType === "viewer"
    ? "スーパーいいねの決済を反映しました。控えや重要なお知らせを見逃さないため、必要に応じて通知ONにしてください。"
    : "プランを反映しました。視聴者からのいいねやスーパーいいねを見逃さないため、続けて通知ONにしてください。";

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
          <div style={{ marginTop: 12 }}>
            <PushNotificationButton targetType={targetType} intent="onboarding" />
          </div>
          <p className="inline-actions" style={{ marginTop: 12 }}>
            <a className="primary-button" href={destination}>{targetType === "viewer" ? "視聴者ページへ" : "配信者ページへ"}</a>
            <a className="secondary-button" href="/">トップへ戻る</a>
          </p>
        </section>
      </main>
    </div>
  );
}
