import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

import { diagnosisTypes } from "@/lib/diagnosis";

export const runtime = "edge";

const size = {
  width: 1200,
  height: 630,
};

const ogImageVersion = "20260613-1";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const typeId = Number(params.id);
  const type = diagnosisTypes.find((item) => item.id === typeId) || diagnosisTypes[0];
  const mode = request.nextUrl.searchParams.get("mode");
  const version = mode === "advanced" ? "100問Ver" : mode === "viewer" ? "リスナー診断" : "30問Ver";
  const lead = mode === "viewer" ? "私と相性がいいVTuberは" : "診断結果は";
  const imageUrl = new URL(`/diagnosis/types/${type.id}.webp?v=${ogImageVersion}`, request.url).toString();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          overflow: "hidden",
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
              "radial-gradient(circle at 16% 18%, rgba(255,63,145,0.34), transparent 24%), radial-gradient(circle at 72% 22%, rgba(34,199,232,0.26), transparent 24%), radial-gradient(circle at 76% 88%, rgba(155,92,255,0.28), transparent 30%)",
          }}
        />
        <div
          style={{
            width: 500,
            height: 590,
            marginLeft: 42,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 36,
            background: "rgba(255,255,255,0.72)",
            boxShadow: "0 28px 70px rgba(31,39,56,0.16)",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <img
            src={imageUrl}
            alt=""
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              objectPosition: "center",
            }}
          />
        </div>
        <div
          style={{
            width: 590,
            height: 560,
            marginRight: 44,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 22,
            position: "relative",
          }}
        >
          <div
            style={{
              display: "flex",
              width: "fit-content",
              borderRadius: 999,
              padding: "13px 20px",
              background: "linear-gradient(135deg, #ff3f91, #9b5cff)",
              color: "#fff",
              fontSize: 34,
              fontWeight: 900,
              letterSpacing: 0,
              boxShadow: "0 14px 30px rgba(155,92,255,0.24)",
            }}
          >
            VTYPE診断
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontSize: 38, fontWeight: 900, color: "#2d3954" }}>{lead}</div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                padding: "24px 28px",
                border: "3px solid rgba(255,63,145,0.22)",
                borderRadius: 30,
                background: "rgba(255,255,255,0.86)",
              }}
            >
              <div style={{ fontSize: 42, fontWeight: 1000, color: "#7b35d8" }}>{type.code}</div>
              <div
                style={{
                  fontSize: type.name.length >= 12 ? 50 : 60,
                  fontWeight: 1000,
                  lineHeight: 1.08,
                  color: "#111827",
                }}
              >
                {type.name}
              </div>
              <div style={{ fontSize: 30, fontWeight: 900, color: "#ff3f91" }}>{version}</div>
            </div>
          </div>
          <div style={{ display: "flex", fontSize: 28, fontWeight: 900, color: "#124c73" }}>
            vtubermatch.com/diagnosis
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      headers: {
        "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000",
      },
    }
  );
}
