import { HeaderAuthStatus } from "@/components/HeaderAuthStatus";
import { CreatorUpgradeForm } from "@/components/CreatorUpgradeForm";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "配信者アップグレード",
  robots: { index: false, follow: false },
};

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
          <p>掲載中のアカウントを、プレミアムプランまたはPROプランに変更できます。切り抜き動画の特典も付きます。</p>
        </section>
        <CreatorUpgradeForm />
      </main>
    </div>
  );
}
