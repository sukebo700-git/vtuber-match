"use client";

import { useEffect, useRef, useState } from "react";
import { loadGoogleIdentityScript } from "@/lib/googleIdentityClient";
import { InAppBrowserNotice } from "@/components/InAppBrowserNotice";

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
// GISスクリプトの読み込みや初期化がこの時間内に終わらなければ、広告ブロッカー等で
// ブロックされているとみなしてフォールバック表示に切り替える。
const loadTimeoutMs = 5000;

type CreatorGoogleLoginProps = {
  redirectTo?: string;
};

export function CreatorGoogleLogin({ redirectTo = "/creator?notify=1" }: CreatorGoogleLoginProps) {
  const buttonRef = useRef<HTMLDivElement>(null);
  // error: API側でログインが失敗したとき(検証NG・未登録など)のメッセージ。
  // failed: Googleのスクリプト自体が読み込めずボタンが出せなかったとき。
  // 原因が別なので両方持つ。
  const [error, setError] = useState("");
  const [failed, setFailed] = useState(!CLIENT_ID);

  useEffect(() => {
    if (!CLIENT_ID) return;
    if (localStorage.getItem("vtuber-match-creator-email")) return;

    let cancelled = false;
    let rendered = false;

    const timeoutId = window.setTimeout(() => {
      if (!cancelled && !rendered) setFailed(true);
    }, loadTimeoutMs);

    async function handleCredentialResponse(response: { credential: string }) {
      setError("");
      const result = await fetch("/api/creator-login-google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: response.credential }),
      });
      const data = await result.json().catch(() => ({}));
      if (!result.ok) {
        setError(data.error || "ログインに失敗しました。時間をおいて再度お試しください。");
        return;
      }

      localStorage.setItem("vtuber-match-creator-login-id", data.creator_login_id || "");
      localStorage.setItem("vtuber-match-creator-email", data.email || "");
      localStorage.setItem("vtuber-match-creator-name", data.name || data.email || "");
      localStorage.setItem("vtuber-match-creator-application-id", data.application_id || "");
      localStorage.setItem("vtuber-match-creator-plan", data.plan_type || "free");
      if (data.streamer_id) localStorage.setItem("vtuber-match-creator-streamer-id", data.streamer_id);
      if (data.profile) localStorage.setItem("vtuber-match-creator-profile-draft", JSON.stringify(data.profile));
      if (Number(data.super_boost_count || 0) > 0) {
        localStorage.setItem("vtuber-match-creator-super-boost-notice", String(data.super_boost_count));
      }
      window.dispatchEvent(new Event("vtuber-match-auth-changed"));
      if (redirectTo) window.location.assign(redirectTo);
    }

    function init() {
      if (cancelled || !window.google?.accounts?.id) return;
      rendered = true;
      window.clearTimeout(timeoutId);
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: handleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: false,
        use_fedcm_for_prompt: true,
      });
      if (buttonRef.current) {
        window.google.accounts.id.renderButton(buttonRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "pill",
          logo_alignment: "center",
          // Googleの仕様上、幅はpx指定・最大400px。フィールドの実幅に合わせて広げる。
          width: Math.min(400, Math.max(280, Math.round(buttonRef.current.offsetWidth || 0))),
        });
      }
    }

    loadGoogleIdentityScript(init);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [redirectTo]);

  if (!CLIENT_ID) return null;
  // ボタンが出せなかった場合は、アプリ内ブラウザの案内よりこちらを優先する
  // (そもそも押せるボタンが無いため)。
  if (failed) {
    return (
      <p className="notice-text">
        Googleログインの読み込みに失敗しました。広告ブロッカーや拡張機能が影響している可能性があります。下のメールアドレスでログインしてください。
      </p>
    );
  }
  return (
    <>
      <InAppBrowserNotice />
      <div ref={buttonRef} className="google-signin-button" />
      {error ? <p className="notice-text">{error}</p> : null}
    </>
  );
}
