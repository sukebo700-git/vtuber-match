import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";

type InternalPlan = "\u30d9\u30fc\u30b7\u30c3\u30af" | "\u30d7\u30ec\u30df\u30a2\u30e0";

type MatchResult = {
  registered: true;
  plan: InternalPlan | null;
};

const emptyResponse = { registered: false, plan: null };

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(emptyResponse, { status: 401 });
  }

  try {
    const handle = normalizeHandle(request.headers.get("x-handle"));
    if (!handle) return NextResponse.json(emptyResponse);

    const db = getAdminDb();
    if (!db) return NextResponse.json(emptyResponse);

    const values = handleVariants(handle);
    const matches = [
      await findByField(db, "users", "xHandle", values),
      await findByField(db, "streamers", "x_account", values),
      await findByField(db, "applications", "x_account", values),
    ].filter((match): match is MatchResult => Boolean(match));

    if (!matches.length) return NextResponse.json(emptyResponse);

    const planMatch = matches.find((match) => match.plan);
    return NextResponse.json(planMatch || matches[0]);
  } catch (error) {
    console.error("internal check-vtuber failed:", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json(emptyResponse);
  }
}

function isAuthorized(request: Request) {
  const apiKey = process.env.INTERNAL_API_KEY || "";
  const authorization = request.headers.get("Authorization") || "";
  if (!apiKey) return false;
  return authorization === `Bearer ${apiKey}`;
}

function normalizeHandle(value: string | null) {
  return String(value || "")
    .trim()
    .replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//i, "")
    .replace(/^@+/, "")
    .split(/[/?#]/)[0]
    .trim();
}

function handleVariants(handle: string) {
  const trimmed = handle.trim();
  const lower = trimmed.toLowerCase();
  return Array.from(new Set([trimmed, `@${trimmed}`, lower, `@${lower}`].filter(Boolean)));
}

async function findByField(
  db: FirebaseFirestore.Firestore,
  collectionName: string,
  fieldName: string,
  values: string[],
): Promise<MatchResult | null> {
  for (const value of values) {
    const snapshot = await db.collection(collectionName).where(fieldName, "==", value).limit(1).get();
    const doc = snapshot.docs.find((item) => item.data().is_deleted !== true);
    if (doc) return { registered: true, plan: normalizePlan(doc.data()) };
  }

  return null;
}

function normalizePlan(data: FirebaseFirestore.DocumentData): InternalPlan | null {
  const plan = String(data.plan || "").trim();
  if (plan === "\u30d9\u30fc\u30b7\u30c3\u30af" || plan === "\u30d7\u30ec\u30df\u30a2\u30e0") return plan;

  const planType = String(data.plan_type || data.desired_plan || "").trim();
  if (planType === "paid") return "\u30d9\u30fc\u30b7\u30c3\u30af";
  if (planType === "boost") return "\u30d7\u30ec\u30df\u30a2\u30e0";

  return null;
}
