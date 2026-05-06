"use client";

import { useState } from "react";

export function AdminEntryForm() {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!password.trim()) return;
    setMessage("確認中...");
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: password.trim() })
    });
    if (response.ok) {
      window.location.assign("/admin");
      return;
    }
    setMessage(response.status === 429 ? "入力回数が多すぎます。少し待ってください。" : "パスワードが違います。");
  }

  return (
    <form className="admin-entry" onSubmit={submit}>
      <label htmlFor="admin_password">管理者用</label>
      <div>
        <input
          id="admin_password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="パスワード"
        />
        <button type="submit">入る</button>
      </div>
      {message && <p className="help-text">{message}</p>}
    </form>
  );
}
