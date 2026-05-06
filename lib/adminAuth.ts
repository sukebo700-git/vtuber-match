import { NextResponse } from "next/server";

export function isAdminRequest(request: Request) {
  const expected = process.env.ADMIN_ACCESS_KEY || "kiya0110";
  const url = new URL(request.url);
  const provided = request.headers.get("x-admin-key") || url.searchParams.get("key");
  return Boolean(expected && provided === expected);
}

export function requireAdmin(request: Request) {
  if (isAdminRequest(request)) return null;
  return NextResponse.json({ error: "admin authorization required" }, { status: 401 });
}
