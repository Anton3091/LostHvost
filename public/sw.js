const CACHE = 'losthvost-shell-v2';
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(['/', '/manifest.webmanifest', '/losthvost.png']))));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))));
self.addEventListener('fetch', event => { if (event.request.method !== 'GET' || new URL(event.request.url).pathname.startsWith('/api/')) return; event.respondWith(fetch(event.request).then(response => { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy)); return response; }).catch(() => caches.match(event.request))); });
self.addEventListener('push', event => { const data = event.data?.json() || {}; event.waitUntil(self.registration.showNotification(data.title || 'LostHvost', { body: data.body, icon: '/losthvost.png', data: { url: data.url || '/' } })); });
self.addEventListener('notificationclick', event => { event.notification.close(); event.waitUntil(clients.openWindow(event.notification.data?.url || '/')); });
