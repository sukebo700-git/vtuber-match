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
const popupSessionCountKey = `vtuber-match-short-video-campaign-count-${popupVersion}`;
const popupSessionLastShownKey = `vtuber-match-short-video-campaign-last-shown-${popupVersion}`;
const maxPopupShowsPerSession = 3;
const popupCooldownMs = 3 * 60 * 1000;
const shortVideoFormUrl = process.env.NEXT_PUBLIC_SHORT_VIDEO_FORM_URL || "https://t.co/RvMn6IQife";

export function ShortVideoCampaignPopup() {
  const [open, setOpen] = useState(false);
  const [creator, setCreator] = useState<CreatorAuth | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    try {
      const shownCount = Number(sessionStorage.getItem(popupSessionCountKey) || "0");
      const lastShown = Number(sessionStorage.getItem(popupSessionLastShownKey) || "0");
      if (shownCount >= maxPopupShowsPerSession) return;
      if (lastShown && Date.now() - lastShown < popupCooldownMs) return;
    } catch {
      // Keep the campaign usable even when storage is blocked.
    }
    setCreator(readCreatorAuth());
    const timer = window.setTimeout(() => {
      setOpen(true);
      try {
        const shownCount = Number(sessionStorage.getItem(popupSessionCountKey) || "0");
        sessionStorage.setItem(popupSessionCountKey, String(shownCount + 1));
        sessionStorage.setItem(popupSessionLastShownKey, String(Date.now()));
      } catch {
        // Ignore storage failures.
      }
    }, 650);
    return () => window.clearTimeout(timer);
  }, []);

  const isCreator = Boolean(creator?.id || creator?.streamer_id || creator?.application_id || creator?.email);
  const creatorLabel = useMemo(() => creator?.name || creator?.email || creator?.id || "登録済み配信者", [creator]);

  if (!open) return null;

  async function requestShortVideo() {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/short-video-requests", { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(data.error || "希望を送信できませんでした。配信者ログイン状態を確認してください。");
        return;
      }
      setMessage("希望を受け付けました。紹介ショート動画の作成に必要な情報をフォームにご記入ください。");
      window.open(shortVideoFormUrl, "_blank", "noopener,noreferrer");
    } catch {
      setMessage("通信に失敗しました。時間をおいてもう一度お試しください。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="campaign-popup-backdrop" role="dialog" aria-modal="true" aria-labelledby="short-video-campaign-title">
      <div className="campaign-popup-modal">
        <button className="campaign-popup-close" type="button" aria-label="閉じる" onClick={() => setOpen(false)}>
          x
        </button>
        <div className="campaign-popup-ribbon">VTuberの方必見</div>
        <p className="campaign-popup-kicker">期間限定キャンペーン</p>
        <h2 id="short-video-campaign-title">
          紹介ショート動画
          <br />
          作成無料！
        </h2>
        <p className="campaign-popup-lead">
          VtuberMatch公式YouTubeチャンネルであなたを紹介します。
        </p>

        <div className="campaign-popup-actions">
          <a className="primary-button" href="/creator/apply">配信者登録へ</a>
          <a className="secondary-button" href="/creator">詳しくはこちら</a>
        </div>

        {isCreator ? (
          <section className="campaign-popup-creator">
            <span>登録済み配信者向け</span>
            <strong>{creatorLabel}</strong>
            <p>紹介ショート動画の作成に必要な情報をフォームにご記入ください。</p>
            <a className="campaign-form-link" href={shortVideoFormUrl} target="_blank" rel="noreferrer">
              必要事項をフォームに記入する
            </a>
            <button className="primary-button" type="button" disabled={busy} onClick={requestShortVideo}>
              {busy ? "送信中..." : "無料ショート動画を希望する"}
            </button>
            {message ? <p className="campaign-popup-note">{message}</p> : null}
          </section>
        ) : (
          <section className="campaign-popup-creator muted">
            <span>配信者登録済みの方限定</span>
            <p>登録後に無料ショート動画の希望フォームを送れます。</p>
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
