"use client";

import { useState } from "react";

const authKey = "vtuber-match-viewer-auth";
const idKey = "vtuber-match-viewer-id";

export function ViewerLoginForm() {
  const [form, setForm] = useState({ display_name: "", email: "", password: "" });
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  function update(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus("ログイン情報を確認しています...");
    const response = await fetch("/api/viewer-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok || !data.profile) {
      setStatus("ログインできませんでした。メールアドレスとパスワードを確認してください。");
      return;
    }

    const profile = data.profile;
    localStorage.setItem(idKey, profile.id);
    localStorage.setItem(authKey, JSON.stringify({
      id: profile.id,
      viewer_login_id: profile.viewer_login_id,
      email: profile.email,
      name: profile.display_name,
      loggedInAt: new Date().toISOString()
    }));
    setStatus("ログインしました。視聴者プロフィールへ移動します。");
    window.location.assign("/viewer");
  }

  return (
    <form className="form compact-form" onSubmit={submit}>
      <div className="field">
        <label htmlFor="viewer_name">表示名</label>
        <input id="viewer_name" value={form.display_name} onChange={(event) => update("display_name", event.target.value)} maxLength={40} />
      </div>
      <div className="field">
        <label htmlFor="viewer_email">メールアドレス</label>
        <input id="viewer_email" type="email" value={form.email} onChange={(event) => update("email", event.target.value)} required />
      </div>
      <div className="field">
        <label htmlFor="viewer_password">パスワード</label>
        <input id="viewer_password" type="password" value={form.password} onChange={(event) => update("password", event.target.value)} required minLength={8} />
      </div>
      <p className="help-text">ログインなしでもスワイプは利用できます。プロフィール登録と配信者への自己アピールにはログインが必要です。</p>
      <button className="primary-button" type="submit" disabled={busy}>{busy ? "確認中..." : "視聴者としてログイン"}</button>
      <p className="help-text"><a href="/password-reset?type=viewer">パスワードを忘れた方</a></p>
      {status && <p className="help-text">{status}</p>}
    </form>
  );
}
