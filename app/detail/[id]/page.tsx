import { HeaderAuthStatus } from "@/components/HeaderAuthStatus";
import { ProfileShareButton } from "@/components/ProfileShareButton";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BadgeCheck, CalendarClock, ExternalLink, Radio } from "lucide-react";
import { getStreamerById } from "@/lib/streamers";
import { PLAN_LABELS } from "@/lib/constants";
import { youtubeEmbedUrl, youtubeSubscribeUrl, youtubeWatchUrl } from "@/lib/youtube";
import { absoluteUrl, siteName } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const streamer = await getStreamerById(params.id);
  if (!streamer) {
    return {
      title: "配信者が見つかりません",
      robots: { index: false, follow: false },
    };
  }

  const description = streamer.description || `${streamer.name}を${siteName}で発見。YouTubeチャンネルを確認できます。`;
  const image = seoImage(streamer.thumbnails?.[0]);

  return {
    title: `${streamer.name}のプロフィール`,
    description,
    alternates: {
      canonical: `/detail/${params.id}`,
    },
    openGraph: {
      type: "profile",
      title: `${streamer.name} | ${siteName}`,
      description,
      url: absoluteUrl(`/detail/${params.id}`),
      images: [{ url: image, alt: streamer.name }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${streamer.name} | ${siteName}`,
      description,
      images: [image],
    },
  };
}

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
                <p>無料プランのため、プロフィール情報は写真・名前・YouTubeチャンネルURLのみ表示しています。</p>
              )}
            </div>
            <a className="primary-button" href={youtubeSubscribeUrl(streamer.youtube_url)} target="_blank" rel="noreferrer">
              <ExternalLink size={18} />
              チャンネル登録へ
            </a>
            <ProfileShareButton
              title={`${streamer.name} | Vtuberマッチ`}
              text={`${streamer.name}をVtuberマッチで見つけました`}
            />
            {streamer.x_account && (
              <a className="secondary-button" href={xProfileUrl(streamer.x_account)} target="_blank" rel="noreferrer">
                Xを見る
              </a>
            )}
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

function xProfileUrl(account: string) {
  const handle = account.trim().replace(/^@/, "");
  return `https://x.com/${encodeURIComponent(handle)}`;
}

function seoImage(value?: string) {
  if (!value) return "/promo/landing-oshi.png";
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("/")) return value;
  return "/promo/landing-oshi.png";
}
