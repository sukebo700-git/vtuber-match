"use client";

import { Bell, Check, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  read: boolean;
  created_at?: string;
};

export function NotificationInbox() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/notifications")
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (!active) return;
        if (Array.isArray(data?.notifications)) setItems(data.notifications);
        if (data?.index_required) setMessage("通知一覧の準備中です。しばらく時間をおいて再読み込みしてください。");
      })
      .catch(() => {
        if (active) setMessage("通知を読み込めませんでした。");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const unreadCount = useMemo(() => items.filter((item) => !item.read).length, [items]);

  async function markRead(id: string) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, read: true } : item));
    const response = await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!response.ok) {
      setItems((current) => current.map((item) => item.id === id ? { ...item, read: false } : item));
      setMessage("既読にできませんでした。");
    }
  }

  return (
    <section className="status-band notification-inbox">
      <div className="notification-inbox-head">
        <h2><Bell size={20} /> 通知</h2>
        <span className={unreadCount ? "notification-badge active" : "notification-badge"}>
          未読 {unreadCount}
        </span>
      </div>

      {loading ? (
        <p className="help-text"><RefreshCw size={16} /> 通知を確認しています...</p>
      ) : items.length ? (
        <div className="notification-list">
          {items.map((item) => (
            <article className={item.read ? "notification-item read" : "notification-item unread"} key={item.id}>
              <div>
                <strong>{item.title}</strong>
                {item.body && <p>{item.body}</p>}
                <span>{formatDate(item.created_at)}</span>
              </div>
              {!item.read && (
                <button className="secondary-button compact-admin-button" type="button" onClick={() => markRead(item.id)}>
                  <Check size={14} />既読
                </button>
              )}
            </article>
          ))}
        </div>
      ) : (
        <p className="help-text">新しい通知はありません。</p>
      )}
      {message && <p className="notice-text">{message}</p>}
    </section>
  );
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
