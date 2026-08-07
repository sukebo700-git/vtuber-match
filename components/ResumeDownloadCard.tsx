"use client";

import { useEffect, useState } from "react";

export function ResumeDownloadCard() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    fetch("/api/profile-edits")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data?.profile?.resumePublicOptIn === false) setVisible(false);
      })
      .catch(() => undefined);
  }, []);

  if (!visible) return null;

  return (
    <a className="creator-action-card" href="/api/resume/generate" download>
      <strong>履歴書を作る</strong>
      <span>登録済みプロフィールから、VTuber専用履歴書(PNG画像)をダウンロードできます。</span>
    </a>
  );
}
