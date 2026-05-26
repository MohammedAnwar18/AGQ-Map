import React, { useState, useEffect, useRef } from 'react';
import { arService } from '../services/api';
import './SpatialARViewer.css';

// ── SVG SHAPE DRAWERS ────────────────────────────────────────────────────────
const CrystalIcon = () => (
  <svg width="32" height="32" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="ar-svg-spin">
    <path d="M32 2L54 24L32 62L10 24L32 2Z" stroke="#00f3ff" strokeWidth="2.5" fill="rgba(0, 243, 255, 0.2)" />
    <path d="M32 2V62" stroke="#00f3ff" strokeWidth="1.5" strokeDasharray="2 2" />
    <path d="M10 24H54" stroke="#00f3ff" strokeWidth="1.5" strokeDasharray="2 2" />
    <circle cx="32" cy="24" r="4" fill="#00f3ff" className="ar-pulse" />
  </svg>
);

const ArrowIcon = () => (
  <svg width="32" height="32" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M32 58V6M32 58L16 42M32 58L48 42" stroke="#ff0055" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="32" cy="6" r="5" fill="#ff0055" />
  </svg>
);

const PanelIcon = () => (
  <svg width="32" height="32" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="8" y="14" width="48" height="36" rx="6" stroke="#ffb700" strokeWidth="3" fill="rgba(255, 183, 0, 0.15)" />
    <path d="M18 26H46M18 34H38M18 42H42" stroke="#ffb700" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

const SphereIcon = () => (
  <svg width="32" height="32" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="32" cy="32" r="22" stroke="#10b981" strokeWidth="3.5" fill="rgba(16, 185, 129, 0.2)" />
    <circle cx="32" cy="32" r="10" stroke="#10b981" strokeWidth="1.5" strokeDasharray="3 3" />
    <circle cx="32" cy="32" r="4" fill="#10b981" />
  </svg>
);

const getShapeIcon = (shape) => {
  switch (shape) {
    case 'arrow': return <ArrowIcon />;
    case 'panel': return <PanelIcon />;
    case 'glow_sphere': return <SphereIcon />;
    case 'crystal':
    default:
      return <CrystalIcon />;
  }
};

const getShapeNameArabic = (shape) => {
  switch (shape) {
    case 'arrow': return 'سهم توجيهي متوهج';
    case 'panel': return 'لوحة معلومات زجاجية';
    case 'glow_sphere': return 'كرة طاقة خضراء';
    case 'crystal':
    default:
      return 'بلورة فضاء زرقاء';
  }
};

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c); // Distance in meters
};

const calculateBearing = (lat1, lon1, lat2, lon2) => {
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) -
            Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

  const θ = Math.atan2(y, x);
  return (θ * 180 / Math.PI + 360) % 360; // in degrees
};

export default function SpatialARViewer({ onClose, user }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // States
  const [coords, setCoords] = useState(null);
  const [gpsError, setGpsError] = useState(null);
  const [heading, setHeading] = useState(0);
  const [markers, setMarkers] = useState([]);
  const [loading, setLoading] = useState(true);

  // UI Panels
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [showAuthoring, setShowAuthoring] = useState(false);
  const [orientationAllowed, setOrientationAllowed] = useState(false);

  // Authoring Form State
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formShape, setFormShape] = useState('crystal');
  const [submitting, setSubmitting] = useState(false);

  const isAdmin = user?.role === 'admin';
  const FOV = 65; // Camera horizontal Field of View

  // 1. Initialize Camera Feed
  useEffect(() => {
    async function startCamera() {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: 'environment', // Request back-facing camera
              width: { ideal: 1280 },
              height: { ideal: 720 }
            },
            audio: false
          });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
          streamRef.current = stream;
        }
      } catch (error) {
        console.error('Camera stream access failed:', error);
      }
    }

    startCamera();

    return () => {
      // Cleanup: Stop all camera tracks on unmount
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // 2. Track GPS Location
  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsError('نظام تحديد المواقع (GPS) غير مدعوم في متصفحك.');
      setLoading(false);
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setCoords({ latitude, longitude, accuracy });
        setGpsError(null);
      },
      (error) => {
        console.error('GPS Watch error:', error);
        setGpsError('يرجى تفعيل صلاحية الـ GPS لرصد العلامات المحيطة بك.');
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  // 3. Fetch Nearby AR Contents once location is resolved
  useEffect(() => {
    if (!coords) return;

    async function fetchNearby() {
      try {
        const data = await arService.getNearby(coords.latitude, coords.longitude, 3000); // 3km radius
        if (data && data.contents) {
          setMarkers(data.contents);
        }
        setLoading(false);
      } catch (err) {
        console.error('Error fetching nearby AR contents:', err);
        setLoading(false);
      }
    }

    fetchNearby();
    // Poll for new contents every 15 seconds as user moves
    const interval = setInterval(fetchNearby, 15000);
    return () => clearInterval(interval);
  }, [coords]);

  // 4. Track Compass / Device Heading
  useEffect(() => {
    const handleOrientation = (event) => {
      let currentHeading = 0;
      if (event.webkitCompassHeading !== undefined) {
        currentHeading = event.webkitCompassHeading;
        setOrientationAllowed(true);
      } else if (event.alpha !== undefined) {
        // Android absolute sensor fallback
        currentHeading = (360 - event.alpha) % 360;
        setOrientationAllowed(true);
      }
      setHeading(Math.round(currentHeading));
    };

    // Listen on absolute event for Android, fall back to standard orientation
    if ('ondeviceorientationabsolute' in window) {
      window.addEventListener('deviceorientationabsolute', handleOrientation, true);
    } else {
      window.addEventListener('deviceorientation', handleOrientation, true);
    }

    return () => {
      if ('ondeviceorientationabsolute' in window) {
        window.removeEventListener('deviceorientationabsolute', handleOrientation, true);
      } else {
        window.removeEventListener('deviceorientation', handleOrientation, true);
      }
    };
  }, []);

  // 5. Explicit iOS Permission Trigger
  const requestCompassPermission = async () => {
    if (
      typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function'
    ) {
      try {
        const permissionState = await DeviceOrientationEvent.requestPermission();
        if (permissionState === 'granted') {
          setOrientationAllowed(true);
          // Re-trigger listener setup
          window.location.reload(); 
        } else {
          alert('يتطلب النظام إذن الحركة والاتجاه لعرض الكروت في مواقعها الصحيحة.');
        }
      } catch (error) {
        console.error('Compass permission error:', error);
      }
    } else {
      setOrientationAllowed(true);
    }
  };

  // 6. Form Submission (Create AR Content)
  const handleCreateAR = async (e) => {
    e.preventDefault();
    if (!coords || !formTitle) return;

    setSubmitting(true);
    try {
      const payload = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        title: formTitle,
        content: formContent,
        shape: formShape,
        bearing: heading
      };

      const newMarker = await arService.create(payload);
      if (newMarker) {
        // Immediately add to local markers array
        setMarkers((prev) => [
          ...prev,
          {
            ...newMarker,
            distance_meters: 0
          }
        ]);
        // Reset form
        setFormTitle('');
        setFormContent('');
        setFormShape('crystal');
        setShowAuthoring(false);
      }
    } catch (err) {
      console.error('Failed to create spatial AR content:', err);
      alert('خطأ أثناء حفظ العلامة المكانية. يرجى التحقق من الصلاحيات.');
    } finally {
      setSubmitting(false);
    }
  };

  // 7. Delete AR Content (Admin only)
  const handleDeleteAR = async (id) => {
    if (!window.confirm('هل أنت متأكد من رغبتك في حذف هذه العلامة الجغرافية نهائياً؟')) return;

    try {
      await arService.deleteARContent(id);
      setMarkers((prev) => prev.filter((m) => m.id !== id));
      setSelectedMarker(null);
    } catch (err) {
      console.error('Failed to delete AR content:', err);
      alert('حدث خطأ أثناء عملية الحذف.');
    }
  };

  // Calculate live relative parameters (bearing, distance, scale, screen positioning)
  const processedMarkers = coords
    ? markers.map((marker) => {
        const dist = calculateDistance(
          coords.latitude,
          coords.longitude,
          parseFloat(marker.latitude),
          parseFloat(marker.longitude)
        );

        const brng = calculateBearing(
          coords.latitude,
          coords.longitude,
          parseFloat(marker.latitude),
          parseFloat(marker.longitude)
        );

        // Relative bearing compared to device direction
        let relAngle = brng - heading;
        if (relAngle < -180) relAngle += 360;
        if (relAngle > 180) relAngle -= 360;

        // Visual properties
        const isVisible = Math.abs(relAngle) < FOV / 2;
        const xPos = 50 + (relAngle / (FOV / 2)) * 50; // Screen X percent (50% is center)

        // Scale based on distance (clamp between 0.6 and 1.3)
        const maxDrawDist = 250; 
        const scale = Math.max(0.6, Math.min(1.3, 1.2 - (dist / maxDrawDist)));
        const yPos = 40 + Math.min(25, (dist / maxDrawDist) * 20); // Closer items sit lower

        return {
          ...marker,
          distance: dist,
          bearing: brng,
          relativeAngle: relAngle,
          visible: isVisible,
          x: xPos,
          y: yPos,
          scale
        };
      })
    : [];

  return (
    <div className="ar-viewer-container">
      {/* 1. Live Camera Stream */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="ar-video-feed"
      />
      <div className="ar-overlay-mask" />
      <div className="ar-scanner-line" />

      {/* 2. Interactive Sci-Fi HUD Layer */}
      <div className="ar-hud-overlay">
        
        {/* HUD HEADER */}
        <header className="ar-hud-header">
          <div className="ar-hud-title-wrapper">
            <h1 className="ar-hud-title">SPATIAL AR SCANNER</h1>
            <div className="ar-hud-subtitle">
              <span className={`ar-gps-pulse ${loading || gpsError ? 'searching' : ''}`} />
              {gpsError 
                ? 'فشل تحديد الموقع الجغرافي' 
                : coords 
                  ? `GPS الدقة: ±${Math.round(coords.accuracy)}m` 
                  : 'جاري الاتصال بالأقمار الصناعية...'}
            </div>
          </div>

          <div className="ar-hud-actions ar-interactive">
            {/* Compass Permission for iOS */}
            {!orientationAllowed && (
              <button 
                onClick={requestCompassPermission}
                className="ar-hud-btn" 
                title="تفعيل البوصلة"
                style={{ width: 'auto', borderRadius: '20px', padding: '0 12px', fontSize: '0.75rem', fontWeight: 700 }}
              >
                توجيه البوصلة 🧭
              </button>
            )}

            {/* Authoring Panel Trigger for Admin */}
            {isAdmin && coords && (
              <button
                onClick={() => setShowAuthoring(!showAuthoring)}
                className="ar-hud-btn"
                title="إضافة علامة مكانية"
                style={{ borderColor: showAuthoring ? '#ff6e00' : 'rgba(255,255,255,0.15)', color: showAuthoring ? '#ff6e00' : '#fff' }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
            )}

            {/* Exit Scanner Button */}
            <button onClick={onClose} className="ar-hud-btn close-btn" title="إغلاق الكاميرا">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </header>

        {/* COMPASS WIDGET */}
        <div className="ar-compass-widget">
          <span>الاتجاه الحالي:</span>
          <span className="ar-compass-bearing">{heading}°</span>
          <span>{heading >= 337.5 || heading < 22.5 ? 'شمال N' :
                heading >= 22.5 && heading < 67.5 ? 'شمال شرق NE' :
                heading >= 67.5 && heading < 112.5 ? 'شرق E' :
                heading >= 112.5 && heading < 157.5 ? 'جنوب شرق SE' :
                heading >= 157.5 && heading < 202.5 ? 'جنوب S' :
                heading >= 202.5 && heading < 247.5 ? 'جنوب غرب SW' :
                heading >= 247.5 && heading < 292.5 ? 'غرب W' : 'شمال غرب NW'}</span>
        </div>

        {/* DYNAMIC SCREEN VIEWPORT (FLIGHT PATH MARKERS) */}
        <div className="ar-viewport">
          {!gpsError && processedMarkers.map((marker) => {
            if (!marker.visible) return null;

            return (
              <div
                key={marker.id}
                onClick={() => setSelectedMarker(marker)}
                className="ar-spatial-marker"
                style={{
                  left: `${marker.x}%`,
                  top: `${marker.y}%`,
                  transform: `translate(-50%, -50%) scale(${marker.scale})`,
                  opacity: Math.max(0.2, 1.2 - Math.abs(marker.relativeAngle) / (FOV / 2))
                }}
              >
                {/* 3D-Like Neon Icon */}
                <div className="ar-shape-wrapper">
                  {getShapeIcon(marker.shape)}
                </div>

                {/* Laser Pointer Line */}
                <div className="ar-marker-pointer" />

                {/* Glassmorphic Info Card */}
                <div className="ar-marker-card">
                  <h3 className="ar-marker-title">{marker.title}</h3>
                  <span className="ar-marker-distance">{marker.distance}m</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* LOADING & GPS ERROR NOTIFICATION STATEMENTS */}
        {loading && !gpsError && (
          <div className="ar-system-msg">
            <div className="ar-spinner" />
            <p className="ar-system-msg-text">جاري مزامنة البوصلة والأقمار الصناعية للواقع المعزز...</p>
          </div>
        )}

        {gpsError && (
          <div className="ar-system-msg">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" style={{ margin: '0 auto 12px auto', display: 'block' }}>
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <p className="ar-system-msg-text" style={{ color: '#ef4444', fontWeight: 'bold' }}>{gpsError}</p>
          </div>
        )}

        {!loading && !gpsError && markers.length === 0 && (
          <div className="ar-system-msg">
            <p className="ar-system-msg-text">
              لا توجد علامات مكانية قريبة في نطاق 3 كم.
              {isAdmin && <span style={{ display: 'block', marginTop: '8px', color: '#ff6e00', fontWeight: 'bold' }}>اضغط على الزر (+) بالأعلى لإضافة أول علامة مكانية في هذا الموقع الجغرافي!</span>}
            </p>
          </div>
        )}

        {/* MINI RADAR WIDGET (Bottom Left) */}
        {!gpsError && coords && (
          <div className="ar-radar-container">
            <div className="ar-radar-sweep" />
            <div className="ar-radar-center" />
            
            {/* Project markers on Radar map */}
            {processedMarkers.map((marker) => {
              // Convert bearing relative to device heading and compute coordinate offset
              const angleRad = (marker.bearing - heading - 90) * Math.PI / 180;
              const maxRadarDist = 300; // items in 300 meters
              const distanceRatio = Math.min(1, marker.distance / maxRadarDist);
              
              // Radar container is 90px (radius 45px)
              const dotX = 45 + Math.cos(angleRad) * 35 * distanceRatio;
              const dotY = 45 + Math.sin(angleRad) * 35 * distanceRatio;

              return (
                <div
                  key={marker.id}
                  className="ar-radar-dot"
                  style={{
                    left: `${dotX}px`,
                    top: `${dotY}px`,
                    opacity: marker.distance <= maxRadarDist ? 1 : 0.4
                  }}
                  title={`${marker.title} (${marker.distance}m)`}
                />
              );
            })}
          </div>
        )}

        {/* 3. DYNAMIC INTERACTIVE DETAIL DRAWER */}
        {selectedMarker && (
          <div className="ar-detail-drawer ar-interactive">
            <div className="ar-detail-header">
              <h2 className="ar-detail-title">{selectedMarker.title}</h2>
              <span className="ar-detail-distance">يبعد مسافة {selectedMarker.distance} متر</span>
            </div>
            
            <p className="ar-detail-content">
              {selectedMarker.content || 'لا توجد تفاصيل إضافية مسجلة لهذه العلامة الجغرافية.'}
            </p>

            <div className="ar-detail-footer">
              <div>
                <span>شكل المجسم: </span>
                <span style={{ color: '#fff', fontWeight: 'bold' }}>{getShapeNameArabic(selectedMarker.shape)}</span>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button 
                  onClick={() => setSelectedMarker(null)} 
                  className="ar-submit-btn" 
                  style={{ width: 'auto', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', padding: '6px 12px', fontSize: '0.75rem', boxShadow: 'none' }}
                >
                  إغلاق التفاصيل
                </button>
                {isAdmin && (
                  <button 
                    onClick={() => handleDeleteAR(selectedMarker.id)}
                    className="ar-submit-btn" 
                    style={{ width: 'auto', background: 'linear-gradient(135deg, #ef4444, #b91c1c)', padding: '6px 12px', fontSize: '0.75rem', boxShadow: 'none' }}
                  >
                    حذف العلامة 🗑️
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 4. ADMIN AUTHORING STUDIO CARD */}
        {showAuthoring && coords && (
          <div className="ar-authoring-panel ar-interactive">
            <div className="ar-author-header">
              <h2 className="ar-author-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ verticalAlign: 'middle' }}>
                  <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                تأليف ونشر محتوى مكاني جديد
              </h2>
              <button 
                onClick={() => setShowAuthoring(false)} 
                className="ar-hud-btn" 
                style={{ width: '28px', height: '28px', border: 'none', background: 'transparent', boxShadow: 'none' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateAR}>
              <div className="ar-form-group">
                <label className="ar-form-label">عنوان العلامة المكانية</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: مكتب رئيس الجامعة، نافورة المياه..."
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="ar-form-input"
                />
              </div>

              <div className="ar-form-group">
                <label className="ar-form-label">الوصف الإرشادي أو المحتوى</label>
                <textarea
                  rows="3"
                  placeholder="اكتب التوجيهات أو معلومات مساعدة للزوار هنا..."
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  className="ar-form-textarea"
                />
              </div>

              <div className="ar-form-group">
                <label className="ar-form-label">شكل المجسم المتوهج ثلاثي الأبعاد</label>
                <select
                  value={formShape}
                  onChange={(e) => setFormShape(e.target.value)}
                  className="ar-form-select"
                >
                  <option value="crystal">💎 بلورة زرقاء متوهجة (رائعة للأماكن الهامة)</option>
                  <option value="arrow">🚨 سهم توجيهي عمودي (رائع للمداخل والمكاتب)</option>
                  <option value="panel">📝 لوحة معلومات زجاجية (رائع للتفاصيل والتعليمات)</option>
                  <option value="glow_sphere">🟢 كرة طاقة خضراء (رائع للمناطق العامة المفتوحة)</option>
                </select>
              </div>

              <div className="ar-form-group" style={{ marginBottom: '20px' }}>
                <label className="ar-form-label">البيانات المكانية الحالية للرصد</label>
                <div className="ar-coords-badge">
                  <div>خط العرض: {coords.latitude.toFixed(6)}</div>
                  <div>خط الطول: {coords.longitude.toFixed(6)}</div>
                  <div style={{ gridColumn: 'span 2', color: '#ff6e00', fontWeight: 'bold' }}>زاوية التوجيه المرجعية: {heading}°</div>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || !formTitle}
                className="ar-submit-btn"
              >
                {submitting ? 'جاري نشر العلامة بالفضاء...' : 'حفظ ونشر العلامة بالواقع المعزز 🕶️'}
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}
