// Service Worker for Push Notifications
self.addEventListener('push', (event) => {
    let data = { title: 'New Notification', body: 'You have a new notification.' };
    
    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            data = { title: 'New Notification', body: event.data.text() };
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
                // If a window is already open, focus it
                for (let i = 0; i < windowClients.length; i++) {
                    const client = windowClients[i];
                    if (client.url === urlToOpen && 'focus' in client) {
                        return client.focus();
                    }
                }
                // Otherwise open a new window
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
    );
});

// A simple fetch handler is REQUIRED by Chrome/Android to show the "Add to Home Screen" prompt!
self.addEventListener('fetch', (event) => {
    // Just pass through all requests normally
});
