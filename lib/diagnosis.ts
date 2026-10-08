import axisCommentsRaw from "@/data/diagnosis/axis_comments.json";
import questionsRaw from "@/data/diagnosis/questions.json";
import resultTemplatesRaw from "@/data/diagnosis/result_templates.json";

export type DiagnosisAxis = "f" | "t" | "a" | "n" | "v" | "d";
export type DiagnosisScores = Record<DiagnosisAxis, number>;

export type DiagnosisQuestion = {
  id: string;
  text: string;
  axis: DiagnosisAxis | "check";
  facet?: string;
  is_reverse?: boolean;
};

export type DiagnosisType = {
  id: number;
  code: string;
  name: string;
  catchCopy: string;
  description: string;
  strengths: string[];
  viewerMatch: string;
  centroid: DiagnosisScores;
};

export type DiagnosisTypeMatch = {
  type: DiagnosisType;
  confidence: number;
  axisLabels: string[];
  distance: number;
};

export type ViewerMatchType = {
  title: string;
  catchCopy: string;
  traits: string[];
};

type RawQuestion = {
  id: string;
  text: string;
  axis: string;
  facet?: string;
  is_reverse?: boolean;
};

type RawTemplate = {
  id: number;
  code: string;
  name: string;
  centroid: Record<string, number>;
  catchphrase?: string;
  catchCopy?: string;
  description?: string;
  strengths?: string[];
  viewer_match?: string;
  viewerMatch?: string;
};

type AxisComment = {
  name: string;
  scale: string;
  comments: {
    high: { vtuber: string; viewer: string };
    mid: { vtuber: string; viewer: string };
    low: { vtuber: string; viewer: string };
  };
};

type AxisNorm = { mean: number; std: number };

const axisKeys = ["f", "t", "a", "n", "v", "d"] as const;
const axisComments = (axisCommentsRaw as { axes: Record<DiagnosisAxis, AxisComment> }).axes;

// Self-assessment diagnostics tend to drift toward YES, so type matching compares
// answers against a slightly high baseline instead of raw 50/50 scores.
const defaultNorms: Record<DiagnosisAxis, AxisNorm> = {
  f: { mean: 60, std: 15 },
  t: { mean: 60, std: 15 },
  a: { mean: 60, std: 15 },
  n: { mean: 60, std: 15 },
  v: { mean: 60, std: 15 },
  d: { mean: 60, std: 15 },
};

// Share of each axis z-score that is centered on the respondent's own average.
// Type centroids are centered by the same share before matching; otherwise
// all-high / all-low types (e.g. id 1, 16) are unreachable because a respondent's
// z-scores can never be high (or low) on every axis at once.
const personalWeight = 0.72;

// Labels follow axis_comments.json "scale": the left letter is the high side.
const axisSideLabels: Record<DiagnosisAxis, { high: string; low: string }> = {
  f: { high: "盛り上げ寄り", low: "まったり寄り" },
  t: { high: "トーク主導寄り", low: "ショー主導寄り" },
  a: { high: "冒険寄り", low: "日常寄り" },
  n: { high: "素寄り", low: "世界観寄り" },
  v: { high: "トーク寄り", low: "ガチ寄り" },
  d: { high: "深い関係寄り", low: "気軽寄り" },
};

export const diagnosisAxes: { key: DiagnosisAxis; label: string; scale: string }[] = axisKeys.map((key) => ({
  key,
  label: axisComments[key]?.name || key.toUpperCase(),
  scale: axisComments[key]?.scale || "",
}));

const questionSets = questionsRaw as {
  QUESTIONS_VT_30: RawQuestion[];
  QUESTIONS_VT_100: RawQuestion[];
  QUESTIONS_VW_30: RawQuestion[];
};

export const lightQuestions = normalizeQuestions(questionSets.QUESTIONS_VT_30);
export const advancedQuestions = normalizeQuestions(questionSets.QUESTIONS_VT_100);
export const viewerQuestions = normalizeQuestions(questionSets.QUESTIONS_VW_30);

const rawTemplates = (resultTemplatesRaw as { archetypes: RawTemplate[] }).archetypes;

export const diagnosisTypes: DiagnosisType[] = rawTemplates.map((template, index) => ({
  id: Number(template.id || index + 1),
  code: String(template.code || `TYPE${index + 1}`),
  name: String(template.name || `タイプ${index + 1}`),
  catchCopy: String(template.catchphrase || template.catchCopy || ""),
  description: String(template.description || ""),
  strengths: Array.isArray(template.strengths) ? template.strengths.map(String) : [],
  viewerMatch: String(template.viewer_match || template.viewerMatch || ""),
  centroid: normalizeCentroid(template.centroid),
}));

export function createInitialAnswers(questions: DiagnosisQuestion[]) {
  return Object.fromEntries(questions.map((question) => [question.id, 0])) as Record<string, number>;
}

export function scoreDiagnosis(answers: Record<string, number>, questions: DiagnosisQuestion[]): DiagnosisScores {
  return scoreDiagnosisInternal(answers, questions).percentileScores;
}

export function decideDiagnosisType(scores: DiagnosisScores): DiagnosisType {
  const zScores = Object.fromEntries(axisKeys.map((key) => [key, percentileToZApprox(scores[key])])) as DiagnosisScores;
  return findClosestTypesFromZ(zScores)[0]?.type || diagnosisTypes[0];
}

export function decideDiagnosisTypeFromAnswers(
  answers: Record<string, number>,
  questions: DiagnosisQuestion[]
): DiagnosisType {
  return getDiagnosisTypeMatches(answers, questions)[0]?.type || diagnosisTypes[0];
}

export function getDiagnosisTypeMatches(
  answers: Record<string, number>,
  questions: DiagnosisQuestion[]
): DiagnosisTypeMatch[] {
  const { zScores } = scoreDiagnosisInternal(answers, questions);
  return findClosestTypesFromZ(zScores);
}

export function topAxisLabels(scores: DiagnosisScores, count = 3) {
  return diagnosisAxes
    .map((axis) => ({ ...axis, score: scores[axis.key] }))
    .sort((a, b) => b.score - a.score)
    .slice(0, count);
}

export function bottomAxisLabels(scores: DiagnosisScores, count = 2) {
  return diagnosisAxes
    .map((axis) => ({ ...axis, score: scores[axis.key] }))
    .sort((a, b) => a.score - b.score)
    .slice(0, count);
}

export function deviationScores(scores: DiagnosisScores): DiagnosisScores {
  return Object.fromEntries(
    axisKeys.map((key) => [key, Math.round(50 + (scores[key] - 50) * 0.35)])
  ) as DiagnosisScores;
}

export function getAxisComment(axis: DiagnosisAxis, score: number, mode: "vtuber" | "viewer") {
  const band = score >= 67 ? "high" : score >= 34 ? "mid" : "low";
  return axisComments[axis]?.comments[band]?.[mode] || "";
}

export function getAxisBandText(score: number) {
  if (score >= 80) return "強みとして発揮されやすい傾向です。";
  if (score >= 60) return "比較的高い傾向があります。";
  if (score >= 40) return "バランス型の傾向があります。";
  return "今後伸ばせる可能性があります。";
}

export function getViewerMatchType(scores: DiagnosisScores): ViewerMatchType {
  const top = topAxisLabels(scores, 2);
  const labels = top.map((axis) => axis.label).join("・");

  return {
    title: `${labels}を楽しめるリスナー`,
    catchCopy:
      "あなたの回答傾向から見ると、配信者の魅力を自分なりに見つけて応援するスタイルと相性が良さそうです。",
    traits: top.map((axis) => `${axis.label}を重視しやすい`),
  };
}

function scoreDiagnosisInternal(answers: Record<string, number>, questions: DiagnosisQuestion[]) {
  const rawScores = rawAxisScores(answers, questions);
  const rawValues = axisKeys.map((key) => rawScores[key]);
  const personalMean = rawValues.reduce((sum, value) => sum + value, 0) / rawValues.length;
  const zScores = Object.fromEntries(
    axisKeys.map((key) => {
      const populationZ = (rawScores[key] - defaultNorms[key].mean) / defaultNorms[key].std;
      const personalZ = (rawScores[key] - personalMean) / 18;
      return [key, populationZ * (1 - personalWeight) + personalZ * personalWeight];
    })
  ) as DiagnosisScores;
  const percentileScores = Object.fromEntries(
    axisKeys.map((key) => [key, clampScore(normalCdf(zScores[key]) * 100)])
  ) as DiagnosisScores;

  return { rawScores, zScores, percentileScores };
}

function rawAxisScores(answers: Record<string, number>, questions: DiagnosisQuestion[]): DiagnosisScores {
  const totals = createEmptyScores();
  const counts = createEmptyScores();

  questions.forEach((question) => {
    if (!isDiagnosisAxis(question.axis)) return;
    const rawAnswer = Number(answers[question.id] || 0);
    if (!rawAnswer) return;
    const clamped = Math.max(1, Math.min(5, Math.round(rawAnswer)));
    const adjusted = question.is_reverse ? 6 - clamped : clamped;
    totals[question.axis] += ((adjusted - 1) / 4) * 100;
    counts[question.axis] += 1;
  });

  return Object.fromEntries(
    axisKeys.map((key) => [key, counts[key] > 0 ? totals[key] / counts[key] : defaultNorms[key].mean])
  ) as DiagnosisScores;
}

function normalizeQuestions(questions: RawQuestion[]): DiagnosisQuestion[] {
  return questions.map((question) => ({
    id: String(question.id),
    text: String(question.text),
    axis: isDiagnosisAxis(question.axis) ? question.axis : "check",
    facet: question.facet ? String(question.facet) : undefined,
    is_reverse: Boolean(question.is_reverse),
  }));
}

function normalizeCentroid(value: Record<string, number> | undefined): DiagnosisScores {
  return Object.fromEntries(
    axisKeys.map((key) => {
      const score = Number(value?.[key]);
      return [key, Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : 50];
    })
  ) as DiagnosisScores;
}

function createEmptyScores(): DiagnosisScores {
  return Object.fromEntries(axisKeys.map((key) => [key, 0])) as DiagnosisScores;
}

// Matching uses the same centroid that the result/preview radar shows for each type,
// converted to z space and centered the same way as the respondent's scores.
const matchCentroids = new Map(diagnosisTypes.map((type) => [type.id, centroidToMatchZ(type.centroid)]));

function findClosestTypesFromZ(zScores: DiagnosisScores): DiagnosisTypeMatch[] {
  return diagnosisTypes
    .map((type) => {
      const centroid = matchCentroids.get(type.id) || centroidToMatchZ(type.centroid);
      const distance = Math.sqrt(
        axisKeys.reduce((sum, key) => {
          const diff = zScores[key] - centroid[key];
          return sum + diff * diff;
        }, 0)
      );
      const confidence = Math.max(1, Math.min(99, Math.round(100 * Math.exp(-distance / 2))));

      return {
        type,
        confidence,
        distance,
        // type.code letters do not line up with axis positions, so labels come from the centroid.
        axisLabels: axisKeys.map((key) => (type.centroid[key] >= 50 ? axisSideLabels[key].high : axisSideLabels[key].low)),
      };
    })
    .sort((a, b) => a.distance - b.distance);
}

function centroidToMatchZ(centroid: DiagnosisScores): DiagnosisScores {
  const z = axisKeys.map((key) => inverseNormalCdf(centroid[key] / 100));
  const mean = z.reduce((sum, value) => sum + value, 0) / z.length;
  return Object.fromEntries(axisKeys.map((key, index) => [key, z[index] - mean * personalWeight])) as DiagnosisScores;
}

function normalCdf(value: number) {
  return 0.5 * (1 + erf(value / Math.SQRT2));
}

function erf(value: number) {
  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x));
  return sign * y;
}

// Acklam's rational approximation of the standard normal quantile function.
function inverseNormalCdf(probability: number) {
  const p = Math.max(0.01, Math.min(0.99, probability));
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const low = 0.02425;
  if (p < low || p > 1 - low) {
    const q = Math.sqrt(-2 * Math.log(p < low ? p : 1 - p));
    const value = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    return p < low ? value : -value;
  }
  const q = p - 0.5;
  const r = q * q;
  return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

function percentileToZApprox(score: number) {
  return (Math.max(0, Math.min(100, score)) - 50) / 34;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(Number.isFinite(value) ? value : 50)));
}

function isDiagnosisAxis(value: string): value is DiagnosisAxis {
  return (axisKeys as readonly string[]).includes(value);
}
