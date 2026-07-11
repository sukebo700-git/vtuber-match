"use client";

import { useState } from "react";
import { anonymousViewerIdKey, rememberRegisteredViewer } from "@/lib/viewerIdentity";

const authKey = "vtuber-match-viewer-auth";

type ViewerLoginFormProps = {
  initialMode?: "login" | "register";
};

export function ViewerLoginForm({ initialMode = "login" }: ViewerLoginFormProps) {
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [form, setForm] = useState({ email: "", password: "" });
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  function update(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus(mode === "register" ? "新規登録しています..." : "ログイン情報を確認しています...");
    const response = await fetch("/api/viewer-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        mode,
        anonymous_viewer_id: localStorage.getItem(anonymousViewerIdKey) || "",
      })
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok || !data.profile) {
      setStatus(data.error || `${mode === "register" ? "新規登録" : "ログイン"}できませんでした。エラーコード: ${response.status}`);
      return;
    }

    const profile = data.profile;
    rememberRegisteredViewer(profile.id);
    localStorage.setItem(authKey, JSON.stringify({
      id: profile.id,
      viewer_login_id: profile.viewer_login_id,
      email: profile.email,
      name: profile.display_name || profile.youtube_display_name || profile.email,
      loggedInAt: new Date().toISOString()
    }));
    window.dispatchEvent(new Event("vtuber-match-auth-changed"));
    setStatus(data.auth_action === "created" ? "新規登録しました。通知設定へ移動します。" : "ログインしました。通知設定へ移動します。");
    window.location.assign("/viewer?notify=1");
  }

  return (
    <form className="form compact-form" onSubmit={submit}>
      <div className="segmented-control" role="tablist" aria-label="視聴者ログイン種別">
        <button type="button" className={mode === "register" ? "selected" : ""} onClick={() => setMode("register")}>新規登録</button>
        <button type="button" className={mode === "login" ? "selected" : ""} onClick={() => setMode("login")}>ログイン</button>
      </div>
      <div className="field">
        <label htmlFor="viewer_email">メールアドレス</label>
        <input id="viewer_email" type="email" value={form.email} onChange={(event) => update("email", event.target.value)} required autoComplete="username" />
      </div>
      <div className="field">
        <label htmlFor="viewer_password">パスワード</label>
        <input id="viewer_password" type="password" value={form.password} onChange={(event) => update("password", event.target.value)} required minLength={8} autoComplete="current-password" />
      </div>
      <p className="help-text">
        {mode === "register"
          ? "視聴者アカウントを作成します。登録後は、気になるVTuberの詳細を見られます。"
          : "登録済みの視聴者アカウントでログインします。"}
      </p>
      <button className="primary-button" type="submit" disabled={busy}>{busy ? "確認中..." : mode === "register" ? "視聴者として新規登録" : "ログイン"}</button>
      <p className="help-text"><a href="/password-reset?type=viewer">パスワードを忘れた方</a></p>
      {status && <p className="help-text">{status}</p>}
    </form>
  );
}
