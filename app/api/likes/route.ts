import { NextResponse } from "next/server";
import { FieldValue, getAdminDb } from "@/lib/firebaseAdmin";
import { addLocalLike, addLocalViewerActivity, incrementLocalStreamer } from "@/lib/localStore";
import { notifyStreamerLike, streamerLikeNotification } from "@/lib/notifications";
import { creatorSessionCookie, readUserSession } from "@/lib/userSession";

type EmbeddedViewerProfile = {
  id: string;
  is_anonymous: boolean;
  source_type?: "viewer" | "creator";
  creator_streamer_id?: string;
  creator_name?: string;
  visible_to_matched_streamers?: boolean;
  display_name: string;
  viewer_plan: "free";
  youtube_display_name: string;
  twitter_id: string;
  one_liner: string;
  image: string;
  profile: string;
  favorite_categories: string[];
};

const freeViewerDailyLikeLimit = 100;

export async function POST(request: Request) {
  const body = await request.json();
  const userId = String(body.user_id || "");
  const streamerId = String(body.streamer_id || "");
  const viewerProfileId = String(body.viewer_profile_id || "");
  let viewerProfile = normalizeViewerProfile(body.viewer_profile, viewerProfileId || userId);
  if (!userId || !streamerId) return NextResponse.json({ error: "user_id and streamer_id are required" }, { status: 400 });
  if (viewerProfile?.source_type === "creator") {
    const creatorSession = readUserSession<{ streamer_id?: string }>(request, creatorSessionCookie);
    const claimedStreamerId = String(viewerProfile.creator_streamer_id || "");
    if (!creatorSession?.streamer_id || creatorSession.streamer_id !== claimedStreamerId) {
      viewerProfile = anonymousViewerProfile(String(viewerProfileId || userId));
    }
  }

  const db = getAdminDb();
  if (!db) {
    await addLocalLike(userId, streamerId, viewerProfile || undefined);
    const trackedViewerId = String(viewerProfile?.id || viewerProfileId || userId);
    if (trackedViewerId) {
      await addLocalViewerActivity({
        streamer_id: streamerId,
        viewer_profile_id: trackedViewerId,
        user_id: userId,
        action: "like",
        viewer_profile: viewerProfile || { id: trackedViewerId, is_anonymous: true, visible_to_matched_streamers: true },
      });
    }
    await incrementLocalStreamer(streamerId, "likes");
    return NextResponse.json({ matched: true, source: "local" });
  }

  const streamerRef = db.collection("streamers").doc(streamerId);
  const streamerDoc = await streamerRef.get();
  if (!streamerDoc.exists) return NextResponse.json({ error: "streamer not found" }, { status: 404 });
  const streamerData = streamerDoc.data() || {};
  const isCreatorSource = viewerProfile?.source_type === "creator";
  if (isCreatorSource && viewerProfile?.creator_streamer_id) {
    const likerStreamerDoc = await db.collection("streamers").doc(String(viewerProfile.creator_streamer_id)).get();
    if (likerStreamerDoc.exists) {
      const officialName = String(likerStreamerDoc.data()?.name || "配信者");
      viewerProfile = { ...viewerProfile, creator_name: officialName, display_name: officialName };
    }
  }
  const viewerRef = viewerProfileId && !isCreatorSource ? db.collection("viewer_profiles").doc(viewerProfileId) : null;
  let verifiedViewerProfile: EmbeddedViewerProfile | null = viewerProfile;
  let limited = false;
  let alreadyLikedToday = false;
  let isAdminViewer = false;
  const trackedViewerId = String(viewerProfileId || viewerProfile?.id || userId);
  const activityRef = db.collection("viewer_activities").doc(`${streamerId}_${trackedViewerId}_like`);
  const today = jstDateKey();

  await db.runTransaction(async (tx) => {
    const activityDoc = await tx.get(activityRef);

    if (viewerRef) {
      const viewerDoc = await tx.get(viewerRef);
      const viewerData = viewerDoc.exists ? viewerDoc.data() || {} : {};
      verifiedViewerProfile = buildEmbeddedViewerProfile(viewerData, viewerProfileId);
      if (viewerData.is_admin_viewer === true) {
        isAdminViewer = true;
        verifiedViewerProfile = anonymousViewerProfile(viewerProfileId);
      }
      if (!isAdminViewer && viewerDoc.exists) {
        const currentDate = String(viewerData.daily_like_date || "");
        const currentCount = currentDate === today ? Number(viewerData.daily_like_count || 0) : 0;
        if (currentCount >= freeViewerDailyLikeLimit) {
          limited = true;
          return;
        }
        tx.set(viewerRef, {
          daily_like_date: today,
          daily_like_count: currentCount + 1,
          updated_at: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
    }

    if (!isAdminViewer && activityDoc.exists && isSameJstDate(activityDoc.data()?.updated_at ?? activityDoc.data()?.created_at, today)) {
      alreadyLikedToday = true;
      return;
    }

    const likeRef = db.collection("likes").doc(`${userId}_${streamerId}_${Date.now()}`);
    const embeddedViewer = verifiedViewerProfile || { id: trackedViewerId, is_anonymous: true, visible_to_matched_streamers: true };
    tx.set(likeRef, {
      user_id: userId,
      streamer_id: streamerId,
      viewer_profile_id: trackedViewerId || null,
      viewer_profile: embeddedViewer,
      timestamp: FieldValue.serverTimestamp()
    });
    tx.set(activityRef, {
      streamer_id: streamerId,
      viewer_profile_id: trackedViewerId,
      user_id: userId,
      action: "like",
      viewer_profile: embeddedViewer,
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp()
    }, { merge: true });
    tx.update(streamerRef, {
      likes: FieldValue.increment(1),
    });
    // マッチ一覧(/viewer/matches)向けの非正規化レコード。仕様上「いいね=即マッチ」なので
    // ここで書く。streamer_idごとに1件へ集約し(同じVTuberに複数回いいねしても増えない)、
    // 一覧側は都度streamersをJOINせずにこのコレクションだけを読めば表示できる。
    if (trackedViewerId) {
      const matchRef = db.collection("matches").doc(`${trackedViewerId}_${streamerId}`);
      tx.set(matchRef, {
        viewer_profile_id: trackedViewerId,
        streamer_id: streamerId,
        streamer_name: streamerData.name || "",
        streamer_thumbnail: streamerData.thumbnails?.[0] || "",
        streamer_youtube_url: streamerData.youtube_url || "",
        matched_at: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
    tx.set(db.collection("notifications").doc(), {
      target_type: "streamer",
      streamer_id: streamerId,
      viewer_profile_id: trackedViewerId || null,
      type: "LIKE_CREATED",
      title: streamerLikeNotification.title,
      body: streamerLikeNotification.body,
      read: false,
      created_at: FieldValue.serverTimestamp()
    });
  });

  const streamer = streamerData;
  if (limited) {
    return NextResponse.json({
      error: "今日送れるいいね数の上限に達しました。",
      code: "DAILY_LIKE_LIMIT",
    }, { status: 429 });
  }
  if (alreadyLikedToday) {
    return NextResponse.json({
      error: "同じVtuberには1日1回までいいねできます。",
      code: "ALREADY_LIKED_TODAY",
    }, { status: 429 });
  }
  await notifyStreamerLike(streamer.fcm_tokens, verifiedViewerProfile?.source_type === "creator" ? verifiedViewerProfile.creator_name : undefined);

  return NextResponse.json({
    matched: true,
    youtube_url: streamer.youtube_url,
    source: "firestore"
  });
}

function jstDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function isSameJstDate(value: unknown, today: string) {
  const date = toDate(value);
  return Boolean(date && jstDateKey(date) === today);
}

function toDate(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const time = Date.parse(value);
    return Number.isFinite(time) ? new Date(time) : null;
  }
  if (typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate() as Date;
  }
  return null;
}

function normalizeViewerProfile(value: unknown, fallbackId = ""): EmbeddedViewerProfile | null {
  if (!value || typeof value !== "object") {
    return fallbackId ? anonymousViewerProfile(fallbackId) : null;
  }
  const input = value as Record<string, unknown>;
  if (input.visible_to_matched_streamers === false) return null;
  if (input.source_type === "creator") {
    const creatorStreamerId = typeof input.creator_streamer_id === "string" ? input.creator_streamer_id : "";
    const creatorName = typeof input.creator_name === "string" ? input.creator_name : typeof input.display_name === "string" ? input.display_name : "配信者";
    const id = typeof input.id === "string" ? input.id : creatorStreamerId ? `creator-${creatorStreamerId}` : fallbackId;
    return {
      id,
      source_type: "creator",
      creator_streamer_id: creatorStreamerId,
      creator_name: creatorName,
      is_anonymous: false,
      display_name: creatorName,
      viewer_plan: "free",
      youtube_display_name: "",
      twitter_id: "",
      one_liner: "",
      image: "",
      profile: "",
      favorite_categories: []
    };
  }
  return {
    id: typeof input.id === "string" ? input.id : fallbackId,
    is_anonymous: Boolean(input.is_anonymous) || String(input.id || fallbackId).startsWith("anon-viewer-"),
    display_name: typeof input.display_name === "string" ? input.display_name : "",
    viewer_plan: "free",
    youtube_display_name: typeof input.youtube_display_name === "string" ? input.youtube_display_name : "",
    twitter_id: typeof input.twitter_id === "string" ? input.twitter_id : "",
    one_liner: typeof input.one_liner === "string" ? input.one_liner.slice(0, 20) : "",
    image: typeof input.image === "string" ? input.image : "",
    profile: typeof input.profile === "string" ? input.profile : "",
    favorite_categories: Array.isArray(input.favorite_categories) ? input.favorite_categories.filter((item) => typeof item === "string").slice(0, 5) : []
  };
}

function buildEmbeddedViewerProfile(data: Record<string, any>, id: string): EmbeddedViewerProfile {
  if (data.visible_to_matched_streamers === false) return { ...anonymousViewerProfile(id), visible_to_matched_streamers: false };
  return {
    id,
    is_anonymous: id.startsWith("anon-viewer-"),
    display_name: typeof data.display_name === "string" ? data.display_name : "",
    viewer_plan: "free",
    youtube_display_name: typeof data.youtube_display_name === "string" ? data.youtube_display_name : "",
    twitter_id: typeof data.twitter_id === "string" ? data.twitter_id : "",
    one_liner: typeof data.one_liner === "string" ? data.one_liner.slice(0, 20) : "",
    image: typeof data.image === "string" ? data.image : "",
    profile: typeof data.profile === "string" ? data.profile : "",
    favorite_categories: Array.isArray(data.favorite_categories) ? data.favorite_categories.filter((item: unknown) => typeof item === "string").slice(0, 5) : []
  };
}

function anonymousViewerProfile(id: string): EmbeddedViewerProfile {
  return {
    id,
    is_anonymous: true,
    display_name: "",
    viewer_plan: "free",
    youtube_display_name: "",
    twitter_id: "",
    one_liner: "",
    image: "",
    profile: "",
    favorite_categories: [],
  };
}
