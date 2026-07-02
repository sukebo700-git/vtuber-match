import type { MetadataRoute } from "next";
import { absoluteUrl, publicRoutes } from "@/lib/seo";
import { getPublicStreamersForSeo, publicStreamerPath } from "@/lib/streamers";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes = publicRoutes.map((route) => ({
    url: absoluteUrl(route),
    lastModified: now,
    changeFrequency: route === "" || route === "/swipe" ? "daily" as const : "weekly" as const,
    priority: priorityFor(route),
  }));

  const streamers = await getPublicStreamersForSeo().catch(() => []);
  const detailRoutes = streamers.map((streamer) => ({
    url: absoluteUrl(publicStreamerPath(streamer)),
    lastModified: streamer.updated_at ? new Date(streamer.updated_at) : now,
    changeFrequency: "weekly" as const,
    priority: streamer.plan_type === "boost" ? 0.82 : streamer.plan_type === "paid" ? 0.76 : 0.68,
  }));

  return [...staticRoutes, ...detailRoutes];
}

function priorityFor(route: string) {
  if (route === "") return 1;
  if (route === "/swipe") return 0.95;
  if (route === "/signup" || route === "/creator/apply") return 0.9;
  if (route === "/viewer" || route === "/creator") return 0.82;
  return 0.65;
}
