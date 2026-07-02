import { FieldValue, getAdminDb, stripUndefined } from "../lib/firebaseAdmin";

type Totals = Record<string, number>;

async function main() {
  const apply = process.argv.includes("--apply");
  const db = getAdminDb();
  if (!db) {
    console.error("Firebase Admin is not configured. No changes were made.");
    process.exitCode = 1;
    return;
  }

  const totals: Totals = {};

  const analyticsSnapshot = await db.collection("analytics_daily").limit(1000).get();
  analyticsSnapshot.docs.forEach((doc) => {
    const data = doc.data();
    add(totals, "swiped_visitors", data.swiped_visitors);
    add(totals, "total_swipes", data.total_swipes);
    add(totals, "viewer_register_clicks", data.viewer_register_clicks);
    add(totals, "creator_register_clicks", data.creator_register_clicks);
  });

  const visitsSnapshot = await db.collection("site_visits").limit(1000).get();
  visitsSnapshot.docs.forEach((doc) => add(totals, "site_visits_total", doc.data().count));

  const sourceSnapshot = await db.collection("site_visit_sources").limit(1000).get();
  sourceSnapshot.docs.forEach((doc) => {
    const data = doc.data();
    add(totals, "source_organic", data.organic);
    add(totals, "source_direct", data.direct);
    add(totals, "source_social", data.social);
    add(totals, "source_referral", data.referral);
    add(totals, "source_ads", data.ads);
  });

  const roleSnapshot = await db.collection("site_visit_roles").limit(1000).get();
  roleSnapshot.docs.forEach((doc) => {
    const data = doc.data();
    add(totals, "creator_visits", data.creator_visits);
    add(totals, "viewer_visits", data.viewer_visits);
    add(totals, "guest_visits", data.guest_visits);
  });

  const pageViewSnapshot = await db.collection("site_page_views").limit(1000).get();
  pageViewSnapshot.docs.forEach((doc) => {
    const data = doc.data();
    add(totals, "site_page_views_total", data.count);
    add(totals, "creator_page_views", data.creator_page_views);
    add(totals, "viewer_page_views", data.viewer_page_views);
    add(totals, "guest_page_views", data.guest_page_views);
  });

  console.log(`analytics_daily: ${analyticsSnapshot.size}`);
  console.log(`site_visits: ${visitsSnapshot.size}`);
  console.log(`site_visit_sources: ${sourceSnapshot.size}`);
  console.log(`site_visit_roles: ${roleSnapshot.size}`);
  console.log(`site_page_views: ${pageViewSnapshot.size}`);
  console.log(`mode: ${apply ? "apply" : "dry-run"}`);
  console.log(JSON.stringify(totals, null, 2));

  if (!apply) return;

  await db.collection("aggregates").doc("analytics_totals").set(stripUndefined({
    ...totals,
    rebuilt_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  }), { merge: true });
  console.log("aggregates/analytics_totals updated.");
}

function add(totals: Totals, key: string, value: unknown) {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number === 0) return;
  totals[key] = (totals[key] || 0) + number;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error || "unknown error"));
  process.exitCode = 1;
});
