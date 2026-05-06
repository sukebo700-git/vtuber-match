"use client";

import { useState } from "react";
import { CreditCard, ExternalLink } from "lucide-react";
import { PLAN_LABELS } from "@/lib/constants";
import type { PlanType } from "@/lib/types";

type CheckoutFormProps = {
  applicationId?: string;
  streamerId?: string;
  planType: Exclude<PlanType, "free">;
  amount: number;
  email: string;
  name: string;
};

const testPaymentEnabled = process.env.NEXT_PUBLIC_ENABLE_TEST_PAYMENT === "true";

export function CheckoutForm({ applicationId, streamerId, planType, amount, email, name }: CheckoutFormProps) {
  const [status, setStatus] = useState("");

  async function startCheckout() {
    setStatus("決済ページを準備しています...");
    const response = await fetch("/api/checkout/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        application_id: applicationId,
        streamer_id: streamerId,
        plan_type: planType,
        payer_email: email
      })
    });
    const data = await response.json();
    if (response.ok && data.url) {
      window.location.href = data.url;
      return;
    }
    setStatus(data.error || "決済ページを作成できませんでした。設定を確認してください。");
  }

  async function submitTestPayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("テスト決済処理中...");
    const response = await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        application_id: applicationId,
        streamer_id: streamerId,
        plan_type: planType,
        amount,
        payer_email: email
      })
    });

    if (response.ok) {
      setStatus("テスト決済が完了しました。運営確認後に掲載されます。");
      return;
    }
    const data = await response.json().catch(() => ({}));
    setStatus(data.error || "テスト決済に失敗しました。");
  }

  return (
    <section className="form checkout-form">
      <div className="checkout-summary">
        <div>
          <span>申込名</span>
          <strong>{name}</strong>
        </div>
        <div>
          <span>プラン</span>
          <strong>{PLAN_LABELS[planType]}</strong>
        </div>
        <div>
          <span>お支払い金額</span>
          <strong>{amount.toLocaleString("ja-JP")}円</strong>
        </div>
      </div>

      {testPaymentEnabled ? (
        <form className="checkout-fields" onSubmit={submitTestPayment}>
          <div className="field">
            <label htmlFor="card_name">カード名義</label>
            <input id="card_name" name="card_name" required placeholder="TARO YAMADA" />
          </div>
          <div className="field">
            <label htmlFor="card_number">カード番号</label>
            <input id="card_number" name="card_number" inputMode="numeric" required placeholder="4242 4242 4242 4242" maxLength={19} />
            <p className="help-text">テスト決済モードです。本番ではStripe Checkoutへ移動します。</p>
          </div>
          <div className="two-fields">
            <div className="field">
              <label htmlFor="expiry">有効期限</label>
              <input id="expiry" name="expiry" required placeholder="12/30" maxLength={5} />
            </div>
            <div className="field">
              <label htmlFor="cvc">CVC</label>
              <input id="cvc" name="cvc" inputMode="numeric" required placeholder="123" maxLength={4} />
            </div>
          </div>
          <button className="primary-button" type="submit">
            <CreditCard size={18} />
            テスト決済する
          </button>
        </form>
      ) : (
        <div className="checkout-fields">
          <p className="help-text">安全な外部決済ページで支払いを行います。カード情報はVtuberマッチでは保存しません。</p>
          <button className="primary-button" type="button" onClick={startCheckout}>
            <ExternalLink size={18} />
            決済ページへ進む
          </button>
        </div>
      )}
      {status && <p>{status}</p>}
    </section>
  );
}
