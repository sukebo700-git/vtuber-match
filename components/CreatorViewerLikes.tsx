"use client";

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";

type CreatorViewer = {
  id: string;
  display_name?: string;
  youtube_display_name?: string;
  image?: string;
  profile?: string;
  favorite_categories?: string[];
  liked_by_streamer?: boolean;
};

export function CreatorViewerLikes() {
  const [streamerId, setStreamerId] = useState("");
  const [viewers, setViewers] = useState<CreatorViewer[]>([]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const id = localStorage.getItem("vtuber-match-creator-streamer-id") || "";
    setStreamerId(id);
    if (id) loadViewers(id);
  }, []);

  async function loadViewers(id: string) {
    setStatus("視聴者プロフィールを読み込み中...");
    const response = await fetch(`/api/creator-viewers?streamer_id=${encodeURIComponent(id)}`);
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      setViewers(Array.isArray(data.viewers) ? data.viewers : []);
      setStatus("");
    } else {
      setStatus(data.error || "読み込みに失敗しました。");
    }
  }

  async function likeViewer(viewerProfileId: string) {
    if (!streamerId) {
      setStatus("掲載IDが必要です。配信者ログイン後に利用してください。");
      return;
    }
    const response = await fetch("/api/creator-likes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ streamer_id: streamerId, viewer_profile_id: viewerProfileId })
    });
    if (response.ok) {
      setViewers((current) => current.map((viewer) => viewer.id === viewerProfileId ? { ...viewer, liked_by_streamer: true } : viewer));
      setStatus("視聴者にいいねしました。");
    } else {
      setStatus("いいねに失敗しました。");
    }
  }

  return (
    <section className="status-band">
      <h2>いいねしてくれた視聴者</h2>
      <p>あなたにいいねした視聴者プロフィールを確認し、配信者側からもいいねを返せます。</p>
      {!streamerId && (
        <p className="notice-text">配信者ログイン後、掲載IDに紐づいた視聴者が表示されます。</p>
      )}
      {status && <p className="help-text">{status}</p>}
      <div className="admin-list">
        {viewers.map((viewer) => (
          <article className="admin-card" key={viewer.id}>
            <div className="admin-card-head">
              <h3>{viewer.display_name || viewer.youtube_display_name || "名前未入力の視聴者"}</h3>
              <span className={`state ${viewer.liked_by_streamer ? "approved" : "pending"}`}>{viewer.liked_by_streamer ? "いいね済み" : "未いいね"}</span>
            </div>
            {viewer.image && (
              <div className="image-preview-row">
                <img src={viewer.image} alt="視聴者プロフィール画像" />
              </div>
            )}
            <dl className="data-list">
              <div><dt>YouTube表示名</dt><dd>{viewer.youtube_display_name || "未入力"}</dd></div>
              <div><dt>プロフィール</dt><dd>{viewer.profile || "未入力"}</dd></div>
              <div><dt>好きなカテゴリ</dt><dd>{viewer.favorite_categories?.join(" / ") || "未選択"}</dd></div>
            </dl>
            <button className="primary-button" type="button" disabled={viewer.liked_by_streamer} onClick={() => likeViewer(viewer.id)}>
              <Heart size={18} />
              {viewer.liked_by_streamer ? "いいね済み" : "視聴者にいいね"}
            </button>
          </article>
        ))}
        {streamerId && !viewers.length && !status && (
          <article className="admin-card">
            <h3>まだ表示できる視聴者がいません</h3>
            <p>視聴者があなたにいいねし、プロフィール共有をオンにするとここに表示されます。</p>
          </article>
        )}
      </div>
    </section>
  );
}
