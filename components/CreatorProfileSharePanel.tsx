"use client";

import { Copy, ExternalLink, Share2 } from "lucide-react";
import { useEffect, useState } from "react";

type PublicProfile = {
  name?: string;
  public_path?: string;
};

export function CreatorProfileSharePanel() {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    fetch("/api/profile-edits")
      .then((response) => response.ok ? response.json() : null)
      .then((data) => setProfile(data?.profile || null))
      .catch(() => setProfile(null))
      .finally(() => setLoaded(true));
  }, []);

  const publicUrl = profile?.public_path && typeof window !== "undefined"
    ? `${window.location.origin}${profile.public_path}`
    : "";

  async function copyUrl() {
    if (!publicUrl) return;
    if (navigator.clipboard?.writeText) {
      const copied = await navigator.clipboard.writeText(publicUrl).then(() => true).catch(() => false);
      if (copied) {
        setStatus("公開ページのURLをコピーしました。");
        return;
      }
    }
    window.prompt("公開ページのURLをコピーしてください。", publicUrl);
  }

  async function shareProfile() {
    if (!publicUrl) return;
    const title = `${profile?.name || "VTuber"} | VtuberMatch`;
    if (navigator.share) {
      await navigator.share({
        title,
        text: `${profile?.name || "VTuber"}のVtuberMatch掲載プロフィール`,
        url: publicUrl,
      }).catch(() => undefined);
      return;
    }
    await copyUrl();
  }

  if (!loaded) return null;

  return (
    <section className="status-band">
      <h2>自分の公開ページ</h2>
      {publicUrl ? (
        <>
          <p>このページをXや配信概要欄で共有できます。</p>
          <div className="inline-actions">
            <a className="primary-button" href={profile?.public_path} target="_blank" rel="noreferrer">
              <ExternalLink size={18} />公開ページを見る
            </a>
            <button className="secondary-button" type="button" onClick={shareProfile}>
              <Share2 size={18} />共有
            </button>
            <button className="secondary-button" type="button" onClick={copyUrl}>
              <Copy size={18} />URLをコピー
            </button>
          </div>
          {status && <p className="notice-text">{status}</p>}
        </>
      ) : (
        <p className="help-text">公開ページは掲載承認後に利用できます。</p>
      )}
    </section>
  );
}
