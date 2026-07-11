import type { Metadata, Viewport } from "next";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { PublicFooter } from "@/components/PublicFooter";
import { ServiceWorker } from "@/components/ServiceWorker";
import { ShortVideoCampaignPopup } from "@/components/ShortVideoCampaignPopup";
import { VisitTracker } from "@/components/VisitTracker";
import { absoluteUrl, getSiteUrl, siteDescription, siteKeywords, siteName } from "@/lib/seo";
import "./globals.css";

const ogImage = absoluteUrl("/og-image-v2.png?v=20260612-1");

const mobileCriticalCss = `
  @media screen and (max-width: 760px) {
  html, body, .app-shell, .main, .landing-main, .swipe-page-main, .diagnosis-page, .diagnosis-shell {
    width: 100% !important;
    max-width: 100% !important;
    overflow-x: hidden !important;
  }
  *, *::before, *::after {
    box-sizing: border-box !important;
    max-width: 100% !important;
  }
  img, video, canvas, svg {
    max-width: 100% !important;
    height: auto !important;
  }
  .topbar {
    width: 100% !important;
    min-width: 0 !important;
    padding: 8px 10px !important;
    gap: 8px !important;
  }
  .topbar .nav {
    display: none !important;
  }
  .brand {
    max-width: 46vw !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    white-space: nowrap !important;
  }
  .header-auth-block {
    min-width: 0 !important;
    flex: 1 1 auto !important;
    justify-content: flex-end !important;
  }
  .main {
    padding: 5px !important;
  }
  .landing-hero, .swipe-stage, .detail-hero, .diagnosis-hero, .diagnosis-share-assets, .diagnosis-result-grid, .diagnosis-advanced-card, .diagnosis-match-main, .diagnosis-radar-insight-grid, .diagnosis-detail-grid, .diagnosis-deep-grid, .diagnosis-deep-grid.listener {
    display: grid !important;
    grid-template-columns: minmax(0, 1fr) !important;
    gap: 12px !important;
  }
  .landing-promo-row, .landing-actions {
    display: grid !important;
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    gap: 8px !important;
  }
  .landing-copy, .landing-visual, .side-panel, .diagnosis-hero-copy, .diagnosis-questions, .diagnosis-result, .diagnosis-hero {
    min-width: 0 !important;
    width: 100% !important;
  }
  .landing-phone {
    width: min(94vw, 420px) !important;
    height: clamp(390px, min(60dvh, calc(100dvh - 230px)), 620px) !important;
    max-height: none !important;
    transform: none !important;
    padding: 6px !important;
    justify-self: center !important;
  }
  .landing-card {
    padding: 5px !important;
    gap: 6px !important;
  }
  .landing-oshi-image {
    width: 100% !important;
    height: 100% !important;
    object-fit: contain !important;
    object-position: center top !important;
  }
  .landing-audience-row, .landing-visual-copy {
    width: min(100%, 330px) !important;
    transform: none !important;
  }
  .swipe-stage {
    min-height: auto !important;
    align-items: start !important;
  }
  .swipe-search, .viewer-profile-link, .side-panel .status-band, .more-toggle, .swipe-more-panel {
    width: min(100%, 414px) !important;
    justify-self: center !important;
  }
  .deck {
    width: min(100%, 360px) !important;
    min-width: 0 !important;
    justify-self: center !important;
  }
  .preview-card {
    display: none !important;
  }
  .diagnosis-shell {
    padding: 10px 9px 14px !important;
  }
  .diagnosis-hero, .diagnosis-questions, .diagnosis-result {
    padding: 14px !important;
    border-radius: 22px !important;
  }
  .diagnosis-start-actions, .diagnosis-nav-actions, .diagnosis-actions, .diagnosis-result-main-actions {
    display: grid !important;
    grid-template-columns: minmax(0, 1fr) !important;
    width: 100% !important;
  }
  .diagnosis-primary-button, .diagnosis-secondary-button, .primary-button, .secondary-button {
    max-width: 100% !important;
    white-space: normal !important;
    text-align: center !important;
  }
}
`;

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "VtuberMatch | 気になるVTuberを直感で探せるスワイプ型マッチング",
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
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
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
    title: "VtuberMatch | 新しい推しと出会える",
    description: siteDescription,
    images: [
      {
        url: ogImage,
        width: 1200,
        height: 630,
        alt: "VtuberMatch",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "VtuberMatch | 新しい推しと出会える",
    description: siteDescription,
    images: [ogImage],
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
        audienceType: "VTuber配信者",
      },
      {
        "@type": "Audience",
        audienceType: "Vtuber視聴者",
      },
    ],
  };

  return (
    <html lang="ja">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <style dangerouslySetInnerHTML={{ __html: mobileCriticalCss }} />
      </head>
      <body>
        <div data-build-marker="mobile-fix-20260612-5" hidden />
        <GoogleAnalytics />
        <ServiceWorker />
        <VisitTracker />
        {children}
        <ShortVideoCampaignPopup />
        <PublicFooter />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </body>
    </html>
  );
}
