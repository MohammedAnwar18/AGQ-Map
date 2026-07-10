import React, { useRef, useState, useEffect } from 'react';
import './Modal.css';

const GeopalViewer = ({ onClose }) => {
    const containerRef = useRef(null);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            containerRef.current?.requestFullscreen().catch(err => {
                console.error("Fullscreen error:", err);
            });
        } else {
            document.exitFullscreen();
        }
    };

    useEffect(() => {
        const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handleFsChange);
        return () => document.removeEventListener('fullscreenchange', handleFsChange);
    }, []);

    return (
        <div className="modal-overlay geomolg-modal-overlay" onClick={onClose}>
            <div className="modal-container geomolg-modal-container" ref={containerRef} onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span>🛰️</span> خريطة جوية 2023 (عقارات بوك)
                    </h2>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        {/* Fullscreen Toggle */}
                        <button 
                            className="btn-fullscreen" 
                            onClick={toggleFullscreen}
                            style={{ 
                                background: 'transparent', border: 'none', color: '#94a3b8', 
                                cursor: 'pointer', display: 'flex', alignItems: 'center',
                                padding: '4px', borderRadius: '4px', transition: 'color 0.2s'
                            }}
                            title="شاشة كاملة"
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
                                {isFullscreen ? (
                                    <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                                ) : (
                                    <path d="M15 3h6v6M9 21H3v-6M21 15v6h-6M3 9V3h6" />
                                )}
                            </svg>
                        </button>
                        <button className="btn-close" onClick={onClose} title="إغلاق">✕</button>
                    </div>
                </div>
                
                <div className="modal-body" style={{ padding: 0, position: 'relative', height: '100%', overflow: 'hidden' }}>
                    <iframe
                        src="https://aqaratbook.com/Geopal2023/"
                        title="AqaratBook Geopal 2023 Map"
                        style={{
                            width: '100%',
                            height: '100%',
                            border: 'none',
                            background: '#0f172a'
                        }}
                        allow="geolocation"
                    />
                    
                    {/* Attribution Badge */}
                    <div style={{
                        position: 'absolute', bottom: '20px', left: '15px',
                        background: 'rgba(15, 23, 42, 0.75)', padding: '6px 12px',
                        borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.1)',
                        zIndex: 100, fontSize: '0.75rem', fontWeight: '700', color: 'rgba(251, 171, 21, 0.9)',
                        backdropFilter: 'blur(10px)',
                        pointerEvents: 'none'
                    }}>
                        AqaratBook Geopal 2023
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GeopalViewer;
