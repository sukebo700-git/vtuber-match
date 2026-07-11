"use client";

import { useEffect, useState } from "react";
import { PLAN_FEATURES } from "@/lib/constants";
import { LofiPlanBenefits } from "@/components/LofiPlanBenefits";

export function CreatorUpgradeForm() {
  const [form, setForm] = useState({
    email: "",
    password: "",
    plan_type: "paid",
  });
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setForm((current) => ({
      ...current,
      email: localStorage.getItem("vtuber-match-creator-email") || "",
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
      body: JSON.stringify({
        ...form,
        application_id: localStorage.getItem("vtuber-match-creator-application-id") || "",
        streamer_id: localStorage.getItem("vtuber-match-creator-streamer-id") || "",
        creator_login_id: localStorage.getItem("vtuber-match-creator-login-id") || "",
      }),
    });
    const verified = await verifyResponse.json().catch(() => ({}));
    if (!verifyResponse.ok) {
      setBusy(false);
      setStatus(verified.error || "本人確認に失敗しました。メールアドレスとパスワードを確認してください。");
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
        payer_email: verified.payer_email,
      }),
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
        <h2>配信者プラン</h2>
        <div className="plan-table">
          <article className="plan-card">
            <strong>無料プラン</strong>
            <span className="plan-price">0円</span>
            <p>まずは掲載を始めたい方向け。基本プロフィールを登録できます。</p>
            <ul>
              {PLAN_FEATURES.free.map((feature) => <li key={feature}>{feature}</li>)}
            </ul>
            <LofiPlanBenefits planId="registered" />
          </article>

          <article className={`plan-card ${form.plan_type === "paid" ? "selected" : ""}`} onClick={() => update("plan_type", "paid")}>
            <strong>ベーシックプラン</strong>
            <span className="plan-price">月額500円</span>
            <p>無料プランより上位に表示され、公式チャンネルでの紹介枠も広がります。</p>
            <ul>
              {PLAN_FEATURES.paid.map((feature) => <li key={feature}>{feature}</li>)}
            </ul>
            <LofiPlanBenefits planId="paid" />
          </article>

          <article className={`plan-card ${form.plan_type === "boost" ? "selected" : ""}`} onClick={() => update("plan_type", "boost")}>
            <strong>プレミアムプラン</strong>
            <span className="plan-price">月額980円</span>
            <p>さらに目立たせたい方向け。常時優先表示を利用できます。</p>
            <ul>
              {PLAN_FEATURES.boost.map((feature) => <li key={feature}>{feature}</li>)}
            </ul>
            <LofiPlanBenefits planId="boost" />
          </article>
        </div>
      </section>

      {form.plan_type === "boost" && (
        <p className="notice-text">
          すでにベーシックプランをご利用中の場合は、差額480円のプランで決済できます。
        </p>
      )}

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
          <option value="paid">ベーシックプラン 月額500円</option>
          <option value="boost">プレミアムプラン 月額980円</option>
        </select>
      </div>

      <button className="primary-button" type="submit" disabled={busy}>
        {busy ? "確認中..." : "決済へ進む"}
      </button>
      {status && <p className="notice-text">{status}</p>}
    </form>
  );
}
