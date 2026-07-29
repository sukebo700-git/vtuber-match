import { HeaderAuthStatus } from "@/components/HeaderAuthStatus";
import { CollaborationSettingsForm } from "@/components/CollaborationSettingsForm";
import { isCollaborationEnabled } from "@/lib/collaboration/config";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "コラボのお誘い設定 | VtuberMatch",
  robots: { index: false, follow: false },
};

export default function CollaborationSettingsPage() {
  // 安全策: フラグ無効時は存在しないページとして扱う(公開サイトに露出させない)。tshirtと同じ方式。
  if (!isCollaborationEnabled()) notFound();

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">VtuberMatch</a>
        <nav className="nav" aria-label="メイン">
          <a href="/creator">配信者トップ</a>
        </nav>
        <HeaderAuthStatus />
      </header>

      <main className="main grid-page">
        <section className="status-band">
          <h1>コラボのお誘い設定</h1>
          <p>
            他のVTuberからコラボのお誘いを受け付けるかどうかを設定します。
            受け付けるには、非公開のコラボ用連絡先を最低1つ登録してください。
          </p>
        </section>
        <CollaborationSettingsForm />
      </main>
    </div>
  );
}
