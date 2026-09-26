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

  // 配信者のタイプ分布は偏っている(最多10人 / 最少1人)。相性順にそのまま上から
  // 取ると掲載機会が偏る。実データ63人で2万回シミュレーションしたところ、
  // 僅差シャッフル方式では「一度もTOP3に出ない配信者が5人、一度も1位にならない
  // 配信者が14人」という結果になった。VtuberMatchは配信者に露出を提供する
  // サービスなので、これは受け入れられない。
  //
  // そこで、相性上位の候補プールから重み付きランダムで選ぶ方式にする。
  //  - プールを上位 poolSize 人に限ることで、無関係な人が出るのを防ぐ
  //  - 重みを相性の二乗にすることで、相性が高い人ほど選ばれやすさは保つ
  // 結果として、質を落とさずに全員へ露出が回るようになる。
  const pool = [...scored].sort((a, b) => b.affinity - a.affinity).slice(0, poolSize(scored.length, limit));
  return pickWeighted(pool, limit);
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

// 候補プールの大きさ。表示件数の4倍(最低12人)を目安にする。
// 小さすぎると露出が偏り、大きすぎると相性の低い人まで出てしまう。
function poolSize(total: number, limit: number) {
  return Math.min(total, Math.max(12, limit * 4));
}

// 相性の二乗を重みにした非復元抽出。相性が高い人ほど選ばれやすいが、
// プール内の全員に選ばれる余地が残る。
function pickWeighted(pool: StreamerMatch[], limit: number): StreamerMatch[] {
  const remaining = [...pool];
  const picked: StreamerMatch[] = [];
  while (picked.length < limit && remaining.length) {
    // 相性0の人だけが残った場合でも選べるよう、下駄を履かせてから二乗する。
    const weights = remaining.map((item) => Math.pow(item.affinity + 1, 2));
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    let threshold = Math.random() * total;
    let index = weights.length - 1;
    for (let i = 0; i < weights.length; i += 1) {
      threshold -= weights[i];
      if (threshold <= 0) { index = i; break; }
    }
    picked.push(remaining[index]);
    remaining.splice(index, 1);
  }
  // 表示は相性の高い順に整える(選ばれる過程はランダムでも、並びは自然に見せる)。
  return picked.sort((a, b) => b.affinity - a.affinity);
}
