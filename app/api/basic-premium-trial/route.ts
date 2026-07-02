import { NextResponse } from "next/server";
import { FieldValue, getAdminDb, stripUndefined } from "@/lib/firebaseAdmin";
import { readLocalApplications, readLocalStreamers, updateLocalStreamer } from "@/lib/localStore";
import { creatorSessionCookie, readUserSession } from "@/lib/userSession";
import type { Streamer } from "@/lib/types";

type CreatorSession = {
  email?: string;
  application_id?: string;
  streamer_id?: string;
  creator_login_id?: string;
};

export async function GET(request: Request) {
  const session = readUserSession<CreatorSession>(request, creatorSessionCookie);
  if (!session) return NextResponse.json({ error: "creator login required" }, { status: 401 });

  const db = getAdminDb();
  if (!db) {
    const streamer = await resolveLocalStreamer(session);
    if (!streamer) return NextResponse.json({ error: "streamer not found" }, { status: 404 });
    return NextResponse.json({ trial: buildTrialResponse(streamer), source: "local" });
  }

  const resolved = await resolveFirestoreStreamer(db, session);
  if (!resolved) return NextResponse.json({ error: "streamer not found" }, { status: 404 });
  return NextResponse.json({ trial: buildTrialResponse({ id: resolved.id, ...resolved.data } as Streamer), source: "firestore" });
}

export async function POST(request: Request) {
  const session = readUserSession<CreatorSession>(request, creatorSessionCookie);
  if (!session) return NextResponse.json({ error: "creator login required" }, { status: 401 });

  const db = getAdminDb();
  const now = new Date();
  const month = jstMonth(now);
  const until = addHours(now, 72);

  if (!db) {
    const streamer = await resolveLocalStreamer(session);
    if (!streamer) return NextResponse.json({ error: "streamer not found" }, { status: 404 });
    if (streamer.plan_type !== "paid") return NextResponse.json({ error: "ベーシックプラン限定です。", code: "NOT_BASIC_PLAN" }, { status: 403 });
    if (streamer.basic_premium_trial_last_month === month) return NextResponse.json({ error: "今月のプレミアム体験は使用済みです。", code: "TRIAL_ALREADY_USED" }, { status: 409 });

    const updated = await updateLocalStreamer(streamer.id, {
      basic_premium_trial_until: until,
      basic_premium_trial_last_month: month,
    });
    return NextResponse.json({ trial: buildTrialResponse(updated || { ...streamer, basic_premium_trial_until: until, basic_premium_trial_last_month: month }), source: "local" });
  }

  const resolved = await resolveFirestoreStreamer(db, session);
  if (!resolved) return NextResponse.json({ error: "streamer not found" }, { status: 404 });

  const trial = await db.runTransaction(async (tx) => {
    const doc = await tx.get(resolved.ref);
    if (!doc.exists || doc.data()?.is_deleted === true) {
      return { response: NextResponse.json({ error: "streamer not found" }, { status: 404 }) };
    }

    const data = doc.data() || {};
    if (data.plan_type !== "paid") {
      return { response: NextResponse.json({ error: "ベーシックプラン限定です。", code: "NOT_BASIC_PLAN" }, { status: 403 }) };
    }
    if (data.basic_premium_trial_last_month === month) {
      return { response: NextResponse.json({ error: "今月のプレミアム体験は使用済みです。", code: "TRIAL_ALREADY_USED" }, { status: 409 }) };
    }

    const patch = stripUndefined({
      basic_premium_trial_until: until,
      basic_premium_trial_last_month: month,
      basic_premium_trial_started_at: FieldValue.serverTimestamp(),
    });
    tx.set(resolved.ref, patch, { merge: true });
    return { response: null, streamer: { id: doc.id, ...data, ...patch } as Partial<Streamer> };
  });

  if (trial.response) return trial.response;
  return NextResponse.json({ trial: buildTrialResponse(trial.streamer), source: "firestore" });
}

async function resolveLocalStreamer(session: CreatorSession) {
  const [applications, streamers] = await Promise.all([readLocalApplications(), readLocalStreamers()]);
  if (session.streamer_id) {
    const direct = streamers.find((streamer) => streamer.id === session.streamer_id);
    if (direct) return direct;
  }
  const application = applications.find((item) => (
    Boolean(session.application_id && item.id === session.application_id) ||
    Boolean(session.creator_login_id && item.creator_login_id === session.creator_login_id) ||
    Boolean(session.email && item.email.toLowerCase() === String(session.email).toLowerCase())
  ));
  return streamers.find((streamer) => streamer.id === application?.streamer_id) || null;
}

async function resolveFirestoreStreamer(db: FirebaseFirestore.Firestore, session: CreatorSession) {
  if (session.streamer_id) {
    const ref = db.collection("streamers").doc(String(session.streamer_id));
    const doc = await ref.get();
    if (doc.exists) return { id: doc.id, ref, data: doc.data() || {} };
  }

  let applicationDoc: FirebaseFirestore.DocumentSnapshot | undefined;
  if (session.application_id) {
    applicationDoc = await db.collection("applications").doc(String(session.application_id)).get();
  }
  if ((!applicationDoc || !applicationDoc.exists) && session.creator_login_id) {
    applicationDoc = (await db.collection("applications").where("creator_login_id", "==", String(session.creator_login_id)).limit(1).get()).docs[0];
  }
  if ((!applicationDoc || !applicationDoc.exists) && session.email) {
    applicationDoc = (await db.collection("applications").where("email", "==", String(session.email).toLowerCase()).limit(1).get()).docs[0];
  }

  const streamerId = String(applicationDoc?.data()?.streamer_id || "");
  if (!streamerId) return null;
  const ref = db.collection("streamers").doc(streamerId);
  const doc = await ref.get();
  return doc.exists ? { id: doc.id, ref, data: doc.data() || {} } : null;
}

function buildTrialResponse(streamer?: Partial<Streamer> | null) {
  const until = toIso(streamer?.basic_premium_trial_until);
  return {
    plan_type: streamer?.plan_type || "free",
    payment_state: streamer?.payment_state === "past_due" ? "past_due" : "active",
    basic_premium_trial_until: until,
    basic_premium_trial_last_month: streamer?.basic_premium_trial_last_month || "",
    active: Boolean(until && Date.parse(until) > Date.now()),
    used_this_month: streamer?.basic_premium_trial_last_month === jstMonth(new Date()),
  };
}

function jstMonth(date: Date) {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
  }).format(date).replace("/", "-");
}

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000).toISOString();
}

function toIso(value: unknown) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  return "";
}
