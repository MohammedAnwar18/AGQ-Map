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
    const activeTracksRef = useRef([]);

    const getDynamicUrls = () => {
        const hostname = window.location.hostname;
        const isLocal = hostname === 'localhost' || 
                        hostname === '127.0.0.1' || 
                        hostname.startsWith('192.168.') || 
                        hostname.startsWith('10.') || 
                        (hostname.startsWith('172.') && parseInt(hostname.split('.')[1], 10) >= 16 && parseInt(hostname.split('.')[1], 10) <= 31);
                        
        if (isLocal) {
            return {
                apiUrl: `${window.location.protocol}//${hostname}:5000/api`,
                socketUrl: `${window.location.protocol}//${hostname}:5000`
            };
        }
        
        const apiUrl = import.meta.env.VITE_API_URL || `${window.location.origin}/api`;
        const socketUrl = import.meta.env.VITE_WS_URL || (import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : window.location.origin);
        
        return { apiUrl, socketUrl };
    };

    const { apiUrl: API_URL, socketUrl: SOCKET_URL } = getDynamicUrls();

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
                await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@3.18.0/dist/tf.min.js');
                
                if (!isMounted) return;
                setLoadingMsg('جاري تحميل نموذج COCO-SSD...');
                await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.2/dist/coco-ssd.min.js');

                if (!isMounted) return;
                setLoadingMsg('جاري تحميل محرك قراءة اللوحات (OCR)...');
                await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5.0.5/dist/tesseract.min.js');

                if (!isMounted) return;
                
                // Activate WebGL acceleration
                if (window.tf) {
                    await window.tf.ready();
                    try {
                        await window.tf.setBackend('webgl');
                        console.log('✅ Orbis: WebGL backend activated successfully.');
                    } catch (e) {
                        console.warn('⚠️ Orbis: WebGL not supported, falling back to CPU.');
                    }
                }

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
                
                const handleMetadata = () => {
                    if (videoRef.current) {
                        videoRef.current.play()
                            .then(() => {
                                setCameraActive(true);
                                // Start rendering overlay and running AI
                                requestAnimationFrame(detectLoop);
                                // Start streaming compressed frames to laptop dashboard
                                startFrameStreaming();
                            })
                            .catch(e => console.warn('Autoplay error:', e.message));
                    }
                };

                if (videoRef.current.readyState >= 1) {
                    handleMetadata();
                } else {
                    videoRef.current.onloadedmetadata = handleMetadata;
                }
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

    // Helper: Analyze color from video element crop area
    const getObjectColor = (video, bbox) => {
        try {
            const [x, y, w, h] = bbox;
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = 10;
            tempCanvas.height = 10;
            const tempCtx = tempCanvas.getContext('2d');
            
            // Draw a small 10x10 area from the center of the detected object
            const centerX = Math.max(0, x + w / 2 - 5);
            const centerY = Math.max(0, y + h / 2 - 5);
            
            tempCtx.drawImage(
                video,
                Math.floor(centerX), Math.floor(centerY), 10, 10,
                0, 0, 10, 10
            );
            
            const imgData = tempCtx.getImageData(0, 0, 10, 10).data;
            let rSum = 0, gSum = 0, bSum = 0, count = 0;
            
            for (let i = 0; i < imgData.length; i += 4) {
                rSum += imgData[i];
                gSum += imgData[i+1];
                bSum += imgData[i+2];
                count++;
            }
            
            const r = rSum / count;
            const g = gSum / count;
            const b = bSum / count;

            if (r > 210 && g > 210 && b > 210) return 'أبيض';
            if (r < 50 && g < 50 && b < 50) return 'أسود';
            
            const maxVal = Math.max(r, g, b);
            const minVal = Math.min(r, g, b);
            const diff = maxVal - minVal;
            if (diff < 20) return 'رمادي';
            
            if (r > g && r > b) {
                if (g > 140 && b < 80) return 'أصفر';
                if (g > 60 && g < 140 && b < 60) return 'برتقالي';
                return 'أحمر';
            }
            if (g > r && g > b) {
                if (r > 140 && b < 80) return 'أصفر';
                return 'أخضر';
            }
            if (b > r && b > g) {
                if (g > 120) return 'سماوي';
                return 'أزرق';
            }
            if (r > 120 && b > 120 && g < 100) return 'بنفسجي';
            
            return 'رمادي';
        } catch (e) {
            console.error("Color detection error:", e);
            return 'غير محدد';
        }
    };

    // Helper: Track object centroids for dynamic de-duplication
    const trackCentroid = (type, x, y, w, h) => {
        const cx = x + w / 2;
        const cy = y + h / 2;
        const now = Date.now();
        
        // Clean up tracks older than 2.5 seconds
        activeTracksRef.current = activeTracksRef.current.filter(t => now - t.lastSeen < 2500);

        let closestTrack = null;
        let minDistance = Infinity;

        for (const track of activeTracksRef.current) {
            if (track.type === type) {
                const dist = Math.hypot(cx - track.x, cy - track.y);
                if (dist < minDistance) {
                    minDistance = dist;
                    closestTrack = track;
                }
            }
        }

        const THRESHOLD = 100; // pixels

        if (closestTrack && minDistance < THRESHOLD) {
            closestTrack.x = cx;
            closestTrack.y = cy;
            closestTrack.lastSeen = now;
            return { trackId: closestTrack.id, isNew: false };
        } else {
            const trackId = `${type}_${now}_${Math.floor(Math.random() * 1000)}`;
            const newTrack = { id: trackId, type, x: cx, y: cy, lastSeen: now };
            activeTracksRef.current.push(newTrack);
            return { trackId, isNew: true };
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
        if (!videoRef.current) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;

        // Wait if video frame is not ready or has 0 dimensions
        if (video.paused || video.ended || video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
            requestAnimationFrame(detectLoop);
            return;
        }

        if (!canvas) {
            requestAnimationFrame(detectLoop);
            return;
        }

        const ctx = canvas.getContext('2d');
        
        // Match canvas dimensions to video
        if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
        if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        try {
            // Run prediction
            const predictions = await modelRef.current.detect(video);

            // Filter predictions for cars/people with >45% confidence
            const targets = predictions.filter(p => 
                ['person', 'car', 'truck', 'bus'].includes(p.class) && p.score > 0.45
            );

            targets.forEach((pred, index) => {
                const [x, y, w, h] = pred.bbox;
                const type = pred.class === 'person' ? 'person' : 'car';
                const label = type === 'person' ? 'إنسان' : 'مركبة';
                
                // ── AI Analytics & Centroid Tracking ───────────────────────────────
                const { track } = trackCentroid(type, x, y, w, h);
                const centerX = x + w / 2;

                const primaryColor = getObjectColor(video, pred.bbox);
                const movementDirection = trackDirection(track.id, centerX);

                // Wait 3 seconds of steady tracking before capturing
                const trackDuration = Date.now() - track.createdTime;
                const secondsRemaining = Math.max(0, Math.ceil((3000 - trackDuration) / 1000));
                
                let focusLabel = '';
                if (track.uploaded) {
                    focusLabel = ' ✅ تم الالتقاط';
                } else {
                    focusLabel = ` ⏳ التركيز (${secondsRemaining}ث)`;
                }

                // Bounding Box Colors: Orange for Cars, Purple for People
                const color = type === 'person' ? '#a855f7' : '#fbab15';
                
                // Draw Box
                ctx.strokeStyle = color;
                ctx.lineWidth = 4;
                ctx.strokeRect(x, y, w, h);

                // Draw Label Background
                ctx.fillStyle = color;
                ctx.font = 'bold 16px Tajawal, sans-serif';
                const displayMsg = `${label} ${(pred.score * 100).toFixed(0)}% | ${focusLabel}`;
                const textWidth = ctx.measureText(displayMsg).width;
                ctx.fillRect(x, y - 28, textWidth + 12, 28);

                // Draw Label Text
                ctx.fillStyle = '#020617';
                ctx.fillText(displayMsg, x + 6, y - 8);

                // Trigger upload after 3 seconds focus
                if (trackDuration >= 3000 && !track.uploaded) {
                    track.uploaded = true; // Mark as uploaded to prevent duplicate uploads
                    triggerEventUpload(video, pred.bbox, type, primaryColor, movementDirection);
                }
            });
        } catch (e) {
            console.error('Frame inference error:', e);
        }

        // Schedule next check
        if (videoRef.current) {
            setTimeout(() => {
                requestAnimationFrame(detectLoop);
            }, 60); // Max ~16 FPS to avoid overheating mobile CPU
        }
    };

    // 6. Upload Cropped Image and Metadata to Server
    const triggerEventUpload = async (video, bbox, type, objectColor, direction) => {
        try {
            const [x, y, w, h] = bbox;

            // Safe boundary calculations in case bbox is slightly off-camera
            const srcX = Math.max(0, Math.floor(x));
            const srcY = Math.max(0, Math.floor(y));
            const srcW = Math.min(Math.floor(w), video.videoWidth - srcX);
            const srcH = Math.min(Math.floor(h), video.videoHeight - srcY);

            // Crop object image at exact bounding box resolution (no aspect ratio stretching)
            const cropCanvas = document.createElement('canvas');
            cropCanvas.width = srcW;
            cropCanvas.height = srcH;
            const cropCtx = cropCanvas.getContext('2d');
            
            // Draw cropped video frame without compression distortions
            cropCtx.drawImage(video, srcX, srcY, srcW, srcH, 0, 0, srcW, srcH);
            const imageBase64 = cropCanvas.toDataURL('image/jpeg', 0.9);

            // Run Tesseract.js OCR on the license plate area (typically bottom 40% of the vehicle)
            let licensePlate = undefined;
            if (type === 'car' && window.Tesseract) {
                try {
                    const plateCanvas = document.createElement('canvas');
                    const plateW = srcW;
                    const plateH = Math.floor(srcH * 0.4);
                    plateCanvas.width = plateW;
                    plateCanvas.height = plateH;
                    const plateCtx = plateCanvas.getContext('2d');
                    
                    plateCtx.drawImage(
                        video,
                        srcX, srcY + Math.floor(srcH * 0.55), srcW, plateH,
                        0, 0, plateW, plateH
                    );
                    
                    const ocrResult = await window.Tesseract.recognize(plateCanvas, 'eng');
                    const text = ocrResult.data.text || '';
                    const digits = text.replace(/[^0-9]/g, '');
                    
                    if (digits.length >= 4) {
                        // Format Palestinian plate
                        if (digits.length === 7) {
                            licensePlate = `${digits.substring(0, 3)}-${digits.substring(3, 7)}`;
                        } else if (digits.length === 8) {
                            licensePlate = `${digits.substring(0, 3)}-${digits.substring(3, 5)}-${digits.substring(5, 8)}`;
                        } else {
                            licensePlate = digits;
                        }
                    }
                } catch (ocrErr) {
                    console.warn('Local OCR failed, fallback used:', ocrErr);
                }
            }

            // Assemble Metadata JSON
            const metadata = {
                colors: [objectColor],
                direction: direction,
                license_plate: type === 'car' ? (licensePlate || 'Unknown') : undefined,
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
