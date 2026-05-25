import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { cameraService } from '../services/api';
import './LiveCameraModal.css';

const LiveCameraModal = ({ camera, onClose, isAdmin, onCameraUpdated }) => {
    const videoRef = useRef(null);
    const hlsRef = useRef(null);
    const wrapperRef = useRef(null);
    const [isLoading, setIsLoading] = useState(true);
    const [playError, setPlayError] = useState(false);
    
    // Admin editing crop position state
    const [currentCrop, setCurrentCrop] = useState(camera?.crop_position || 'full');
    const [isSaving, setIsSaving] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Zoom and pan state
    const [zoomScale, setZoomScale] = useState(1);
    const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    useEffect(() => {
        if (camera) {
            setCurrentCrop(camera.crop_position || 'full');
            setZoomScale(1);
            setPanOffset({ x: 0, y: 0 });
        }
    }, [camera]);

    const adjustZoom = (amount) => {
        setZoomScale(prev => {
            const next = Math.min(Math.max(prev + amount, 1), 4);
            if (next === 1) {
                setPanOffset({ x: 0, y: 0 });
            } else {
                // Adjust pan offsets to keep it within new limits
                const wrapper = wrapperRef.current;
                if (wrapper) {
                    const maxPanX = (wrapper.clientWidth * (next - 1)) / 2;
                    const maxPanY = (wrapper.clientHeight * (next - 1)) / 2;
                    setPanOffset(current => ({
                        x: Math.min(Math.max(current.x, -maxPanX), maxPanX),
                        y: Math.min(Math.max(current.y, -maxPanY), maxPanY)
                    }));
                }
            }
            return next;
        });
    };

    const resetZoom = () => {
        setZoomScale(1);
        setPanOffset({ x: 0, y: 0 });
    };

    const handleMouseDown = (e) => {
        if (zoomScale <= 1 || e.button !== 0) return;
        
        setIsDragging(true);
        setDragStart({
            x: e.clientX - panOffset.x,
            y: e.clientY - panOffset.y
        });
        
        const wrapper = wrapperRef.current;
        if (wrapper) {
            wrapper.dataset.draggedDist = '0';
            wrapper.dataset.startX = String(e.clientX);
            wrapper.dataset.startY = String(e.clientY);
        }
    };

    const handleMouseMove = (e) => {
        if (!isDragging) return;
        
        const wrapper = wrapperRef.current;
        if (!wrapper) return;

        const maxPanX = (wrapper.clientWidth * (zoomScale - 1)) / 2;
        const maxPanY = (wrapper.clientHeight * (zoomScale - 1)) / 2;

        const newX = Math.min(Math.max(e.clientX - dragStart.x, -maxPanX), maxPanX);
        const newY = Math.min(Math.max(e.clientY - dragStart.y, -maxPanY), maxPanY);

        setPanOffset({ x: newX, y: newY });
        
        const startX = parseFloat(wrapper.dataset.startX || '0');
        const startY = parseFloat(wrapper.dataset.startY || '0');
        const dist = Math.sqrt(Math.pow(e.clientX - startX, 2) + Math.pow(e.clientY - startY, 2));
        wrapper.dataset.draggedDist = String(dist);
    };

    const handleMouseUp = (e) => {
        if (!isDragging) return;
        setIsDragging(false);

        const wrapper = wrapperRef.current;
        if (!wrapper) return;

        const draggedDist = parseFloat(wrapper.dataset.draggedDist || '0');
        if (draggedDist < 5) {
            handleFullscreen();
        }
    };

    const handleMouseLeave = () => {
        if (isDragging) {
            setIsDragging(false);
        }
    };

    const handleTouchStart = (e) => {
        if (zoomScale <= 1 || e.touches.length !== 1) return;
        
        setIsDragging(true);
        const touch = e.touches[0];
        setDragStart({
            x: touch.clientX - panOffset.x,
            y: touch.clientY - panOffset.y
        });
        
        const wrapper = wrapperRef.current;
        if (wrapper) {
            wrapper.dataset.draggedDist = '0';
            wrapper.dataset.startX = String(touch.clientX);
            wrapper.dataset.startY = String(touch.clientY);
        }
    };

    const handleTouchMove = (e) => {
        if (!isDragging || e.touches.length !== 1) return;
        
        const touch = e.touches[0];
        const wrapper = wrapperRef.current;
        if (!wrapper) return;

        const maxPanX = (wrapper.clientWidth * (zoomScale - 1)) / 2;
        const maxPanY = (wrapper.clientHeight * (zoomScale - 1)) / 2;

        const newX = Math.min(Math.max(touch.clientX - dragStart.x, -maxPanX), maxPanX);
        const newY = Math.min(Math.max(touch.clientY - dragStart.y, -maxPanY), maxPanY);

        setPanOffset({ x: newX, y: newY });
        
        const startX = parseFloat(wrapper.dataset.startX || '0');
        const startY = parseFloat(wrapper.dataset.startY || '0');
        const dist = Math.sqrt(Math.pow(touch.clientX - startX, 2) + Math.pow(touch.clientY - startY, 2));
        wrapper.dataset.draggedDist = String(dist);
    };

    const handleTouchEnd = (e) => {
        if (!isDragging) return;
        setIsDragging(false);

        const wrapper = wrapperRef.current;
        if (!wrapper) return;

        const draggedDist = parseFloat(wrapper.dataset.draggedDist || '0');
        if (draggedDist < 5) {
            handleFullscreen();
        }
    };

    const handleWrapperClick = (e) => {
        if (e.target.closest('button') || e.target.closest('select') || e.target.closest('.camera-zoom-controls')) {
            return;
        }
        if (zoomScale <= 1) {
            handleFullscreen();
        }
    };

    useEffect(() => {
        const handleFullscreenChange = () => {
            const isCurrentlyFullscreen = !!(
                document.fullscreenElement || 
                document.webkitFullscreenElement || 
                document.mozFullScreenElement || 
                document.msFullscreenElement
            );
            setIsFullscreen(isCurrentlyFullscreen);
            
            // If we exited fullscreen, unlock orientation
            if (!isCurrentlyFullscreen) {
                if (window.screen && window.screen.orientation && window.screen.orientation.unlock) {
                    try {
                        window.screen.orientation.unlock();
                    } catch (e) {
                        console.log("Failed to unlock orientation:", e);
                    }
                }
            }
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
        document.addEventListener('mozfullscreenchange', handleFullscreenChange);
        document.addEventListener('MSFullscreenChange', handleFullscreenChange);

        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
            document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
            document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
        };
    }, []);

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

    const handleFullscreen = async () => {
        const wrapper = wrapperRef.current;
        if (!wrapper) return;

        try {
            if (!document.fullscreenElement && !document.webkitFullscreenElement && !document.mozFullScreenElement && !document.msFullscreenElement) {
                // Request fullscreen on the wrapper to keep the CSS crop active!
                if (wrapper.requestFullscreen) {
                    await wrapper.requestFullscreen();
                } else if (wrapper.webkitRequestFullscreen) { /* Safari */
                    await wrapper.webkitRequestFullscreen();
                } else if (wrapper.mozRequestFullScreen) { /* Firefox */
                    await wrapper.mozRequestFullScreen();
                } else if (wrapper.msRequestFullscreen) { /* IE11 */
                    await wrapper.msRequestFullscreen();
                }

                // Attempt to rotate screen horizontally (landscape) on mobile
                if (window.screen && window.screen.orientation && window.screen.orientation.lock) {
                    await window.screen.orientation.lock('landscape').catch(err => {
                        console.log("Orientation lock not supported or failed:", err);
                    });
                }
            } else {
                if (document.exitFullscreen) {
                    await document.exitFullscreen();
                } else if (document.webkitExitFullscreen) {
                    await document.webkitExitFullscreen();
                } else if (document.mozCancelFullScreen) {
                    await document.mozCancelFullScreen();
                } else if (document.msExitFullscreen) {
                    await document.msExitFullscreen();
                }
            }
        } catch (err) {
            console.error("Fullscreen error:", err);
        }
    };

    if (!camera) return null;

    // The crop class maps to the current crop selected state
    const cropClass = currentCrop;

    return (
        <div className="modal-overlay camera-modal-overlay" onClick={onClose} style={{ zIndex: 11000 }}>
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
                    <div 
                        className={`camera-video-wrapper ${cropClass}`} 
                        ref={wrapperRef}
                        onClick={handleWrapperClick}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseLeave}
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                        style={{
                            cursor: zoomScale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'pointer'
                        }}
                    >
                        <div 
                            className="camera-video-zoom-container"
                            style={{
                                transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomScale})`,
                                transformOrigin: 'center center',
                                transition: isDragging ? 'none' : 'transform 0.15s ease-out'
                            }}
                        >
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

                        {/* Zoom Controls Overlay */}
                        {!playError && !isLoading && (
                            <div className="camera-zoom-controls">
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        adjustZoom(0.25);
                                    }}
                                    title="تكبير"
                                    className="zoom-btn"
                                >
                                    ＋
                                </button>
                                <span className="zoom-value">{zoomScale.toFixed(2)}x</span>
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        adjustZoom(-0.25);
                                    }}
                                    title="تصغير"
                                    className="zoom-btn"
                                    disabled={zoomScale <= 1}
                                >
                                    －
                                </button>
                                {zoomScale > 1 && (
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            resetZoom();
                                        }}
                                        title="إعادة تعيين"
                                        className="zoom-btn reset-btn"
                                    >
                                        ↺
                                    </button>
                                )}
                            </div>
                        )}

                        {!playError && !isLoading && (
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleFullscreen();
                                }}
                                className="fullscreen-video-btn"
                                title={isFullscreen ? "إنهاء ملء الشاشة" : "ملء الشاشة"}
                                style={{
                                    position: 'absolute',
                                    bottom: '10px',
                                    right: '10px',
                                    background: 'rgba(11, 15, 25, 0.6)',
                                    border: '1px solid rgba(255, 255, 255, 0.2)',
                                    color: '#ffffff',
                                    width: '36px',
                                    height: '36px',
                                    borderRadius: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    zIndex: 100,
                                    transition: 'all 0.2s',
                                    backdropFilter: 'blur(4px)'
                                }}
                            >
                                {isFullscreen ? (
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M4 14h6v6m10-6h-6v6M4 10h6V4m10 6h-6V4"></path>
                                    </svg>
                                ) : (
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
                                    </svg>
                                )}
                            </button>
                        )}
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
