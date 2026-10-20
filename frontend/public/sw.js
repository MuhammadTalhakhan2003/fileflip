// FileFlip service worker: makes the site installable and keeps the home page
// available offline. Tool requests always go to the network.
const CACHE = "fileflip-shell-v1";
const SHELL = ["/", "/icon.svg?v=2", "/app-icon/192?v=2", "/app-icon/512?v=2"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.mode !== "navigate") return;
  event.respondWith(fetch(request).catch(() => caches.match(request).then((hit) => hit || caches.match("/"))));
});
