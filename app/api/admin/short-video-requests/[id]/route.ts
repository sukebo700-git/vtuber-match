import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { FieldValue, getAdminDb, stripUndefined } from "@/lib/firebaseAdmin";
import { invalidateStreamerCaches } from "@/lib/streamers";

export const dynamic = "force-dynamic";

const allowedStatuses = ["open", "approved", "rendering", "uploaded", "published", "rejected"] as const;
type RequestStatus = (typeof allowedStatuses)[number];

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const db = getAdminDb();
  if (!db) return NextResponse.json({ error: "Firebase admin env is required" }, { status: 501 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const ref = db.collection("short_video_requests").doc(params.id);
  const doc = await ref.get();
  if (!doc.exists) return NextResponse.json({ error: "request not found" }, { status: 404 });

  const introText = typeof body.intro_text === "string" ? body.intro_text.trim().slice(0, 500) : undefined;
  const status = typeof body.status === "string" && (allowedStatuses as readonly string[]).includes(body.status)
    ? (body.status as RequestStatus)
    : undefined;

  if (introText === undefined && status === undefined) {
    return NextResponse.json({ error: "intro_text または status を指定してください。" }, { status: 400 });
  }

  if (status === "approved") {
    const effectiveIntro = introText !== undefined ? introText : String(doc.data()?.intro_text || "");
    if (!effectiveIntro.trim()) {
      return NextResponse.json({ error: "GOサインには紹介テキストの入力が必要です。" }, { status: 400 });
    }
  }

  await ref.set(stripUndefined({
    intro_text: introText,
    status,
    approved_at: status === "approved" ? FieldValue.serverTimestamp() : undefined,
    updated_at: FieldValue.serverTimestamp(),
  }), { merge: true });

  if (status === "published") {
    const requestData = doc.data() || {};
    const streamerId = String(requestData.streamer_id || "");
    const videoId = String(requestData.youtube_video_id || "");
    if (streamerId && videoId) {
      await db.collection("streamers").doc(streamerId).set({
        promo_video_id: videoId,
        updated_at: FieldValue.serverTimestamp(),
      }, { merge: true });
      invalidateStreamerCaches();
    }
  }

  const updated = (await ref.get()).data() || {};
  return NextResponse.json({
    ok: true,
    request: {
      id: params.id,
      status: String(updated.status || "open"),
      intro_text: String(updated.intro_text || ""),
      youtube_video_id: String(updated.youtube_video_id || ""),
    },
  });
}
