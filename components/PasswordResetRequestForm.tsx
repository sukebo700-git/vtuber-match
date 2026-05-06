"use client";

import { useState } from "react";

type PasswordResetRequestFormProps = {
  defaultType?: "creator" | "viewer";
};

export function PasswordResetRequestForm({ defaultType = "creator" }: PasswordResetRequestFormProps) {
  const [form, setForm] = useState({
    user_type: defaultType,
    email: "",
    application_id: "",
    streamer_id: "",
    viewer_id: "",
    note: ""
  });
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  function update(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus("申請を送信しています...");
    const response = await fetch("/api/password-reset-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    setBusy(false);
    if (!response.ok) {
      setStatus("送信に失敗しました。メールアドレスを確認してください。");
      return;
    }
    setStatus("パスワード再設定申請を受け付けました。運営の本人確認後、新しいパスワードを案内します。");
    setForm((current) => ({ ...current, application_id: "", streamer_id: "", viewer_id: "", note: "" }));
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
        <input id="reset_email" type="email" value={form.email} onChange={(event) => update("email", event.target.value)} required />
      </div>
      {form.user_type === "creator" ? (
        <>
          <div className="field">
            <label htmlFor="reset_application_id">申込IDまたは管理IDが分かる場合</label>
            <input id="reset_application_id" value={form.application_id} onChange={(event) => update("application_id", event.target.value)} placeholder="申込ID" />
          </div>
          <div className="field">
            <label htmlFor="reset_streamer_id">掲載IDが分かる場合</label>
            <input id="reset_streamer_id" value={form.streamer_id} onChange={(event) => update("streamer_id", event.target.value)} placeholder="掲載ID" />
          </div>
        </>
      ) : (
        <div className="field">
          <label htmlFor="reset_viewer_id">視聴者IDが分かる場合</label>
          <input id="reset_viewer_id" value={form.viewer_id} onChange={(event) => update("viewer_id", event.target.value)} placeholder="視聴者ID" />
        </div>
      )}
      <div className="field">
        <label htmlFor="reset_note">本人確認に使える補足</label>
        <textarea id="reset_note" value={form.note} onChange={(event) => update("note", event.target.value)} placeholder="チャンネル名、表示名、申し込み時期など" />
      </div>
      <p className="help-text">メール自動送信は行いません。運営が確認後、手動で新しいパスワードを案内します。</p>
      <button className="primary-button" type="submit" disabled={busy}>{busy ? "送信中..." : "再設定を申請する"}</button>
      {status && <p className="notice-text">{status}</p>}
    </form>
  );
}
