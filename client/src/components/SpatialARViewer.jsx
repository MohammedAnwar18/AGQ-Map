import { useState, useEffect, useRef, useCallback } from 'react';
import { arService } from '../services/api';
import './SpatialARViewer.css';

// ═══════════════════════════════════════════════════════════════
// MATH HELPERS
// ═══════════════════════════════════════════════════════════════
const DEG = Math.PI / 180;

// Tilt-compensated compass heading from raw orientation angles
// Works for Android (absolute) — iOS uses webkitCompassHeading directly
function tiltCompensatedHeading(alpha, beta, gamma) {
  const a = alpha * DEG, b = beta * DEG, g = gamma * DEG;
  // Project North vector through device rotation matrix
  const x = -Math.cos(a) * Math.sin(b) * Math.sin(g) + Math.sin(a) * Math.cos(g);
  const y =  Math.cos(a) * Math.cos(g) + Math.sin(a) * Math.sin(b) * Math.sin(g);
  const h = Math.atan2(x, y) / DEG;
  return (h + 360) % 360;
}

// Smooth angle (handles 0/360 wrap-around)
function smoothAngle(prev, next, alpha) {
  let d = next - prev;
  if (d >  180) d -= 360;
  if (d < -180) d += 360;
  return (prev + alpha * d + 360) % 360;
}

// Haversine distance in meters
function distMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * DEG, dLon = (lon2 - lon1) * DEG;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*DEG)*Math.cos(lat2*DEG)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// True bearing from point1 to point2 (0=N, 90=E, ...)
function bearingTo(lat1, lon1, lat2, lon2) {
  const y = Math.sin((lon2-lon1)*DEG) * Math.cos(lat2*DEG);
  const x = Math.cos(lat1*DEG)*Math.sin(lat2*DEG) - Math.sin(lat1*DEG)*Math.cos(lat2*DEG)*Math.cos((lon2-lon1)*DEG);
  return (Math.atan2(y, x) / DEG + 360) % 360;
}

// Smallest signed angle between two headings
function angleDiff(target, ref) {
  let d = target - ref;
  if (d >  180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

const H_FOV = 63;   // horizontal FOV (typical smartphone camera, degrees)

const DIRS = ['N','NE','E','SE','S','SW','W','NW'];
function dirLabel(h) { return DIRS[Math.round(h / 45) % 8]; }
function fmtDist(m) { return m < 1000 ? `${Math.round(m)} م` : `${(m/1000).toFixed(1)} كم`; }

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function SpatialARViewer({ onClose, user }) {
  const videoRef   = useRef(null);
  const streamRef  = useRef(null);

  // Smoothed heading state (degrees, 0=N)
  const rawHeading = useRef(null);     // last raw reading
  const smoothed   = useRef(0);        // EMA output

  // Device pitch for vertical placement
  const pitchRef   = useRef(0);        // beta angle (0=flat, 90=vertical)

  const [heading, setHeading]   = useState(0);
  const [pitch,   setPitch]     = useState(60); // assume phone held ~60° from flat
  const [coords,  setCoords]    = useState(null);
  const [gpsError,setGpsError]  = useState(null);
  const [markers, setMarkers]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [compassOk, setCompassOk] = useState(false);
  const [needIosPermission, setNeedIosPermission] = useState(false);

  const [selected,    setSelected]    = useState(null);
  const [showPublish, setShowPublish] = useState(false);
  const [formTitle,   setFormTitle]   = useState('');
  const [formContent, setFormContent] = useState('');
  const [submitting,  setSubmitting]  = useState(false);

  const isAdmin = user?.role === 'admin';

  // ── CAMERA ──────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const stream = await navigator.mediaDevices?.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (videoRef.current) videoRef.current.srcObject = stream;
        streamRef.current = stream;
      } catch {}
    })();
    return () => streamRef.current?.getTracks().forEach(t => t.stop());
  }, []);

  // ── GPS ─────────────────────────────────────────────────────
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

  // ── COMPASS ─────────────────────────────────────────────────
  const handleOrientation = useCallback((e) => {
    let raw = null;

    if (typeof e.webkitCompassHeading === 'number' && !isNaN(e.webkitCompassHeading)) {
      // iOS: already tilt-compensated, 0=North
      raw = e.webkitCompassHeading;
    } else if (e.absolute === true &&
               e.alpha !== null && e.beta !== null && e.gamma !== null) {
      // Android absolute: compute tilt-compensated heading
      raw = tiltCompensatedHeading(e.alpha, e.beta, e.gamma);
    }

    if (raw === null) return;

    // Smooth with EMA (alpha=0.2 → responsive but not jittery)
    if (rawHeading.current === null) {
      smoothed.current = raw;
    } else {
      smoothed.current = smoothAngle(smoothed.current, raw, 0.20);
    }
    rawHeading.current = raw;

    // Capture pitch (beta) for vertical placement
    // beta: 0=flat on table, 90=vertical (portrait pointing forward)
    const b = e.beta ?? 60;
    pitchRef.current = Math.max(10, Math.min(90, Math.abs(b)));
    setPitch(pitchRef.current);

    setHeading(Math.round(smoothed.current * 10) / 10);
    setCompassOk(true);
  }, []);

  useEffect(() => {
    // Check if iOS needs permission
    if (typeof DeviceOrientationEvent?.requestPermission === 'function') {
      setNeedIosPermission(true);
      return;
    }
    // Android / others: listen directly
    const evt = 'ondeviceorientationabsolute' in window
      ? 'deviceorientationabsolute'
      : 'deviceorientation';
    window.addEventListener(evt, handleOrientation, true);
    return () => window.removeEventListener(evt, handleOrientation, true);
  }, [handleOrientation]);

  const requestIosCompass = async () => {
    try {
      const state = await DeviceOrientationEvent.requestPermission();
      if (state === 'granted') {
        setNeedIosPermission(false);
        window.addEventListener('deviceorientation', handleOrientation, true);
      }
    } catch {}
  };

  // ── FETCH MARKERS ────────────────────────────────────────────
  useEffect(() => {
    if (!coords) return;
    const load = async () => {
      try {
        const d = await arService.getNearby(coords.lat, coords.lon, 3000);
        if (d?.contents) setMarkers(d.contents);
        setLoading(false);
      } catch { setLoading(false); }
    };
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [coords]);

  // ── PUBLISH ──────────────────────────────────────────────────
  const handlePublish = async e => {
    e.preventDefault();
    if (!coords || !formTitle.trim()) return;
    setSubmitting(true);
    try {
      const m = await arService.create({
        latitude:  coords.lat,
        longitude: coords.lon,
        title:     formTitle.trim(),
        content:   formContent.trim(),
        shape:     'panel',
        bearing:   Math.round(smoothed.current),
      });
      if (m) {
        setMarkers(p => [...p, { ...m, distance_meters: 0 }]);
        setFormTitle(''); setFormContent('');
        setShowPublish(false);
      }
    } catch (err) {
      alert(`فشل النشر:\n${err.response?.data?.error || err.message}`);
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

  // ── POSITION MARKERS ─────────────────────────────────────────
  // Y = based on device pitch so markers sit on the horizon correctly
  // When phone vertical (pitch≈90): horizon at center (50%)
  // When phone tilted forward (pitch≈60): horizon lower (~65%)
  const horizonY = 100 - pitch; // simple linear mapping: 90°→10%, 60°→40%

  const processed = coords ? markers.map(m => {
    const dist = distMeters(coords.lat, coords.lon, +m.latitude, +m.longitude);
    const brng  = bearingTo(coords.lat, coords.lon, +m.latitude, +m.longitude);
    const hDiff = angleDiff(brng, heading);                // horizontal angle diff
    const visible = Math.abs(hDiff) < (H_FOV / 2 + 8);    // slight overdraw buffer

    // Screen X: 0% = left edge, 100% = right edge
    const xPct = 50 + (hDiff / (H_FOV / 2)) * 50;

    // Screen Y: marker at horizon, near = slightly lower, far = at horizon
    // (elevator effect: close objects have more parallax downward)
    const nearOffset = Math.max(0, 1 - dist / 80) * 12;   // up to 12% lower when <80m
    const yPct = horizonY + nearOffset;

    // Opacity: full when centered, fade toward edges + fade with distance
    const edgeFade = Math.max(0, 1 - Math.abs(hDiff) / (H_FOV / 2));
    const distFade = Math.max(0.3, 1 - dist / 2000);
    const opacity  = edgeFade * distFade;

    // Scale: closer = slightly larger
    const scale = Math.max(0.65, Math.min(1.1, 0.9 + (1 - Math.min(dist, 500) / 500) * 0.2));

    return { ...m, dist, brng, hDiff, visible, xPct, yPct, opacity, scale };
  }) : [];

  // Status
  let statusText = 'تحديد الموقع...';
  if (gpsError) statusText = 'تعذّر الحصول على الموقع';
  else if (coords && compassOk) statusText = `±${coords.acc}م · ${markers.length} علامة`;
  else if (coords) statusText = `±${coords.acc}م · البوصلة تحتاج معايرة`;

  return (
    <div className="ar-viewer-container">
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
            {needIosPermission && (
              <button className="ar-icon-btn" onClick={requestIosCompass} title="تفعيل البوصلة">🧭</button>
            )}
            {isAdmin && coords && (
              <button className="ar-icon-btn add-btn"
                style={{ borderColor: showPublish ? 'rgba(255,159,10,.6)' : undefined }}
                onClick={() => { setShowPublish(v => !v); setSelected(null); }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </button>
            )}
            <button className="ar-icon-btn" onClick={onClose}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </header>

        {/* ── CROSSHAIR ── */}
        {!gpsError && (
          <div className="ar-crosshair" aria-hidden>
            <div className="ar-crosshair-tl"/><div className="ar-crosshair-tr"/>
            <div className="ar-crosshair-bl"/><div className="ar-crosshair-br"/>
          </div>
        )}

        {/* ── AR MARKERS ── */}
        <div className="ar-viewport">
          {!gpsError && processed.map(m => {
            if (!m.visible || m.opacity < 0.05) return null;
            const isNear = m.dist < 60;
            return (
              <div key={m.id} className={`ar-card${isNear ? ' near' : ''}`}
                style={{
                  left:      `${m.xPct}%`,
                  top:       `${m.yPct}%`,
                  opacity:    m.opacity,
                  transform: `translate(-50%, -50%) scale(${m.scale})`,
                }}
                onClick={() => { setSelected(m); setShowPublish(false); }}>
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
            <p className="ar-sys-text">تحديد الموقع الجغرافي...</p>
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
              {isAdmin && <span style={{ display:'block', marginTop:8, color:'#ff9f0a' }}>اضغط (+) لنشر أول علامة هنا</span>}
            </p>
          </div>
        )}

        {/* ── COMPASS PILL ── */}
        {!gpsError && (
          <div className="ar-compass-pill">
            <span className="ar-compass-deg">{Math.round(heading)}°</span>
            <span className="ar-compass-sep" />
            <span className="ar-compass-dir">{dirLabel(heading)}</span>
            {!compassOk && <span style={{ fontSize:'.6rem', color:'#ff9f0a', marginRight:4 }}>⚠</span>}
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
              {selected.content
                ? <p className="ar-sheet-content">{selected.content}</p>
                : <p className="ar-sheet-content" style={{ fontStyle:'italic', opacity:.45 }}>لا يوجد وصف</p>
              }
              <div className="ar-sheet-actions">
                {isAdmin && <button className="ar-sheet-btn delete" onClick={() => handleDelete(selected.id)}>حذف</button>}
                <button className="ar-sheet-btn close" onClick={() => setSelected(null)}>إغلاق</button>
              </div>
            </div>
          </>
        )}

        {/* ── PUBLISH SHEET (Admin) ── */}
        {showPublish && coords && (
          <div className="ar-publish-sheet ar-interactive">
            <div className="ar-publish-header">
              <h2 className="ar-publish-title">نشر علامة — الموقع الحالي</h2>
              <button className="ar-icon-btn" onClick={() => setShowPublish(false)}
                style={{ width:30, height:30, background:'transparent', border:'none', boxShadow:'none', color:'rgba(255,255,255,.6)' }}>✕</button>
            </div>
            <form onSubmit={handlePublish}>
              <div className="ar-field">
                <label className="ar-field-label">العنوان</label>
                <input className="ar-field-input" type="text" required
                  placeholder="مثال: مدخل المبنى الرئيسي"
                  value={formTitle} onChange={e => setFormTitle(e.target.value)} />
              </div>
              <div className="ar-field">
                <label className="ar-field-label">الوصف</label>
                <textarea className="ar-field-textarea" rows="3"
                  placeholder="معلومات تظهر عند الضغط على العلامة..."
                  value={formContent} onChange={e => setFormContent(e.target.value)} />
              </div>
              <div className="ar-field">
                <label className="ar-field-label">تثبيت الموقع عند</label>
                <div className="ar-field-coords">
                  <div>LAT <span>{coords.lat.toFixed(6)}</span></div>
                  <div>LON <span>{coords.lon.toFixed(6)}</span></div>
                  <div style={{ gridColumn:'span 2' }}>دقة GPS <span>±{coords.acc}م</span></div>
                </div>
              </div>
              <button type="submit" className="ar-publish-btn" disabled={submitting || !formTitle.trim()}>
                {submitting ? 'جاري التثبيت...' : 'تثبيت في هذا الموقع'}
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}
