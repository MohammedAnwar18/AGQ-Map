import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const OrbisMobileLens = ({ onClose }) => {
    const { user } = useAuth();

    // ── State ──────────────────────────────────────────────────────────────────
    const [phase, setPhase]               = useState('loading'); // loading | ready | active | error
    const [loadingMsg, setLoadingMsg]     = useState('جاري تحميل الذكاء الاصطناعي...');
    const [errorMsg, setErrorMsg]         = useState('');
    const [isLaptopConnected, setIsLaptopConnected] = useState(false);
    const [aiActive, setAiActive]         = useState(false);
    const [trackingLog, setTrackingLog]   = useState([]);

    // ── Refs (never cause re-renders) ──────────────────────────────────────────
    const videoRef        = useRef(null);
    const canvasRef       = useRef(null);
    const modelRef        = useRef(null);
    const socketRef       = useRef(null);
    const gpsRef          = useRef({ lat: 31.9522, lng: 35.2332 });
    const activeTracksRef = useRef([]);
    const historyRef      = useRef({});
    const loopActiveRef   = useRef(false); // prevents multiple loops
    const streamTimerRef  = useRef(null);

    // ── URL helpers ────────────────────────────────────────────────────────────
    const getDynamicUrls = () => {
        const h = window.location.hostname;
        const isLocal = h === 'localhost' || h === '127.0.0.1' ||
                        h.startsWith('192.168.') || h.startsWith('10.');
        if (isLocal) {
            return {
                apiUrl:    `${window.location.protocol}//${h}:5000/api`,
                socketUrl: `${window.location.protocol}//${h}:5000`
            };
        }
        return {
            apiUrl:    import.meta.env.VITE_API_URL || `${window.location.origin}/api`,
            socketUrl: import.meta.env.VITE_WS_URL  || window.location.origin
        };
    };
    const { apiUrl: API_URL, socketUrl: SOCKET_URL } = getDynamicUrls();

    // ── 1. Load AI libraries ───────────────────────────────────────────────────
    useEffect(() => {
        let alive = true;

        const loadScript = (src) => new Promise((res, rej) => {
            if (document.querySelector(`script[src="${src}"]`)) { res(); return; }
            const s = document.createElement('script');
            s.src = src; s.async = true;
            s.onload = res;
            s.onerror = rej;
            document.body.appendChild(s);
        });

        (async () => {
            try {
                setLoadingMsg('جاري تحميل TensorFlow.js...');
                await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@3.18.0/dist/tf.min.js');
                if (!alive) return;

                setLoadingMsg('جاري تحميل نموذج الكشف (COCO-SSD)...');
                await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.2/dist/coco-ssd.min.js');
                if (!alive) return;

                setLoadingMsg('جاري تحميل محرك قراءة اللوحات...');
                await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js');
                if (!alive) return;

                // activate GPU
                if (window.tf) {
                    await window.tf.ready();
                    try { await window.tf.setBackend('webgl'); } catch (_) {}
                }

                setLoadingMsg('جاري تفعيل نموذج الكشف...');
                if (!window.cocoSsd) throw new Error('cocoSsd not found on window');
                modelRef.current = await window.cocoSsd.load({ base: 'lite_mobilenet_v2' });

                if (!alive) return;
                setLoadingMsg('');
                setPhase('ready');
            } catch (err) {
                console.error('AI load error:', err);
                if (alive) {
                    setErrorMsg('فشل تحميل الذكاء الاصطناعي. تحقق من الاتصال بالإنترنت وأعد تحميل الصفحة.');
                    setPhase('error');
                }
            }
        })();

        return () => { alive = false; };
    }, []);

    // ── 2. Socket connection ───────────────────────────────────────────────────
    useEffect(() => {
        if (phase !== 'ready' && phase !== 'active') return;

        const socket = io(SOCKET_URL, { transports: ['websocket'], upgrade: false });
        socketRef.current = socket;

        socket.on('connect', () => {
            socket.emit('orbis-register', { userId: user?.id, role: 'mobile' });
        });
        socket.on('orbis-peer-status', ({ laptopConnected }) => {
            setIsLaptopConnected(laptopConnected);
        });

        return () => socket.disconnect();
    }, [phase]);

    // ── 3. Start camera when ready ─────────────────────────────────────────────
    useEffect(() => {
        if (phase !== 'ready') return;

        const start = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
                    audio: false
                });
                const video = videoRef.current;
                if (!video) return;

                video.srcObject = stream;
                video.setAttribute('playsinline', '');
                video.setAttribute('muted', '');

                video.onloadedmetadata = () => {
                    video.play()
                        .then(() => {
                            setPhase('active');
                        })
                        .catch(e => console.warn('play() rejected:', e));
                };

                // fallback for readyState already ready
                if (video.readyState >= 2) {
                    video.play()
                        .then(() => setPhase('active'))
                        .catch(() => {});
                }
            } catch (err) {
                console.error('Camera error:', err);
                setErrorMsg('فشل فتح الكاميرا. تأكد من منح صلاحية الكاميرا وأن الموقع يعمل عبر HTTPS.');
                setPhase('error');
            }
        };

        // tiny delay so React finishes rendering the <video> element
        const t = setTimeout(start, 200);
        return () => {
            clearTimeout(t);
            // stop stream
            if (videoRef.current?.srcObject) {
                videoRef.current.srcObject.getTracks().forEach(t => t.stop());
            }
        };
    }, [phase]);

    // ── 4. AI detection loop ───────────────────────────────────────────────────
    useEffect(() => {
        if (phase !== 'active') return;
        loopActiveRef.current = true;

        const detectLoop = async () => {
            if (!loopActiveRef.current) return;

            const video  = videoRef.current;
            const canvas = canvasRef.current;
            if (!video || !canvas || !modelRef.current) {
                requestAnimationFrame(detectLoop);
                return;
            }

            // wait for real video pixels
            if (video.paused || video.ended || video.readyState < 2 ||
                video.videoWidth === 0 || video.videoHeight === 0) {
                requestAnimationFrame(detectLoop);
                return;
            }

            // match canvas pixels to video pixels exactly
            if (canvas.width  !== video.videoWidth)  canvas.width  = video.videoWidth;
            if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;

            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            try {
                const predictions = await modelRef.current.detect(video);
                if (!aiActive) setAiActive(true);

                const targets = predictions.filter(p =>
                    ['car', 'truck', 'bus', 'person'].includes(p.class) && p.score > 0.40
                );

                targets.forEach(pred => {
                    const [x, y, w, h] = pred.bbox;
                    const isVehicle    = pred.class !== 'person';
                    const label        = isVehicle ? 'مركبة' : 'إنسان';
                    const boxColor     = isVehicle ? '#fbab15' : '#a855f7';

                    // centroid tracking for 3-second focus timer
                    const { track } = trackCentroid(pred.class, x, y, w, h);
                    const elapsed   = Date.now() - track.createdTime;
                    const secLeft   = Math.max(0, Math.ceil((3000 - elapsed) / 1000));
                    const status    = track.uploaded ? '✅ تم الالتقاط' : `⏳ ${secLeft}ث`;

                    // ─ Draw bounding box ─
                    ctx.strokeStyle = boxColor;
                    ctx.lineWidth   = 3;
                    ctx.strokeRect(x, y, w, h);

                    // corner marks
                    const cs = 18;
                    ctx.lineWidth = 5;
                    [[x,y],[x+w,y],[x,y+h],[x+w,y+h]].forEach(([cx,cy]) => {
                        const sx = cx === x ? 1 : -1;
                        const sy = cy === y ? 1 : -1;
                        ctx.beginPath();
                        ctx.moveTo(cx, cy + sy * cs);
                        ctx.lineTo(cx, cy);
                        ctx.lineTo(cx + sx * cs, cy);
                        ctx.stroke();
                    });

                    // ─ Draw label ─
                    ctx.lineWidth = 1;
                    const conf = `${(pred.score * 100).toFixed(0)}%`;
                    const msg  = `${label} ${conf} | ${status}`;
                    ctx.font   = `bold 15px Arial, sans-serif`;
                    const tw   = ctx.measureText(msg).width;
                    const lh   = 24;
                    const lx   = x;
                    const ly   = Math.max(lh, y - 4);
                    ctx.fillStyle = boxColor;
                    ctx.fillRect(lx, ly - lh, tw + 12, lh);
                    ctx.fillStyle = '#0f172a';
                    ctx.fillText(msg, lx + 6, ly - 6);

                    // ─ Trigger upload after 3 seconds ─
                    if (elapsed >= 3000 && !track.uploaded) {
                        track.uploaded = true;
                        const color = getObjectColor(video, pred.bbox);
                        const dir   = trackDirection(track.id, x + w / 2);
                        triggerUpload(video, pred.bbox, isVehicle ? 'car' : 'person', color, dir);
                    }
                });

                // stream thumbnail to laptop
                streamFrame(video);

            } catch (e) {
                console.warn('detectLoop error:', e);
            }

            // schedule next frame
            setTimeout(() => {
                if (loopActiveRef.current) requestAnimationFrame(detectLoop);
            }, 80); // ~12 FPS
        };

        requestAnimationFrame(detectLoop);

        return () => {
            loopActiveRef.current = false;
        };
    }, [phase]);

    // ── Helper: centroid tracker ───────────────────────────────────────────────
    const trackCentroid = (type, x, y, w, h) => {
        const cx  = x + w / 2;
        const cy  = y + h / 2;
        const now = Date.now();

        // prune stale tracks
        activeTracksRef.current = activeTracksRef.current.filter(t => now - t.lastSeen < 3000);

        let found = null;
        let minD  = Infinity;
        for (const t of activeTracksRef.current) {
            if (t.type !== type) continue;
            const d = Math.hypot(cx - t.x, cy - t.y);
            if (d < 120 && d < minD) { minD = d; found = t; }
        }

        if (found) {
            found.x = cx; found.y = cy; found.lastSeen = now;
            return { track: found };
        }

        const newTrack = {
            id: `${type}_${now}`,
            type,
            x: cx, y: cy,
            lastSeen: now,
            createdTime: now,
            uploaded: false
        };
        activeTracksRef.current.push(newTrack);
        return { track: newTrack };
    };

    // ── Helper: get dominant color ─────────────────────────────────────────────
    const getObjectColor = (video, [x, y, w, h]) => {
        try {
            const tmp = document.createElement('canvas');
            tmp.width = 10; tmp.height = 10;
            const tctx = tmp.getContext('2d');
            const cx = Math.max(0, x + w / 2 - 5);
            const cy = Math.max(0, y + h / 2 - 5);
            tctx.drawImage(video, cx, cy, 10, 10, 0, 0, 10, 10);
            const [r, g, b] = tctx.getImageData(5, 5, 1, 1).data;
            if (r > 210 && g > 210 && b > 210) return 'أبيض';
            if (r < 50  && g < 50  && b < 50)  return 'أسود';
            const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
            if (mx - mn < 25) return 'رمادي';
            if (r > g && r > b) return g > 140 ? 'أصفر' : g > 60 ? 'برتقالي' : 'أحمر';
            if (g > r && g > b) return 'أخضر';
            if (b > r && b > g) return g > 120 ? 'سماوي' : 'أزرق';
            return 'رمادي';
        } catch (_) { return 'غير محدد'; }
    };

    // ── Helper: direction tracker ──────────────────────────────────────────────
    const trackDirection = (id, cx) => {
        if (!historyRef.current[id]) historyRef.current[id] = [];
        const h = historyRef.current[id];
        h.push(cx);
        if (h.length > 8) h.shift();
        if (h.length < 2) return 'ثابت';
        const diff = h[h.length - 1] - h[0];
        return Math.abs(diff) < 20 ? 'ثابت' : diff > 0 ? 'يمين' : 'يسار';
    };

    // ── Helper: stream thumbnail ───────────────────────────────────────────────
    const streamFrame = (() => {
        let lastStream = 0;
        return (video) => {
            const now = Date.now();
            if (now - lastStream < 500) return; // max 2 FPS for streaming
            lastStream = now;
            if (!socketRef.current?.connected || !video.videoWidth) return;
            try {
                const sc = document.createElement('canvas');
                sc.width = 240; sc.height = 180;
                sc.getContext('2d').drawImage(video, 0, 0, 240, 180);
                socketRef.current.emit('orbis-frame', { frame: sc.toDataURL('image/jpeg', 0.4) });
            } catch (_) {}
        };
    })();

    // ── Helper: upload detection ───────────────────────────────────────────────
    const triggerUpload = async (video, [x, y, w, h], type, color, direction) => {
        try {
            const sx = Math.max(0, Math.floor(x));
            const sy = Math.max(0, Math.floor(y));
            const sw = Math.min(Math.floor(w), video.videoWidth  - sx);
            const sh = Math.min(Math.floor(h), video.videoHeight - sy);

            const crop = document.createElement('canvas');
            crop.width = sw; crop.height = sh;
            crop.getContext('2d').drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);
            const imageBase64 = crop.toDataURL('image/jpeg', 0.9);

            // client-side OCR for license plate
            let license = undefined;
            if (type === 'car' && window.Tesseract) {
                try {
                    const pc = document.createElement('canvas');
                    const ph = Math.floor(sh * 0.35);
                    pc.width = sw; pc.height = ph;
                    pc.getContext('2d').drawImage(video, sx, sy + Math.floor(sh * 0.6), sw, ph, 0, 0, sw, ph);
                    const { data: { text } } = await window.Tesseract.recognize(pc, 'eng');
                    const digits = text.replace(/[^0-9A-Za-z]/g, '');
                    if (digits.length >= 4) license = digits.toUpperCase();
                } catch (_) {}
            }

            const token = localStorage.getItem('token');
            const res = await axios.post(`${API_URL}/orbis/detections`, {
                object_type:  type,
                latitude:     gpsRef.current.lat,
                longitude:    gpsRef.current.lng,
                image_base64: imageBase64,
                metadata: {
                    colors:         [color],
                    direction,
                    license_plate:  license || 'Unknown',
                    model:          type === 'car' ? 'Unknown' : undefined,
                    detected_at:    new Date().toLocaleTimeString('ar-EG')
                }
            }, { headers: { Authorization: `Bearer ${token}` } });

            const d = res.data;
            setTrackingLog(prev => [{
                id:      d.id || Date.now(),
                time:    new Date().toLocaleTimeString('ar-EG'),
                type:    type === 'car' ? '🚗 مركبة' : '🧍 شخص',
                details: `${color} | ${d.metadata?.license_plate || ''} | ${direction}`
            }, ...prev].slice(0, 20));

            // notify laptop
            if (socketRef.current?.connected) {
                socketRef.current.emit('orbis-detection', d);
            }
        } catch (err) {
            console.warn('Upload failed:', err.message);
        }
    };

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <div style={{
            position: 'fixed', inset: 0,
            background: '#090d16',
            color: '#f1f5f9',
            fontFamily: "'Tajawal', 'Arial', sans-serif",
            direction: 'rtl',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 9999
        }}>
            {/* ── Top bar ── */}
            <div style={{
                padding: '12px 16px',
                background: 'rgba(15,23,42,0.9)',
                backdropFilter: 'blur(10px)',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                        width: 11, height: 11, borderRadius: '50%',
                        background: isLaptopConnected ? '#10b981' : '#ef4444',
                        boxShadow: `0 0 8px ${isLaptopConnected ? '#10b981' : '#ef4444'}`
                    }} />
                    <span style={{ fontSize: 13, fontWeight: 'bold' }}>
                        {isLaptopConnected ? 'متصل بالمراقبة' : 'في انتظار اللابتوب'}
                    </span>
                    <span style={{ fontSize: 11, color: '#64748b', marginRight: 6 }}>
                        | ذكاء اصطناعي: {aiActive ? '🟢 نشط' : '🔴 خامل'}
                    </span>
                </div>
                <button
                    onClick={() => {
                        loopActiveRef.current = false;
                        if (videoRef.current?.srcObject) {
                            videoRef.current.srcObject.getTracks().forEach(t => t.stop());
                        }
                        onClose();
                    }}
                    style={{
                        background: 'rgba(239,68,68,0.15)',
                        border: '1px solid rgba(239,68,68,0.4)',
                        color: '#ef4444',
                        padding: '5px 14px',
                        borderRadius: 10,
                        fontSize: 13,
                        fontWeight: 'bold',
                        cursor: 'pointer'
                    }}
                >إغلاق</button>
            </div>

            {/* ── Video viewport ── */}
            <div style={{ flex: 1, position: 'relative', background: '#000', overflow: 'hidden' }}>

                {/* video element — always in DOM, hidden until active */}
                <video
                    ref={videoRef}
                    playsInline muted
                    style={{
                        position: 'absolute', inset: 0,
                        width: '100%', height: '100%',
                        objectFit: 'cover',
                        display: phase === 'active' ? 'block' : 'none'
                    }}
                />

                {/* canvas overlay — same position, same size */}
                <canvas
                    ref={canvasRef}
                    style={{
                        position: 'absolute', inset: 0,
                        width: '100%', height: '100%',
                        objectFit: 'cover',
                        pointerEvents: 'none',
                        zIndex: 2,
                        display: phase === 'active' ? 'block' : 'none'
                    }}
                />

                {/* dot grid overlay */}
                {phase === 'active' && (
                    <div style={{
                        position: 'absolute', inset: 0,
                        backgroundImage: 'radial-gradient(rgba(251,171,21,0.06) 1px, transparent 0)',
                        backgroundSize: '22px 22px',
                        pointerEvents: 'none',
                        zIndex: 3
                    }} />
                )}

                {/* Loading overlay */}
                {phase === 'loading' && (
                    <div style={{
                        position: 'absolute', inset: 0,
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center',
                        gap: 16, background: '#090d16'
                    }}>
                        <div style={{
                            width: 48, height: 48,
                            border: '4px solid rgba(251,171,21,0.15)',
                            borderTop: '4px solid #fbab15',
                            borderRadius: '50%',
                            animation: 'spin 0.9s linear infinite'
                        }} />
                        <p style={{ fontSize: 14, color: '#94a3b8', margin: 0 }}>{loadingMsg}</p>
                        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                    </div>
                )}

                {/* Error overlay */}
                {phase === 'error' && (
                    <div style={{
                        position: 'absolute', inset: 0,
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center',
                        gap: 14, padding: 24, textAlign: 'center'
                    }}>
                        <span style={{ fontSize: 40 }}>⚠️</span>
                        <p style={{ color: '#ef4444', fontSize: 14, margin: 0 }}>{errorMsg}</p>
                        <button
                            onClick={() => window.location.reload()}
                            style={{
                                background: '#fbab15', color: '#0f172a',
                                border: 'none', padding: '10px 22px',
                                borderRadius: 10, fontWeight: 'bold', cursor: 'pointer'
                            }}
                        >إعادة التحميل</button>
                    </div>
                )}

                {/* Waiting for camera to activate */}
                {phase === 'ready' && (
                    <div style={{
                        position: 'absolute', inset: 0,
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center', gap: 12
                    }}>
                        <div style={{
                            width: 48, height: 48,
                            border: '4px solid rgba(168,85,247,0.2)',
                            borderTop: '4px solid #a855f7',
                            borderRadius: '50%',
                            animation: 'spin 0.9s linear infinite'
                        }} />
                        <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>جاري تشغيل الكاميرا...</p>
                    </div>
                )}
            </div>

            {/* ── Log panel ── */}
            <div style={{
                background: 'rgba(9,13,22,0.97)',
                borderTop: '1px solid rgba(255,255,255,0.07)',
                padding: '12px 14px',
                maxHeight: 165,
                overflowY: 'auto',
                flexShrink: 0
            }}>
                <p style={{
                    margin: '0 0 8px 0', fontSize: 10,
                    color: '#fbab15', fontWeight: 'bold',
                    textTransform: 'uppercase', letterSpacing: 1
                }}>📟 سجل الرصد المباشر:</p>

                {trackingLog.length === 0 ? (
                    <p style={{ color: '#475569', fontSize: 12, margin: 0 }}>
                        وجّه الكاميرا نحو سيارة أو شخص لبدء الكشف...
                    </p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {trackingLog.map(log => (
                            <div key={log.id} style={{
                                display: 'flex', gap: 8,
                                fontSize: 11,
                                borderBottom: '1px solid rgba(255,255,255,0.04)',
                                paddingBottom: 4
                            }}>
                                <span style={{ color: '#64748b' }}>{log.time}</span>
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
