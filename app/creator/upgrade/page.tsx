import { HeaderAuthStatus } from "@/components/HeaderAuthStatus";
import { CreatorUpgradeForm } from "@/components/CreatorUpgradeForm";

export const dynamic = "force-dynamic";

export default function CreatorUpgradePage() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">Vtuberマッチ</a>
        <HeaderAuthStatus />
      </header>

      <main className="main grid-page">
        <section className="status-band">
          <h2>配信者アップグレード</h2>
          <p>掲載中のアカウントを、ベーシックプランまたはプレミアムプランへ変更できます。</p>
        </section>
        <CreatorUpgradeForm />
      </main>
    </div>
  );
}
