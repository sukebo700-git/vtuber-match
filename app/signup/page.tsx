import { HeaderAuthStatus } from "@/components/HeaderAuthStatus";

export default function SignupPage() {
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
        <p className="eyebrow">Sign up</p>
        <h1>新規登録</h1>
        <p>配信者として掲載するか、視聴者としてプロフィールを作るかを選んでください。</p>
      </section>

      <section className="creator-action-grid signup-select-grid">
        <a className="creator-action-card featured" href="/creator/apply">
          <strong>配信者として登録</strong>
          <span>無料掲載から始められます。写真、名前、YouTubeチャンネルURLを登録できます。</span>
        </a>
        <a className="creator-action-card" href="/viewer/register">
          <strong>視聴者として登録</strong>
          <span>無料で名前とアイコンを登録できます。応援プランへの変更もできます。</span>
        </a>
      </section>
    </main>
  );
}
