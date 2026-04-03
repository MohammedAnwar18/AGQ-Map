import api from '../services/api';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || 'BLbvE17NyqUMAFUr15zE9pS4s_a0Mtsm8wYJ6cacnBuDQ6LcVRwcb7id7bGXyQR5ZzL-67KJJJj7KXAQ9Bjlfnk';

/**
 * Convert VAPID public key from base64 to Uint8Array
 */
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

/**
 * Register Service Worker and subscribe to push notifications
 */
export async function subscribeToPushNotifications() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.warn('Push notifications are not supported in this browser');
        return;
    }

    try {
        // 1. Immediately request permission to satisfy Safari User Gesture constraint
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            console.warn('Notification permission denied');
            return;
        }

        // 2. Register Service Worker if not already registered
        const registration = await navigator.serviceWorker.register('/sw.js', {
            scope: '/'
        });
        console.log('Service Worker registered:', registration);

        // 3. Wait for service worker to be ready
        await navigator.serviceWorker.ready;

        // Check if already subscribed
        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
            // Subscribe if not already
            const convertedVapidKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: convertedVapidKey
            });
        }

        // Send subscription to backend
        await api.post('/push/subscribe', { subscription });
        console.log('✅ Subscribed to push notifications successfully');

    } catch (error) {
        console.error('❌ Error subscribing to push notifications:', error);
    }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPushNotifications() {
    try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (!registration) return;

        const subscription = await registration.pushManager.getSubscription();
        if (!subscription) return;

        // Notify backend
        await api.post('/push/unsubscribe', { endpoint: subscription.endpoint });

        // Unsubscribe locally
        await subscription.unsubscribe();
        console.log('✅ Unsubscribed from push notifications');

    } catch (error) {
        console.error('❌ Error unsubscribing from push notifications:', error);
    }
}
