import { NextResponse } from "next/server";
import { FieldValue, getAdminDb } from "@/lib/firebaseAdmin";
import { addLocalReport, readLocalReports } from "@/lib/localStore";
import { requireAdmin } from "@/lib/adminAuth";
import { creatorSessionCookie, readUserSession } from "@/lib/userSession";

export async function GET(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const db = getAdminDb();
  if (!db) return NextResponse.json({ reports: await readLocalReports(), source: "local" });

  const snapshot = await db.collection("reports").orderBy("created_at", "desc").limit(120).get();
  return NextResponse.json({
    reports: snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        report_type: data.report_type || "streamer",
        streamer_id: data.streamer_id || "",
        streamer_name: data.streamer_name || "",
        viewer_profile_id: data.viewer_profile_id || "",
        viewer_name: data.viewer_name || "",
        reason: data.reason || "",
        detail: data.detail || "",
        reporter_contact: data.reporter_contact || "",
        status: data.status || "open",
        created_at: typeof data.created_at === "string" ? data.created_at : data.created_at?.toDate?.().toISOString()
      };
    }),
    source: "firestore"
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const reportType = clean(body.report_type, 40);
  if (reportType !== "viewer") {
    return NextResponse.json({ error: "viewer reports only" }, { status: 400 });
  }

  const payload = {
    report_type: "viewer" as const,
    streamer_id: clean(body.streamer_id, 120),
    streamer_name: clean(body.streamer_name, 120),
    viewer_profile_id: clean(body.viewer_profile_id, 120),
    viewer_name: clean(body.viewer_name, 120),
    reason: clean(body.reason, 80),
    detail: clean(body.detail, 800),
    reporter_contact: clean(body.reporter_contact, 120)
  };

  if (!payload.streamer_id || !payload.reason) {
    return NextResponse.json({ error: "streamer_id and reason are required" }, { status: 400 });
  }
  if (!payload.viewer_profile_id) {
    return NextResponse.json({ error: "viewer_profile_id is required" }, { status: 400 });
  }
  const session = readUserSession<{ streamer_id?: string }>(request, creatorSessionCookie);
  if (!session?.streamer_id || session.streamer_id !== payload.streamer_id) {
    return NextResponse.json({ error: "creator login required" }, { status: 401 });
  }

  const db = getAdminDb();
  if (!db) {
    const report = await addLocalReport(payload);
    return NextResponse.json({ report, source: "local" }, { status: 201 });
  }
  const matchSnapshot = await db.collection("likes")
    .where("streamer_id", "==", payload.streamer_id)
    .where("viewer_profile_id", "==", payload.viewer_profile_id)
    .limit(1)
    .get();
  if (matchSnapshot.empty) {
    return NextResponse.json({ error: "matched viewer is required" }, { status: 403 });
  }

  const doc = await db.collection("reports").add({
    ...payload,
    status: "open",
    created_at: FieldValue.serverTimestamp()
  });

  return NextResponse.json({ id: doc.id, source: "firestore" }, { status: 201 });
}

function clean(value: unknown, max: number) {
  return String(value || "").trim().slice(0, max);
}
