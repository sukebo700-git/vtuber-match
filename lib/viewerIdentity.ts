import type { ViewerProfile } from "./types";

export const viewerProfileKey = "vtuber-match-viewer-profile";
export const viewerIdKey = "vtuber-match-viewer-id";
export const viewerAuthKey = "vtuber-match-viewer-auth";
export const anonymousViewerIdKey = "vtuber-match-anonymous-viewer-id";

export function getAnonymousViewerId() {
  const existing = localStorage.getItem(anonymousViewerIdKey);
  if (existing) return existing;
  const id = `anon-viewer-${createViewerUuid()}`;
  localStorage.setItem(anonymousViewerIdKey, id);
  return id;
}

export function getViewerIdentity() {
  const auth = readViewerAuth();
  if (auth?.id) return { id: auth.id, registered: true, auth };
  const storedId = localStorage.getItem(viewerIdKey);
  if (storedId && !storedId.startsWith("viewer-")) return { id: storedId, registered: false, auth: null };
  return { id: getAnonymousViewerId(), registered: false, auth: null };
}

export function readViewerAuth() {
  try {
    const raw = localStorage.getItem(viewerAuthKey);
    return raw ? (JSON.parse(raw) as { id?: string; email?: string; viewer_login_id?: string; name?: string }) : null;
  } catch {
    return null;
  }
}

export function readStoredViewerProfile() {
  try {
    const raw = localStorage.getItem(viewerProfileKey);
    return raw ? (JSON.parse(raw) as Partial<ViewerProfile>) : undefined;
  } catch {
    return undefined;
  }
}

export function anonymousViewerProfile(id = getAnonymousViewerId()) {
  return {
    id,
    is_anonymous: true,
    visible_to_matched_streamers: true,
  };
}

export function rememberRegisteredViewer(id: string) {
  localStorage.setItem(viewerIdKey, id);
}

function createViewerUuid() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
    return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}
