import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import jsQR from 'jsqr';
import './ARView.css';

// ═══════════════════════════════════════════════════════════════
// 🔒 SECURE PROPRIETARY QR ENCRYPTION PROTOCOL
// ═══════════════════════════════════════════════════════════════
const QR_PROTOCOL = {
  /** Obfuscate and generate a secure payload for a marker ID */
  encode(id) {
    const raw = `AGQ_QR:${id}:${Date.now()}`;
    // Simple Base64 obfuscation: encode, reverse, and prefix
    const base64 = btoa(unescape(encodeURIComponent(raw)));
    return 'AGQ_' + base64.split('').reverse().join('');
  },

  /** Decode and validate a secure QR code payload */
  decode(payload) {
    if (!payload || !payload.startsWith('AGQ_')) return null;
    try {
      // Remove prefix, reverse back, and decode Base64
      const base64 = payload.substring(4).split('').reverse().join('');
      const raw = decodeURIComponent(escape(atob(base64)));
      const parts = raw.split(':');
      if (parts[0] === 'AGQ_QR') {
        return {
          id: parts[1],
          timestamp: parseInt(parts[2], 10)
        };
      }
    } catch (e) {
      return null;
    }
    return null;
  }
};

export default function ARView() {
  const navigate = useNavigate();

  // ─ DOM & Stream Refs ─────────────────────────────────────────
  const videoRef = useRef(null);
  const canvasRef = useRef(document.createElement('canvas'));
  const scanTimerRef = useRef(null);

  // ─ State Hooks ───────────────────────────────────────────────
  const [phase, setPhase] = useState('loading'); // loading|active|error
  const [permMsg, setPermMsg] = useState('');
  const [statusMsg, setStatus] = useState('وجه الكاميرا نحو رمز QR المخصص للكشف عن المحتوى 🔍');
  const [scannedItem, setScannedItem] = useState(null);
  const [isScanningPaused, setIsScanningPaused] = useState(false);
  const [scanFlash, setScanFlash] = useState(false);

  // ══════════════════════════════════════════════════════════════
  // 📷 CAMERA INITIALIZATION
  // ══════════════════════════════════════════════════════════════
  const startCamera = useCallback(async () => {
    try {
      if (videoRef.current && videoRef.current.srcObject) {
        return true;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.setAttribute('muted', 'true');
        videoRef.current.setAttribute('autoplay', 'true');
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play().catch(e => {
            console.error('Play error:', e);
            videoRef.current.play().catch(err => console.error('Fallback play failed:', err));
          });
        };
      }
      return true;
    } catch (e) {
      setPermMsg('لم نتمكن من فتح الكاميرا الحية — ' + e.message);
      return false;
    }
  }, []);

  // ══════════════════════════════════════════════════════════════
  // 🔍 QR CODE SCANNING ENGINE
  // ══════════════════════════════════════════════════════════════
  const handleQRDetected = useCallback(async (markerId) => {
    setIsScanningPaused(true);
    setScanFlash(true);
    setTimeout(() => setScanFlash(false), 200);

    // Play visual/haptic beep indicator
    try {
      if (navigator.vibrate) navigator.vibrate(80);
    } catch {}

    setStatus('تم رصد رمز صالح، جارٍ تحميل البيانات...');
    try {
      const base = import.meta.env.VITE_API_URL || '';
      const r = await fetch(`${base}/api/ar/${markerId}`);
      if (!r.ok) {
        throw new Error('لم يتم العثور على معلم مسجل بهذا الرمز');
      }
      const data = await r.json();
      if (data.content) {
        setScannedItem(data.content);
        setStatus('تم الكشف عن المعلم بنجاح! 🎉');
      } else {
        throw new Error('محتوى فارغ');
      }
    } catch (err) {
      alert(err.message || 'فشل تحميل بيانات المعلم');
      setIsScanningPaused(false);
      setStatus('وجه الكاميرا نحو رمز QR المخصص للكشف عن المحتوى 🔍');
    }
  }, []);

  const scanLoop = useCallback(() => {
    if (isScanningPaused) {
      scanTimerRef.current = setTimeout(scanLoop, 400);
      return;
    }

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // video.readyState >= 2 (HAVE_CURRENT_DATA) is sufficient to copy frames on mobile Safari/Chrome
      if (video && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
        const ctx = canvas.getContext('2d');
        
        let width = video.videoWidth;
        let height = video.videoHeight;
        
        // Scale down canvas for lightning-fast QR decoding on mobile CPUs (max 640px dimension)
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
        
        // Draw downscaled frame
        ctx.drawImage(video, 0, 0, width, height);
        const imageData = ctx.getImageData(0, 0, width, height);
        
        // Decode QR Code
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });

        if (code && code.data) {
          const decoded = QR_PROTOCOL.decode(code.data);
          if (decoded && decoded.id) {
            if (decoded.id.startsWith('user_')) {
              const uId = decoded.id.replace('user_', '');
              try {
                if (navigator.vibrate) navigator.vibrate(80);
              } catch {}
              if (videoRef.current && videoRef.current.srcObject) {
                videoRef.current.srcObject.getTracks().forEach(track => track.stop());
              }
              navigate(`/?userId=${uId}`);
              return;
            }
            handleQRDetected(decoded.id);
          } else {
            console.log('Unrecognized standard QR:', code.data);
          }
        }
      }
    } catch (err) {
      console.error('QR Scanner Loop error caught:', err);
    }
    
    // Always schedule next scan to prevent the loop from freezing on canvas/stream exceptions
    scanTimerRef.current = setTimeout(scanLoop, 250);
  }, [isScanningPaused, handleQRDetected]);

  // ══════════════════════════════════════════════════════════════
  // 🚀 Lifecycle Hook
  // ══════════════════════════════════════════════════════════════
  useEffect(() => {
    (async () => {
      setPhase('loading');
      const camOk = await startCamera();
      if (!camOk) {
        setPhase('error');
        return;
      }
      setPhase('active');
    })();

    return () => {
      clearTimeout(scanTimerRef.current);
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
    };
  }, [startCamera]);

  useEffect(() => {
    if (phase === 'active') {
      scanLoop();
    }
    return () => clearTimeout(scanTimerRef.current);
  }, [phase, scanLoop]);

  const handleCloseDetail = () => {
    setScannedItem(null);
    setIsScanningPaused(false);
    setStatus('وجه الكاميرا نحو رمز QR المخصص للكشف عن المحتوى 🔍');
  };

  // ══════════════════════════════════════════════════════════════
  // 🖥️ UI RENDERING
  // ══════════════════════════════════════════════════════════════

  return (
    <div className="ar-root">
      {/* 📹 Live Video Stream Feed - Always mounted so videoRef is never null and stream stays active */}
      <video ref={videoRef} className="ar-video" playsInline muted autoPlay />

      {phase === 'loading' && (
        <div className="ar-loading-overlay">
          <div className="ar-loading-spinner" />
          <p>جارٍ فتح كاميرا الكاشف المخصصة...</p>
        </div>
      )}

      {phase === 'error' && (
        <div className="ar-permission-screen">
          <div className="ar-perm-card error">
            <div className="ar-perm-icon">⚠️</div>
            <h2>فشل تشغيل الكاميرا الحية</h2>
            <p>{permMsg || 'تأكد من إعطاء صلاحيات الكاميرا للمتصفح وتحديث الصفحة.'}</p>
            <button className="ar-perm-btn" onClick={() => navigate(-1)}>رجوع</button>
          </div>
        </div>
      )}

      {phase === 'active' && (
        /* 🎛️ Glass Overlay HUD */
        <div className="ar-overlay">
          {/* Flash screen indicator on detection */}
          <div className={`scan-flash-screen ${scanFlash ? 'active' : ''}`} />

          {/* ─── TOP HUD BAR ─── */}
          <div className="ar-hud-top">
            <button className="ar-back-btn" onClick={() => navigate(-1)} aria-label="Back">
              ✕
            </button>
            
            <div className="ar-status-pill">
              <span className={`ar-gps-dot ${!isScanningPaused ? 'active' : ''}`} />
              <span className="ar-status-text">{statusMsg}</span>
            </div>
          </div>

          {/* ─── SCANNER LASER FRAME INDICATOR ─── */}
          {!scannedItem && (
            <div className="qr-scanner-frame-wrap">
              <div className="qr-scanner-box">
                <div className="corner top-left" />
                <div className="corner top-right" />
                <div className="corner bottom-left" />
                <div className="corner bottom-right" />
                <div className="scanner-laser" />
              </div>
              <p className="qr-scanner-hint">كاشف الرموز الآمنة للشبكة</p>
            </div>
          )}

          {/* ─── SCANNED MARKER DETAIL POPUP PANEL ─── */}
          {scannedItem && (
            <div className="ar-detail-panel" onClick={handleCloseDetail}>
              <div className="ar-detail-card scale-up" onClick={e => e.stopPropagation()}>
                <button className="ar-detail-close" onClick={handleCloseDetail} aria-label="Close details">✕</button>

                {scannedItem.image_url && (
                  <div className="ar-detail-img-wrap">
                    <img src={scannedItem.image_url} alt={scannedItem.title} className="ar-detail-img" />
                  </div>
                )}

                <div className="ar-detail-body">
                  <div className="ar-scan-success-badge">✓ تم الكشف بنجاح</div>
                  <h2 className="ar-detail-title">{scannedItem.title}</h2>
                  
                  {scannedItem.subtitle && (
                    <h4 className="ar-detail-subtitle-text">{scannedItem.subtitle}</h4>
                  )}

                  {scannedItem.content && (
                    <p className="ar-detail-content">{scannedItem.content}</p>
                  )}

                  {scannedItem.era_year && (
                    <div className="ar-detail-badge-row">
                      <span className="ar-detail-era-badge">📅 سنة المعلم: {scannedItem.era_year}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
