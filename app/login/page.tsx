import { HeaderAuthStatus } from "@/components/HeaderAuthStatus";

export default function LoginPage() {
  return (
    <main>
      <header className="topbar">
        <a href="/" className="brand">
          <span className="brand-mark" />
          Vtuberマッチ
        </a>
        <HeaderAuthStatus />
      </header>

      <section className="creator-hero compact-hero">
        <p className="eyebrow">Login</p>
        <h1>ログイン種別を選択</h1>
        <p>
          配信者としてプロフィールを管理する場合は「配信者ログイン」、視聴者プロフィールを使う場合は「視聴者ログイン」を選んでください。
        </p>
      </section>

      <section className="creator-action-grid login-select-grid">
        <a className="creator-action-card featured" href="/creator/login">
          <strong>配信者ログイン</strong>
          <span>掲載情報の修正、アップグレード、プロフィール管理</span>
        </a>
        <a className="creator-action-card" href="/viewer/login">
          <strong>視聴者ログイン</strong>
          <span>視聴者プロフィールの登録・修正、応援プラン管理</span>
        </a>
        <a className="creator-action-card" href="/viewer/upgrade">
          <strong>視聴者応援プラン</strong>
          <span>月額330円。マッチ時に名前、YouTube表示名、X ID、一言を配信者へ開示できます。</span>
        </a>
      </section>
    </main>
  );
}
