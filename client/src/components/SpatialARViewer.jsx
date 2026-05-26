import { useState, useEffect, useRef, useCallback } from 'react';
import { arService } from '../services/api';
import './SpatialARViewer.css';

// ═══════════════════════════════════════════════════
// MATH
// ═══════════════════════════════════════════════════
const DEG = Math.PI / 180;

// Tilt-compensated heading from raw device orientation (Android absolute)
function tiltCompensatedHeading(alpha, beta, gamma) {
  const a = alpha * DEG, b = beta * DEG, g = gamma * DEG;
  const x = -Math.cos(a) * Math.sin(b) * Math.sin(g) + Math.sin(a) * Math.cos(g);
  const y =  Math.cos(a) * Math.cos(g) + Math.sin(a) * Math.sin(b) * Math.sin(g);
  return (Math.atan2(x, y) / DEG + 360) % 360;
}

// EMA smoothing with wrap-around handling
function ema(prev, next, alpha) {
  let d = next - prev;
  if (d >  180) d -= 360;
  if (d < -180) d += 360;
  return (prev + alpha * d + 360) % 360;
}

// Signed smallest angle A→B  (-180 to +180)
function angleDiff(a, b) {
  let d = a - b;
  if (d >  180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

// Haversine in metres
function distM(lat1, lon1, lat2, lon2) {
  const dLat = (lat2 - lat1) * DEG, dLon = (lon2 - lon1) * DEG;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * DEG) * Math.cos(lat2 * DEG) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const H_FOV = 63; // horizontal camera FOV (degrees) — typical smartphone
const V_FOV = 48; // vertical camera FOV

// Visibility radius: marker only shown when user is this close
const SHOW_RADIUS_M = 30;

const DIRS = ['N','NE','E','SE','S','SW','W','NW'];
const dir  = h => DIRS[Math.round(((h % 360) + 360) % 360 / 45) % 8];
const fmt  = m  => m < 1000 ? `${Math.round(m)} م` : `${(m / 1000).toFixed(1)} كم`;

// ═══════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════
export default function SpatialARViewer({ onClose, user }) {
  const videoRef  = useRef(null);
  const streamRef = useRef(null);

  // Compass state — stored in refs for smooth animation, mirrored to state for render
  const hSmooth = useRef(0);    // smoothed heading (degrees)
  const hRaw    = useRef(null); // last raw heading
  const pSmooth = useRef(90);   // smoothed pitch/beta (90 = vertical phone = horizontal view)

  const [heading,    setHeading]    = useState(0);
  const [pitchBeta,  setPitchBeta]  = useState(90);
  const [coords,     setCoords]     = useState(null);
  const [gpsError,   setGpsError]   = useState(null);
  const [markers,    setMarkers]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [compassOk,  setCompassOk]  = useState(false);
  const [needIosPerm,setNeedIosPerm]= useState(false);

  const [selected,    setSelected]    = useState(null);
  const [showPublish, setShowPublish] = useState(false);
  const [formTitle,   setFormTitle]   = useState('');
  const [formContent, setFormContent] = useState('');
  const [submitting,  setSubmitting]  = useState(false);

  const isAdmin = user?.role === 'admin';

  // ── Camera ──────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const s = await navigator.mediaDevices?.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (videoRef.current) videoRef.current.srcObject = s;
        streamRef.current = s;
      } catch {}
    })();
    return () => streamRef.current?.getTracks().forEach(t => t.stop());
  }, []);

  // ── GPS ─────────────────────────────────────────
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

  // ── Compass ─────────────────────────────────────
  const onOrientation = useCallback((e) => {
    let rawH = null;

    if (typeof e.webkitCompassHeading === 'number' && !isNaN(e.webkitCompassHeading)) {
      rawH = e.webkitCompassHeading; // iOS — tilt-compensated, 0=North
    } else if (e.absolute === true && e.alpha != null && e.beta != null && e.gamma != null) {
      rawH = tiltCompensatedHeading(e.alpha, e.beta, e.gamma); // Android absolute
    }

    if (rawH === null) return;

    // EMA heading (alpha=0.18 — smooth but responsive)
    if (hRaw.current === null) hSmooth.current = rawH;
    else hSmooth.current = ema(hSmooth.current, rawH, 0.18);
    hRaw.current = rawH;

    // Pitch: beta angle (90 = phone vertical / horizontal view, 60 = tilted down, 120 = tilted up)
    const rawBeta = e.beta ?? 90;
    pSmooth.current = pSmooth.current + 0.2 * (rawBeta - pSmooth.current);

    setHeading(Math.round(hSmooth.current * 10) / 10);
    setPitchBeta(pSmooth.current);
    setCompassOk(true);
  }, []);

  useEffect(() => {
    if (typeof DeviceOrientationEvent?.requestPermission === 'function') {
      setNeedIosPerm(true);
      return;
    }
    const evt = 'ondeviceorientationabsolute' in window
      ? 'deviceorientationabsolute' : 'deviceorientation';
    window.addEventListener(evt, onOrientation, true);
    return () => window.removeEventListener(evt, onOrientation, true);
  }, [onOrientation]);

  const requestIosCompass = async () => {
    try {
      if (await DeviceOrientationEvent.requestPermission() === 'granted') {
        setNeedIosPerm(false);
        window.addEventListener('deviceorientation', onOrientation, true);
      }
    } catch {}
  };

  // ── Fetch markers ────────────────────────────────
  // Fetch all within 3km — frontend decides visibility by SHOW_RADIUS_M
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

  // ── Publish ──────────────────────────────────────
  const handlePublish = async e => {
    e.preventDefault();
    if (!coords || !formTitle.trim()) return;
    setSubmitting(true);
    try {
      const m = await arService.create({
        latitude:  coords.lat,   // full float64 precision
        longitude: coords.lon,
        title:     formTitle.trim(),
        content:   formContent.trim(),
        bearing:   Math.round(hSmooth.current * 10) / 10,  // saved heading at publish moment
        pitch:     Math.round(pSmooth.current * 10) / 10,  // saved vertical tilt
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

  // ═══════════════════════════════════════════════════
  // CORE POSITIONING ALGORITHM
  //
  // X: horizontal angle between user's current heading and marker's SAVED bearing
  // Y: vertical angle between user's current tilt   and marker's SAVED pitch/beta
  //
  // The marker is GLUED to the saved direction — it doesn't move unless YOU move.
  // GPS radius = determines whether marker is "active" at all (within SHOW_RADIUS_M).
  // ═══════════════════════════════════════════════════
  const positioned = coords ? markers.map(m => {
    const dist = distM(coords.lat, coords.lon, +m.latitude, +m.longitude);
    const active = dist <= SHOW_RADIUS_M; // only visible when physically close

    // Horizontal offset: saved bearing vs current heading
    const hDiff = angleDiff(+m.bearing, heading);        // positive = marker is to the RIGHT
    // Vertical offset: saved pitch vs current pitch
    // pitch stored as beta: 90=horizontal, <90=phone tilted back (cam up), >90=tilted forward (cam down)
    const vDiff = pitchBeta - +m.pitch;                  // positive = cam tilted more forward than publish = marker appears HIGHER

    // Screen position (0% top-left, 100% bottom-right)
    const xPct = 50 + (hDiff  / (H_FOV / 2)) * 50;
    const yPct = 50 + (vDiff  / (V_FOV / 2)) * 50;

    // Only render if within camera FOV (with small buffer for smooth appearance at edges)
    const inView = Math.abs(hDiff) < H_FOV / 2 + 6 && Math.abs(vDiff) < V_FOV / 2 + 6;

    // Opacity: full at center, fades toward edges
    const edgeFadeH = Math.max(0, 1 - Math.abs(hDiff) / (H_FOV / 2));
    const edgeFadeV = Math.max(0, 1 - Math.abs(vDiff) / (V_FOV / 2));
    const opacity   = edgeFadeH * edgeFadeV;

    return { ...m, dist, active, hDiff, vDiff, xPct, yPct, inView, opacity };
  }) : [];

  const activeMarkers  = positioned.filter(m => m.active);
  const visibleMarkers = activeMarkers.filter(m => m.inView && m.opacity > 0.05);

  // Status bar text
  let statusText = 'تحديد الموقع...';
  if (gpsError) statusText = 'تعذّر الحصول على الموقع';
  else if (coords && compassOk) {
    const near = activeMarkers.length;
    statusText = near > 0
      ? `${near} علامة في نطاقك · ±${coords.acc}م`
      : `±${coords.acc}م · لا توجد علامات قريبة`;
  } else if (coords) statusText = `±${coords.acc}م · البوصلة تحتاج معايرة ⚠`;

  return (
    <div className="ar-viewer-container">
      <video ref={videoRef} autoPlay playsInline muted className="ar-video-feed" />
      <div className="ar-overlay-mask" />
      <div className="ar-scanner-line" />

      <div className="ar-hud-overlay">

        {/* ── TOP STATUS STRIP ── */}
        <header className="ar-top-strip ar-interactive">
          <div className="ar-status-left">
            <span className={`ar-gps-dot${gpsError ? ' error' : !coords ? ' searching' : ''}`} />
            <span className="ar-status-text">{statusText}</span>
          </div>
          <div className="ar-top-actions">
            {needIosPerm && (
              <button className="ar-icon-btn" onClick={requestIosCompass}>🧭</button>
            )}
            {isAdmin && coords && (
              <button className="ar-icon-btn add-btn"
                style={{ background: showPublish ? 'rgba(255,159,10,.35)' : undefined }}
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
          {visibleMarkers.map(m => (
            <div key={m.id} className="ar-card"
              style={{
                left:      `${m.xPct}%`,
                top:       `${m.yPct}%`,
                opacity:    m.opacity,
                transform: 'translate(-50%, -50%)',
              }}
              onClick={() => { setSelected(m); setShowPublish(false); }}>
              <div className="ar-card-glass">
                <div className="ar-card-title">{m.title}</div>
                <div className="ar-card-dist">{fmt(m.dist)}</div>
              </div>
              <div className="ar-card-stem" />
              <div className="ar-card-dot" />
            </div>
          ))}
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
            <p className="ar-sys-text" style={{ color:'#ff453a' }}>{gpsError}</p>
          </div>
        )}
        {!loading && !gpsError && coords && activeMarkers.length === 0 && !showPublish && (
          <div className="ar-sys-msg">
            <p className="ar-sys-text">
              لا توجد علامات في نطاق {SHOW_RADIUS_M}م من موقعك
              {isAdmin && <span style={{ display:'block', marginTop:8, color:'#ff9f0a' }}>وجّه الكاميرا للمكان المراد ثم اضغط (+)</span>}
            </p>
          </div>
        )}

        {/* ── COMPASS PILL ── */}
        {!gpsError && (
          <div className="ar-compass-pill">
            <span className="ar-compass-deg">{Math.round(heading)}°</span>
            <span className="ar-compass-sep" />
            <span className="ar-compass-dir">{dir(heading)}</span>
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
                <span>{fmt(selected.dist)}</span>
                <span className="ar-sheet-meta-sep">·</span>
                <span>{Math.round(+selected.bearing)}° {dir(+selected.bearing)}</span>
              </div>
              {selected.content
                ? <p className="ar-sheet-content">{selected.content}</p>
                : <p className="ar-sheet-content" style={{ fontStyle:'italic', opacity:.4 }}>لا يوجد وصف</p>
              }
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
              <h2 className="ar-publish-title">تثبيت علامة هنا</h2>
              <button className="ar-icon-btn"
                style={{ width:30, height:30, background:'transparent', border:'none', boxShadow:'none', color:'rgba(255,255,255,.5)' }}
                onClick={() => setShowPublish(false)}>✕</button>
            </div>

            {/* Live direction indicator while authoring */}
            <div style={{
              background: 'rgba(255,159,10,.08)',
              border: '1px solid rgba(255,159,10,.2)',
              borderRadius: 10, padding: '8px 12px',
              marginBottom: 14, fontSize: '.78rem', color: 'rgba(255,255,255,.6)',
              display: 'flex', justifyContent: 'space-between'
            }}>
              <span>اتجاه الكاميرا الآن</span>
              <span style={{ color:'#ff9f0a', fontWeight:700 }}>
                {Math.round(heading)}° {dir(heading)} · ميل {Math.round(pitchBeta)}°
              </span>
            </div>
            <p style={{ fontSize:'.75rem', color:'rgba(255,255,255,.35)', marginBottom:14, lineHeight:1.5 }}>
              وجّه الكاميرا نحو المكان الذي تريد ربط العلامة فيه، ثم اضغط «تثبيت».
            </p>

            <form onSubmit={handlePublish}>
              <div className="ar-field">
                <label className="ar-field-label">العنوان</label>
                <input className="ar-field-input" type="text" required
                  placeholder="مثال: مدخل المبنى الرئيسي"
                  value={formTitle} onChange={e => setFormTitle(e.target.value)} />
              </div>
              <div className="ar-field">
                <label className="ar-field-label">الوصف (اختياري)</label>
                <textarea className="ar-field-textarea" rows="2"
                  placeholder="معلومات تظهر عند الضغط على العلامة..."
                  value={formContent} onChange={e => setFormContent(e.target.value)} />
              </div>
              <div className="ar-field">
                <label className="ar-field-label">موقع التثبيت</label>
                <div className="ar-field-coords">
                  <div>LAT <span>{coords.lat.toFixed(8)}</span></div>
                  <div>LON <span>{coords.lon.toFixed(8)}</span></div>
                  <div>دقة GPS <span>±{coords.acc}م</span></div>
                  <div>اتجاه <span>{Math.round(heading)}° {dir(heading)}</span></div>
                </div>
              </div>
              <button type="submit" className="ar-publish-btn" disabled={submitting || !formTitle.trim()}>
                {submitting ? 'جاري التثبيت...' : `تثبيت باتجاه ${Math.round(heading)}° ${dir(heading)}`}
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}
