"use client";

import { useState } from "react";

type PasswordResetConfirmFormProps = {
  requestId: string;
  token: string;
};

export function PasswordResetConfirmForm({ requestId, token }: PasswordResetConfirmFormProps) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState("");
  const [done, setDone] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (newPassword.length < 8) {
      setStatus("新しいパスワードは8文字以上で入力してください。");
      return;
    }
    if (newPassword !== confirmPassword) {
      setStatus("新しいパスワードが一致しません。");
      return;
    }

    setStatus("設定しています...");
    const response = await fetch("/api/password-reset-confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: requestId, token, new_password: newPassword }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setStatus(data.error || "パスワードの設定に失敗しました。");
      return;
    }

    setDone(true);
    setStatus("新しいパスワードを設定しました。ログイン画面から新しいパスワードでログインしてください。");
  }

  if (!requestId || !token) {
    return <p className="notice-text">リンクが正しくありません。パスワード再設定を最初からやり直してください。</p>;
  }

  if (done) {
    return (
      <div className="form compact-form">
        <p className="notice-text">{status}</p>
        <a className="primary-button" href="/creator">ログイン画面へ</a>
      </div>
    );
  }

  return (
    <form className="form compact-form" onSubmit={submit}>
      <div className="field">
        <label htmlFor="new_password">新しいパスワード</label>
        <input
          id="new_password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          placeholder="8文字以上"
        />
      </div>

      <div className="field">
        <label htmlFor="confirm_password">新しいパスワード(確認)</label>
        <input
          id="confirm_password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="もう一度入力してください"
        />
      </div>

      <button className="primary-button" type="submit">パスワードを設定する</button>
      {status && <p className="notice-text">{status}</p>}
    </form>
  );
}
