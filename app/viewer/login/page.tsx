import { HeaderAuthStatus } from "@/components/HeaderAuthStatus";
import { AuthVisibility } from "@/components/AuthVisibility";
import { ViewerLoginForm } from "@/components/ViewerLoginForm";

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
              <p>プロフィールの修正や応援プランの確認へ進めます。</p>
              <p className="inline-actions" style={{ marginTop: 12 }}>
                <a className="primary-button" href="/viewer">視聴者プロフィールへ</a>
                <a className="secondary-button" href="/viewer/upgrade">視聴者応援プラン</a>
              </p>
            </section>
          }
        >
          <section className="status-band">
            <h2>視聴者ログイン</h2>
            <p>
              未入力でもスワイプは利用できます。ログインすると、自身の名前やアイコンを登録でき、マッチ数もプロフィールに表示できます。
            </p>
            <p className="inline-actions" style={{ marginTop: 12 }}>
              <a className="secondary-button" href="/viewer/upgrade">視聴者応援プラン</a>
            </p>
          </section>

          <section className="status-band">
            <h2>視聴者応援プランのメリット</h2>
            <p>
              月額330円で、マッチした配信者に名前、YouTube表示名、X / Twitter ID、一言メッセージを開示できます。応援していることが伝わりやすくなります。
            </p>
          </section>

          <ViewerLoginForm />
        </AuthVisibility>
      </main>
    </div>
  );
}
