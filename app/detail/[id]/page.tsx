import { HeaderAuthStatus } from "@/components/HeaderAuthStatus";
import { notFound } from "next/navigation";
import { BadgeCheck, CalendarClock, ExternalLink, Radio } from "lucide-react";
import { getStreamerById } from "@/lib/streamers";
import { PLAN_LABELS } from "@/lib/constants";
import { youtubeEmbedUrl, youtubeSubscribeUrl, youtubeWatchUrl } from "@/lib/youtube";

export const dynamic = "force-dynamic";

export default async function DetailPage({ params }: { params: { id: string } }) {
  const streamer = await getStreamerById(params.id);
  if (!streamer) notFound();

  const isPaidOrPremium = streamer.plan_type === "paid" || streamer.plan_type === "boost";
  const isPremium = streamer.plan_type === "boost";

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">Vtuberマッチ</a>
        <nav className="nav" aria-label="メイン">
          <a href="/viewer">視聴者用</a>
          <a href="/creator">配信者用</a>
          <a href="/help">ヘルプ</a>
        </nav>
        <HeaderAuthStatus />
      </header>
      <main className="main grid-page">
        <section className="detail-hero">
          <iframe
            className="video-frame"
            src={youtubeEmbedUrl(isPremium ? streamer.latest_video_id : undefined, streamer.youtube_url)}
            title={`${streamer.name} YouTube`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />

          <aside className="side-panel">
            <div className="status-band">
              <div className="pill-row">
                {isPaidOrPremium && (
                  <span className="official-badge">
                    <BadgeCheck size={15} />
                    公式
                  </span>
                )}
                <span className="pill dark">{PLAN_LABELS[streamer.plan_type]}</span>
                {isPaidOrPremium && streamer.categories.map((category) => (
                  <span className="pill dark" key={category}>{category}</span>
                ))}
              </div>
              <h2>{streamer.name}</h2>
              {isPaidOrPremium ? (
                <p>{streamer.description}</p>
              ) : (
                <p>無料掲載のため、プロフィール情報は写真・名前・YouTubeチャンネルURLのみ表示しています。</p>
              )}
            </div>
            <a className="primary-button" href={youtubeSubscribeUrl(streamer.youtube_url)} target="_blank" rel="noreferrer">
              <ExternalLink size={18} />
              チャンネル登録へ
            </a>
            {isPremium && (
              <a className="secondary-button" href={youtubeWatchUrl(streamer.latest_video_id, streamer.youtube_url)} target="_blank" rel="noreferrer">
                おすすめアーカイブを見る
              </a>
            )}
            <div className="metrics">
              {isPaidOrPremium && (
                <div className="metric">
                  <strong>{streamer.likes ?? 0}</strong>
                  <span>マッチ数</span>
                </div>
              )}
              <div className="metric">
                <strong>{streamer.impressions ?? 0}</strong>
                <span>表示回数</span>
              </div>
            </div>
          </aside>
        </section>

        {isPaidOrPremium && (
          <section className="status-band">
            <h2>プロフィール情報</h2>
            <div className="pill-row">
              {streamer.tags.map((tag) => (
                <span className="pill dark" key={tag}>#{tag}</span>
              ))}
            </div>
            {streamer.one_liner && <p style={{ marginTop: 12 }}>今日のひとこと: {streamer.one_liner}</p>}
            <p style={{ marginTop: 12 }}>
              <CalendarClock size={16} /> {streamer.stream_time || "配信時間帯は未設定"}
            </p>
            {isPremium && (
              <p>
                <Radio size={16} /> おすすめアーカイブ更新日: {streamer.last_video_date ? new Date(streamer.last_video_date).toLocaleDateString("ja-JP") : "未取得"}
              </p>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
