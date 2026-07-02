"use client";

import { Heart } from "lucide-react";
import { useState } from "react";
import { ensureAnonymousUser } from "@/lib/firebase";
import { anonymousViewerProfile, getViewerIdentity } from "@/lib/viewerIdentity";
import type { ViewerProfile } from "@/lib/types";

type DetailLikeButtonProps = {
  streamerId: string;
};

const viewerProfileKey = "vtuber-match-viewer-profile";

export function DetailLikeButton({ streamerId }: DetailLikeButtonProps) {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function like() {
    if (busy) return;
    setBusy(true);
    setStatus("");
    const viewerProfile = readViewerProfile();
    const identity = getViewerIdentity();
    const publicViewerProfile = identity.registered && viewerProfile?.visible_to_matched_streamers
      ? viewerProfile
      : identity.registered
        ? { id: identity.id, display_name: identity.auth?.name || "", visible_to_matched_streamers: true }
      : anonymousViewerProfile(identity.id);
    const userId = await getUserId();
    const response = await fetch("/api/likes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userId,
        streamer_id: streamerId,
        viewer_profile_id: identity.id,
        viewer_profile: publicViewerProfile,
      }),
    });
    setBusy(false);
    setStatus(response.ok ? "いいねしました。" : "いいねに失敗しました。時間をおいてもう一度お試しください。");
  }

  return (
    <>
      <button className="primary-button" type="button" onClick={like} disabled={busy}>
        <Heart size={18} fill="currentColor" />
        {busy ? "送信中..." : "いいねする"}
      </button>
      {status && <p className="help-text">{status}</p>}
    </>
  );
}

function readViewerProfile() {
  try {
    const raw = localStorage.getItem(viewerProfileKey);
    return raw ? (JSON.parse(raw) as Partial<ViewerProfile>) : undefined;
  } catch {
    return undefined;
  }
}

async function getUserId() {
  try {
    return await ensureAnonymousUser();
  } catch {
    const key = "vtuber-match-fallback-user-id";
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const id = `viewer_${crypto.randomUUID()}`;
    localStorage.setItem(key, id);
    return id;
  }
}
