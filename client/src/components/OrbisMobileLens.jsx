import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const OrbisMobileLens = ({ onClose }) => {
    const { user } = useAuth();

    const [uiState, setUiState]               = useState('loading'); // loading | ready | error
    const [loadingMsg, setLoadingMsg]         = useState('جاري تحميل الذكاء الاصطناعي...');
    const [errorMsg, setErrorMsg]             = useState('');
    const [cameraOn, setCameraOn]             = useState(false);
    const [isLaptopConnected, setIsLaptopConnected] = useState(false);
    const [aiActive, setAiActive]             = useState(false);
    const [trackingLog, setTrackingLog]       = useState([]);

    // Refs – never cause re-renders
    const videoRef        = useRef(null);
    const canvasRef       = useRef(null);
    const modelRef        = useRef(null);
    const socketRef       = useRef(null);
    const gpsRef          = useRef({ lat: 31.9522, lng: 35.2332 });
    const activeTracksRef = useRef([]);
    const historyRef      = useRef({});
    const loopRef         = useRef(false);   // controls the AI loop
    const mountedRef      = useRef(true);    // guards against unmounted state updates

    // ── URL helpers ─────────────────────────────────────────────────────────
    const getUrls = () => {
        const h = window.location.hostname;
        const local = h === 'localhost' || h === '127.0.0.1' ||
                      h.startsWith('192.168.') || h.startsWith('10.');
        if (local) return {
            api:    `${window.location.protocol}//${h}:5000/api`,
            socket: `${window.location.protocol}//${h}:5000`
        };
        return {
            api:    import.meta.env.VITE_API_URL || `${window.location.origin}/api`,
            socket: import.meta.env.VITE_WS_URL  || window.location.origin
        };
    };
    const URLS = getUrls();

    // ── Master effect: runs once on mount ───────────────────────────────────
    useEffect(() => {
        mountedRef.current = true;

        // 1. Load scripts
        const loadScript = (src) => new Promise((res, rej) => {
            if (document.querySelector(`script[src="${src}"]`)) { res(); return; }
            const s = Object.assign(document.createElement('script'), {
                src, async: true, onload: res, onerror: rej
            });
            document.body.appendChild(s);
        });

        const boot = async () => {
            try {
                setLoadingMsg('جاري تحميل TensorFlow.js...');
                await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@3.18.0/dist/tf.min.js');

                setLoadingMsg('جاري تحميل نموذج الكشف...');
                await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.2/dist/coco-ssd.min.js');

                setLoadingMsg('جاري تحميل قراءة اللوحات...');
                await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js');

                // GPU
                if (window.tf) {
                    await window.tf.ready();
                    try { await window.tf.setBackend('webgl'); } catch (_) {}
                }

                setLoadingMsg('جاري تفعيل نموذج الكشف...');
                if (!window.cocoSsd) throw new Error('cocoSsd missing');
                modelRef.current = await window.cocoSsd.load({ base: 'lite_mobilenet_v2' });

                if (!mountedRef.current) return;
                setLoadingMsg('');
                setUiState('ready');

                // 2. Start camera
                await startCamera();

                // 3. Socket
                connectSocket();

            } catch (err) {
                console.error('boot error:', err);
                if (mountedRef.current) {
                    setErrorMsg('فشل التحميل. تحقق من الإنترنت وأعد تحميل الصفحة.');
                    setUiState('error');
                }
            }
        };

        boot();

        // Cleanup on unmount only
        return () => {
            mountedRef.current = false;
            loopRef.current = false;
            stopCamera();
            if (socketRef.current) socketRef.current.disconnect();
        };
    }, []); // ← empty deps: runs ONCE on mount, cleanup ONCE on unmount

    // ── Start camera ────────────────────────────────────────────────────────
    const startCamera = () => new Promise((resolve) => {
        navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false
        }).then(stream => {
            const video = videoRef.current;
            if (!video) { resolve(); return; }

            video.srcObject = stream;

            const onReady = () => {
                video.play()
                    .then(() => {
                        if (mountedRef.current) setCameraOn(true);
                        startLoop();
                        resolve();
                    })
                    .catch(e => { console.warn('play() error:', e); resolve(); });
            };

            if (video.readyState >= 2) { onReady(); }
            else { video.onloadedmetadata = onReady; }

        }).catch(err => {
            console.error('Camera error:', err);
            if (mountedRef.current) {
                setErrorMsg('فشل فتح الكاميرا. امنح صلاحية الكاميرا وتأكد من HTTPS.');
                setUiState('error');
            }
            resolve();
        });
    });

    // ── Stop camera ─────────────────────────────────────────────────────────
    const stopCamera = () => {
        loopRef.current = false;
        const v = videoRef.current;
        if (v?.srcObject) {
            v.srcObject.getTracks().forEach(t => t.stop());
            v.srcObject = null;
        }
    };

    // ── Socket ───────────────────────────────────────────────────────────────
    const connectSocket = () => {
        const socket = io(URLS.socket, { transports: ['websocket'], upgrade: false });
        socketRef.current = socket;
        socket.on('connect', () => {
            socket.emit('orbis-register', { userId: user?.id, role: 'mobile' });
        });
        socket.on('orbis-peer-status', ({ laptopConnected }) => {
            if (mountedRef.current) setIsLaptopConnected(laptopConnected);
        });
    };

    // ── AI detection loop ────────────────────────────────────────────────────
    const startLoop = () => {
        if (loopRef.current) return; // prevent double loops
        loopRef.current = true;

        let lastStream = 0;

        const loop = async () => {
            if (!loopRef.current) return;

            const video  = videoRef.current;
            const canvas = canvasRef.current;

            if (!video || !canvas || !modelRef.current) {
                requestAnimationFrame(loop); return;
            }
            if (video.paused || video.ended || video.readyState < 2 ||
                video.videoWidth === 0 || video.videoHeight === 0) {
                requestAnimationFrame(loop); return;
            }

            // Always sync canvas pixel size to video
            if (canvas.width  !== video.videoWidth)  canvas.width  = video.videoWidth;
            if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;

            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            try {
                const predictions = await modelRef.current.detect(video);
                if (mountedRef.current && !aiActive) setAiActive(true);

                predictions
                    .filter(p => ['car','truck','bus','person'].includes(p.class) && p.score > 0.40)
                    .forEach(pred => {
                        const [x, y, w, h] = pred.bbox;
                        const isVehicle = pred.class !== 'person';
                        const color     = isVehicle ? '#fbab15' : '#a855f7';
                        const label     = isVehicle ? 'مركبة'   : 'إنسان';

                        // centroid tracking
                        const { track } = trackCentroid(pred.class, x, y, w, h);
                        const elapsed   = Date.now() - track.createdTime;
                        const secLeft   = Math.max(0, Math.ceil((3000 - elapsed) / 1000));
                        const status    = track.uploaded ? '✅ تم' : `⏳ ${secLeft}ث`;

                        // ── draw box ──
                        ctx.strokeStyle = color;
                        ctx.lineWidth   = 3;
                        ctx.strokeRect(x, y, w, h);

                        // corner accents
                        const cs = 16;
                        ctx.lineWidth = 5;
                        [[x,y,1,1],[x+w,y,-1,1],[x,y+h,1,-1],[x+w,y+h,-1,-1]].forEach(([cx,cy,sx,sy]) => {
                            ctx.beginPath();
                            ctx.moveTo(cx + sx*cs, cy);
                            ctx.lineTo(cx, cy);
                            ctx.lineTo(cx, cy + sy*cs);
                            ctx.stroke();
                        });

                        // ── draw label ──
                        ctx.lineWidth = 1;
                        const conf  = `${(pred.score*100).toFixed(0)}%`;
                        const msg   = `${label} ${conf} | ${status}`;
                        ctx.font    = 'bold 14px Arial';
                        const tw    = ctx.measureText(msg).width;
                        const lh    = 22;
                        const ly    = Math.max(lh, y - 2);
                        ctx.fillStyle = color;
                        ctx.fillRect(x, ly - lh, tw + 10, lh);
                        ctx.fillStyle = '#0f172a';
                        ctx.fillText(msg, x + 5, ly - 5);

                        // ── trigger upload after 3s focus ──
                        if (elapsed >= 3000 && !track.uploaded) {
                            track.uploaded = true;
                            const objColor = getColor(video, pred.bbox);
                            const dir      = getDirection(track.id, x + w/2);
                            upload(video, pred.bbox, isVehicle ? 'car' : 'person', objColor, dir);
                        }
                    });

                // stream frame to laptop (max 2 FPS)
                const now = Date.now();
                if (now - lastStream > 500 && socketRef.current?.connected && video.videoWidth) {
                    lastStream = now;
                    const sc = document.createElement('canvas');
                    sc.width = 240; sc.height = 180;
                    sc.getContext('2d').drawImage(video, 0, 0, 240, 180);
                    socketRef.current.emit('orbis-frame', { frame: sc.toDataURL('image/jpeg', 0.4) });
                }

            } catch (e) { /* silent */ }

            // ~12 FPS
            setTimeout(() => { if (loopRef.current) requestAnimationFrame(loop); }, 80);
        };

        requestAnimationFrame(loop);
    };

    // ── Centroid tracker ─────────────────────────────────────────────────────
    const trackCentroid = (type, x, y, w, h) => {
        const cx = x + w/2, cy = y + h/2, now = Date.now();
        activeTracksRef.current = activeTracksRef.current.filter(t => now - t.lastSeen < 3500);
        let best = null, bestD = Infinity;
        for (const t of activeTracksRef.current) {
            if (t.type !== type) continue;
            const d = Math.hypot(cx - t.x, cy - t.y);
            if (d < 130 && d < bestD) { bestD = d; best = t; }
        }
        if (best) { best.x = cx; best.y = cy; best.lastSeen = now; return { track: best }; }
        const t = { id: `${type}_${now}`, type, x: cx, y: cy, lastSeen: now, createdTime: now, uploaded: false };
        activeTracksRef.current.push(t);
        return { track: t };
    };

    // ── Color extractor ──────────────────────────────────────────────────────
    const getColor = (video, [x, y, w, h]) => {
        try {
            const c = document.createElement('canvas');
            c.width = 10; c.height = 10;
            c.getContext('2d').drawImage(video, Math.max(0,x+w/2-5), Math.max(0,y+h/2-5), 10, 10, 0, 0, 10, 10);
            const [r, g, b] = c.getContext('2d').getImageData(5, 5, 1, 1).data;
            if (r>210&&g>210&&b>210) return 'أبيض';
            if (r<50&&g<50&&b<50)   return 'أسود';
            if (Math.max(r,g,b)-Math.min(r,g,b)<25) return 'رمادي';
            if (r>g&&r>b) return g>140?'أصفر':g>60?'برتقالي':'أحمر';
            if (g>r&&g>b) return 'أخضر';
            if (b>r&&b>g) return g>120?'سماوي':'أزرق';
            return 'رمادي';
        } catch(_){ return 'غير محدد'; }
    };

    // ── Direction tracker ────────────────────────────────────────────────────
    const getDirection = (id, cx) => {
        if (!historyRef.current[id]) historyRef.current[id] = [];
        const h = historyRef.current[id];
        h.push(cx); if (h.length > 8) h.shift();
        if (h.length < 2) return 'ثابت';
        const d = h[h.length-1] - h[0];
        return Math.abs(d) < 20 ? 'ثابت' : d > 0 ? 'يمين' : 'يسار';
    };

    // ── Upload detection ─────────────────────────────────────────────────────
    const upload = async (video, [x,y,w,h], type, color, direction) => {
        try {
            const sx=Math.max(0,Math.floor(x)), sy=Math.max(0,Math.floor(y));
            const sw=Math.min(Math.floor(w),video.videoWidth-sx);
            const sh=Math.min(Math.floor(h),video.videoHeight-sy);
            const crop = document.createElement('canvas');
            crop.width=sw; crop.height=sh;
            crop.getContext('2d').drawImage(video,sx,sy,sw,sh,0,0,sw,sh);
            const imageBase64 = crop.toDataURL('image/jpeg', 0.9);

            // OCR license plate
            let license = 'Unknown';
            if (type==='car' && window.Tesseract) {
                try {
                    const ph=Math.floor(sh*0.35);
                    const pc=document.createElement('canvas');
                    pc.width=sw; pc.height=ph;
                    pc.getContext('2d').drawImage(video,sx,sy+Math.floor(sh*0.6),sw,ph,0,0,sw,ph);
                    const {data:{text}} = await window.Tesseract.recognize(pc,'eng');
                    const digits = text.replace(/[^0-9A-Za-z]/g,'');
                    if (digits.length>=4) license = digits.toUpperCase();
                } catch(_){}
            }

            const token = localStorage.getItem('token');
            const res = await axios.post(`${URLS.api}/orbis/detections`, {
                object_type: type,
                latitude:    gpsRef.current.lat,
                longitude:   gpsRef.current.lng,
                image_base64: imageBase64,
                metadata: { colors:[color], direction, license_plate:license,
                            model: type==='car'?'Unknown':undefined,
                            detected_at: new Date().toLocaleTimeString('ar-EG') }
            }, { headers: { Authorization:`Bearer ${token}` } });

            const d = res.data;
            if (mountedRef.current) {
                setTrackingLog(prev => [{
                    id: d.id||Date.now(),
                    time: new Date().toLocaleTimeString('ar-EG'),
                    type: type==='car'?'🚗 مركبة':'🧍 شخص',
                    details: `${color} | ${d.metadata?.license_plate||license} | ${direction}`
                }, ...prev].slice(0,20));
            }
            if (socketRef.current?.connected) socketRef.current.emit('orbis-detection', d);
        } catch(err){ console.warn('upload failed:', err.message); }
    };

    // ── GPS ──────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!navigator.geolocation) return;
        const id = navigator.geolocation.watchPosition(
            p => { gpsRef.current = { lat: p.coords.latitude, lng: p.coords.longitude }; },
            () => {},
            { enableHighAccuracy: true, maximumAge: 30000 }
        );
        return () => navigator.geolocation.clearWatch(id);
    }, []);

    // ── Render ───────────────────────────────────────────────────────────────
    return (
        <div style={{
            position:'fixed', inset:0, background:'#090d16', color:'#f1f5f9',
            fontFamily:"'Tajawal','Arial',sans-serif", direction:'rtl',
            display:'flex', flexDirection:'column', zIndex:9999, overflow:'hidden'
        }}>
            {/* Top bar */}
            <div style={{
                padding:'12px 16px', flexShrink:0,
                background:'rgba(15,23,42,0.9)', backdropFilter:'blur(10px)',
                borderBottom:'1px solid rgba(255,255,255,0.08)',
                display:'flex', alignItems:'center', justifyContent:'space-between'
            }}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <span style={{
                        width:11, height:11, borderRadius:'50%', display:'inline-block',
                        background: isLaptopConnected?'#10b981':'#ef4444',
                        boxShadow:`0 0 8px ${isLaptopConnected?'#10b981':'#ef4444'}`
                    }}/>
                    <span style={{fontSize:13,fontWeight:'bold'}}>
                        {isLaptopConnected?'متصل بالمراقبة':'في انتظار اللابتوب'}
                    </span>
                    <span style={{fontSize:11,color:'#64748b',marginRight:4}}>
                        | ذكاء اصطناعي: {aiActive?'🟢 نشط':'🔴 خامل'}
                    </span>
                </div>
                <button
                    onClick={() => { stopCamera(); onClose(); }}
                    style={{
                        background:'rgba(239,68,68,0.15)', border:'1px solid rgba(239,68,68,0.4)',
                        color:'#ef4444', padding:'5px 14px', borderRadius:10,
                        fontSize:13, fontWeight:'bold', cursor:'pointer'
                    }}
                >إغلاق</button>
            </div>

            {/* Viewport */}
            <div style={{flex:1, position:'relative', background:'#000', overflow:'hidden'}}>

                {/* Video — always in DOM */}
                <video
                    ref={videoRef}
                    playsInline muted autoPlay
                    style={{
                        position:'absolute', inset:0,
                        width:'100%', height:'100%',
                        objectFit:'cover',
                        opacity: cameraOn ? 1 : 0
                    }}
                />

                {/* Canvas overlay — pixel dimensions set by JS, CSS just stretches */}
                <canvas
                    ref={canvasRef}
                    style={{
                        position:'absolute', inset:0,
                        width:'100%', height:'100%',
                        pointerEvents:'none', zIndex:2,
                        opacity: cameraOn ? 1 : 0
                    }}
                />

                {/* dot grid */}
                {cameraOn && (
                    <div style={{
                        position:'absolute', inset:0, zIndex:3, pointerEvents:'none',
                        backgroundImage:'radial-gradient(rgba(251,171,21,0.05) 1px,transparent 0)',
                        backgroundSize:'22px 22px'
                    }}/>
                )}

                {/* Loading overlay */}
                {uiState==='loading' && (
                    <div style={{
                        position:'absolute', inset:0, zIndex:10,
                        display:'flex', flexDirection:'column',
                        alignItems:'center', justifyContent:'center', gap:16,
                        background:'#090d16'
                    }}>
                        <div style={{
                            width:48, height:48, borderRadius:'50%',
                            border:'4px solid rgba(251,171,21,0.15)',
                            borderTop:'4px solid #fbab15',
                            animation:'spin 0.9s linear infinite'
                        }}/>
                        <p style={{fontSize:14,color:'#94a3b8',margin:0}}>{loadingMsg}</p>
                        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                    </div>
                )}

                {/* Error overlay */}
                {uiState==='error' && (
                    <div style={{
                        position:'absolute', inset:0, zIndex:10,
                        display:'flex', flexDirection:'column',
                        alignItems:'center', justifyContent:'center',
                        gap:14, padding:24, textAlign:'center'
                    }}>
                        <span style={{fontSize:40}}>⚠️</span>
                        <p style={{color:'#ef4444',fontSize:14,margin:0}}>{errorMsg}</p>
                        <button
                            onClick={()=>window.location.reload()}
                            style={{
                                background:'#fbab15', color:'#0f172a',
                                border:'none', padding:'10px 22px',
                                borderRadius:10, fontWeight:'bold', cursor:'pointer'
                            }}
                        >إعادة التحميل</button>
                    </div>
                )}
            </div>

            {/* Log panel */}
            <div style={{
                background:'rgba(9,13,22,0.97)', flexShrink:0,
                borderTop:'1px solid rgba(255,255,255,0.07)',
                padding:'10px 14px', maxHeight:160, overflowY:'auto'
            }}>
                <p style={{
                    margin:'0 0 6px 0', fontSize:10, color:'#fbab15',
                    fontWeight:'bold', textTransform:'uppercase', letterSpacing:1
                }}>📟 سجل الرصد المباشر:</p>
                {trackingLog.length===0 ? (
                    <p style={{color:'#475569',fontSize:12,margin:0}}>
                        وجّه الكاميرا نحو سيارة أو شخص لبدء الكشف...
                    </p>
                ) : (
                    <div style={{display:'flex',flexDirection:'column',gap:5}}>
                        {trackingLog.map(log=>(
                            <div key={log.id} style={{
                                display:'flex', gap:8, fontSize:11,
                                borderBottom:'1px solid rgba(255,255,255,0.04)', paddingBottom:3
                            }}>
                                <span style={{color:'#64748b'}}>{log.time}</span>
                                <span style={{fontWeight:'bold',color:'#f1f5f9'}}>{log.type}</span>
                                <span style={{color:'#94a3b8'}}>{log.details}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default OrbisMobileLens;
