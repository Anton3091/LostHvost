const CACHE = 'losthvost-static-cache-reset-2026-08-16-__BUILD_VERSION__';
const CACHE_PREFIX = 'losthvost-static-';
const APP_SHELL = '/';
const STATIC_PATHS = new Set(['/manifest.webmanifest', '/losthvost-transparent.png', '/asset-manifest.json']);

function isCacheableResponse(response) {
  return response.ok && response.type === 'basic';
}

async function cacheUrl(cache, url) {
  try {
    const response = await fetch(url, { cache: 'reload' });
    if (isCacheableResponse(response)) await cache.put(url, response);
  } catch {
    // Existing cached resources still make the app shell usable offline.
  }
}

async function getBuildAssets() {
  try {
    const response = await fetch('/asset-manifest.json', { cache: 'reload' });
    if (!response.ok) return [];
    const manifest = await response.json();
    return Object.values(manifest).flatMap(entry => [entry.file, ...(entry.css || []), ...(entry.assets || [])]).filter(Boolean);
  } catch {
    return [];
  }
}

async function precacheAppShell() {
  const cache = await caches.open(CACHE);
  const shellResponse = await fetch(APP_SHELL, { cache: 'reload' });
  if (!isCacheableResponse(shellResponse)) throw new Error('Не удалось сохранить оболочку приложения');
  await cache.put(APP_SHELL, shellResponse.clone());

  const staticUrls = [...STATIC_PATHS, ...(await getBuildAssets())];
  await Promise.allSettled(staticUrls.map(url => cacheUrl(cache, url)));
}

self.addEventListener('install', event => event.waitUntil(precacheAppShell()));
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('activate', event => event.waitUntil(
  caches.keys()
    .then(keys => Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE).map(key => caches.delete(key))))
    .then(() => self.clients.claim())
));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/')) return;

  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(event.request);
        if (isCacheableResponse(response)) {
          const cache = await caches.open(CACHE);
          await cache.put(APP_SHELL, response.clone());
        }
        return response;
      } catch {
        return (await caches.open(CACHE)).match(APP_SHELL) || new Response('Нет подключения к интернету', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }
    })());
    return;
  }

  const isStaticAsset = url.pathname.startsWith('/assets/') || STATIC_PATHS.has(url.pathname);
  if (!isStaticAsset) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(event.request);
      if (isCacheableResponse(response)) await cache.put(event.request, response.clone());
      return response;
    } catch {
      return (await cache.match(event.request)) || new Response('', { status: 503 });
    }
  })());
});
self.addEventListener('push', event => { const data = event.data?.json() || {}; event.waitUntil(self.registration.showNotification(data.title || 'LostHvost', { body: data.body, icon: '/losthvost-transparent.png', data: { url: data.url || '/' } })); });
self.addEventListener('notificationclick', event => { event.notification.close(); event.waitUntil(clients.openWindow(event.notification.data?.url || '/')); });
