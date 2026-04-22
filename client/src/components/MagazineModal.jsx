import React, { useState, useEffect } from 'react';
import './MagazineModal.css';

const MagazineModal = ({ onClose }) => {
    const [progress, setProgress] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Simulate loading
        const timer = setInterval(() => {
            setProgress(prev => {
                if (prev >= 100) {
                    clearInterval(timer);
                    // Switch to Coming Soon screen after 100%
                    setTimeout(() => {
                        setLoading(false);
                    }, 400);
                    return 100;
                }
                return prev + 2;
            });
        }, 40); // 2 seconds total

        return () => clearInterval(timer);
    }, []);

    return (
        <div className="magazine-modal-overlay">
            <button className="magazine-close-btn" onClick={onClose}>×</button>
            
            <div className="magazine-components-wrapper">
                {/* Brand Logo & Title */}
                <div className="magazine-brand-section">
                    <svg className="magazine-pin-icon" viewBox="0 0 24 24" fill="white">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                    </svg>
                    <h1 className="magazine-title">مجلة بالنوفا المكانية</h1>
                </div>

                {/* Dynamic Content: Loading or Coming Soon */}
                <div className="magazine-dynamic-content">
                    {loading ? (
                        <div className="magazine-loading-overlay">
                            <div className="magazine-progress-bar">
                                <div className="magazine-progress-fill" style={{ width: `${progress}%` }}></div>
                            </div>
                            <span className="magazine-progress-text">جاري التحميل... {progress}%</span>
                        </div>
                    ) : (
                        <div className="magazine-coming-soon-overlay fade-in">
                            <h2>قريباً</h2>
                            <p>نعمل حالياً على تجهيز العدد الأول لتجربة فريدة من نوعها.</p>
                            <button className="btn-primary" onClick={onClose}>العودة للخريطة</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MagazineModal;

