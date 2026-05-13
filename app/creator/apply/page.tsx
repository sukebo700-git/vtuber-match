import type { Metadata } from "next";
import ApplyPage from "@/app/apply/page";

export const metadata: Metadata = {
  title: "配信者として登録",
  description: "Vtuberマッチに配信者として無料掲載できます。写真、名前、YouTubeチャンネルURLから始められます。",
  alternates: {
    canonical: "/creator/apply",
  },
};

export default ApplyPage;
