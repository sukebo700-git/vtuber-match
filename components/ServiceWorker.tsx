"use client";

import { useEffect } from "react";

export function ServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js?v=20260612-2", { updateViaCache: "none" })
        .then((registration) => {
          registration.update().catch(() => undefined);
        })
        .catch(() => undefined);
    }

    if ("caches" in window) {
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter((key) => key.startsWith("swipecast-") || key.startsWith("vtubermatch-runtime-"))
              .map((key) => caches.delete(key))
          )
        )
        .catch(() => undefined);
    }
  }, []);

  return null;
}
