import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { readLocalApplications, readLocalStreamers } from "@/lib/localStore";
import { creatorSessionCookie, readUserSession } from "@/lib/userSession";

type CreatorSession = {
  email?: string;
  application_id?: string;
  streamer_id?: string;
  creator_login_id?: string;
};

export async function GET(request: Request) {
  const session = readUserSession<CreatorSession>(request, creatorSessionCookie);
  if (!session?.email && !session?.application_id && !session?.streamer_id && !session?.creator_login_id) {
    return NextResponse.json({ error: "creator login required" }, { status: 401 });
  }

  const db = getAdminDb();
  if (!db) {
    const [applications, streamers] = await Promise.all([readLocalApplications(), readLocalStreamers()]);
    const application = applications.find((item) => (
      Boolean(session.application_id && item.id === session.application_id) ||
      Boolean(session.streamer_id && item.streamer_id === session.streamer_id) ||
      Boolean(session.creator_login_id && item.creator_login_id === session.creator_login_id) ||
      Boolean(session.email && item.email.toLowerCase() === String(session.email).toLowerCase())
    ));
    const streamer = streamers.find((item) => item.id === (session.streamer_id || application?.streamer_id));
    return NextResponse.json({
      application_id: application?.id || "",
      streamer_id: streamer?.id || application?.streamer_id || "",
      plan_type: streamer?.plan_type || application?.desired_plan || "free",
      subscription_status: application?.subscription_status || "",
      stripe_subscription_id: application?.stripe_subscription_id || "",
      withdrawal_status: streamer?.withdrawal_status || application?.withdrawal_status || "none",
      source: "local"
    });
  }

  const applicationDoc = session.application_id
    ? await db.collection("applications").doc(String(session.application_id)).get()
    : session.email
      ? (await db.collection("applications").where("email", "==", String(session.email).toLowerCase()).limit(1).get()).docs[0]
      : undefined;
  const application = applicationDoc?.data();
  const streamerId = session.streamer_id || application?.streamer_id || "";
  const streamerDoc = streamerId ? await db.collection("streamers").doc(String(streamerId)).get() : undefined;
  const streamer = streamerDoc?.data();

  return NextResponse.json({
    application_id: applicationDoc?.id || "",
    streamer_id: streamerId,
    plan_type: streamer?.plan_type || application?.desired_plan || "free",
    subscription_status: application?.subscription_status || "",
    stripe_subscription_id: application?.stripe_subscription_id || "",
    withdrawal_status: streamer?.withdrawal_status || application?.withdrawal_status || "none",
    source: "firestore"
  });
}
