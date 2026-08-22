import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { FieldValue, getAdminDb, stripUndefined } from "@/lib/firebaseAdmin";
import { invalidateSwipeAdSettingsCache, normalizeSwipeAdSettings, SWIPE_AD_DEFAULTS } from "@/lib/swipeAds";

export const dynamic = "force-dynamic";

const settingsCollection = "app_settings";
const settingsDocId = "swipe_ads";

export async function GET(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const db = getAdminDb();
  if (!db) return NextResponse.json({ settings: SWIPE_AD_DEFAULTS, source: "default" });

  const doc = await db.collection(settingsCollection).doc(settingsDocId).get();
  return NextResponse.json({
    settings: doc.exists ? normalizeSwipeAdSettings(doc.data()) : SWIPE_AD_DEFAULTS,
    source: "firestore",
  });
}

export async function PUT(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const db = getAdminDb();
  if (!db) return NextResponse.json({ error: "Firebase admin env is required" }, { status: 501 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  // 正規化を通すことで、間隔の範囲外・不正URL・httpsでないリンクを弾く
  const settings = normalizeSwipeAdSettings(body);

  try {
    // stock_checked_at未確認のカード(stock_checked_at: undefined)がFirestoreの
    // set()に渡ると「Cannot use 'undefined' as a Firestore value」で例外になり、
    // 保存全体が失敗していた。stripUndefinedでネスト(cards配列内も含む)ごと除去する。
    await db.collection(settingsCollection).doc(settingsDocId).set(stripUndefined({
      ...settings,
      updated_at: FieldValue.serverTimestamp(),
    }), { merge: true });
  } catch (error) {
    console.error("Failed to save swipe ad settings:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: "保存できませんでした。時間をおいて再度お試しください。" }, { status: 500 });
  }

  invalidateSwipeAdSettingsCache();

  return NextResponse.json({ ok: true, settings });
}
