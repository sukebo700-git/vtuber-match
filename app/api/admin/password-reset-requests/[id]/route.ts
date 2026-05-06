import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { FieldValue, getAdminDb } from "@/lib/firebaseAdmin";
import { completeLocalPasswordResetRequest, readLocalPasswordResetRequests, updateLocalCreatorPassword, updateLocalViewerPassword } from "@/lib/localStore";
import { hashPassword } from "@/lib/password";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const body = await request.json();
  const newPassword = String(body.new_password || "");
  if (newPassword.length < 8) {
    return NextResponse.json({ error: "new password must be at least 8 characters" }, { status: 400 });
  }
  const passwordHash = hashPassword(newPassword);

  const db = getAdminDb();
  if (!db) {
    const resetRequests = await readLocalPasswordResetRequests();
    const resetRequest = resetRequests.find((item) => item.id === params.id);
    if (!resetRequest) return NextResponse.json({ error: "request not found" }, { status: 404 });

    const target = resetRequest.user_type === "creator"
      ? await updateLocalCreatorPassword({
        email: resetRequest.email,
        application_id: resetRequest.application_id,
        streamer_id: resetRequest.streamer_id,
        password_hash: passwordHash
      })
      : await updateLocalViewerPassword({
        email: resetRequest.email,
        viewer_id: resetRequest.viewer_id,
        password_hash: passwordHash
      });

    if (!target) return NextResponse.json({ error: "target user not found" }, { status: 404 });
    const completed = await completeLocalPasswordResetRequest(params.id);
    return NextResponse.json({ request: completed, source: "local" });
  }

  const requestRef = db.collection("password_reset_requests").doc(params.id);
  const requestDoc = await requestRef.get();
  if (!requestDoc.exists) return NextResponse.json({ error: "request not found" }, { status: 404 });
  const resetRequest = requestDoc.data() || {};
  const email = String(resetRequest.email || "").toLowerCase();

  if (resetRequest.user_type === "creator") {
    const applicationDoc = await findCreatorApplication(db, email, String(resetRequest.application_id || ""), String(resetRequest.streamer_id || ""));
    if (!applicationDoc) return NextResponse.json({ error: "creator not found" }, { status: 404 });
    await applicationDoc.ref.set({ creator_password_hash: passwordHash, password_reset_at: FieldValue.serverTimestamp() }, { merge: true });
  } else {
    const viewerDoc = await findViewerProfile(db, email, String(resetRequest.viewer_id || ""));
    if (!viewerDoc) return NextResponse.json({ error: "viewer not found" }, { status: 404 });
    await viewerDoc.ref.set({ viewer_password_hash: passwordHash, password_reset_at: FieldValue.serverTimestamp() }, { merge: true });
  }

  await requestRef.set({
    status: "completed",
    completed_at: FieldValue.serverTimestamp()
  }, { merge: true });

  return NextResponse.json({ ok: true, source: "firestore" });
}

async function findCreatorApplication(db: FirebaseFirestore.Firestore, email: string, applicationId: string, streamerId: string) {
  if (applicationId) {
    const doc = await db.collection("applications").doc(applicationId).get();
    if (doc.exists) return doc;
  }
  if (streamerId) {
    const snapshot = await db.collection("applications").where("streamer_id", "==", streamerId).limit(1).get();
    if (!snapshot.empty) return snapshot.docs[0];
  }
  const snapshot = await db.collection("applications").where("email", "==", email).limit(1).get();
  return snapshot.docs[0] || null;
}

async function findViewerProfile(db: FirebaseFirestore.Firestore, email: string, viewerId: string) {
  if (viewerId) {
    const doc = await db.collection("viewer_profiles").doc(viewerId).get();
    if (doc.exists) return doc;
  }
  const snapshot = await db.collection("viewer_profiles").where("email", "==", email).limit(1).get();
  return snapshot.docs[0] || null;
}
