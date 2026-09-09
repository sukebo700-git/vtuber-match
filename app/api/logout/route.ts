import { NextResponse } from "next/server";
import { clearUserSessionCookie, creatorSessionCookie, viewerSessionCookie } from "@/lib/userSession";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  // domain 付き・ホスト限定の両方を消す(片方だけだと消し残り、
  // ログアウトしたのにログインしたままになる)
  [creatorSessionCookie, viewerSessionCookie].forEach((name) => {
    clearUserSessionCookie(response, name);
  });
  return response;
}
