import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { FieldValue, getAdminDb } from "@/lib/firebaseAdmin";
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

  await db.collection(settingsCollection).doc(settingsDocId).set({
    ...settings,
    updated_at: FieldValue.serverTimestamp(),
  }, { merge: true });

  invalidateSwipeAdSettingsCache();

  return NextResponse.json({ ok: true, settings });
}
