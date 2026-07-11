import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { FieldValue, getAdminDb } from "@/lib/firebaseAdmin";
import { approveLocalStreamerClaim } from "@/lib/localStore";
import { invalidateStreamerCaches, normalizeStreamer } from "@/lib/streamers";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const db = getAdminDb();
  if (!db) {
    const streamer = await approveLocalStreamerClaim(params.id);
    if (!streamer) return NextResponse.json({ error: "有効な引き継ぎ申請が見つかりません。" }, { status: 404 });
    invalidateStreamerCaches();
    return NextResponse.json({ streamer, source: "local" });
  }

  try {
    const applicationRef = db.collection("applications").doc(params.id);
    const result = await db.runTransaction(async (tx) => {
      const applicationDoc = await tx.get(applicationRef);
      if (!applicationDoc.exists) throw new Error("claim not found");
      const application = applicationDoc.data() || {};
      if (application.claim_status !== "pending" || !application.claim_target_streamer_id) {
        throw new Error("claim is not pending");
      }
      if (Date.parse(String(application.claim_expires_at || "")) <= Date.now()) {
        throw new Error("claim has expired");
      }

      const targetRef = db.collection("streamers").doc(String(application.claim_target_streamer_id));
      const targetDoc = await tx.get(targetRef);
      const target = targetDoc.data();
      if (!targetDoc.exists || !target || target.is_initial_scout !== true || target.is_deleted === true || target.withdrawal_status === "requested") {
        throw new Error("claim target is unavailable");
      }
      if (!normalizeXAccount(target.x_account)) throw new Error("registered X account is required");

      tx.set(targetRef, {
        creator_email: String(application.email || "").trim().toLowerCase(),
        source_application_id: params.id,
        is_initial_scout: false,
        updated_at: FieldValue.serverTimestamp(),
      }, { merge: true });
      tx.set(applicationRef, {
        status: "approved",
        claim_status: "approved",
        streamer_id: targetDoc.id,
        reviewed_at: FieldValue.serverTimestamp(),
        claim_verified_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      }, { merge: true });

      return {
        id: targetDoc.id,
        data: {
          ...target,
          creator_email: String(application.email || "").trim().toLowerCase(),
          source_application_id: params.id,
          is_initial_scout: false,
          updated_at: new Date().toISOString(),
        },
      };
    });

    await db.collection("admin_audit_logs").add({
      action: "streamer_claim_approved",
      target_type: "application",
      target_id: params.id,
      payload: { streamer_id: result.id },
      created_at: FieldValue.serverTimestamp(),
    }).catch((auditError) => {
      console.error("Failed to write streamer claim audit log:", auditError);
    });
    invalidateStreamerCaches();
    return NextResponse.json({ streamer: normalizeStreamer(result.id, result.data), source: "firestore" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "claim approval failed";
    const status = message === "claim not found" ? 404 : 409;
    return NextResponse.json({ error: message }, { status });
  }
}

function normalizeXAccount(value: unknown) {
  return String(value || "")
    .trim()
    .replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//i, "@")
    .replace(/^([^@])/, "@$1")
    .toLowerCase();
}
