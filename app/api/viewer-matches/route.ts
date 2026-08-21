import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { readUserSession, viewerSessionCookie } from "@/lib/userSession";
import { getViewerEntitlement } from "@/lib/viewerEntitlements";

// 仕様(エリートファンの訴求文言と一致): 未登録は最新1件、無料登録は最新5件、
// エリートファンは無制限(実質上限として十分大きい値を設定)。
const guestLimit = 1;
const freeLimit = 5;
const eliteLimit = 500;

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const session = readUserSession<{ id?: string }>(request, viewerSessionCookie);
  const isRegisteredOwner = Boolean(session?.id && session.id === id);
  // 未登録(匿名)ユーザーはセッションを持てないため、anon-viewer- IDのみ
  // 認証なしでの閲覧を許可する(いいね送信時と同じ既存の信頼モデル)。
  // それ以外(他人の登録済みIDを推測しての閲覧)はセッション一致必須で拒否する。
  if (!isRegisteredOwner && !id.startsWith("anon-viewer-")) {
    return NextResponse.json({ error: "viewer login required" }, { status: 401 });
  }

  const db = getAdminDb();
  if (!db) return NextResponse.json({ matches: [], tier: "guest", limit: guestLimit, total: 0 });

  const tier = isRegisteredOwner ? (await getViewerEntitlement(id)).tier : "free";
  const limit = !isRegisteredOwner ? guestLimit : tier === "elite" ? eliteLimit : freeLimit;

  const [snapshot, totalCount] = await Promise.all([
    db.collection("matches")
      .where("viewer_profile_id", "==", id)
      .orderBy("matched_at", "desc")
      .limit(limit)
      .get(),
    db.collection("matches").where("viewer_profile_id", "==", id).count().get(),
  ]);

  const matches = snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      streamer_id: String(data.streamer_id || ""),
      streamer_name: String(data.streamer_name || ""),
      streamer_thumbnail: String(data.streamer_thumbnail || ""),
      streamer_youtube_url: String(data.streamer_youtube_url || ""),
      matched_at: toIso(data.matched_at),
    };
  });

  return NextResponse.json({
    matches,
    tier: isRegisteredOwner ? tier : "guest",
    limit,
    total: totalCount.data().count,
  });
}

function toIso(value: unknown): string | null {
  if (value && typeof value === "object" && "toDate" in value && typeof (value as { toDate: unknown }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return null;
}
