import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { readLocalViewerProfilesForStreamer } from "@/lib/localStore";

export async function GET(request: Request) {
  const streamerId = new URL(request.url).searchParams.get("streamer_id") || "";
  if (!streamerId) return NextResponse.json({ error: "streamer_id is required" }, { status: 400 });

  const db = getAdminDb();
  if (!db) {
    return NextResponse.json({ viewers: await readLocalViewerProfilesForStreamer(streamerId), source: "local" });
  }

  const [likeSnapshot, creatorLikeSnapshot] = await Promise.all([
    db.collection("likes").where("streamer_id", "==", streamerId).limit(200).get(),
    db.collection("creator_likes").where("streamer_id", "==", streamerId).limit(200).get()
  ]);
  const likedIds = new Set(creatorLikeSnapshot.docs.map((doc) => String(doc.data().viewer_profile_id || "")));
  const viewers = new Map<string, Record<string, unknown>>();

  likeSnapshot.docs.forEach((doc) => {
    const data = doc.data();
    const embedded = data.viewer_profile || {};
    const id = String(data.viewer_profile_id || embedded.id || "");
    if (!id || embedded.visible_to_matched_streamers === false) return;
    viewers.set(id, {
      ...embedded,
      id,
      liked_by_streamer: likedIds.has(id)
    });
  });

  const profileDocs = await Promise.all(
    Array.from(viewers.keys()).map(async (id) => {
      const profile = await db.collection("viewer_profiles").doc(id).get();
      return { id, data: profile.exists ? profile.data() : null };
    })
  );

  profileDocs.forEach(({ id, data }) => {
    if (!data || data.visible_to_matched_streamers === false) return;
    const current = viewers.get(id) || {};
    viewers.set(id, {
      ...current,
      id,
      display_name: data.display_name || current.display_name || "",
      youtube_display_name: data.youtube_display_name || current.youtube_display_name || "",
      image: data.image || current.image || "",
      profile: data.profile || current.profile || "",
      favorite_categories: Array.isArray(data.favorite_categories) ? data.favorite_categories : current.favorite_categories,
      viewer_plan: data.viewer_plan || current.viewer_plan || "free",
      liked_by_streamer: likedIds.has(id)
    });
  });

  return NextResponse.json({ viewers: Array.from(viewers.values()), source: "firestore" });
}
