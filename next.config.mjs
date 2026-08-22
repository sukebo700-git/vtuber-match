/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Tシャツのカット用SVG生成(opentype.js)はサーバー側でttfを読むため、
    // 該当ルートのサーバーレスバンドルにフォントファイルを同梱する。
    // Next.js 14ではexperimental配下でないと認識されない(トップレベル指定は無視される)。
    outputFileTracingIncludes: {
      "/api/stripe/webhook": ["./lib/tshirt/fontfiles/**", "./public/tshirt-fonts/**"],
      "/api/admin/tshirt-orders/**": ["./lib/tshirt/fontfiles/**", "./public/tshirt-fonts/**"],
      "/api/resume/generate": ["./lib/resume/fonts/**"],
    },
  },
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 86400,
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "i.ytimg.com" }
    ]
  },
  async redirects() {
    return [
      {
        source: "/viewer/plan",
        destination: "/viewer",
        permanent: false
      }
    ];
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
          { key: "Service-Worker-Allowed", value: "/" }
        ]
      },
      {
        source: "/diagnosis/ui/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" }
        ]
      },
      {
        source: "/diagnosis/types/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" }
        ]
      },
      {
        source: "/diagnosis/og/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" }
        ]
      },
      {
        source: "/promo/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" }
        ]
      },
      {
        source: "/og-image.png",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" }
        ]
      },
      {
        source: "/og-image-v2.png",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" }
        ]
      },
      {
        source: "/og-image.jpg",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" }
        ]
      },
      {
        source: "/og-image-v2.jpg",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" }
        ]
      },
      {
        source: "/api/diagnosis/og/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000" }
        ]
      }
    ];
  }
};

export default nextConfig;
