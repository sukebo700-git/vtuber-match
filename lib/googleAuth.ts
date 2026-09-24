// Google Identity Services(One Tap)が返すIDトークンの検証。
// 新規SDK追加を避け、Googleのtokeninfoエンドポイントへの素のfetchで検証する
// (lib/email.tsのResend連携と同じ「軽量fetchラッパー」方針)。

type GoogleUser = {
  email: string;
  name: string;
  picture: string;
  sub: string;
};

// Googleログイン失敗の原因調査用ログ。X/Instagramアプリ内蔵ブラウザ等、
// クライアント側では再現できない環境要因の切り分けにUser-Agentが要るため、
// 失敗発生時にサーバー側(Vercelのファンクションログ)へ残す。
export function logGoogleAuthFailure(request: Request, endpoint: string, reason: string) {
  console.error("[google-auth-failure]", JSON.stringify({
    endpoint,
    reason,
    userAgent: request.headers.get("user-agent") || "",
    referer: request.headers.get("referer") || "",
    time: new Date().toISOString(),
  }));
}

export async function verifyGoogleIdToken(credential: string): Promise<GoogleUser | null> {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
  if (!clientId || !credential) return null;

  try {
    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    if (!response.ok) return null;
    const data = await response.json();

    if (data.aud !== clientId) return null;
    if (data.email_verified !== "true" && data.email_verified !== true) return null;
    if (!data.email) return null;

    return {
      email: String(data.email).toLowerCase(),
      name: String(data.name || ""),
      picture: String(data.picture || ""),
      sub: String(data.sub || ""),
    };
  } catch {
    return null;
  }
}
