import { HeaderAuthStatus } from "@/components/HeaderAuthStatus";
import { AuthVisibility } from "@/components/AuthVisibility";
import { GoogleOneTap } from "@/components/GoogleOneTap";
import { ViewerLoginForm } from "@/components/ViewerLoginForm";
import { ReloginEscapeHatch } from "@/components/ReloginEscapeHatch";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "視聴者ログイン",
  robots: { index: false, follow: false },
};

export default function ViewerLoginPage({ searchParams }: { searchParams?: { mode?: string } }) {
  const initialMode = searchParams?.mode === "register" ? "register" : "login";

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">VtuberMatch</a>
        <HeaderAuthStatus />
      </header>

      <main className="main grid-page">
        <AuthVisibility
          role="viewer"
          mode="logged-out"
          fallback={
            <section className="status-band">
              <h2>視聴者としてログイン中です</h2>
              <p>プロフィール確認やVTuber探しに進めます。</p>
              <p className="inline-actions" style={{ marginTop: 12 }}>
                <a className="primary-button" href="/viewer">視聴者用ページへ</a>
                <a className="secondary-button" href="/swipe">VTuberを探す</a>
                <ReloginEscapeHatch prefix="vtuber-match-viewer" />
              </p>
            </section>
          }
        >
          <section className="status-band">
          <h1>{initialMode === "register" ? "視聴者新規登録" : "視聴者ログイン"}</h1>
          <p>無料登録またはログインすると、プロフィール保存やスーパーいいね履歴を使えます。</p>
          </section>

          <GoogleOneTap showButton redirectTo="/viewer?notify=1" />
          <ViewerLoginForm initialMode={initialMode} />
        </AuthVisibility>
      </main>
    </div>
  );
}
