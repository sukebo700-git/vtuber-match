import { FieldValue, getAdminDb, stripUndefined } from "./firebaseAdmin";

// リスナー側の権限(エリートファンかどうか)は、この専用コレクションでのみ判定する。
// viewer_profiles(本人が自由に編集できるプロフィール)とは意図的に分離している。
// /api/viewer-profile のPOSTはこのコレクションを一切触らないため、
// プロフィール編集経由でtierを書き換えることは構造的にできない。
const entitlementsCollection = "viewer_entitlements";

export type ViewerTier = "free" | "elite";

export type ViewerEntitlement = {
  tier: ViewerTier;
  validUntil?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  grantSource?: "admin" | "stripe";
};

const freeEntitlement: ViewerEntitlement = { tier: "free" };

export async function getViewerEntitlement(viewerId: string): Promise<ViewerEntitlement> {
  if (!viewerId) return freeEntitlement;
  const db = getAdminDb();
  if (!db) return freeEntitlement;
  const doc = await db.collection(entitlementsCollection).doc(viewerId).get();
  if (!doc.exists) return freeEntitlement;
  return normalizeEntitlement(doc.data());
}

/** 一覧画面向け。渡したIDぶんだけ getAll でまとめて読む(1件ずつreadしない)。 */
export async function getViewerEntitlements(viewerIds: string[]): Promise<Map<string, ViewerEntitlement>> {
  const result = new Map<string, ViewerEntitlement>();
  const uniqueIds = Array.from(new Set(viewerIds.filter(Boolean)));
  if (!uniqueIds.length) return result;
  const db = getAdminDb();
  if (!db) return result;
  const docs = await db.getAll(...uniqueIds.map((id) => db.collection(entitlementsCollection).doc(id)));
  docs.forEach((doc) => {
    if (doc.exists) result.set(doc.id, normalizeEntitlement(doc.data()));
  });
  return result;
}

export async function isElite(viewerId: string): Promise<boolean> {
  const entitlement = await getViewerEntitlement(viewerId);
  return entitlement.tier === "elite";
}

export async function setViewerEntitlement(viewerId: string, patch: {
  tier: ViewerTier;
  /** null で無期限(手動付与)。undefinedなら既存値を変更しない。 */
  validUntil?: string | null;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  grantSource: "admin" | "stripe";
}): Promise<void> {
  const db = getAdminDb();
  if (!db) return;
  await db.collection(entitlementsCollection).doc(viewerId).set(stripUndefined({
    tier: patch.tier,
    valid_until: patch.validUntil === null ? FieldValue.delete() : patch.validUntil,
    stripe_customer_id: patch.stripeCustomerId,
    stripe_subscription_id: patch.stripeSubscriptionId,
    grant_source: patch.grantSource,
    updated_at: FieldValue.serverTimestamp(),
  }), { merge: true });
}

function normalizeEntitlement(data: FirebaseFirestore.DocumentData | undefined): ViewerEntitlement {
  if (!data) return freeEntitlement;
  const validUntil = toIso(data.valid_until);
  // 有効期限切れは自動的にfree扱いにする。Stripeの解約Webhookが遅延・欠落しても、
  // ここで確実にダウングレードされるフェイルセーフとして機能する。
  if (validUntil && Date.parse(validUntil) < Date.now()) return freeEntitlement;
  if (data.tier !== "elite") return freeEntitlement;
  return {
    tier: "elite",
    validUntil,
    stripeCustomerId: typeof data.stripe_customer_id === "string" ? data.stripe_customer_id : undefined,
    stripeSubscriptionId: typeof data.stripe_subscription_id === "string" ? data.stripe_subscription_id : undefined,
    grantSource: data.grant_source === "admin" || data.grant_source === "stripe" ? data.grant_source : undefined,
  };
}

function toIso(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "object" && "toDate" in value && typeof (value as { toDate: unknown }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return undefined;
}
