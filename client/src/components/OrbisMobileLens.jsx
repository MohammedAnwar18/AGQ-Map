import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const OrbisMobileLens = ({ onClose }) => {
    const { user } = useAuth();
    const [modelLoaded, setModelLoaded] = useState(false);
    const [loadingMsg, setLoadingMsg] = useState('جاري تحميل مكتبات الذكاء الاصطناعي...');
    const [cameraActive, setCameraActive] = useState(false);
    const [isLaptopConnected, setIsLaptopConnected] = useState(false);
    const [trackingLog, setTrackingLog] = useState([]);
    const [cameraError, setCameraError] = useState(null);

    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const socketRef = useRef(null);
    const trackerRef = useRef({}); // Tracks detected objects for cooldowns
    const historyRef = useRef({}); // Tracks horizontal centers for direction
    const streamIntervalRef = useRef(null);
    const modelRef = useRef(null);
    const gpsRef = useRef({ lat: 31.9522, lng: 35.2332 }); // Ramallah default

    const API_URL = import.meta.env.VITE_API_URL || '/api';
    const SOCKET_URL = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : window.location.origin;

    // 1. Load TensorFlow.js and COCO-SSD dynamically
    useEffect(() => {
        let isMounted = true;

        const loadScript = (src) => {
            return new Promise((resolve, reject) => {
                if (document.querySelector(`script[src="${src}"]`)) {
                    resolve();
                    return;
                }
                const script = document.createElement('script');
                script.src = src;
                script.async = true;
                script.onload = () => resolve();
                script.onerror = (err) => reject(err);
                document.body.appendChild(script);
            });
        };

        const initAI = async () => {
            try {
                setLoadingMsg('جاري تحميل TensorFlow.js...');
                await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.10.0/dist/tf.min.js');
                
                if (!isMounted) return;
                setLoadingMsg('جاري تحميل نموذج COCO-SSD...');
                await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js');

                if (!isMounted) return;
                if (window.cocoSsd) {
                    setLoadingMsg('جاري تفعيل نموذج كشف الكائنات...');
                    modelRef.current = await window.cocoSsd.load({
                        base: 'lite_mobilenet_v2' // Lightweight for mobile devices
                    });
                    setModelLoaded(true);
                    setLoadingMsg('');
                } else {
                    throw new Error('Failed to bind COCO-SSD model to window object.');
                }
            } catch (err) {
                console.error('AI loading error:', err);
                if (isMounted) {
                    setCameraError('فشل تحميل محرك الذكاء الاصطناعي. يرجى التحقق من اتصال الإنترنت.');
                }
            }
        };

        initAI();

        // 2. Setup Geolocation Tracking
        let watchId = null;
        if (navigator.geolocation) {
            watchId = navigator.geolocation.watchPosition(
                (pos) => {
                    gpsRef.current = {
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude
                    };
                },
                (err) => console.warn('GPS Error:', err.message),
                { enableHighAccuracy: true, maximumAge: 30000, timeout: 27000 }
            );
        }

        return () => {
            isMounted = false;
            if (watchId) navigator.geolocation.clearWatch(watchId);
        };
    }, []);

    // 3. Connect Socket and setup Streaming
    useEffect(() => {
        if (!modelLoaded) return;

        // Establish Socket Connection
        const socket = io(SOCKET_URL, {
            transports: ['websocket'],
            upgrade: false
        });
        socketRef.current = socket;

        socket.on('connect', () => {
            console.log('Orbis Mobile Socket connected:', socket.id);
            socket.emit('orbis-register', { userId: user.id, role: 'mobile' });
        });

        socket.on('orbis-peer-status', ({ laptopConnected }) => {
            setIsLaptopConnected(laptopConnected);
        });

        // Initialize Camera Stream
        startCamera();

        return () => {
            stopCamera();
            if (socket) socket.disconnect();
        };
    }, [modelLoaded]);

    const startCamera = async () => {
        try {
            setCameraError(null);
            const constraints = {
                video: {
                    facingMode: 'environment', // Rear camera
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    frameRate: { ideal: 24 }
                },
                audio: false
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.onloadedmetadata = () => {
                    videoRef.current.play();
                    setCameraActive(true);
                    
                    // Start rendering overlay and running AI
                    requestAnimationFrame(detectLoop);

                    // Start streaming compressed frames to laptop dashboard
                    startFrameStreaming();
                };
            }
        } catch (err) {
            console.error('Camera capture error:', err);
            setCameraError('فشل فتح الكاميرا. تأكد من إعطاء الصلاحيات الكافية واستخدام بروتوكول HTTPS.');
        }
    };

    const stopCamera = () => {
        if (streamIntervalRef.current) {
            clearInterval(streamIntervalRef.current);
        }
        if (videoRef.current && videoRef.current.srcObject) {
            videoRef.current.srcObject.getTracks().forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }
        setCameraActive(false);
    };

    // 4. Send low-res frames via socket to Laptop picture-in-picture
    const startFrameStreaming = () => {
        const streamCanvas = document.createElement('canvas');
        streamCanvas.width = 240;
        streamCanvas.height = 180;
        const streamCtx = streamCanvas.getContext('2d');

        streamIntervalRef.current = setInterval(() => {
            if (videoRef.current && cameraActive && socketRef.current?.connected) {
                streamCtx.drawImage(videoRef.current, 0, 0, streamCanvas.width, streamCanvas.height);
                const jpegBase64 = streamCanvas.toDataURL('image/jpeg', 0.4); // High compression for low latency
                socketRef.current.emit('orbis-frame', jpegBase64);
            }
        }, 150); // ~6.7 FPS
    };

    // Helper: Analyze color from crop area
    const getObjectColor = (ctx, x, y, width, height) => {
        try {
            const centerX = Math.floor(x + width / 2);
            const centerY = Math.floor(y + height / 2);
            const samplePoints = [
                { x: centerX, y: centerY },
                { x: Math.max(0, centerX - 10), y: centerY },
                { x: Math.min(ctx.canvas.width - 1, centerX + 10), y: centerY },
                { x: centerX, y: Math.max(0, centerY - 10) },
                { x: centerX, y: Math.min(ctx.canvas.height - 1, centerY + 10) }
            ];

            let rSum = 0, gSum = 0, bSum = 0, count = 0;
            for (const pt of samplePoints) {
                const pixel = ctx.getImageData(pt.x, pt.y, 1, 1).data;
                rSum += pixel[0];
                gSum += pixel[1];
                bSum += pixel[2];
                count++;
            }
            const r = rSum / count;
            const g = gSum / count;
            const b = bSum / count;

            if (r > 200 && g > 200 && b > 200) return 'أبيض';
            if (r < 55 && g < 55 && b < 55) return 'أسود';
            if (Math.abs(r - g) < 20 && Math.abs(g - b) < 20 && Math.abs(r - b) < 20) return 'رمادي';
            
            if (r > g && r > b) {
                if (g > 140 && b < 70) return 'أصفر';
                return 'أحمر';
            }
            if (g > r && g > b) return 'أخضر';
            if (b > r && b > g) return 'أزرق';
            
            return 'متعدد الألوان';
        } catch (e) {
            return 'غير محدد';
        }
    };

    // Helper: Track motion direction
    const trackDirection = (objId, currentCenterX) => {
        if (!historyRef.current[objId]) {
            historyRef.current[objId] = [];
        }
        const history = historyRef.current[objId];
        history.push(currentCenterX);
        if (history.length > 5) history.shift();

        if (history.length < 2) return 'ثابت';

        const diff = history[history.length - 1] - history[0];
        if (Math.abs(diff) < 20) return 'ثابت';
        return diff > 0 ? 'يمين' : 'يسار';
    };

    // 5. Main AI Loop running COCO-SSD
    const detectLoop = async () => {
        if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        
        // Match canvas dimensions to video
        if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
        if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        try {
            // Run prediction
            const predictions = await modelRef.current.detect(video);

            // Filter predictions for cars/people with >60% confidence
            const targets = predictions.filter(p => 
                ['person', 'car', 'truck', 'bus'].includes(p.class) && p.score > 0.60
            );

            targets.forEach((pred, index) => {
                const [x, y, w, h] = pred.bbox;
                const type = pred.class === 'person' ? 'person' : 'car';
                const label = type === 'person' ? 'إنسان' : 'مركبة';

                // Bounding Box Colors: Orange for Cars, Purple for People
                const color = type === 'person' ? '#a855f7' : '#fbab15';
                
                // Draw Box
                ctx.strokeStyle = color;
                ctx.lineWidth = 4;
                ctx.strokeRect(x, y, w, h);

                // Draw Label Background
                ctx.fillStyle = color;
                ctx.font = 'bold 16px Tajawal, sans-serif';
                const textWidth = ctx.measureText(`${label} ${(pred.score * 100).toFixed(0)}%`).width;
                ctx.fillRect(x, y - 28, textWidth + 12, 28);

                // Draw Label Text
                ctx.fillStyle = '#020617';
                ctx.fillText(`${label} ${(pred.score * 100).toFixed(0)}%`, x + 6, y - 8);

                // ── AI Analytics pipeline ───────────────────────────────
                const objectId = `${type}_${Math.floor(x/30)}_${Math.floor(y/30)}`;
                const centerX = x + w / 2;

                const primaryColor = getObjectColor(ctx, x, y, w, h);
                const movementDirection = trackDirection(objectId, centerX);

                // Track upload cooldown (avoid spamming, upload once every 7s per object)
                const now = Date.now();
                const lastUpload = trackerRef.current[objectId] || 0;

                if (now - lastUpload > 7000) {
                    trackerRef.current[objectId] = now;
                    triggerEventUpload(video, pred.bbox, type, primaryColor, movementDirection);
                }
            });
        } catch (e) {
            console.error('Frame inference error:', e);
        }

        // Keep loop alive
        if (cameraActive) {
            setTimeout(() => {
                requestAnimationFrame(detectLoop);
            }, 60); // Max ~16 FPS to avoid overheating mobile CPU
        }
    };

    // 6. Upload Cropped Image and Metadata to Server
    const triggerEventUpload = async (video, bbox, type, objectColor, direction) => {
        try {
            const [x, y, w, h] = bbox;

            // Crop object image using secondary canvas
            const cropCanvas = document.createElement('canvas');
            cropCanvas.width = Math.min(w, 400);
            cropCanvas.height = Math.min(h, 400);
            const cropCtx = cropCanvas.getContext('2d');
            
            // Draw cropped video frame
            cropCtx.drawImage(
                video,
                Math.max(0, x), Math.max(0, y), Math.min(w, video.videoWidth - x), Math.min(h, video.videoHeight - y),
                0, 0, cropCanvas.width, cropCanvas.height
            );

            const imageBase64 = cropCanvas.toDataURL('image/jpeg', 0.85);

            // Assemble Metadata JSON
            const metadata = {
                colors: [objectColor],
                direction: direction,
                license_plate: type === 'car' ? 'Unknown' : undefined, // server fills in random simulated OCR
                model: type === 'car' ? 'Unknown' : undefined,
                detected_at: new Date().toLocaleTimeString('ar-EG')
            };

            // Post detection to backend database
            const token = localStorage.getItem('token');
            const response = await axios.post(`${API_URL}/orbis/detections`, {
                object_type: type,
                latitude: gpsRef.current.lat,
                longitude: gpsRef.current.lng,
                image_base64: imageBase64,
                metadata: metadata
            }, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            const newLog = {
                id: response.data.id,
                time: new Date().toLocaleTimeString('ar-EG'),
                type: type === 'person' ? 'إنسان' : 'مركبة',
                details: type === 'person' 
                    ? `اللون: ${objectColor} | الحركة: ${direction}` 
                    : `اللون: ${objectColor} | اللوحة: ${response.data.metadata.license_plate}`
            };

            setTrackingLog(prev => [newLog, ...prev.slice(0, 4)]);

        } catch (err) {
            console.error('Failed uploading detection event:', err.message);
        }
    };

    return (
        <div className="orbis-mobile-lens" style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: '#020617',
            color: '#f8fafc',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            fontFamily: 'Tajawal, sans-serif',
            overflow: 'hidden'
        }}>
            {/* Header Status Bar */}
            <div style={{
                padding: '1.25rem 1.5rem',
                background: 'rgba(15, 23, 42, 0.85)',
                backdropFilter: 'blur(10px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        backgroundColor: isLaptopConnected ? '#10b981' : '#ef4444',
                        display: 'inline-block',
                        boxShadow: isLaptopConnected ? '0 0 10px #10b981' : '0 0 10px #ef4444'
                    }}></span>
                    <span style={{ fontSize: '14px', fontWeight: 'bold' }}>
                        {isLaptopConnected ? 'متصل بنظام المراقبة' : 'في انتظار اللابتوب...'}
                    </span>
                </div>
                <button 
                    onClick={() => { stopCamera(); onClose(); }}
                    style={{
                        background: 'rgba(239, 68, 68, 0.2)',
                        border: '1px solid rgba(239, 68, 68, 0.4)',
                        color: '#ef4444',
                        padding: '6px 14px',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: 'bold'
                    }}
                >
                    إغلاق العدسة
                </button>
            </div>

            {/* Error or Loading overlays */}
            {cameraError && (
                <div style={{
                    position: 'absolute',
                    top: '25%',
                    left: '5%',
                    width: '90%',
                    background: 'rgba(220, 38, 38, 0.9)',
                    border: '1px solid #ef4444',
                    padding: '20px',
                    borderRadius: '20px',
                    zIndex: 100,
                    textAlign: 'center'
                }}>
                    <h3 style={{ margin: '0 0 10px 0' }}>⚠️ خطأ في الكاميرا</h3>
                    <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.5' }}>{cameraError}</p>
                    <button 
                        onClick={startCamera} 
                        style={{
                            marginTop: '15px',
                            background: '#fff',
                            color: '#ef4444',
                            border: 'none',
                            padding: '8px 18px',
                            borderRadius: '10px',
                            fontWeight: 'bold'
                        }}
                    >
                        إعادة المحاولة
                    </button>
                </div>
            )}

            {loadingMsg && (
                <div style={{
                    position: 'absolute',
                    top: 0, left: 0, width: '100%', height: '100%',
                    background: '#090d16',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    zIndex: 90
                }}>
                    <div className="spinner" style={{
                        width: '50px', height: '50px',
                        border: '5px solid rgba(251, 171, 21, 0.1)',
                        borderTop: '5px solid #fbab15',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                        marginBottom: '20px'
                    }}></div>
                    <p style={{ color: '#94a3b8', fontSize: '15px', fontWeight: 'bold' }}>{loadingMsg}</p>
                    <style>{`
                        @keyframes spin {
                            0% { transform: rotate(0deg); }
                            100% { transform: rotate(360deg); }
                        }
                    `}</style>
                </div>
            )}

            {/* Camera Viewport Area */}
            <div style={{
                flex: 1,
                position: 'relative',
                width: '100%',
                backgroundColor: '#000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                <video 
                    ref={videoRef}
                    playsInline
                    muted
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: cameraActive ? 'block' : 'none'
                    }}
                />
                
                <canvas 
                    ref={canvasRef}
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        pointerEvents: 'none',
                        zIndex: 2
                    }}
                />

                {/* Grid Overlay for Tech aesthetics */}
                <div style={{
                    position: 'absolute',
                    top: 0, left: 0, width: '100%', height: '100%',
                    backgroundImage: 'radial-gradient(rgba(251, 171, 21, 0.05) 1px, transparent 0)',
                    backgroundSize: '24px 24px',
                    pointerEvents: 'none',
                    zIndex: 3
                }}></div>
            </div>

            {/* Diagnostics Panel (Logs overlay on bottom) */}
            <div style={{
                background: 'rgba(9, 13, 22, 0.95)',
                backdropFilter: 'blur(20px)',
                padding: '1.25rem',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                maxHeight: '180px',
                overflowY: 'auto'
            }}>
                <p style={{
                    margin: '0 0 10px 0',
                    fontSize: '11px',
                    color: '#fbab15',
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    letterSpacing: '1px'
                }}>📟 سجل الرصد المباشر (الأحدث):</p>
                {trackingLog.length === 0 ? (
                    <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>وجه الكاميرا نحو الشارع لكشف المارة والمركبات...</p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {trackingLog.map((log) => (
                            <div 
                                key={log.id} 
                                style={{ 
                                    display: 'flex', 
                                    justifyContent: 'space-between', 
                                    fontSize: '12px',
                                    borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
                                    paddingBottom: '4px'
                                }}
                            >
                                <span style={{ color: '#a855f7' }}>[{log.time}]</span>
                                <span style={{ fontWeight: 'bold', color: '#f1f5f9' }}>{log.type}</span>
                                <span style={{ color: '#94a3b8' }}>{log.details}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default OrbisMobileLens;
