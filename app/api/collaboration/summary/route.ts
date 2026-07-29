import { NextResponse } from "next/server";
import { isCollaborationEnabled } from "@/lib/collaboration/config";
import { resolveCollaborationStreamer, shouldShowCollaborationDefaultOnNotice } from "@/lib/collaboration/session";

// /creator のバナー・ヘッダー用の軽量API。読み取り専用(既読化などの副作用は起こさない)。
// 未回答お誘い件数などは、その機能自体を実装するフェーズ3で追加する。
export async function GET(request: Request) {
  if (!isCollaborationEnabled()) return NextResponse.json({ enabled: false });

  const streamer = await resolveCollaborationStreamer(request);
  if (!streamer) return NextResponse.json({ enabled: false });

  return NextResponse.json({
    enabled: true,
    collaboration_enabled: streamer.collaboration_enabled,
    show_default_on_notice: shouldShowCollaborationDefaultOnNotice(streamer),
  });
}
