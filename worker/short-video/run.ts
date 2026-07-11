import { loadEnvLocal } from "./env";

loadEnvLocal();

import { FieldValue, getAdminDb } from "../../lib/firebaseAdmin";
import { cleanupRenderFiles, renderShortVideo } from "./render";
import { uploadToYouTube } from "./upload";
import { synthesizeNarration } from "./voicevox";

const pollIntervalMs = 60_000;

async function main() {
  const db = getAdminDb();
  if (!db) {
    throw new Error("Firebase admin env が読み込めません。.env.local の FIREBASE_* を確認してください。");
  }

  const watchMode = process.argv.includes("--watch");
  do {
    const processed = await processApprovedRequests(db);
    if (!processed && !watchMode) {
      console.log("GO済み(approved)の依頼はありません。");
    }
    if (watchMode) await sleep(pollIntervalMs);
  } while (watchMode);
}

async function processApprovedRequests(db: FirebaseFirestore.Firestore): Promise<number> {
  const snapshot = await db.collection("short_video_requests")
    .where("status", "==", "approved")
    .limit(5)
    .get();

  let processed = 0;
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const name = String(data.name || "");
    const introText = String(data.intro_text || "").trim();
    console.log(`[${doc.id}] ${name} の動画制作を開始します...`);

    if (!introText) {
      console.warn(`[${doc.id}] 紹介テキストが空のためスキップします。管理画面で入力してください。`);
      continue;
    }

    await doc.ref.update({ status: "rendering", worker_error: FieldValue.delete(), updated_at: FieldValue.serverTimestamp() });
    try {
      const thumbnailDataUrl = await readStreamerThumbnail(db, String(data.streamer_id || ""));
      console.log(`[${doc.id}] ナレーションを合成しています(VOICEVOX)...`);
      const narrationWav = await synthesizeNarration(introText);
      console.log(`[${doc.id}] 動画をレンダリングしています(ffmpeg)...`);
      const videoPath = renderShortVideo({
        requestId: doc.id,
        name,
        introText,
        narrationWav,
        thumbnailDataUrl,
      });
      console.log(`[${doc.id}] YouTubeへ非公開アップロードしています...`);
      const videoId = await uploadToYouTube({
        videoPath,
        name,
        introText,
        youtubeUrl: String(data.youtube_url || ""),
        xAccount: String(data.x_account || ""),
      });
      await doc.ref.update({
        status: "uploaded",
        youtube_video_id: videoId,
        uploaded_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      });
      cleanupRenderFiles(doc.id);
      console.log(`[${doc.id}] 完了: https://www.youtube.com/watch?v=${videoId} (非公開)`);
      processed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[${doc.id}] 失敗: ${message}`);
      await doc.ref.update({
        status: "approved",
        worker_error: message.slice(0, 500),
        updated_at: FieldValue.serverTimestamp(),
      });
    }
  }
  return processed;
}

async function readStreamerThumbnail(db: FirebaseFirestore.Firestore, streamerId: string): Promise<string | undefined> {
  if (!streamerId) return undefined;
  const doc = await db.collection("streamers").doc(streamerId).get();
  const thumbnails = doc.data()?.thumbnails;
  const first = Array.isArray(thumbnails) ? String(thumbnails[0] || "") : "";
  return first.startsWith("data:image/") ? first : undefined;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
