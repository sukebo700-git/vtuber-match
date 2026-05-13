import { AuthVisibility } from "@/components/AuthVisibility";
import { HeaderAuthStatus } from "@/components/HeaderAuthStatus";
import { ViewerUpgradeForm } from "@/components/ViewerUpgradeForm";

export const dynamic = "force-dynamic";

export default function ViewerUpgradePage() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">Vtuberマッチ</a>
        <HeaderAuthStatus />
      </header>

      <main className="main grid-page">
        <AuthVisibility
          role="viewer"
          mode="logged-in"
          fallback={
            <section className="status-band">
              <h2>ログインが必要です</h2>
              <p>視聴者ブーストプランへ加入するには、先に視聴者ログインをしてください。</p>
              <p style={{ marginTop: 12 }}>
                <a className="primary-button" href="/viewer/login">視聴者ログインへ</a>
              </p>
            </section>
          }
        >
          <section className="status-band">
            <h2>視聴者ブーストプラン</h2>
            <p>
              月額330円で、マッチした配信者へ応援プロフィールを開示できます。応援していることが伝わりやすくなります。
            </p>
          </section>
          <ViewerUpgradeForm />
        </AuthVisibility>
      </main>
    </div>
  );
}
