"use client";

import { AlertTriangle, CheckCircle2, CreditCard, LogOut } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type WithdrawalStatus = {
  application_id?: string;
  streamer_id?: string;
  plan_type?: string;
  subscription_status?: string;
  stripe_subscription_id?: string;
  withdrawal_status?: string;
};

export function WithdrawalForm() {
  const [status, setStatus] = useState<WithdrawalStatus | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    fetch("/api/withdrawal/status")
      .then((response) => response.ok ? response.json() : null)
      .then((data) => data && setStatus(data))
      .catch(() => undefined);
  }, []);

  const isPaid = useMemo(() => status?.plan_type === "paid" || status?.plan_type === "boost" || status?.subscription_status === "active", [status]);
  const alreadyCanceled = status?.subscription_status === "canceled" || !isPaid;
  const alreadyRequested = status?.withdrawal_status === "requested";

  async function cancelSubscription() {
    setBusy(true);
    setMessage("有料プランを解約しています...");
    const response = await fetch("/api/withdrawal/cancel-subscription", { method: "POST" });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setMessage(data.error || "有料プランの解約に失敗しました。時間をおいてもう一度お試しください。");
      return;
    }
    setStatus((current) => ({ ...(current || {}), subscription_status: "canceled", plan_type: "free" }));
    setMessage(data.warning ? "サイト側の有料プランを解約済みにしました。Stripe側の確認もお願いします。" : "有料プランを解約しました。続けて退会申請できます。");
  }

  async function withdraw() {
    setBusy(true);
    setMessage("退会申請を送信しています...");
    const response = await fetch("/api/withdrawal", { method: "POST" });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    setConfirmOpen(false);
    if (!response.ok) {
      setMessage(data.error || "退会申請に失敗しました。時間をおいてもう一度お試しください。");
      return;
    }
    setCompleted(true);
    setMessage(data.message || "退会申請を受け付けました");
    clearCreatorSessionCache();
    await fetch("/api/logout", { method: "POST" }).catch(() => undefined);
    window.setTimeout(() => {
      window.location.assign("/");
    }, 700);
  }

  if (completed || alreadyRequested) {
    return (
      <section className="status-band withdrawal-complete">
        <CheckCircle2 size={30} />
        <h2>退会申請を受け付けました</h2>
        <p>トップページへ移動します。</p>
      </section>
    );
  }

  return (
    <section className="form compact-form">
      <section className="status-band soft">
        <h2>退会申請</h2>
        <p>退会すると掲載はすぐに非表示になります。再度登録する場合は新規登録として扱われます。</p>
      </section>

      <section className="status-band">
        <h2>1. 有料プランの解約</h2>
        <p>有料プランをご利用中の場合は、退会前に月額プランを解約してください。解約後に退会申請へ進めます。</p>
        <button className="secondary-button" type="button" onClick={cancelSubscription} disabled={busy || alreadyCanceled}>
          <CreditCard size={18} />
          {alreadyCanceled ? "解約済み、または無料プラン" : "有料プランを解約する"}
        </button>
      </section>

      <section className="status-band">
        <h2>2. 退会申請</h2>
        <p>退会申請後、スワイプ画面とプロフィール詳細画面には表示されません。</p>
        <button className="danger-button" type="button" onClick={() => setConfirmOpen(true)} disabled={busy || !alreadyCanceled}>
          <LogOut size={18} />
          退会申請へ進む
        </button>
        {!alreadyCanceled && <p className="help-text">先に有料プランを解約してください。</p>}
      </section>

      {message && <p className="notice-text">{message}</p>}

      {confirmOpen && (
        <div className="like-choice-backdrop" role="dialog" aria-modal="true" aria-labelledby="withdrawal-confirm-title">
          <div className="like-choice-modal withdrawal-modal">
            <div className="like-choice-icon">
              <AlertTriangle size={28} />
            </div>
            <h2 id="withdrawal-confirm-title">退会時の注意点</h2>
            <p>退会申請をすると掲載は即時非表示になります。退会後はログアウトされます。</p>
            <p>有料プランの解約が済んでいることを確認してください。</p>
            <div className="like-choice-actions">
              <button className="secondary-button" type="button" onClick={() => setConfirmOpen(false)}>戻る</button>
              <button className="danger-button" type="button" onClick={withdraw} disabled={busy}>同意して退会申請</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function clearCreatorSessionCache() {
  try {
    Object.keys(localStorage)
      .filter((key) => key.startsWith("vtuber-match-creator") || key === "vtuber-match-session")
      .forEach((key) => localStorage.removeItem(key));
  } catch {
    // localStorage can be unavailable in private contexts.
  }
}
