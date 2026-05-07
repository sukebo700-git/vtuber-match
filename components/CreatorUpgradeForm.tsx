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
      <section className="status-band">
        <h2>プランの違い</h2>
        <dl className="data-list">
          <div>
            <dt>有料掲載 500円</dt>
            <dd>無料掲載より上位に表示されやすくなり、公式バッジが付きます。カテゴリは最大3件、タグは最大5件まで選べます。</dd>
          </div>
          <div>
            <dt>さらに上位表示 980円</dt>
            <dd>有料掲載の内容に加えて、推しを探している視聴者の目に入りやすい掲載枠を強化します。</dd>
          </div>
        </dl>
      </section>

      <div className="field">
        <label htmlFor="upgrade_email">ログイン用メールアドレス</label>
        <input id="upgrade_email" type="email" value={form.email} onChange={(event) => update("email", event.target.value)} required autoComplete="username" />
      </div>

      <div className="field">
        <label htmlFor="upgrade_password">パスワード</label>
        <input id="upgrade_password" type="password" value={form.password} onChange={(event) => update("password", event.target.value)} required autoComplete="current-password" />
      </div>

      <div className="field">
        <label htmlFor="plan">変更先のプラン</label>
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
