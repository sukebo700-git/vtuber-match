import { NextResponse } from "next/server";
import { adminCookieName, getCookieValue, verifyAdminSession } from "@/lib/adminSession";

export function isAdminRequest(request: Request) {
  const expected = process.env.ADMIN_ACCESS_KEY || "";
  const provided = request.headers.get("x-admin-key") || "";
  const session = getCookieValue(request.headers.get("cookie"), adminCookieName);
  return Boolean((expected && provided === expected) || verifyAdminSession(session));
}

export function requireAdmin(request: Request) {
  if (isAdminRequest(request)) return null;
  return NextResponse.json({ error: "admin authorization required" }, { status: 401 });
}
