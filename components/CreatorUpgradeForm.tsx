"use client";

import { useEffect, useState } from "react";

export function CreatorUpgradeForm() {
  const [form, setForm] = useState({
    email: "",
    password: "",
    plan_type: "paid"
  });
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setForm((current) => ({
      ...current,
      email: localStorage.getItem("vtuber-match-creator-email") || ""
    }));
  }, []);

  function update(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus("本人確認中...");

    const verifyResponse = await fetch("/api/creator-upgrade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    const verified = await verifyResponse.json().catch(() => ({}));
    if (!verifyResponse.ok) {
      setBusy(false);
      setStatus(verified.error || "本人確認に失敗しました。");
      return;
    }

    setStatus("決済画面を準備しています...");
    const checkoutResponse = await fetch("/api/checkout/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        streamer_id: verified.streamer_id,
        application_id: verified.application_id,
        plan_type: verified.plan_type,
        payer_email: verified.payer_email
      })
    });
    const checkout = await checkoutResponse.json().catch(() => ({}));
    setBusy(false);
    if (!checkoutResponse.ok || !checkout.url) {
      setStatus(checkout.error || "決済画面を開けませんでした。");
      return;
    }
    window.location.assign(checkout.url);
  }

  return (
    <form className="form checkout-form" onSubmit={submit}>
      <div className="field">
        <label htmlFor="upgrade_email">ログイン用メールアドレス</label>
        <input id="upgrade_email" type="email" value={form.email} onChange={(event) => update("email", event.target.value)} required autoComplete="username" />
      </div>
      <div className="field">
        <label htmlFor="upgrade_password">パスワード</label>
        <input id="upgrade_password" type="password" value={form.password} onChange={(event) => update("password", event.target.value)} required autoComplete="current-password" />
      </div>
      <div className="field">
        <label htmlFor="plan">変更先プラン</label>
        <select id="plan" value={form.plan_type} onChange={(event) => update("plan_type", event.target.value)}>
          <option value="paid">有料掲載 500円</option>
          <option value="boost">さらに上位表示 980円</option>
        </select>
      </div>
      <p className="help-text">メールアドレスとパスワードで本人確認し、登録済みの掲載データに紐づけて決済へ進みます。掲載IDの入力は不要です。</p>
      <button className="primary-button" type="submit" disabled={busy}>{busy ? "確認中..." : "決済へ進む"}</button>
      {status && <p className="notice-text">{status}</p>}
    </form>
  );
}
