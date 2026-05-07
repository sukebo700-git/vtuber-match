"use client";

import { useEffect, useState } from "react";
import { PLAN_FEATURES } from "@/lib/constants";

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
    setStatus("本人確認中です...");

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
        current_plan: verified.current_plan,
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
        <div className="plan-table">
          <article className="plan-card">
            <strong>無料掲載</strong>
            <span className="plan-price">0円</span>
            <p>写真、名前、YouTubeチャンネルURLのみのシンプル掲載です。</p>
            <ul>
              {PLAN_FEATURES.free.map((feature) => <li key={feature}>{feature}</li>)}
            </ul>
          </article>
          <article className={`plan-card ${form.plan_type === "paid" ? "selected" : ""}`} onClick={() => update("plan_type", "paid")}>
            <strong>有料掲載</strong>
            <span className="plan-price">月額500円</span>
            <p>無料掲載より上位に表示され、スワイプ画面で魅力を伝えやすくなります。</p>
            <ul>
              {PLAN_FEATURES.paid.map((feature) => <li key={feature}>{feature}</li>)}
            </ul>
          </article>
          <article className={`plan-card ${form.plan_type === "boost" ? "selected" : ""}`} onClick={() => update("plan_type", "boost")}>
            <strong>プレミアムプラン</strong>
            <span className="plan-price">月額980円 / 有料掲載中は追加480円</span>
            <p>有料掲載の内容に加え、プロフィールでおすすめアーカイブを見せられます。</p>
            <ul>
              {PLAN_FEATURES.boost.map((feature) => <li key={feature}>{feature}</li>)}
            </ul>
          </article>
        </div>
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
          <option value="boost">プレミアムプラン 980円</option>
        </select>
        <p className="help-text">すでに有料掲載500円に加入中の方がプレミアムへ変更する場合は、追加480円の価格IDを設定していれば差額プランで決済できます。</p>
      </div>

      <button className="primary-button" type="submit" disabled={busy}>{busy ? "確認中..." : "決済へ進む"}</button>
      {status && <p className="notice-text">{status}</p>}
    </form>
  );
}
