// カット用SVG生成（仕様書6章）。opentype.jsでフォントをアウトラインパス化し、
// 単色・背景透明・mm単位・横幅固定・カス取り用外枠付きのSVGを組み立てる。
// サーバー(Node)専用。ユーザー文字は font.getPath でパスデータ化するため、
// 生の文字列をSVG/XMLへ挿入しない（XSS遮断・仕様15章）。
import fs from "fs";
import path from "path";
import opentype from "opentype.js";
import { DESIGN_WIDTH_MM } from "./types";
import type { TShirtDesignSize } from "./types";
import { getFontConfig } from "./fonts";

// 外枠（カス取り用フレーム）と文字の間の余白（mm）。仕様6.2: 上下左右20mmを初期値。
const FRAME_MARGIN_MM = 20;
// 外枠を viewBox の端から少し内側に置く（mm）。
const FRAME_INSET_MM = 2;
const FRAME_STROKE_MM = 0.3;
const CUT_COLOR = "#000000";
const NOMINAL_FONT_SIZE = 1000; // パス計算用の基準サイズ（px）。最終的にmmへスケールする。

// 読み込んだフォントをキャッシュ（リクエストごとの再読込を避ける）。
const fontCache = new Map<string, opentype.Font>();

function loadFont(fontFilePath: string): opentype.Font {
  const cached = fontCache.get(fontFilePath);
  if (cached) return cached;

  // Vercel等のサーバーレスでは実行時のcwdやバンドル配置が環境で異なるため、
  // 複数の候補パスを順に試す（outputFileTracingIncludesで同梱したファイルを確実に読む）。
  const rel = fontFilePath.replace(/^[./\\]+/, "");
  const base = rel.split(/[/\\]/).pop() || rel;
  const candidates = [
    path.join(process.cwd(), fontFilePath),
    path.join(process.cwd(), rel),
    path.join(__dirname, "fontfiles", base),
    path.join(process.cwd(), "lib/tshirt/fontfiles", base),
    path.join(process.cwd(), "public/tshirt-fonts", base),
  ];

  let buffer: Buffer | null = null;
  const tried: string[] = [];
  for (const candidate of candidates) {
    try {
      buffer = fs.readFileSync(candidate);
      break;
    } catch {
      tried.push(candidate);
    }
  }
  if (!buffer) {
    throw new Error(`font file not found: ${fontFilePath} (tried: ${tried.join(", ")})`);
  }

  // opentype.parse は ArrayBuffer を要求する。
  const font = opentype.parse(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
  );
  fontCache.set(fontFilePath, font);
  return font;
}

export type GenerateCutSvgInput = {
  text: string;
  fontId: string;
  size: TShirtDesignSize;
  mirror: boolean;
};

export type GeneratedSvg = {
  svg: string;
  widthMm: number; // viewBox全体幅（外枠込み）
  heightMm: number; // viewBox全体高さ（外枠込み）
  designWidthMm: number; // 文字デザインの横幅（S/M/L規定値）
  designHeightMm: number; // 文字デザインの高さ（比率維持）
  pathCount: number; // 生成された文字パス数（品質チェック用）
};

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export function generateCutSvg(input: GenerateCutSvgInput): GeneratedSvg {
  const font = getFontConfig(input.fontId);
  if (!font) throw new Error(`unknown fontId: ${input.fontId}`);
  const text = String(input.text || "");
  if (!text.trim()) throw new Error("empty text");

  const designWidthMm = DESIGN_WIDTH_MM[input.size];
  if (!designWidthMm) throw new Error(`invalid size: ${input.size}`);

  const loaded = loadFont(font.fontFilePath);

  // baseline を y=0 に置いて全文字のパスを取得（ascender は負のy）。
  const otPath = loaded.getPath(text, 0, 0, NOMINAL_FONT_SIZE);
  const bbox = otPath.getBoundingBox();
  const bboxW = bbox.x2 - bbox.x1;
  const bboxH = bbox.y2 - bbox.y1;
  if (!(bboxW > 0) || !(bboxH > 0)) {
    throw new Error("glyph bounding box is empty");
  }

  // 文字デザインの横幅を規定mmへ固定、高さは比率維持。
  const scale = designWidthMm / bboxW;
  const designHeightMm = round(bboxH * scale);

  // 全体（外枠込み）サイズ。文字は上下左右 FRAME_MARGIN_MM の余白の中に配置。
  const totalWidthMm = round(designWidthMm + FRAME_MARGIN_MM * 2);
  const totalHeightMm = round(designHeightMm + FRAME_MARGIN_MM * 2);

  // パスを mm 空間へ移す変換。bbox 左上を (FRAME_MARGIN, FRAME_MARGIN) に合わせる。
  const tx = round(FRAME_MARGIN_MM - bbox.x1 * scale);
  const ty = round(FRAME_MARGIN_MM - bbox.y1 * scale);

  // 数値のみのパスデータ（ユーザー文字列は含まれない）。
  const pathData = otPath.toPathData(2);
  const pathCount = (pathData.match(/M/gi) || []).length;

  // グループ変換で mm へスケール。ミラーは外側グループで左右反転。
  const glyphGroup =
    `<g transform="translate(${tx} ${ty}) scale(${round(scale)})">` +
    `<path d="${pathData}" fill="${CUT_COLOR}" fill-rule="nonzero"/>` +
    `</g>`;

  const frameX = FRAME_INSET_MM;
  const frameY = FRAME_INSET_MM;
  const frameW = round(totalWidthMm - FRAME_INSET_MM * 2);
  const frameH = round(totalHeightMm - FRAME_INSET_MM * 2);
  const frame =
    `<rect x="${frameX}" y="${frameY}" width="${frameW}" height="${frameH}" ` +
    `fill="none" stroke="${CUT_COLOR}" stroke-width="${FRAME_STROKE_MM}"/>`;

  const content = frame + glyphGroup;
  const mirrored = input.mirror
    ? `<g transform="translate(${totalWidthMm} 0) scale(-1 1)">${content}</g>`
    : content;

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" ` +
    `width="${totalWidthMm}mm" height="${totalHeightMm}mm" ` +
    `viewBox="0 0 ${totalWidthMm} ${totalHeightMm}">` +
    mirrored +
    `</svg>`;

  return {
    svg,
    widthMm: totalWidthMm,
    heightMm: totalHeightMm,
    designWidthMm,
    designHeightMm,
    pathCount,
  };
}
