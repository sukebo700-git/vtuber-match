"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const visitKeyPrefix = "vtuber-match-visit-";
const analyticsVisitorKey = "vtuber-match-analytics-visitor-id";
const pageViewKeyPrefix = "vtuber-match-page-view-";
const engagementKeyPrefix = "vtuber-match-engagement-";
const detailedAnalyticsEnabled = process.env.NEXT_PUBLIC_DETAILED_ANALYTICS === "1";

export function VisitTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (window.location.pathname.startsWith("/admin")) {
      localStorage.setItem("vtuber-match-admin-mode", "1");
      return;
    }
    if (localStorage.getItem("vtuber-match-admin-mode") === "1") return;

    const today = new Date().toISOString().slice(0, 10);
    const key = `${visitKeyPrefix}${today}`;
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, "1");
      fetch("/api/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          path: window.location.pathname,
          referrer: document.referrer,
          search: window.location.search,
          kind: "visit",
          user_type: getUserType(),
        }),
      }).catch(() => undefined);
    }

    if (detailedAnalyticsEnabled) {
      const pageViewKey = `${pageViewKeyPrefix}${today}-${encodeStorageKey(window.location.pathname)}`;
      if (!sessionStorage.getItem(pageViewKey)) {
        sessionStorage.setItem(pageViewKey, "1");
        fetch("/api/visits", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          keepalive: true,
          body: JSON.stringify({
            path: window.location.pathname,
            referrer: document.referrer,
            search: window.location.search,
            kind: "page_view",
            user_type: getUserType(),
          }),
        }).catch(() => undefined);
      }
    }

    const eventType = registrationEventForPath(window.location.pathname);
    if (!eventType) return;
    const eventKey = `vtuber-match-analytics-${eventType}-${today}`;
    if (localStorage.getItem(eventKey)) return;
    localStorage.setItem(eventKey, "1");
    fetch("/api/analytics/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        event_type: eventType,
        visitor_id: getAnalyticsVisitorId(),
        path: window.location.pathname,
      }),
    }).catch(() => undefined);
  }, [pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!detailedAnalyticsEnabled) return;
    if (window.location.pathname.startsWith("/admin") || localStorage.getItem("vtuber-match-admin-mode") === "1") return;
    const startedAt = Date.now();
    let sent = false;
    const sendEngagement = () => {
      if (sent) return;
      sent = true;
      const durationSeconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
      if (durationSeconds < 15) return;
      const today = new Date().toISOString().slice(0, 10);
      const engagementKey = `${engagementKeyPrefix}${today}-${encodeStorageKey(window.location.pathname)}`;
      if (sessionStorage.getItem(engagementKey)) return;
      sessionStorage.setItem(engagementKey, "1");
      fetch("/api/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          kind: "engagement",
          duration_seconds: durationSeconds,
          user_type: getUserType(),
          path: window.location.pathname,
        }),
      }).catch(() => undefined);
    };
    window.addEventListener("pagehide", sendEngagement);
    return () => {
      window.removeEventListener("pagehide", sendEngagement);
      sendEngagement();
    };
  }, []);

  return null;
}

function registrationEventForPath(pathname: string) {
  if (pathname === "/viewer/register") return "viewer_register_click";
  if (pathname === "/creator/apply" || pathname === "/apply") return "creator_register_click";
  return "";
}

function getAnalyticsVisitorId() {
  const existing = localStorage.getItem(analyticsVisitorKey);
  if (existing) return existing;
  const id = `visitor_${crypto.randomUUID()}`;
  localStorage.setItem(analyticsVisitorKey, id);
  return id;
}

function getUserType() {
  if (localStorage.getItem("vtuber-match-creator-email")) return "creator";
  if (localStorage.getItem("vtuber-match-viewer-auth")) return "viewer";
  return "guest";
}

function encodeStorageKey(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 120);
}
