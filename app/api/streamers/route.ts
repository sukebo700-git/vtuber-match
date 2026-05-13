import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { FieldValue, getAdminDb } from "@/lib/firebaseAdmin";
import { addLocalStreamer, readLocalStreamers } from "@/lib/localStore";
import { normalizeStreamer } from "@/lib/streamers";
import type { PlanType } from "@/lib/types";

export async function GET() {
  const db = getAdminDb();
  if (!db) return NextResponse.json({ streamers: await readLocalStreamers(), source: "local" });

  const snapshot = await db.collection("streamers").limit(80).get();
  return NextResponse.json({
    streamers: snapshot.docs
      .map((doc) => normalizeStreamer(doc.id, doc.data()))
      .filter((streamer) => streamer.is_visible !== false),
    source: "firestore"
  });
}

export async function POST(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const body = await request.json();
  const validationError = validate(body);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

  const payload = {
    name: String(body.name).trim(),
    youtube_url: String(body.youtube_url).trim(),
    youtube_channel_id: String(body.youtube_channel_id || "").trim(),
    x_account: normalizeXAccount(body.x_account),
    thumbnails: normalizeThumbnails(sanitizeArray(body.thumbnails)),
    categories: sanitizeArray(body.categories),
    tags: sanitizeArray(body.tags).slice(0, 5),
    description: String(body.description || "").trim(),
    one_liner: String(body.one_liner || body.description || "").trim().slice(0, 80),
    stream_time: String(body.stream_time || "").trim(),
    plan_type: (body.plan_type || "free") as PlanType,
    is_initial_scout: Boolean(body.is_initial_scout),
    is_visible: body.is_visible !== false,
    impressions: 0,
    likes: 0
  };

  const db = getAdminDb();
  if (!db) {
    const streamer = await addLocalStreamer(payload);
    return NextResponse.json({ streamer, source: "local" }, { status: 201 });
  }

  const doc = await db.collection("streamers").add({
    ...payload,
    created_at: FieldValue.serverTimestamp()
  });

  return NextResponse.json({ id: doc.id, source: "firestore" }, { status: 201 });
}

function validate(body: Record<string, unknown>) {
  const plan = String(body.plan_type || "free");
  const categoryCount = sanitizeArray(body.categories).length;
  const tagCount = sanitizeArray(body.tags).length;
  if (!body.name) return "name is required";
  if (!body.youtube_url) return "youtube_url is required";
  if (plan !== "free" && !body.description) return "profile appeal is required";
  if (sanitizeArray(body.thumbnails).length > 3) return "thumbnails max is 3";
  if (plan === "free" && categoryCount > 0) return "free plan cannot set categories";
  if (plan === "free" && tagCount > 0) return "free plan cannot set tags";
  if (plan !== "free" && categoryCount > 3) return "paid plan category max is 3";
  if (plan !== "free" && tagCount > 5) return "paid plan tag max is 5";
  return null;
}

function sanitizeArray(value: unknown) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function normalizeThumbnails(values: string[]) {
  const thumbnails = values.slice(0, 3);
  return thumbnails.length ? thumbnails : ["https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=900&q=82"];
}

function normalizeXAccount(value: unknown) {
  const input = String(value || "").trim();
  if (!input) return "";
  return input.replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//i, "@").replace(/^([^@])/, "@$1").slice(0, 40);
}
