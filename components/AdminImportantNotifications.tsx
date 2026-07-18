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
  const visible = useMemo(
    () => notifications.filter((notification) => !handledIds.includes(notification.id)).slice(0, 12),
    [handledIds, notifications]
  );

  function markHandled(id: string) {
    const next = Array.from(new Set([...handledIds, id]));
    setHandledIds(next);
    try {
      localStorage.setItem("vtuber-match-admin-handled-notifications", JSON.stringify(next.slice(-200)));
    } catch {
      // Local acknowledgement is only a UI convenience.
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
              {notification.type === "short_video" && (
                <p className="help-text">
                  この「非表示」はこの画面上だけの表示切り替えです。実際の依頼状況は
                  「配信者」タブの「紹介ショート動画の依頼」から変更してください。
                </p>
              )}
              <small>{formatDate(notification.created_at)}</small>
            </div>
            <div className="admin-important-actions">
              {notification.href && <a className="secondary-button" href={notification.href}>確認</a>}
              <button className="secondary-button" type="button" onClick={() => markHandled(notification.id)}>
                {notification.type === "short_video" ? "この通知を非表示" : "対応済み"}
              </button>
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
