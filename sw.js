// sw.js
// Caches the app shell so the app still opens with no connection (e.g. a dead
// zone in church). Note data is handled separately by Firestore's own offline
// persistence - this worker never touches Firestore, Auth, or Bible API traffic.

const CACHE_NAME = 'ssn-shell-v1';

const APP_SHELL = [
  './',
  './index.html',
  './css/tailwind.css',
  './css/styles.css',
  './js/storage.js',
  './js/app.js',
  './manifest.json',
  './Assets/icon-192-v2.png',
  './Assets/icon-512-v2.png',
];

// Third-party libraries the shell needs to render, fetched up front so the app
// works offline after the very first visit rather than the second.
const CDN_PRECACHE = [
  'https://unpkg.com/@phosphor-icons/web',
  'https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore-compat.js',
  'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth-compat.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
];

// Only these cross-origin hosts get cached; everything else (firestore.googleapis.com,
// identitytoolkit, bible-api.com, ...) passes straight through to the network.
const CDN_HOSTS = ['unpkg.com', 'www.gstatic.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

// On a weak signal the network can hang rather than fail - don't make the user
// wait on it when a cached copy is available.
const NETWORK_TIMEOUT_MS = 3000;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL);
    // Best-effort: cache.add() rejects opaque responses, so fetch + put manually,
    // and don't let a CDN hiccup block installation.
    await Promise.allSettled(CDN_PRECACHE.map(async (url) => {
      const req = new Request(url, { mode: 'no-cors' });
      const res = await fetch(req);
      await cache.put(req, res);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && !CDN_HOSTS.includes(url.hostname)) return;

  event.respondWith(networkFirst(event, req));
});

// Network-first so updates show up immediately when online; the cache is only
// a fallback for when the network fails or stalls.
async function networkFirst(event, req) {
  const cache = await caches.open(CACHE_NAME);

  const network = fetch(req).then((res) => {
    // Cross-origin no-cors responses are opaque (status 0) but still valid to cache.
    if (res.ok || res.type === 'opaque') {
      cache.put(req, res.clone());
    }
    return res;
  });
  // Let the cache refresh finish even if we end up answering from cache.
  event.waitUntil(network.then(() => {}, () => {}));

  let cached = await cache.match(req);
  if (!cached && req.mode === 'navigate') {
    cached = await cache.match('./index.html');
  }
  if (!cached) return network;

  const timeout = new Promise((resolve) => setTimeout(() => resolve(cached), NETWORK_TIMEOUT_MS));
  return Promise.race([network.catch(() => cached), timeout]);
}
