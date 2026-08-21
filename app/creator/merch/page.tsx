import { HeaderAuthStatus } from "@/components/HeaderAuthStatus";
import { AuthVisibility } from "@/components/AuthVisibility";
import { CreatorGoodsForm } from "@/components/CreatorGoodsForm";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "グッズ掲載枠",
  robots: { index: false, follow: false },
};

export default function CreatorMerchPage() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">VtuberMatch</a>
        <nav className="nav" aria-label="メイン">
          <a href="/creator">配信者用</a>
          <a href="/help">ヘルプ</a>
        </nav>
        <HeaderAuthStatus />
      </header>

      <main className="main grid-page">
        <AuthVisibility
          role="creator"
          mode="logged-in"
          fallback={
            <section className="status-band">
              <h2>ログインが必要です</h2>
              <p>グッズ掲載枠のご利用には配信者ログインが必要です。</p>
              <p className="inline-actions" style={{ marginTop: 12 }}>
                <a className="primary-button" href="/creator/login">配信者ログインへ</a>
              </p>
            </section>
          }
        >
          <section className="status-band">
            <h1>グッズ掲載枠</h1>
            <p>
              あなたのグッズを、リスナーのスワイプ画面にカードとして掲載できます。
              プレミアムプランの特典です。
            </p>
          </section>

          <CreatorGoodsForm />
        </AuthVisibility>
      </main>
    </div>
  );
}
