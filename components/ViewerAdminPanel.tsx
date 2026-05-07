"use client";

import { useState } from "react";
import type { ViewerProfileWithStats } from "@/lib/types";

export function ViewerAdminPanel({ viewers }: { viewers: ViewerProfileWithStats[] }) {
  const [items, setItems] = useState(viewers);
  const [busyId, setBusyId] = useState("");

  async function removeViewer(id: string) {
    if (!confirm("この視聴者プロフィールを削除しますか？")) return;
    setBusyId(id);
    const response = await fetch(`/api/admin/viewers/${encodeURIComponent(id)}`, { method: "DELETE" });
    setBusyId("");
    if (!response.ok) {
      alert("削除に失敗しました。");
      return;
    }
    setItems((current) => current.filter((viewer) => viewer.id !== id));
  }

  return (
    <>
      <section className="status-band">
        <h2>視聴者管理</h2>
        <p>視聴者プロフィール、管理ID、マッチ数、配信者からのいいね数を確認できます。不要な視聴者データは削除できます。</p>
      </section>
      <section className="admin-list wide-list">
        {items.length ? items.map((viewer) => (
          <article className="admin-card" key={viewer.id}>
            <div className="admin-card-head">
              <h3>{viewer.display_name || viewer.youtube_display_name || "名前未入力"}</h3>
              <span className={`state ${viewer.fan_level === "super" ? "approved" : viewer.fan_level === "active" ? "pending" : ""}`}>
                {fanLabel(viewer.fan_level)}
              </span>
            </div>
            {viewer.image && (
              <div className="image-preview-row">
                <img src={viewer.image} alt="視聴者プロフィール画像" />
              </div>
            )}
            <dl className="data-list">
              <div><dt>視聴者ID</dt><dd>{viewer.id}</dd></div>
              <div><dt>視聴者管理ID</dt><dd>{viewer.viewer_login_id || "未発行"}</dd></div>
              <div><dt>メール</dt><dd>{viewer.email || "未登録"}</dd></div>
              <div><dt>プラン</dt><dd>{viewer.viewer_plan === "viewer_paid" ? "視聴者応援プラン" : "無料"}</dd></div>
              <div><dt>パスワード</dt><dd>{viewer.viewer_password_hash ? "設定済み" : "未設定"}</dd></div>
              <div><dt>YouTube表示名</dt><dd>{viewer.youtube_display_name || "未入力"}</dd></div>
              <div><dt>X / Twitter ID</dt><dd>{viewer.twitter_id || "未入力"}</dd></div>
              <div><dt>一言</dt><dd>{viewer.one_liner || "未入力"}</dd></div>
              <div><dt>マッチ数</dt><dd>{viewer.match_count}</dd></div>
              <div><dt>配信者からのいいね</dt><dd>{viewer.streamer_like_count}</dd></div>
              <div><dt>好きなカテゴリ</dt><dd>{viewer.favorite_categories?.join(" / ") || "未選択"}</dd></div>
              <div><dt>プロフィール</dt><dd>{viewer.profile || "未入力"}</dd></div>
              <div><dt>配信者への共有</dt><dd>{viewer.visible_to_matched_streamers ? "共有する" : "共有しない"}</dd></div>
              <div><dt>更新日</dt><dd>{formatDate(viewer.updated_at)}</dd></div>
            </dl>
            <button className="secondary-button danger-button" type="button" disabled={busyId === viewer.id} onClick={() => removeViewer(viewer.id)}>
              {busyId === viewer.id ? "削除中..." : "視聴者を削除"}
            </button>
          </article>
        )) : (
          <article className="admin-card">
            <h3>視聴者プロフィールはまだありません</h3>
            <p>視聴者がプロフィールを保存するとここに表示されます。</p>
          </article>
        )}
      </section>
    </>
  );
}

function fanLabel(level: ViewerProfileWithStats["fan_level"]) {
  if (level === "super") return "積極的なファン";
  if (level === "active") return "アクティブ";
  return "これから";
}

function formatDate(value?: string) {
  if (!value) return "未記録";
  return new Date(value).toLocaleString("ja-JP");
}
