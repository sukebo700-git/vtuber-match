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
        <h1>ログイン</h1>
        <p>上部のログインボタンから、配信者ログインまたは視聴者ログインを選択してください。</p>
      </section>
    </main>
  );
}
