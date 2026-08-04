const CACHE_NAME = "toppers-track-shell-v1";
const SHELL_FILES = ["/", "/index.html", "/manifest.json", "/icon.png", "/offline.html"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("/offline.html").then((r) => r || caches.match("/index.html")))
    );
    return;
  }
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});

// ---- Push notification handling ----
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data.json();
  } catch (e) {
    data = { title: "Topper's Track", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Topper's Track";
  const options = {
    body: data.body || "",
    icon: "/icon.png",
    badge: "/icon.png",
    image: data.image || undefined,
    tag: data.tag || "toppers-track-reminder",
    data: {
      image: data.image || "",
      task: data.body || data.title || "",
      time: data.time || "",
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const d = event.notification.data || {};
  const url =
    "/?reminderImage=" + encodeURIComponent(d.image || "") +
    "&task=" + encodeURIComponent(d.task || "") +
    "&time=" + encodeURIComponent(d.time || "");

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
