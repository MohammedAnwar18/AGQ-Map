import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// 📍 Temporary Mock for Geolocation to Ramallah (Rukab Street for test1, Al-Manara Square for others)
if (typeof window !== 'undefined' && window.navigator && window.navigator.geolocation) {
    const getCoordinates = () => {
        let lat = 31.9038;
        let lng = 35.2034;
        try {
            const cached = localStorage.getItem('user_cache');
            if (cached) {
                const parsed = JSON.parse(cached);
                if (parsed && parsed.username === 'test1') {
                    // Rukab Street coordinates
                    lat = 31.9046;
                    lng = 35.2022;
                }
            }
        } catch (e) {}
        return { latitude: lat, longitude: lng };
    };

    window.navigator.geolocation.getCurrentPosition = (success, error, options) => {
        const coords = getCoordinates();
        const mockPosition = {
            coords: {
                latitude: coords.latitude,
                longitude: coords.longitude,
                accuracy: 10,
                altitude: null,
                altitudeAccuracy: null,
                heading: null,
                speed: null
            },
            timestamp: Date.now()
        };
        setTimeout(() => success(mockPosition), 50);
    };

    window.navigator.geolocation.watchPosition = (success, error, options) => {
        const coords = getCoordinates();
        const mockPosition = {
            coords: {
                latitude: coords.latitude,
                longitude: coords.longitude,
                accuracy: 10,
                altitude: null,
                altitudeAccuracy: null,
                heading: null,
                speed: null
            },
            timestamp: Date.now()
        };
        const intervalId = setInterval(() => {
            const currentCoords = getCoordinates();
            const currentMockPosition = {
                coords: {
                    latitude: currentCoords.latitude,
                    longitude: currentCoords.longitude,
                    accuracy: 10,
                    altitude: null,
                    altitudeAccuracy: null,
                    heading: null,
                    speed: null
                },
                timestamp: Date.now()
            };
            success(currentMockPosition);
        }, 5000);
        setTimeout(() => success(mockPosition), 50);
        return intervalId;
    };

    window.navigator.geolocation.clearWatch = (id) => {
        clearInterval(id);
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
