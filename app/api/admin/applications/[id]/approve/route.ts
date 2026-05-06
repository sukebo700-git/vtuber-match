import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { FieldValue, getAdminDb } from "@/lib/firebaseAdmin";
import { approveLocalApplication } from "@/lib/localStore";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const db = getAdminDb();
  if (!db) {
    const streamer = await approveLocalApplication(params.id);
    if (!streamer) return NextResponse.json({ error: "application not found" }, { status: 404 });
    return NextResponse.json({ streamer, source: "local" });
  }

  try {
    const applicationRef = db.collection("applications").doc(params.id);
    const streamerId = await db.runTransaction(async (tx) => {
      const applicationDoc = await tx.get(applicationRef);
      if (!applicationDoc.exists) throw new Error("application not found");
      const application = applicationDoc.data() || {};
      if (application.desired_plan !== "free" && application.payment_status !== "paid") {
        throw new Error("payment required");
      }

      const streamerRef = db.collection("streamers").doc();
      tx.set(streamerRef, {
        name: application.name,
        youtube_url: application.youtube_url,
        youtube_channel_id: application.youtube_channel_id || null,
        thumbnails: application.thumbnails || [],
        categories: application.categories || [],
        tags: application.tags || [],
        description: application.description,
        one_liner: application.one_liner || application.description,
        stream_time: application.stream_time || "",
        plan_type: application.desired_plan || "free",
        is_initial_scout: false,
        is_visible: true,
        impressions: 0,
        likes: 0,
        created_at: FieldValue.serverTimestamp()
      });
      tx.update(applicationRef, {
        status: "approved",
        reviewed_at: FieldValue.serverTimestamp()
      });

      return streamerRef.id;
    });

    return NextResponse.json({ id: streamerId, source: "firestore" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "approve failed";
    const status = message === "payment required" ? 402 : 404;
    return NextResponse.json({ error: message }, { status });
  }
}
