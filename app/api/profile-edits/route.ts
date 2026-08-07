import { NextResponse } from "next/server";
import type { Firestore } from "firebase-admin/firestore";
import { FieldValue, getAdminDb, stripUndefined } from "@/lib/firebaseAdmin";
import { diagnosisTypes } from "@/lib/diagnosis";
import { autoApproveLocalApplication, readLocalApplications, readLocalStreamers, updateLocalStreamer } from "@/lib/localStore";
import { hashPassword } from "@/lib/password";
import { invalidateStreamerCaches, publicStreamerPath } from "@/lib/streamers";
import { REGIONS } from "@/lib/constants";
import { creatorSessionCookie, readUserSession } from "@/lib/userSession";
import { normalizeResumeFields, RESUME_LIMITS, type ResumeHistoryEntry } from "@/lib/resume/schema";
import type { PlanType, Streamer, StreamerApplication } from "@/lib/types";

type ApplicationMatch = {
  id: string;
  ref?: FirebaseFirestore.DocumentReference;
  data: StreamerApplication;
};

type CreatorSession = {
  email?: string;
  application_id?: string;
  streamer_id?: string;
  creator_login_id?: string;
};

export async function GET(request: Request) {
  const session = readUserSession<CreatorSession>(request, creatorSessionCookie);
  if (!session?.email && !session?.streamer_id && !session?.application_id && !session?.creator_login_id) {
    return NextResponse.json({ error: "creator login required" }, { status: 401 });
  }

  const db = getAdminDb();
  if (!db) {
    const [applications, streamers] = await Promise.all([readLocalApplications(), readLocalStreamers()]);
    const application = applications
      .filter(isActiveApplication)
      .sort((a, b) => recordTime(b) - recordTime(a))
      .find((item) => (
        Boolean(session.application_id && item.id === session.application_id) ||
        Boolean(session.streamer_id && item.streamer_id === session.streamer_id) ||
        Boolean(session.creator_login_id && item.creator_login_id === session.creator_login_id) ||
        Boolean(session.email && item.email.toLowerCase() === String(session.email).toLowerCase())
      ));
    const streamerIds = [application?.streamer_id, session.streamer_id].filter(Boolean).map(String);
    const streamer = streamers.find((item) => streamerIds.includes(item.id) && isActiveStreamer(item));
    return NextResponse.json({ profile: buildProfileResponse(streamer, application), source: "local" });
  }

  let applicationDoc: FirebaseFirestore.DocumentSnapshot | undefined;
  if (session.application_id) {
    applicationDoc = await db.collection("applications").doc(String(session.application_id)).get();
    if (applicationDoc.exists && !isActiveApplication(applicationDoc.data())) applicationDoc = undefined;
  }
  if ((!applicationDoc || !applicationDoc.exists) && session.email) {
    const snapshot = await db.collection("applications").where("email", "==", String(session.email).toLowerCase()).limit(20).get();
    applicationDoc = snapshot.docs
      .filter((doc) => isActiveApplication(doc.data()))
      .sort((a, b) => sortTime(b.data().created_at ?? b.data().updated_at) - sortTime(a.data().created_at ?? a.data().updated_at))[0];
  }

  const application = applicationDoc?.exists ? ({ id: applicationDoc.id, ...applicationDoc.data() } as StreamerApplication) : undefined;
  const streamerIds = [application?.streamer_id, session.streamer_id].filter(Boolean).map(String);
  let streamer: Streamer | undefined;
  for (const streamerId of Array.from(new Set(streamerIds))) {
    const streamerDoc = await db.collection("streamers").doc(streamerId).get();
    if (streamerDoc.exists && isActiveStreamer(streamerDoc.data())) {
      streamer = { id: streamerDoc.id, ...streamerDoc.data() } as Streamer;
      break;
    }
  }

  let wantShortVideo = false;
  if (streamer?.id) {
    const requestDoc = await db.collection("short_video_requests").doc(streamer.id).get();
    wantShortVideo = requestDoc.exists && String(requestDoc.data()?.status || "open") !== "rejected";
  }

  return NextResponse.json({ profile: buildProfileResponse(streamer, application, wantShortVideo), source: "firestore" });
}

export async function POST(request: Request) {
  const body = await request.json();
  const session = readUserSession<CreatorSession>(request, creatorSessionCookie);
  const email = clean(body.email || session?.email, 120).toLowerCase();
  const password = String(body.password || "");
  const applicationId = clean(body.application_id || session?.application_id, 120);
  const streamerId = clean(body.streamer_id || session?.streamer_id, 120);
  const creatorLoginId = clean(body.creator_login_id || session?.creator_login_id, 120);

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "登録メールアドレスを入力してください。" }, { status: 400 });
  }
  if (!password && !session?.email && !session?.streamer_id && !session?.application_id && !session?.creator_login_id) {
    return NextResponse.json({ error: "配信者ログイン後に利用できます。" }, { status: 401 });
  }

  const passwordHash = password ? hashPassword(password) : "";
  const db = getAdminDb();

  if (!db) {
    const match = await findLocalApplicationForEdit({ email, applicationId, streamerId, creatorLoginId, passwordHash });
    if (!match || (passwordHash && match.data.creator_password_hash !== passwordHash)) {
      return NextResponse.json({ error: "メールアドレスまたはパスワードが違います。" }, { status: 401 });
    }
    const localPlan = await resolveEffectiveLocalPlan(match);
    const thumbnailError = validateThumbnailCount(body, localPlan);
    if (thumbnailError) return thumbnailError;
    const patch = {
      ...buildStreamerPatch(body, localPlan),
      updated_at: new Date().toISOString(),
    };
    const resolvedStreamerId = await resolveLocalStreamerId(match);
    if (!resolvedStreamerId) {
      return NextResponse.json({ error: "掲載データの準備中です。無料プランは少し時間をおいて再度お試しください。有料プランは決済完了後にプロフィール修正できます。" }, { status: 409 });
    }

    const streamer = await updateLocalStreamer(resolvedStreamerId, patch);
    invalidateStreamerCaches();
    return NextResponse.json({ streamer, source: "local" });
  }

  const match = await findFirestoreApplicationForEdit(db, { email, applicationId, streamerId, creatorLoginId, passwordHash });
  if (!match || (passwordHash && match.data.creator_password_hash !== passwordHash)) {
    return NextResponse.json({ error: "メールアドレスまたはパスワードが違います。" }, { status: 401 });
  }
  const plan = await resolveEffectiveFirestorePlan(db, match);
  const thumbnailError = validateThumbnailCount(body, plan);
  if (thumbnailError) return thumbnailError;
  const patch = buildStreamerPatch(body, plan);
  const resolvedStreamerId = await resolveFirestoreStreamerId(db, match);
  if (!resolvedStreamerId) {
    return NextResponse.json({ error: "掲載データの準備中です。無料プランは少し時間をおいて再度お試しください。有料プランは決済完了後にプロフィール修正できます。" }, { status: 409 });
  }

  await db.collection("streamers").doc(resolvedStreamerId).set(stripUndefined({
    ...patch,
    updated_at: FieldValue.serverTimestamp(),
  }), { merge: true });

  await match.ref?.set(stripUndefined({
    ...buildApplicationPatch(body, plan, match.data),
    updated_at: FieldValue.serverTimestamp(),
  }), { merge: true });

  // 「ショート動画希望」チェックを後から入れた場合、short_video_requests を作成/更新する。
  // (7/15の同意欄追加より前に申し込んだ無料プランの人は、ここでしか希望を出せない)
  if (body.want_short_video === true) {
    const requestRef = db.collection("short_video_requests").doc(resolvedStreamerId);
    const existingRequest = await requestRef.get();
    // 既にopen/published等で進行中のリクエストがあれば status は上書きしない(巻き戻り防止)
    const statusPatch = existingRequest.exists ? {} : { status: "open", requested_at: FieldValue.serverTimestamp() };
    await requestRef.set(stripUndefined({
      streamer_id: resolvedStreamerId,
      application_id: match.id,
      creator_login_id: match.data.creator_login_id,
      name: clean(body.name, 80) || match.data.name,
      email,
      youtube_url: clean(body.youtube_url, 240) || match.data.youtube_url || undefined,
      x_account: normalizeXAccount(body.x_account) || match.data.x_account || undefined,
      one_liner: clean(body.one_liner, 20) || undefined,
      plan_type: plan,
      appeal_points: clean(body.description, plan === "free" ? 100 : 500) || undefined,
      ...statusPatch,
      updated_at: FieldValue.serverTimestamp(),
    }), { merge: true });
  }

  invalidateStreamerCaches();
  const streamerDoc = await db.collection("streamers").doc(resolvedStreamerId).get();
  return NextResponse.json({ id: resolvedStreamerId, streamer: { id: resolvedStreamerId, ...streamerDoc.data() }, source: "firestore" });
}

// 申込書(application)のdesired_planは初回申込時点の値のまま更新されない
// (Stripeアップグレード/管理者付与ではapplication側を更新していないため)。
// 既にstreamerが紐づいている場合は、そちらのplan_type(実際の現在のプラン)を
// 正として使う。使わないと、無料で申込→有料/プレミアムへアップグレードした
// 配信者が、画像枚数・自己アピール文字数などの上限判定で無料プラン扱いに
// なってしまう(2026-07-29: 実際の有料配信者からの問い合わせで発覚・確認済み。
// 画像が1枚しか登録できず、自己アピール文が100文字超で静かに切り詰められていた)。
async function resolveEffectiveFirestorePlan(db: Firestore, match: ApplicationMatch): Promise<PlanType> {
  const linkedStreamerId = String(match.data.streamer_id || "");
  if (linkedStreamerId) {
    const doc = await db.collection("streamers").doc(linkedStreamerId).get();
    if (doc.exists && isActiveStreamer(doc.data())) {
      const planType = (doc.data() as Streamer).plan_type;
      if (planType) return planType;
    }
  }
  return match.data.desired_plan || "free";
}

async function resolveEffectiveLocalPlan(match: ApplicationMatch): Promise<PlanType> {
  const linkedStreamerId = String(match.data.streamer_id || "");
  if (linkedStreamerId) {
    const streamers = await readLocalStreamers();
    const linked = streamers.find((streamer) => streamer.id === linkedStreamerId);
    if (isActiveStreamer(linked) && linked?.plan_type) return linked.plan_type;
  }
  return match.data.desired_plan || "free";
}

async function resolveLocalStreamerId(match: ApplicationMatch) {
  if (match.data.claim_status === "pending") return "";
  const streamers = await readLocalStreamers();
  if (match.data.streamer_id) {
    const linked = streamers.find((streamer) => streamer.id === match.data.streamer_id);
    if (isActiveStreamer(linked)) return match.data.streamer_id;
  }
  const existing = streamers.find((streamer) => (
    isActiveStreamer(streamer) &&
    streamer.source_application_id === match.id ||
    (isActiveStreamer(streamer) && streamer.creator_email && streamer.creator_email.toLowerCase() === match.data.email.toLowerCase())
  ));
  if (existing) return existing.id;
  const created = await autoApproveLocalApplication(match.id);
  return created?.id || "";
}

async function resolveFirestoreStreamerId(db: Firestore, match: ApplicationMatch) {
  if (match.data.claim_status === "pending") return "";
  if (match.data.streamer_id) {
    const linked = await db.collection("streamers").doc(String(match.data.streamer_id)).get();
    if (linked.exists && isActiveStreamer(linked.data())) return String(match.data.streamer_id);
  }

  const byApplication = await db.collection("streamers").where("source_application_id", "==", match.id).limit(10).get();
  const activeByApplication = byApplication.docs.find((doc) => isActiveStreamer(doc.data()));
  if (activeByApplication) {
    const id = activeByApplication.id;
    await match.ref?.set(stripUndefined({ streamer_id: id, status: "approved", reviewed_at: FieldValue.serverTimestamp() }), { merge: true });
    return id;
  }

  const email = String(match.data.email || "").trim().toLowerCase();
  if (email) {
    const byEmail = await db.collection("streamers").where("creator_email", "==", email).limit(20).get();
    const activeByEmail = byEmail.docs
      .filter((doc) => isActiveStreamer(doc.data()))
      .sort((a, b) => sortTime(b.data().created_at ?? b.data().updated_at) - sortTime(a.data().created_at ?? a.data().updated_at))[0];
    if (activeByEmail) {
      const id = activeByEmail.id;
      await match.ref?.set(stripUndefined({ streamer_id: id, status: "approved", reviewed_at: FieldValue.serverTimestamp() }), { merge: true });
      return id;
    }
  }

  const paid = match.data.desired_plan === "free" ||
    match.data.payment_status === "paid" ||
    match.data.subscription_status === "active" ||
    Boolean(match.data.stripe_subscription_id);
  if (!paid) return "";

  const streamerRef = db.collection("streamers").doc();
  await streamerRef.set(stripUndefined({
    name: match.data.name,
    creator_email: email,
    youtube_url: match.data.youtube_url,
    youtube_channel_id: match.data.youtube_channel_id || "",
    x_account: match.data.x_account || "",
    thumbnails: match.data.thumbnails || [],
    categories: match.data.categories || [],
    tags: match.data.tags || [],
    description: match.data.description || "",
    one_liner: String(match.data.one_liner || match.data.description || "").slice(0, 20),
    stream_time: match.data.stream_time || "",
    region: match.data.region || "",
    plan_type: match.data.desired_plan || "free",
    subscription_status: match.data.subscription_status || null,
    stripe_subscription_id: match.data.stripe_subscription_id || null,
    is_initial_scout: false,
    is_visible: true,
    is_deleted: false,
    withdrawal_status: "none",
    impressions: 0,
    likes: 0,
    source_application_id: match.id,
    created_at: FieldValue.serverTimestamp(),
    // コラボお誘い機能: 本人が自分の意思で新規登録した場合のみ初期値ON。
    // 既存配信者(この機能追加以前から在籍)は対象外(フィールド未設定=OFF扱い)。
    collaboration_enabled: true,
    collaboration_default_on_notice_seen: false,
  }));
  await match.ref?.set(stripUndefined({
    streamer_id: streamerRef.id,
    status: "approved",
    reviewed_at: FieldValue.serverTimestamp(),
  }), { merge: true });
  return streamerRef.id;
}

async function findLocalApplicationForEdit(input: {
  email: string;
  applicationId: string;
  streamerId: string;
  creatorLoginId: string;
  passwordHash?: string;
}): Promise<ApplicationMatch | null> {
  const applications = await readLocalApplications();
  const candidates = applications
    .filter((application) => isActiveApplication(application) && matchesApplication(application, input))
    .map((application) => ({ id: application.id, data: application }));

  return (input.passwordHash ? candidates.find((candidate) => candidate.data.creator_password_hash === input.passwordHash) : undefined) || candidates[0] || null;
}

async function findFirestoreApplicationForEdit(db: Firestore, input: {
  email: string;
  applicationId: string;
  streamerId: string;
  creatorLoginId: string;
  passwordHash?: string;
}): Promise<ApplicationMatch | null> {
  const seen = new Set<string>();
  const candidates: ApplicationMatch[] = [];

  function addSnapshot(doc: FirebaseFirestore.DocumentSnapshot) {
    if (!doc.exists || seen.has(doc.id)) return;
    if (!isActiveApplication(doc.data())) return;
    seen.add(doc.id);
    candidates.push({
      id: doc.id,
      ref: doc.ref,
      data: { id: doc.id, ...doc.data() } as StreamerApplication,
    });
  }

  if (input.applicationId) {
    addSnapshot(await db.collection("applications").doc(input.applicationId).get());
  }

  const queries: Array<Promise<FirebaseFirestore.QuerySnapshot>> = [];
  if (input.email) queries.push(db.collection("applications").where("email", "==", input.email).limit(10).get());
  if (input.streamerId) queries.push(db.collection("applications").where("streamer_id", "==", input.streamerId).limit(10).get());
  if (input.creatorLoginId) queries.push(db.collection("applications").where("creator_login_id", "==", input.creatorLoginId).limit(10).get());

  const snapshots = await Promise.all(queries);
  snapshots.forEach((snapshot) => snapshot.docs.forEach(addSnapshot));

  return (input.passwordHash ? candidates.find((candidate) => candidate.data.creator_password_hash === input.passwordHash) : undefined) || candidates[0] || null;
}

function matchesApplication(application: StreamerApplication, input: { email: string; applicationId: string; streamerId: string; creatorLoginId: string }) {
  return (
    application.email?.toLowerCase() === input.email ||
    Boolean(input.applicationId && application.id === input.applicationId) ||
    Boolean(input.streamerId && application.streamer_id === input.streamerId) ||
    Boolean(input.creatorLoginId && application.creator_login_id === input.creatorLoginId)
  );
}

function buildStreamerPatch(body: Record<string, unknown>, plan: PlanType): Partial<Streamer> {
  const maxCategories = 3;
  const maxTags = maxTagsForPlan(plan);
  const thumbnails = normalizeThumbnails(body.thumbnails, body.image, plan);
  const patch: Partial<Streamer> = {
    categories: sanitizeArray(body.categories).slice(0, maxCategories),
    tags: sanitizeArray(body.tags).slice(0, maxTags),
    ...buildVtypePatch(body),
  };

  setIfPresent(patch, "name", clean(body.name, 80));
  setIfPresent(patch, "yomi", clean(body.yomi, 80));
  setIfPresent(patch, "youtube_url", clean(body.youtube_url, 240));
  setIfPresent(patch, "x_account", normalizeXAccount(body.x_account));
  setIfPresent(patch, "description", clean(body.description, plan === "free" ? 100 : 500));
  setIfPresent(patch, "one_liner", clean(body.one_liner, 20));
  setIfPresent(patch, "stream_time", clean(body.stream_time, 50));
  setIfPresent(patch, "region", validRegion(body.region));
  if ("thumbnails" in body || "image" in body) patch.thumbnails = thumbnails;
  Object.assign(patch, buildResumePatch(body));

  return patch;
}

function buildResumePatch(body: Record<string, unknown>): Partial<Streamer> {
  const raw = {
    debutDate: clean(body.debutDate, 40),
    birthday: clean(body.birthday, 40),
    birthdayVisible: body.birthdayVisible === true,
    activityRegion: clean(body.activityRegion, 40),
    publicContact: clean(body.publicContact, 120),
    streamingPlatform: clean(body.streamingPlatform, 40),
    personalityType: clean(body.personalityType, 40),
    fanName: clean(body.fanName, 40),
    fanMark: clean(body.fanMark, 20),
    hashtags: sanitizeArray(body.hashtags),
    activityHistory: sanitizeHistoryEntries(body.activityHistory),
    achievements: sanitizeHistoryEntries(body.achievements),
    equipment: sanitizeHistoryEntries(body.equipment),
    messageToNewcomers: clean(body.messageToNewcomers, 400),
    resumePublicOptIn: body.resumePublicOptIn !== false,
    resumeIconZoom: body.resumeIconZoom !== undefined ? Number(body.resumeIconZoom) : undefined,
    resumeIconPanX: body.resumeIconPanX !== undefined ? Number(body.resumeIconPanX) : undefined,
    resumeIconPanY: body.resumeIconPanY !== undefined ? Number(body.resumeIconPanY) : undefined,
  };
  return normalizeResumeFields(raw) as Partial<Streamer>;
}

function sanitizeHistoryEntries(value: unknown): ResumeHistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (item && typeof item === "object" ? (item as Record<string, unknown>) : {}))
    .map((item) => ({
      year: clean(item.year, 10),
      month: clean(item.month, 4),
      text: clean(item.text, RESUME_LIMITS.historyTextMax),
    }))
    .filter((entry) => entry.year || entry.month || entry.text);
}

function buildApplicationPatch(body: Record<string, unknown>, plan: PlanType, existing?: StreamerApplication) {
  const maxCategories = 3;
  const maxTags = maxTagsForPlan(plan);
  const thumbnails = normalizeThumbnails(body.thumbnails, body.image, plan);
  const patch: Record<string, unknown> = {
    categories: sanitizeArray(body.categories).slice(0, maxCategories),
    tags: sanitizeArray(body.tags).slice(0, maxTags),
    ...buildVtypePatch(body),
  };

  setIfPresent(patch, "name", clean(body.name, 80));
  setIfPresent(patch, "yomi", clean(body.yomi, 80));
  setIfPresent(patch, "youtube_url", clean(body.youtube_url, 240));
  setIfPresent(patch, "x_account", normalizeXAccount(body.x_account));
  setIfPresent(patch, "description", clean(body.description, plan === "free" ? 100 : 500));
  setIfPresent(patch, "one_liner", clean(body.one_liner, 20));
  setIfPresent(patch, "stream_time", clean(body.stream_time, 50));
  setIfPresent(patch, "region", validRegion(body.region));
  if ("thumbnails" in body || "image" in body) patch.thumbnails = thumbnails;

  const xCampaignEntry = existing?.x_campaign_entry === true || Boolean(body.x_campaign_entry);
  patch.x_campaign_entry = xCampaignEntry;
  if (xCampaignEntry && existing?.x_campaign_entry !== true) patch.x_campaign_entered_at = FieldValue.serverTimestamp();

  return patch;
}

function setIfPresent(target: Record<string, unknown>, key: string, value: string) {
  if (value) target[key] = value;
}

function validRegion(value: unknown) {
  const raw = String(value || "").trim();
  return REGIONS.includes(raw) ? raw : "";
}

function clean(value: unknown, max: number) {
  return String(value || "").trim().slice(0, max);
}

function isActiveApplication(data?: { withdrawal_status?: string; is_deleted?: boolean } | null) {
  return data?.withdrawal_status !== "requested" && data?.is_deleted !== true;
}

function isActiveStreamer(data?: { withdrawal_status?: string; is_deleted?: boolean } | null) {
  return Boolean(data) && data?.withdrawal_status !== "requested" && data?.is_deleted !== true;
}

function sortTime(value: unknown) {
  const iso = typeof value === "string"
    ? value
    : value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function"
      ? value.toDate().toISOString()
      : "";
  const time = Date.parse(iso);
  return Number.isFinite(time) ? time : 0;
}

function recordTime(value: Record<string, unknown>) {
  return sortTime(value.created_at ?? value.updated_at);
}

function sanitizeArray(value: unknown) {
  return Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean) : [];
}

function maxTagsForPlan(plan: PlanType) {
  return plan === "free" ? 3 : plan === "boost" ? 8 : 5;
}

function validateThumbnailCount(body: Record<string, unknown>, plan: PlanType) {
  const maxImages = plan === "free" ? 1 : plan === "boost" ? 5 : 3;
  const count = normalizeThumbnailInput(body.thumbnails, body.image).length;
  if (count > maxImages) {
    return NextResponse.json({ error: plan === "free" ? "無料プランの画像登録は1枚までです。" : `画像登録は最大${maxImages}枚までです。`, code: "TOO_MANY_IMAGES" }, { status: 400 });
  }
  return null;
}

function normalizeThumbnails(value: unknown, fallback: unknown, plan: PlanType = "boost") {
  const maxImages = plan === "free" ? 1 : plan === "boost" ? 5 : 3;
  const thumbnails = normalizeThumbnailInput(value, fallback).map((item) => item.slice(0, 650000)).slice(0, maxImages);
  return thumbnails;
}

function normalizeThumbnailInput(value: unknown, fallback: unknown) {
  const thumbnails = sanitizeArray(value).filter(Boolean);
  if (thumbnails.length) return thumbnails;
  const image = clean(fallback, 650000);
  return image ? [image] : [];
}

function normalizeXAccount(value: unknown) {
  const input = String(value || "").trim();
  if (!input) return "";
  return input.replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//i, "@").replace(/^([^@])/, "@$1").slice(0, 40);
}

function buildVtypePatch(body: Record<string, unknown>) {
  const type = diagnosisTypes.find((item) => item.id === Number(body.vtype_id));
  if (!type) return {};
  return {
    vtype_id: type.id,
    vtype_code: type.code,
    vtype_name: type.name,
    vtype_scores: normalizeScoreMap(body.vtype_scores),
    vtype_mode: clean(body.vtype_mode, 20) || "light",
    vtype_result_id: clean(body.vtype_result_id, 120),
    vtype_updated_at: clean(body.vtype_updated_at, 50) || new Date().toISOString(),
  };
}

function normalizeScoreMap(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const entries = Object.entries(value as Record<string, unknown>)
    .map(([key, score]) => [key, Math.max(0, Math.min(100, Math.round(Number(score))))] as const)
    .filter(([, score]) => Number.isFinite(score));
  return entries.length ? Object.fromEntries(entries) : undefined;
}

function buildProfileResponse(streamer?: Partial<Streamer>, application?: Partial<StreamerApplication>, wantShortVideo = false) {
  const streamerId = streamer?.id || application?.streamer_id || "";
  const name = streamer?.name || application?.name || "";
  return {
    want_short_video: wantShortVideo,
    streamer_id: streamerId,
    public_path: streamerId ? publicStreamerPath({ id: streamerId, name }) : "",
    name,
    yomi: streamer?.yomi || application?.yomi || "",
    youtube_url: streamer?.youtube_url || application?.youtube_url || "",
    youtube_channel_id: streamer?.youtube_channel_id || application?.youtube_channel_id || "",
    x_account: streamer?.x_account || application?.x_account || "",
    x_campaign_entry: application?.x_campaign_entry === true,
    description: streamer?.description || application?.description || "",
    one_liner: streamer?.one_liner || application?.one_liner || "",
    stream_time: streamer?.stream_time || application?.stream_time || "",
    region: streamer?.region || application?.region || "",
    plan_type: streamer?.plan_type || application?.desired_plan || "free",
    image: streamer?.thumbnails?.[0] || application?.thumbnails?.[0] || "",
    images: streamer?.thumbnails || application?.thumbnails || [],
    categories: streamer?.categories || application?.categories || [],
    tags: streamer?.tags || application?.tags || [],
    vtype_id: streamer?.vtype_id || application?.vtype_id,
    vtype_code: streamer?.vtype_code || application?.vtype_code || "",
    vtype_name: streamer?.vtype_name || application?.vtype_name || "",
    vtype_scores: streamer?.vtype_scores || application?.vtype_scores,
    vtype_mode: streamer?.vtype_mode || application?.vtype_mode || "",
    vtype_result_id: streamer?.vtype_result_id || application?.vtype_result_id || "",
    vtype_updated_at: streamer?.vtype_updated_at || application?.vtype_updated_at || "",
    debutDate: streamer?.debutDate || "",
    birthday: streamer?.birthday || "",
    birthdayVisible: streamer?.birthdayVisible === true,
    activityRegion: streamer?.activityRegion || "",
    publicContact: streamer?.publicContact || "",
    streamingPlatform: streamer?.streamingPlatform || "",
    personalityType: streamer?.personalityType || "",
    fanName: streamer?.fanName || "",
    fanMark: streamer?.fanMark || "",
    hashtags: streamer?.hashtags || [],
    activityHistory: streamer?.activityHistory || [],
    achievements: streamer?.achievements || [],
    equipment: streamer?.equipment || [],
    messageToNewcomers: streamer?.messageToNewcomers || "",
    resumePublicOptIn: streamer?.resumePublicOptIn !== false,
    resumeIconZoom: streamer?.resumeIconZoom ?? 1,
    resumeIconPanX: streamer?.resumeIconPanX ?? 50,
    resumeIconPanY: streamer?.resumeIconPanY ?? 50,
  };
}
