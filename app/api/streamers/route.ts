import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminAuth";
import { FieldValue, getAdminDb } from "@/lib/firebaseAdmin";
import { addLocalStreamer, readLocalStreamers } from "@/lib/localStore";
import { invalidateStreamerCaches, normalizeStreamer, publicStreamerPath, streamerImagePath } from "@/lib/streamers";
import type { PlanType } from "@/lib/types";

export async function GET() {
  const db = getAdminDb();
  if (!db) {
    return NextResponse.json({
      streamers: (await readLocalStreamers()).map(lightweightStreamer),
      source: "local",
    });
  }

  const snapshot = await db.collection("streamers")
    .select(
      "name",
      "youtube_url",
      "archive_url",
      "x_account",
      "categories",
      "tags",
      "one_liner",
      "stream_time",
      "plan_type",
      "admin_placement",
      "is_visible",
      "is_deleted",
      "super_boost_until",
      "super_boost_effect",
      "elite_boost_days",
      "likes",
      "weekly_impressions",
      "latest_video_id",
      "updated_at",
    )
    .limit(100)
    .get();
  return NextResponse.json({
    streamers: snapshot.docs
      .map((doc) => normalizeStreamer(doc.id, doc.data()))
      .filter((streamer) => streamer.is_visible !== false && streamer.is_deleted !== true)
      .map(lightweightStreamer),
    source: "firestore"
  });
}

export async function POST(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "送信データを読み取れませんでした。画像が大きすぎる可能性があります。" }, { status: 400 });
  }
  const validationError = validate(body);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

  const now = new Date().toISOString();
  const payload = {
    name: String(body.name).trim(),
    youtube_url: String(body.youtube_url).trim(),
    youtube_channel_id: String(body.youtube_channel_id || "").trim(),
    x_account: normalizeXAccount(body.x_account),
    thumbnails: normalizeThumbnails(sanitizeArray(body.thumbnails)),
    categories: sanitizeArray(body.categories),
    tags: sanitizeArray(body.tags).slice(0, 5),
    description: String(body.description || "").trim().slice(0, String(body.plan_type || "free") === "free" ? 100 : 500),
    one_liner: String(body.one_liner || "").trim().slice(0, 20),
    stream_time: String(body.stream_time || "").trim(),
    plan_type: (body.plan_type || "free") as PlanType,
    is_initial_scout: Boolean(body.is_initial_scout),
    is_visible: body.is_visible !== false,
    yomi: String(body.yomi || "").trim().slice(0, 80),
    publication_consent: body.publication_consent === true,
    publication_source: body.publication_source === "admin_public_import" ? "admin_public_import" : "",
    publication_consent_recorded_at: now,
    impressions: 0,
    likes: 0,
    registered_at: now,
    updated_at: now,
  };

  try {
  const db = getAdminDb();
  if (!db) {
    const duplicate = (await readLocalStreamers()).find((streamer) => (
      streamer.youtube_url.trim() === payload.youtube_url && streamer.is_deleted !== true
    ));
    if (duplicate) return NextResponse.json({ error: "同じYouTube URLの配信者はすでに登録されています。" }, { status: 409 });
    const streamer = await addLocalStreamer(payload);
    const publicPath = publicStreamerPath(streamer);
    invalidateStreamerCaches();
    revalidatePath(publicPath);
    return NextResponse.json({
      streamer,
      public_path: publicPath,
      source: "local"
    }, { status: 201 });
  }

  const duplicate = await db.collection("streamers")
    .where("youtube_url", "==", payload.youtube_url)
    .limit(1)
    .get();
  if (duplicate.docs.some((doc) => doc.data().is_deleted !== true)) {
    return NextResponse.json({ error: "同じYouTube URLの配信者はすでに登録されています。" }, { status: 409 });
  }

  const doc = await db.collection("streamers").add({
    ...payload,
    registered_at: FieldValue.serverTimestamp(),
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
    publication_consent_recorded_at: FieldValue.serverTimestamp(),
  });
  invalidateStreamerCaches();
  const publicPath = publicStreamerPath({ id: doc.id, name: payload.name });
  revalidatePath(publicPath);

  return NextResponse.json({
    id: doc.id,
    streamer: normalizeStreamer(doc.id, { ...payload, created_at: now }),
    public_path: publicPath,
    source: "firestore"
  }, { status: 201 });
  } catch (error) {
    console.error("Failed to create public streamer:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: "公開ページの保存に失敗しました。画像を小さくしてもう一度試してください。" }, { status: 500 });
  }
}

function validate(body: Record<string, unknown>) {
  const plan = String(body.plan_type || "free");
  const categoryCount = sanitizeArray(body.categories).length;
  const tagCount = sanitizeArray(body.tags).length;
  if (!body.name) return "name is required";
  if (!body.youtube_url) return "youtube_url is required";
  if (body.is_initial_scout === true && body.publication_consent !== true) return "publication consent is required";
  if (String(body.description || "").length > (plan === "free" ? 100 : 500)) return "description is too long";
  if (plan !== "free" && !body.description) return "profile appeal is required";
  if (sanitizeArray(body.thumbnails).length > 3) return "thumbnails max is 3";
  if (totalTextLength(sanitizeArray(body.thumbnails)) > 900_000) return "画像サイズが大きすぎます。画像を小さくしてもう一度試してください。";
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
  return values.slice(0, 3);
}

function totalTextLength(values: string[]) {
  return values.reduce((total, value) => total + value.length, 0);
}

function normalizeXAccount(value: unknown) {
  const input = String(value || "").trim();
  if (!input) return "";
  return input.replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//i, "@").replace(/^([^@])/, "@$1").slice(0, 40);
}

function lightweightStreamer(streamer: ReturnType<typeof normalizeStreamer>) {
  return {
    ...streamer,
    thumbnails: [streamerImagePath(streamer)],
    description: "",
  };
}
