import { ApplicationForm } from "@/components/ApplicationForm";
import { CATEGORIES, TAGS } from "@/lib/constants";

export default function ApplyPage() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">Vtuberマッチ</a>
        <nav className="nav" aria-label="メイン">
          <a href="/creator">配信者用</a>
          <a href="/terms">ヘルプ</a>
        </nav>
      </header>
      <main className="main grid-page">
        <section className="status-band">
          <h2>掲載を申し込む</h2>
          <p>プロフィール画像、自己アピール、カテゴリ・タグを登録できます。申込後、運営確認を経て掲載されます。</p>
        </section>
        <ApplicationForm categories={CATEGORIES} tags={TAGS} />
      </main>
    </div>
  );
}
