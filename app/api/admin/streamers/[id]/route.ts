import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { deleteLocalStreamer, updateLocalStreamer } from "@/lib/localStore";
import type { PlanType, Streamer } from "@/lib/types";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const body = await request.json();
  const patch: Partial<Streamer> = {};

  if ("is_visible" in body) patch.is_visible = Boolean(body.is_visible);
  if ("is_initial_scout" in body) patch.is_initial_scout = Boolean(body.is_initial_scout);
  if ("plan_type" in body && ["free", "paid", "boost"].includes(String(body.plan_type))) {
    patch.plan_type = body.plan_type as PlanType;
  }
  if ("name" in body) patch.name = clean(body.name, 80);
  if ("youtube_url" in body) patch.youtube_url = clean(body.youtube_url, 240);
  if ("youtube_channel_id" in body) patch.youtube_channel_id = clean(body.youtube_channel_id, 120);
  if ("description" in body) patch.description = clean(body.description, 800);
  if ("one_liner" in body) patch.one_liner = clean(body.one_liner, 80);
  if ("stream_time" in body) patch.stream_time = clean(body.stream_time, 80);
  if ("categories" in body) patch.categories = sanitizeArray(body.categories).slice(0, patch.plan_type === "free" ? 1 : 3);
  if ("tags" in body) patch.tags = sanitizeArray(body.tags).slice(0, patch.plan_type === "free" ? 1 : 5);
  if ("thumbnails" in body) patch.thumbnails = sanitizeArray(body.thumbnails).slice(0, 3);

  const db = getAdminDb();
  if (!db) {
    const streamer = await updateLocalStreamer(params.id, patch);
    if (!streamer) return NextResponse.json({ error: "streamer not found" }, { status: 404 });
    return NextResponse.json({ streamer, source: "local" });
  }

  await db.collection("streamers").doc(params.id).update(patch);
  return NextResponse.json({ ok: true, source: "firestore" });
}

function clean(value: unknown, max: number) {
  return String(value || "").trim().slice(0, max);
}

function sanitizeArray(value: unknown) {
  return Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean) : [];
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const db = getAdminDb();
  if (!db) {
    const streamer = await deleteLocalStreamer(params.id);
    if (!streamer) return NextResponse.json({ error: "visible streamer cannot be deleted" }, { status: 400 });
    return NextResponse.json({ deleted: true, source: "local" });
  }

  const ref = db.collection("streamers").doc(params.id);
  const snapshot = await ref.get();
  if (!snapshot.exists) return NextResponse.json({ error: "streamer not found" }, { status: 404 });
  if (snapshot.data()?.is_visible !== false) {
    return NextResponse.json({ error: "visible streamer cannot be deleted" }, { status: 400 });
  }

  await ref.delete();
  return NextResponse.json({ deleted: true, source: "firestore" });
}
