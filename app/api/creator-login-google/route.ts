import { NextResponse } from "next/server";
import { FieldValue, getAdminDb } from "@/lib/firebaseAdmin";
import { readLocalApplications, readLocalStreamers, recordLocalCreatorLogin } from "@/lib/localStore";
import { verifyGoogleIdToken } from "@/lib/googleAuth";
import { createUserSession, creatorSessionCookie, userSessionCookieOptions } from "@/lib/userSession";

export async function POST(request: Request) {
  const body = await request.json();
  const credential = String(body.credential || "");

  const googleUser = await verifyGoogleIdToken(credential);
  if (!googleUser) {
    return NextResponse.json({ error: "Google認証に失敗しました。時間をおいて再度お試しください。" }, { status: 401 });
  }
  const email = googleUser.email;

  const db = getAdminDb();

  if (!db) {
    const applications = await readLocalApplications();
    const streamers = await readLocalStreamers();
    const matches = applications.filter((item) => item.email.toLowerCase() === email && isActiveApplication(item));
    const application = matches.find((item) => {
      if (!item.streamer_id) return false;
      const streamer = streamers.find((candidate) => candidate.id === item.streamer_id);
      return isActiveStreamer(streamer);
    }) || matches[0];
    if (!application) return NextResponse.json({ error: "このGoogleアカウントに対応する登録が見つかりません。先に新規登録してください。" }, { status: 404 });
    const streamer = streamers.find((item) => item.id === application.streamer_id);
    if (streamer && !isActiveStreamer(streamer)) {
      return NextResponse.json({ error: "退会済みのデータです。新規登録してください。" }, { status: 401 });
    }
    await recordLocalCreatorLogin({
      application_id: application.id,
      streamer_id: application.streamer_id,
      email,
      name: application.name,
    }).catch(() => undefined);
    const response = NextResponse.json({
      application_id: application.id,
      streamer_id: application.streamer_id || "",
      creator_login_id: application.creator_login_id || "",
      email,
      name: application.name || "",
      plan_type: streamer?.plan_type || application.desired_plan || "free",
      super_boost_count: streamer?.super_boost_count || 0,
      profile: {
        name: streamer?.name || application.name || "",
        youtube_url: streamer?.youtube_url || application.youtube_url || "",
        x_account: streamer?.x_account || application.x_account || "",
        description: streamer?.description || application.description || "",
        one_liner: streamer?.one_liner || application.one_liner || "",
        stream_time: streamer?.stream_time || application.stream_time || "",
        image: streamer?.thumbnails?.[0] || application.thumbnails?.[0] || "",
        categories: streamer?.categories || application.categories || [],
        tags: streamer?.tags || application.tags || [],
      },
    });
    response.cookies.set(creatorSessionCookie, createUserSession({
      application_id: application.id,
      streamer_id: application.streamer_id || "",
      creator_login_id: application.creator_login_id || "",
      email,
    }), userSessionCookieOptions());
    return response;
  }

  const candidateDocs = await findFirestoreCreatorApplicationsByEmail(db, email);
  const matchedDocs = candidateDocs.filter((item) => isActiveApplication(item.data()));
  let doc = matchedDocs.find((item) => item.data().streamer_id) || matchedDocs[0];
  for (const candidate of matchedDocs) {
    const streamerId = candidate.data().streamer_id;
    if (!streamerId) continue;
    const streamerDoc = await db.collection("streamers").doc(String(streamerId)).get();
    if (isActiveStreamer(streamerDoc.data())) {
      doc = candidate;
      break;
    }
  }
  const data = doc?.data();
  if (!doc || !data) {
    return NextResponse.json({ error: "このGoogleアカウントに対応する登録が見つかりません。先に新規登録してください。" }, { status: 404 });
  }

  let planType = data.desired_plan || "free";
  let streamerData: FirebaseFirestore.DocumentData | undefined;
  if (data.streamer_id) {
    const streamerDoc = await db.collection("streamers").doc(String(data.streamer_id)).get();
    streamerData = streamerDoc.data();
    if (streamerData && !isActiveStreamer(streamerData)) {
      return NextResponse.json({ error: "退会済みのデータです。新規登録してください。" }, { status: 401 });
    }
    planType = streamerData?.plan_type || planType;
  }

  await recordFirestoreCreatorLogin({
    applicationRef: doc.ref,
    streamerId: data.streamer_id,
    email,
    name: data.name || "",
    applicationId: doc.id,
  }).catch((error) => {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error("Creator Google login history could not be recorded:", message);
  });

  const response = NextResponse.json({
    application_id: doc.id,
    streamer_id: data.streamer_id || "",
    creator_login_id: data.creator_login_id || "",
    email,
    name: data.name || "",
    plan_type: planType,
    super_boost_count: Number(streamerData?.super_boost_count || 0),
    profile: {
      name: streamerData?.name || data.name || "",
      youtube_url: streamerData?.youtube_url || data.youtube_url || "",
      x_account: streamerData?.x_account || data.x_account || "",
      description: streamerData?.description || data.description || "",
      one_liner: streamerData?.one_liner || data.one_liner || "",
      stream_time: streamerData?.stream_time || data.stream_time || "",
      image: streamerData?.thumbnails?.[0] || data.thumbnails?.[0] || "",
      categories: streamerData?.categories || data.categories || [],
      tags: streamerData?.tags || data.tags || [],
    },
  });
  response.cookies.set(creatorSessionCookie, createUserSession({
    application_id: doc.id,
    streamer_id: data.streamer_id || "",
    creator_login_id: data.creator_login_id || "",
    email,
  }), userSessionCookieOptions());
  return response;
}

async function findFirestoreCreatorApplicationsByEmail(db: FirebaseFirestore.Firestore, email: string) {
  const byId = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
  const addDocs = (docs: FirebaseFirestore.QueryDocumentSnapshot[]) => {
    docs.forEach((doc) => byId.set(doc.id, doc));
  };

  const emailSnapshot = await db.collection("applications").where("email", "==", email).limit(20).get();
  addDocs(emailSnapshot.docs);

  const streamerByEmailSnapshot = await db.collection("streamers").where("creator_email", "==", email).limit(20).get();
  const streamerApplicationIds = streamerByEmailSnapshot.docs
    .filter((doc) => isActiveStreamer(doc.data()))
    .map((doc) => String(doc.data().source_application_id || ""))
    .filter(Boolean);

  await Promise.all(streamerApplicationIds.map(async (applicationId) => {
    const doc = await db.collection("applications").doc(applicationId).get();
    if (doc.exists) byId.set(doc.id, doc as FirebaseFirestore.QueryDocumentSnapshot);
  }));

  return Array.from(byId.values());
}

async function recordFirestoreCreatorLogin(input: {
  applicationRef: FirebaseFirestore.DocumentReference;
  streamerId?: string;
  email: string;
  name: string;
  applicationId: string;
}) {
  const db = getAdminDb();
  if (!db) return;
  const now = FieldValue.serverTimestamp();
  const tasks: Promise<unknown>[] = [
    db.collection("creator_login_events").add({
      application_id: input.applicationId,
      streamer_id: input.streamerId || "",
      email: input.email,
      name: input.name,
      created_at: now,
    }),
    input.applicationRef.set({
      last_creator_login_at: now,
      creator_login_count: FieldValue.increment(1),
    }, { merge: true }),
  ];
  if (input.streamerId) {
    tasks.push(db.collection("streamers").doc(String(input.streamerId)).set({
      last_creator_login_at: now,
      creator_login_count: FieldValue.increment(1),
    }, { merge: true }));
  }
  await Promise.all(tasks);
}

function isActiveApplication(data?: FirebaseFirestore.DocumentData | null) {
  return data?.withdrawal_status !== "requested" && data?.is_deleted !== true;
}

function isActiveStreamer(data?: FirebaseFirestore.DocumentData | null) {
  return Boolean(data) && data?.withdrawal_status !== "requested" && data?.is_deleted !== true;
}
