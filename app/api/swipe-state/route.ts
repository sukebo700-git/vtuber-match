import { NextResponse } from "next/server";
import { getRecentlySeenStreamerIds, markStreamersSeen } from "@/lib/swipeState";
import { readUserSession, viewerSessionCookie } from "@/lib/userSession";

// 未登録(匿名)ユーザーはセッションを持てないため、anon-viewer- IDのみ
// 認証なしでの読み書きを許可する(いいね送信・マッチ一覧と同じ既存の信頼モデル)。
// それ以外(他人の登録済みIDを推測しての操作)はセッション一致必須で拒否する。
function isAllowed(request: Request, id: string) {
  if (id.startsWith("anon-viewer-")) return true;
  const session = readUserSession<{ id?: string }>(request, viewerSessionCookie);
  return Boolean(session?.id && session.id === id);
}

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  if (!isAllowed(request, id)) return NextResponse.json({ error: "viewer login required" }, { status: 401 });

  const seen = await getRecentlySeenStreamerIds(id);
  return NextResponse.json({ seen_streamer_ids: Array.from(seen) });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const id = String(body.id || "");
  const streamerIds = Array.isArray(body.streamer_ids)
    ? body.streamer_ids.map(String).filter(Boolean).slice(0, 40)
    : [];
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  if (!isAllowed(request, id)) return NextResponse.json({ error: "viewer login required" }, { status: 401 });
  if (!streamerIds.length) return NextResponse.json({ ok: true, skipped: true });

  await markStreamersSeen(id, streamerIds);
  return NextResponse.json({ ok: true });
}
