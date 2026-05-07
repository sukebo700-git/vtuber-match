import { HeaderAuthStatus } from "@/components/HeaderAuthStatus";
import { AuthVisibility } from "@/components/AuthVisibility";
import { ViewerLoginForm } from "@/components/ViewerLoginForm";

export default function ViewerLoginPage() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">Vtuberマッチ</a>
        <nav className="nav" aria-label="メイン">
          <a href="/">スワイプ</a>
          <a href="/viewer">視聴者用</a>
          <a href="/terms">ヘルプ</a>
        </nav>
        <HeaderAuthStatus />
      </header>
      <main className="main grid-page">
        <AuthVisibility
          role="viewer"
          mode="logged-out"
          fallback={
            <section className="status-band">
              <h2>視聴者としてログイン中です</h2>
              <p>ログイン画面は未ログインの方だけに表示されます。プロフィールの修正へ進めます。</p>
              <p style={{ marginTop: 12 }}>
                <a className="primary-button" href="/viewer">視聴者プロフィールへ</a>
              </p>
            </section>
          }
        >
          <section className="status-band">
            <h2>視聴者ログイン</h2>
            <p>ログインすると、プロフィール登録、好きなカテゴリの保存、マッチ数による積極的なファンアピールができます。初回ログイン時は視聴者プロフィール枠を作成します。</p>
          </section>
          <ViewerLoginForm />
        </AuthVisibility>
      </main>
    </div>
  );
}
