export function youtubeEmbedUrl(videoId?: string, fallbackUrl?: string) {
  if (videoId) return `https://www.youtube.com/embed/${videoId}`;
  const channel = extractChannelHandle(fallbackUrl || "");
  return channel ? `https://www.youtube.com/embed?listType=user_uploads&list=${channel.replace("@", "")}` : "";
}

export function youtubeWatchUrl(videoId?: string, fallbackUrl?: string) {
  if (videoId) return `https://www.youtube.com/watch?v=${videoId}`;
  return fallbackUrl || "https://www.youtube.com/";
}

export function youtubeSubscribeUrl(url: string) {
  return url.includes("?") ? `${url}&sub_confirmation=1` : `${url}?sub_confirmation=1`;
}

export function extractChannelHandle(url: string) {
  const match = url.match(/youtube\.com\/(@[^/?#]+)/);
  return match?.[1];
}

export async function fetchLatestYouTubeVideo(channelId: string) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return null;

  const search = new URL("https://www.googleapis.com/youtube/v3/search");
  search.searchParams.set("part", "snippet");
  search.searchParams.set("channelId", channelId);
  search.searchParams.set("order", "date");
  search.searchParams.set("maxResults", "1");
  search.searchParams.set("type", "video");
  search.searchParams.set("key", key);

  const response = await fetch(search);
  if (!response.ok) throw new Error(`YouTube API error: ${response.status}`);
  const data = await response.json();
  const item = data.items?.[0];
  if (!item?.id?.videoId) return null;

  return {
    videoId: item.id.videoId as string,
    publishedAt: item.snippet.publishedAt as string,
    title: item.snippet.title as string
  };
}
