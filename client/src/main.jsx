import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// 📍 Temporary Mock for Geolocation to Ramallah City Center (Al-Manara Square)
if (typeof window !== 'undefined' && window.navigator && window.navigator.geolocation) {
    const RAMALLAH_LAT = 31.9038;
    const RAMALLAH_LNG = 35.2034;

    window.navigator.geolocation.getCurrentPosition = (success, error, options) => {
        const mockPosition = {
            coords: {
                latitude: RAMALLAH_LAT,
                longitude: RAMALLAH_LNG,
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
        const mockPosition = {
            coords: {
                latitude: RAMALLAH_LAT,
                longitude: RAMALLAH_LNG,
                accuracy: 10,
                altitude: null,
                altitudeAccuracy: null,
                heading: null,
                speed: null
            },
            timestamp: Date.now()
        };
        const intervalId = setInterval(() => {
            success(mockPosition);
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
