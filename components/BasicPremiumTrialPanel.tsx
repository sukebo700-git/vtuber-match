"use client";

import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";

type TrialState = {
  plan_type: "free" | "paid" | "boost";
  payment_state?: "active" | "past_due";
  basic_premium_trial_until?: string;
  basic_premium_trial_last_month?: string;
  active: boolean;
  used_this_month: boolean;
};

export function BasicPremiumTrialPanel() {
  const [trial, setTrial] = useState<TrialState | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/basic-premium-trial")
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (data?.trial) setTrial(data.trial);
      })
      .catch(() => undefined);
  }, []);

  const remaining = useMemo(() => formatRemaining(trial?.basic_premium_trial_until), [trial?.basic_premium_trial_until]);
  const isBasic = trial?.plan_type === "paid";
  const disabled = !isBasic || Boolean(trial?.used_this_month) || busy;

  async function activate() {
    setBusy(true);
    setStatus("");
    const response = await fetch("/api/basic-premium-trial", { method: "POST" });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setStatus(data.error || "プレミアム体験を開始できませんでした。");
      return;
    }
    setTrial(data.trial);
    setStatus("72時間のプレミアム体験を開始しました。");
  }

  if (!trial || trial.plan_type === "free" || trial.plan_type === "boost") {
    return trial?.payment_state === "past_due" ? (
      <section className="status-band warning-band">
        <p>お支払いを確認できませんでした。カード情報をご確認ください。</p>
      </section>
    ) : null;
  }

  return (
    <section className="status-band">
      {trial.payment_state === "past_due" && (
        <p className="notice-text">お支払いを確認できませんでした。カード情報をご確認ください。</p>
      )}
      <h2><Sparkles size={20} /> 今月のプレミアム体験</h2>
      {trial.active ? (
        <p>プレミアム相当の上位表示と特別フレームが有効です。残り時間: {remaining}</p>
      ) : (
        <p>ベーシックプランは月1回、72時間だけプレミアム相当の上位表示と特別フレームを使えます。</p>
      )}
      <button className="primary-button" type="button" disabled={disabled} onClick={activate}>
        {busy ? "開始中..." : trial.used_this_month ? "今月は使用済み" : "今月のプレミアム体験を使う"}
      </button>
      {trial.used_this_month && !trial.active && <p>次回は来月また利用できます。</p>}
      {status && <p>{status}</p>}
    </section>
  );
}

function formatRemaining(value?: string) {
  if (!value) return "終了";
  const diff = Date.parse(value) - Date.now();
  if (!Number.isFinite(diff) || diff <= 0) return "終了";
  const hours = Math.floor(diff / (60 * 60 * 1000));
  const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
  return `${hours}時間${minutes}分`;
}
