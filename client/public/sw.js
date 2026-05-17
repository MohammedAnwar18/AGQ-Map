const CACHE_NAME = 'palnovaa-shell-v2';

// App shell: files that make the app load instantly from home screen
const APP_SHELL = [
    '/',
    '/manifest.json',
    '/logo.png',
    '/favicon.png',
];

// ─── Install: cache app shell ───────────────────────────────────────────────
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
    );
    self.skipWaiting();
});

// ─── Activate: remove old caches ────────────────────────────────────────────
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
            )
        )
    );
    self.clients.claim();
});

// ─── Fetch: smart caching strategy ──────────────────────────────────────────
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Only handle GET requests
    if (request.method !== 'GET') return;

    // Never cache API calls (auth, user data, etc.)
    if (url.pathname.startsWith('/api/') || url.hostname !== self.location.hostname) return;

    // Navigation (page load) → network first, fall back to cached shell
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then(response => {
                    // Cache fresh HTML for next offline load
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put('/', clone));
                    return response;
                })
                .catch(() => caches.match('/'))
        );
        return;
    }

    // Static assets (images, icons, fonts) → cache first, update in background
    if (
        request.destination === 'image' ||
        url.pathname.startsWith('/images/') ||
        url.pathname.startsWith('/assets/') ||
        url.pathname === '/logo.png' ||
        url.pathname === '/favicon.png'
    ) {
        event.respondWith(
            caches.match(request).then(cached => {
                const networkFetch = fetch(request).then(response => {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
                    return response;
                });
                return cached || networkFetch;
            })
        );
        return;
    }

    // JS/CSS bundles → network first with cache fallback (so updates apply)
    if (request.destination === 'script' || request.destination === 'style') {
        event.respondWith(
            fetch(request)
                .then(response => {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
                    return response;
                })
                .catch(() => caches.match(request))
        );
        return;
    }

    // Everything else: network with silent cache fallback
    event.respondWith(
        fetch(request).catch(() => caches.match(request))
    );
});

// ─── Push Notifications ──────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
    let data = { title: 'إشعار جديد', body: 'لديك إشعار جديد.' };

    if (event.data) {
        try {
            data = event.data.json();
        } catch {
            data = { title: 'إشعار جديد', body: event.data.text() };
        }
    }

    const options = {
        body: data.body,
        icon: data.icon || '/logo.png',
        badge: data.badge || '/logo.png',
        data: data.data || {},
        vibrate: [100, 50, 100],
        actions: [
            { action: 'open', title: 'عرض' },
            { action: 'close', title: 'إغلاق' }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const urlToOpen = event.notification.data.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((windowClients) => {
                for (const client of windowClients) {
                    if (client.url === urlToOpen && 'focus' in client) {
                        return client.focus();
                    }
                }
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
    );
});

// ─── Periodic Background Sync (Chrome Android) ──────────────────────────────
self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'session-keepalive') {
        // Silent ping — just to keep service worker alive
        event.waitUntil(Promise.resolve());
    }
});

// ─── Message from app ────────────────────────────────────────────────────────
self.addEventListener('message', (event) => {
    if (event.data === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
