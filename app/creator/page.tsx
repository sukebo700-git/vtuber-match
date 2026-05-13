import { HeaderAuthStatus } from "@/components/HeaderAuthStatus";
import { AuthVisibility } from "@/components/AuthVisibility";
import { CreatorViewerLikes } from "@/components/CreatorViewerLikes";
import { PushNotificationButton } from "@/components/PushNotificationButton";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "配信者向け無料掲載",
  description: "Vtuber配信者を無料プランから掲載。ベーシック、プレミアムで上位表示や公式バッジも使えます。",
  alternates: {
    canonical: "/creator",
  },
};

export default function CreatorPage() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">Vtuberマッチ</a>
        <nav className="nav" aria-label="メイン">
          <a href="/viewer">視聴者用</a>
          <a href="/login">ログイン</a>
          <a href="/help">ヘルプ</a>
        </nav>
        <HeaderAuthStatus />
      </header>
      <main className="main grid-page">
        <section className="status-band">
          <h2>配信者用ページ</h2>
          <p>掲載申し込み、ログイン、プロフィール修正、アップグレードをここから行えます。ログインには申し込み時のメールアドレスを使います。</p>
        </section>

        <AuthVisibility role="creator" mode="logged-out">
          <section className="creator-action-grid">
            <a className="creator-action-card featured" href="/creator/apply">
              <strong>申し込み</strong>
              <span>無料プランは申し込み後すぐ掲載されます。ベーシックプランとプレミアムプランは決済完了後に反映されます。</span>
            </a>
            <a className="creator-action-card" href="/login">
              <strong>ログイン</strong>
              <span>申し込み時のメールアドレスとパスワードで、掲載データに紐づいて操作できます。</span>
            </a>
          </section>
        </AuthVisibility>

        <AuthVisibility role="creator" mode="logged-in">
          <section className="creator-action-grid">
            <a className="creator-action-card featured" href="/creator/edit">
              <strong>プロフィール修正</strong>
              <span>掲載中の名前、画像、自己アピール、カテゴリ、タグなどを直接修正できます。</span>
            </a>
            <a className="creator-action-card" href="/creator/upgrade">
              <strong>アップグレード</strong>
              <span>ベーシックプランやプレミアムプランへ切り替えて、より見つけてもらいやすい掲載にできます。</span>
            </a>
          </section>
          <PushNotificationButton targetType="creator" />
        </AuthVisibility>

        <section className="status-band">
          <h2>無料プランからアップグレード</h2>
          <p>無料プランは写真、名前、YouTubeチャンネルURLのみです。ベーシックプランにすると公式バッジが付き、カテゴリ・タグ・メッセージ・マッチ数表示・今日のひとこと・上位表示が使えます。プレミアムプランではさらにおすすめアーカイブ表示と視聴者へのいいね機能が使えます。</p>
        </section>

        <CreatorViewerLikes />
      </main>
    </div>
  );
}
