import { NextResponse } from "next/server";
import { FieldValue, getAdminDb } from "@/lib/firebaseAdmin";
import { findLocalApplicationByEmail, updateLocalStreamer } from "@/lib/localStore";
import { hashPassword } from "@/lib/password";
import type { PlanType, Streamer } from "@/lib/types";

export async function POST(request: Request) {
  const body = await request.json();
  const email = clean(body.email, 120).toLowerCase();
  const password = String(body.password || "");

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "登録メールアドレスを入力してください。" }, { status: 400 });
  }
  if (!password) {
    return NextResponse.json({ error: "パスワードを入力してください。" }, { status: 400 });
  }

  const passwordHash = hashPassword(password);
  const db = getAdminDb();

  if (!db) {
    const application = await findLocalApplicationByEmail(email);
    if (!application || application.creator_password_hash !== passwordHash) {
      return NextResponse.json({ error: "メールアドレスまたはパスワードが違います。" }, { status: 401 });
    }
    if (!application.streamer_id) {
      return NextResponse.json({ error: "掲載中の配信者データが見つかりません。" }, { status: 404 });
    }

    const patch = buildStreamerPatch(body, application.desired_plan);
    const streamer = await updateLocalStreamer(application.streamer_id, patch);
    return NextResponse.json({ streamer, source: "local" });
  }

  const snapshot = await db.collection("applications").where("email", "==", email).limit(1).get();
  const applicationDoc = snapshot.docs[0];
  const application = applicationDoc?.data();
  if (!applicationDoc || !application || application.creator_password_hash !== passwordHash) {
    return NextResponse.json({ error: "メールアドレスまたはパスワードが違います。" }, { status: 401 });
  }
  if (!application.streamer_id) {
    return NextResponse.json({ error: "掲載中の配信者データが見つかりません。" }, { status: 404 });
  }

  const patch = buildStreamerPatch(body, application.desired_plan || "free");
  await db.collection("streamers").doc(application.streamer_id).set({
    ...patch,
    updated_at: FieldValue.serverTimestamp()
  }, { merge: true });

  await applicationDoc.ref.set({
    ...buildApplicationPatch(body, application.desired_plan || "free"),
    updated_at: FieldValue.serverTimestamp()
  }, { merge: true });

  const streamerDoc = await db.collection("streamers").doc(application.streamer_id).get();
  return NextResponse.json({ id: application.streamer_id, streamer: { id: application.streamer_id, ...streamerDoc.data() }, source: "firestore" });
}

function buildStreamerPatch(body: Record<string, unknown>, plan: PlanType): Partial<Streamer> {
  const maxCategories = plan === "free" ? 1 : 3;
  const maxTags = plan === "free" ? 1 : 5;
  const image = clean(body.image, 400000);
  const patch: Partial<Streamer> = {
    categories: sanitizeArray(body.categories).slice(0, maxCategories),
    tags: sanitizeArray(body.tags).slice(0, maxTags)
  };

  setIfPresent(patch, "name", clean(body.name, 80));
  setIfPresent(patch, "youtube_url", clean(body.youtube_url, 240));
  setIfPresent(patch, "description", clean(body.description, 800));
  setIfPresent(patch, "one_liner", clean(body.one_liner, 80));
  setIfPresent(patch, "stream_time", clean(body.stream_time, 80));
  if (image) patch.thumbnails = [image];

  return patch;
}

function buildApplicationPatch(body: Record<string, unknown>, plan: PlanType) {
  const maxCategories = plan === "free" ? 1 : 3;
  const maxTags = plan === "free" ? 1 : 5;
  const image = clean(body.image, 400000);
  const patch: Record<string, unknown> = {
    categories: sanitizeArray(body.categories).slice(0, maxCategories),
    tags: sanitizeArray(body.tags).slice(0, maxTags)
  };

  setIfPresent(patch, "name", clean(body.name, 80));
  setIfPresent(patch, "youtube_url", clean(body.youtube_url, 240));
  setIfPresent(patch, "description", clean(body.description, 800));
  setIfPresent(patch, "one_liner", clean(body.one_liner, 80));
  setIfPresent(patch, "stream_time", clean(body.stream_time, 80));
  if (image) patch.thumbnails = [image];

  return patch;
}

function setIfPresent(target: Record<string, unknown>, key: string, value: string) {
  if (value) target[key] = value;
}

function clean(value: unknown, max: number) {
  return String(value || "").trim().slice(0, max);
}

function sanitizeArray(value: unknown) {
  return Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean) : [];
}
