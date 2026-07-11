import { HeaderAuthStatus } from "@/components/HeaderAuthStatus";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "新規登録",
  description: "VtuberMatchに配信者として掲載する、または視聴者としてプロフィールを登録できます。",
  alternates: {
    canonical: "/signup",
  },
};

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
          <span>無料プランから始められます。写真、名前、動画・配信サイトURL、自己アピールを掲載し、視聴者からのいいねを受け取れます。</span>
        </a>
        <a className="creator-action-card" href="/viewer/register">
          <strong>視聴者として登録</strong>
          <span>無料で名前とアイコンを登録できます。いいねやスーパーいいねの履歴も見やすくなります。</span>
        </a>
      </section>
    </main>
  );
}
