self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open("swipecast-v1").then((cache) => cache.addAll(["/", "/manifest.json", "/icon.svg"]))
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});

self.addEventListener("push", (event) => {
  const payload = readPushPayload(event);
  const notification = payload.notification || {};
  const data = payload.data || {};
  const title = notification.title || data.title || "Vtuberマッチ";
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
