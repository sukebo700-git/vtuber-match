import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

// 2026-09-26: 診断トップ(?type= が付いていないURL)のOGP画像。
// これまで /diagnosis/ui/ogp.webp を指していたが、実ファイルが 218x630 ではなく
// 218x207 しかなく、メタデータの width/height 1200x630 とも食い違っていた。
// X の summary_large_image は最低 300x157 を要求するため、カードが出なかった。
// 型別OGP(/api/diagnosis/og/[id])と同じ next/og で正しい寸法を動的に作る。
//
// 2026-09-26: 当初 /api/diagnosis/og-default に置いたが、robots.txt の
// Disallow: /api/ に前方一致して XのCard Validator が
// 「robots.txtで制限されている可能性」を警告し続けた。Allow を追加しても
// 解消しなかったため(クローラーによっては Allow の上書きを評価しない)、
// /api/ の外へ移してパス自体を曖昧さの無いものにする。
const size = { width: 1200, height: 630 };

type ModeCopy = { badge: string; lead: string; sub: string };

const copyByMode: Record<string, ModeCopy> = {
  viewer: {
    badge: "リスナー相性診断",
    lead: "相性のいいVTuberが分かる",
    sub: "30問・無料 / おすすめのVTuberも表示されます",
  },
  advanced: {
    badge: "VTYPE診断 100問Ver",
    lead: "あなたの配信スタイルを詳しく",
    sub: "100問・無料 / 6軸で細かく分析します",
  },
  light: {
    badge: "VTYPE診断 30問Ver",
    lead: "あなたの配信スタイルが分かる",
    sub: "30問・無料 / リスナー向けの相性診断もあります",
  },
};

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("mode") || "light";
  const copy = copyByMode[mode] || copyByMode.light;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 30,
          padding: "0 90px",
          background: "linear-gradient(135deg, #fff7fb 0%, #eefcff 45%, #f4edff 100%)",
          color: "#1f2738",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 16% 18%, rgba(255,63,145,0.34), transparent 24%), radial-gradient(circle at 72% 22%, rgba(255,196,84,0.26), transparent 24%), radial-gradient(circle at 76% 88%, rgba(255,122,82,0.28), transparent 30%)",
          }}
        />
        <div
          style={{
            display: "flex",
            borderRadius: 999,
            padding: "16px 34px",
            background: "linear-gradient(135deg, #ff4f97, #ff6a52)",
            color: "#fff",
            fontSize: 40,
            fontWeight: 900,
            boxShadow: "0 14px 30px rgba(255,106,82,0.24)",
            position: "relative",
          }}
        >
          {copy.badge}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 72,
            fontWeight: 900,
            color: "#2d3954",
            textAlign: "center",
            lineHeight: 1.25,
            position: "relative",
          }}
        >
          {copy.lead}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 34,
            fontWeight: 700,
            color: "#5b6580",
            position: "relative",
          }}
        >
          {copy.sub}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 8,
            fontSize: 30,
            fontWeight: 900,
            color: "#ff4f97",
            position: "relative",
          }}
        >
          VtuberMatch
        </div>
      </div>
    ),
    size,
  );
}
