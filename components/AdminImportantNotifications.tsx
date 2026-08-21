"use client";

import { useMemo, useState } from "react";

export type AdminImportantNotification = {
  id: string;
  type: "password_reset" | "withdrawal" | "payment_started" | "payment_ended" | "payment_failed" | "subscription_canceled" | "short_video" | "tshirt_order" | "vtuber_goods" | "other";
  title: string;
  body: string;
  created_at?: string;
  href?: string;
  svg_href?: string;
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

  // withdrawal通知は application_withdrawal:{申込ID} / streamer_withdrawal:{配信者ID}
  // の2種類のidを取り得る(重複排除後、通常は前者が優先される)。それぞれ対応する
  // APIでwithdrawal_statusを"none"に戻す。実際の退会処理(非表示化・削除)は
  // 管理画面の配信者管理から個別に行う想定で、ここでは行わない。
  async function markWithdrawalHandled(notification: AdminImportantNotification) {
    const isApplication = notification.id.startsWith("application_withdrawal:");
    const docId = notification.id.replace(/^(application|streamer)_withdrawal:/, "");
    const url = isApplication
      ? `/api/admin/applications/${encodeURIComponent(docId)}/withdrawal`
      : `/api/admin/streamers/${encodeURIComponent(docId)}`;
    setBusyId(notification.id);
    setErrorId("");
    try {
      const response = await fetch(url, {
        method: isApplication ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: isApplication ? undefined : JSON.stringify({ withdrawal_status: "none" }),
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

  // Tシャツ注文通知の「対応済みにする」は、実際にカット作業を開始した扱いにする
  // (productionStatusをcuttingへ進める)。これにより本クエリ(svg_generated)から
  // 自然に外れ、以降の工程は /admin/tshirt-orders 側の状態遷移ボタンで続ける。
  async function markTshirtOrderHandled(notification: AdminImportantNotification) {
    const docId = notification.id.replace(/^tshirt_order:/, "");
    setBusyId(notification.id);
    setErrorId("");
    try {
      const response = await fetch(`/api/admin/tshirt-orders/${encodeURIComponent(docId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cutting" }),
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
              {notification.svg_href && (
                <a className="secondary-button" href={notification.svg_href} target="_blank" rel="noreferrer">
                  カット用データをダウンロード
                </a>
              )}
              {notification.type === "tshirt_order" ? (
                <button
                  className="secondary-button"
                  type="button"
                  disabled={busyId === notification.id}
                  onClick={() => markTshirtOrderHandled(notification)}
                >
                  {busyId === notification.id ? "更新中..." : "対応済みにする"}
                </button>
              ) : notification.type === "short_video" ? (
                <button
                  className="secondary-button"
                  type="button"
                  disabled={busyId === notification.id}
                  onClick={() => markShortVideoHandled(notification)}
                >
                  {busyId === notification.id ? "更新中..." : "対応済みにする"}
                </button>
              ) : notification.type === "withdrawal" ? (
                <button
                  className="secondary-button"
                  type="button"
                  disabled={busyId === notification.id}
                  onClick={() => markWithdrawalHandled(notification)}
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
