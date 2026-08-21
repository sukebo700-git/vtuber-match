import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { FieldValue, getAdminDb } from "@/lib/firebaseAdmin";
import { checkRakutenStock, extractRakutenItemCode, hasRakutenApiCredentials, sleep } from "@/lib/rakutenStock";
import { invalidateSwipeAdSettingsCache, normalizeSwipeAdSettings, type SwipeAdStockStatus } from "@/lib/swipeAds";

export const dynamic = "force-dynamic";
// 商品数ぶんAPIを順に叩くため、既定の実行時間だと足りないことがある
export const maxDuration = 60;

const settingsCollection = "app_settings";
const settingsDocId = "swipe_ads";
// 楽天APIは短時間の連続アクセスで制限がかかるため間隔を空ける
const requestIntervalMs = 1100;

export async function POST(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  if (!hasRakutenApiCredentials()) {
    return NextResponse.json({
      error: "RAKUTEN_APPLICATION_ID が未設定です。楽天Developersで取得したアプリIDを環境変数に設定してください。",
      code: "MISSING_CREDENTIALS",
    }, { status: 503 });
  }

  const db = getAdminDb();
  if (!db) return NextResponse.json({ error: "Firebase admin env is required" }, { status: 501 });

  const ref = db.collection(settingsCollection).doc(settingsDocId);
  const doc = await ref.get();
  if (!doc.exists) return NextResponse.json({ error: "広告設定がまだありません。" }, { status: 404 });

  const settings = normalizeSwipeAdSettings(doc.data());
  const checkedAt = new Date().toISOString();

  let checked = 0;
  let soldOut = 0;
  let skipped = 0;

  const cards = [];
  for (const card of settings.cards) {
    // 楽天以外(Yahoo!等)はこのAPIで確認できないので触らない
    const itemCode = card.provider === "rakuten" ? extractRakutenItemCode(card.url) : "";
    if (!itemCode) {
      skipped += 1;
      cards.push(card);
      continue;
    }

    if (checked > 0) await sleep(requestIntervalMs);
    const result = await checkRakutenStock(itemCode);
    checked += 1;

    // 判定できなかった場合は既存の状態を維持する(誤って非表示にしない)
    if (result.unknown) {
      cards.push(card);
      continue;
    }

    const status: SwipeAdStockStatus = result.inStock ? "in_stock" : "sold_out";
    if (status === "sold_out") soldOut += 1;
    cards.push({ ...card, stock_status: status, stock_checked_at: checkedAt });
  }

  await ref.set({
    ...settings,
    cards,
    stock_checked_at: checkedAt,
    updated_at: FieldValue.serverTimestamp(),
  }, { merge: true });

  invalidateSwipeAdSettingsCache();

  return NextResponse.json({
    ok: true,
    checked,
    sold_out: soldOut,
    skipped,
    checked_at: checkedAt,
    settings: normalizeSwipeAdSettings({ ...settings, cards }),
  });
}
