import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";

import { getAdminDb } from "@/lib/firebaseAdmin";
import { pickRecommendations } from "@/lib/diagnosisRecommend";
import { normalizeStreamer, publicStreamerPath, streamerImagePath } from "@/lib/streamers";
import { readLocalStreamers } from "@/lib/localStore";
import type { DiagnosisScores } from "@/lib/diagnosis";

export const dynamic = "force-dynamic";

const axisKeys = ["f", "t", "a", "n", "v", "d"] as const;

// 配信者の一覧はリクエストごとに読むと重いのでキャッシュする。
// VTYPEの更新が反映されるまで最大1時間だが、マッチングの性質上それで足りる。
const readMatchCandidates = unstable_cache(
  async () => {
    const db = getAdminDb();
    if (!db) {
      return (await readLocalStreamers()).map((streamer) => ({ ...streamer }));
    }
    const snapshot = await db.collection("streamers")
      .select(
        "name",
        "is_visible",
        "is_deleted",
        "is_dummy",
        "withdrawal_status",
        "updated_at",
        "vtype_id",
        "vtype_code",
        "vtype_name",
        "vtype_scores",
      )
      .limit(500)
      .get();
    return snapshot.docs.map((doc) => normalizeStreamer(doc.id, doc.data()));
  },
  ["diagnosis-match-candidates"],
  { revalidate: 3600, tags: ["streamers"] },
);

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const scores = normalizeScores(body.scores);
    if (!scores) {
      return NextResponse.json({ error: "scores が不正です。" }, { status: 400 });
    }
    const limit = Math.max(1, Math.min(3, Number(body.limit) || 2));
    const candidates = await readMatchCandidates();
    const picks = pickRecommendations(scores, candidates, limit);

    return NextResponse.json({
      matches: picks.map((pick) => {
        const streamer = candidates.find((item) => item.id === pick.id);
        return {
          id: pick.id,
          name: pick.name,
          vtype_name: pick.vtypeName,
          path: publicStreamerPath({ id: pick.id, name: pick.name }),
          image: streamer ? streamerImagePath(streamer) : "",
        };
      }),
      candidateCount: candidates.length,
    });
  } catch (error) {
    // おすすめは結果表示の付加要素なので、失敗しても診断結果自体は壊さない。
    console.error("diagnosis recommend failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ matches: [] });
  }
}

function normalizeScores(value: unknown): DiagnosisScores | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  if (!axisKeys.every((key) => Number.isFinite(Number(source[key])))) return null;
  return Object.fromEntries(
    axisKeys.map((key) => [key, Math.max(0, Math.min(100, Number(source[key])))]),
  ) as DiagnosisScores;
}
