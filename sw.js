const CACHE_NAME = 'foresee-cache-v2';

const STATIC_ASSETS = [
  'manifest.json',
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // HTML: siempre de la red — nunca servir versión cacheada
  if (event.request.destination === 'document' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Assets estáticos: cache-first
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Cache API solo soporta http/https — algunas extensiones del
        // navegador inyectan pedidos con esquema chrome-extension:// que
        // llegan hasta aquí y rompen cache.put si no se filtran.
        const isHttp = url.protocol === 'http:' || url.protocol === 'https:';
        if (isHttp && response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});

// Push en segundo plano (app/pestaña cerrada) — FCM entrega el payload como
// "data" (no "notification") para tener control total del ícono/click.
self.addEventListener('push', event => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (err) {
    payload = {};
  }
  const data = payload.data || payload;
  const title = data.title || 'Foresee';
  const body = data.body || '';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: 'https://res.cloudinary.com/datwdagbf/image/upload/f_auto,q_auto,c_scale,w_192/v1782545519/Logotipo_Foresee2_vqou8q.png',
      data: { url: data.url || './' },
    })
  );
});

// Al tocar la notificación: enfoca una pestaña existente de la app o abre una nueva.
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || './';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});
