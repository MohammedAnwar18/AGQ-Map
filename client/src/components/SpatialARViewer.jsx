import { useState, useEffect, useRef } from 'react';
import { arService } from '../services/api';
import './SpatialARViewer.css';

// ── Shape Icons ──────────────────────────────────────────────────────────────
const CrystalIcon = () => (
  <svg width="26" height="26" viewBox="0 0 64 64" fill="none">
    <path d="M32 4L54 26L32 60L10 26L32 4Z" stroke="#00ffaa" strokeWidth="2.5" fill="rgba(0,255,170,0.15)" />
    <path d="M32 4V60M10 26H54" stroke="#00ffaa" strokeWidth="1.2" strokeDasharray="3 3" />
    <circle cx="32" cy="26" r="4" fill="#00ffaa" />
  </svg>
);
const ArrowIcon = () => (
  <svg width="26" height="26" viewBox="0 0 64 64" fill="none">
    <path d="M32 56V8M32 56L18 40M32 56L46 40" stroke="#ff0055" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="32" cy="8" r="5" fill="#ff0055" />
  </svg>
);
const PanelIcon = () => (
  <svg width="26" height="26" viewBox="0 0 64 64" fill="none">
    <rect x="8" y="14" width="48" height="36" rx="6" stroke="#ffb700" strokeWidth="3" fill="rgba(255,183,0,0.12)" />
    <path d="M18 26H46M18 34H38M18 42H42" stroke="#ffb700" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);
const SphereIcon = () => (
  <svg width="26" height="26" viewBox="0 0 64 64" fill="none">
    <circle cx="32" cy="32" r="22" stroke="#10b981" strokeWidth="3.5" fill="rgba(16,185,129,0.15)" />
    <circle cx="32" cy="32" r="10" stroke="#10b981" strokeWidth="1.5" strokeDasharray="3 3" />
    <circle cx="32" cy="32" r="4" fill="#10b981" />
  </svg>
);

const SHAPE_ICONS = { arrow: <ArrowIcon />, panel: <PanelIcon />, glow_sphere: <SphereIcon />, crystal: <CrystalIcon /> };
const SHAPE_NAMES = { arrow: 'سهم توجيهي', panel: 'لوحة معلومات', glow_sphere: 'كرة طاقة', crystal: 'بلورة مكانية' };

// ── Math helpers ─────────────────────────────────────────────────────────────
const haversineMeters = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3, toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
};

const bearing = (lat1, lon1, lat2, lon2) => {
  const toRad = d => d * Math.PI / 180;
  const y = Math.sin(toRad(lon2-lon1)) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2-lon1));
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
};

const headingLabel = h =>
  h >= 337.5 || h < 22.5  ? 'N'  : h < 67.5  ? 'NE' : h < 112.5 ? 'E'  :
  h < 157.5               ? 'SE' : h < 202.5  ? 'S'  : h < 247.5 ? 'SW' :
  h < 292.5               ? 'W'  : 'NW';

const fmt6 = n => (n >= 0 ? '+' : '') + n.toFixed(6);

// ── Component ─────────────────────────────────────────────────────────────────
export default function SpatialARViewer({ onClose, user }) {
  const videoRef   = useRef(null);
  const streamRef  = useRef(null);

  const [coords, setCoords]               = useState(null);
  const [gpsError, setGpsError]           = useState(null);
  const [heading, setHeading]             = useState(0);
  const [markers, setMarkers]             = useState([]);
  const [loading, setLoading]             = useState(true);
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [showAuthoring, setShowAuthoring] = useState(false);
  const [orientationAllowed, setOrientationAllowed] = useState(false);

  const [formTitle,   setFormTitle]   = useState('');
  const [formContent, setFormContent] = useState('');
  const [formShape,   setFormShape]   = useState('crystal');
  const [submitting,  setSubmitting]  = useState(false);

  const isAdmin = user?.role === 'admin';
  const FOV = 65;

  // Camera
  useEffect(() => {
    (async () => {
      try {
        const stream = await navigator.mediaDevices?.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false
        });
        if (videoRef.current) videoRef.current.srcObject = stream;
        streamRef.current = stream;
      } catch (e) { console.warn('Camera unavailable:', e); }
    })();
    return () => streamRef.current?.getTracks().forEach(t => t.stop());
  }, []);

  // GPS
  useEffect(() => {
    if (!navigator.geolocation) { setGpsError('GPS غير مدعوم'); setLoading(false); return; }
    const id = navigator.geolocation.watchPosition(
      ({ coords: c }) => { setCoords({ latitude: c.latitude, longitude: c.longitude, accuracy: c.accuracy }); setGpsError(null); },
      () => { setGpsError('فعّل صلاحية الموقع لرؤية العلامات'); setLoading(false); },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  // Fetch nearby
  useEffect(() => {
    if (!coords) return;
    const fetch = async () => {
      try {
        const data = await arService.getNearby(coords.latitude, coords.longitude, 3000);
        if (data?.contents) setMarkers(data.contents);
        setLoading(false);
      } catch { setLoading(false); }
    };
    fetch();
    const t = setInterval(fetch, 15000);
    return () => clearInterval(t);
  }, [coords]);

  // Compass
  useEffect(() => {
    const handler = e => {
      let h = 0;
      if (e.webkitCompassHeading !== undefined) { h = e.webkitCompassHeading; setOrientationAllowed(true); }
      else if (e.alpha !== undefined) { h = (360 - e.alpha) % 360; setOrientationAllowed(true); }
      setHeading(Math.round(h));
    };
    const evt = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';
    window.addEventListener(evt, handler, true);
    return () => window.removeEventListener(evt, handler, true);
  }, []);

  const requestCompassPermission = async () => {
    if (typeof DeviceOrientationEvent?.requestPermission === 'function') {
      try {
        const state = await DeviceOrientationEvent.requestPermission();
        if (state === 'granted') { setOrientationAllowed(true); window.location.reload(); }
        else alert('يتطلب النظام إذن البوصلة لعرض الاتجاهات بدقة.');
      } catch {}
    } else { setOrientationAllowed(true); }
  };

  // Create AR
  const handleCreateAR = async e => {
    e.preventDefault();
    if (!coords || !formTitle.trim()) return;
    setSubmitting(true);
    try {
      const newMarker = await arService.create({
        latitude: coords.latitude, longitude: coords.longitude,
        title: formTitle, content: formContent, shape: formShape, bearing: heading
      });
      if (newMarker) {
        setMarkers(prev => [...prev, { ...newMarker, distance_meters: 0 }]);
        setFormTitle(''); setFormContent(''); setFormShape('crystal');
        setShowAuthoring(false);
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'خطأ غير معروف';
      alert(`فشل النشر:\n${msg}`);
    } finally { setSubmitting(false); }
  };

  // Delete AR
  const handleDeleteAR = async id => {
    if (!window.confirm('حذف هذه العلامة نهائياً؟')) return;
    try {
      await arService.deleteARContent(id);
      setMarkers(prev => prev.filter(m => m.id !== id));
      setSelectedMarker(null);
    } catch { alert('خطأ أثناء الحذف.'); }
  };

  // Processed markers for render
  const processed = coords ? markers.map(m => {
    const dist  = haversineMeters(coords.latitude, coords.longitude, +m.latitude, +m.longitude);
    const brng  = bearing(coords.latitude, coords.longitude, +m.latitude, +m.longitude);
    let rel     = brng - heading;
    if (rel < -180) rel += 360;
    if (rel >  180) rel -= 360;
    const visible = Math.abs(rel) < FOV / 2;
    const xPct    = 50 + (rel / (FOV / 2)) * 50;
    const scale   = Math.max(0.55, Math.min(1.25, 1.2 - dist / 300));
    const yPct    = 38 + Math.min(22, (dist / 300) * 18);
    return { ...m, dist, brng, rel, visible, xPct, yPct, scale };
  }) : [];

  const visibleCount = processed.filter(m => m.visible).length;

  return (
    <div className="ar-viewer-container">
      {/* Camera */}
      <video ref={videoRef} autoPlay playsInline muted className="ar-video-feed" />
      <div className="ar-overlay-mask" />
      <div className="ar-scanner-line" />

      <div className="ar-hud-overlay">

        {/* ── TOP HEADER ── */}
        <header className="ar-hud-header ar-interactive">
          <div className="ar-hud-title-wrapper">
            <h1 className="ar-hud-title">GEO-AR SCANNER</h1>
            <div className="ar-hud-subtitle">
              <span className={`ar-gps-pulse${gpsError ? ' searching' : ''}`} />
              {gpsError ? 'تعذّر تحديد الموقع' : coords ? `دقة ±${Math.round(coords.accuracy)}م` : 'جاري الاتصال...'}
            </div>
          </div>

          <div className="ar-hud-actions">
            {isAdmin && coords && (
              <button onClick={() => { setShowAuthoring(v => !v); setSelectedMarker(null); }} className="ar-hud-btn"
                style={{ borderColor: showAuthoring ? '#ff6e00' : undefined, color: showAuthoring ? '#ff6e00' : undefined }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
            )}
            <button onClick={onClose} className="ar-hud-btn close-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </header>

        {/* ── iOS COMPASS BANNER ── */}
        {!orientationAllowed && (
          <div className="ar-permission-banner ar-interactive" onClick={requestCompassPermission}>
            اضغط لتفعيل البوصلة 🧭
          </div>
        )}

        {/* ── CENTER RETICLE ── */}
        {!gpsError && (
          <div className="ar-reticle">
            <div className="ar-reticle-ring" />
            <div className="ar-reticle-ring-outer" />
            <div className="ar-reticle-inner" />
            <div className="ar-reticle-dot" />
            <div className="ar-reticle-pulse" />
          </div>
        )}

        {/* ── MARKERS VIEWPORT ── */}
        <div className="ar-viewport">
          {!gpsError && processed.map(m => {
            if (!m.visible) return null;
            return (
              <div key={m.id} className="ar-spatial-marker"
                style={{ left: `${m.xPct}%`, top: `${m.yPct}%`, transform: `translate(-50%,-50%) scale(${m.scale})`, opacity: Math.max(0.25, 1.1 - Math.abs(m.rel) / (FOV / 2)) }}
                onClick={() => { setSelectedMarker(m); setShowAuthoring(false); }}>
                <div className="ar-shape-wrapper">{SHAPE_ICONS[m.shape] ?? SHAPE_ICONS.crystal}</div>
                <div className="ar-marker-pointer" />
                <div className="ar-marker-card">
                  <h3 className="ar-marker-title">{m.title}</h3>
                  <span className="ar-marker-distance">{m.dist}م</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── SYSTEM MESSAGES ── */}
        {loading && !gpsError && (
          <div className="ar-system-msg">
            <div className="ar-spinner" />
            <p className="ar-system-msg-text">مزامنة GPS والأقمار الصناعية...</p>
          </div>
        )}
        {gpsError && (
          <div className="ar-system-msg">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" style={{ margin: '0 auto 12px', display: 'block' }}>
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <p className="ar-system-msg-text" style={{ color: '#ef4444' }}>{gpsError}</p>
          </div>
        )}
        {!loading && !gpsError && markers.length === 0 && (
          <div className="ar-system-msg">
            <p className="ar-system-msg-text">
              لا توجد علامات في نطاق 3 كم
              {isAdmin && <span style={{ display: 'block', marginTop: 8, color: '#ff6e00', fontWeight: 700 }}>اضغط (+) لإضافة أول علامة هنا</span>}
            </p>
          </div>
        )}

        {/* ── BOTTOM DOCK ── */}
        <div className="ar-bottom-dock ar-interactive">
          {/* Compass */}
          <div className="ar-compass-pill">
            <span className="ar-compass-deg">{heading}°</span>
            <span className="ar-compass-dir">{headingLabel(heading)}</span>
          </div>

          <div className="ar-dock-divider" />

          {/* Coordinates */}
          <div className="ar-coords-block">
            {coords ? (
              <>
                <div className="ar-coord-line">LAT<span>{fmt6(coords.latitude)}</span></div>
                <div className="ar-coord-line">LON<span>{fmt6(coords.longitude)}</span></div>
              </>
            ) : (
              <div className="ar-coord-line">-- جاري التحديد --</div>
            )}
          </div>

          <div className="ar-dock-divider" />

          {/* Mini Radar */}
          <div className="ar-radar-container">
            <div className="ar-radar-sweep" />
            <div className="ar-radar-center" />
            {processed.map(m => {
              const angle  = (m.brng - heading - 90) * Math.PI / 180;
              const ratio  = Math.min(1, m.dist / 300);
              const dotX   = 26 + Math.cos(angle) * 20 * ratio;
              const dotY   = 26 + Math.sin(angle) * 20 * ratio;
              return <div key={m.id} className="ar-radar-dot" style={{ left: dotX, top: dotY }} />;
            })}
          </div>

          <div className="ar-dock-divider" />

          {/* Visible count */}
          <div className="ar-marker-count">
            <span className="ar-count-num">{visibleCount}</span>
            <span className="ar-count-label">مرئي</span>
          </div>
        </div>

        {/* ── DETAIL DRAWER ── */}
        {selectedMarker && (
          <div className="ar-detail-drawer ar-interactive">
            <div className="ar-detail-handle" />
            <div className="ar-detail-header">
              <h2 className="ar-detail-title">{selectedMarker.title}</h2>
              <span className="ar-detail-distance">{selectedMarker.dist}م</span>
            </div>
            <p className="ar-detail-content">
              {selectedMarker.content || 'لا توجد تفاصيل إضافية لهذه العلامة.'}
            </p>
            <div className="ar-detail-footer">
              <span className="ar-detail-meta">{SHAPE_NAMES[selectedMarker.shape] ?? 'علامة'}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                {isAdmin && (
                  <button className="ar-btn-danger" onClick={() => handleDeleteAR(selectedMarker.id)}>حذف</button>
                )}
                <button className="ar-btn-ghost" onClick={() => setSelectedMarker(null)}>إغلاق</button>
              </div>
            </div>
          </div>
        )}

        {/* ── AUTHORING PANEL ── */}
        {showAuthoring && coords && (
          <div className="ar-authoring-panel ar-interactive">
            <div className="ar-author-header">
              <h2 className="ar-author-title">نشر علامة مكانية</h2>
              <button onClick={() => setShowAuthoring(false)} className="ar-hud-btn"
                style={{ width: 30, height: 30, border: 'none', background: 'transparent', boxShadow: 'none' }}>✕</button>
            </div>
            <form onSubmit={handleCreateAR}>
              <div className="ar-form-group">
                <label className="ar-form-label">العنوان</label>
                <input type="text" required className="ar-form-input"
                  placeholder="مثال: مكتب رئيس الجامعة"
                  value={formTitle} onChange={e => setFormTitle(e.target.value)} />
              </div>
              <div className="ar-form-group">
                <label className="ar-form-label">الوصف</label>
                <textarea rows="3" className="ar-form-textarea"
                  placeholder="توجيهات أو معلومات للزوار..."
                  value={formContent} onChange={e => setFormContent(e.target.value)} />
              </div>
              <div className="ar-form-group">
                <label className="ar-form-label">شكل العلامة</label>
                <select className="ar-form-select" value={formShape} onChange={e => setFormShape(e.target.value)}>
                  <option value="crystal">بلورة زرقاء (أماكن هامة)</option>
                  <option value="arrow">سهم توجيهي (مداخل، مكاتب)</option>
                  <option value="panel">لوحة معلومات (تعليمات)</option>
                  <option value="glow_sphere">كرة طاقة (مناطق عامة)</option>
                </select>
              </div>
              <div className="ar-form-group" style={{ marginBottom: 16 }}>
                <label className="ar-form-label">الإحداثيات الحالية</label>
                <div className="ar-coords-badge">
                  <div>LAT: {coords.latitude.toFixed(6)}</div>
                  <div>LON: {coords.longitude.toFixed(6)}</div>
                  <div style={{ gridColumn: 'span 2', color: '#ff6e00' }}>اتجاه: {heading}°</div>
                </div>
              </div>
              <button type="submit" className="ar-submit-btn" disabled={submitting || !formTitle.trim()}>
                {submitting ? 'جاري النشر...' : 'نشر في الواقع المعزز'}
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}
