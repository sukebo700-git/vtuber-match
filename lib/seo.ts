export const siteName = "Vtuberマッチ";

export const siteDescription =
  "Vtuber配信者と新しい推しを探したい視聴者をつなぐ、登録無料のスワイプ型マッチングサービス。";

export const siteKeywords = [
  "Vtuber",
  "VTuber",
  "Vtuber マッチング",
  "推し活",
  "個人Vtuber",
  "配信者",
  "YouTube配信",
  "新人Vtuber",
  "Vtuber 探す",
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
  "/viewer/upgrade",
  "/help",
  "/terms",
  "/commercial-disclosure",
];

export function getSiteUrl() {
  return trimTrailingSlash(process.env.NEXT_PUBLIC_APP_URL || "https://vtuber-match.vercel.app");
}

export function absoluteUrl(path = "") {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getSiteUrl()}${normalizedPath === "/" ? "" : normalizedPath}`;
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}
