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
const defaultDescription = "VTYPE診断の100問版。配信スタイルをより詳しく診断します。";

type AdvancedDiagnosisPageProps = {
  searchParams?: {
    type?: string;
  };
};

export function generateMetadata({ searchParams }: AdvancedDiagnosisPageProps): Metadata {
  const typeId = Number(searchParams?.type);
  const type = diagnosisTypes.find((item) => item.id === typeId);

  if (type) {
    const resultUrl = `${baseUrl}/diagnosis/advanced?type=${type.id}`;
    const imageUrl = `${baseUrl}/diagnosis/og/advanced-${type.id}.jpg?v=${ogImageVersion}`;
    const title = `診断結果は【${type.code}:${type.name}（100問Ver）】でした | VTYPE診断`;
    const description = `${type.name}タイプに近い回答傾向でした。VTYPE診断の詳細版です。`;
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
  const image = { url: `${baseUrl}/diagnosis/og-default?mode=advanced&v=${ogImageVersion}`, width: 1200, height: 630, alt: "VTYPE診断" };

  return {
    title: "100問の詳細診断 | VTYPE診断",
    description: defaultDescription,
    alternates: { canonical: `${baseUrl}/diagnosis/advanced` },
    openGraph: {
      type: "website",
      title: "VTYPE診断",
      description: defaultDescription,
      url: `${baseUrl}/diagnosis/advanced`,
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

export default function AdvancedDiagnosisPage({ searchParams }: AdvancedDiagnosisPageProps) {
  const typeId = Number(searchParams?.type);
  const previewTypeId = diagnosisTypes.some((item) => item.id === typeId) ? typeId : undefined;

  return <DiagnosisApp mode="advanced" previewTypeId={previewTypeId} />;
}
