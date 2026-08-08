import { HeaderAuthStatus } from "@/components/HeaderAuthStatus";
import { AuthVisibility } from "@/components/AuthVisibility";
import { CreatorLoginForm } from "@/components/CreatorLoginForm";
import { ReloginEscapeHatch } from "@/components/ReloginEscapeHatch";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "配信者ログイン",
  robots: { index: false, follow: false },
};

export default function CreatorLoginPage() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">Vtuberマッチ</a>
        <nav className="nav" aria-label="メイン">
          <a href="/creator">配信者用</a>
          <a href="https://www.youtube.com/@VtuberMatch" target="_blank" rel="noreferrer">公式YouTube</a>
          <a href="/help">ヘルプ</a>
        </nav>
        <HeaderAuthStatus />
      </header>
      <main className="main grid-page">
        <AuthVisibility
          role="creator"
          mode="logged-out"
          fallback={
            <section className="status-band">
              <h2>配信者としてログイン中です</h2>
              <p>ログイン画面は未ログインの方だけに表示されます。掲載内容の変更やアップグレードへ進めます。</p>
              <p className="inline-actions" style={{ marginTop: 12 }}>
                <a className="primary-button" href="/creator">配信者用ページへ</a>
                <ReloginEscapeHatch prefix="vtuber-match-creator" />
              </p>
            </section>
          }
        >
          <section className="status-band">
            <h2>配信者ログイン</h2>
            <p>申し込み時のメールアドレスとパスワードでログインできます。</p>
          </section>
          <CreatorLoginForm />
        </AuthVisibility>
      </main>
    </div>
  );
}
