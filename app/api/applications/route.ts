import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { FieldValue, getAdminDb } from "@/lib/firebaseAdmin";
import { addLocalApplication, readLocalApplications } from "@/lib/localStore";
import type { PlanType } from "@/lib/types";

export async function GET(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const db = getAdminDb();
  if (!db) return NextResponse.json({ applications: await readLocalApplications(), source: "local" });

  const snapshot = await db.collection("applications").orderBy("created_at", "desc").limit(80).get();
  return NextResponse.json({
    applications: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    source: "firestore"
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const error = validate(body);
  if (error) return NextResponse.json({ error }, { status: 400 });

  const payload = {
    name: String(body.name).trim(),
    email: String(body.email).trim(),
    youtube_url: String(body.youtube_url).trim(),
    youtube_channel_id: String(body.youtube_channel_id || "").trim(),
    thumbnails: normalizeThumbnails(sanitizeArray(body.thumbnails)),
    categories: sanitizeArray(body.categories),
    tags: sanitizeArray(body.tags).slice(0, 5),
    description: String(body.description).trim(),
    one_liner: String(body.one_liner || body.description).trim().slice(0, 80),
    stream_time: String(body.stream_time || "").trim(),
    desired_plan: (body.desired_plan || "free") as PlanType,
    admin_note: ""
  };

  const db = getAdminDb();
  if (!db) {
    const application = await addLocalApplication(payload);
    return NextResponse.json({ application, source: "local" }, { status: 201 });
  }

  const doc = await db.collection("applications").add({
    ...payload,
    payment_status: payload.desired_plan === "free" ? "not_required" : "pending",
    status: "pending",
    created_at: FieldValue.serverTimestamp()
  });

  return NextResponse.json({ id: doc.id, source: "firestore" }, { status: 201 });
}

function validate(body: Record<string, unknown>) {
  const plan = String(body.desired_plan || "free");
  const categoryCount = sanitizeArray(body.categories).length;
  const tagCount = sanitizeArray(body.tags).length;
  if (!body.name) return "name is required";
  if (!body.email) return "email is required";
  if (!body.youtube_url) return "youtube_url is required";
  if (!body.description) return "profile appeal is required";
  if (sanitizeArray(body.thumbnails).length > 3) return "thumbnails max is 3";
  if (plan === "free" && categoryCount > 1) return "free plan category max is 1";
  if (plan === "free" && tagCount > 1) return "free plan tag max is 1";
  if (plan !== "free" && categoryCount > 3) return "paid plan category max is 3";
  if (plan !== "free" && tagCount > 5) return "paid plan tag max is 5";
  if (categoryCount < 1) return "category is required";
  if (tagCount < 1) return "tag is required";
  return null;
}

function sanitizeArray(value: unknown) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function normalizeThumbnails(values: string[]) {
  const thumbnails = values.slice(0, 3);
  return thumbnails.length ? thumbnails : ["https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=900&q=82"];
}
