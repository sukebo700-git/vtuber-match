"use client";

import { useEffect, useState } from "react";
import { isInAppBrowserUA } from "@/lib/googleIdentityClient";

// X/Instagram/LINEなどのアプリ内蔵ブラウザではGoogleログインが完了しない
// (Google側がWebViewを検知してブロックするため)。ボタンを押す前に案内する。
export function InAppBrowserNotice() {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setVisible(isInAppBrowserUA(navigator.userAgent));
  }, []);

  if (!visible) return null;

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="notice-text" style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
      <p style={{ margin: 0 }}>
        アプリ内のブラウザで開いているようです。この状態だとGoogleログインが完了しない場合があります。
        お手数ですが、このURLをコピーしてSafari/Chromeなど通常のブラウザで開き直すか、下の「メール+パスワード」をお試しください。
      </p>
      <button type="button" className="secondary-button" onClick={copyUrl}>
        {copied ? "コピーしました" : "このページのURLをコピー"}
      </button>
    </div>
  );
}
