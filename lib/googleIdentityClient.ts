// Google Identity Services(GIS)の<script>を1回だけ読み込むための共通ヘルパー。
// GoogleOneTap/CreatorGoogleLogin/GoogleCredentialFieldなど複数箇所から使う。

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: Record<string, unknown>) => void;
          prompt: () => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

const SCRIPT_ID = "google-identity-services";

export function loadGoogleIdentityScript(onReady: () => void) {
  const existingScript = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
  if (existingScript) {
    if (window.google?.accounts?.id) onReady();
    else existingScript.addEventListener("load", onReady);
    return;
  }
  const script = document.createElement("script");
  script.id = SCRIPT_ID;
  script.src = "https://accounts.google.com/gsi/client";
  script.async = true;
  script.defer = true;
  script.addEventListener("load", onReady);
  document.head.appendChild(script);
}

// 表示専用の簡易デコード(検証はしない)。IDトークンのpayload部分をUIに
// 先読み表示するためだけに使う。実際の検証はサーバー側で必ず行う。
export function decodeGoogleCredentialEmail(credential: string): string {
  try {
    const payload = credential.split(".")[1];
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return String(json.email || "");
  } catch {
    return "";
  }
}
