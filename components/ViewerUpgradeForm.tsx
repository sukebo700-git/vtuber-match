"use client";

import { useEffect, useState } from "react";
import { PLAN_FEATURES } from "@/lib/constants";

export function ViewerUpgradeForm() {
  const [viewerId, setViewerId] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const auth = safeParse(localStorage.getItem("vtuber-match-viewer-auth"));
    setViewerId(auth?.id || localStorage.getItem("vtuber-match-viewer-id") || "");
    setEmail(auth?.email || "");
  }, []);

  async function submit() {
    if (!viewerId) {
      setStatus("視聴者ログインが必要です。");
      return;
    }

    setBusy(true);
    setStatus("決済画面を準備しています...");
    const response = await fetch("/api/checkout/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        viewer_id: viewerId,
        plan_type: "viewer_paid",
        payer_email: email,
      }),
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);

    if (!response.ok || !data.url) {
      setStatus(data.error || "決済画面を開けませんでした。");
      return;
    }
    window.location.assign(data.url);
  }

  return (
    <section className="form checkout-form">
      <div className="plan-table">
        <article className="plan-card">
          <strong>無料枠</strong>
          <span className="plan-price">0円</span>
          <p>IDとして使う自身の名前とアイコンのみ登録できます。</p>
          <ul>
            <li>自身の名前</li>
            <li>アイコン画像</li>
          </ul>
        </article>

        <article className="plan-card selected">
          <strong>視聴者ブーストプラン</strong>
          <span className="plan-price">月額330円</span>
          <p>マッチした配信者へ応援情報を開示し、認知してもらいやすくします。</p>
          <ul>
            {PLAN_FEATURES.viewer_paid.map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
        </article>
      </div>

      <p className="help-text">
        決済はStripeの安全な画面で行います。カード情報はVtuberマッチでは保存しません。
      </p>
      <button className="primary-button" type="button" onClick={submit} disabled={busy}>
        {busy ? "準備中..." : "月額330円でアップグレード"}
      </button>
      {status && <p className="notice-text">{status}</p>}
    </section>
  );
}

function safeParse(value: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value) as { id?: string; email?: string };
  } catch {
    return null;
  }
}
