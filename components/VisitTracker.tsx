"use client";

import { useEffect } from "react";

const visitKeyPrefix = "vtuber-match-visit-";

export function VisitTracker() {
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const key = `${visitKeyPrefix}${today}`;
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, "1");
    fetch("/api/visits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({ path: window.location.pathname }),
    }).catch(() => undefined);
  }, []);

  return null;
}
