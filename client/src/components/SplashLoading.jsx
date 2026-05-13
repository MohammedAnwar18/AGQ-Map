import React from 'react';
import './SplashLoading.css';

const SplashLoading = () => {
    return (
        <div className="splash-screen">
            <div className="splash-content">
                <div className="splash-logo-container">
                    <svg width="120" height="120" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle className="splash-pulse" cx="50" cy="50" r="35" stroke="#fbab15" strokeWidth="2" />
                        <path d="M50 15C36.2 15 25 26.2 25 40C25 58.75 50 85 50 85C50 85 75 58.75 75 40C75 26.2 63.8 15 50 15ZM50 48.75C45.175 48.75 41.25 44.825 41.25 40C41.25 35.175 45.175 31.25 50 31.25C54.825 31.25 58.75 35.175 58.75 40C58.75 44.825 54.825 48.75 50 48.75Z" fill="#fbab15" />
                    </svg>
                </div>
                <h1 className="splash-title">PALNOVAA</h1>
                <div className="splash-loader-bar">
                    <div className="splash-loader-progress"></div>
                </div>
            </div>
        </div>
    );
};

export default SplashLoading;
