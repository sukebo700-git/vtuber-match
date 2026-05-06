import { notFound } from "next/navigation";
import { CalendarClock, ExternalLink, Radio } from "lucide-react";
import { ReportForm } from "@/components/ReportForm";
import { getStreamerById } from "@/lib/streamers";
import { youtubeEmbedUrl, youtubeSubscribeUrl, youtubeWatchUrl } from "@/lib/youtube";

export const dynamic = "force-dynamic";

export default async function DetailPage({ params }: { params: { id: string } }) {
  const streamer = await getStreamerById(params.id);
  if (!streamer) notFound();

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">Vtuberマッチ</a>
        <nav className="nav" aria-label="メイン">
          <a href="/viewer">視聴者用</a>
          <a href="/creator">配信者用</a>
          <a href="/terms">ヘルプ</a>
        </nav>
      </header>
      <main className="main grid-page">
        <section className="detail-hero">
          <iframe
            className="video-frame"
            src={youtubeEmbedUrl(streamer.latest_video_id, streamer.youtube_url)}
            title={`${streamer.name} YouTube`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />

          <aside className="side-panel">
            <div className="status-band">
              <div className="pill-row">
                {streamer.categories.map((category) => (
                  <span className="pill dark" key={category}>{category}</span>
                ))}
              </div>
              <h2>{streamer.name}</h2>
              <p>{streamer.description}</p>
            </div>
            <a className="primary-button" href={youtubeSubscribeUrl(streamer.youtube_url)} target="_blank" rel="noreferrer">
              <ExternalLink size={18} />
              チャンネル登録へ
            </a>
            <a className="secondary-button" href={youtubeWatchUrl(streamer.latest_video_id, streamer.youtube_url)} target="_blank" rel="noreferrer">
              最新アーカイブを見る
            </a>
            <div className="metrics">
              <div className="metric">
                <strong>{streamer.impressions ?? 0}</strong>
                <span>表示回数</span>
              </div>
              <div className="metric">
                <strong>{streamer.likes ?? 0}</strong>
                <span>いいね</span>
              </div>
            </div>
          </aside>
        </section>

        <section className="status-band">
          <h2>プロフィール情報</h2>
          <div className="pill-row">
            {streamer.tags.map((tag) => (
              <span className="pill dark" key={tag}>#{tag}</span>
            ))}
          </div>
          <p style={{ marginTop: 12 }}>
            <CalendarClock size={16} /> {streamer.stream_time || "配信時間帯は未設定"}
          </p>
          <p>
            <Radio size={16} /> 最終更新: {streamer.last_video_date ? new Date(streamer.last_video_date).toLocaleDateString("ja-JP") : "未取得"}
          </p>
        </section>

        <ReportForm streamerId={streamer.id} streamerName={streamer.name} />
      </main>
    </div>
  );
}
