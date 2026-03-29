// sw.js (Service Worker)
// A tiny background script that satisfies the PWA "Install to Home Screen" requirement.
// Since Firebase Firestore handles our offline-data caching, we don't need a massive Service Worker,
// but Chrome requires at least a basic `fetch` listener to unlock the installation prompt!

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Let the browser handle standard networking (Firebase has its own offline mode)
  // We simply pass through all requests.
  event.respondWith(fetch(event.request).catch(() => {
    // If the network completely fails (they open the app in airplane mode),
    // they don't get a browser error page, it just tries to load from cache!
    return caches.match(event.request);
  }));
});
