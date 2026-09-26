import { diagnosisTypes, type DiagnosisScores } from "@/lib/diagnosis";
import type { Streamer } from "@/lib/types";

// 視聴者診断(リスナー相性診断)の結果は「相性のいいVTuberタイプ」として出るため、
// 配信者側が持つVTYPE(同じ6軸)とそのまま比較できる。ここでは回答スコアと
// 配信者のvtype_scoresの距離を取り、近い配信者を返す。
//
// 配信者のデータには2種類ある(2026-09-26時点: 100人中64人が軸スコアあり):
//  - vtype_scores あり: 6軸の距離で細かく測れる
//  - vtype_id のみ    : タイプの重心(centroid)を代理のスコアとして使う
// 後者は精度が落ちるので、同点のときは前者を優先する。

const axisKeys = ["f", "t", "a", "n", "v", "d"] as const;

export type StreamerMatch = {
  id: string;
  name: string;
  affinity: number;
  vtypeName: string;
  vtypeCode: string;
  // 軸スコアを持つ配信者との比較かどうか。UIで精度の出し分けはしないが、
  // 並び順の安定化に使う。
  precise: boolean;
};

type MatchCandidate = Pick<
  Streamer,
  "id" | "name" | "vtype_id" | "vtype_code" | "vtype_name" | "vtype_scores" | "is_visible" | "is_deleted" | "is_dummy" | "withdrawal_status"
>;

export function findStreamerMatches(
  scores: DiagnosisScores,
  candidates: MatchCandidate[],
  limit = 3,
): StreamerMatch[] {
  const scored = candidates
    .filter(isMatchable)
    .map((streamer) => {
      const profile = resolveStreamerScores(streamer);
      if (!profile) return null;
      return {
        id: streamer.id,
        name: streamer.name || "",
        affinity: affinityPercent(scores, profile.scores),
        vtypeName: streamer.vtype_name || "",
        vtypeCode: streamer.vtype_code || "",
        precise: profile.precise,
      };
    })
    .filter((item): item is StreamerMatch => Boolean(item && item.name));

  // 配信者の分布は偏っている(最多17人 / 最少1人)。純粋な距離順だと同じ人が
  // 出続けて掲載機会が偏るため、相性が僅差(2ポイント以内)の候補はシャッフルして
  // から並べる。上位の顔ぶれは保ちつつ、誰が先頭に出るかは毎回変わる。
  //
  // ここで precise(軸スコアの有無)を優先順位に使うと、同率のとき必ず同じ人が
  // 先頭になりシャッフルが打ち消される。精度の差は算出済みの相性値に既に
  // 反映されているため、並び順では相性値だけを見る。
  const shuffled = shuffle(scored);
  shuffled.sort((a, b) => {
    const diff = b.affinity - a.affinity;
    return Math.abs(diff) > 2 ? diff : 0;
  });
  return shuffled.slice(0, limit);
}

function isMatchable(streamer: MatchCandidate) {
  if (streamer.is_deleted === true) return false;
  if (streamer.is_visible === false) return false;
  if (streamer.is_dummy === true) return false;
  if (streamer.withdrawal_status && streamer.withdrawal_status !== "none") return false;
  return true;
}

function resolveStreamerScores(streamer: MatchCandidate): { scores: DiagnosisScores; precise: boolean } | null {
  const raw = streamer.vtype_scores;
  if (raw && axisKeys.every((key) => Number.isFinite(Number((raw as Record<string, unknown>)[key])))) {
    const scores = Object.fromEntries(
      axisKeys.map((key) => [key, Number((raw as Record<string, unknown>)[key])]),
    ) as DiagnosisScores;
    return { scores, precise: true };
  }
  // 軸スコアが無い配信者は、選んだタイプの重心を本人のスコアとみなす。
  const type = diagnosisTypes.find((item) => item.id === Number(streamer.vtype_id));
  if (!type) return null;
  return { scores: type.centroid, precise: false };
}

// 6軸(各0〜100)のユークリッド距離を、0〜100の相性値に直す。
// 全軸が正反対のときの距離が理論上の最大値なので、それで正規化する。
function affinityPercent(a: DiagnosisScores, b: DiagnosisScores) {
  const squared = axisKeys.reduce((sum, key) => {
    const diff = clamp(a[key]) - clamp(b[key]);
    return sum + diff * diff;
  }, 0);
  const maxDistance = Math.sqrt(axisKeys.length * 100 * 100);
  const affinity = (1 - Math.sqrt(squared) / maxDistance) * 100;
  return Math.max(0, Math.min(100, Math.round(affinity)));
}

function clamp(value: number) {
  if (!Number.isFinite(value)) return 50;
  return Math.max(0, Math.min(100, value));
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}
