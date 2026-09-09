import crypto from "crypto";

export const creatorSessionCookie = "vtuber_match_creator";
export const viewerSessionCookie = "vtuber_match_viewer";

const sessionHours = 24 * 14;

type SessionPayload = Record<string, string | number | boolean | null | undefined>;

function sessionSecret() {
  return process.env.AUTH_SESSION_SECRET || process.env.AUTH_PASSWORD_PEPPER || process.env.ADMIN_ACCESS_KEY || "vtuber-match-session-local";
}

function sign(value: string) {
  return crypto.createHmac("sha256", sessionSecret()).update(value).digest("hex");
}

export function createUserSession(payload: SessionPayload) {
  const expires = Date.now() + sessionHours * 60 * 60 * 1000;
  const body = Buffer.from(JSON.stringify({ ...payload, expires })).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function readUserSession<T extends SessionPayload>(request: Request, cookieName: string): T | null {
  const value = getCookieValue(request.headers.get("cookie"), cookieName);
  if (!value) return null;
  const [body, signature] = value.split(".");
  if (!body || !signature) return null;

  const expected = sign(body);
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== signatureBuffer.length) return null;
  if (!crypto.timingSafeEqual(expectedBuffer, signatureBuffer)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T & { expires?: number };
    if (!payload.expires || payload.expires < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function userSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: sessionHours * 60 * 60,
    // apply.vtubermatch.com(切り抜き依頼フォーム、kirinuki側)にも同じログイン
    // Cookieを送らせるため、サブドメイン全体で共有する。開発環境(localhost)は
    // ドメイン付きCookieが機能しないため付けない。
    ...(process.env.NODE_ENV === "production" ? { domain: ".vtubermatch.com" } : {}),
  };
}

/**
 * セッションCookieを消す Set-Cookie を、**domain 付きと無しの2本とも**付ける。
 *
 * `response.cookies.set(name, ...)` を同じ名前で2回呼んでも、Next.js は名前を
 * キーに持っているので後の1本で上書きされてしまう。ヘッダに直接 append する。
 *
 * 2本必要な理由:
 *   - いまは domain=.vtubermatch.com 付きで発行している。domain 付きのCookieは
 *     domain 付きの Set-Cookie でないと消せない
 *   - domain を付ける前に発行された「ホスト限定」のCookieもブラウザに残っている
 * 片方だけ消すともう片方が生き残り、**ログアウトしたのにログインしたまま**になる。
 */
export function clearUserSessionCookie(response: { headers: Headers }, name: string) {
  const secure = process.env.NODE_ENV === "production";
  const domain = (userSessionCookieOptions() as { domain?: string }).domain;
  const variants = domain ? [undefined, domain] : [undefined];
  for (const d of variants) {
    const parts = [`${name}=`, "Path=/", "Max-Age=0"];
    if (d) parts.push(`Domain=${d}`);
    if (secure) parts.push("Secure");
    parts.push("HttpOnly", "SameSite=Lax");
    response.headers.append("Set-Cookie", parts.join("; "));
  }
}

function getCookieValue(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return "";
  const item = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return item ? decodeURIComponent(item.slice(name.length + 1)) : "";
}
