import type { Metadata } from "next";
import ApplyPage from "@/app/apply/page";

export const metadata: Metadata = {
  title: "VTuberとして無料掲載",
  description: "VtuberMatchにVTuberとして無料掲載できます。画像、名前、配信サイトURL、自己アピールを登録して、視聴者に知ってもらうきっかけを作れます。",
  alternates: {
    canonical: "/creator/apply",
  },
};

export default ApplyPage;
