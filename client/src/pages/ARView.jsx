import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './ARView.css';

// ═══════════════════════════════════════════════════════════════
// 📐 GEOSPATIAL MATH UTILITIES
// ═══════════════════════════════════════════════════════════════
const GEO = {
  /** Calculate Bearing (0-360 degrees) from Point A to Point B */
  bearing(lat1, lng1, lat2, lng2) {
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  },

  /** Calculate Haversine distance in meters */
  distance(lat1, lng1, lat2, lng2) {
    const R = 6371000; // Earth radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  },

  /** Calculate signed angle difference between -180 and 180 */
  angleDiff(target, current) {
    let d = ((target - current) % 360 + 360) % 360;
    return d > 180 ? d - 360 : d;
  },

  /** Format distance nicely in Arabic */
  fmt(m) {
    return m < 1000 ? `${Math.round(m)} متر` : `${(m / 1000).toFixed(1)} كم`;
  }
};

export default function ARView() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // ─ DOM Refs ──────────────────────────────────────────────────
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const touchStartRef = useRef(null);

  // ─ Sensor States ─────────────────────────────────────────────
  const [compass, setCompass] = useState(0);       // Raw Heading/yaw from sensors
  const [swipeOffset, setSwipeOffset] = useState(0); // Manual drag swipe rotation (in degrees)
  const [beta, setBeta] = useState(90);            // Pitch/tilt (90 is upright vertical)
  const [userPos, setUserPos] = useState(null);
  const [watchId, setWatchId] = useState(null);
  const [isFallbackMode, setIsFallbackMode] = useState(false);

  // ─ App States ────────────────────────────────────────────────
  const [phase, setPhase] = useState('permission'); // permission|loading|active|error
  const [permMsg, setPermMsg] = useState('');
  const [statusMsg, setStatus] = useState('جارٍ تحديد موقعك الجغرافي...');
  const [arItems, setArItems] = useState([]);
  const [visibleItems, setVisibleItems] = useState([]);
  const [activeItem, setActiveItem] = useState(null);
  const [iOSPerm, setIOSPerm] = useState(false);
  const [hasCompassSensor, setHasCompassSensor] = useState(false);

  // ─ Admin Creation Modal State ────────────────────────────────
  const [showCreate, setShowCreate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [createTitle, setCreateTitle] = useState('');
  const [createContent, setCreateContent] = useState('');

  // ─ Calculated Heading (Compass + Swipe Offset) ────────────────
  const effectiveHeading = (compass + swipeOffset + 360) % 360;

  // ─ Fetch AR content from backend ─────────────────────────────
  const fetchAR = useCallback(async (lat, lng, fallback = false) => {
    try {
      const base = import.meta.env.VITE_API_URL || '';
      const token = localStorage.getItem('token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

      // If we are in indoor/fallback mode, get all contents so we can place virtual coordinates
      const url = fallback 
        ? `${base}/api/ar/all` 
        : `${base}/api/ar/nearby?lat=${lat}&lng=${lng}&radius=1000`;

      const r = await fetch(url, { headers });
      if (!r.ok) return;
      const data = await r.json();
      const items = data.contents || data.items || [];
      setArItems(items);

      if (items.length > 0) {
        if (fallback) {
          setIsFallbackMode(true);
          // Set virtual user position exactly ~11 meters south of the first marker
          // so it appears right in front of them in the camera feed
          const first = items[0];
          setUserPos({
            lat: parseFloat(first.latitude) - 0.0001,
            lng: parseFloat(first.longitude)
          });
          setStatus(`المحاكاة الداخلية: تم تحميل ${items.length} معالم جغرافية 🏠`);
        } else {
          setStatus(`تم العثور على ${items.length} معالم جغرافية`);
        }
      } else {
        setStatus('لا توجد معالم منشورة قريبة أو مسجلة');
      }
    } catch (err) {
      console.error(err);
      setStatus('لا يوجد اتصال بالخادم — يعمل بالوضع التجريبي المحلي');
    }
  }, []);

  // ══════════════════════════════════════════════════════════════
  // 🎥 CAMERA INITIALIZATION
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
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play().catch(e => console.error('Play error:', e));
        };
      }
      return true;
    } catch (e) {
      setPermMsg('لم نتمكن من الوصول إلى كاميرا الهاتف — ' + e.message);
      return false;
    }
  }, []);

  // ══════════════════════════════════════════════════════════════
  // 🧭 SENSOR INITIALIZATION (GPS, GYRO & COMPASS)
  // ══════════════════════════════════════════════════════════════
  const startOrientation = useCallback(() => {
    const handler = (e) => {
      // Determine if device orientation actually provides compass heading
      const absoluteHeading = e.webkitCompassHeading;
      const alphaHeading = e.alpha ? (360 - e.alpha) : 0;
      
      if (absoluteHeading !== undefined || e.alpha !== null) {
        setHasCompassSensor(true);
      }
      
      const a = absoluteHeading ?? alphaHeading;
      setCompass(Math.round(a));
      setBeta(Math.round(e.beta || 90));
    };

    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      setIOSPerm(true);
    } else {
      window.addEventListener('deviceorientation', handler, true);
    }

    return () => window.removeEventListener('deviceorientation', handler, true);
  }, []);

  const requestIOSOrientation = async () => {
    try {
      const perm = await DeviceOrientationEvent.requestPermission();
      if (perm === 'granted') {
        const handler = (e) => {
          const absoluteHeading = e.webkitCompassHeading;
          const alphaHeading = e.alpha ? (360 - e.alpha) : 0;
          if (absoluteHeading !== undefined || e.alpha !== null) {
            setHasCompassSensor(true);
          }
          const a = absoluteHeading ?? alphaHeading;
          setCompass(Math.round(a));
          setBeta(Math.round(e.beta || 90));
        };
        window.addEventListener('deviceorientation', handler, true);
        setIOSPerm(false);
      }
    } catch (err) {
      alert('فشل تفعيل البوصلة: ' + err.message);
      setIOSPerm(false);
    }
  };

  const startGPS = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus('جهازك لا يدعم تحديد الموقع الجغرافي (GPS)');
      return;
    }

    const opts = { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 };
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        // If GPS succeeds, overwrite fallback mode
        setIsFallbackMode(false);
        const { latitude: lat, longitude: lng } = pos.coords;
        setUserPos({ lat, lng });
        fetchAR(lat, lng);
      },
      (err) => {
        // Fail silently or notify, but let the fallback timer handle indoor simulation
        console.warn(`GPS Warning: ${err.message}`);
      },
      opts
    );
    setWatchId(id);
  }, [fetchAR]);

  // ══════════════════════════════════════════════════════════════
  // 🚀 BOOT SEQUENCE & INDOOR FALLBACK TIMER
  // ══════════════════════════════════════════════════════════════
  useEffect(() => {
    let cleanupOrientation;
    
    if (phase === 'loading') {
      (async () => {
        const camOk = await startCamera();
        if (!camOk) {
          setPhase('error');
          return;
        }
        cleanupOrientation = startOrientation();
        startGPS();
        setPhase('active');
      })();
    }

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
      if (cleanupOrientation) cleanupOrientation();
    };
  }, [phase]); // eslint-disable-line

  // Indoor Fallback Trigger: If no GPS position after 4.5 seconds, start simulation mode
  useEffect(() => {
    if (phase === 'active' && !userPos) {
      const timer = setTimeout(() => {
        if (!userPos) {
          fetchAR(0, 0, true); // Trigger all markers fetch & virtual coordinate mapping
        }
      }, 4500);
      return () => clearTimeout(timer);
    }
  }, [phase, userPos, fetchAR]);

  // ══════════════════════════════════════════════════════════════
  // 🖥️ VISIBLE MARKERS CALCULATOR
  // ══════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!userPos || arItems.length === 0) return;

    const visible = arItems
      .map(item => {
        const dist = GEO.distance(userPos.lat, userPos.lng, item.latitude, item.longitude);
        const bear = GEO.bearing(userPos.lat, userPos.lng, item.latitude, item.longitude);
        
        // Use effectiveHeading (compass + drag swipe offset) instead of raw compass
        const diff = GEO.angleDiff(bear, effectiveHeading);

        // Camera horizontal field of view is about 60 degrees.
        const inFovX = Math.abs(diff) <= 30;

        // Calculate horizontal screen percentage (0% to 100%)
        const screenX = 50 + (diff / 30) * 50; 

        // Pitch (beta): 90 is upright vertical.
        const screenY = 50 - (beta - 90) * 1.5; 

        const inFovY = screenY >= 5 && screenY <= 95;

        return {
          ...item,
          dist,
          bear,
          screenX: Math.max(5, Math.min(95, screenX)),
          screenY: Math.max(5, Math.min(95, screenY)),
          inView: inFovX && inFovY,
          bearingDiff: diff
        };
      })
      .filter(i => i.dist <= 1000);

    setVisibleItems(visible);
  }, [effectiveHeading, beta, userPos, arItems]);

  // Compass text representation
  const compassLabel = () => {
    const dirs = ['شمال','ش.شرق','شرق','ج.شرق','جنوب','ج.غرب','غرب','ش.غرب'];
    return dirs[Math.round(effectiveHeading / 45) % 8];
  };

  // ══════════════════════════════════════════════════════════════
  // 🔄 SWIPE & ALIGNMENT HELPERS
  // ══════════════════════════════════════════════════════════════
  const handleTouchStart = (e) => {
    if (e.touches && e.touches.length > 0) {
      touchStartRef.current = e.touches[0].clientX;
    }
  };

  const handleTouchMove = (e) => {
    if (touchStartRef.current !== null && e.touches && e.touches.length > 0) {
      const currentX = e.touches[0].clientX;
      const diffX = currentX - touchStartRef.current;
      // Map drag distance in pixels to rotation angle degrees
      const rotationStep = (diffX / window.innerWidth) * 75; 
      setSwipeOffset(prev => (prev - rotationStep + 360) % 360);
      touchStartRef.current = currentX;
    }
  };

  const handleTouchEnd = () => {
    touchStartRef.current = null;
  };

  // Automatically align camera view to look directly at the nearest marker
  const handleRealignClick = () => {
    if (visibleItems.length === 0 || !userPos) return;
    // Find nearest item
    const sorted = [...visibleItems].sort((a, b) => a.dist - b.dist);
    const nearest = sorted[0];
    const bear = GEO.bearing(userPos.lat, userPos.lng, nearest.latitude, nearest.longitude);
    
    // Set swipeOffset so that (compass + swipeOffset) equals the target bearing
    const targetOffset = (bear - compass + 360) % 360;
    setSwipeOffset(targetOffset);
    setStatus(`تم توجيه الرؤية تلقائياً نحو: "${nearest.title}" 🔄`);
  };

  // Force enable indoor simulation mode manually
  const triggerManualSimulation = () => {
    fetchAR(0, 0, true);
  };

  // ══════════════════════════════════════════════════════════════
  // 📸 PHOTO MARKER CREATION HANDLERS
  // ══════════════════════════════════════════════════════════════
  const handlePhotoCaptureClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!userPos) {
      alert('عذراً، لم نتمكن من تحديد الموقع الجغرافي. يرجى الانتظار لحين تحميل المحاكاة أو الـ GPS.');
      return;
    }
    if (!photoFile) {
      alert('يرجى التقاط صورة للمعلم أولاً 📸');
      return;
    }
    if (!createTitle.trim()) {
      alert('يرجى إدخال اسم المعلم');
      return;
    }

    setIsSubmitting(true);
    try {
      const base = import.meta.env.VITE_API_URL || '';
      const token = localStorage.getItem('token');
      
      const formData = new FormData();
      formData.append('photo', photoFile);
      formData.append('title', createTitle.trim());
      formData.append('content', createContent.trim());
      formData.append('latitude', userPos.lat);
      formData.append('longitude', userPos.lng);
      formData.append('bearing', effectiveHeading); // Save with current rotated direction

      const res = await fetch(`${base}/api/ar/photo-marker`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}` 
        },
        body: formData
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `فشل الحفظ (رمز الخطأ: ${res.status})`);
      }

      const data = await res.json();
      
      if (data.content) {
        setArItems(prev => [data.content, ...prev]);
      }
      
      setShowCreate(false);
      setPhotoFile(null);
      setPhotoPreview('');
      setCreateTitle('');
      setCreateContent('');
      setStatus('تم حفظ ونشر المعلم الجديد بنجاح! 📸✅');
    } catch (err) {
      console.error(err);
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ══════════════════════════════════════════════════════════════
  // 🖥️ UI RENDERING
  // ══════════════════════════════════════════════════════════════

  if (phase === 'permission') {
    return (
      <div className="ar-permission-screen">
        <div className="ar-perm-card">
          <div className="ar-perm-icon">📸</div>
          <h2>كاميرا الواقع المعزز الفوتوغرافي</h2>
          <p>يعرض هذا النظام المعالم المنشورة مباشرة على كاميرا الهاتف بشكل تفاعلي:</p>
          <ul className="ar-perm-list">
            <li>📷 الكاميرا الحية (لعرض المعالم بالمكان)</li>
            <li>📍 الموقع الجغرافي (أو وضع المحاكاة داخل المباني)</li>
            <li>🔄 البوصلة (أو السحب اليدوي على الشاشة للالتفاف)</li>
          </ul>
          <button className="ar-perm-btn" onClick={() => setPhase('loading')}>
            افتح الكاميرا وابدأ
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="ar-permission-screen">
        <div className="ar-perm-card error">
          <div className="ar-perm-icon">⚠️</div>
          <h2>تعذر فتح الكاميرا</h2>
          <p>{permMsg || 'تأكد من منح صلاحيات الكاميرا والموقع لإظهار معالم الواقع المعزز.'}</p>
          <button className="ar-perm-btn" onClick={() => navigate(-1)}>رجوع</button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="ar-root"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* 📷 Fullscreen Live Camera View */}
      <video ref={videoRef} className="ar-video" playsInline muted autoPlay />

      {/* 🎛️ Interactive Glass Overlay */}
      <div className="ar-overlay">

        {/* iOS Direction Request Banner */}
        {iOSPerm && (
          <div className="ar-ios-banner" onClick={requestIOSOrientation}>
            اضغط هنا لتفعيل مستشعر الحركة والبوصلة 🧭
          </div>
        )}

        {/* ─── TOP HUD: Compass & Status & Realignment ─── */}
        <div className="ar-hud-top">
          <button className="ar-back-btn" onClick={() => navigate(-1)} aria-label="Back">
            ✕
          </button>

          {/* Compass / Direction Ring */}
          <div className="ar-compass-ring" onClick={handleRealignClick} title="اضغط للمحاذاة التلقائية">
            <div className="ar-compass-needle" style={{ transform: `rotate(${-effectiveHeading}deg)` }}>
              <span className="ar-compass-n">▲</span>
            </div>
            <div className="ar-compass-value">{effectiveHeading}° {compassLabel()}</div>
          </div>

          {/* Status badge & Fallback simulation button */}
          <div className="ar-status-pill">
            <span className={`ar-gps-dot ${userPos ? 'active' : ''}`} />
            <span className="ar-status-text">
              {isFallbackMode ? '🏠 محاكاة الموقع المغلق' : (userPos ? `${userPos.lat.toFixed(5)}, ${userPos.lng.toFixed(5)}` : statusMsg)}
            </span>
            {!userPos && (
              <button onClick={triggerManualSimulation} className="ar-simulate-btn">
                محاكاة 🏠
              </button>
            )}
          </div>
        </div>

        {/* Swipe screen instruction text helper */}
        <div className="ar-swipe-hint">
          <span>👈 اسحب الشاشة يميناً أو يساراً للالتفاف وتوجيه الكاميرا 🔄</span>
        </div>

        {/* ─── FLOATING LOCATION PIN MARKERS (Only inside FOV) ─── */}
        {visibleItems
          .filter(item => item.inView)
          .map(item => (
            <div
              key={item.id}
              className={`ar-location-pin ${activeItem?.id === item.id ? 'active' : ''}`}
              style={{ left: `${item.screenX}%`, top: `${item.screenY}%` }}
              onClick={() => setActiveItem(item)}
            >
              <div className="ar-pin-circle">
                {item.image_url ? (
                  <img src={item.image_url} alt={item.title} className="ar-pin-thumb" />
                ) : (
                  <span className="ar-pin-icon-placeholder">📸</span>
                )}
                <div className="ar-pin-pulse" />
              </div>

              <div className="ar-pin-label">
                <span className="ar-pin-title">{item.title}</span>
                <span className="ar-pin-distance">{GEO.fmt(item.dist)}</span>
              </div>
              <div className="ar-pin-anchor" />
            </div>
          ))}

        {/* ─── EDGE ARROW POINTERS (For markers outside current FOV) ─── */}
        {visibleItems
          .filter(item => !item.inView)
          .map(item => {
            const isLeft = item.bearingDiff < 0;
            return (
              <div
                key={`edge-${item.id}`}
                className={`ar-edge-indicator ${isLeft ? 'left' : 'right'}`}
                onClick={() => {
                  // Re-align on click
                  const targetOffset = (item.bear - compass + 360) % 360;
                  setSwipeOffset(targetOffset);
                  setActiveItem(item);
                }}
              >
                <div className="ar-edge-arrow">{isLeft ? '◀' : '▶'}</div>
                <div className="ar-edge-info">
                  <span className="ar-edge-title">{item.title}</span>
                  <span className="ar-edge-dist">{GEO.fmt(item.dist)}</span>
                </div>
              </div>
            );
          })}

        {/* ─── BOTTOM HUD STRIP (Horizontal list of all nearby markers) ─── */}
        <div className="ar-hud-bottom">
          {visibleItems.length === 0 ? (
            <div className="ar-no-items">لا توجد معالم قريبة منك حالياً (في نطاق 1 كم)</div>
          ) : (
            <div className="ar-items-strip">
              {visibleItems.map(item => (
                <div
                  key={`strip-${item.id}`}
                  className={`ar-strip-item ${item.inView ? 'in-view' : ''} ${activeItem?.id === item.id ? 'selected' : ''}`}
                  onClick={() => {
                    setActiveItem(item);
                    // Focus camera direction directly towards the clicked item
                    const targetOffset = (item.bear - compass + 360) % 360;
                    setSwipeOffset(targetOffset);
                  }}
                >
                  {item.image_url ? (
                    <img src={item.image_url} alt="" className="ar-strip-img" />
                  ) : (
                    <div className="ar-strip-img-placeholder">📸</div>
                  )}
                  <div className="ar-strip-details">
                    <span className="ar-strip-name">{item.title}</span>
                    <span className="ar-strip-dist">📍 {GEO.fmt(item.dist)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ─── DETAIL POPUP BOTTOM SHEET ─── */}
        {activeItem && (
          <div className="ar-detail-panel" onClick={(e) => e.target === e.currentTarget && setActiveItem(null)}>
            <div className="ar-detail-card">
              <button className="ar-detail-close" onClick={() => setActiveItem(null)} aria-label="Close details">✕</button>

              {activeItem.image_url && (
                <div className="ar-detail-img-wrap">
                  <img src={activeItem.image_url} alt={activeItem.title} className="ar-detail-img" />
                  <div className="ar-detail-dist-badge">📍 {GEO.fmt(activeItem.dist)}</div>
                </div>
              )}

              <div className="ar-detail-body">
                <h2 className="ar-detail-title">{activeItem.title}</h2>
                <div className="ar-detail-meta">
                  <span>الإحداثيات: {activeItem.latitude.toFixed(6)}, {activeItem.longitude.toFixed(6)}</span>
                  <span>الاتجاه الجغرافي: {Math.round(activeItem.bear)}°</span>
                </div>
                {activeItem.content && <p className="ar-detail-content">{activeItem.content}</p>}
              </div>
            </div>
          </div>
        )}

        {/* ─── ADMIN FAB BUTTON (ADD MARKER IN SITU) ─── */}
        {user?.role === 'admin' && phase === 'active' && !showCreate && (
          <button className="ar-create-fab" onClick={() => setShowCreate(true)}>
            <span className="ar-fab-icon">📸</span>
            <span className="ar-fab-text">تصوير وإضافة معلم</span>
          </button>
        )}

        {/* ─── ADMIN CREATION MODAL ─── */}
        {showCreate && (
          <div className="ar-create-modal" onClick={(e) => e.target === e.currentTarget && setShowCreate(false)}>
            <div className="ar-create-card">
              <button className="ar-detail-close" onClick={() => setShowCreate(false)}>✕</button>
              <h3 className="ar-create-title">إضافة معلم فوتوغرافي جديد</h3>
              <p className="ar-create-subtitle">سيتم تسجيل موقعك الجغرافي واتجاهك الحالي تلقائياً وحفظ الصورة</p>
              
              <form onSubmit={handleCreateSubmit} className="ar-create-form">
                {/* Custom camera capture trigger */}
                <div className="ar-photo-capture-box" onClick={handlePhotoCaptureClick}>
                  {photoPreview ? (
                    <img src={photoPreview} alt="Captured" className="ar-capture-preview" />
                  ) : (
                    <div className="ar-capture-placeholder">
                      <span className="ar-capture-icon">📸</span>
                      <span className="ar-capture-text">التقط صورة للمعلم بكاميرا الهاتف</span>
                    </div>
                  )}
                </div>

                {/* Hidden input for mobile camera */}
                <input 
                  type="file" 
                  accept="image/*" 
                  capture="environment" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  className="ar-hidden-file-input" 
                />
                
                <input 
                  type="text" 
                  placeholder="اسم المعلم (مثال: باب الخليل)" 
                  required 
                  value={createTitle} 
                  onChange={e => setCreateTitle(e.target.value)} 
                  className="ar-input"
                />
                
                <textarea 
                  placeholder="اكتب نبذة تاريخية أو وصفاً للمعلم..." 
                  rows="3" 
                  value={createContent} 
                  onChange={e => setCreateContent(e.target.value)}
                  className="ar-textarea"
                />
                
                <div className="ar-create-metadata-grid">
                  <div className="ar-meta-item">
                    <span className="ar-meta-label">📍 خط العرض:</span>
                    <span className="ar-meta-val">{userPos?.lat.toFixed(6) || 'جاري التحديد...'}</span>
                  </div>
                  <div className="ar-meta-item">
                    <span className="ar-meta-label">📍 خط الطول:</span>
                    <span className="ar-meta-val">{userPos?.lng.toFixed(6) || 'جاري التحديد...'}</span>
                  </div>
                  <div className="ar-meta-item">
                    <span className="ar-meta-label">🧭 الاتجاه:</span>
                    <span className="ar-meta-val">{effectiveHeading}° ({compassLabel()})</span>
                  </div>
                </div>
                
                <button type="submit" disabled={isSubmitting} className="ar-create-submit">
                  {isSubmitting ? 'جاري رفع الصورة ونشر المعلم...' : 'نشر المعلم في هذا الموقع الجغرافي 📌'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ─── LOADER SCREEN OVERLAY ─── */}
        {phase === 'loading' && (
          <div className="ar-loading-overlay">
            <div className="ar-loading-spinner" />
            <p>جارٍ تهيئة الواقع المعزز الجغرافي...</p>
          </div>
        )}
      </div>
    </div>
  );
}
