import type { Metadata } from "next";

import DiagnosisApp from "@/components/DiagnosisApp";
import { diagnosisTypes } from "@/lib/diagnosis";

const baseUrl = "https://vtubermatch.com";
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

  const image = { url: `${baseUrl}/diagnosis/ui/ogp.webp?v=${ogImageVersion}`, width: 1200, height: 630, alt: "VTYPE診断" };

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
