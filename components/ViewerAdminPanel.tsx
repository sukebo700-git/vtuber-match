"use client";

import { useState } from "react";
import { AdminColorLegend } from "@/components/AdminDashboard";
import type { ViewerProfileWithStats } from "@/lib/types";

export function ViewerAdminPanel({ viewers }: { viewers: ViewerProfileWithStats[] }) {
  const [items, setItems] = useState(viewers);
  const [busyId, setBusyId] = useState("");

  async function removeViewer(id: string) {
    const target = items.find((viewer) => viewer.id === id);
    if (target?.has_paid_history) {
      alert("スーパーいいね購入履歴がある視聴者は削除できません。");
      return;
    }
    if (!confirm("この視聴者データを削除しますか？削除後は一覧から非表示になります。")) return;
    setBusyId(id);
    const response = await fetch(`/api/admin/viewers/${encodeURIComponent(id)}`, { method: "DELETE" });
    setBusyId("");
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      alert(data.code === "HAS_PAYMENT_HISTORY" ? "スーパーいいね購入履歴がある視聴者は削除できません。" : "削除に失敗しました。");
      return;
    }
    setItems((current) => current.filter((viewer) => viewer.id !== id));
  }

  return (
    <>
      <section className="status-band">
        <h2>視聴者管理</h2>
        <p>視聴者の登録状況、メール登録、スーパーいいね購入、通知設定を一覧で確認できます。</p>
        <AdminColorLegend />
      </section>

      <section className="admin-table-list viewer-admin-compact">
        {items.length ? items.map((viewer) => {
          const displayName = viewer.display_name || viewer.youtube_display_name || viewer.viewer_login_id || viewer.id;
          const hasEmail = Boolean(viewer.email);
          const superLikePurchases = viewer.super_like_purchase_count || 0;
          const registeredAt = viewer.created_at || viewer.updated_at;
          const lastActionAt = viewer.last_viewer_activity_at;

          return (
            <article className={viewerCardClassName(viewer, registeredAt)} key={viewer.id}>
              <div className="admin-card-head">
                <h3>{displayName}</h3>
                <span className="state">{formatDateOnly(registeredAt)}</span>
              </div>

              <div className="viewer-admin-summary-grid" aria-label="視聴者の利用状況">
                <span className="state pending">無料</span>
                {viewer.is_admin_viewer && <span className="state pending">匿名テスト</span>}
                {viewer.registration_source === "x_campaign" && <span className="state approved">Xキャンペーン経由</span>}
                <span className={`state email-state ${hasEmail ? "email-registered" : "email-missing"}`}>
                  {hasEmail ? "メール登録済み" : "メール未登録"}
                </span>
                <span className="state" title="スーパーいいね購入数">購入 {superLikePurchases}回</span>
                <span className={`state ${viewer.notification_enabled ? "approved" : "pending"}`}>
                  {viewer.notification_enabled ? "通知ON" : "通知OFF"}
                </span>
                <span className="state" title="視聴者が配信者に送ったいいね数">いいね {viewer.match_count}</span>
                <span className="state">最終操作 {formatDateMinute(lastActionAt)}</span>
              </div>

              <details className="admin-details">
                <summary>詳細のみ</summary>
                <dl className="data-list">
                  <div><dt>視聴者ID</dt><dd>{viewer.id}</dd></div>
                  <div><dt>管理ID</dt><dd>{viewer.viewer_login_id || "未発行"}</dd></div>
                  <div><dt>メール</dt><dd>{viewer.email || "未登録"}</dd></div>
                  <div><dt>プラン</dt><dd>無料プラン</dd></div>
                  <div><dt>表示名</dt><dd>{viewer.display_name || viewer.youtube_display_name || "未入力"}</dd></div>
                  <div><dt>Xアカウント</dt><dd>{viewer.twitter_id || "未入力"}</dd></div>
                  <div><dt>登録経路</dt><dd>{viewer.registration_source === "x_campaign" ? "Xキャンペーン" : "通常"}</dd></div>
                  <div><dt>スーパーいいね購入履歴</dt><dd>{viewer.has_paid_history ? "あり" : "なし"}</dd></div>
                  <div><dt>スーパーいいね購入数</dt><dd>{superLikePurchases}回</dd></div>
                  <div><dt>通知</dt><dd>{viewer.notification_enabled ? "ON" : "OFF"}</dd></div>
                  <div><dt>最終操作時間</dt><dd>{formatDateMinute(lastActionAt)}</dd></div>
                  <div><dt>更新日</dt><dd>{formatDate(viewer.updated_at)}</dd></div>
                </dl>
                {viewer.has_paid_history && <p className="help-text">スーパーいいね購入履歴があるため削除できません。</p>}
                <button
                  className="secondary-button danger-button"
                  type="button"
                  disabled={busyId === viewer.id || viewer.has_paid_history}
                  onClick={() => removeViewer(viewer.id)}
                >
                  {busyId === viewer.id ? "削除中..." : viewer.has_paid_history ? "削除不可" : "視聴者を削除"}
                </button>
              </details>
            </article>
          );
        }) : (
          <article className="admin-card">
            <h3>視聴者プロフィールはまだありません</h3>
          </article>
        )}
      </section>
    </>
  );
}

function formatDate(value?: string) {
  if (!value) return "-";
  return new Date(value).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
}

function formatDateOnly(value?: string) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" });
}

function formatDateMinute(value?: string) {
  if (!value) return "-";
  return new Date(value).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).replace(/\//g, "-");
}

function viewerCardClassName(viewer: ViewerProfileWithStats, registeredAt?: string) {
  const backgroundClass = isWithinHours(registeredAt, 48) ? "card-recent" : "";
  const borderClass = viewer.has_paid_history ? "card-viewer-paid-history" : "";
  return ["admin-card", backgroundClass, borderClass].filter(Boolean).join(" ");
}

function isWithinHours(value: string | undefined, hours: number) {
  if (!value) return false;
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return false;
  return Date.now() - time <= hours * 60 * 60 * 1000;
}
