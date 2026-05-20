const CACHE_NAME = 'standalone-offline-gps-v1';

// Assets to cache immediately
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    // Custom fallback image if needed
];

// --- Install Event ---
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

// --- Activate Event ---
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// --- Fetch Event: Intercept network requests to serve cached assets or cache new ones ---
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Cache Map Tiles dynamically (OpenStreetMap tiles)
    if (url.hostname.includes('tile.openstreetmap.org') || url.hostname.includes('unpkg.com')) {
        event.respondWith(
            caches.match(request).then((cachedResponse) => {
                if (cachedResponse) {
                    // Return cached tile, but fetch a fresh one in background to keep it updated (Stale-While-Revalidate)
                    fetch(request).then((networkResponse) => {
                        if (networkResponse.status === 200) {
                            caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
                        }
                    }).catch(() => { /* Ignore background fetch errors offline */ });
                    
                    return cachedResponse;
                }

                // If not cached, fetch and save to cache
                return fetch(request).then((networkResponse) => {
                    if (networkResponse.status === 200) {
                        const responseClone = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
                    }
                    return networkResponse;
                }).catch(() => {
                    // Offline fallback if not in cache
                    return new Response('Offline', { status: 503, statusText: 'Offline Map Tile Unavailable' });
                });
            })
        );
        return;
    }

    // Default network-first with cache fallback strategy for other files
    event.respondWith(
        fetch(request)
            .then((response) => {
                if (request.method === 'GET' && response.status === 200) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
                }
                return response;
            })
            .catch(() => {
                return caches.match(request);
            })
    );
});
