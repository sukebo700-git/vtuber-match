import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminAuth";
import { FieldValue, getAdminDb, stripUndefined } from "@/lib/firebaseAdmin";
import { adminCookieName, getCookieValue } from "@/lib/adminSession";
import { deleteLocalStreamer, findLocalStreamer, hasLocalPaymentHistory, updateLocalStreamer } from "@/lib/localStore";
import { invalidateStreamerCaches, normalizeStreamer, publicStreamerPath } from "@/lib/streamers";
import { parseYouTubeVideoId } from "@/lib/youtube";
import type { AdminPlacement, PlanType, Streamer } from "@/lib/types";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const db = getAdminDb();
  if (!db) {
    const streamer = await findLocalStreamer(params.id);
    if (!streamer || streamer.is_deleted === true) return NextResponse.json({ error: "streamer not found" }, { status: 404 });
    return NextResponse.json({ streamer, source: "local" });
  }

  const snapshot = await db.collection("streamers").doc(params.id).get();
  if (!snapshot.exists || snapshot.data()?.is_deleted === true) {
    return NextResponse.json({ error: "streamer not found" }, { status: 404 });
  }
  const requestDoc = await db.collection("short_video_requests").doc(params.id).get();
  const wantShortVideo = requestDoc.exists && String(requestDoc.data()?.status || "open") !== "rejected";
  return NextResponse.json({
    streamer: normalizeStreamer(snapshot.id, snapshot.data() || {}),
    want_short_video: wantShortVideo,
    source: "firestore",
  });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const body = await request.json();
  const patch: Partial<Streamer> = {};

  if ("is_visible" in body) patch.is_visible = Boolean(body.is_visible);
  if ("is_initial_scout" in body) patch.is_initial_scout = Boolean(body.is_initial_scout);
  if ("is_dummy" in body) patch.is_dummy = Boolean(body.is_dummy);
  if ("dummy_reason" in body) patch.dummy_reason = clean(body.dummy_reason, 80);
  if ("x_introduced_at" in body) patch.x_introduced_at = clean(body.x_introduced_at, 60);
  if ("admin_placement" in body && ["top", "normal", "bottom"].includes(String(body.admin_placement))) {
    patch.admin_placement = body.admin_placement as AdminPlacement;
  }
  if ("plan_type" in body && ["free", "paid", "boost"].includes(String(body.plan_type))) {
    patch.plan_type = body.plan_type as PlanType;
  }
  if ("name" in body) patch.name = clean(body.name, 80);
  if ("youtube_url" in body) patch.youtube_url = clean(body.youtube_url, 240);
  if ("youtube_channel_id" in body) patch.youtube_channel_id = clean(body.youtube_channel_id, 120);
  if ("archive_url" in body) patch.archive_url = clean(body.archive_url, 300);
  if ("promo_video_id" in body) {
    const raw = clean(body.promo_video_id, 200);
    if (!raw) {
      patch.promo_video_id = "";
    } else {
      const parsed = parseYouTubeVideoId(raw);
      if (!parsed) {
        return NextResponse.json({ error: "YouTube動画のURLまたはIDを正しく入力してください。" }, { status: 400 });
      }
      // 保存時点では実在確認をしない(公開予約中・限定公開の動画もoEmbedでは
      // 404/403になり誤って保存を拒否してしまうため)。表示側(detail page)で
      // 都度確認し、実際に非公開の間は埋め込みを自動的に隠す設計にしている。
      patch.promo_video_id = parsed;
    }
  }
  if ("description" in body) patch.description = clean(body.description, String(body.plan_type || "") === "free" ? 100 : 800);
  if ("one_liner" in body) patch.one_liner = clean(body.one_liner, 20);
  if ("stream_time" in body) patch.stream_time = clean(body.stream_time, 50);
  if ("categories" in body) patch.categories = sanitizeArray(body.categories).slice(0, 3);
  if ("tags" in body) patch.tags = sanitizeArray(body.tags).slice(0, 3);
  if ("thumbnails" in body) patch.thumbnails = sanitizeArray(body.thumbnails).slice(0, 5);
  if ("super_boost_count" in body) patch.super_boost_count = Number(body.super_boost_count || 0);
  if ("super_boost_until" in body) patch.super_boost_until = clean(body.super_boost_until, 60);
  if ("super_boost_effect" in body && ["shine", "shake"].includes(String(body.super_boost_effect))) {
    patch.super_boost_effect = body.super_boost_effect;
  }

  const db = getAdminDb();
  if (!db) {
    const beforeStreamer = await findLocalStreamer(params.id);
    const streamer = await updateLocalStreamer(params.id, { ...patch, updated_at: new Date().toISOString(), ...(needsAdminGrantSource(patch) ? { grant_source: "admin" as const } : {}) });
    if (!streamer) return NextResponse.json({ error: "streamer not found" }, { status: 404 });
    invalidateStreamerCaches();
    revalidateStreamerPaths(beforeStreamer, streamer);
    return NextResponse.json({ streamer, source: "local" });
  }

  const ref = db.collection("streamers").doc(params.id);
  const beforeDoc = await ref.get();
  if (!beforeDoc.exists || beforeDoc.data()?.is_deleted === true) return NextResponse.json({ error: "streamer not found" }, { status: 404 });
  const beforeStreamer = normalizeStreamer(beforeDoc.id, beforeDoc.data() || {});
  const nextPatch = stripUndefined({ ...patch, updated_at: FieldValue.serverTimestamp(), ...(needsAdminGrantSource(patch) ? { grant_source: "admin" as const } : {}) });
  await ref.update(nextPatch);

  // 管理者が代理で「紹介動画を希望する」にチェックした場合、short_video_requests を作成する
  // (既に依頼済みならステータスは変更しない。取り下げはShortVideoAdminPanelの「見送りにする」で行う)。
  if (body.want_short_video === true) {
    const requestRef = db.collection("short_video_requests").doc(params.id);
    const existingRequest = await requestRef.get();
    if (!existingRequest.exists) {
      const streamerData = { ...(beforeDoc.data() || {}), ...patch };
      await requestRef.set(stripUndefined({
        streamer_id: params.id,
        name: String(streamerData.name || ""),
        email: String(streamerData.creator_email || ""),
        youtube_url: streamerData.youtube_url || undefined,
        x_account: streamerData.x_account || undefined,
        one_liner: streamerData.one_liner || undefined,
        plan_type: streamerData.plan_type || "free",
        appeal_points: streamerData.description || undefined,
        notes: "管理者による代理登録",
        status: "open",
        requested_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      }), { merge: true });
    }
  }

  invalidateStreamerCaches();
  revalidateStreamerPaths(beforeStreamer, normalizeStreamer(params.id, { ...(beforeDoc.data() || {}), ...patch, updated_at: new Date().toISOString() }));
  await writeAuditLog(db, request, {
    action: auditActionForPatch(patch),
    target_type: "streamer",
    target_id: params.id,
    before: summarizeStreamer(beforeDoc.data() || {}),
    after: summarizeStreamer({ ...(beforeDoc.data() || {}), ...nextPatch })
  });
  return NextResponse.json({ ok: true, source: "firestore" });
}

function clean(value: unknown, max: number) {
  return String(value || "").trim().slice(0, max);
}

function sanitizeArray(value: unknown) {
  return Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean) : [];
}

function revalidateStreamerPaths(...streamers: Array<Streamer | null | undefined>) {
  const paths = new Set(
    streamers
      .filter((streamer): streamer is Streamer => Boolean(streamer?.id))
      .map((streamer) => publicStreamerPath(streamer))
  );
  paths.forEach((path) => revalidatePath(path));
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const db = getAdminDb();
  if (!db) {
    if (await hasLocalPaymentHistory("streamer_id", params.id)) {
      return NextResponse.json({ error: "課金履歴がある配信者は削除できません。", code: "HAS_PAYMENT_HISTORY" }, { status: 409 });
    }
    const beforeStreamer = await findLocalStreamer(params.id);
    const streamer = await deleteLocalStreamer(params.id);
    if (!streamer) return NextResponse.json({ error: "visible streamer cannot be deleted" }, { status: 400 });
    invalidateStreamerCaches();
    revalidateStreamerPaths(beforeStreamer, streamer);
    return NextResponse.json({ deleted: true, source: "local" });
  }

  const ref = db.collection("streamers").doc(params.id);
  const snapshot = await ref.get();
  if (!snapshot.exists) return NextResponse.json({ error: "streamer not found" }, { status: 404 });
  if (snapshot.data()?.is_deleted === true) return NextResponse.json({ deleted: true, source: "firestore" });
  if (await hasPaymentHistory(db, "streamer_id", params.id)) {
    return NextResponse.json({ error: "課金履歴がある配信者は削除できません。", code: "HAS_PAYMENT_HISTORY" }, { status: 409 });
  }
  if (snapshot.data()?.is_visible !== false) {
    return NextResponse.json({ error: "visible streamer cannot be deleted" }, { status: 400 });
  }

  await ref.set(stripUndefined({
    is_deleted: true,
    is_visible: false,
    deleted_at: FieldValue.serverTimestamp()
  }), { merge: true });
  invalidateStreamerCaches();
  revalidateStreamerPaths(normalizeStreamer(snapshot.id, snapshot.data() || {}));
  await writeAuditLog(db, request, {
    action: "delete",
    target_type: "streamer",
    target_id: params.id,
    before: summarizeStreamer(snapshot.data() || {}),
    after: { is_deleted: true, is_visible: false }
  });
  return NextResponse.json({ deleted: true, source: "firestore" });
}

function needsAdminGrantSource(patch: Partial<Streamer>) {
  return "plan_type" in patch || "super_boost_until" in patch || "super_boost_count" in patch;
}

function auditActionForPatch(patch: Partial<Streamer>) {
  if ("super_boost_until" in patch || "super_boost_count" in patch) return "admin_super_like";
  if (patch.plan_type === "boost") return "admin_grant_premium";
  if ("plan_type" in patch) return "plan_change";
  if ("is_visible" in patch) return "visibility_change";
  if ("is_dummy" in patch) return "dummy_flag_change";
  return "profile_update";
}

async function hasPaymentHistory(db: FirebaseFirestore.Firestore, field: "streamer_id" | "viewer_id", id: string) {
  const snapshot = await db.collection("payments").where(field, "==", id).limit(1).get();
  return !snapshot.empty;
}

async function writeAuditLog(db: FirebaseFirestore.Firestore, request: Request, input: {
  action: string;
  target_type: "streamer" | "viewer";
  target_id: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}) {
  const adminSessionId = getCookieValue(request.headers.get("cookie"), adminCookieName) || request.headers.get("x-admin-key") || "unknown";
  await db.collection("admin_audit_logs").add(stripUndefined({
    admin_session_id: adminSessionId,
    action: input.action,
    target_type: input.target_type,
    target_id: input.target_id,
    before: input.before,
    after: input.after,
    created_at: FieldValue.serverTimestamp()
  }));
}

function summarizeStreamer(value: Record<string, unknown>) {
  return {
    name: value.name || "",
    plan_type: value.plan_type || "",
    is_visible: value.is_visible !== false,
    is_dummy: value.is_dummy === true,
    admin_placement: value.admin_placement || "normal",
    super_boost_until: value.super_boost_until || "",
    super_boost_count: Number(value.super_boost_count || 0),
    grant_source: value.grant_source || ""
  };
}
