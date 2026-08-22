"use client";

import { useEffect, useState } from "react";
import { getViewerIdentity } from "@/lib/viewerIdentity";

type Status = "loading" | "ready" | "elite";

export function ViewerUpgradeForm() {
  const [status, setStatus] = useState<Status>("loading");
  const [validUntil, setValidUntil] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [isRegistered, setIsRegistered] = useState(false);

  useEffect(() => {
    const identity = getViewerIdentity();
    setIsRegistered(identity.registered);
    if (!identity.registered) {
      // 未登録でも説明・料金は見せる(購入ボタンを押した時点でログインへ誘導する)。
      setStatus("ready");
      return;
    }
    fetch(`/api/viewer-profile?id=${encodeURIComponent(identity.id)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data?.profile?.entitlement_tier === "elite") {
          setStatus("elite");
          setValidUntil(data.profile.entitlement_valid_until || "");
        } else {
          setStatus("ready");
        }
      })
      .catch(() => setStatus("ready"));
  }, []);

  async function cancel() {
    if (!window.confirm("エリートファンを解約しますか？解約すると即座に無料登録の状態に戻ります。")) return;
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/viewer-cancel-subscription", { method: "POST" });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setMessage(data.error || "解約できませんでした。時間をおいて再度お試しください。");
      return;
    }
    setStatus("ready");
    setMessage("解約しました。");
  }

  async function checkout() {
    const identity = getViewerIdentity();
    if (!identity.registered) {
      window.location.assign(`/viewer/login?next=${encodeURIComponent("/viewer/upgrade")}`);
      return;
    }
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/checkout/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        viewer_id: identity.id,
        payer_email: identity.auth?.email || "",
        plan_type: "elite_fan",
      }),
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (response.ok && data.url) {
      window.location.assign(data.url);
      return;
    }
    setMessage(data.error || "購入画面を開けませんでした。時間をおいて再度お試しください。");
  }

  if (status === "loading") return <p className="help-text">読み込んでいます...</p>;

  if (status === "elite") {
    return (
      <section className="status-band">
        <h2>すでにエリートファンです</h2>
        <p>マッチ履歴の無制限閲覧・VTuberからのいいね確認・広告非表示が有効になっています。</p>
        {validUntil && (
          <p className="help-text">
            次回更新日: {new Date(validUntil).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })}
          </p>
        )}
        <p className="inline-actions" style={{ marginTop: 12 }}>
          <button className="secondary-button" type="button" disabled={busy} onClick={cancel}>
            {busy ? "処理中..." : "解約する"}
          </button>
        </p>
        {message && <p className="help-text">{message}</p>}
      </section>
    );
  }

  return (
    <section className="status-band">
      <h2 style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" }}>
        エリートファン 月額500円
      </h2>
      <picture>
        <source srcSet="/promo/elite-fan/elite-fan.webp" type="image/webp" />
        <img
          src="/promo/elite-fan/elite-fan.jpg"
          alt="エリートファン 月額500円。マッチ履歴を無制限に閲覧できます(未登録は最新1件、無料登録は最新5件まで)。VTuberからいいねが届いたとき、送信元・件数を確認できます。スワイプ中の広告が表示されなくなります。いつでも解約できます。解約すると即座に無料登録の状態に戻ります。"
          className="viewer-upgrade-plan-image"
          loading="eager"
        />
      </picture>
      <p className="inline-actions" style={{ marginTop: 12 }}>
        <button className="primary-button" type="button" disabled={busy} onClick={checkout}>
          {busy ? "処理中..." : "エリートファンになる(月額500円)"}
        </button>
      </p>
      {message && <p className="help-text">{message}</p>}
      {!isRegistered && (
        <p className="help-text">購入には視聴者ログイン(無料登録)が必要です。ボタンを押すとログイン画面へ移動します。</p>
      )}
      <p className="help-text">いつでも解約できます。解約すると即座に無料登録の状態に戻ります。</p>
    </section>
  );
}
