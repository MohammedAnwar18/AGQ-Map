import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import './LiveCameraModal.css';

const LiveCameraModal = ({ camera, onClose }) => {
    const videoRef = useRef(null);
    const hlsRef = useRef(null);
    const [isLoading, setIsLoading] = useState(true);
    const [playError, setPlayError] = useState(false);
    const [isCropped, setIsCropped] = useState(camera && camera.crop_position !== 'full');

    useEffect(() => {
        const video = videoRef.current;
        if (!video || !camera) return;

        setIsLoading(true);
        setPlayError(false);

        const streamUrl = camera.stream_url;

        // Reset if existing Hls instance
        if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
        }

        if (Hls.isSupported()) {
            const hls = new Hls({
                maxMaxBufferLength: 10,
                enableWorker: true,
                lowLatencyMode: true
            });
            hlsRef.current = hls;
            hls.loadSource(streamUrl);
            hls.attachMedia(video);
            
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                setIsLoading(false);
                video.play().catch(e => {
                    console.log("Auto-play prevented, requires user interaction", e);
                });
            });

            hls.on(Hls.Events.ERROR, (event, data) => {
                console.error("HLS Error:", data);
                if (data.fatal) {
                    switch (data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            hls.startLoad();
                            break;
                        case Hls.ErrorTypes.MEDIA_ERROR:
                            hls.recoverMediaError();
                            break;
                        default:
                            setPlayError(true);
                            setIsLoading(false);
                            break;
                    }
                }
            });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            // Safari/iOS native playback support
            video.src = streamUrl;
            video.addEventListener('loadedmetadata', () => {
                setIsLoading(false);
                video.play().catch(e => {
                    console.log("Auto-play prevented, requires user interaction", e);
                });
            });
            video.addEventListener('error', () => {
                setPlayError(true);
                setIsLoading(false);
            });
        } else {
            setPlayError(true);
            setIsLoading(false);
        }

        return () => {
            if (hlsRef.current) {
                hlsRef.current.destroy();
                hlsRef.current = null;
            }
        };
    }, [camera]);

    if (!camera) return null;

    // Determine the cropping class based on crop_position & crop state toggle
    const cropClass = isCropped ? (camera.crop_position || 'full') : 'full';

    return (
        <div className="modal-overlay" onClick={onClose} style={{ zIndex: 11000 }}>
            <div 
                className="modal-container camera-modal-content" 
                onClick={e => e.stopPropagation()}
                style={{
                    maxWidth: '800px',
                    width: '90%',
                    background: '#0b0f19',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '24px',
                    overflow: 'hidden',
                    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
                    position: 'relative',
                    direction: 'rtl'
                }}
            >
                {/* Header */}
                <div className="camera-modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span className="live-status-dot"></span>
                        <h3 className="camera-modal-title">
                            {camera.name}
                        </h3>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {camera.crop_position !== 'full' && (
                            <button 
                                onClick={() => setIsCropped(!isCropped)}
                                className="crop-toggle-btn"
                                style={{
                                    background: isCropped ? 'rgba(6, 182, 212, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                                    border: `1px solid ${isCropped ? '#06b6d4' : 'rgba(255, 255, 255, 0.1)'}`,
                                    color: isCropped ? '#06b6d4' : '#94a3b8',
                                    padding: '5px 12px',
                                    borderRadius: '12px',
                                    cursor: 'pointer',
                                    fontSize: '0.8rem',
                                    fontWeight: 'bold',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {isCropped ? '🔍 عرض البث الكامل' : '✂️ تفعيل الاقتصاص'}
                            </button>
                        )}
                        <button onClick={onClose} className="camera-close-btn">
                            ✕
                        </button>
                    </div>
                </div>

                {/* Video Player Box */}
                <div className="camera-modal-body">
                    <div className={`camera-video-wrapper ${cropClass}`}>
                        <video 
                            ref={videoRef} 
                            muted 
                            autoPlay 
                            playsInline 
                            style={{
                                display: playError ? 'none' : 'block'
                            }}
                        />
                    </div>

                    {/* Loading status */}
                    {isLoading && (
                        <div className="camera-loading-overlay">
                            <div className="spinner" style={{ width: '40px', height: '40px', border: '3px solid rgba(6, 182, 212, 0.2)', borderTopColor: '#06b6d4' }}></div>
                            <p style={{ marginTop: '15px', color: '#94a3b8', fontSize: '0.9rem' }}>جاري تحميل البث المباشر...</p>
                        </div>
                    )}

                    {/* Error status */}
                    {playError && (
                        <div className="camera-error-overlay">
                            <span style={{ fontSize: '3rem', marginBottom: '10px' }}>⚠️</span>
                            <h4 style={{ color: '#f8fafc', marginBottom: '8px' }}>فشل تشغيل البث المباشر</h4>
                            <p style={{ color: '#94a3b8', fontSize: '0.9rem', maxWidth: '300px' }}>
                                تعذر الاتصال بمصدر البث. قد تكون الكاميرا غير متصلة بالإنترنت حالياً.
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer metadata */}
                <div className="camera-modal-footer">
                    <span>الإحداثيات الجغرافية: {parseFloat(camera.latitude).toFixed(5)}, {parseFloat(camera.longitude).toFixed(5)}</span>
                    <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{ width: '6px', height: '6px', background: '#10b981', borderRadius: '50%' }}></span>
                        متصل بالبث البلدي المباشر
                    </span>
                </div>
            </div>
        </div>
    );
};

export default LiveCameraModal;
