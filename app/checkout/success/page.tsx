import { HeaderAuthStatus } from "@/components/HeaderAuthStatus";
import { PushNotificationButton } from "@/components/PushNotificationButton";

export default function CheckoutSuccessPage() {
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
          <p>プランを反映しました。該当ページでプロフィール修正、通知設定、マッチ状況の確認ができます。</p>
          <div style={{ marginTop: 12 }}>
            <PushNotificationButton targetType="creator" />
          </div>
          <p className="inline-actions" style={{ marginTop: 12 }}>
            <a className="primary-button" href="/creator">配信者ページへ</a>
            <a className="secondary-button" href="/viewer">視聴者ページへ</a>
            <a className="secondary-button" href="/">トップへ戻る</a>
          </p>
        </section>
      </main>
    </div>
  );
}
