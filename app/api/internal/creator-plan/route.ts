import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import type { PlanType } from "@/lib/types";

/**
 * 配信者の現在のプランを引く内部API。
 *
 * 切り抜きスタジオ(apply.vtubermatch.com / studio/server.py)が、
 * 「PROの4本無料」「プレミアムの1000円引き」を出す前に本当にその会員かを
 * 確かめるために叩く。ログインCookieの中身にはプランが入っておらず、
 * 入れたとしても解約直後は古いままになるので、その都度ここで引く。
 *
 * **Cookieの streamer_id が streamers のドキュメントIDと一致しないことがある。**
 * (実際に、それでは見つからないアカウントが存在した。) 一致しないと会員なのに
 * 無料扱いになり、課金した人が特典を使えなくなるので、
 * streamer_id → application_id → creator_login_id → email の順に手を変えて引く。
 *
 * 認証は INTERNAL_API_KEY(check-vtuber と同じ鍵)。
 */
export const dynamic = "force-dynamic";

const unknownResponse = { found: false, plan_type: "free" as PlanType, resolved_by: "" };

type Ids = {
  streamerId: string;
  applicationId: string;
  creatorLoginId: string;
  email: string;
};

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(unknownResponse, { status: 401 });
  }

  const ids: Ids = {
    streamerId: header(request, "x-streamer-id"),
    applicationId: header(request, "x-application-id"),
    creatorLoginId: header(request, "x-creator-login-id"),
    email: header(request, "x-email").toLowerCase(),
  };
  if (!ids.streamerId && !ids.applicationId && !ids.creatorLoginId && !ids.email) {
    return NextResponse.json(unknownResponse, { status: 400 });
  }

  try {
    const db = getAdminDb();
    if (!db) return NextResponse.json(unknownResponse);

    const found = await resolveStreamer(db, ids);
    if (!found) return NextResponse.json(unknownResponse);

    const data = found.doc.data() || {};
    // 退会・削除済みや解約済みには特典を出さない
    // (plan_type が残っていても購読が切れていることがある)
    const inactive = data.is_deleted === true || data.subscription_status === "canceled";
    return NextResponse.json({
      found: true,
      plan_type: inactive ? "free" : normalizePlan(String(data.plan_type || "free")),
      name: String(data.name || ""),
      resolved_by: found.via,
    });
  } catch (error) {
    console.error("internal creator-plan failed:", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json(unknownResponse, { status: 500 });
  }
}

/** 手を変えながら streamers のドキュメントを探す。 */
async function resolveStreamer(db: FirebaseFirestore.Firestore, ids: Ids) {
  const streamers = db.collection("streamers");

  // 1) Cookie の streamer_id をそのままドキュメントIDとして引く(通常はこれで当たる)
  if (ids.streamerId) {
    const doc = await streamers.doc(ids.streamerId).get();
    if (doc.exists) return { doc, via: "streamer_id" };
  }

  // 2) 申込レコード経由。application が持つ streamer_id を辿る
  const application = await findApplication(db, ids);
  const viaApplication = String(application?.get("streamer_id") || "");
  if (viaApplication && viaApplication !== ids.streamerId) {
    const doc = await streamers.doc(viaApplication).get();
    if (doc.exists) return { doc, via: "application.streamer_id" };
  }

  // 3) メールアドレスで streamers 側を直接引く(IDの対応が壊れている場合の最後の手段)
  const email = ids.email || String(application?.get("email") || "").toLowerCase();
  if (email) {
    for (const field of ["creator_email", "email"]) {
      const snap = await streamers.where(field, "==", email).limit(1).get();
      if (!snap.empty) return { doc: snap.docs[0], via: `streamers.${field}` };
    }
  }

  return null;
}

async function findApplication(db: FirebaseFirestore.Firestore, ids: Ids) {
  const applications = db.collection("applications");
  if (ids.applicationId) {
    const doc = await applications.doc(ids.applicationId).get();
    if (doc.exists) return doc;
  }
  if (ids.creatorLoginId) {
    const snap = await applications.where("creator_login_id", "==", ids.creatorLoginId).limit(1).get();
    if (!snap.empty) return snap.docs[0];
  }
  if (ids.email) {
    const snap = await applications.where("email", "==", ids.email).limit(1).get();
    if (!snap.empty) return snap.docs[0];
  }
  if (ids.streamerId) {
    const snap = await applications.where("streamer_id", "==", ids.streamerId).limit(1).get();
    if (!snap.empty) return snap.docs[0];
  }
  return null;
}

function header(request: Request, name: string) {
  return String(request.headers.get(name) || "").trim();
}

function isAuthorized(request: Request) {
  const apiKey = process.env.INTERNAL_API_KEY || "";
  const authorization = request.headers.get("Authorization") || "";
  if (!apiKey) return false;
  return authorization === `Bearer ${apiKey}`;
}

function normalizePlan(plan: string): PlanType {
  if (plan === "pro" || plan === "pro_monthly" || plan === "pro_yearly") return "pro";
  if (plan === "boost" || plan === "boost_monthly" || plan === "boost_yearly") return "boost";
  if (plan === "paid" || plan === "standard_monthly" || plan === "standard_yearly") return "paid";
  return "free";
}
