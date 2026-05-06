import { NextResponse } from "next/server";
import { adminCookieName, createAdminSession } from "@/lib/adminSession";

const attempts = new Map<string, { count: number; resetAt: number }>();

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const current = attempts.get(ip);

  if (current && current.resetAt > now && current.count >= 6) {
    return NextResponse.json({ error: "too many attempts" }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const password = String(body.password || "");
  const expected = process.env.ADMIN_ACCESS_KEY || "kiya0110";

  if (!password || password !== expected) {
    attempts.set(ip, {
      count: current && current.resetAt > now ? current.count + 1 : 1,
      resetAt: now + 10 * 60 * 1000
    });
    return NextResponse.json({ error: "invalid password" }, { status: 401 });
  }

  attempts.delete(ip);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(adminCookieName, createAdminSession(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 8 * 60 * 60
  });
  return response;
}
