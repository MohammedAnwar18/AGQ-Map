import { useState, useEffect, useRef, useCallback } from 'react';
import { arService } from '../services/api';
import './SpatialARViewer.css';

// ── Math ─────────────────────────────────────────────────────────────────────
const toRad = d => d * Math.PI / 180;

const haversine = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

const calcBearing = (lat1, lon1, lat2, lon2) => {
  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
};

// Smooth angle with EMA, handling 0/360 wrap
const smoothAngle = (prev, next, alpha = 0.12) => {
  let d = next - prev;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return (prev + alpha * d + 360) % 360;
};

const dirLabel = h =>
  h >= 337.5 || h < 22.5 ? 'N' : h < 67.5 ? 'NE' : h < 112.5 ? 'E' :
  h < 157.5 ? 'SE' : h < 202.5 ? 'S' : h < 247.5 ? 'SW' : h < 292.5 ? 'W' : 'NW';

const fmtDist = m => m < 1000 ? `${m} م` : `${(m / 1000).toFixed(1)} كم`;

// ── Component ─────────────────────────────────────────────────────────────────
const FOV = 60; // horizontal field of view in degrees

export default function SpatialARViewer({ onClose, user }) {
  const videoRef  = useRef(null);
  const streamRef = useRef(null);
  const headingRef = useRef(0); // raw, unsmoothed — for smooth EMA

  const [coords,   setCoords]   = useState(null);
  const [gpsError, setGpsError] = useState(null);
  const [heading,  setHeading]  = useState(0); // smoothed
  const [markers,  setMarkers]  = useState([]);
  const [loading,  setLoading]  = useState(true);

  const [selected,     setSelected]     = useState(null);
  const [showPublish,  setShowPublish]  = useState(false);
  const [needCompass,  setNeedCompass]  = useState(false);

  const [formTitle,   setFormTitle]   = useState('');
  const [formContent, setFormContent] = useState('');
  const [submitting,  setSubmitting]  = useState(false);

  const isAdmin = user?.role === 'admin';

  // ── Camera ──
  useEffect(() => {
    (async () => {
      try {
        const stream = await navigator.mediaDevices?.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false
        });
        if (videoRef.current) videoRef.current.srcObject = stream;
        streamRef.current = stream;
      } catch {}
    })();
    return () => streamRef.current?.getTracks().forEach(t => t.stop());
  }, []);

  // ── GPS ──
  useEffect(() => {
    if (!navigator.geolocation) { setGpsError('GPS غير مدعوم'); setLoading(false); return; }
    const wid = navigator.geolocation.watchPosition(
      ({ coords: c }) => {
        setCoords({ lat: c.latitude, lon: c.longitude, acc: Math.round(c.accuracy) });
        setGpsError(null);
      },
      () => { setGpsError('فعّل صلاحية الموقع'); setLoading(false); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
    return () => navigator.geolocation.clearWatch(wid);
  }, []);

  // ── Compass ──
  useEffect(() => {
    const onOrientation = e => {
      let raw = null;
      if (e.webkitCompassHeading !== undefined && e.webkitCompassHeading !== null) {
        raw = e.webkitCompassHeading; // iOS: true north, 0–360
      } else if (e.absolute && e.alpha !== null) {
        raw = (360 - e.alpha) % 360; // Android absolute
      } else if (e.alpha !== null) {
        raw = (360 - e.alpha) % 360; // fallback
      }
      if (raw === null) return;
      headingRef.current = smoothAngle(headingRef.current, raw, 0.12);
      setHeading(Math.round(headingRef.current));
    };

    // Check if iOS needs permission
    if (typeof DeviceOrientationEvent?.requestPermission === 'function') {
      setNeedCompass(true);
    } else {
      const evt = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';
      window.addEventListener(evt, onOrientation, true);
      return () => window.removeEventListener(evt, onOrientation, true);
    }
  }, []);

  const requestCompass = async () => {
    try {
      const state = await DeviceOrientationEvent.requestPermission();
      if (state === 'granted') {
        setNeedCompass(false);
        const onO = e => {
          if (e.webkitCompassHeading == null) return;
          headingRef.current = smoothAngle(headingRef.current, e.webkitCompassHeading, 0.12);
          setHeading(Math.round(headingRef.current));
        };
        window.addEventListener('deviceorientation', onO, true);
      }
    } catch {}
  };

  // ── Fetch markers ──
  useEffect(() => {
    if (!coords) return;
    const fetch = async () => {
      try {
        const d = await arService.getNearby(coords.lat, coords.lon, 3000);
        if (d?.contents) setMarkers(d.contents);
        setLoading(false);
      } catch { setLoading(false); }
    };
    fetch();
    const t = setInterval(fetch, 20000);
    return () => clearInterval(t);
  }, [coords]);

  // ── Publish ──
  const handlePublish = async e => {
    e.preventDefault();
    if (!coords || !formTitle.trim()) return;
    setSubmitting(true);
    try {
      const m = await arService.create({
        latitude: coords.lat, longitude: coords.lon,
        title: formTitle.trim(), content: formContent.trim(),
        shape: 'panel', bearing: heading
      });
      if (m) {
        setMarkers(prev => [...prev, { ...m, distance_meters: 0 }]);
        setFormTitle(''); setFormContent('');
        setShowPublish(false);
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'خطأ';
      alert(`فشل النشر:\n${msg}`);
    } finally { setSubmitting(false); }
  };

  const handleDelete = async id => {
    if (!confirm('حذف هذه العلامة نهائياً؟')) return;
    try {
      await arService.deleteARContent(id);
      setMarkers(p => p.filter(m => m.id !== id));
      setSelected(null);
    } catch { alert('خطأ أثناء الحذف'); }
  };

  const closeAll = useCallback(() => {
    setSelected(null);
    setShowPublish(false);
  }, []);

  // ── Processed markers ──
  const processed = coords ? markers.map(m => {
    const dist    = haversine(coords.lat, coords.lon, +m.latitude, +m.longitude);
    const brng    = calcBearing(coords.lat, coords.lon, +m.latitude, +m.longitude);
    let   rel     = brng - heading;
    if (rel < -180) rel += 360;
    if (rel >  180) rel -= 360;
    const visible = Math.abs(rel) < FOV / 2 + 5; // slight overdraw buffer
    const xPct    = 50 + (rel / (FOV / 2)) * 50;
    // Y: markers on horizon (~35%), closer ones slightly lower
    const yPct    = 35 + Math.min(18, (dist / 500) * 12);
    const opacity = Math.max(0.2, 1 - Math.abs(rel) / (FOV / 2 + 5)) * Math.max(0.4, 1 - dist / 2500);
    const scale   = Math.max(0.6, Math.min(1.15, 1.1 - dist / 2000));
    return { ...m, dist, brng, rel, visible, xPct, yPct, opacity, scale };
  }) : [];

  // Status text
  let statusText = 'جاري التحديد...';
  if (gpsError) statusText = 'تعذّر تحديد الموقع';
  else if (coords) statusText = `±${coords.acc}م · ${markers.length} علامة`;

  return (
    <div className="ar-viewer-container">
      {/* Camera feed */}
      <video ref={videoRef} autoPlay playsInline muted className="ar-video-feed" />
      <div className="ar-overlay-mask" />
      <div className="ar-scanner-line" />

      <div className="ar-hud-overlay">

        {/* ── TOP STRIP ── */}
        <header className="ar-top-strip ar-interactive">
          <div className="ar-status-left">
            <span className={`ar-gps-dot${gpsError ? ' error' : !coords ? ' searching' : ''}`} />
            <span className="ar-status-text">{statusText}</span>
          </div>
          <div className="ar-top-actions">
            {needCompass && (
              <button className="ar-icon-btn" onClick={requestCompass} title="تفعيل البوصلة" style={{ fontSize: '.9rem' }}>🧭</button>
            )}
            {isAdmin && coords && (
              <button className="ar-icon-btn add-btn" onClick={() => { setShowPublish(v => !v); setSelected(null); }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
            )}
            <button className="ar-icon-btn" onClick={onClose}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </header>

        {/* ── CROSSHAIR ── */}
        {!gpsError && (
          <div className="ar-crosshair" aria-hidden>
            <div className="ar-crosshair-tl" />
            <div className="ar-crosshair-tr" />
            <div className="ar-crosshair-bl" />
            <div className="ar-crosshair-br" />
          </div>
        )}

        {/* ── AR MARKERS ── */}
        <div className="ar-viewport">
          {!gpsError && processed.map(m => {
            if (!m.visible) return null;
            const isNear = m.dist < 80;
            return (
              <div
                key={m.id}
                className={`ar-card${isNear ? ' near' : ''}`}
                style={{ left: `${m.xPct}%`, top: `${m.yPct}%`, opacity: m.opacity, transform: `translate(-50%, -50%) scale(${m.scale})` }}
                onClick={() => { setSelected(m); setShowPublish(false); }}
              >
                <div className="ar-card-glass">
                  <div className="ar-card-title">{m.title}</div>
                  <div className="ar-card-dist">{fmtDist(m.dist)}</div>
                </div>
                <div className="ar-card-stem" />
                <div className="ar-card-dot" />
              </div>
            );
          })}
        </div>

        {/* ── SYSTEM MESSAGES ── */}
        {loading && !gpsError && (
          <div className="ar-sys-msg">
            <div className="ar-spinner" />
            <p className="ar-sys-text">جاري تحديد الموقع والمزامنة...</p>
          </div>
        )}
        {gpsError && (
          <div className="ar-sys-msg">
            <p className="ar-sys-text" style={{ color: '#ff453a' }}>{gpsError}</p>
          </div>
        )}
        {!loading && !gpsError && markers.length === 0 && (
          <div className="ar-sys-msg">
            <p className="ar-sys-text">
              لا توجد علامات قريبة في نطاق 3 كم
              {isAdmin && <span style={{ display: 'block', marginTop: 8, color: '#ff9f0a' }}>اضغط (+) لنشر أول علامة هنا</span>}
            </p>
          </div>
        )}

        {/* ── COMPASS PILL ── */}
        {!gpsError && (
          <div className="ar-compass-pill">
            <span className="ar-compass-deg">{heading}°</span>
            <span className="ar-compass-sep" />
            <span className="ar-compass-dir">{dirLabel(heading)}</span>
          </div>
        )}

        {/* ── DETAIL SHEET ── */}
        {selected && (
          <>
            <div className="ar-sheet-backdrop ar-interactive" onClick={() => setSelected(null)} />
            <div className="ar-sheet ar-interactive">
              <div className="ar-sheet-handle" />
              <h2 className="ar-sheet-title">{selected.title}</h2>
              <div className="ar-sheet-meta">
                <span>{fmtDist(selected.dist)}</span>
                <span className="ar-sheet-meta-sep">·</span>
                <span>{Math.round(selected.brng)}° {dirLabel(selected.brng)}</span>
              </div>
              {selected.content ? (
                <p className="ar-sheet-content">{selected.content}</p>
              ) : (
                <p className="ar-sheet-content" style={{ fontStyle: 'italic', opacity: .5 }}>لا يوجد وصف إضافي</p>
              )}
              <div className="ar-sheet-actions">
                {isAdmin && (
                  <button className="ar-sheet-btn delete" onClick={() => handleDelete(selected.id)}>حذف</button>
                )}
                <button className="ar-sheet-btn close" onClick={() => setSelected(null)}>إغلاق</button>
              </div>
            </div>
          </>
        )}

        {/* ── PUBLISH SHEET (Admin) ── */}
        {showPublish && coords && (
          <div className="ar-publish-sheet ar-interactive">
            <div className="ar-publish-header">
              <h2 className="ar-publish-title">نشر علامة مكانية</h2>
              <button className="ar-icon-btn" onClick={() => setShowPublish(false)} style={{ width: 30, height: 30, background: 'transparent', border: 'none', boxShadow: 'none' }}>✕</button>
            </div>
            <form onSubmit={handlePublish}>
              <div className="ar-field">
                <label className="ar-field-label">العنوان</label>
                <input className="ar-field-input" type="text" required
                  placeholder="مثال: مدخل المبنى الرئيسي"
                  value={formTitle} onChange={e => setFormTitle(e.target.value)} />
              </div>
              <div className="ar-field">
                <label className="ar-field-label">المحتوى أو الوصف</label>
                <textarea className="ar-field-textarea" rows="3"
                  placeholder="اكتب أي معلومات تريد إظهارها عند الضغط على العلامة..."
                  value={formContent} onChange={e => setFormContent(e.target.value)} />
              </div>
              <div className="ar-field">
                <label className="ar-field-label">الموقع الحالي</label>
                <div className="ar-field-coords">
                  <div>LAT <span>{coords.lat.toFixed(6)}</span></div>
                  <div>LON <span>{coords.lon.toFixed(6)}</span></div>
                  <div style={{ gridColumn: 'span 2' }}>اتجاه <span>{heading}° {dirLabel(heading)}</span></div>
                </div>
              </div>
              <button type="submit" className="ar-publish-btn" disabled={submitting || !formTitle.trim()}>
                {submitting ? 'جاري النشر...' : 'نشر في الواقع المعزز'}
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}
