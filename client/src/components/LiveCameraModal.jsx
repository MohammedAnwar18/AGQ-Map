import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { cameraService } from '../services/api';
import './LiveCameraModal.css';

const LiveCameraModal = ({ camera, onClose, isAdmin, onCameraUpdated }) => {
    const videoRef = useRef(null);
    const hlsRef = useRef(null);
    const [isLoading, setIsLoading] = useState(true);
    const [playError, setPlayError] = useState(false);
    
    // Admin editing crop position state
    const [currentCrop, setCurrentCrop] = useState(camera?.crop_position || 'full');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (camera) {
            setCurrentCrop(camera.crop_position || 'full');
        }
    }, [camera]);

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

    const handleSaveCrop = async () => {
        setIsSaving(true);
        try {
            await cameraService.update(camera.id, { crop_position: currentCrop });
            alert("تم تحديث وحفظ اقتصاص الكاميرا بنجاح!");
            
            // Update local object
            camera.crop_position = currentCrop;
            
            if (onCameraUpdated) {
                onCameraUpdated();
            }
        } catch (error) {
            console.error("Failed to update crop position:", error);
            alert("حدث خطأ أثناء حفظ اقتصاص الكاميرا");
        } finally {
            setIsSaving(false);
        }
    };

    if (!camera) return null;

    // The crop class maps to the current crop selected state
    const cropClass = currentCrop;

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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {isAdmin ? (
                            <div className="admin-crop-controls" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <select 
                                    value={currentCrop}
                                    onChange={e => setCurrentCrop(e.target.value)}
                                    style={{
                                        background: 'rgba(255, 255, 255, 0.08)',
                                        border: '1px solid rgba(255, 255, 255, 0.15)',
                                        color: '#f8fafc',
                                        padding: '6px 12px',
                                        borderRadius: '12px',
                                        fontSize: '0.85rem',
                                        cursor: 'pointer',
                                        outline: 'none',
                                        transition: 'all 0.2s',
                                        fontFamily: 'inherit'
                                    }}
                                >
                                    <option value="full" style={{ background: '#0b0f19' }}>كامل الشاشة</option>
                                    <option value="cam1" style={{ background: '#0b0f19' }}>كاميرا 1 (أعلى يسار)</option>
                                    <option value="cam2" style={{ background: '#0b0f19' }}>كاميرا 2 (أعلى يمين)</option>
                                    <option value="cam3" style={{ background: '#0b0f19' }}>كاميرا 3 (أسفل يسار)</option>
                                    <option value="cam4" style={{ background: '#0b0f19' }}>كاميرا 4 (أسفل يمين)</option>
                                </select>
                                <button 
                                    onClick={handleSaveCrop}
                                    disabled={isSaving}
                                    className="btn-small btn-accept"
                                    style={{
                                        padding: '6px 15px',
                                        height: '34px',
                                        borderRadius: '12px',
                                        fontSize: '0.85rem',
                                        fontWeight: 'bold',
                                        background: 'linear-gradient(135deg, #10b981, #059669)',
                                        color: '#ffffff',
                                        border: 'none',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    {isSaving ? 'جاري الحفظ...' : '💾 حفظ الاقتصاص'}
                                </button>
                            </div>
                        ) : (
                            camera.crop_position !== 'full' && (
                                <span style={{
                                    fontSize: '0.8rem',
                                    color: '#06b6d4',
                                    background: 'rgba(6, 182, 212, 0.1)',
                                    padding: '4px 10px',
                                    borderRadius: '8px',
                                    fontWeight: 'bold'
                                }}>
                                    🔒 اقتصاص مفروض
                                </span>
                            )
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
