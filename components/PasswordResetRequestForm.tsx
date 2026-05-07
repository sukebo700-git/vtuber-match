"use client";

import { useState } from "react";

type PasswordResetRequestFormProps = {
  defaultType?: "creator" | "viewer";
};

export function PasswordResetRequestForm({ defaultType = "creator" }: PasswordResetRequestFormProps) {
  const [form, setForm] = useState({
    user_type: defaultType,
    email: "",
    name: "",
    note: "",
  });
  const [status, setStatus] = useState("");
  const isCreator = form.user_type === "creator";

  function update(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("申請を送信しています...");
    const response = await fetch("/api/password-reset-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setStatus(data.error || "申請に失敗しました。入力内容を確認してください。");
      return;
    }

    setStatus("パスワード再設定申請を受け付けました。通常3日以内に、運営が本人確認後、新しいパスワードをご案内します。");
    setForm((current) => ({ ...current, name: "", note: "" }));
  }

  return (
    <form className="form compact-form" onSubmit={submit}>
      <div className="field">
        <label htmlFor="reset_user_type">対象</label>
        <select id="reset_user_type" value={form.user_type} onChange={(event) => update("user_type", event.target.value)}>
          <option value="creator">配信者</option>
          <option value="viewer">視聴者</option>
        </select>
      </div>

      <div className="field">
        <label htmlFor="reset_email">登録メールアドレス</label>
        <input
          id="reset_email"
          type="email"
          required
          value={form.email}
          onChange={(event) => update("email", event.target.value)}
          placeholder="登録時に使ったメールアドレス"
        />
      </div>

      <div className="field">
        <label htmlFor="reset_name">{isCreator ? "配信者名" : "視聴者名・表示名"}</label>
        <input
          id="reset_name"
          required
          value={form.name}
          onChange={(event) => update("name", event.target.value)}
          placeholder={isCreator ? "掲載している配信者名" : "視聴者プロフィールの表示名"}
        />
      </div>

      <div className="field">
        <label htmlFor="reset_note">補足情報 任意</label>
        <textarea
          id="reset_note"
          value={form.note}
          onChange={(event) => update("note", event.target.value)}
          placeholder="分かる範囲で、YouTube URLや状況を書いてください。"
        />
      </div>

      <p className="help-text">
        申込ID・掲載IDは不要です。運営が登録メールアドレスと名前を確認し、通常3日以内に手動で案内します。
      </p>

      <button className="primary-button" type="submit">再設定を申請する</button>
      {status && <p className="notice-text">{status}</p>}
    </form>
  );
}
