import { NextResponse } from "next/server";
import { FieldValue, getAdminDb } from "@/lib/firebaseAdmin";
import { addLocalVisit } from "@/lib/localStore";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const date = new Date().toISOString().slice(0, 10);
  const source = classifySource(String(body.referrer || ""), String(body.search || ""));
  const db = getAdminDb();

  if (!db) {
    await addLocalVisit(date, source);
    return NextResponse.json({ ok: true, source: "local" });
  }

  await db.collection("site_visits").doc(date).set({
    date,
    count: FieldValue.increment(1),
    updated_at: FieldValue.serverTimestamp(),
  }, { merge: true });

  await db.collection("site_visit_sources").doc(date).set({
    date,
    total: FieldValue.increment(1),
    [source]: FieldValue.increment(1),
    updated_at: FieldValue.serverTimestamp(),
  }, { merge: true });

  return NextResponse.json({ ok: true, source: "firestore" });
}

function classifySource(referrer: string, search: string) {
  const query = new URLSearchParams(search.startsWith("?") ? search : search ? `?${search}` : "");
  const utmMedium = query.get("utm_medium")?.toLowerCase() || "";
  const utmSource = query.get("utm_source")?.toLowerCase() || "";
  if (utmMedium === "cpc" || utmMedium === "paid" || utmMedium === "ppc") return "ads";
  if (utmMedium === "social" || isSocial(utmSource)) return "social";
  if (!referrer) return "direct";

  let host = "";
  try {
    host = new URL(referrer).hostname.toLowerCase();
  } catch {
    return "referral";
  }

  if (isSearchEngine(host)) return "organic";
  if (isSocial(host)) return "social";
  if (host.includes("vtuber-match.vercel.app") || host.includes("vtuber-seichi.web.app")) return "internal";
  return "referral";
}

function isSearchEngine(value: string) {
  return ["google.", "bing.", "yahoo.", "duckduckgo.", "baidu.", "yandex."].some((domain) => value.includes(domain));
}

function isSocial(value: string) {
  return ["x.com", "twitter.", "youtube.", "t.co", "instagram.", "facebook.", "threads.", "tiktok."].some((domain) => value.includes(domain));
}
