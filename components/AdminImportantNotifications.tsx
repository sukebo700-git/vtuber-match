"use client";

import { useMemo, useState } from "react";

export type AdminImportantNotification = {
  id: string;
  type: "password_reset" | "withdrawal" | "payment_started" | "payment_ended" | "payment_failed" | "subscription_canceled" | "short_video" | "other";
  title: string;
  body: string;
  created_at?: string;
  href?: string;
};

export function AdminImportantNotifications({ notifications }: { notifications: AdminImportantNotification[] }) {
  const [handledIds, setHandledIds] = useState<string[]>(() => readHandledIds());
  const [busyId, setBusyId] = useState("");
  const [errorId, setErrorId] = useState("");
  const visible = useMemo(
    () => notifications.filter((notification) => !handledIds.includes(notification.id)).slice(0, 12),
    [handledIds, notifications]
  );

  function dismissLocally(id: string) {
    const next = Array.from(new Set([...handledIds, id]));
    setHandledIds(next);
    try {
      localStorage.setItem("vtuber-match-admin-handled-notifications", JSON.stringify(next.slice(-200)));
    } catch {
      // Local acknowledgement is only a UI convenience.
    }
  }

  // short_video通知は「非表示」ではなく実データ(short_video_requests)を
  // published に更新する。押した瞬間に本当に対応済みにするため。
  async function markShortVideoHandled(notification: AdminImportantNotification) {
    const docId = notification.id.replace(/^short_video:/, "");
    setBusyId(notification.id);
    setErrorId("");
    try {
      const response = await fetch(`/api/admin/short-video-requests/${encodeURIComponent(docId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "published" }),
      });
      if (!response.ok) {
        setErrorId(notification.id);
        return;
      }
      dismissLocally(notification.id);
    } catch {
      setErrorId(notification.id);
    } finally {
      setBusyId("");
    }
  }

  if (!visible.length) {
    return (
      <section className="admin-important-notices is-empty">
        <h2>重要通知</h2>
        <p>現在、すぐ対応が必要な通知はありません。</p>
      </section>
    );
  }

  return (
    <section className="admin-important-notices" aria-label="重要通知">
      <div className="admin-important-head">
        <h2>重要通知</h2>
        <span>{visible.length}件</span>
      </div>
      <div className="admin-important-list">
        {visible.map((notification) => (
          <article className={`admin-important-item type-${notification.type}`} key={notification.id}>
            <div>
              <strong>{notification.title}</strong>
              <p>{notification.body}</p>
              {errorId === notification.id && (
                <p className="form-status">更新に失敗しました。時間をおいて再度お試しください。</p>
              )}
              <small>{formatDate(notification.created_at)}</small>
            </div>
            <div className="admin-important-actions">
              {notification.href && <a className="secondary-button" href={notification.href}>確認</a>}
              {notification.type === "short_video" ? (
                <button
                  className="secondary-button"
                  type="button"
                  disabled={busyId === notification.id}
                  onClick={() => markShortVideoHandled(notification)}
                >
                  {busyId === notification.id ? "更新中..." : "対応済みにする"}
                </button>
              ) : (
                <button className="secondary-button" type="button" onClick={() => dismissLocally(notification.id)}>
                  対応済み
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function readHandledIds() {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem("vtuber-match-admin-handled-notifications") || "[]");
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function formatDate(value?: string) {
  if (!value) return "日時不明";
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
