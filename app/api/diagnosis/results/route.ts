import { NextRequest, NextResponse } from "next/server";

import { FieldValue, getAdminDb, stripUndefined } from "@/lib/firebaseAdmin";
import { advancedQuestions, diagnosisAxes, diagnosisTypes, lightQuestions, viewerQuestions, type DiagnosisScores } from "@/lib/diagnosis";

type DiagnosisRequest = {
  vtuberName?: string;
  mode?: "light" | "advanced" | "viewer";
  resultId?: string;
  lightType?: string;
  lightTypeCode?: string;
  lightScores?: Partial<DiagnosisScores>;
  advancedScores?: Partial<DiagnosisScores>;
  answers?: Record<string, number>;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as DiagnosisRequest;
    const vtuberName = String(body.vtuberName || "").trim();

    if (!vtuberName) {
      return NextResponse.json({ ok: false, error: "VTUBER_NAME_REQUIRED" }, { status: 400 });
    }

    if (vtuberName.length > 50) {
      return NextResponse.json({ ok: false, error: "VTUBER_NAME_TOO_LONG" }, { status: 400 });
    }

    const lightScores = normalizeScores(body.lightScores);
    if (!lightScores) {
      return NextResponse.json({ ok: false, error: "SCORES_REQUIRED" }, { status: 400 });
    }

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ ok: true, resultId: null, saved: false });
    }

    const lightType = normalizeType(body.lightType);
    const lightTypeCode = normalizeTypeCode(body.lightTypeCode, lightType);
    const answers = normalizeAnswers(body.answers);
    const answerDetails = buildAnswerDetails(body.mode || "light", answers);
    const payload = stripUndefined({
      vtuberName,
      diagnosisMode: body.mode || "light",
      lightType,
      lightTypeCode,
      lightScores,
      answers,
      answerDetails,
      advancedCompleted: body.mode === "advanced",
      viewerCompleted: body.mode === "viewer",
      advancedScores: body.mode === "advanced" ? normalizeScores(body.advancedScores || body.lightScores) : undefined,
      createdAt: FieldValue.serverTimestamp(),
    });

    if (body.mode === "advanced" && body.resultId) {
      const ref = db.collection("diagnosis_results").doc(body.resultId);
      await ref.set(
        stripUndefined({
          vtuberName,
          diagnosisMode: body.mode || "advanced",
          lightType,
          lightTypeCode,
          lightScores,
          answers,
          answerDetails,
          advancedCompleted: true,
          advancedScores: normalizeScores(body.advancedScores || body.lightScores),
          updatedAt: FieldValue.serverTimestamp(),
        }),
        { merge: true }
      );
      return NextResponse.json({ ok: true, resultId: body.resultId, saved: true });
    }

    const doc = await db.collection("diagnosis_results").add(payload);
    return NextResponse.json({ ok: true, resultId: doc.id, saved: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error("diagnosis result save failed:", message);
    return NextResponse.json({ ok: true, resultId: null, saved: false });
  }
}

function normalizeScores(value: Partial<DiagnosisScores> | undefined): DiagnosisScores | null {
  if (!value) return null;
  const entries = diagnosisAxes.map((axis) => {
    const score = Number(value[axis.key]);
    return [axis.key, Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : 0];
  });
  return Object.fromEntries(entries) as DiagnosisScores;
}

function normalizeType(value: string | undefined) {
  const match = diagnosisTypes.find((type) => type.name === value);
  return match?.name || diagnosisTypes[0].name;
}

function normalizeTypeCode(value: string | undefined, typeName: string) {
  const match = diagnosisTypes.find((type) => type.code === value || type.name === typeName);
  return match?.code || diagnosisTypes[0].code;
}

function normalizeAnswers(value: Record<string, number> | undefined) {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value).map(([key, answer]) => [
      key,
      Number.isFinite(Number(answer)) ? Math.max(1, Math.min(5, Math.round(Number(answer)))) : 3,
    ])
  );
}

function buildAnswerDetails(mode: DiagnosisRequest["mode"], answers: Record<string, number>) {
  const questions = mode === "advanced" ? advancedQuestions : mode === "viewer" ? viewerQuestions : lightQuestions;
  return questions.map((question, index) => ({
    number: index + 1,
    questionId: question.id,
    question: question.text,
    axis: question.axis,
    answer: answers[question.id] ?? 3,
  }));
}
