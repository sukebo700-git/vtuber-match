import { execFile } from "child_process";
import { loadEnvLocal } from "./env";
import { buildAuthUrl, exchangeCodeForToken, waitForAuthCode } from "./youtubeAuth";

async function main() {
  loadEnvLocal();
  const authUrl = buildAuthUrl();
  console.log("ブラウザで次のURLを開いて、VtuberMatch公式チャンネルのGoogleアカウントで認可してください:");
  console.log(authUrl);
  // cmd の start は URL 中の & 以降を切り捨てるため、rundll32 でブラウザを開く。
  execFile("rundll32", ["url.dll,FileProtocolHandler", authUrl], () => undefined);

  const code = await waitForAuthCode();
  await exchangeCodeForToken(code);
  console.log("認可が完了しました。worker/short-video/.secrets/youtube-token.json に保存しました。");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
