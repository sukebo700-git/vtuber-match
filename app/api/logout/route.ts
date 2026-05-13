import { NextResponse } from "next/server";
import { creatorSessionCookie, viewerSessionCookie } from "@/lib/userSession";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  [creatorSessionCookie, viewerSessionCookie].forEach((name) => {
    response.cookies.set(name, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  });
  return response;
}
