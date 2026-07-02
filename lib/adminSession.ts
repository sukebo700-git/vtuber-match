import crypto from "crypto";

export const adminCookieName = "vtuber_match_admin";

const sessionHours = 8;

function secret() {
  return process.env.ADMIN_ACCESS_KEY || (process.env.NODE_ENV === "production" ? "" : "vtuber-match-dev-admin");
}

function sign(value: string) {
  return crypto.createHmac("sha256", secret()).update(value).digest("hex");
}

export function createAdminSession() {
  if (!secret()) throw new Error("ADMIN_ACCESS_KEY is required");
  const expires = Date.now() + sessionHours * 60 * 60 * 1000;
  const payload = String(expires);
  return `${payload}.${sign(payload)}`;
}

export function verifyAdminSession(value?: string | null) {
  if (!value) return false;
  if (!secret()) return false;
  const [expires, signature] = value.split(".");
  if (!expires || !signature) return false;
  if (Number(expires) < Date.now()) return false;
  const expected = sign(expires);
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== signatureBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
}

export function getCookieValue(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return "";
  const item = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return item ? decodeURIComponent(item.slice(name.length + 1)) : "";
}
