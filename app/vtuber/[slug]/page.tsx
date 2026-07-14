import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BadgeCheck, ExternalLink, Search } from "lucide-react";

import { PLAN_LABELS } from "@/lib/constants";
import { absoluteUrl, siteName } from "@/lib/seo";
import { getPublicStreamerBySlug, publicStreamerPath, streamerImagePath } from "@/lib/streamers";
import { videoSiteLabel, youtubeSubscribeUrl } from "@/lib/youtube";

export const revalidate = 86400;
export const dynamicParams = true;

type VtuberSeoPageProps = {
  params: {
    slug: string;
  };
};

export async function generateMetadata({ params }: VtuberSeoPageProps): Promise<Metadata> {
  const streamer = await getPublicStreamerBySlug(params.slug);
  if (!streamer) {
    return {
      title: `VTuberプロフィール | ${siteName}`,
      robots: { index: false, follow: false },
    };
  }

  const title = `${streamer.name} | VtuberMatch掲載プロフィール`;
  const description = seoDescription(streamer.name, streamer.description || streamer.one_liner, streamer.categories, streamer.tags);
  const canonicalPath = publicStreamerPath(streamer);
  const image = absoluteUrl(streamerImagePath(streamer));

  return {
    title,
    description,
    alternates: { canonical: canonicalPath },
    robots: { index: true, follow: true },
    openGraph: {
      type: "profile",
      title,
      description,
      url: absoluteUrl(canonicalPath),
      images: [{ url: image, alt: `${streamer.name}のプロフィール画像` }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function VtuberSeoPage({ params }: VtuberSeoPageProps) {
  const streamer = await getPublicStreamerBySlug(params.slug);
  if (!streamer) notFound();

  const siteLabel = videoSiteLabel(streamer.youtube_url);
  const image = streamerImagePath(streamer);
  const categories = streamer.categories || [];
  const tags = streamer.tags || [];

  return (
    <main className="vtuber-seo-page">
      <section className="vtuber-seo-hero">
        <div className="vtuber-seo-image-frame">
          <img src={image} alt={`${streamer.name}のプロフィール画像`} loading="eager" decoding="async" />
        </div>
        <div className="vtuber-seo-copy">
          <p className="diagnosis-kicker">VtuberMatch掲載プロフィール</p>
          <h1>{streamer.name}</h1>
          <div className="pill-row">
            <span className="pill dark">{PLAN_LABELS[streamer.plan_type]}</span>
            {streamer.vtype_name && (
              <span className="pill dark">VTYPE {streamer.vtype_code} {streamer.vtype_name}</span>
            )}
            {streamer.plan_type !== "free" && (
              <span className="official-badge">
                <BadgeCheck size={15} />
                掲載中
              </span>
            )}
          </div>
          {streamer.one_liner && <p className="vtuber-seo-lead">{streamer.one_liner}</p>}
          {streamer.description && <p className="vtuber-seo-description">{streamer.description}</p>}
          {!!categories.length && (
            <div className="card-tag-row" aria-label="カテゴリ">
              {categories.slice(0, 3).map((category) => <span key={category}>{category}</span>)}
            </div>
          )}
          {!!tags.length && (
            <div className="card-tag-row" aria-label="タグ">
              {tags.slice(0, 5).map((tag) => <span key={tag}>#{tag}</span>)}
            </div>
          )}
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
          <div className="vtuber-seo-actions">
            <a className="primary-button" href={youtubeSubscribeUrl(streamer.youtube_url)} target="_blank" rel="noreferrer">
              <ExternalLink size={18} />
              {siteLabel}を開く
            </a>
            {streamer.promo_video_id && (
              <a
                className="secondary-button"
                href={`https://www.youtube.com/shorts/${encodeURIComponent(streamer.promo_video_id)}`}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink size={18} />
                YouTubeで見る
              </a>
            )}
            <a className="secondary-button" href="/swipe">
              <Search size={18} />
              他のVTuberも探す
            </a>
          </div>
          <p className="help-text">
            掲載情報はVtuberMatch登録プロフィールをもとに表示しています。最新情報は配信サイトをご確認ください。
          </p>
        </div>
      </section>
    </main>
  );
}

function seoDescription(name: string, description: string | undefined, categories: string[], tags: string[]) {
  const parts = [
    description,
    categories.length ? `カテゴリ: ${categories.slice(0, 3).join(" / ")}` : "",
    tags.length ? `タグ: ${tags.slice(0, 4).map((tag) => `#${tag}`).join(" ")}` : "",
  ].filter(Boolean);
  const text = parts.join("。");
  return (text || `${name}のVtuberMatch掲載プロフィールです。`).slice(0, 150);
}
