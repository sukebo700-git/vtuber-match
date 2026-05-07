import { HeaderAuthStatus } from "@/components/HeaderAuthStatus";
import { ViewerProfileGate } from "@/components/ViewerProfileGate";

export const dynamic = "force-dynamic";

export default function ViewerPage() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">Vtuberマッチ</a>
        <HeaderAuthStatus />
      </header>

      <main className="main grid-page">
        <section className="status-band">
          <h2>視聴者用ページ</h2>
          <p>
            ログインなしでもスワイプは利用できます。ログインすると、自身の名前やアイコンを登録でき、マッチ数もプロフィールに表示できます。
          </p>
          <p className="inline-actions" style={{ marginTop: 12 }}>
            <a className="primary-button" href="/">スワイプ画面へ戻る</a>
            <a className="secondary-button" href="/viewer/login">視聴者ログイン</a>
            <a className="secondary-button" href="/viewer/upgrade">視聴者応援プラン</a>
          </p>
        </section>
        <ViewerProfileGate />
      </main>
    </div>
  );
}
