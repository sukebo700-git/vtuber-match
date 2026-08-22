import { NextResponse } from "next/server";
import { readUserSession, viewerSessionCookie } from "@/lib/userSession";
import { getViewerEntitlement } from "@/lib/viewerEntitlements";
import { getReceivedLikes, getStreamerLikeCount } from "@/lib/streamerLikes";

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const session = readUserSession<{ id?: string }>(request, viewerSessionCookie);
  const isRegisteredOwner = Boolean(session?.id && session.id === id);
  // 未登録(匿名)ユーザーはセッションを持てないため、anon-viewer- IDのみ
  // 認証なしでの閲覧(件数のみ)を許可する(いいね送信・マッチ一覧と同じ既存の信頼モデル)。
  if (!isRegisteredOwner && !id.startsWith("anon-viewer-")) {
    return NextResponse.json({ error: "viewer login required" }, { status: 401 });
  }

  const count = await getStreamerLikeCount(id);
  // 送信元の詳細はエリートファンのみ。サーバー側で確実に絞り、
  // フリー/未登録には件数のみ返す(クライアント側で隠すだけの実装にしない)。
  if (!isRegisteredOwner) return NextResponse.json({ count, tier: "guest", likes: [] });

  const tier = (await getViewerEntitlement(id)).tier;
  if (tier !== "elite") return NextResponse.json({ count, tier, likes: [] });

  const likes = await getReceivedLikes(id);
  return NextResponse.json({ count, tier, likes });
}
