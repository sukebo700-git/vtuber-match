import { HeaderAuthStatus } from "@/components/HeaderAuthStatus";
import { AuthVisibility } from "@/components/AuthVisibility";
import { ViewerLoginForm } from "@/components/ViewerLoginForm";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "視聴者ログイン",
  robots: { index: false, follow: false },
};

export default function ViewerLoginPage() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">Vtuberマッチ</a>
        <HeaderAuthStatus />
      </header>

      <main className="main grid-page">
        <AuthVisibility
          role="viewer"
          mode="logged-out"
          fallback={
            <section className="status-band">
              <h2>視聴者としてログイン中です</h2>
              <p>プロフィールの修正や視聴者ブーストプランの確認へ進めます。</p>
              <p className="inline-actions" style={{ marginTop: 12 }}>
                <a className="primary-button" href="/viewer">視聴者プロフィールへ</a>
                <a className="secondary-button" href="/viewer/upgrade">視聴者ブーストプラン</a>
              </p>
            </section>
          }
        >
          <section className="status-band">
            <h2>視聴者ログイン / 新規登録</h2>
            <p>未登録なら新規登録、登録済みならログインします。先にメールアドレスとパスワードを入力してください。</p>
          </section>

          <ViewerLoginForm />

          <section className="status-band">
            <h2>視聴者ブーストプラン</h2>
            <p>
              月額330円で、マッチした配信者に名前、YouTube表示名、X / Twitter ID、一言メッセージを開示できます。
            </p>
            <p className="inline-actions" style={{ marginTop: 12 }}>
              <a className="secondary-button" href="/viewer/upgrade">プランを見る</a>
            </p>
          </section>
        </AuthVisibility>
      </main>
    </div>
  );
}
