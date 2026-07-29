"use client";

import { useEffect, useState } from "react";

// 2026-07-29決定: 新規登録者はコラボ受付が初期値ONになる。本人が気づけるよう
// 一度だけ告知する(設定画面を開くと既読化され、以後は出ない)。
// 既存配信者(この機能追加以前から在籍)には表示されない
// (/api/collaboration/summary が collaboration_enabled=false を返すため)。
export function CollaborationDefaultOnBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/collaboration/summary")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (active && data?.show_default_on_notice) setShow(true);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  if (!show) return null;

  return (
    <section className="status-band collaboration-default-on-banner">
      <p>
        <strong>コラボ受付がONになっています。</strong>
        プロフィールに「コラボ募集中」バッジが表示され、他のVTuberからコラボのお誘いを受け取れる状態です。
      </p>
      <a className="secondary-button" href="/creator/collaboration/settings">設定を確認する</a>
    </section>
  );
}
