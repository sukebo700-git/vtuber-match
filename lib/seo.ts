export const siteName = "VtuberMatch";

export const siteDescription =
  "VTuber配信者と新しい推しを探したい視聴者をつなぐ、スワイプ型のマッチングサービスです。";

export const siteKeywords = [
  "Vtuber",
  "VTuber",
  "Vtuber マッチング",
  "推し活",
  "個人Vtuber",
  "配信者",
  "YouTube配信",
  "新人Vtuber",
  "Vtuber 探し",
  "Vtuber 宣伝",
  "Vtuber 掲載無料",
];

export const publicRoutes = [
  "",
  "/swipe",
  "/signup",
  "/creator",
  "/creator/apply",
  "/viewer",
  "/viewer/login",
  "/help",
  "/terms",
  "/commercial-disclosure",
];

export function getSiteUrl() {
  const configuredUrl = trimTrailingSlash(process.env.NEXT_PUBLIC_APP_URL || "");
  if (!configuredUrl || configuredUrl.includes("vercel.app")) return "https://www.vtubermatch.com";
  return configuredUrl;
}

export function absoluteUrl(path = "") {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getSiteUrl()}${normalizedPath === "/" ? "" : normalizedPath}`;
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}
