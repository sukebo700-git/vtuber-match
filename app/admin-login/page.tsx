import type { Metadata } from "next";
import { AdminEntryForm } from "@/components/AdminEntryForm";
import { HeaderAuthStatus } from "@/components/HeaderAuthStatus";

export const metadata: Metadata = {
  title: "管理者ログイン",
  robots: { index: false, follow: false },
};

export default function AdminLoginPage() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">VtuberMatch</a>
        <nav className="nav" aria-label="メイン">
          <a href="/">TOP</a>
          <a href="/help">ヘルプ</a>
        </nav>
        <HeaderAuthStatus />
      </header>
      <main className="main grid-page">
        <section className="status-band">
          <h1>管理者ログイン</h1>
          <p>管理者キーを入力すると、管理画面に入れます。</p>
          <AdminEntryForm />
        </section>
      </main>
    </div>
  );
}
