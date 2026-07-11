import fs from "fs";
import http from "http";
import path from "path";

const tokenPath = path.join(process.cwd(), "worker", "short-video", ".secrets", "youtube-token.json");
const redirectPort = 8799;
const redirectUri = `http://127.0.0.1:${redirectPort}/callback`;
const uploadScope = "https://www.googleapis.com/auth/youtube.upload";

type StoredToken = {
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
};

function oauthClient() {
  const clientId = process.env.YOUTUBE_OAUTH_CLIENT_ID || "";
  const clientSecret = process.env.YOUTUBE_OAUTH_CLIENT_SECRET || "";
  if (!clientId || !clientSecret) {
    throw new Error(".env.local に YOUTUBE_OAUTH_CLIENT_ID / YOUTUBE_OAUTH_CLIENT_SECRET を設定してください。");
  }
  return { clientId, clientSecret };
}

export function buildAuthUrl() {
  const { clientId } = oauthClient();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", uploadScope);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  return url.toString();
}

export async function waitForAuthCode(): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((request, response) => {
      const requestUrl = new URL(request.url || "/", `http://127.0.0.1:${redirectPort}`);
      if (requestUrl.pathname !== "/callback") {
        response.writeHead(404).end();
        return;
      }
      const code = requestUrl.searchParams.get("code");
      const error = requestUrl.searchParams.get("error");
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(code ? "認可が完了しました。このタブを閉じてください。" : `認可に失敗しました: ${error || "unknown"}`);
      server.close();
      if (code) resolve(code);
      else reject(new Error(`OAuth authorization failed: ${error || "no code"}`));
    });
    server.listen(redirectPort, "127.0.0.1");
    server.on("error", reject);
  });
}

export async function exchangeCodeForToken(code: string) {
  const { clientId, clientSecret } = oauthClient();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) {
    throw new Error(`Token exchange failed: ${JSON.stringify(data)}`);
  }
  saveToken({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + Number(data.expires_in || 3600) * 1000,
  });
}

export async function getAccessToken(): Promise<string> {
  const token = readToken();
  if (!token.refresh_token && !token.access_token) {
    throw new Error("YouTubeの認可が未設定です。先に npm run worker:short-video:auth を実行してください。");
  }
  if (token.access_token && token.expires_at && token.expires_at > Date.now() + 60_000) {
    return token.access_token;
  }
  if (!token.refresh_token) {
    throw new Error("リフレッシュトークンがありません。npm run worker:short-video:auth を再実行してください。");
  }

  const { clientId, clientSecret } = oauthClient();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: token.refresh_token,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) {
    throw new Error(`Token refresh failed: ${JSON.stringify(data)}`);
  }
  const updated: StoredToken = {
    access_token: data.access_token,
    refresh_token: token.refresh_token,
    expires_at: Date.now() + Number(data.expires_in || 3600) * 1000,
  };
  saveToken(updated);
  return updated.access_token as string;
}

function readToken(): StoredToken {
  try {
    return JSON.parse(fs.readFileSync(tokenPath, "utf8")) as StoredToken;
  } catch {
    return {};
  }
}

function saveToken(token: StoredToken) {
  fs.mkdirSync(path.dirname(tokenPath), { recursive: true });
  fs.writeFileSync(tokenPath, `${JSON.stringify(token, null, 2)}\n`, "utf8");
}
