"use client";

import { useEffect, useRef } from "react";
import { loadGoogleIdentityScript } from "@/lib/googleIdentityClient";

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

type GoogleCredentialFieldProps = {
  // Googleの認証ボタンを押してIDトークンが得られたら呼ばれる。
  // ここではAPIは呼ばず、呼び出し元(フォーム)がsubmit時にサーバーへ送って検証する。
  onCredential: (credential: string) => void;
};

export function GoogleCredentialField({ onCredential }: GoogleCredentialFieldProps) {
  const buttonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!CLIENT_ID) return;
    let cancelled = false;

    function init() {
      if (cancelled || !window.google?.accounts?.id || !buttonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: (response: { credential: string }) => onCredential(response.credential),
        auto_select: false,
        cancel_on_tap_outside: false,
        use_fedcm_for_prompt: true,
      });
      window.google.accounts.id.renderButton(buttonRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "signup_with",
        shape: "pill",
        logo_alignment: "center",
        // Googleの仕様上、幅はpx指定・最大400px。フィールドの実幅に合わせて広げる。
        width: Math.min(400, Math.max(280, Math.round(buttonRef.current.offsetWidth || 0))),
      });
    }

    loadGoogleIdentityScript(init);

    return () => {
      cancelled = true;
    };
  }, [onCredential]);

  if (!CLIENT_ID) return null;
  return <div ref={buttonRef} className="google-signin-button" />;
}
