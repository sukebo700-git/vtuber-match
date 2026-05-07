import { HeaderAuthStatus } from "@/components/HeaderAuthStatus";
import { CreatorViewerLikes } from "@/components/CreatorViewerLikes";

export const dynamic = "force-dynamic";

export default function CreatorPage() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">Vtuberマッチ</a>
        <nav className="nav" aria-label="メイン">
          <a href="/viewer">視聴者用</a>
          <a href="/creator/login">ログイン</a>
          <a href="/terms">ヘルプ</a>
        </nav>
        <HeaderAuthStatus />
      </header>
      <main className="main grid-page">
        <section className="status-band">
          <h2>配信者用ページ</h2>
          <p>掲載申し込み、ログイン、プロフィール修正、アップグレードをここから行えます。ログインには申し込み時のメールアドレスを使います。</p>
        </section>

        <section className="creator-action-grid">
          <a className="creator-action-card featured" href="/apply">
            <strong>申し込み</strong>
            <span>無料掲載は申し込み後すぐ掲載されます。有料掲載とプレミアムは決済完了後に反映されます。</span>
          </a>
          <a className="creator-action-card" href="/creator/login">
            <strong>ログイン</strong>
            <span>申し込み時のメールアドレスとパスワードで、掲載データに紐づいて操作できます。</span>
          </a>
          <a className="creator-action-card" href="/creator/edit">
            <strong>修正申請</strong>
            <span>掲載中の名前、画像、自己アピール、カテゴリ、タグなどを修正申請できます。</span>
          </a>
          <a className="creator-action-card" href="/creator/upgrade">
            <strong>アップグレード</strong>
            <span>有料掲載やプレミアムプランへ切り替えて、より見つけてもらいやすい掲載にできます。</span>
          </a>
        </section>

        <section className="status-band">
          <h2>無料掲載からアップグレード</h2>
          <p>無料掲載は写真、名前、YouTubeチャンネルURLのみです。有料掲載にすると公式バッジが付き、カテゴリ・タグ・メッセージ・マッチ数表示・今日のひとこと・上位表示が使え、視聴者の目に留まりやすくなります。プレミアムではさらにおすすめアーカイブ表示と視聴者へのいいね機能が使えます。</p>
        </section>

        <CreatorViewerLikes />
      </main>
    </div>
  );
}
