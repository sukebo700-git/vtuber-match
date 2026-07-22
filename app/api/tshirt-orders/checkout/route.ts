import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { getAppUrl } from "@/lib/billing";
import { creatorSessionCookie, readUserSession } from "@/lib/userSession";
import { getTShirtSettings } from "@/lib/tshirt/config";
import { calcTShirtTotal } from "@/lib/tshirt/pricing";
import { getFontConfig } from "@/lib/tshirt/fonts";
import { createPendingOrder } from "@/lib/tshirt/orders";
import {
  isSameColorConflict,
  isSizeAllowedForFont,
  validateInputText,
} from "@/lib/tshirt/validation";
import {
  AVAILABLE_SHEET_COLORS,
  AVAILABLE_SHIRT_COLORS,
  AVAILABLE_SHIRT_SIZES,
} from "@/lib/tshirt/config";
import type {
  TShirtDesignSize,
  TShirtSheetColor,
  TShirtShirtColor,
  TShirtShirtSize,
} from "@/lib/tshirt/types";

export const dynamic = "force-dynamic";

type CreatorSession = {
  email?: string;
  application_id?: string;
  streamer_id?: string;
  creator_login_id?: string;
};

const SIZES: TShirtDesignSize[] = ["S", "M", "L"];

export async function POST(request: Request) {
  // 販売対象は配信者本人のみ（仕様書2.2）。配信者セッション必須。
  const session = readUserSession<CreatorSession>(request, creatorSessionCookie);
  if (!session?.email && !session?.streamer_id && !session?.application_id && !session?.creator_login_id) {
    return NextResponse.json({ error: "配信者ログインが必要です。" }, { status: 401 });
  }

  const settings = getTShirtSettings();
  if (!settings.enabled) {
    return NextResponse.json({ error: "現在この商品は受付を停止しています。" }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));

  // --- サーバー側バリデーション（クライアントと同じ純粋関数を使用） ---
  const textResult = validateInputText(String(body.inputText || ""));
  if (!textResult.ok) return NextResponse.json({ error: textResult.error }, { status: 400 });
  const inputText = textResult.value;

  const fontId = String(body.fontId || "");
  const font = getFontConfig(fontId);
  if (!font) return NextResponse.json({ error: "フォントの指定が正しくありません。" }, { status: 400 });

  const designSize = String(body.designSize || "") as TShirtDesignSize;
  if (!SIZES.includes(designSize)) {
    return NextResponse.json({ error: "デザインサイズの指定が正しくありません。" }, { status: 400 });
  }
  if (!isSizeAllowedForFont(font, designSize, inputText.length)) {
    return NextResponse.json(
      { error: "選択したフォントではこのサイズを選べません。" },
      { status: 400 },
    );
  }

  const shirtColor = String(body.shirtColor || "") as TShirtShirtColor;
  if (!AVAILABLE_SHIRT_COLORS.includes(shirtColor)) {
    return NextResponse.json({ error: "Tシャツ色の指定が正しくありません。" }, { status: 400 });
  }
  const shirtSize = String(body.shirtSize || "") as TShirtShirtSize;
  if (!AVAILABLE_SHIRT_SIZES.includes(shirtSize)) {
    return NextResponse.json({ error: "Tシャツサイズの指定が正しくありません。" }, { status: 400 });
  }
  const sheetColor = String(body.sheetColor || "") as TShirtSheetColor;
  if (!AVAILABLE_SHEET_COLORS.includes(sheetColor)) {
    return NextResponse.json({ error: "シート色の指定が正しくありません。" }, { status: 400 });
  }
  if (isSameColorConflict(shirtColor, sheetColor)) {
    return NextResponse.json(
      { error: "Tシャツと同色のシートは選択できません。" },
      { status: 400 },
    );
  }

  const quantity = Math.floor(Number(body.quantity) || 0);
  if (!(quantity >= 1) || quantity > settings.maxQuantity) {
    return NextResponse.json(
      { error: `数量は1〜${settings.maxQuantity}着で指定してください。` },
      { status: 400 },
    );
  }

  const rightsConfirmed = body.rightsConfirmed === true;
  const finalConfirmationAccepted = body.finalConfirmationAccepted === true;
  if (!rightsConfirmed || !finalConfirmationAccepted) {
    return NextResponse.json({ error: "確認事項へのチェックが必要です。" }, { status: 400 });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json({ error: "決済が設定されていません。" }, { status: 501 });
  }

  const db = getAdminDb();
  if (!db) {
    return NextResponse.json({ error: "データベースが利用できません。" }, { status: 503 });
  }

  const userId = String(
    session.streamer_id || session.application_id || session.creator_login_id || session.email || "",
  );
  const payerEmail = String(body.payerEmail || session.email || "");

  // 金額はサーバーで再計算（createPendingOrder内でも計算）。
  const price = calcTShirtTotal({ quantity, sheetColor }, settings);

  const created = await createPendingOrder(db, {
    userId,
    inputText,
    fontId,
    designSize,
    shirtColor,
    shirtSize,
    sheetColor,
    quantity,
    rightsConfirmed,
    finalConfirmationAccepted,
    payerEmail,
  });

  // Stripe Checkout（mode=payment・動的金額）。既存 checkout/session と同じ生fetch方式。
  const appUrl = getAppUrl();
  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("line_items[0][price_data][currency]", "jpy");
  params.set("line_items[0][price_data][product_data][name]", "VTuberオリジナルネームTシャツ作成キット");
  params.set("line_items[0][price_data][unit_amount]", String(price.total));
  params.set("line_items[0][quantity]", "1");
  params.set("success_url", `${appUrl}/checkout/success?role=creator&notify=1&session_id={CHECKOUT_SESSION_ID}`);
  params.set("cancel_url", `${appUrl}/creator/tshirt?canceled=1`);
  // 物理商品のため配送先住所と電話番号を必須収集する（日本国内）。
  params.set("shipping_address_collection[allowed_countries][0]", "JP");
  params.set("phone_number_collection[enabled]", "true");
  // 注文確認メールはStripeの決済レシート（Stripeダッシュボードの「メールでレシートを送信」を
  // 有効化）でまかなう。独自の注文確認メール送信は課金・依存を増やすため現時点では未実装。
  params.set("metadata[order_type]", "tshirt_kit");
  params.set("metadata[tshirt_order_id]", created.orderId);
  params.set("metadata[order_number]", created.orderNumber);
  params.set("metadata[payer_email]", payerEmail);
  if (payerEmail) params.set("customer_email", payerEmail);

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });
  const stripeSession = await response.json();
  if (!response.ok) {
    return NextResponse.json(
      { error: stripeSession.error?.message || "決済の開始に失敗しました。" },
      { status: 502 },
    );
  }

  return NextResponse.json({
    url: stripeSession.url,
    orderNumber: created.orderNumber,
    total: created.totalAmount,
  });
}
