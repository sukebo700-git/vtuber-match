import { NextResponse } from "next/server";
import { creatorSessionCookie, readUserSession } from "@/lib/userSession";
import { getLikeCandidates } from "@/lib/streamerLikes";

export async function GET(request: Request) {
  const session = readUserSession<{ streamer_id?: string }>(request, creatorSessionCookie);
  if (!session?.streamer_id) return NextResponse.json({ error: "creator login required" }, { status: 401 });

  const candidates = await getLikeCandidates(session.streamer_id);
  return NextResponse.json({ candidates });
}
