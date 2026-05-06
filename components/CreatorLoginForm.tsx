"use client";

import { useState } from "react";

export function CreatorLoginForm() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("ログイン確認中...");
    const response = await fetch("/api/creator-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus(data.error || "ログインできませんでした。");
      return;
    }
    localStorage.setItem("vtuber-match-creator-login-id", data.creator_login_id || identifier);
    localStorage.setItem("vtuber-match-creator-application-id", data.application_id || "");
    if (data.streamer_id) localStorage.setItem("vtuber-match-creator-streamer-id", data.streamer_id);
    setStatus("ログインしました。配信者用ページへ移動します。");
    window.location.assign("/creator");
  }

  return (
    <form className="form compact-form" onSubmit={submit}>
      <div className="field">
        <label htmlFor="creator_identifier">ログインIDまたはメールアドレス</label>
        <input id="creator_identifier" value={identifier} onChange={(event) => setIdentifier(event.target.value)} required autoComplete="username" />
      </div>
      <div className="field">
        <label htmlFor="creator_password">パスワード</label>
        <input id="creator_password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" />
      </div>
      <button className="primary-button" type="submit">ログイン</button>
      {status && <p className="help-text">{status}</p>}
    </form>
  );
}
