import fs from "fs";
import { getAccessToken } from "./youtubeAuth";

export type UploadInput = {
  videoPath: string;
  name: string;
  introText: string;
  youtubeUrl?: string;
  xAccount?: string;
};

export async function uploadToYouTube(input: UploadInput): Promise<string> {
  const accessToken = await getAccessToken();
  const title = `【VTuber紹介】${input.name} #Shorts`.slice(0, 95);
  const descriptionLines = [
    input.introText,
    "",
    input.youtubeUrl ? `チャンネル: ${input.youtubeUrl}` : "",
    input.xAccount ? `X: ${input.xAccount}` : "",
    "",
    "VtuberMatch - 気になるVTuberと直感で出会える",
    "https://vtuber-match.vercel.app",
    "",
    "#VTuber #Shorts #VtuberMatch",
  ].filter((line, index, lines) => line !== "" || lines[index - 1] !== "");

  const metadata = {
    snippet: {
      title,
      description: descriptionLines.join("\n").slice(0, 4900),
      tags: [input.name, "VTuber", "VtuberMatch"].filter(Boolean).slice(0, 10),
      categoryId: "24",
      defaultLanguage: "ja",
    },
    status: {
      privacyStatus: "private",
      selfDeclaredMadeForKids: false,
    },
  };

  const videoBytes = fs.readFileSync(input.videoPath);
  const startResponse = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": "video/mp4",
        "X-Upload-Content-Length": String(videoBytes.length),
      },
      body: JSON.stringify(metadata),
    }
  );
  if (!startResponse.ok) {
    throw new Error(`YouTube upload start failed: ${startResponse.status} ${await startResponse.text()}`);
  }
  const uploadUrl = startResponse.headers.get("location");
  if (!uploadUrl) throw new Error("YouTube resumable upload URL was not returned.");

  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "video/mp4",
      "Content-Length": String(videoBytes.length),
    },
    body: videoBytes,
  });
  const result = await uploadResponse.json().catch(() => ({}));
  if (!uploadResponse.ok || !result.id) {
    throw new Error(`YouTube upload failed: ${uploadResponse.status} ${JSON.stringify(result)}`);
  }
  return String(result.id);
}
