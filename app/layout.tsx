import type { Metadata, Viewport } from "next";
import { PublicFooter } from "@/components/PublicFooter";
import { ServiceWorker } from "@/components/ServiceWorker";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vtuberマッチ",
  description: "YouTube配信者と視聴者をつなぐスワイプ型マッチングサービス",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Vtuberマッチ",
    statusBarStyle: "black-translucent"
  }
};

export const viewport: Viewport = {
  themeColor: "#17211d",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <ServiceWorker />
        {children}
        <PublicFooter />
      </body>
    </html>
  );
}
