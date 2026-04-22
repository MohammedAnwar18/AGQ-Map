import React, { useState, useEffect } from 'react';
import './MagazineModal.css';

const MagazineModal = ({ onClose }) => {
    const [loading, setLoading] = useState(true);
    const [progress, setProgress] = useState(0);
    const [showComingSoon, setShowComingSoon] = useState(false);

    useEffect(() => {
        // Simulate loading
        const timer = setInterval(() => {
            setProgress(prev => {
                if (prev >= 100) {
                    clearInterval(timer);
                    setTimeout(() => {
                        setLoading(false);
                        setShowComingSoon(true);
                    }, 500);
                    return 100;
                }
                return prev + 2;
            });
        }, 30);

        return () => clearInterval(timer);
    }, []);

    return (
        <div className="magazine-modal-overlay">
            <button className="magazine-close-btn" onClick={onClose}>×</button>
            
            <div className="magazine-content-wrapper">
                {loading ? (
                    <div className="magazine-loading-overlay">
                        <div className="magazine-progress-bar">
                            <div className="magazine-progress-fill" style={{ width: `${progress}%` }}></div>
                        </div>
                        <span className="magazine-progress-text">جاري التحميل... {progress}%</span>
                    </div>
                ) : (
                    <div className="magazine-coming-soon-overlay fade-in">
                        <h1>قريباً</h1>
                        <p>نعمل حالياً على تجهيز أول عدد...</p>
                        <button className="btn-primary" onClick={onClose}>العودة</button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MagazineModal;
