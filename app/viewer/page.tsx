import { HeaderAuthStatus } from "@/components/HeaderAuthStatus";
import { ViewerProfileGate } from "@/components/ViewerProfileGate";

export const dynamic = "force-dynamic";

export default function ViewerPage() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">Vtuberマッチ</a>
        <nav className="nav" aria-label="メイン">
          <a href="/">スワイプ</a>
          <a href="/viewer/login">ログイン</a>
          <a href="/creator">配信者用</a>
          <a href="/terms">ヘルプ</a>
        </nav>
        <HeaderAuthStatus />
      </header>
      <main className="main grid-page">
        <section className="status-band">
          <h2>視聴者用ページ</h2>
          <p>ログインなしでもスワイプは利用できます。ログインすると、自分のプロフィールや画像、YouTube表示名を登録でき、マッチした配信者に積極的なファンであることを伝えられます。</p>
          <p style={{ marginTop: 12 }}>
            <a className="primary-button" href="/">スワイプ画面へ戻る</a>
          </p>
        </section>
        <ViewerProfileGate />
      </main>
    </div>
  );
}
