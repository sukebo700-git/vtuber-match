"use client";

import { useEffect, useRef } from "react";
import { anonymousViewerIdKey, rememberRegisteredViewer, viewerAuthKey } from "@/lib/viewerIdentity";
import { loadGoogleIdentityScript } from "@/lib/googleIdentityClient";

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

type GoogleOneTapProps = {
  // trueならログインページ等に「Googleでログイン」ボタンも表示する
  // (One Tapの自動ポップアップはFedCM/クールダウンで出ない場合があるため)
  showButton?: boolean;
  // ログイン成功後に遷移させたいページ(トップページでの自動ポップアップでは
  // 未指定にして、遷移させず裏でログイン状態だけ更新する)
  redirectTo?: string;
};

export function GoogleOneTap({ showButton = false, redirectTo }: GoogleOneTapProps) {
  const buttonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!CLIENT_ID) return;
    if (localStorage.getItem(viewerAuthKey)) return;

    let cancelled = false;

    async function handleCredentialResponse(response: { credential: string }) {
      const result = await fetch("/api/viewer-login-google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          credential: response.credential,
          anonymous_viewer_id: localStorage.getItem(anonymousViewerIdKey) || "",
        }),
      });
      const data = await result.json().catch(() => ({}));
      if (!result.ok || !data.profile) return;

      rememberRegisteredViewer(data.profile.id);
      localStorage.setItem(viewerAuthKey, JSON.stringify({
        id: data.profile.id,
        viewer_login_id: data.profile.viewer_login_id,
        email: data.profile.email,
        name: data.profile.display_name || data.profile.email,
        loggedInAt: new Date().toISOString(),
      }));
      window.dispatchEvent(new Event("vtuber-match-auth-changed"));
      if (redirectTo) window.location.assign(redirectTo);
    }

    function init() {
      if (cancelled || !window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: handleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true,
        use_fedcm_for_prompt: true,
      });
      window.google.accounts.id.prompt();
      if (showButton && buttonRef.current) {
        window.google.accounts.id.renderButton(buttonRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "pill",
          logo_alignment: "center",
        });
      }
    }

    loadGoogleIdentityScript(init);

    return () => {
      cancelled = true;
    };
  }, [showButton, redirectTo]);

  if (!CLIENT_ID) return null;
  return showButton ? <div ref={buttonRef} className="google-signin-button" /> : null;
}
