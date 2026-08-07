import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { ResumeDocument, RESUME_CANVAS_SIZE, type ResumeSourceStreamer } from "@/lib/resume/layout";
import { creatorSessionCookie, readUserSession } from "@/lib/userSession";

// next/ogのImageResponseはEdge/Node両方で動くが、フォント2本(計8.8MB)を
// バンドルに同梱するためNode runtimeを使う(Edge Functionはデプロイサイズ上限が厳しい)。
// フォントファイルはoutputFileTracingIncludes(next.config.mjs)でこのルートの
// サーバーレスバンドルに明示的に含めている。

async function loadFonts() {
  const fontsDir = path.join(process.cwd(), "lib/resume/fonts");
  const [regular, bold] = await Promise.all([
    readFile(path.join(fontsDir, "NotoSansJP-ResumeSubset-Regular.otf")),
    readFile(path.join(fontsDir, "NotoSansJP-ResumeSubset-Bold.otf")),
  ]);
  return { regular, bold };
}

export async function GET(request: NextRequest) {
  // --- 1. 認証(本人確認) ---
  // 他人のstreamer_idを指定して他人の履歴書を生成できないよう、常にセッション由来の
  // streamer_idのみを使う(クエリパラメータ等の入力は一切受け付けない)。
  const session = readUserSession<{ streamer_id?: string }>(request, creatorSessionCookie);
  const streamerId = session?.streamer_id;
  if (!streamerId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // --- 2. 本人のstreamersドキュメント取得 ---
  const db = getAdminDb();
  if (!db) {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
  const doc = await db.collection("streamers").doc(streamerId).get();
  if (!doc.exists) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const data = doc.data() || {};

  // --- 3. オプトイン確認 ---
  if (data.resumePublicOptIn === false) {
    return NextResponse.json({ error: "resume_disabled" }, { status: 403 });
  }

  const streamer: ResumeSourceStreamer = {
    name: data.name || "",
    yomigana: typeof data.yomi === "string" ? data.yomi : "",
    genres: Array.isArray(data.categories) ? data.categories : [],
    timeSlot: data.stream_time || "",
    appeal: data.description || "",
    iconDataUri: Array.isArray(data.thumbnails) ? data.thumbnails[0] : undefined,
    xAccount: typeof data.x_account === "string" ? data.x_account : "",
    youtubeUrl: typeof data.youtube_url === "string" ? data.youtube_url : "",
    debutDate: data.debutDate,
    birthday: data.birthday,
    birthdayVisible: data.birthdayVisible === true,
    activityRegion: data.activityRegion,
    publicContact: data.publicContact,
    streamingPlatform: data.streamingPlatform,
    personalityType: data.personalityType,
    fanName: data.fanName,
    fanMark: data.fanMark,
    hashtags: Array.isArray(data.hashtags) ? data.hashtags : [],
    activityHistory: Array.isArray(data.activityHistory) ? data.activityHistory : [],
    achievements: Array.isArray(data.achievements) ? data.achievements : [],
    equipment: Array.isArray(data.equipment) ? data.equipment : [],
    messageToNewcomers: data.messageToNewcomers,
    resumeIconZoom: data.resumeIconZoom,
    resumeIconPanX: data.resumeIconPanX,
    resumeIconPanY: data.resumeIconPanY,
  };

  // --- 4. 生成 ---
  try {
    const { regular, bold } = await loadFonts();

    const image = new ImageResponse(ResumeDocument({ streamer }) as JSX.Element, {
      width: RESUME_CANVAS_SIZE.width,
      height: RESUME_CANVAS_SIZE.height,
      fonts: [
        { name: "Noto Sans CJK JP", data: regular, weight: 400, style: "normal" },
        { name: "Noto Sans CJK JP", data: bold, weight: 700, style: "normal" },
      ],
    });

    // 個人データのため公開キャッシュ不可(OGP画像とは異なる扱い)
    image.headers.set("Cache-Control", "private, no-store");
    image.headers.set(
      "Content-Disposition",
      `attachment; filename="vtubermatch_resume_${streamerId}.png"`
    );
    return image;
  } catch (err) {
    // フォント読み込み失敗・レイアウト崩れ等。ログにstreamer_idを残し、デプロイ漏れの早期発見に使う
    console.error(`[resume/generate] failed for streamer_id=${streamerId}:`, err);
    return NextResponse.json({ error: "generation_failed" }, { status: 500 });
  }
}
