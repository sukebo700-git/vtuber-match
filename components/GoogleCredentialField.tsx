"use client";

import { useEffect, useRef, useState } from "react";
import { loadGoogleIdentityScript } from "@/lib/googleIdentityClient";

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
// GISスクリプトの読み込みや初期化がこの時間内に終わらなければ、広告ブロッカー等で
// ブロックされているとみなしてフォールバック表示に切り替える。
const loadTimeoutMs = 5000;

type GoogleCredentialFieldProps = {
  // Googleの認証ボタンを押してIDトークンが得られたら呼ばれる。
  // ここではAPIは呼ばず、呼び出し元(フォーム)がsubmit時にサーバーへ送って検証する。
  onCredential: (credential: string) => void;
  // ボタンが表示できない(設定不備・スクリプトブロック等)と判明したときに呼ばれる。
  // 呼び出し元はここで別のログイン方法への切り替えを促せる。
  onUnavailable?: () => void;
};

export function GoogleCredentialField({ onCredential, onUnavailable }: GoogleCredentialFieldProps) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(!CLIENT_ID);

  useEffect(() => {
    if (!CLIENT_ID) {
      onUnavailable?.();
      return;
    }
    let cancelled = false;
    let rendered = false;

    const timeoutId = window.setTimeout(() => {
      if (!cancelled && !rendered) {
        setFailed(true);
        onUnavailable?.();
      }
    }, loadTimeoutMs);

    function init() {
      if (cancelled || !window.google?.accounts?.id || !buttonRef.current) return;
      rendered = true;
      window.clearTimeout(timeoutId);
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
      window.clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onCredential]);

  if (failed) {
    return (
      <p className="notice-text">
        Googleログインの読み込みに失敗しました。広告ブロッカーや拡張機能が影響している可能性があります。お手数ですが「メールアドレスで登録」に切り替えてください。
      </p>
    );
  }
  return <div ref={buttonRef} className="google-signin-button" />;
}
