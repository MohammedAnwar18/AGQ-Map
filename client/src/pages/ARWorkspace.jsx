import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import { useAuth } from '../context/AuthContext';
import { arService } from '../services/api';

export default function ARWorkspace() {
    const navigate = useNavigate();
    const { socket, token } = useAuth();

    // Auto login via pairToken query parameter (mobile scanning)
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const pairToken = params.get('pairToken');
        if (pairToken) {
            localStorage.setItem('token', pairToken);
            window.location.href = window.location.origin + window.location.pathname;
        }
    }, []);

    const [deviceMode, setDeviceMode] = useState(null);
    const [socketConnected, setSocketConnected] = useState(false);
    const [peerConnected, setPeerConnected] = useState(false);
    const [captures, setCaptures] = useState([]);
    const [isCapturing, setIsCapturing] = useState(false);

    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const canvasRef = useRef(null);

    const [showPairModal, setShowPairModal] = useState(false);
    const [qrCodeUrl, setQrCodeUrl] = useState('');

    useEffect(() => {
        if (token && deviceMode === 'desktop') {
            const pairingUrl = `${window.location.origin}/ar-workspace?pairToken=${token}`;
            QRCode.toDataURL(pairingUrl, { width: 256, margin: 2 }, (err, url) => {
                if (!err) setQrCodeUrl(url);
            });
        }
    }, [token, deviceMode]);

    useEffect(() => {
        const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (isTouch || isMobileUA) {
            setDeviceMode('mobile');
        } else {
            setDeviceMode('desktop');
        }
    }, []);

    useEffect(() => {
        if (!socket) return;
        setSocketConnected(socket.connected);

        const handleConnect = () => setSocketConnected(true);
        const handleDisconnect = () => {
            setSocketConnected(false);
            setPeerConnected(false);
        };

        socket.on('connect', handleConnect);
        socket.on('disconnect', handleDisconnect);
        socket.emit('ar-spatial-update', { type: 'ping' });

        return () => {
            socket.off('connect', handleConnect);
            socket.off('disconnect', handleDisconnect);
        };
    }, [socket]);

    useEffect(() => {
        if (!socket) return;

        const handleSpatialUpdate = (data) => {
            if (data.type === 'ping') {
                setPeerConnected(true);
                socket.emit('ar-spatial-update', { type: 'pong' });
                return;
            }
            if (data.type === 'pong') {
                setPeerConnected(true);
                return;
            }

            setPeerConnected(true);

            if (deviceMode === 'desktop') {
                if (data.type === 'snapshot' && data.dataUrl) {
                    const newCap = {
                        id: `cap-${Date.now()}`,
                        dataUrl: data.dataUrl,
                        timestamp: new Date().toLocaleTimeString()
                    };
                    setCaptures(prev => [newCap, ...prev]);
                }
            }
        };

        socket.on('ar-spatial-update', handleSpatialUpdate);
        return () => {
            socket.off('ar-spatial-update', handleSpatialUpdate);
        };
    }, [socket, deviceMode]);

    useEffect(() => {
        if (deviceMode !== 'mobile') return;

        async function initCamera() {
            try {
                const s = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
                    audio: false
                });
                if (videoRef.current) videoRef.current.srcObject = s;
                streamRef.current = s;
            } catch (err) {
                console.error("Camera access failed:", err);
            }
        }
        initCamera();

        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, [deviceMode]);

    const handleSpatialCapture = async () => {
        if (isCapturing || !videoRef.current) return;
        setIsCapturing(true);

        try { if (navigator.vibrate) navigator.vibrate(100); } catch{}

        try {
            const video = videoRef.current;
            const canvas = canvasRef.current || document.createElement('canvas');
            
            let width = video.videoWidth || 640;
            let height = video.videoHeight || 480;
            const maxDim = 640;
            if (width > maxDim || height > maxDim) {
                if (width > height) {
                    height = Math.round((height * maxDim) / width);
                    width = maxDim;
                } else {
                    width = Math.round((width * maxDim) / height);
                    height = maxDim;
                }
            }
            
            canvas.width = width;
            canvas.height = height;
            
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.45);

            let finalImageUrl = null;
            try {
                const response = await arService.uploadSnapshot(dataUrl);
                if (response && response.success) {
                    finalImageUrl = response.imageUrl;
                }
            } catch (uploadErr) {
                console.error("Upload failed, falling back to base64:", uploadErr);
            }

            if (socket) {
                socket.emit('ar-spatial-update', {
                    type: 'snapshot',
                    dataUrl: finalImageUrl || dataUrl
                });
            }
            
            const flash = document.createElement('div');
            flash.style.position = 'absolute';
            flash.style.top = 0; flash.style.left = 0; flash.style.right = 0; flash.style.bottom = 0;
            flash.style.background = 'white';
            flash.style.zIndex = 9999;
            flash.style.opacity = 1;
            flash.style.transition = 'opacity 0.3s';
            document.body.appendChild(flash);
            setTimeout(() => {
                flash.style.opacity = 0;
                setTimeout(() => flash.remove(), 300);
            }, 50);

        } catch (err) {
            console.error("Capture failed:", err);
        } finally {
            setIsCapturing(false);
        }
    };

    return (
        <div className="font-outfit" style={{ background: '#0f172a', minHeight: '100vh', color: 'white', direction: 'rtl' }}>
            
            <header style={{ padding: '15px 25px', background: '#1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <button onClick={() => navigate('/map')} title="العودة للرئيسية" style={{ background: '#334155', border: 'none', color: 'white', padding: '8px 15px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                        العودة
                    </button>
                    <h2 style={{ margin: 0, fontSize: '1.3rem', color: '#fbab15' }}>مستقبل الصور</h2>
                </div>

                <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: socketConnected ? '#10b981' : '#ef4444' }} />
                        <span>{socketConnected ? 'متصل' : 'جاري الاتصال'}</span>
                    </div>
                    {deviceMode === 'desktop' && (
                        <button onClick={() => setShowPairModal(true)} style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 'bold' }}>
                            ربط الهاتف 📱
                        </button>
                    )}
                </div>
            </header>

            {deviceMode === 'mobile' && (
                <div style={{ position: 'relative', height: 'calc(100vh - 70px)', overflow: 'hidden', background: '#000' }}>
                    <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div style={{ position: 'absolute', bottom: '40px', left: '0', right: '0', display: 'flex', justifyContent: 'center' }}>
                        <button 
                            onClick={handleSpatialCapture}
                            disabled={isCapturing}
                            style={{ 
                                width: '75px', height: '75px', borderRadius: '50%', 
                                background: 'rgba(255, 255, 255, 0.9)', border: '6px solid rgba(255, 255, 255, 0.4)', 
                                cursor: 'pointer', transition: 'all 0.2s', opacity: isCapturing ? 0.5 : 1,
                                boxShadow: '0 4px 15px rgba(0,0,0,0.3)'
                            }}
                        />
                    </div>
                </div>
            )}

            {deviceMode === 'desktop' && (
                <div style={{ padding: '30px', maxWidth: '1200px', margin: '0 auto' }}>
                    
                    <div style={{ marginBottom: '30px', borderBottom: '1px solid #334155', paddingBottom: '15px' }}>
                        <h3>الصور المستلمة من الهاتف ({captures.length})</h3>
                    </div>

                    {captures.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '60px', background: '#1e293b', borderRadius: '16px', color: '#94a3b8' }}>
                            <div style={{ fontSize: '3.5rem', marginBottom: '20px' }}>📷</div>
                            <p style={{ fontSize: '1.1rem' }}>بانتظار التقاط صور من كاميرا الهاتف لتظهر هنا...</p>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '25px' }}>
                            {captures.map(cap => (
                                <div key={cap.id} style={{ background: '#1e293b', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 6px 12px rgba(0,0,0,0.15)' }}>
                                    <div style={{ height: '220px', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <img src={cap.dataUrl} alt="Captured" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                                    </div>
                                    <div style={{ padding: '15px', borderTop: '1px solid #334155' }}>
                                        <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>وقت الالتقاط: {cap.timestamp}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {showPairModal && (
                <div onClick={() => setShowPairModal(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
                    <div onClick={e => e.stopPropagation()} style={{ background: '#1e293b', padding: '35px', borderRadius: '20px', maxWidth: '420px', width: '90%', textAlign: 'center', position: 'relative', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }}>
                        <button onClick={() => setShowPairModal(false)} style={{ position: 'absolute', top: '15px', right: '15px', background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.4rem', cursor: 'pointer' }}>✕</button>
                        <h3 style={{ color: '#f8fafc', marginBottom: '15px', fontSize: '1.3rem' }}>ربط كاميرا الهاتف 📱</h3>
                        <p style={{ color: '#94a3b8', marginBottom: '25px', fontSize: '0.95rem', lineHeight: '1.5' }}>امسح الرمز التالي بكاميرا الهاتف للبدء بنقل الصور فوراً:</p>
                        
                        {qrCodeUrl ? (
                            <div style={{ background: 'white', padding: '20px', borderRadius: '16px', display: 'inline-block', marginBottom: '25px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                                <img src={qrCodeUrl} alt="Pairing QR Code" style={{ width: '220px', height: '220px' }} />
                            </div>
                        ) : (
                            <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>جاري توليد الرمز...</div>
                        )}
                        
                        <div style={{ textAlign: 'right' }}>
                            <span style={{ display: 'block', marginBottom: '10px', color: '#94a3b8', fontSize: '0.9rem' }}>أو افتح الرابط التالي يدوياً على الهاتف:</span>
                            <input 
                                type="text" 
                                readOnly 
                                value={`${window.location.origin}/ar-workspace?pairToken=${token}`} 
                                onClick={e => e.target.select()}
                                style={{ width: '100%', padding: '12px', background: '#0f172a', border: '1px solid #334155', color: '#3b82f6', borderRadius: '8px', direction: 'ltr', outline: 'none' }}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
