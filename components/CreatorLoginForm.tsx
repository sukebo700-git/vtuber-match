"use client";

import { useState } from "react";

export function CreatorLoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("ログイン確認中です...");
    const response = await fetch("/api/creator-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus(data.error || "ログインできませんでした。");
      return;
    }

    localStorage.setItem("vtuber-match-creator-login-id", data.creator_login_id || "");
    localStorage.setItem("vtuber-match-creator-email", email);
    localStorage.setItem("vtuber-match-creator-name", data.name || email);
    localStorage.setItem("vtuber-match-creator-application-id", data.application_id || "");
    localStorage.setItem("vtuber-match-creator-plan", data.plan_type || "free");
    if (data.streamer_id) localStorage.setItem("vtuber-match-creator-streamer-id", data.streamer_id);
    if (data.profile) localStorage.setItem("vtuber-match-creator-profile-draft", JSON.stringify(data.profile));
    if (Number(data.super_boost_count || 0) > 0) {
      localStorage.setItem("vtuber-match-creator-super-boost-notice", String(data.super_boost_count));
    }
    window.dispatchEvent(new Event("vtuber-match-auth-changed"));
    setStatus("ログインしました。通知設定へ移動します。");
    window.location.assign("/creator?notify=1");
  }

  return (
    <form className="form compact-form" onSubmit={submit}>
      <div className="field">
        <label htmlFor="creator_email">メールアドレス</label>
        <input id="creator_email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="username" />
      </div>
      <div className="field">
        <label htmlFor="creator_password">パスワード</label>
        <input id="creator_password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" />
      </div>
      <p className="help-text">申し込み時に登録したメールアドレスとパスワードでログインできます。</p>
      <button className="primary-button" type="submit">ログイン</button>
      <p className="help-text"><a href="/password-reset?type=creator">パスワードを忘れた方</a></p>
      {status && <p className="notice-text">{status}</p>}
    </form>
  );
}
