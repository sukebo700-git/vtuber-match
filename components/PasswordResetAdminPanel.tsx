"use client";

import { useState } from "react";
import type { PasswordResetRequest } from "@/lib/types";

export function PasswordResetAdminPanel({ requests, adminKey }: { requests: PasswordResetRequest[]; adminKey: string }) {
  const [items, setItems] = useState(requests);
  const [passwords, setPasswords] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const openItems = items.filter((item) => item.status !== "completed");
  const completedItems = items.filter((item) => item.status === "completed");

  async function complete(id: string) {
    const newPassword = passwords[id] || "";
    if (newPassword.length < 8) {
      setMessage("新しいパスワードは8文字以上で入力してください。");
      return;
    }
    const response = await fetch(`/api/admin/password-reset-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
      body: JSON.stringify({ new_password: newPassword })
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error || "パスワード更新に失敗しました。");
      return;
    }
    setItems((current) => current.map((item) => (
      item.id === id ? { ...item, status: "completed", completed_at: new Date().toISOString() } : item
    )));
    setPasswords((current) => ({ ...current, [id]: "" }));
    setMessage("新しいパスワードを設定しました。本人へ手動で案内してください。");
  }

  return (
    <>
      <section className="status-band">
        <h2>パスワード再設定申請</h2>
        <p>本人確認後、新しい仮パスワードを設定します。メール自動送信はしないため、設定後は本人へ手動で案内してください。</p>
        {message && <p className="notice-text">{message}</p>}
      </section>
      <section className="admin-list wide-list">
        {openItems.length ? openItems.map((request) => (
          <article className="admin-card" key={request.id}>
            <div className="admin-card-head">
              <h3>{request.user_type === "creator" ? "配信者" : "視聴者"}の再設定申請</h3>
              <span className="state pending">未対応</span>
            </div>
            <dl className="data-list">
              <div><dt>申請ID</dt><dd>{request.id}</dd></div>
              <div><dt>メール</dt><dd>{request.email}</dd></div>
              <div><dt>申込ID</dt><dd>{request.application_id || "未入力"}</dd></div>
              <div><dt>掲載ID</dt><dd>{request.streamer_id || "未入力"}</dd></div>
              <div><dt>視聴者ID</dt><dd>{request.viewer_id || "未入力"}</dd></div>
              <div><dt>補足</dt><dd>{request.note || "未入力"}</dd></div>
              <div><dt>申請日</dt><dd>{formatDate(request.created_at)}</dd></div>
            </dl>
            <div className="field">
              <label htmlFor={`password-${request.id}`}>新しい仮パスワード</label>
              <input
                id={`password-${request.id}`}
                type="text"
                minLength={8}
                value={passwords[request.id] || ""}
                onChange={(event) => setPasswords((current) => ({ ...current, [request.id]: event.target.value }))}
                placeholder="8文字以上"
              />
            </div>
            <button className="primary-button" type="button" onClick={() => complete(request.id)}>新パスワードを設定する</button>
          </article>
        )) : (
          <article className="admin-card">
            <h3>未対応の再設定申請はありません</h3>
            <p>申請が届くとここに表示されます。</p>
          </article>
        )}
      </section>
      {!!completedItems.length && (
        <section className="admin-list wide-list">
          {completedItems.slice(0, 10).map((request) => (
            <article className="admin-card" key={request.id}>
              <div className="admin-card-head">
                <h3>{request.email}</h3>
                <span className="state approved">対応済み</span>
              </div>
              <dl className="data-list">
                <div><dt>対象</dt><dd>{request.user_type === "creator" ? "配信者" : "視聴者"}</dd></div>
                <div><dt>対応日</dt><dd>{formatDate(request.completed_at)}</dd></div>
              </dl>
            </article>
          ))}
        </section>
      )}
    </>
  );
}

function formatDate(value?: string) {
  if (!value) return "未記録";
  return new Date(value).toLocaleString("ja-JP");
}
