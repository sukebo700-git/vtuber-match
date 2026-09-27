"use client";

// 2026-09-27: Google認証がどこでどれだけ落ちているかを計測する。
// 9/16以降の新規登録ゼロの調査で、「Googleボタンは描画されるが押しても進まない」
// ケース(アプリ内ブラウザ、サードパーティCookieブロック、iframeの失敗)を
// 既存のフォールバック判定では検知できないことが分かったため、
// 表示・クリック・成功・読み込み失敗の4点を別々に数える。
// rendered と success の差が「Googleで詰まった人数」になる。

import type { GoogleAuthAnalyticsEvent } from "@/lib/analytics";

// 計測地点。サーバー側でフィールド名の一部になるため、値はホワイトリスト管理。
export type GoogleAuthSurface = "apply" | "creator_login" | "viewer_login" | "top";

const analyticsVisitorKey = "vtuber-match-analytics-visitor-id";

function analyticsVisitorId() {
  const existing = localStorage.getItem(analyticsVisitorKey);
  if (existing) return existing;
  const id = `visitor_${crypto.randomUUID()}`;
  localStorage.setItem(analyticsVisitorKey, id);
  return id;
}

export function reportGoogleAuthEvent(eventType: GoogleAuthAnalyticsEvent, surface: GoogleAuthSurface) {
  if (typeof window === "undefined") return;
  try {
    if (localStorage.getItem("vtuber-match-admin-mode") === "1") return;
    fetch("/api/analytics/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        event_type: eventType,
        visitor_id: analyticsVisitorId(),
        surface,
        path: window.location.pathname,
      }),
    }).catch(() => undefined);
  } catch {
    // 計測はベストエフォート。失敗してもログイン導線は止めない。
  }
}

// Googleのボタンはクロスオリジンのiframeなので、中のクリックは直接観測できない。
// 代わりに「ウィンドウがフォーカスを失った瞬間、フォーカス先がこのiframeだった」
// ことをクリックの近似として使う(GSIボタンの計測で一般的な手法)。
// あくまで近似で、キーボード操作やフォーカスを奪う他の要因では取りこぼす。
// 戻り値を呼ぶとリスナーを解除する。
export function watchGoogleButtonClick(container: HTMLElement, surface: GoogleAuthSurface) {
  let reported = false;
  const onBlur = () => {
    if (reported) return;
    const active = document.activeElement;
    if (!active || active.tagName !== "IFRAME") return;
    if (!container.contains(active)) return;
    reported = true;
    reportGoogleAuthEvent("google_auth_clicked", surface);
  };
  window.addEventListener("blur", onBlur);
  return () => window.removeEventListener("blur", onBlur);
}
