import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// 📍 Real Geolocation with Intelligent Mock Fallback for Local Testing
if (typeof window !== 'undefined' && window.navigator && window.navigator.geolocation) {
    // Save original browser geolocation APIs
    const originalGeo = {
        getCurrentPosition: window.navigator.geolocation.getCurrentPosition.bind(window.navigator.geolocation),
        watchPosition: window.navigator.geolocation.watchPosition.bind(window.navigator.geolocation),
        clearWatch: window.navigator.geolocation.clearWatch.bind(window.navigator.geolocation)
    };

    const getMockCoordinates = () => {
        let lat = 31.9038;
        let lng = 35.2034;
        try {
            const cached = localStorage.getItem('user_cache');
            if (cached) {
                const parsed = JSON.parse(cached);
                if (parsed) {
                    if (parsed.role === 'admin' || parsed.username === 'admin') {
                        // Al-Irsal Street coordinates
                        lat = 31.9060;
                        lng = 35.2053;
                    } else if (parsed.username === 'test1') {
                        // Rukab Street coordinates
                        lat = 31.9046;
                        lng = 35.2022;
                    }
                }
            }
        } catch (e) {}
        return { latitude: lat, longitude: lng };
    };

    let watchCounter = 1;
    const watchRegistry = new Map();

    window.navigator.geolocation.getCurrentPosition = (success, error, options) => {
        const simulate = localStorage.getItem('simulate_location') === 'true';
        if (simulate) {
            const coords = getMockCoordinates();
            setTimeout(() => success({
                coords: { ...coords, accuracy: 10, altitude: null, altitudeAccuracy: null, heading: null, speed: null },
                timestamp: Date.now()
            }), 50);
            return;
        }

        originalGeo.getCurrentPosition(
            (pos) => {
                // Save successful position to local cache for map initialization
                try {
                    localStorage.setItem('last_user_location', JSON.stringify({
                        latitude: pos.coords.latitude,
                        longitude: pos.coords.longitude
                    }));
                } catch (e) {}
                success(pos);
            },
            (err) => {
                console.warn("Real geolocation failed, falling back to mock:", err);
                const coords = getMockCoordinates();
                success({
                    coords: { ...coords, accuracy: 10, altitude: null, altitudeAccuracy: null, heading: null, speed: null },
                    timestamp: Date.now()
                });
            },
            options
        );
    };

    window.navigator.geolocation.watchPosition = (success, error, options) => {
        const id = watchCounter++;
        const simulate = localStorage.getItem('simulate_location') === 'true';

        if (simulate) {
            const coords = getMockCoordinates();
            const mockPosition = {
                coords: { ...coords, accuracy: 10, altitude: null, altitudeAccuracy: null, heading: null, speed: null },
                timestamp: Date.now()
            };
            const intervalId = setInterval(() => {
                const currentCoords = getMockCoordinates();
                success({
                    coords: { ...currentCoords, accuracy: 10, altitude: null, altitudeAccuracy: null, heading: null, speed: null },
                    timestamp: Date.now()
                });
            }, 5000);
            setTimeout(() => success(mockPosition), 50);
            watchRegistry.set(id, { type: 'mock', intervalId });
            return id;
        }

        try {
            const realId = originalGeo.watchPosition(
                (pos) => {
                    try {
                        localStorage.setItem('last_user_location', JSON.stringify({
                            latitude: pos.coords.latitude,
                            longitude: pos.coords.longitude
                        }));
                    } catch (e) {}
                    success(pos);
                },
                (err) => {
                    console.warn("Real watchPosition failed, falling back to mock:", err);
                    const entry = watchRegistry.get(id);
                    if (entry && entry.type === 'real') {
                        try { originalGeo.clearWatch(entry.realId); } catch (e) {}
                        
                        const coords = getMockCoordinates();
                        success({
                            coords: { ...coords, accuracy: 10, altitude: null, altitudeAccuracy: null, heading: null, speed: null },
                            timestamp: Date.now()
                        });
                        
                        const intervalId = setInterval(() => {
                            const currentCoords = getMockCoordinates();
                            success({
                                coords: { ...currentCoords, accuracy: 10, altitude: null, altitudeAccuracy: null, heading: null, speed: null },
                                timestamp: Date.now()
                            });
                        }, 5000);
                        
                        watchRegistry.set(id, { type: 'mock', intervalId });
                    }
                },
                options
            );
            watchRegistry.set(id, { type: 'real', realId });
        } catch (err) {
            console.error("Error setting up real watchPosition, falling back to mock:", err);
            const coords = getMockCoordinates();
            success({
                coords: { ...coords, accuracy: 10, altitude: null, altitudeAccuracy: null, heading: null, speed: null },
                timestamp: Date.now()
            });
            const intervalId = setInterval(() => {
                const currentCoords = getMockCoordinates();
                success({
                    coords: { ...currentCoords, accuracy: 10, altitude: null, altitudeAccuracy: null, heading: null, speed: null },
                    timestamp: Date.now()
                });
            }, 5000);
            watchRegistry.set(id, { type: 'mock', intervalId });
        }

        return id;
    };

    window.navigator.geolocation.clearWatch = (id) => {
        if (!id) return;
        const entry = watchRegistry.get(id);
        if (entry) {
            if (entry.type === 'real') {
                try { originalGeo.clearWatch(entry.realId); } catch (e) {}
            } else if (entry.type === 'mock') {
                clearInterval(entry.intervalId);
            }
            watchRegistry.delete(id);
        } else {
            clearInterval(id);
            try { originalGeo.clearWatch(id); } catch (e) {}
        }
    };
}


// ✅ Guaranteed Splash Screen Removal - runs as soon as JS loads
// This is the FIRST thing that executes when the bundle loads
setTimeout(() => {
    const splash = document.getElementById('splash-screen');
    if (splash) {
        splash.style.opacity = '0';
        splash.style.transition = 'opacity 0.5s ease';
        splash.style.pointerEvents = 'none';
        setTimeout(() => {
            splash.style.display = 'none';
            document.body.classList.remove('splash-active');
        }, 500);
    }
}, 1800);

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
