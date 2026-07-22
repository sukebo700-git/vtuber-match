// Tシャツ注文のサーバー側処理。チェックアウト時のpending作成と、
// Webhook入金確定時のカット用SVG生成を担当する。サーバー(Node)専用。
import { FieldValue, stripUndefined } from "@/lib/firebaseAdmin";
import type {
  TShirtDesignSize,
  TShirtKitOrder,
  TShirtSheetColor,
  TShirtShirtColor,
  TShirtShirtSize,
} from "./types";
import { DESIGN_WIDTH_MM } from "./types";
import { calcTShirtTotal } from "./pricing";
import { getTShirtSettings } from "./config";
import { getFontConfig } from "./fonts";
import { generateCutSvg } from "./svg";
import { getAppUrl } from "@/lib/billing";

type Db = FirebaseFirestore.Firestore;

export type CreateOrderInput = {
  userId: string;
  inputText: string; // 正規化済みを想定
  fontId: string;
  designSize: TShirtDesignSize;
  shirtColor: TShirtShirtColor;
  shirtSize: TShirtShirtSize;
  sheetColor: TShirtSheetColor;
  quantity: number;
  rightsConfirmed: boolean;
  finalConfirmationAccepted: boolean;
  payerEmail?: string;
};

export type CreatedOrder = {
  orderId: string;
  orderNumber: string;
  totalAmount: number;
};

function pad4(n: number): string {
  return String(n).padStart(4, "0");
}

// VMK-YYYYMMDD-NNNN。日付ごとの連番を counter ドキュメントで採番する。
async function nextOrderNumber(db: Db): Promise<string> {
  const now = new Date();
  const ymd =
    `${now.getFullYear()}` +
    `${String(now.getMonth() + 1).padStart(2, "0")}` +
    `${String(now.getDate()).padStart(2, "0")}`;
  const counterRef = db.collection("tshirt_counters").doc(ymd);
  const seq = await db.runTransaction(async (tx) => {
    const doc = await tx.get(counterRef);
    const current = doc.exists ? Number(doc.data()?.count || 0) : 0;
    const next = current + 1;
    tx.set(counterRef, { count: next, updated_at: FieldValue.serverTimestamp() }, { merge: true });
    return next;
  });
  return `VMK-${ymd}-${pad4(seq)}`;
}

// チェックアウト作成時にpending注文を作る。金額はサーバーで再計算する（クライアントの値は信頼しない）。
export async function createPendingOrder(db: Db, input: CreateOrderInput): Promise<CreatedOrder> {
  const font = getFontConfig(input.fontId);
  if (!font) throw new Error(`unknown fontId: ${input.fontId}`);

  const settings = getTShirtSettings();
  const price = calcTShirtTotal({ quantity: input.quantity, sheetColor: input.sheetColor }, settings);

  const orderNumber = await nextOrderNumber(db);
  const orderRef = db.collection("orders").doc();

  const order: Omit<TShirtKitOrder, "id"> = {
    orderNumber,
    userId: input.userId,
    inputText: input.inputText,
    fontId: input.fontId,
    fontDisplayName: font.displayName,
    designSize: input.designSize,
    designWidthMm: DESIGN_WIDTH_MM[input.designSize],
    shirtColor: input.shirtColor,
    shirtSize: input.shirtSize,
    sheetColor: input.sheetColor,
    quantity: input.quantity,
    unitPrice: price.unitPrice,
    specialColorFeePerUnit: price.specialColorFeePerUnit,
    shippingFee: price.shippingFee,
    totalAmount: price.total,
    rightsConfirmed: input.rightsConfirmed,
    finalConfirmationAccepted: input.finalConfirmationAccepted,
    paymentStatus: "pending",
    productionStatus: "waiting",
    payerEmail: input.payerEmail || "",
  };

  await orderRef.set(
    stripUndefined({
      ...order,
      order_type: "tshirt_kit",
      createdAt: FieldValue.serverTimestamp(),
    }),
    { merge: true },
  );

  // 容量削減のためプレビューPNGはFirestoreに保存しない（クライアント表示のみ）。
  // 保存するのは入金確定後に生成する軽量なカットSVGテキストだけにする。

  return { orderId: orderRef.id, orderNumber, totalAmount: price.total };
}

// Webhookで入金確定時に呼ぶ。注文をpaidにし、カット用SVG(通常/ミラー)を生成して保存する。
// 生成に失敗しても入金記録は残し、productionStatusでリカバリ可能にする。
export type ShippingDetails = {
  name?: string;
  phone?: string;
  postalCode?: string;
  state?: string;
  city?: string;
  line1?: string;
  line2?: string;
  country?: string;
};

// カット用SVG(通常/ミラー)を生成し assets ドキュメントへ保存する。
// paid時と管理者による再生成の両方から使う共通処理。失敗時は false を返す。
async function generateAndStoreAssets(
  db: Db,
  orderId: string,
  data: FirebaseFirestore.DocumentData,
): Promise<{ ok: boolean }> {
  try {
    const size = String(data.designSize || "M") as TShirtDesignSize;
    const text = String(data.inputText || "");
    const fontId = String(data.fontId || "");
    const normal = generateCutSvg({ text, fontId, size, mirror: false });
    const mirror = generateCutSvg({ text, fontId, size, mirror: true });
    await db.collection("tshirt_order_assets").doc(orderId).set(
      stripUndefined({
        orderId,
        svgNormal: normal.svg,
        svgMirror: mirror.svg,
        generatedAt: FieldValue.serverTimestamp(),
      }),
      { merge: true },
    );
    return { ok: true };
  } catch (error) {
    console.error("tshirt SVG generation failed", {
      orderId,
      message: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false };
  }
}

export async function markOrderPaidAndGenerateAssets(
  db: Db,
  args: {
    orderId: string;
    sessionId: string;
    paymentIntentId?: string;
    payerEmail?: string;
    shipping?: ShippingDetails;
  },
): Promise<void> {
  const orderRef = db.collection("orders").doc(args.orderId);
  const snap = await orderRef.get();
  if (!snap.exists) {
    console.error("tshirt order not found for paid webhook", { orderId: args.orderId });
    return;
  }
  const data = snap.data() || {};

  // 既にpaid処理済みなら二重処理しない（stripe_events冪等化に加えた保険）。
  if (data.paymentStatus === "paid" && data.productionStatus === "svg_generated") return;
  // 返金・キャンセル済みの注文にpaid通知が遅れて届いても状態を巻き戻さない。
  if (data.paymentStatus === "refunded" || data.productionStatus === "cancelled") return;

  const gen = await generateAndStoreAssets(db, args.orderId, data);
  const generationFailed = !gen.ok;

  const appUrl = getAppUrl();
  const assetBase = `${appUrl}/api/admin/tshirt-orders/${args.orderId}/svg`;

  const ship = args.shipping || {};
  await orderRef.set(
    stripUndefined({
      paymentStatus: "paid",
      productionStatus: generationFailed ? "svg_generation_failed" : "svg_generated",
      providerSessionId: args.sessionId,
      providerPaymentIntentId: args.paymentIntentId || undefined,
      payerEmail: args.payerEmail || data.payerEmail || "",
      shippingName: ship.name || undefined,
      shippingPhone: ship.phone || undefined,
      shippingPostalCode: ship.postalCode || undefined,
      shippingState: ship.state || undefined,
      shippingCity: ship.city || undefined,
      shippingLine1: ship.line1 || undefined,
      shippingLine2: ship.line2 || undefined,
      shippingCountry: ship.country || undefined,
      svgNormalUrl: generationFailed ? undefined : `${assetBase}?variant=normal`,
      svgMirrorUrl: generationFailed ? undefined : `${assetBase}?variant=mirror`,
      paidAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }),
    { merge: true },
  );
}

// Stripe Checkoutセッションが期限切れ（未決済のまま）になったpending注文を整理する。
export async function markOrderExpired(db: Db, orderId: string): Promise<void> {
  if (!orderId) return;
  const orderRef = db.collection("orders").doc(orderId);
  const snap = await orderRef.get();
  if (!snap.exists) return;
  const data = snap.data() || {};
  // 既に支払い済み/返金済みなら触らない（期限切れは未決済のpendingだけが対象）。
  if (data.paymentStatus === "paid" || data.paymentStatus === "refunded") return;
  await orderRef.set(
    {
      paymentStatus: "failed",
      productionStatus: "cancelled",
      canceledReason: "checkout_expired",
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

// Stripeで返金された注文を paymentStatus:refunded にする（payment_intentで突合）。
export async function markOrderRefundedByPaymentIntent(db: Db, paymentIntentId: string): Promise<boolean> {
  if (!paymentIntentId) return false;
  const query = await db
    .collection("orders")
    .where("order_type", "==", "tshirt_kit")
    .where("providerPaymentIntentId", "==", paymentIntentId)
    .limit(1)
    .get();
  const doc = query.docs[0];
  if (!doc) return false;
  await doc.ref.set(
    {
      paymentStatus: "refunded",
      refundedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  return true;
}

// 管理者の出荷運用アクション。状態遷移を検証してから適用する。
export type AdminOrderAction =
  | "cutting"
  | "cut_complete"
  | "packed"
  | "shipped"
  | "cancelled"
  | "regenerate"
  | "mark_refunded";

// productionStatus の許可遷移（前→後）。
const PRODUCTION_TRANSITIONS: Record<string, string> = {
  cutting: "svg_generated",
  cut_complete: "cutting",
  packed: "cut_complete",
  shipped: "packed",
};

export type AdminActionResult = { ok: boolean; error?: string; status?: number };

export async function applyAdminOrderAction(
  db: Db,
  orderId: string,
  action: AdminOrderAction,
  opts: { trackingNumber?: string; shippingMethod?: string } = {},
): Promise<AdminActionResult> {
  const orderRef = db.collection("orders").doc(orderId);
  const snap = await orderRef.get();
  if (!snap.exists || String(snap.data()?.order_type || "") !== "tshirt_kit") {
    return { ok: false, error: "order not found", status: 404 };
  }
  const data = snap.data() || {};
  const current = String(data.productionStatus || "");

  // 支払い前は出荷系の操作を許可しない（キャンセルのみ可）。
  if (action !== "cancelled" && action !== "mark_refunded" && data.paymentStatus !== "paid") {
    return { ok: false, error: "未入金の注文には操作できません。", status: 409 };
  }

  if (action === "regenerate") {
    const gen = await generateAndStoreAssets(db, orderId, data);
    const appUrl = getAppUrl();
    const assetBase = `${appUrl}/api/admin/tshirt-orders/${orderId}/svg`;
    await orderRef.set(
      stripUndefined({
        productionStatus: gen.ok ? "svg_generated" : "svg_generation_failed",
        svgNormalUrl: gen.ok ? `${assetBase}?variant=normal` : undefined,
        svgMirrorUrl: gen.ok ? `${assetBase}?variant=mirror` : undefined,
        updatedAt: FieldValue.serverTimestamp(),
      }),
      { merge: true },
    );
    return gen.ok ? { ok: true } : { ok: false, error: "SVG再生成に失敗しました。", status: 500 };
  }

  if (action === "cancelled") {
    if (current === "shipped") return { ok: false, error: "発送済みはキャンセルできません。", status: 409 };
    await orderRef.set(
      { productionStatus: "cancelled", canceledReason: "admin", updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    return { ok: true };
  }

  if (action === "mark_refunded") {
    // 実際の返金操作はStripeダッシュボードで行う。ここは記録のみ。
    await orderRef.set(
      { paymentStatus: "refunded", refundedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    return { ok: true };
  }

  // 通常の製造フロー遷移。
  const required = PRODUCTION_TRANSITIONS[action];
  if (current !== required) {
    return { ok: false, error: `現在の状態(${current || "なし"})からは実行できません。`, status: 409 };
  }
  await orderRef.set(
    stripUndefined({
      productionStatus: action,
      trackingNumber: action === "shipped" ? (opts.trackingNumber || undefined) : undefined,
      shippingMethod: action === "shipped" ? (opts.shippingMethod || undefined) : undefined,
      shippedAt: action === "shipped" ? FieldValue.serverTimestamp() : undefined,
      updatedAt: FieldValue.serverTimestamp(),
    }),
    { merge: true },
  );
  return { ok: true };
}
