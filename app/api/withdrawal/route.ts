import { NextResponse } from "next/server";
import { FieldValue, getAdminDb } from "@/lib/firebaseAdmin";
import { readLocalApplications, readLocalStreamers, updateLocalApplication, updateLocalStreamer } from "@/lib/localStore";
import { creatorSessionCookie, readUserSession } from "@/lib/userSession";

type CreatorSession = {
  email?: string;
  application_id?: string;
  streamer_id?: string;
  creator_login_id?: string;
};

export async function POST(request: Request) {
  const session = readUserSession<CreatorSession>(request, creatorSessionCookie);
  if (!session?.email && !session?.application_id && !session?.streamer_id && !session?.creator_login_id) {
    return NextResponse.json({ error: "creator login required" }, { status: 401 });
  }

  const now = new Date().toISOString();
  const db = getAdminDb();
  if (!db) {
    const [applications, streamers] = await Promise.all([readLocalApplications(), readLocalStreamers()]);
    const application = applications.find((item) => (
      Boolean(session.application_id && item.id === session.application_id) ||
      Boolean(session.streamer_id && item.streamer_id === session.streamer_id) ||
      Boolean(session.creator_login_id && item.creator_login_id === session.creator_login_id) ||
      Boolean(session.email && item.email.toLowerCase() === String(session.email).toLowerCase())
    ));
    if (!application?.streamer_id) return NextResponse.json({ error: "streamer not found" }, { status: 404 });
    const streamer = streamers.find((item) => item.id === application.streamer_id);
    if (isPaidActive(streamer?.plan_type || application.desired_plan, application.subscription_status)) {
      return NextResponse.json({ error: "先に有料プランの解約をしてください。" }, { status: 409 });
    }
    await updateLocalStreamer(application.streamer_id, {
      is_visible: false,
      withdrawal_status: "requested",
      withdrawal_requested_at: now
    });
    await updateLocalApplication(application.id, {
      withdrawal_status: "requested",
      withdrawal_requested_at: now
    });
    return withLoggedOutCookie(NextResponse.json({ ok: true, message: "退会申請を受け付けました", source: "local" }));
  }

  const applicationDoc = await findApplicationDoc(db, session);
  if (!applicationDoc?.exists) return NextResponse.json({ error: "application not found" }, { status: 404 });
  const application = applicationDoc.data() || {};
  const streamerId = session.streamer_id || application.streamer_id || "";
  if (!streamerId) return NextResponse.json({ error: "streamer not found" }, { status: 404 });

  const streamerDoc = await db.collection("streamers").doc(String(streamerId)).get();
  const streamer = streamerDoc.data() || {};
  if (isPaidActive(String(streamer.plan_type || application.desired_plan || "free"), String(application.subscription_status || ""))) {
    return NextResponse.json({ error: "先に有料プランの解約をしてください。" }, { status: 409 });
  }

  await db.runTransaction(async (transaction) => {
    transaction.set(db.collection("streamers").doc(String(streamerId)), {
      is_visible: false,
      is_deleted: true,
      withdrawal_status: "requested",
      withdrawal_requested_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp()
    }, { merge: true });
    transaction.set(applicationDoc.ref, {
      withdrawal_status: "requested",
      withdrawal_requested_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp()
    }, { merge: true });
  });

  return withLoggedOutCookie(NextResponse.json({ ok: true, message: "退会申請を受け付けました", source: "firestore" }));
}

async function findApplicationDoc(db: NonNullable<ReturnType<typeof getAdminDb>>, session: CreatorSession) {
  if (session.application_id) return db.collection("applications").doc(String(session.application_id)).get();
  if (session.creator_login_id) {
    const snapshot = await db.collection("applications").where("creator_login_id", "==", String(session.creator_login_id)).limit(1).get();
    if (snapshot.docs[0]) return snapshot.docs[0];
  }
  if (session.streamer_id) {
    const snapshot = await db.collection("applications").where("streamer_id", "==", String(session.streamer_id)).limit(1).get();
    if (snapshot.docs[0]) return snapshot.docs[0];
  }
  if (session.email) {
    const snapshot = await db.collection("applications").where("email", "==", String(session.email).toLowerCase()).limit(1).get();
    return snapshot.docs[0];
  }
  return undefined;
}

function isPaidActive(planType: string | undefined, subscriptionStatus: string | undefined) {
  return (planType === "paid" || planType === "boost") && subscriptionStatus !== "canceled";
}

function withLoggedOutCookie(response: NextResponse) {
  response.cookies.set(creatorSessionCookie, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });
  return response;
}
