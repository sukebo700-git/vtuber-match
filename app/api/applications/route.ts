import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { requireAdmin } from "@/lib/adminAuth";
import { diagnosisTypes } from "@/lib/diagnosis";
import { FieldValue, getAdminDb, stripUndefined } from "@/lib/firebaseAdmin";
import { addLocalApplication, addLocalStreamer, findLocalStreamer, readLocalApplications, readLocalStreamers, updateLocalApplication } from "@/lib/localStore";
import { notifyAdminNewApplication } from "@/lib/notifications";
import { hashPassword, makeCreatorLoginId } from "@/lib/password";
import { createUserSession, creatorSessionCookie, userSessionCookieOptions } from "@/lib/userSession";
import type { PlanType } from "@/lib/types";

const maxImagePayloadSize = 820_000;

export async function GET(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const db = getAdminDb();
  if (!db) return NextResponse.json({ applications: await readLocalApplications(), source: "local" });

  // Avoid fetching thumbnails/description on the application list. Legacy docs may miss updated_at, so sort after a lightweight read.
  const snapshot = await db.collection("applications")
    .select(
      "name",
      "email",
      "youtube_url",
      "youtube_channel_id",
      "x_account",
      "categories",
      "tags",
      "one_liner",
      "stream_time",
      "desired_plan",
      "payment_status",
      "status",
      "admin_note",
      "created_at",
      "updated_at",
      "reviewed_at",
      "paid_at",
      "subscription_status",
      "stripe_subscription_id",
      "withdrawal_status",
      "withdrawal_requested_at",
      "streamer_id",
      "creator_login_id",
      "creator_password_hash",
    )
    .limit(160)
    .get();
  return NextResponse.json({
    applications: snapshot.docs
      .map((doc): Record<string, unknown> & { id: string } => ({ id: doc.id, ...doc.data(), thumbnails: [], description: "" }))
      .sort((a, b) => sortTime(b.created_at ?? b.updated_at) - sortTime(a.created_at ?? a.updated_at))
      .slice(0, 80),
    source: "firestore",
  });
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "登録内容を読み取れませんでした。画像容量が大きすぎる可能性があります。" }, { status: 400 });
  }

  const error = validate(body);
  if (error) return NextResponse.json({ error }, { status: 400 });

  const desiredPlan = normalizePlan(String(body.desired_plan || "free"));
  const payload = {
    name: String(body.name).trim(),
    email: String(body.email).trim().toLowerCase(),
    youtube_url: normalizePublicUrl(String(body.youtube_url)),
    youtube_channel_id: String(body.youtube_channel_id || "").trim(),
    x_account: normalizeXAccount(body.x_account),
    thumbnails: normalizeThumbnails(sanitizeArray(body.thumbnails), desiredPlan),
    categories: sanitizeArray(body.categories).slice(0, 3),
    tags: sanitizeArray(body.tags).slice(0, 3),
    description: String(body.description || "").trim().slice(0, desiredPlan === "free" ? 100 : 500),
    one_liner: String(body.one_liner || "").trim().slice(0, 20),
    stream_time: String(body.stream_time || "").trim().slice(0, 50),
    desired_plan: desiredPlan,
    creator_login_id: makeCreatorLoginId(),
    creator_password_hash: hashPassword(String(body.creator_password || "")),
    admin_note: "",
    ...buildVtypePatch(body),
  };

  const imagePayloadSize = payload.thumbnails.reduce((sum, image) => sum + image.length, 0);
  if (imagePayloadSize > maxImagePayloadSize) {
    return NextResponse.json({
      error: "画像容量が大きすぎます。画像を少し小さくするか、登録枚数を減らしてもう一度お試しください。",
      reason: "image_payload_too_large",
    }, { status: 413 });
  }

  const db = getAdminDb();
  if (!db) {
    const claimTarget = findClaimTarget(await readLocalStreamers(), payload.youtube_url, payload.x_account);
    if (claimTarget) {
      const existingClaim = (await readLocalApplications()).find((application) => (
        application.claim_status === "pending" &&
        application.claim_target_streamer_id === claimTarget.id &&
        Date.parse(String(application.claim_expires_at || "")) > Date.now()
      ));
      if (existingClaim) {
        return NextResponse.json({ error: "このページには確認待ちの引き継ぎ申請があります。公式XのDMで運営へお問い合わせください。" }, { status: 409 });
      }
      const claim = buildClaimFields(claimTarget.id, payload.x_account);
      const application = await addLocalApplication({
        ...payload,
        desired_plan: claimTarget.plan_type || "free",
        ...claim,
      });
      return NextResponse.json({
        application: safeClaimApplication(application),
        claim_pending: true,
        claim_verification_code: claim.claim_verification_code,
        claim_x_account: claimTarget.x_account || "",
        source: "local",
      }, { status: 202 });
    }

    const hasWithdrawalHistory = await hasLocalWithdrawalHistory(payload.email);
    const activeExisting = hasWithdrawalHistory ? null : await findActiveLocalExistingApplication(payload.email);
    if (activeExisting) {
      const existingStreamer = activeExisting.streamer_id ? await findLocalStreamer(activeExisting.streamer_id) : null;
      const response = NextResponse.json({
        application: activeExisting,
        streamer: existingStreamer,
        streamer_id: existingStreamer?.id || activeExisting.streamer_id || "",
        creator_login_id: activeExisting.creator_login_id,
        auto_approved: activeExisting.status === "approved",
        already_registered: true,
        source: "local",
      }, { status: existingStreamer ? 200 : 409 });
      response.cookies.set(creatorSessionCookie, createUserSession({
        application_id: activeExisting.id,
        streamer_id: existingStreamer?.id || activeExisting.streamer_id || "",
        creator_login_id: activeExisting.creator_login_id || "",
        email: payload.email,
      }), userSessionCookieOptions());
      return response;
    }

    const application = await addLocalApplication(payload);
    const streamer = await addLocalStreamer({
      name: payload.name,
      creator_email: payload.email,
      youtube_url: payload.youtube_url,
      youtube_channel_id: payload.youtube_channel_id,
      x_account: payload.x_account,
      thumbnails: payload.thumbnails,
      categories: payload.categories,
      tags: payload.tags,
      description: payload.description,
      one_liner: payload.one_liner,
      stream_time: payload.stream_time,
      vtype_id: payload.vtype_id,
      vtype_code: payload.vtype_code,
      vtype_name: payload.vtype_name,
      vtype_scores: payload.vtype_scores,
      vtype_mode: payload.vtype_mode,
      vtype_result_id: payload.vtype_result_id,
      vtype_updated_at: payload.vtype_updated_at,
      plan_type: payload.desired_plan,
      is_initial_scout: false,
      is_visible: payload.desired_plan === "free",
      withdrawal_status: "none",
      is_deleted: false,
      source_application_id: application.id
    });
    await updateLocalApplication(application.id, {
      streamer_id: streamer.id,
      status: payload.desired_plan === "free" ? "approved" : "pending",
      reviewed_at: payload.desired_plan === "free" ? new Date().toISOString() : undefined
    });
    const response = NextResponse.json({
      application: { ...application, status: payload.desired_plan === "free" ? "approved" : application.status, streamer_id: streamer.id },
      streamer,
      streamer_id: streamer.id,
      creator_login_id: application.creator_login_id,
      auto_approved: payload.desired_plan === "free",
      source: "local",
    }, { status: 201 });
    response.cookies.set(creatorSessionCookie, createUserSession({
      application_id: application.id,
      streamer_id: streamer.id,
      creator_login_id: application.creator_login_id || "",
      email: payload.email,
    }), userSessionCookieOptions());
    return response;
  }

  const claimTarget = await findFirestoreClaimTarget(db, payload.youtube_url, payload.x_account);
  if (claimTarget) {
    const existingClaimSnapshot = await db.collection("applications")
      .where("claim_target_streamer_id", "==", claimTarget.id)
      .limit(10)
      .get();
    const hasActiveClaim = existingClaimSnapshot.docs.some((doc) => {
      const data = doc.data();
      return data.claim_status === "pending" && Date.parse(String(data.claim_expires_at || "")) > Date.now();
    });
    if (hasActiveClaim) {
      return NextResponse.json({ error: "このページには確認待ちの引き継ぎ申請があります。公式XのDMで運営へお問い合わせください。" }, { status: 409 });
    }
    const claim = buildClaimFields(claimTarget.id, payload.x_account);
    const applicationRef = await db.collection("applications").add(stripUndefined({
      ...payload,
      desired_plan: normalizePlan(String(claimTarget.data().plan_type || "free")),
      ...claim,
      payment_status: "not_required",
      status: "pending",
      withdrawal_status: "none",
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    }));
    await notifyAdminNewApplication({
      applicationId: applicationRef.id,
      streamerName: payload.name,
      desiredPlan: payload.desired_plan,
    }).catch((notifyError) => console.error("Failed to notify admin about claim request", notifyError));
    return NextResponse.json({
      application: { id: applicationRef.id, name: payload.name, status: "pending" },
      claim_pending: true,
      claim_verification_code: claim.claim_verification_code,
      claim_x_account: String(claimTarget.data().x_account || ""),
      source: "firestore",
    }, { status: 202 });
  }

  const existingSnapshot = await db.collection("applications").where("email", "==", payload.email).limit(10).get();
  const streamerByEmailSnapshot = await db.collection("streamers").where("creator_email", "==", payload.email).limit(20).get();
  const hasWithdrawalHistory = existingSnapshot.docs.some((doc) => isInactiveData(doc.data())) ||
    streamerByEmailSnapshot.docs.some((doc) => isInactiveData(doc.data()));
  const activeExistingApplications = existingSnapshot.docs
    .map((existingDoc) => ({ id: existingDoc.id, data: existingDoc.data(), ref: existingDoc.ref }))
    .filter((item) => isActiveData(item.data));
  const usableExistingApplications = [];
  if (!hasWithdrawalHistory) {
    for (const item of activeExistingApplications) {
      const streamerId = String(item.data.streamer_id || "");
      if (!streamerId) {
        usableExistingApplications.push(item);
        continue;
      }
      const streamerDoc = await db.collection("streamers").doc(streamerId).get();
      if (!streamerDoc.exists || isActiveData(streamerDoc.data())) usableExistingApplications.push(item);
    }
  }
  const existingApproved = usableExistingApplications.find((item) => item.data.status === "approved" || item.data.streamer_id);
  if (existingApproved) {
    const existingStreamerId = String(existingApproved.data.streamer_id || "");
    let streamerId = existingStreamerId;
    if (!streamerId) {
      const streamerSnapshot = await db.collection("streamers")
        .where("source_application_id", "==", existingApproved.id)
        .limit(10)
        .get();
      streamerId = streamerSnapshot.docs.find((doc) => isActiveData(doc.data()))?.id || "";
    }
    const response = NextResponse.json({
      id: existingApproved.id,
      streamer_id: streamerId,
      creator_login_id: existingApproved.data.creator_login_id || "",
      auto_approved: true,
      already_registered: true,
      source: "firestore",
    }, { status: 200 });
    response.cookies.set(creatorSessionCookie, createUserSession({
      application_id: existingApproved.id,
      streamer_id: streamerId,
      creator_login_id: existingApproved.data.creator_login_id || "",
      email: payload.email,
    }), userSessionCookieOptions());
    return response;
  }

  if (usableExistingApplications.length > 0) {
    return NextResponse.json({
      error: "このメールアドレスではすでに登録申請があります。ログイン、またはプロフィール修正をご利用ください。",
      already_registered: true,
      source: "firestore",
    }, { status: 409 });
  }

  const applicationData = {
    ...payload,
    payment_status: payload.desired_plan === "free" ? "not_required" : "pending",
    status: payload.desired_plan === "free" ? "approved" : "pending",
    withdrawal_status: "none",
    created_at: FieldValue.serverTimestamp(),
  };
  const doc = await db.collection("applications").add(stripUndefined(applicationData));
  await notifyAdminNewApplication({
    applicationId: doc.id,
    streamerName: payload.name,
    desiredPlan: payload.desired_plan,
  }).catch((notifyError) => console.error("Failed to notify admin about new application", notifyError));

  const streamerRef = await db.collection("streamers").add(stripUndefined({
    name: payload.name,
    creator_email: payload.email,
    youtube_url: payload.youtube_url,
    youtube_channel_id: payload.youtube_channel_id,
    x_account: payload.x_account,
    thumbnails: payload.thumbnails,
    categories: payload.categories,
    tags: payload.tags,
    description: payload.description,
    one_liner: payload.one_liner,
    stream_time: payload.stream_time,
    vtype_id: payload.vtype_id,
    vtype_code: payload.vtype_code,
    vtype_name: payload.vtype_name,
    vtype_scores: payload.vtype_scores,
    vtype_mode: payload.vtype_mode,
    vtype_result_id: payload.vtype_result_id,
    vtype_updated_at: payload.vtype_updated_at,
    plan_type: payload.desired_plan,
    is_initial_scout: false,
    is_visible: payload.desired_plan === "free",
    is_deleted: false,
    withdrawal_status: "none",
    impressions: 0,
    likes: 0,
    source_application_id: doc.id,
    registered_at: FieldValue.serverTimestamp(),
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  }));
  const streamerId = streamerRef.id;
  await db.collection("applications").doc(doc.id).set(stripUndefined({
    ...(payload.desired_plan === "free" ? { reviewed_at: FieldValue.serverTimestamp() } : {}),
    streamer_id: streamerId,
    updated_at: FieldValue.serverTimestamp(),
  }), { merge: true });

  const response = NextResponse.json({
    id: doc.id,
    streamer_id: streamerId,
    creator_login_id: payload.creator_login_id,
    auto_approved: payload.desired_plan === "free",
    source: "firestore",
  }, { status: 201 });
  response.cookies.set(creatorSessionCookie, createUserSession({
    application_id: doc.id,
    streamer_id: streamerId,
    creator_login_id: payload.creator_login_id,
    email: payload.email,
  }), userSessionCookieOptions());
  return response;
}

function normalizeXAccount(value: unknown) {
  const account = String(value || "").trim();
  if (!account) return "";
  return account.replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//i, "@").replace(/^([^@])/, "@$1").slice(0, 40);
}

function normalizePublicUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function normalizeXForMatch(value: unknown) {
  return normalizeXAccount(value).toLowerCase();
}

function findClaimTarget(
  streamers: Array<{ id: string; youtube_url: string; x_account?: string; plan_type?: PlanType; is_initial_scout?: boolean; is_deleted?: boolean; withdrawal_status?: string }>,
  youtubeUrl: string,
  xAccount: string,
) {
  const normalizedX = normalizeXForMatch(xAccount);
  return streamers.find((streamer) => (
    streamer.is_initial_scout === true &&
    streamer.is_deleted !== true &&
    streamer.withdrawal_status !== "requested" &&
    (
      normalizePublicUrl(streamer.youtube_url) === youtubeUrl ||
      (normalizedX && normalizeXForMatch(streamer.x_account) === normalizedX)
    )
  ));
}

async function findFirestoreClaimTarget(db: FirebaseFirestore.Firestore, youtubeUrl: string, xAccount: string) {
  const matches = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
  const youtubeSnapshot = await db.collection("streamers").where("youtube_url", "==", youtubeUrl).limit(10).get();
  youtubeSnapshot.docs.forEach((doc) => matches.set(doc.id, doc));
  const normalizedX = normalizeXAccount(xAccount);
  if (normalizedX) {
    const xSnapshot = await db.collection("streamers").where("x_account", "==", normalizedX).limit(10).get();
    xSnapshot.docs.forEach((doc) => matches.set(doc.id, doc));
  }
  return Array.from(matches.values()).find((doc) => {
    const data = doc.data();
    return data.is_initial_scout === true && data.is_deleted !== true && data.withdrawal_status !== "requested";
  });
}

function buildClaimFields(targetStreamerId: string, xAccount: string) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const token = randomBytes(4).toString("hex").toUpperCase();
  return {
    claim_status: "pending" as const,
    claim_target_streamer_id: targetStreamerId,
    claim_verification_code: `VM-${token.slice(0, 4)}-${token.slice(4)}`,
    claim_x_account: normalizeXAccount(xAccount),
    claim_requested_at: now.toISOString(),
    claim_expires_at: expiresAt.toISOString(),
  };
}

function safeClaimApplication(application: { id: string; name: string; status: string }) {
  return { id: application.id, name: application.name, status: application.status };
}

function normalizePlan(plan: string): PlanType {
  if (plan === "paid" || plan === "boost") return plan;
  return "free";
}

function buildVtypePatch(body: Record<string, unknown>) {
  const type = diagnosisTypes.find((item) => item.id === Number(body.vtype_id));
  if (!type) return {};
  return {
    vtype_id: type.id,
    vtype_code: type.code,
    vtype_name: type.name,
    vtype_scores: normalizeScoreMap(body.vtype_scores),
    vtype_mode: String(body.vtype_mode || "light").trim().slice(0, 20),
    vtype_result_id: String(body.vtype_result_id || "").trim().slice(0, 120),
    vtype_updated_at: String(body.vtype_updated_at || new Date().toISOString()).trim().slice(0, 50),
  };
}

function normalizeScoreMap(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const entries = Object.entries(value as Record<string, unknown>)
    .map(([key, score]) => [key, Math.max(0, Math.min(100, Math.round(Number(score))))] as const)
    .filter(([, score]) => Number.isFinite(score));
  return entries.length ? Object.fromEntries(entries) : undefined;
}

function sortTime(value: unknown) {
  const iso = typeof value === "string" ? value : value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function" ? value.toDate().toISOString() : "";
  const time = Date.parse(iso);
  return Number.isFinite(time) ? time : 0;
}

async function findActiveLocalExistingApplication(email: string) {
  const applications = await readLocalApplications();
  for (const application of applications) {
    if (application.email.toLowerCase() !== email || !isActiveData(application)) continue;
    if (!application.streamer_id) return application;
    const streamer = await findLocalStreamer(application.streamer_id);
    if (!streamer || isActiveData(streamer)) return application;
  }
  return null;
}

async function hasLocalWithdrawalHistory(email: string) {
  const applications = await readLocalApplications();
  if (applications.some((application) => application.email.toLowerCase() === email && isInactiveData(application))) return true;
  for (const application of applications) {
    if (application.email.toLowerCase() !== email || !application.streamer_id) continue;
    const streamer = await findLocalStreamer(application.streamer_id);
    if (isInactiveData(streamer)) return true;
  }
  return false;
}

function isActiveData(data?: { withdrawal_status?: string; is_deleted?: boolean } | null) {
  return data?.withdrawal_status !== "requested" && data?.is_deleted !== true;
}

function isInactiveData(data?: { withdrawal_status?: string; is_deleted?: boolean } | null) {
  return data?.withdrawal_status === "requested" || data?.is_deleted === true;
}

function validate(body: Record<string, unknown>) {
  const plan = normalizePlan(String(body.desired_plan || "free"));
  const categoryCount = sanitizeArray(body.categories).length;
  const tagCount = sanitizeArray(body.tags).length;
  const thumbnailCount = sanitizeArray(body.thumbnails).length;
  if (!body.name) return "配信者名を入力してください。";
  if (!body.email) return "メールアドレスを入力してください。";
  if (!body.youtube_url) return "動画・配信サイトURLを入力してください。";
  if (thumbnailCount < 1) return "画像を1枚以上登録してください。";
  if (String(body.description || "").length > (plan === "free" ? 100 : 500)) return plan === "free" ? "無料プランの自己アピールは100文字までです。" : "自己アピールは500文字までです。";
  if (plan !== "free" && !body.description) return "ベーシックプラン以上では自己アピールを入力してください。";
  if (plan !== "free" && !body.one_liner) return "ベーシックプラン以上では今日のひとことを入力してください。";
  if (String(body.creator_password || "").length < 8) return "パスワードは8文字以上で入力してください。";
  if (plan === "free" && thumbnailCount > 1) return "無料プランの画像登録は1枚までです。";
  if (thumbnailCount > 3) return "画像は最大3枚までです。";
  if (categoryCount > 3) return "カテゴリは最大3件までです。";
  if (tagCount > 3) return "タグは最大3件までです。";
  return null;
}

function sanitizeArray(value: unknown) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function normalizeThumbnails(values: string[], plan: PlanType) {
  return values.slice(0, plan === "free" ? 1 : 3);
}
