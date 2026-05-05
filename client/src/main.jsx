import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

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
