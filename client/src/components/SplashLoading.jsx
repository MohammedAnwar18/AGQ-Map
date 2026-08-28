import React, { useEffect } from 'react';
import './SplashLoading.css';

const SplashLoading = () => {
    useEffect(() => {
        // Safety net: if this component is shown for too long (e.g., failed chunk load),
        // force reload the page so the user doesn't see a permanent black screen.
        const timer = setTimeout(() => {
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then((registrations) => {
                    for (let registration of registrations) {
                        registration.unregister();
                    }
                    window.location.reload(true);
                });
            } else {
                window.location.reload(true);
            }
        }, 12000);
        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="splash-screen">
            <div className="splash-glow" aria-hidden="true"></div>
            <div className="splash-grid" aria-hidden="true"></div>

            <div className="splash-content">
                <div className="splash-ring" aria-hidden="true"></div>
                <div className="splash-ring" aria-hidden="true"></div>
                <div className="splash-ring" aria-hidden="true"></div>

                <div className="splash-logo-tile">
                    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="PalNovaa">
                        <path fill="#FFFFFF" fillRule="evenodd" d="M12 1.6c-4.09 0-7.4 3.31-7.4 7.4 0 5.55 7.4 13.4 7.4 13.4s7.4-7.85 7.4-13.4c0-4.09-3.31-7.4-7.4-7.4Zm0 10.35a2.95 2.95 0 1 1 0-5.9 2.95 2.95 0 0 1 0 5.9Z" />
                    </svg>
                </div>
            </div>

            <div className="splash-footer">
                <div className="splash-progress">
                    <div className="splash-progress-bar"></div>
                </div>
            </div>
        </div>
    );
};

export default SplashLoading;
