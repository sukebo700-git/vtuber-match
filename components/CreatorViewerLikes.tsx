"use client";

import { Flag, Heart } from "lucide-react";
import { useEffect, useState } from "react";

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
  const [planType, setPlanType] = useState("free");
  const [viewers, setViewers] = useState<CreatorViewer[]>([]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const id = localStorage.getItem("vtuber-match-creator-streamer-id") || "";
    const plan = localStorage.getItem("vtuber-match-creator-plan") || "free";
    setStreamerId(id);
    setPlanType(plan);
    if (id) loadViewers(id);
  }, []);

  async function loadViewers(id: string) {
    setStatus("視聴者プロフィールを読み込み中です...");
    const response = await fetch(`/api/creator-viewers?streamer_id=${encodeURIComponent(id)}`);
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      setViewers(Array.isArray(data.viewers) ? data.viewers : []);
      setStatus("");
      return;
    }
    setStatus(data.error || "読み込みに失敗しました。");
  }

  async function likeViewer(viewerProfileId: string) {
    if (!streamerId) {
      setStatus("配信者ログイン後に利用できます。");
      return;
    }
    if (planType !== "boost") {
      setStatus("視聴者へのいいねはプレミアムプラン限定です。");
      return;
    }

    const response = await fetch("/api/creator-likes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ streamer_id: streamerId, viewer_profile_id: viewerProfileId }),
    });

    if (response.ok) {
      setViewers((current) =>
        current.map((viewer) =>
          viewer.id === viewerProfileId ? { ...viewer, liked_by_streamer: true } : viewer,
        ),
      );
      setStatus("視聴者にいいねしました。");
      return;
    }
    setStatus("いいねに失敗しました。");
  }

  async function reportViewer(viewer: CreatorViewer) {
    if (!streamerId) {
      setStatus("配信者ログイン後に通報できます。");
      return;
    }

    const detail = window.prompt("通報理由を入力してください。運営が確認します。");
    if (!detail) return;

    const response = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        report_type: "viewer",
        streamer_id: streamerId,
        viewer_profile_id: viewer.id,
        viewer_name: viewer.display_name || viewer.youtube_display_name || "",
        reason: "viewer_report",
        detail,
      }),
    });
    setStatus(response.ok ? "視聴者の通報を送信しました。" : "通報に失敗しました。");
  }

  return (
    <section className="status-band">
      <h2>視聴者リアクション</h2>
      <p>
        マッチした視聴者プロフィールを確認できます。視聴者へのいいねはプレミアムプラン限定、視聴者通報はマッチ済みならプランを問わず利用できます。
      </p>
      {!streamerId && (
        <p className="notice-text">配信者ログイン後、掲載データに紐づいた視聴者が表示されます。</p>
      )}
      {status && <p className="help-text">{status}</p>}

      <div className="admin-list">
        {viewers.map((viewer) => (
          <article className="admin-card" key={viewer.id}>
            <div className="admin-card-head">
              <h3>{viewer.display_name || viewer.youtube_display_name || "名前未入力の視聴者"}</h3>
              <span className={`state ${viewer.liked_by_streamer ? "approved" : "pending"}`}>
                {viewer.liked_by_streamer ? "いいね済み" : "未いいね"}
              </span>
            </div>

            {viewer.image && (
              <div className="image-preview-row">
                <img src={viewer.image} alt="視聴者プロフィール画像" />
              </div>
            )}

            <dl className="data-list">
              <div>
                <dt>YouTube表示名</dt>
                <dd>{viewer.youtube_display_name || "未入力"}</dd>
              </div>
              <div>
                <dt>プロフィール</dt>
                <dd>{viewer.profile || "未入力"}</dd>
              </div>
              <div>
                <dt>好きなカテゴリ</dt>
                <dd>{viewer.favorite_categories?.join(" / ") || "未選択"}</dd>
              </div>
            </dl>

            <div className="inline-actions">
              <button
                className="primary-button"
                type="button"
                disabled={planType !== "boost" || viewer.liked_by_streamer}
                onClick={() => likeViewer(viewer.id)}
              >
                <Heart size={18} />
                {viewer.liked_by_streamer ? "いいね済み" : "視聴者にいいね"}
              </button>
              <button className="secondary-button" type="button" onClick={() => reportViewer(viewer)}>
                <Flag size={18} />
                通報
              </button>
            </div>
          </article>
        ))}

        {streamerId && !viewers.length && !status && (
          <article className="admin-card">
            <h3>まだ表示できる視聴者がいません</h3>
            <p>視聴者がマッチし、プロフィール共有をオンにするとここに表示されます。</p>
          </article>
        )}
      </div>
    </section>
  );
}
