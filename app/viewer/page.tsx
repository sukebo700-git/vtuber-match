import { HeaderAuthStatus } from "@/components/HeaderAuthStatus";
import { AuthVisibility } from "@/components/AuthVisibility";
import { PushNotificationButton } from "@/components/PushNotificationButton";
import { ViewerProfileGate } from "@/components/ViewerProfileGate";
import { ViewerSuperBoostWallet } from "@/components/ViewerSuperBoostWallet";
import { NotificationInbox } from "@/components/NotificationInbox";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "視聴者用ページ",
  description: "VtuberMatchの視聴者向けページです。プロフィール登録、スーパーいいね履歴、通知設定を確認できます。",
  alternates: {
    canonical: "/viewer",
  },
};

export default function ViewerPage() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">VtuberMatch</a>
        <HeaderAuthStatus />
      </header>

      <main className="main grid-page">
        <section className="status-band">
          <h1>視聴者用ページ</h1>
          <p>気になるVTuberを探したり、プロフィールを登録したりできます。</p>
          <p className="inline-actions" style={{ marginTop: 12 }}>
            <a className="primary-button" href="/swipe">VTuberを探す</a>
          </p>
        </section>

        <AuthVisibility role="viewer" mode="logged-in">
          <NotificationInbox />
          <section className="status-band push-notice-card push-onboarding-card">
            <div>
              <h2>通知を受け取る</h2>
              <p>スーパーいいねや重要なお知らせを見逃しにくくできます。</p>
            </div>
            <PushNotificationButton targetType="viewer" intent="onboarding" />
          </section>
          <ViewerSuperBoostWallet />
        </AuthVisibility>

        <AuthVisibility role="viewer" mode="logged-out">
          <section className="status-band push-notice-card push-onboarding-card">
            <div>
              <h2>無料登録でプロフィールを使えます</h2>
              <p>登録すると、自分の名前やアイコンを保存してVTuber探しを続けられます。</p>
            </div>
            <p className="inline-actions">
              <a className="primary-button" href="/viewer/register">無料登録する</a>
            </p>
          </section>
        </AuthVisibility>

        <ViewerProfileGate />
      </main>
    </div>
  );
}
