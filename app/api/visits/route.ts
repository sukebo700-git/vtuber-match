import { NextResponse } from "next/server";
import { FieldValue, getAdminDb } from "@/lib/firebaseAdmin";
import { addLocalVisit } from "@/lib/localStore";

const detailedAnalyticsEnabled = process.env.ENABLE_DETAILED_ANALYTICS === "1";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const hour = now.getHours();
    const path = normalizePath(body.path);
    const kind = String(body.kind || "visit");
    const userType = normalizeUserType(body.user_type);
    const durationSeconds = Math.max(0, Math.min(24 * 60 * 60, Number(body.duration_seconds || 0)));
    const source = classifySource(String(body.referrer || ""), String(body.search || ""));
    const db = getAdminDb();

    if (!db) {
      if (kind === "visit") await addLocalVisit(date, source, { hour, path }).catch(() => undefined);
      return NextResponse.json({ ok: true, source: "local" });
    }

    if (kind === "engagement") {
      if (!detailedAnalyticsEnabled) return NextResponse.json({ ok: true, skipped: true });
      await db.collection("site_engagement").doc(date).set({
        date,
        total_duration_seconds: FieldValue.increment(durationSeconds),
        session_count: FieldValue.increment(1),
        updated_at: FieldValue.serverTimestamp(),
      }, { merge: true });
      return NextResponse.json({ ok: true, source: "firestore" });
    }

    if (kind === "visit") {
      await Promise.all([
        db.collection("site_visits").doc(date).set({
          date,
          count: FieldValue.increment(1),
          updated_at: FieldValue.serverTimestamp(),
        }, { merge: true }),
        db.collection("aggregates").doc("analytics_totals").set({
          site_visits_total: FieldValue.increment(1),
          [`source_${source}`]: FieldValue.increment(1),
          [`${userType}_visits`]: FieldValue.increment(1),
          updated_at: FieldValue.serverTimestamp(),
        }, { merge: true })
      ]);

      if (!detailedAnalyticsEnabled) return NextResponse.json({ ok: true, source: "firestore", mode: "minimal" });

      await db.collection("site_visit_sources").doc(date).set({
        date,
        total: FieldValue.increment(1),
        [source]: FieldValue.increment(1),
        updated_at: FieldValue.serverTimestamp(),
      }, { merge: true });

      await db.collection("site_visit_roles").doc(date).set({
        date,
        [`${userType}_visits`]: FieldValue.increment(1),
        updated_at: FieldValue.serverTimestamp(),
      }, { merge: true });
    }

    if (kind !== "page_view" || !detailedAnalyticsEnabled) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    await db.collection("site_page_views").doc(date).set({
      date,
      count: FieldValue.increment(1),
      [`${userType}_page_views`]: FieldValue.increment(1),
      updated_at: FieldValue.serverTimestamp(),
    }, { merge: true });
    await db.collection("aggregates").doc("analytics_totals").set({
      site_page_views_total: FieldValue.increment(1),
      [`${userType}_page_views`]: FieldValue.increment(1),
      updated_at: FieldValue.serverTimestamp(),
    }, { merge: true });

    await db.collection("site_visit_hours").doc(date).set({
      date,
      [`h${String(hour).padStart(2, "0")}`]: FieldValue.increment(1),
      updated_at: FieldValue.serverTimestamp(),
    }, { merge: true });

    await db.collection("site_visit_pages").doc(`${date}_${encodePathId(path)}`).set({
      date,
      path,
      count: FieldValue.increment(1),
      updated_at: FieldValue.serverTimestamp(),
    }, { merge: true });

    return NextResponse.json({ ok: true, source: "firestore" });
  } catch (error) {
    console.error("visit analytics skipped:", error instanceof Error ? error.message : String(error || "unknown"));
    return NextResponse.json({ ok: true, skipped: true });
  }
}

function normalizeUserType(value: unknown) {
  if (value === "creator" || value === "viewer") return value;
  return "guest";
}

function normalizePath(value: unknown) {
  const path = String(value || "/").trim().split("?")[0] || "/";
  return path.slice(0, 120);
}

function encodePathId(path: string) {
  return Buffer.from(path).toString("base64url").slice(0, 160);
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
