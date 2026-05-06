import { NextResponse } from "next/server";
import { FieldValue, getAdminDb } from "@/lib/firebaseAdmin";
import { addLocalReport, readLocalReports } from "@/lib/localStore";
import { requireAdmin } from "@/lib/adminAuth";

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
        streamer_id: data.streamer_id || "",
        streamer_name: data.streamer_name || "",
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
  const payload = {
    streamer_id: clean(body.streamer_id, 120),
    streamer_name: clean(body.streamer_name, 120),
    reason: clean(body.reason, 80),
    detail: clean(body.detail, 800),
    reporter_contact: clean(body.reporter_contact, 120)
  };

  if (!payload.streamer_id || !payload.reason) {
    return NextResponse.json({ error: "streamer_id and reason are required" }, { status: 400 });
  }

  const db = getAdminDb();
  if (!db) {
    const report = await addLocalReport(payload);
    return NextResponse.json({ report, source: "local" }, { status: 201 });
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
