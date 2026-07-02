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
    if (doc.exists && isActiveApplication(doc.data())) return doc;
  }
  if (streamerId) {
    const streamerDoc = await db.collection("streamers").doc(streamerId).get();
    if (isActiveStreamer(streamerDoc.data())) {
      const sourceApplicationId = String(streamerDoc.data()?.source_application_id || "");
      if (sourceApplicationId) {
        const doc = await db.collection("applications").doc(sourceApplicationId).get();
        if (doc.exists && isActiveApplication(doc.data())) return doc;
      }
      const snapshot = await db.collection("applications").where("streamer_id", "==", streamerId).limit(10).get();
      const active = snapshot.docs.find((doc) => isActiveApplication(doc.data()));
      if (active) return active;
    }
  }
  const [applicationSnapshot, streamerSnapshot] = await Promise.all([
    db.collection("applications").where("email", "==", email).limit(20).get(),
    db.collection("streamers").where("creator_email", "==", email).limit(20).get(),
  ]);
  const activeApplications = applicationSnapshot.docs.filter((doc) => isActiveApplication(doc.data()));
  for (const streamerDoc of streamerSnapshot.docs) {
    if (!isActiveStreamer(streamerDoc.data())) continue;
    const sourceApplicationId = String(streamerDoc.data().source_application_id || "");
    const linked = sourceApplicationId ? activeApplications.find((doc) => doc.id === sourceApplicationId) : undefined;
    if (linked) return linked;
    const streamerId = streamerDoc.id;
    const byStreamer = activeApplications.find((doc) => String(doc.data().streamer_id || "") === streamerId);
    if (byStreamer) return byStreamer;
  }
  return activeApplications[0] || null;
}

async function findViewerProfile(db: FirebaseFirestore.Firestore, email: string, viewerId: string) {
  if (viewerId) {
    const doc = await db.collection("viewer_profiles").doc(viewerId).get();
    if (doc.exists) return doc;
  }
  const snapshot = await db.collection("viewer_profiles").where("email", "==", email).limit(1).get();
  return snapshot.docs[0] || null;
}

function isActiveApplication(data?: FirebaseFirestore.DocumentData | null) {
  return data?.withdrawal_status !== "requested" && data?.is_deleted !== true;
}

function isActiveStreamer(data?: FirebaseFirestore.DocumentData | null) {
  return Boolean(data) && data?.withdrawal_status !== "requested" && data?.is_deleted !== true;
}
