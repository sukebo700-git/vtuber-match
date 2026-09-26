import { diagnosisTypes, type DiagnosisScores } from "@/lib/diagnosis";
import type { Streamer } from "@/lib/types";

// 診断結果のあとに出す「あなたへのおすすめVTuber」。
//
// 当初は相性%を出すマッチング機能として作ったが、以下の理由でおすすめ方式に変えた。
//  - VTYPEを持つ配信者は184人中63人。%方式だと残り121人が永久に対象外になる
//  - 実際の軸スコアを持つのは40人だけで、残りはタイプの重心で代用している。
//    その精度で「92%」のような数字を出すのは、データの確からしさを超えている
//
// ただし完全なランダムでは「なぜこの人?」が無くなるため、1枠目だけ診断の傾向で
// 寄せる。f軸(盛り上げ↔まったり)など6軸の近さを重みに使い、まったり寄りの人には
// まったり寄りの配信者が出やすくする。2枠目は全員のプールから引いて、
// VTYPE未設定の配信者にも露出が回るようにする。

const axisKeys = ["f", "t", "a", "n", "v", "d"] as const;

export type RecommendedStreamer = {
  id: string;
  name: string;
  vtypeName: string;
};

type Candidate = Pick<
  Streamer,
  "id" | "name" | "vtype_id" | "vtype_name" | "vtype_scores" | "is_visible" | "is_deleted" | "is_dummy" | "withdrawal_status"
>;

export function pickRecommendations(
  scores: DiagnosisScores,
  candidates: Candidate[],
  limit = 2,
): RecommendedStreamer[] {
  const eligible = candidates.filter(isEligible);
  if (!eligible.length) return [];

  const picked: Candidate[] = [];

  // 1枠目: 診断の傾向が近い配信者から。上位プールの中で重み付き抽選するので、
  // 傾向は反映しつつ毎回同じ人にはならない。
  const typed = eligible
    .map((streamer) => ({ streamer, closeness: closenessScore(scores, streamer) }))
    .filter((item): item is { streamer: Candidate; closeness: number } => item.closeness !== null)
    .sort((a, b) => b.closeness - a.closeness);
  if (typed.length) {
    const pool = typed.slice(0, Math.max(10, limit * 5));
    const chosen = weightedPick(pool.map((item) => ({ item: item.streamer, weight: Math.pow(item.closeness + 1, 2) })));
    if (chosen) picked.push(chosen);
  }

  // 2枠目以降: VTYPE未設定の配信者も含めた全体から均等に。
  // ここが無いと121人に露出が回らない。
  while (picked.length < limit) {
    const rest = eligible.filter((streamer) => !picked.some((item) => item.id === streamer.id));
    if (!rest.length) break;
    picked.push(rest[Math.floor(Math.random() * rest.length)]);
  }

  return picked.map((streamer) => ({
    id: streamer.id,
    name: streamer.name || "",
    vtypeName: streamer.vtype_name || "",
  })).filter((item) => item.name);
}

function isEligible(streamer: Candidate) {
  if (streamer.is_deleted === true) return false;
  if (streamer.is_visible === false) return false;
  if (streamer.is_dummy === true) return false;
  if (streamer.withdrawal_status && streamer.withdrawal_status !== "none") return false;
  return Boolean(streamer.name);
}

// 6軸の距離を0〜100の近さに直す。VTYPEを持たない配信者は判定できないので null。
function closenessScore(scores: DiagnosisScores, streamer: Candidate): number | null {
  const profile = resolveScores(streamer);
  if (!profile) return null;
  const squared = axisKeys.reduce((sum, key) => {
    const diff = clamp(scores[key]) - clamp(profile[key]);
    return sum + diff * diff;
  }, 0);
  const maxDistance = Math.sqrt(axisKeys.length * 100 * 100);
  return Math.max(0, Math.min(100, Math.round((1 - Math.sqrt(squared) / maxDistance) * 100)));
}

function resolveScores(streamer: Candidate): DiagnosisScores | null {
  const raw = streamer.vtype_scores as Record<string, unknown> | undefined;
  if (raw && axisKeys.every((key) => Number.isFinite(Number(raw[key])))) {
    return Object.fromEntries(axisKeys.map((key) => [key, Number(raw[key])])) as DiagnosisScores;
  }
  // 軸スコアが無い配信者は、選んだタイプの重心を本人のスコアとみなす。
  const type = diagnosisTypes.find((item) => item.id === Number(streamer.vtype_id));
  return type ? type.centroid : null;
}

function clamp(value: number) {
  if (!Number.isFinite(value)) return 50;
  return Math.max(0, Math.min(100, value));
}

function weightedPick<T>(entries: Array<{ item: T; weight: number }>): T | null {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  if (!entries.length || total <= 0) return null;
  let threshold = Math.random() * total;
  for (const entry of entries) {
    threshold -= entry.weight;
    if (threshold <= 0) return entry.item;
  }
  return entries[entries.length - 1].item;
}
