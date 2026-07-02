self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("push", (event) => {
  const payload = readPushPayload(event);
  const notification = payload.notification || {};
  const data = payload.data || {};
  const title = notification.title || data.title || "VtuberMatch";
  const options = {
    body: notification.body || data.body || "新しい通知があります。",
    icon: notification.icon || "/icon.svg",
    badge: notification.badge || "/icon.svg",
    data: {
      url: data.url || "/",
      type: data.type || ""
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      const targetUrl = new URL(url, self.location.origin).href;
      for (const client of clientList) {
        if (client.url === targetUrl && "focus" in client) return client.focus();
      }
      return clients.openWindow(targetUrl);
    })
  );
});

function readPushPayload(event) {
  if (!event.data) return {};
  try {
    return event.data.json();
  } catch {
    return { notification: { body: event.data.text() } };
  }
}
