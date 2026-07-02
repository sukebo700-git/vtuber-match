import { AuthVisibility } from "@/components/AuthVisibility";
import { HeaderAuthStatus } from "@/components/HeaderAuthStatus";
import { WithdrawalForm } from "@/components/WithdrawalForm";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "退会申請",
  description: "Vtuberマッチの退会申請と有料プラン解約の案内です。",
  alternates: {
    canonical: "/withdrawal",
  },
};

export default function WithdrawalPage() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">Vtuberマッチ</a>
        <HeaderAuthStatus />
      </header>
      <main className="main grid-page">
        <AuthVisibility
          role="creator"
          mode="logged-in"
          fallback={
            <section className="status-band">
              <h2>ログインが必要です</h2>
              <p>退会申請は、配信者ログイン後に利用できます。</p>
              <p style={{ marginTop: 12 }}><a className="primary-button" href="/creator/login">配信者ログインへ</a></p>
            </section>
          }
        >
          <WithdrawalForm />
        </AuthVisibility>
      </main>
    </div>
  );
}
