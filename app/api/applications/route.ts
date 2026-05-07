import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { FieldValue, getAdminDb } from "@/lib/firebaseAdmin";
import { addLocalApplication, autoApproveLocalApplication, readLocalApplications } from "@/lib/localStore";
import { hashPassword, makeCreatorLoginId } from "@/lib/password";
import type { PlanType } from "@/lib/types";

export async function GET(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const db = getAdminDb();
  if (!db) return NextResponse.json({ applications: await readLocalApplications(), source: "local" });

  const snapshot = await db.collection("applications").orderBy("created_at", "desc").limit(80).get();
  return NextResponse.json({
    applications: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    source: "firestore"
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const error = validate(body);
  if (error) return NextResponse.json({ error }, { status: 400 });

  const payload = {
    name: String(body.name).trim(),
    email: String(body.email).trim(),
    youtube_url: String(body.youtube_url).trim(),
    youtube_channel_id: String(body.youtube_channel_id || "").trim(),
    thumbnails: normalizeThumbnails(sanitizeArray(body.thumbnails)),
    categories: sanitizeArray(body.categories),
    tags: sanitizeArray(body.tags).slice(0, 5),
    description: String(body.description || "").trim(),
    one_liner: String(body.one_liner || body.description || "").trim().slice(0, 80),
    stream_time: String(body.stream_time || "").trim(),
    desired_plan: (body.desired_plan || "free") as PlanType,
    creator_login_id: makeCreatorLoginId(),
    creator_password_hash: hashPassword(String(body.creator_password || "")),
    admin_note: ""
  };

  const db = getAdminDb();
  if (!db) {
    const application = await addLocalApplication(payload);
    const streamer = payload.desired_plan === "free" ? await autoApproveLocalApplication(application.id) : null;
    return NextResponse.json({
      application: { ...application, status: streamer ? "approved" : application.status },
      streamer,
      streamer_id: streamer?.id || "",
      creator_login_id: application.creator_login_id,
      auto_approved: Boolean(streamer),
      source: "local"
    }, { status: 201 });
  }

  const applicationData = {
    ...payload,
    payment_status: payload.desired_plan === "free" ? "not_required" : "pending",
    status: payload.desired_plan === "free" ? "approved" : "pending",
    created_at: FieldValue.serverTimestamp()
  };
  const doc = await db.collection("applications").add(applicationData);

  let streamerId = "";
  if (payload.desired_plan === "free") {
    const streamerRef = await db.collection("streamers").add({
      name: payload.name,
      youtube_url: payload.youtube_url,
      youtube_channel_id: payload.youtube_channel_id,
      thumbnails: payload.thumbnails,
      categories: payload.categories,
      tags: payload.tags,
      description: payload.description,
      one_liner: payload.one_liner,
      stream_time: payload.stream_time,
      plan_type: payload.desired_plan,
      is_initial_scout: false,
      is_visible: true,
      impressions: 0,
      likes: 0,
      source_application_id: doc.id,
      created_at: FieldValue.serverTimestamp()
    });
    streamerId = streamerRef.id;
    await db.collection("applications").doc(doc.id).set({
      reviewed_at: FieldValue.serverTimestamp(),
      streamer_id: streamerId
    }, { merge: true });
  }

  return NextResponse.json({
    id: doc.id,
    streamer_id: streamerId,
    creator_login_id: payload.creator_login_id,
    auto_approved: payload.desired_plan === "free",
    source: "firestore"
  }, { status: 201 });
}

function validate(body: Record<string, unknown>) {
  const plan = String(body.desired_plan || "free");
  const categoryCount = sanitizeArray(body.categories).length;
  const tagCount = sanitizeArray(body.tags).length;
  if (!body.name) return "name is required";
  if (!body.email) return "email is required";
  if (!body.youtube_url) return "youtube_url is required";
  if (plan !== "free" && !body.description) return "有料掲載では自己アピールを入力してください。";
  if (plan !== "free" && !body.one_liner) return "有料掲載では今日のひとことを入力してください。";
  if (String(body.creator_password || "").length < 8) return "creator password must be at least 8 characters";
  if (sanitizeArray(body.thumbnails).length > 3) return "thumbnails max is 3";
  if (plan === "free" && categoryCount > 0) return "無料掲載ではカテゴリは登録されません。";
  if (plan === "free" && tagCount > 0) return "無料掲載ではタグは登録されません。";
  if (plan !== "free" && categoryCount > 3) return "paid plan category max is 3";
  if (plan !== "free" && tagCount > 5) return "paid plan tag max is 5";
  if (plan !== "free" && categoryCount < 1) return "有料掲載ではカテゴリを1件以上選択してください。";
  if (plan !== "free" && tagCount < 1) return "有料掲載ではタグを1件以上選択してください。";
  return null;
}

function sanitizeArray(value: unknown) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function normalizeThumbnails(values: string[]) {
  const thumbnails = values.slice(0, 3);
  return thumbnails.length ? thumbnails : ["https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=900&q=82"];
}
