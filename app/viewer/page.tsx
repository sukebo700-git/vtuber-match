import { HeaderAuthStatus } from "@/components/HeaderAuthStatus";
import { AuthVisibility } from "@/components/AuthVisibility";
import { ViewerProfileGate } from "@/components/ViewerProfileGate";
import { ViewerSuperBoostWallet } from "@/components/ViewerSuperBoostWallet";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "視聴者用ページ",
  description: "VtuberMatchの視聴者向けページです。プロフィールとスーパーいいねについて確認できます。",
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
          <p>気になるVTuberを探したり、自分のプロフィールを登録したりできます。</p>
          <p className="inline-actions" style={{ marginTop: 12 }}>
            <a className="primary-button" href="/swipe">VTuberを探す</a>
          </p>
        </section>

        <AuthVisibility role="viewer" mode="logged-out">
          <section className="status-band push-notice-card push-onboarding-card">
            <div>
              <h2>無料登録でプロフィールを保存できます</h2>
              <p>名前やアイコンを保存して、VTuber探しを続けられます。</p>
            </div>
            <p className="inline-actions">
              <a className="primary-button" href="/viewer/register">無料登録する</a>
            </p>
          </section>
        </AuthVisibility>

        <ViewerProfileGate />
        <AuthVisibility role="viewer" mode="logged-in">
          <ViewerSuperBoostWallet />
        </AuthVisibility>
      </main>
    </div>
  );
}
