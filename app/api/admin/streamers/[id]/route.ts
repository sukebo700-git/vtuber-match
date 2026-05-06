import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { updateLocalStreamer } from "@/lib/localStore";
import type { PlanType } from "@/lib/types";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const body = await request.json();
  const patch: { is_visible?: boolean; plan_type?: PlanType; is_initial_scout?: boolean } = {};

  if ("is_visible" in body) patch.is_visible = Boolean(body.is_visible);
  if ("is_initial_scout" in body) patch.is_initial_scout = Boolean(body.is_initial_scout);
  if ("plan_type" in body && ["free", "paid", "boost"].includes(String(body.plan_type))) {
    patch.plan_type = body.plan_type as PlanType;
  }

  const db = getAdminDb();
  if (!db) {
    const streamer = await updateLocalStreamer(params.id, patch);
    if (!streamer) return NextResponse.json({ error: "streamer not found" }, { status: 404 });
    return NextResponse.json({ streamer, source: "local" });
  }

  await db.collection("streamers").doc(params.id).update(patch);
  return NextResponse.json({ ok: true, source: "firestore" });
}
