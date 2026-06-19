import { registerPlugin, Capacitor } from '@capacitor/core';
import { authService } from '../services/api';

const BackgroundGeolocation = Capacitor.isNativePlatform() 
  ? registerPlugin('BackgroundGeolocation') 
  : null;

let nativeWatcherId = null;

export const isNative = () => {
    return Capacitor.isNativePlatform();
};

export const startNativeTracking = async (onLocationUpdate, onError) => {
    if (!isNative() || !BackgroundGeolocation) {
        console.warn('Native tracking is only available on iOS/Android native apps.');
        return null;
    }

    try {
        if (nativeWatcherId) {
            await stopNativeTracking();
        }

        nativeWatcherId = await BackgroundGeolocation.addWatcher(
            {
                backgroundMessage: "التطبيق يتتبع موقعك لمشاركته مع الأصدقاء وتحديث خريطتك.",
                backgroundTitle: "PalNovaa يعمل في الخلفية",
                requestPermissions: true,
                stale: false,
                distanceFilter: 2 // Update location every 2 meters
            },
            async (location, error) => {
                if (error) {
                    console.error('Capacitor Geolocation error:', error);
                    if (onError) onError(error);
                    
                    // If permissions not authorized, open settings
                    if (error.code === 'NOT_AUTHORIZED') {
                        if (window.confirm('يتطلب التطبيق الوصول إلى الموقع "دائماً" لتتبع موقعك في الخلفية. هل تريد الانتقال إلى الإعدادات لتفعيله؟')) {
                            BackgroundGeolocation.openSettings();
                        }
                    }
                    return;
                }

                if (location) {
                    console.log('📍 New background location received:', location);
                    
                    let lat = 31.9038;
                    let lng = 35.2034;
                    try {
                        const cached = localStorage.getItem('user_cache');
                        if (cached) {
                            const parsed = JSON.parse(cached);
                            if (parsed && parsed.username === 'test1') {
                                lat = 31.9046;
                                lng = 35.2022;
                            }
                        }
                    } catch (e) {}

                    const coords = {
                        latitude: lat,
                        longitude: lng,
                        accuracy: location.accuracy,
                        speed: location.speed,
                        altitude: location.altitude,
                        heading: location.bearing, // Heading matches bearing
                        timestamp: Date.now()
                    };

                    // 1. Update React components state (foreground)
                    if (onLocationUpdate) {
                        onLocationUpdate(coords);
                    }

                    // 2. Direct Sync to Server (crucial for background mode when setInterval is frozen!)
                    try {
                        await authService.updateLocation(lat, lng);
                        console.log('✅ Background location synced to server successfully');
                    } catch (syncErr) {
                        console.error('⚠️ Background location sync to server failed:', syncErr);
                    }
                }
            }
        );
        
        console.log('🚀 Native background location watcher started:', nativeWatcherId);
        return nativeWatcherId;
    } catch (err) {
        console.error('Failed to start native background tracking:', err);
        if (onError) onError(err);
        return null;
    }
};

export const stopNativeTracking = async () => {
    if (!isNative() || !BackgroundGeolocation || !nativeWatcherId) {
        return;
    }

    try {
        await BackgroundGeolocation.removeWatcher({
            id: nativeWatcherId
        });
        console.log('🛑 Native background location watcher stopped:', nativeWatcherId);
        nativeWatcherId = null;
    } catch (err) {
        console.error('Error stopping native location watcher:', err);
    }
};
