"use client";

import { useEffect, useMemo, useState } from "react";

type CreatorAuth = {
  id?: string;
  name?: string;
  email?: string;
  streamer_id?: string;
  application_id?: string;
};

const popupVersion = "20260702-top-restore";
const popupDismissedUntilKey = `vtuber-match-short-video-campaign-dismissed-until-${popupVersion}`;
const popupDismissDaysMs = 7 * 24 * 60 * 60 * 1000;
const shortVideoRequestPath = "/creator/short-video";

export function ShortVideoCampaignPopup() {
  const [open, setOpen] = useState(false);
  const [creator, setCreator] = useState<CreatorAuth | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      const dismissedUntil = Number(localStorage.getItem(popupDismissedUntilKey) || "0");
      if (dismissedUntil && Date.now() < dismissedUntil) return;
    } catch {
      // Keep the campaign usable even when storage is blocked.
    }
    setCreator(readCreatorAuth());
    const timer = window.setTimeout(() => {
      setOpen(true);
    }, 1400);
    return () => window.clearTimeout(timer);
  }, []);

  const isCreator = Boolean(creator?.id || creator?.streamer_id || creator?.application_id || creator?.email);
  const creatorLabel = useMemo(() => creator?.name || creator?.email || creator?.id || "登録済み配信者", [creator]);

  if (!open) return null;

  function dismissPopup() {
    try {
      localStorage.setItem(popupDismissedUntilKey, String(Date.now() + popupDismissDaysMs));
    } catch {
      // Ignore storage failures.
    }
    setOpen(false);
  }

  function requestShortVideo() {
    if (busy) return;
    setBusy(true);
    window.location.href = shortVideoRequestPath;
  }

  return (
    <div className="campaign-popup-backdrop" role="dialog" aria-modal="false" aria-labelledby="short-video-campaign-title">
      <div className="campaign-popup-modal">
        <button className="campaign-popup-close" type="button" aria-label="閉じる" onClick={dismissPopup}>
          ×
        </button>
        <div className="campaign-popup-ribbon">掲載VTuber向け</div>
        <p className="campaign-popup-kicker">期間限定キャンペーン</p>
        <h2 id="short-video-campaign-title">
          紹介ショート動画
          <br />
          無料で作成します
        </h2>
        <p className="campaign-popup-lead">
          無料プランに申し込むと、Lo-Fi 24時間配信への掲載、紹介ショート動画での宣伝、無料掲載ページの作成をまとめて利用できます。
        </p>

        <div className="campaign-popup-actions">
          <a className="primary-button" href="/creator/apply">無料で宣伝を申し込む</a>
          <a className="secondary-button" href="/creator">内容を見る</a>
        </div>

        {isCreator ? (
          <section className="campaign-popup-creator">
            <span>登録済み配信者向け</span>
            <strong>{creatorLabel}</strong>
            <p>アピールしたいポイントを書いて送るだけで、紹介ショート動画を依頼できます。</p>
            <button className="primary-button" type="button" disabled={busy} onClick={requestShortVideo}>
              {busy ? "移動中..." : "作成を依頼する"}
            </button>
          </section>
        ) : (
          <section className="campaign-popup-creator muted">
            <span>配信者登録済みの方限定</span>
            <p>配信者として登録すると、紹介ショート動画を依頼できます。</p>
          </section>
        )}
      </div>
    </div>
  );
}

function readCreatorAuth(): CreatorAuth | null {
  if (typeof window === "undefined") return null;
  const auth = readJson<CreatorAuth>(localStorage.getItem("vtuber-match-creator-auth")) || {};
  const id = localStorage.getItem("vtuber-match-creator-id") || localStorage.getItem("vtuber-match-creator-login-id") || auth.id || "";
  const streamerId = localStorage.getItem("vtuber-match-creator-streamer-id") || auth.streamer_id || "";
  const applicationId = localStorage.getItem("vtuber-match-creator-application-id") || auth.application_id || "";
  const email = localStorage.getItem("vtuber-match-creator-email") || auth.email || "";
  const name = localStorage.getItem("vtuber-match-creator-name") || auth.name || "";
  if (!id && !streamerId && !applicationId && !email && !name) return null;
  return { id, streamer_id: streamerId, application_id: applicationId, email, name };
}

function readJson<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}
