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
const defaultDescription = "30問でわかるあなたの配信スタイル。リスナー診断もあります。";

type DiagnosisPageProps = {
  searchParams?: {
    type?: string;
  };
};

export function generateMetadata({ searchParams }: DiagnosisPageProps): Metadata {
  const typeId = Number(searchParams?.type);
  const type = diagnosisTypes.find((item) => item.id === typeId);

  if (type) {
    const resultUrl = `${baseUrl}/diagnosis?type=${type.id}`;
    const imageUrl = `${baseUrl}/diagnosis/og/light-${type.id}.jpg?v=${ogImageVersion}`;
    const title = `診断結果は【${type.code}:${type.name}（30問Ver）】でした | VTYPE診断`;
    const description = `${type.name}タイプに近い回答傾向でした。VtuberMatchのリスナー診断もあります。`;
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
  const image = { url: `${baseUrl}/api/diagnosis/og-default?mode=light&v=${ogImageVersion}`, width: 1200, height: 630, alt: "VTYPE診断" };

  return {
    title: "VTYPE診断",
    description: defaultDescription,
    alternates: { canonical: `${baseUrl}/diagnosis` },
    openGraph: {
      type: "website",
      title: "VTYPE診断",
      description: defaultDescription,
      url: `${baseUrl}/diagnosis`,
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

export default function DiagnosisPage({ searchParams }: DiagnosisPageProps) {
  const typeId = Number(searchParams?.type);
  const previewTypeId = diagnosisTypes.some((item) => item.id === typeId) ? typeId : undefined;

  return <DiagnosisApp mode="light" previewTypeId={previewTypeId} />;
}
