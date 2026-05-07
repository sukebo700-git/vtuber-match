import { NextResponse } from "next/server";
import { FieldValue, getAdminDb } from "@/lib/firebaseAdmin";
import { addLocalPasswordResetRequest } from "@/lib/localStore";
import type { PasswordResetRequest } from "@/lib/types";

export async function POST(request: Request) {
  const body = await request.json();
  const userType = String(body.user_type || "") as PasswordResetRequest["user_type"];
  const email = String(body.email || "").trim().toLowerCase();
  const name = clean(body.name, 120);
  const applicationId = clean(body.application_id, 80);
  const streamerId = clean(body.streamer_id, 80);
  const viewerId = clean(body.viewer_id, 80);
  const note = clean(body.note, 400);

  if (userType !== "creator" && userType !== "viewer") {
    return NextResponse.json({ error: "user_type is required" }, { status: 400 });
  }
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const input = {
    user_type: userType,
    email,
    name,
    application_id: applicationId,
    streamer_id: streamerId,
    viewer_id: viewerId,
    note
  };

  const db = getAdminDb();
  if (!db) {
    const resetRequest = await addLocalPasswordResetRequest(input);
    return NextResponse.json({ request: resetRequest, source: "local" }, { status: 201 });
  }

  const doc = await db.collection("password_reset_requests").add({
    ...input,
    status: "open",
    created_at: FieldValue.serverTimestamp()
  });

  return NextResponse.json({ id: doc.id, source: "firestore" }, { status: 201 });
}

function clean(value: unknown, max: number) {
  return String(value || "").trim().slice(0, max);
}
