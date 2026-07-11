import admin from "firebase-admin";

let cachedAdminApp: admin.app.App | null | undefined;

export function getAdminApp() {
  if (cachedAdminApp !== undefined) return cachedAdminApp;
  if (admin.apps.length) {
    cachedAdminApp = admin.app();
    return cachedAdminApp;
  }

  const credential = getCredential();
  if (!credential) {
    cachedAdminApp = null;
    return cachedAdminApp;
  }

  try {
    cachedAdminApp = admin.initializeApp({ credential });
    return cachedAdminApp;
  } catch (error) {
    cachedAdminApp = null;
    const message = error instanceof Error ? error.message : "unknown error";
    console.error("Firebase Admin initialization failed:", message);
    return cachedAdminApp;
  }
}

export function getAdminDb() {
  const app = getAdminApp();
  return app ? admin.firestore(app) : null;
}

export const FieldValue = admin.firestore.FieldValue;

export function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => stripUndefined(item)) as T;
  }
  if (value && typeof value === "object" && !isFirestoreSpecialValue(value)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, stripUndefined(item)])
    ) as T;
  }
  return value;
}

function getCredential() {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (serviceAccountJson) {
    const parsed = parseServiceAccountJson(serviceAccountJson);
    if (parsed) return admin.credential.cert(parsed);
  }

  const projectId = normalizeEnv(process.env.FIREBASE_PROJECT_ID);
  const clientEmail = normalizeEnv(process.env.FIREBASE_CLIENT_EMAIL);
  const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);

  if (!projectId || !clientEmail || !privateKey) return null;

  return admin.credential.cert({
    projectId,
    clientEmail,
    privateKey,
  });
}

function parseServiceAccountJson(value: string) {
  try {
    const parsed = JSON.parse(stripWrappingQuotes(value));
    if (parsed.private_key) parsed.private_key = normalizePrivateKey(parsed.private_key);
    return parsed;
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error("FIREBASE_SERVICE_ACCOUNT_JSON could not be parsed:", message);
    return null;
  }
}

function normalizeEnv(value: string | undefined) {
  return stripWrappingQuotes(value || "").trim();
}

function normalizePrivateKey(value: string | undefined) {
  const cleaned = stripWrappingQuotes(value || "")
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();

  return cleaned || "";
}

function stripWrappingQuotes(value: string) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function isFirestoreSpecialValue(value: object) {
  // firebase-admin v12ではserverTimestamp()等のsentinelに_methodNameが無いため、instanceofで判定する。
  // これを外すとstripUndefinedがsentinelを空オブジェクト{}に潰してFirestoreに書き込んでしまう。
  return (
    value instanceof Date ||
    value instanceof admin.firestore.FieldValue ||
    "_methodName" in value ||
    typeof (value as { toDate?: unknown }).toDate === "function"
  );
}
