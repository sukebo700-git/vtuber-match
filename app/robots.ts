import type { MetadataRoute } from "next";
import { absoluteUrl, getSiteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // 2026-09-24: AI検索のクローラーを一律ブロックしていたため、
      // ChatGPT / Claude / Perplexity の回答にVtuberMatchが出てこない状態だった。
      // 「VTuberを見つけてもらう」のが目的のサービスなので、回答に載る側に倒す。
      //
      // 残してあるのは、クロール量の割に流入の見返りが薄いもの:
      // - CCBot     : Common Crawl。一括収集で、ここからの流入は発生しない
      // - Bytespider: ByteDance。クロールが攻撃的との報告が多い
      // - Amazonbot : 同上、流入に繋がらない
      //
      // 許可側(GPTBot / ChatGPT-User / ClaudeBot / PerplexityBot など)は
      // この配列から外すことで、下の "*" ルールが適用される。
      // コスト面: SEO対象の /vtuber/[slug] は revalidate 86400 のISR、
      // 画像APIも s-maxage=3600 でCDNキャッシュされるため、
      // クロールが増えてもFirestore読み取りは増えにくい。
      {
        userAgent: [
          "CCBot",
          "Bytespider",
          "Amazonbot",
        ],
        disallow: "/",
      },
      {
        userAgent: "*",
        allow: ["/", "/api/streamer-image/"],
        disallow: [
          "/admin",
          "/admin-login",
          "/api/",
          "/checkout",
          "/checkout/success",
          "/password-reset",
          "/creator/edit",
          "/creator/login",
          "/creator/upgrade",
          "/viewer/register",
        ],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: getSiteUrl(),
  };
}
