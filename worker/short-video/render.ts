import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";

const workDir = path.join(process.cwd(), "worker", "short-video", "output");
const assetsDir = path.join(process.cwd(), "worker", "short-video", "assets");
const fontCandidates = [
  "C:/Windows/Fonts/meiryob.ttc",
  "C:/Windows/Fonts/meiryo.ttc",
  "C:/Windows/Fonts/YuGothB.ttc",
  "C:/Windows/Fonts/msgothic.ttc",
];

export type RenderInput = {
  requestId: string;
  name: string;
  introText: string;
  narrationWav: Buffer;
  thumbnailDataUrl?: string;
};

export function renderShortVideo(input: RenderInput): string {
  fs.mkdirSync(workDir, { recursive: true });
  const fontFile = fontCandidates.find((candidate) => fs.existsSync(candidate));
  if (!fontFile) throw new Error("日本語フォントが見つかりません(Meiryo/Yu Gothic)。");

  const narrationPath = path.join(workDir, `${input.requestId}-narration.wav`);
  fs.writeFileSync(narrationPath, input.narrationWav);
  const narrationDuration = probeDuration(narrationPath);
  const duration = Math.min(Math.max(narrationDuration + 1.6, 8), 179);

  const thumbnailPath = writeThumbnail(input.requestId, input.thumbnailDataUrl);
  const nameTextPath = writeTextFile(`${input.requestId}-name`, fitLine(input.name, 12));
  const introLines = wrapText(input.introText, 15, 8);
  const introLinePaths = introLines.map((line, index) => writeTextFile(`${input.requestId}-intro-${index}`, line));
  const brandTextPath = writeTextFile(`${input.requestId}-brand`, "VtuberMatch  |  VTuber紹介");
  const footerTextPath = writeTextFile(`${input.requestId}-footer`, "チャンネルは概要欄から / VtuberMatchで検索");
  const outputPath = path.join(workDir, `${input.requestId}.mp4`);

  const font = escapeFilterPath(fontFile);
  const drawCommon = `fontfile='${font}':fontcolor=white:borderw=3:bordercolor=0x141021`;
  // drawtext renders LF from textfile as a missing glyph, so draw each wrapped line separately.
  const introLineHeight = 74;
  const textLayers = [
    `drawtext=${drawCommon}:textfile='${escapeFilterPath(brandTextPath)}':fontsize=44:x=(w-text_w)/2:y=110`,
    `drawtext=${drawCommon}:textfile='${escapeFilterPath(nameTextPath)}':fontsize=88:x=(w-text_w)/2:y=1130`,
    ...introLinePaths.map((linePath, index) => (
      `drawtext=${drawCommon}:textfile='${escapeFilterPath(linePath)}':fontsize=46:x=(w-text_w)/2:y=${1290 + index * introLineHeight}`
    )),
    `drawtext=${drawCommon}:textfile='${escapeFilterPath(footerTextPath)}':fontsize=38:x=(w-text_w)/2:y=1800`,
  ].join(",");

  const bgmPath = path.join(assetsDir, "bgm.mp3");
  const hasBgm = fs.existsSync(bgmPath);

  const inputs: string[] = [
    "-f", "lavfi",
    "-i", `gradients=s=1080x1920:c0=0x2b1c4d:c1=0x0e0a1a:x0=540:y0=0:x1=540:y1=1920:r=30:d=${duration.toFixed(2)}`,
  ];
  let videoFilter: string;
  if (thumbnailPath) {
    inputs.push("-loop", "1", "-t", duration.toFixed(2), "-i", thumbnailPath);
    videoFilter = `[1:v]scale=860:860:force_original_aspect_ratio=decrease[thumb];[0:v][thumb]overlay=(W-w)/2:260,${textLayers},fade=t=in:st=0:d=0.6[v]`;
  } else {
    videoFilter = `[0:v]${textLayers},fade=t=in:st=0:d=0.6[v]`;
  }

  inputs.push("-i", narrationPath);
  const narrationIndex = thumbnailPath ? 2 : 1;
  let audioFilter: string;
  if (hasBgm) {
    inputs.push("-stream_loop", "-1", "-i", bgmPath);
    const bgmIndex = narrationIndex + 1;
    audioFilter = `[${bgmIndex}:a]volume=0.12[bgm];[${narrationIndex}:a][bgm]amix=inputs=2:duration=first:dropout_transition=2,apad=pad_dur=2[a]`;
  } else {
    audioFilter = `[${narrationIndex}:a]apad=pad_dur=2[a]`;
  }

  const args = [
    "-y",
    ...inputs,
    "-filter_complex", `${videoFilter};${audioFilter}`,
    "-map", "[v]",
    "-map", "[a]",
    "-t", duration.toFixed(2),
    "-r", "30",
    "-c:v", "libx264",
    "-preset", "medium",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-b:a", "160k",
    outputPath,
  ];
  execFileSync("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });

  return outputPath;
}

function probeDuration(filePath: string): number {
  const output = execFileSync("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    filePath,
  ], { encoding: "utf8" });
  const duration = Number(output.trim());
  if (!Number.isFinite(duration) || duration <= 0) throw new Error("ナレーション音声の長さを取得できませんでした。");
  return duration;
}

function writeThumbnail(requestId: string, dataUrl?: string): string | null {
  if (!dataUrl) return null;
  const match = /^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  const extension = match[1] === "jpeg" ? "jpg" : match[1];
  const filePath = path.join(workDir, `${requestId}-thumb.${extension}`);
  fs.writeFileSync(filePath, Buffer.from(match[2], "base64"));
  return filePath;
}

function writeTextFile(baseName: string, text: string): string {
  const filePath = path.join(workDir, `${baseName}.txt`);
  fs.writeFileSync(filePath, text, "utf8");
  return filePath;
}

function wrapText(text: string, lineLength: number, maxLines: number): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  const lines: string[] = [];
  for (let index = 0; index < normalized.length && lines.length < maxLines; index += lineLength) {
    lines.push(normalized.slice(index, index + lineLength));
  }
  if (normalized.length > lineLength * maxLines && lines.length) {
    lines[lines.length - 1] = `${lines[lines.length - 1].slice(0, lineLength - 1)}…`;
  }
  return lines;
}

function fitLine(text: string, maxLength: number): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}…` : normalized;
}

function escapeFilterPath(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/:/g, "\\:");
}

export function cleanupRenderFiles(requestId: string) {
  if (!fs.existsSync(workDir)) return;
  for (const file of fs.readdirSync(workDir)) {
    if (file.startsWith(requestId) && !file.endsWith(".mp4")) {
      fs.rmSync(path.join(workDir, file), { force: true });
    }
  }
}
