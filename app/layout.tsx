import type { Metadata, Viewport } from "next";
import { PublicFooter } from "@/components/PublicFooter";
import { ServiceWorker } from "@/components/ServiceWorker";
import { VisitTracker } from "@/components/VisitTracker";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vtuberマッチ",
  description: "Vtuber配信者と新しい推しを探したい視聴者をつなぐスワイプ型マッチングサービス",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Vtuberマッチ",
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
  return (
    <html lang="ja">
      <body>
        <ServiceWorker />
        <VisitTracker />
        {children}
        <PublicFooter />
      </body>
    </html>
  );
}
