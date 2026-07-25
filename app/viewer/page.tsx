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

export default function ViewerPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const isXCampaignEntry = searchParams.campaign === "1";

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">VtuberMatch</a>
        <HeaderAuthStatus />
      </header>

      <main className="main grid-page">
        {isXCampaignEntry && (
          <section className="status-band push-notice-card" style={{ background: "#fff3cd", borderColor: "#ffe08a" }}>
            <div>
              <h2>応募完了しました</h2>
              <p>掲載期間は8月1日までです。抽選結果をお待ちください。</p>
            </div>
          </section>
        )}

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
              <p>無料登録でスワイプ回数無制限</p>
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
