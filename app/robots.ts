import type { MetadataRoute } from "next";
import { absoluteUrl, getSiteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: [
          "GPTBot",
          "ChatGPT-User",
          "CCBot",
          "ClaudeBot",
          "anthropic-ai",
          "PerplexityBot",
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
