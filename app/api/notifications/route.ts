import { NextResponse } from "next/server";
import { FieldValue, getAdminDb } from "@/lib/firebaseAdmin";
import { creatorSessionCookie, readUserSession, viewerSessionCookie } from "@/lib/userSession";

type NotificationSession =
  | { targetType: "streamer"; field: "streamer_id"; id: string }
  | { targetType: "viewer"; field: "viewer_profile_id"; id: string };

export async function GET(request: Request) {
  const session = readNotificationSession(request);
  if (!session) return NextResponse.json({ error: "login required" }, { status: 401 });

  const db = getAdminDb();
  if (!db) return NextResponse.json({ notifications: [], source: "local" });

  try {
    const snapshot = await db.collection("notifications")
      .where("target_type", "==", session.targetType)
      .where(session.field, "==", session.id)
      .orderBy("created_at", "desc")
      .limit(20)
      .get();

    return NextResponse.json({
      notifications: snapshot.docs.map((doc) => sanitizeNotification(doc.id, doc.data())),
      source: "firestore",
    });
  } catch (error) {
    console.error("notifications query failed:", error instanceof Error ? error.message : String(error || "unknown"));
    return NextResponse.json({ notifications: [], index_required: true, source: "firestore" });
  }
}

export async function PATCH(request: Request) {
  const session = readNotificationSession(request);
  if (!session) return NextResponse.json({ error: "login required" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const id = String(body.id || "").trim();
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const db = getAdminDb();
  if (!db) return NextResponse.json({ ok: true, source: "local" });

  const ref = db.collection("notifications").doc(id);
  const doc = await ref.get();
  if (!doc.exists) return NextResponse.json({ error: "notification not found" }, { status: 404 });
  const data = doc.data() || {};
  if (data.target_type !== session.targetType || String(data[session.field] || "") !== session.id) {
    return NextResponse.json({ error: "notification not found" }, { status: 404 });
  }

  await ref.set({
    read: true,
    read_at: FieldValue.serverTimestamp(),
  }, { merge: true });

  return NextResponse.json({ ok: true, source: "firestore" });
}

function readNotificationSession(request: Request): NotificationSession | null {
  const creator = readUserSession<{ streamer_id?: string }>(request, creatorSessionCookie);
  if (creator?.streamer_id) {
    return { targetType: "streamer", field: "streamer_id", id: String(creator.streamer_id) };
  }

  const viewer = readUserSession<{ id?: string }>(request, viewerSessionCookie);
  if (viewer?.id) {
    return { targetType: "viewer", field: "viewer_profile_id", id: String(viewer.id) };
  }

  return null;
}

function sanitizeNotification(id: string, data: FirebaseFirestore.DocumentData) {
  return {
    id,
    target_type: data.target_type || "",
    type: data.type || "",
    title: String(data.title || "通知"),
    body: String(data.body || ""),
    read: data.read === true,
    created_at: toIso(data.created_at),
  };
}

function toIso(value: unknown) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  return "";
}
