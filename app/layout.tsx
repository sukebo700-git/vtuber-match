import type { Metadata, Viewport } from "next";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { PublicFooter } from "@/components/PublicFooter";
import { ServiceWorker } from "@/components/ServiceWorker";
import { VisitTracker } from "@/components/VisitTracker";
import { absoluteUrl, getSiteUrl, siteDescription, siteKeywords, siteName } from "@/lib/seo";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "Vtuberマッチ | 登録無料で推しVtuberを探せるスワイプ型マッチング",
    template: `%s | ${siteName}`,
  },
  description: siteDescription,
  keywords: siteKeywords,
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
    : undefined,
  applicationName: siteName,
  authors: [{ name: "VtuberMatch" }],
  creator: "VtuberMatch",
  publisher: "VtuberMatch",
  manifest: "/manifest.json",
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "ja_JP",
    url: "/",
    siteName,
    title: "Vtuberマッチ | 登録無料で推しVtuberを探せる",
    description: siteDescription,
    images: [
      {
        url: "/promo/landing-oshi.png",
        width: 1200,
        height: 630,
        alt: "Vtuberマッチ",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Vtuberマッチ | 登録無料で推しVtuberを探せる",
    description: siteDescription,
    images: ["/promo/landing-oshi.png"],
  },
  category: "matching service",
  appleWebApp: {
    capable: true,
    title: siteName,
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#17211d",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: siteName,
    url: absoluteUrl(),
    applicationCategory: "EntertainmentApplication",
    operatingSystem: "Web",
    description: siteDescription,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "JPY",
      availability: "https://schema.org/InStock",
    },
    audience: [
      {
        "@type": "Audience",
        audienceType: "Vtuber配信者",
      },
      {
        "@type": "Audience",
        audienceType: "Vtuber視聴者",
      },
    ],
  };

  return (
    <html lang="ja">
      <body>
        <GoogleAnalytics />
        <ServiceWorker />
        <VisitTracker />
        {children}
        <PublicFooter />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </body>
    </html>
  );
}
