import { NextResponse } from "next/server";
import { FieldValue, getAdminDb } from "@/lib/firebaseAdmin";
import { viewerSessionCookie, readUserSession } from "@/lib/userSession";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const streamerId = String(body.streamer_id || "");
  const viewerId = String(body.viewer_id || "");
  const effect = normalizeEffect(body.effect);
  if (!streamerId || !viewerId) return NextResponse.json({ error: "streamer_id and viewer_id are required" }, { status: 400 });

  const session = readUserSession<{ id?: string }>(request, viewerSessionCookie);
  if (!session?.id || session.id !== viewerId) return NextResponse.json({ error: "viewer login required" }, { status: 401 });

  const db = getAdminDb();
  if (!db) return NextResponse.json({ error: "Firestore is not configured" }, { status: 503 });

  const viewerRef = db.collection("viewer_profiles").doc(viewerId);
  const streamerRef = db.collection("streamers").doc(streamerId);
  const boostRef = db.collection("super_boosts").doc(`${streamerId}_${viewerId}_${Date.now()}`);
  let remaining = 0;

  await db.runTransaction(async (tx) => {
    const [viewerDoc, streamerDoc] = await Promise.all([tx.get(viewerRef), tx.get(streamerRef)]);
    if (!viewerDoc.exists) throw new Error("viewer not found");
    if (!streamerDoc.exists) throw new Error("streamer not found");
    const stock = Number(viewerDoc.data()?.super_like_stock || 0);
    if (stock <= 0) throw new Error("no stock");
    remaining = stock - 1;
    const viewerData = viewerDoc.data() || {};
    const viewerDisplayName = String(viewerData.display_name || viewerData.youtube_display_name || viewerId).slice(0, 80);

    const currentUntil = timestampToDate(streamerDoc.data()?.super_boost_until);
    const base = currentUntil && currentUntil.getTime() > Date.now() ? currentUntil : new Date();
    const nextUntil = new Date(base.getTime() + 72 * 60 * 60 * 1000);

    tx.set(viewerRef, {
      super_like_stock: FieldValue.increment(-1),
      updated_at: FieldValue.serverTimestamp(),
    }, { merge: true });
    tx.set(streamerRef, {
      super_boost_count: FieldValue.increment(1),
      super_boost_until: nextUntil,
      super_boost_effect: effect,
      last_super_boost_at: FieldValue.serverTimestamp(),
    }, { merge: true });
    tx.set(boostRef, {
      streamer_id: streamerId,
      viewer_id: viewerId,
      viewer_display_name: viewerDisplayName,
      viewer_name_highlighted: true,
      effect,
      quantity: 1,
      status: "activated",
      created_at: FieldValue.serverTimestamp(),
      active_until: nextUntil,
    });
  });

  return NextResponse.json({ ok: true, remaining });
}

function normalizeEffect(value: unknown) {
  if (value === "shine" || value === "shake") return value;
  return "shine";
}

function timestampToDate(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === "object" && value && "toDate" in value && typeof value.toDate === "function") return value.toDate();
  return null;
}
