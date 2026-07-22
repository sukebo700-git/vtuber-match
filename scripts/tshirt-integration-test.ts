/**
 * Tシャツ注文フローの統合テスト（インメモリFirestoreスタブ・本番書き込みなし）。
 * 実行: npx tsx scripts/tshirt-integration-test.ts
 *
 * createPendingOrder → 入金(markOrderPaidAndGenerateAssets) → SVG生成 → 配送先保存
 * → 管理アクション(状態遷移/追跡番号/キャンセル/返金印/再生成) → 期限切れ/返金Webhook
 * を実コードで検証する。境界・異常・冪等・巻き戻し防止も網羅する。
 */
import {
  createPendingOrder,
  markOrderPaidAndGenerateAssets,
  markOrderExpired,
  markOrderRefundedByPaymentIntent,
  applyAdminOrderAction,
} from "../lib/tshirt/orders";
import { calcTShirtTotal } from "../lib/tshirt/pricing";
import type { CreateOrderInput } from "../lib/tshirt/orders";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) {
    pass++;
  } else {
    fail++;
    console.log(`FAIL: ${name}`, extra !== undefined ? extra : "");
  }
}

// ── インメモリFirestoreスタブ ────────────────────────────────────────────────
type Doc = { id: string; data: Record<string, any> | undefined };

function isSentinel(v: any) {
  return v && typeof v === "object" && (v.constructor?.name === "FieldValue" || typeof v.toDate === "function");
}
function applyMerge(target: Record<string, any>, patch: Record<string, any>) {
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    // serverTimestamp等のsentinelは固定文字列に置換して検証を単純化。
    target[k] = isSentinel(v) ? "<ts>" : v;
  }
}

class FakeStore {
  cols: Record<string, Map<string, Record<string, any>>> = {};
  seq = 0;
  private col(name: string) {
    return (this.cols[name] ||= new Map());
  }
  collection(name: string) {
    const store = this;
    const col = this.col(name);
    const makeQuery = (filters: [string, string, any][], limitN: number | null) => ({
      where(field: string, _op: string, value: any) {
        return makeQuery([...filters, [field, _op, value]], limitN);
      },
      limit(n: number) {
        return makeQuery(filters, n);
      },
      async get() {
        let docs = Array.from(col.entries()).map(([id, data]) => ({ id, data }));
        for (const [f, , val] of filters) docs = docs.filter((d) => d.data[f] === val);
        if (limitN != null) docs = docs.slice(0, limitN);
        return {
          docs: docs.map(({ id, data }) => ({ id, ref: store.docRef(name, id), exists: true, data: () => data })),
        };
      },
    });
    return {
      doc: (id?: string) => store.docRef(name, id),
      where: (field: string, op: string, value: any) => makeQuery([[field, op, value]], null),
    };
  }
  docRef(colName: string, id?: string) {
    const col = this.col(colName);
    const realId = id || `auto_${++this.seq}`;
    const store = this;
    return {
      id: realId,
      async get() {
        const data = col.get(realId);
        return { exists: data !== undefined, id: realId, ref: store.docRef(colName, realId), data: () => data };
      },
      async set(data: Record<string, any>, opts?: { merge?: boolean }) {
        const existing = opts?.merge ? col.get(realId) || {} : {};
        const next = { ...existing };
        applyMerge(next, data);
        col.set(realId, next);
      },
    };
  }
  async runTransaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
    const tx = {
      get: (ref: any) => ref.get(),
      set: (ref: any, data: any, opts?: any) => ref.set(data, opts),
    };
    return fn(tx);
  }
  get(col: string, id: string) {
    return this.col(col).get(id);
  }
}

const baseInput = (over: Partial<CreateOrderInput> = {}): CreateOrderInput => ({
  userId: "streamer_1",
  inputText: "Mika Fam",
  fontId: "anton",
  designSize: "M",
  shirtColor: "white",
  shirtSize: "XL",
  sheetColor: "black",
  quantity: 1,
  rightsConfirmed: true,
  finalConfirmationAccepted: true,
  payerEmail: "mika@example.com",
  ...over,
});

async function main() {
  // ── 1. createPendingOrder ──
  {
    const db = new FakeStore() as any;
    const created = await createPendingOrder(db, baseInput({ quantity: 2, sheetColor: "gold" }));
    const order = db.get("orders", created.orderId);
    check("注文番号フォーマット", /^VMK-\d{8}-0001$/.test(created.orderNumber), created.orderNumber);
    check("pending/waiting初期状態", order.paymentStatus === "pending" && order.productionStatus === "waiting");
    check("order_type保存", order.order_type === "tshirt_kit");
    const price = calcTShirtTotal({ quantity: 2, sheetColor: "gold" });
    check("合計がサーバー計算と一致", order.totalAmount === price.total && created.totalAmount === price.total, order.totalAmount);
    check("特殊色単価保存", order.specialColorFeePerUnit === 300);

    const second = await createPendingOrder(db, baseInput());
    check("連番が加算される", /^VMK-\d{8}-0002$/.test(second.orderNumber), second.orderNumber);
  }

  // ── 2. 入金 → SVG生成 → 配送先保存 ──
  {
    const db = new FakeStore() as any;
    const created = await createPendingOrder(db, baseInput());
    await markOrderPaidAndGenerateAssets(db, {
      orderId: created.orderId,
      sessionId: "cs_test_1",
      paymentIntentId: "pi_test_1",
      payerEmail: "mika@example.com",
      shipping: { name: "宮乃 みか", phone: "09000000000", postalCode: "1500001", state: "東京都", city: "渋谷区", line1: "1-2-3", country: "JP" },
    });
    const order = db.get("orders", created.orderId);
    const asset = db.get("tshirt_order_assets", created.orderId);
    check("paid/svg_generated", order.paymentStatus === "paid" && order.productionStatus === "svg_generated", order.productionStatus);
    check("payment_intent保存", order.providerPaymentIntentId === "pi_test_1");
    check("配送先保存(氏名/郵便/都道府県/番地)", order.shippingName === "宮乃 みか" && order.shippingPostalCode === "1500001" && order.shippingState === "東京都" && order.shippingLine1 === "1-2-3");
    check("SVG URL付与", typeof order.svgMirrorUrl === "string" && order.svgMirrorUrl.includes("variant=mirror"));
    check("asset:通常SVGが有効", typeof asset.svgNormal === "string" && asset.svgNormal.startsWith("<svg") && asset.svgNormal.endsWith("</svg>"));
    check("asset:ミラーSVGが反転", asset.svgMirror.includes("scale(-1 1)"));
    check("SVGにユーザー文字列を含まない(XSS)", !asset.svgNormal.includes("Mika") && !asset.svgMirror.includes("Mika"));

    // 冪等: 再度paid → クラッシュせず状態維持
    await markOrderPaidAndGenerateAssets(db, { orderId: created.orderId, sessionId: "cs_test_1", paymentIntentId: "pi_test_1" });
    check("paid冪等(状態維持)", db.get("orders", created.orderId).productionStatus === "svg_generated");
  }

  // ── 3. SVG生成失敗パス(不正fontId) ──
  {
    const db = new FakeStore() as any;
    const created = await createPendingOrder(db, baseInput());
    // 不正fontIdへ書き換えてから入金 → 生成失敗
    (db.get("orders", created.orderId)).fontId = "nonexistent-font";
    await markOrderPaidAndGenerateAssets(db, { orderId: created.orderId, sessionId: "cs_x", paymentIntentId: "pi_x" });
    const order = db.get("orders", created.orderId);
    check("生成失敗→svg_generation_failed", order.productionStatus === "svg_generation_failed", order.productionStatus);
    check("生成失敗→SVG URL無し", order.svgMirrorUrl === undefined);
    check("生成失敗でも入金は記録", order.paymentStatus === "paid");
  }

  // ── 4. 期限切れ ──
  {
    const db = new FakeStore() as any;
    const created = await createPendingOrder(db, baseInput());
    await markOrderExpired(db, created.orderId);
    const order = db.get("orders", created.orderId);
    check("期限切れ→failed/cancelled", order.paymentStatus === "failed" && order.productionStatus === "cancelled");

    // 入金済みは期限切れで巻き戻さない
    const paid = await createPendingOrder(db, baseInput());
    await markOrderPaidAndGenerateAssets(db, { orderId: paid.orderId, sessionId: "cs2", paymentIntentId: "pi2" });
    await markOrderExpired(db, paid.orderId);
    check("入金済みは期限切れ無視", db.get("orders", paid.orderId).paymentStatus === "paid");
  }

  // ── 5. 返金Webhook(payment_intent突合) ──
  {
    const db = new FakeStore() as any;
    const created = await createPendingOrder(db, baseInput());
    await markOrderPaidAndGenerateAssets(db, { orderId: created.orderId, sessionId: "cs3", paymentIntentId: "pi_refund" });
    const found = await markOrderRefundedByPaymentIntent(db, "pi_refund");
    check("返金突合成功", found === true && db.get("orders", created.orderId).paymentStatus === "refunded");
    const notFound = await markOrderRefundedByPaymentIntent(db, "pi_unknown");
    check("該当PI無しはfalse", notFound === false);

    // 返金後にpaid通知が遅延到達しても巻き戻さない
    await markOrderPaidAndGenerateAssets(db, { orderId: created.orderId, sessionId: "cs3", paymentIntentId: "pi_refund" });
    check("返金後のpaid遅延を無視", db.get("orders", created.orderId).paymentStatus === "refunded");
  }

  // ── 6. 管理アクション: 正常フロー ──
  {
    const db = new FakeStore() as any;
    const created = await createPendingOrder(db, baseInput());
    await markOrderPaidAndGenerateAssets(db, { orderId: created.orderId, sessionId: "cs4", paymentIntentId: "pi4" });
    const oid = created.orderId;
    check("cutting", (await applyAdminOrderAction(db, oid, "cutting")).ok && db.get("orders", oid).productionStatus === "cutting");
    check("cut_complete", (await applyAdminOrderAction(db, oid, "cut_complete")).ok && db.get("orders", oid).productionStatus === "cut_complete");
    check("packed", (await applyAdminOrderAction(db, oid, "packed")).ok && db.get("orders", oid).productionStatus === "packed");
    const shipped = await applyAdminOrderAction(db, oid, "shipped", { trackingNumber: "1234-5678", shippingMethod: "ネコポス" });
    check("shipped+追跡番号", shipped.ok && db.get("orders", oid).productionStatus === "shipped" && db.get("orders", oid).trackingNumber === "1234-5678");
    check("発送済みはキャンセル不可", (await applyAdminOrderAction(db, oid, "cancelled")).ok === false);
  }

  // ── 7. 管理アクション: 異常系 ──
  {
    const db = new FakeStore() as any;
    const created = await createPendingOrder(db, baseInput());
    // 未入金で出荷系は不可
    check("未入金でcutting不可", (await applyAdminOrderAction(db, created.orderId, "cutting")).ok === false);
    // 未入金でもキャンセルは可
    check("未入金でもキャンセル可", (await applyAdminOrderAction(db, created.orderId, "cancelled")).ok === true);

    // 入金後に飛び級遷移は不可
    const c2 = await createPendingOrder(db, baseInput());
    await markOrderPaidAndGenerateAssets(db, { orderId: c2.orderId, sessionId: "cs5", paymentIntentId: "pi5" });
    check("svg_generatedからpackedへ飛び級不可", (await applyAdminOrderAction(db, c2.orderId, "packed")).ok === false);

    // 存在しない注文
    check("存在しない注文は404", (await applyAdminOrderAction(db, "nope", "cutting")).status === 404);

    // 再生成
    const regen = await applyAdminOrderAction(db, c2.orderId, "regenerate");
    check("regenerate成功→svg_generated", regen.ok && db.get("orders", c2.orderId).productionStatus === "svg_generated");

    // 返金印
    check("mark_refunded", (await applyAdminOrderAction(db, c2.orderId, "mark_refunded")).ok && db.get("orders", c2.orderId).paymentStatus === "refunded");
  }

  console.log(`\n=== 統合テスト: ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error("テスト実行エラー:", e);
  process.exit(1);
});
