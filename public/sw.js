// Billo POS Service Worker - PWA Offline Shell & Asset Caching
const CACHE_VERSION = 'billo-pwa-v2';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const PRECACHE_URLS = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/icon.svg',
  '/icons/apple-touch-icon.png',
  '/images/products/default-product.svg',
];

// Install: Pre-cache essential app shell and fallback page
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn('[SW] Precache asset load warning:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate: Cleanup old caches & claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== STATIC_CACHE && key !== RUNTIME_CACHE) {
            console.log('[SW] Removing deprecated cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Message listener to allow immediate update activation
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Fetch Strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // 2. Skip API requests - handled client-side in api.ts with localStorage offline queue
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // 3. Navigation Requests (Page loads & route navigation)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put('/', clone));
          }
          return networkResponse;
        })
        .catch(async () => {
          // If offline, attempt to serve the cached app shell first
          const cachedHome = await caches.match('/');
          if (cachedHome) {
            return cachedHome;
          }
          // Fallback to offline page if app shell is not yet cached
          const cachedOffline = await caches.match('/offline.html');
          if (cachedOffline) {
            return cachedOffline;
          }
          return new Response('Offline: App shell unavailable', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' },
          });
        })
    );
    return;
  }

  // 4. Static Assets (_next/static, scripts, styles, images, web fonts)
  const isStaticAsset =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.ttf');

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        // Cache-First or Stale-While-Revalidate
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone));
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // 5. Default: Network with Cache Fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
