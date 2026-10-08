import { readFileSync } from "node:fs";

import {
  advancedQuestions,
  getDiagnosisTypeMatches,
  lightQuestions,
  viewerQuestions,
  type DiagnosisAxis,
  type DiagnosisQuestion,
} from "../lib/diagnosis";
import { getAdminDb } from "../lib/firebaseAdmin";

// Read-only report for tuning the VTYPE diagnosis with real answers.
// Usage:
//   npx tsx scripts/diagnosis-calibration.ts                 (reads Firestore diagnosis_results)
//   npx tsx scripts/diagnosis-calibration.ts --file x.json   (reads [{ diagnosisMode, answers }, ...])
// Nothing is written anywhere.

type Mode = "light" | "advanced" | "viewer";
type ResultRow = { diagnosisMode?: string; answers?: Record<string, number> };

const axisKeys: DiagnosisAxis[] = ["f", "t", "a", "n", "v", "d"];
const questionsByMode: Record<Mode, DiagnosisQuestion[]> = {
  light: lightQuestions,
  advanced: advancedQuestions,
  viewer: viewerQuestions,
};
const weakItemThreshold = 0.2;

async function main() {
  const rows = await loadRows();
  console.log(`rows: ${rows.length}`);

  (Object.keys(questionsByMode) as Mode[]).forEach((mode) => {
    const questions = questionsByMode[mode];
    const answerSets = rows
      .filter((row) => (row.diagnosisMode || "light") === mode && row.answers)
      .map((row) => row.answers as Record<string, number>)
      .filter((answers) => questions.every((question) => question.axis === "check" || isAnswer(answers[question.id])));
    reportMode(mode, questions, answerSets);
  });
}

async function loadRows(): Promise<ResultRow[]> {
  const fileIndex = process.argv.indexOf("--file");
  if (fileIndex >= 0) {
    const path = process.argv[fileIndex + 1];
    if (!path) throw new Error("--file needs a path");
    return JSON.parse(readFileSync(path, "utf8")) as ResultRow[];
  }

  const db = getAdminDb();
  if (!db) {
    throw new Error("Firebase Admin is not configured. Set FIREBASE_* env vars or use --file.");
  }
  const snapshot = await db.collection("diagnosis_results").get();
  return snapshot.docs.map((doc) => doc.data() as ResultRow);
}

function reportMode(mode: Mode, questions: DiagnosisQuestion[], answerSets: Record<string, number>[]) {
  console.log(`\n=== ${mode} (complete answer sets: ${answerSets.length}) ===`);
  if (answerSets.length < 30) {
    console.log("too few answer sets for a stable estimate (need 30+); skipped");
    return;
  }

  console.log("\n-- axis raw score (0-100) → candidates for defaultNorms in lib/diagnosis.ts");
  axisKeys.forEach((axis) => {
    const axisQuestions = questions.filter((question) => question.axis === axis);
    const itemScores = axisQuestions.map((question) => answerSets.map((answers) => itemScore(question, answers[question.id])));
    const totals = answerSets.map((_, index) => mean(itemScores.map((scores) => scores[index])));
    console.log(
      `${axis}: mean=${mean(totals).toFixed(1)} std=${std(totals).toFixed(1)} alpha=${cronbachAlpha(itemScores).toFixed(2)} items=${axisQuestions.length}`
    );

    axisQuestions.forEach((question, itemIndex) => {
      const rest = answerSets.map((_, index) =>
        mean(itemScores.filter((__, other) => other !== itemIndex).map((scores) => scores[index]))
      );
      const r = correlation(itemScores[itemIndex], rest);
      if (!(r >= weakItemThreshold)) {
        console.log(`   weak item r=${Number.isFinite(r) ? r.toFixed(2) : "n/a"} ${question.id}${question.is_reverse ? " (reverse)" : ""}: ${question.text}`);
      }
    });
  });

  console.log("\n-- axis correlations (high values mean two axes measure the same thing)");
  const axisTotals = axisKeys.map((axis) => {
    const axisQuestions = questions.filter((question) => question.axis === axis);
    return answerSets.map((answers) => mean(axisQuestions.map((question) => itemScore(question, answers[question.id]))));
  });
  axisKeys.forEach((axis, i) => {
    const cells = axisKeys.map((_, j) => (j <= i ? "     " : correlation(axisTotals[i], axisTotals[j]).toFixed(2).padStart(5)));
    console.log(`${axis}: ${cells.join(" ")}`);
  });

  console.log("\n-- type distribution with the current matching logic");
  const counts = new Map<string, number>();
  answerSets.forEach((answers) => {
    const type = getDiagnosisTypeMatches(answers, questions)[0].type;
    const key = `${String(type.id).padStart(2)} ${type.code} ${type.name}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([key, count]) => console.log(`${key}: ${count} (${((count / answerSets.length) * 100).toFixed(1)}%)`));
}

function isAnswer(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 1 && number <= 5;
}

function itemScore(question: DiagnosisQuestion, answer: number) {
  const clamped = Math.max(1, Math.min(5, Math.round(answer)));
  const adjusted = question.is_reverse ? 6 - clamped : clamped;
  return ((adjusted - 1) / 4) * 100;
}

function mean(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : NaN;
}

function variance(values: number[]) {
  const m = mean(values);
  return values.length > 1 ? values.reduce((sum, value) => sum + (value - m) ** 2, 0) / (values.length - 1) : NaN;
}

function std(values: number[]) {
  return Math.sqrt(variance(values));
}

function correlation(x: number[], y: number[]) {
  const mx = mean(x);
  const my = mean(y);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  x.forEach((value, index) => {
    sxy += (value - mx) * (y[index] - my);
    sxx += (value - mx) ** 2;
    syy += (y[index] - my) ** 2;
  });
  return sxy / Math.sqrt(sxx * syy);
}

function cronbachAlpha(itemScores: number[][]) {
  const k = itemScores.length;
  if (k < 2) return NaN;
  const sums = itemScores[0].map((_, index) => itemScores.reduce((sum, scores) => sum + scores[index], 0));
  const itemVariance = itemScores.reduce((sum, scores) => sum + variance(scores), 0);
  return (k / (k - 1)) * (1 - itemVariance / variance(sums));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
