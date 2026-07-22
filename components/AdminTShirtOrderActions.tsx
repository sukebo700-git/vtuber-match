"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  orderId: string;
  productionStatus: string;
  paymentStatus: string;
  trackingNumber?: string;
};

// 管理: 1注文分の出荷運用アクション。管理セッションcookieで認証される
// PATCH /api/admin/tshirt-orders/[id] を叩き、成功したら一覧を更新する。
export function AdminTShirtOrderActions({ orderId, productionStatus, paymentStatus, trackingNumber }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tracking, setTracking] = useState(trackingNumber || "");

  async function run(action: string, extra: Record<string, unknown> = {}) {
    if (busy) return;
    if (action === "cancelled" && !confirm("この注文をキャンセルします。よろしいですか？")) return;
    if (action === "mark_refunded" && !confirm("返金済みとして記録します（実際の返金はStripeで行ってください）。よろしいですか？")) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/tshirt-orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "操作に失敗しました。");
        setBusy(false);
        return;
      }
      router.refresh();
      // router.refresh() はサーバーコンポーネントを再取得する。busyは維持で二重押し防止。
    } catch {
      setError("通信エラーが発生しました。");
      setBusy(false);
    }
  }

  const refunded = paymentStatus === "refunded";
  const btn: React.CSSProperties = {
    padding: "4px 10px",
    fontSize: 12,
    borderRadius: 6,
    border: "1px solid #1e5bd6",
    background: "#fff",
    color: "#1e5bd6",
    cursor: busy ? "wait" : "pointer",
    whiteSpace: "nowrap",
  };
  const danger: React.CSSProperties = { ...btn, border: "1px solid #c0392b", color: "#c0392b" };

  return (
    <div style={{ display: "grid", gap: 6, minWidth: 180 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {productionStatus === "svg_generated" && !refunded && (
          <button style={btn} disabled={busy} onClick={() => run("cutting")}>カット開始</button>
        )}
        {productionStatus === "cutting" && !refunded && (
          <button style={btn} disabled={busy} onClick={() => run("cut_complete")}>カット完了</button>
        )}
        {productionStatus === "cut_complete" && !refunded && (
          <button style={btn} disabled={busy} onClick={() => run("packed")}>梱包完了</button>
        )}
        {productionStatus === "packed" && !refunded && (
          <button
            style={btn}
            disabled={busy}
            onClick={() => run("shipped", { trackingNumber: tracking })}
          >
            発送済みにする
          </button>
        )}
        {(productionStatus === "svg_generation_failed") && (
          <button style={btn} disabled={busy} onClick={() => run("regenerate")}>SVG再生成</button>
        )}
        {productionStatus !== "shipped" && productionStatus !== "cancelled" && (
          <button style={danger} disabled={busy} onClick={() => run("cancelled")}>キャンセル</button>
        )}
        {paymentStatus === "paid" && (
          <button style={danger} disabled={busy} onClick={() => run("mark_refunded")}>返金済みにする</button>
        )}
      </div>

      {productionStatus === "packed" && (
        <input
          type="text"
          value={tracking}
          onChange={(e) => setTracking(e.target.value)}
          placeholder="追跡番号（任意）"
          style={{ padding: "4px 8px", fontSize: 12, width: 160 }}
        />
      )}
      {productionStatus === "shipped" && trackingNumber && (
        <span style={{ fontSize: 12, color: "#555" }}>追跡: {trackingNumber}</span>
      )}
      {error && <span style={{ fontSize: 12, color: "#c0392b" }}>{error}</span>}
    </div>
  );
}
