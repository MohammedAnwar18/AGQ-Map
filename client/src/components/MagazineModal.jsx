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
            <div className="magazine-container">
                <button className="magazine-close-btn" onClick={onClose}>×</button>
                
                {loading ? (
                    <div className="magazine-loading-screen">
                        <div className="magazine-cover-preview">
                            <img src="/images/magazine/cover.png" alt="Magazine Cover" />
                        </div>
                        <div className="magazine-loading-content">
                            <h3>جاري فتح المجلة...</h3>
                            <div className="magazine-progress-bar">
                                <div className="magazine-progress-fill" style={{ width: `${progress}%` }}></div>
                            </div>
                            <span className="magazine-progress-text">{progress}%</span>
                        </div>
                    </div>
                ) : (
                    <div className="magazine-content-screen fade-in">
                        <div className="magazine-header">
                            <img src="/images/magazine/cover.png" alt="Mini Cover" className="mini-cover" />
                            <h2>مجلة بالنوفا المكانية</h2>
                        </div>
                        <div className="magazine-coming-soon">
                            <div className="coming-soon-icon">📖</div>
                            <h1>قريباً</h1>
                            <p>نعمل حالياً على تجهيز أول عدد من مجلة بالنوفا المكانية لتجربة فريدة من نوعها.</p>
                            <button className="btn-primary" onClick={onClose}>حسناً، سأنتظر!</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MagazineModal;
