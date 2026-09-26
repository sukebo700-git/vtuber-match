import type { Metadata } from "next";

import DiagnosisApp from "@/components/DiagnosisApp";
import { diagnosisTypes } from "@/lib/diagnosis";
import { getSiteUrl } from "@/lib/seo";

// 2026-09-26: ここだけ www 無しを直書きしており、サイト全体(lib/seo.ts の
// getSiteUrl は www 付きを返す)と canonical のドメインが分裂していた。
// vtubermatch.com は www へ307リダイレクトするため、canonical が
// リダイレクト元を指す状態になっていた。共通の定義に寄せる。
const baseUrl = getSiteUrl();
const ogImageVersion = "20260613-1";
const defaultDescription = "30問であなたと相性がいいVTuberタイプがわかるリスナー向け診断です。";

type ViewerDiagnosisPageProps = {
  searchParams?: {
    type?: string;
  };
};

export function generateMetadata({ searchParams }: ViewerDiagnosisPageProps): Metadata {
  const typeId = Number(searchParams?.type);
  const type = diagnosisTypes.find((item) => item.id === typeId);

  if (type) {
    const resultUrl = `${baseUrl}/diagnosis/viewer?type=${type.id}`;
    const imageUrl = `${baseUrl}/diagnosis/og/viewer-${type.id}.jpg?v=${ogImageVersion}`;
    const title = `私と相性がいいVTuberは【${type.code}:${type.name}タイプ】でした | VTYPE診断`;
    const description = `${type.name}タイプのVTuberと相性がいい傾向があるみたいです。`;
    const image = {
      url: imageUrl,
      width: 1200,
      height: 630,
      alt: `${type.code}:${type.name}のVTYPE診断結果`,
    };

    return {
      title,
      description,
      alternates: { canonical: resultUrl },
      openGraph: {
        type: "website",
        title,
        description,
        url: resultUrl,
        images: [image],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [image],
      },
    };
  }

  // 2026-09-26: 旧 /diagnosis/ui/ogp.webp は実寸 218x207 しかなく、
  // ここで宣言している 1200x630 と食い違っていたためOGPカードが出なかった。
  // 型別OGPと同じ next/og で正しい寸法を動的に生成する。
  const image = { url: `${baseUrl}/diagnosis/og-default?mode=viewer&v=${ogImageVersion}`, width: 1200, height: 630, alt: "VTYPE診断" };

  return {
    title: "リスナー向け 相性診断 | VTYPE診断",
    description: defaultDescription,
    alternates: { canonical: `${baseUrl}/diagnosis/viewer` },
    openGraph: {
      type: "website",
      title: "VTYPE診断",
      description: defaultDescription,
      url: `${baseUrl}/diagnosis/viewer`,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: "VTYPE診断",
      description: defaultDescription,
      images: [image],
    },
  };
}

export default function ViewerDiagnosisPage({ searchParams }: ViewerDiagnosisPageProps) {
  const typeId = Number(searchParams?.type);
  const previewTypeId = diagnosisTypes.some((item) => item.id === typeId) ? typeId : undefined;

  return <DiagnosisApp mode="viewer" previewTypeId={previewTypeId} />;
}
