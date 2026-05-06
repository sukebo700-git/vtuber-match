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
      </header>
      <main className="main grid-page">
        <section className="status-band">
          <h2>視聴者ログイン</h2>
          <p>ログインすると、プロフィール登録、好きなカテゴリの保存、マッチ数による積極的なファンアピールができます。</p>
        </section>
        <ViewerLoginForm />
      </main>
    </div>
  );
}
