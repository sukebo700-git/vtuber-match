import { HeaderAuthStatus } from "@/components/HeaderAuthStatus";
import { DetailMediaGallery } from "@/components/DetailMediaGallery";
import { DetailLikeButton } from "@/components/DetailLikeButton";
import { ViewerActivityTracker } from "@/components/ViewerActivityTracker";
import { ProfileShareButton } from "@/components/ProfileShareButton";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BadgeCheck, CalendarClock, ExternalLink, Radio } from "lucide-react";
import { getStreamerById, publicStreamerPath, streamerImagePath } from "@/lib/streamers";
import { PLAN_LABELS } from "@/lib/constants";
import { videoSiteLabel, youtubeSubscribeUrl, youtubeWatchUrl } from "@/lib/youtube";
import { absoluteUrl, siteName } from "@/lib/seo";
import { readUserSession, viewerSessionCookie } from "@/lib/userSession";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const streamer = await getStreamerById(params.id);
  if (!streamer) {
    return {
      title: "配信者が見つかりません",
      robots: { index: false, follow: false },
    };
  }

  const description = streamer.description || `${streamer.name}を${siteName}で発見。配信サイトへ移動できます。`;
  const image = seoImage(streamer.thumbnails?.[0], streamer);

  return {
    title: `${streamer.name}のプロフィール`,
    description,
    robots: { index: false, follow: true },
    alternates: {
      canonical: publicStreamerPath(streamer),
    },
    openGraph: {
      type: "profile",
      title: `${streamer.name} | ${siteName}`,
      description,
      url: absoluteUrl(publicStreamerPath(streamer)),
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
  const viewerSession = readUserSession<{ id?: string }>(
    new Request("https://vtuber-match.local", { headers: { cookie: cookies().toString() } }),
    viewerSessionCookie,
  );
  const canViewXAccount = Boolean(viewerSession?.id);
  const siteLabel = videoSiteLabel(streamer.youtube_url);
  const profileImages = streamer.thumbnails?.length ? streamer.thumbnails : ["/promo/landing-oshi.png"];

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
        <ViewerActivityTracker streamerId={streamer.id} />
        <section className="detail-hero">
          <DetailMediaGallery
            images={profileImages}
            name={streamer.name}
            siteLabel={siteLabel}
            siteUrl={youtubeSubscribeUrl(streamer.youtube_url)}
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
                {streamer.vtype_name && (
                  <span className="pill dark">VTYPE {streamer.vtype_code} {streamer.vtype_name}</span>
                )}
                {isPaidOrPremium && streamer.categories.map((category) => (
                  <span className="pill dark" key={category}>{category}</span>
                ))}
              </div>
              <h2>{streamer.name}</h2>
              <p>{streamer.description || "自己アピールは未入力です。"}</p>
            </div>
            <DetailLikeButton streamerId={streamer.id} />
            <a className="primary-button" href={youtubeSubscribeUrl(streamer.youtube_url)} target="_blank" rel="noreferrer">
              <ExternalLink size={18} />
              {siteLabel}を開く
            </a>
            <ProfileShareButton
              title={`${streamer.name} | Vtuberマッチ`}
              text={`${streamer.name}をVtuberマッチで見つけました`}
            />
            {canViewXAccount && streamer.x_account && (
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
            {streamer.promo_video_id && (
              <div className="vtuber-short-embed">
                <iframe
                  src={`https://www.youtube.com/embed/${encodeURIComponent(streamer.promo_video_id)}`}
                  title={`${streamer.name} 紹介ショート動画`}
                  loading="lazy"
                  allow="accelerated-sensors; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            )}
          </aside>
        </section>

        {(streamer.one_liner || streamer.stream_time || streamer.vtype_name || (isPaidOrPremium && streamer.tags.length > 0)) && (
          <section className="status-band">
            <h2>プロフィール情報</h2>
            {streamer.vtype_name && <p>VTYPE診断: {streamer.vtype_code} {streamer.vtype_name}</p>}
            {isPaidOrPremium && streamer.tags.length > 0 && (
              <div className="pill-row">
                {streamer.tags.map((tag) => (
                  <span className="pill dark" key={tag}>#{tag}</span>
                ))}
              </div>
            )}
            {streamer.one_liner && <p style={{ marginTop: 12 }}>今日のひとこと: {streamer.one_liner}</p>}
            {streamer.stream_time && (
              <p style={{ marginTop: 12 }}>
                <CalendarClock size={16} /> {streamer.stream_time}
              </p>
            )}
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

function seoImage(value: string | undefined, streamer: { id: string; updated_at?: string }) {
  if (!value) return absoluteUrl("/promo/landing-oshi.png");
  if (value.startsWith("data:image/")) return absoluteUrl(streamerImagePath(streamer));
  if (value.startsWith("/")) return absoluteUrl(value);
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  return absoluteUrl("/promo/landing-oshi.png");
}
