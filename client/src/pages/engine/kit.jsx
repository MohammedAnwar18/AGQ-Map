import React from 'react';

/* ============================================================================
   PalNovaa Engine — طاقم المحرّك (ثوابت/محمّلات/محوّلات/أيقونات، بلا حالة React)
   مفصولٌ عن PalNovaaEnginePage.jsx لإبقاء الملفّ الرئيسيّ أخفّ وأسهل صيانةً.
   ============================================================================ */

/* رابط التطبيق المنشور: نطاقٌ فرعيّ أنيق <slug>.palnovaa.com (عبر Cloudflare Worker)،
   مع تراجعٍ إلى /pe/<slug> في التطوير (localhost/IP) أو إن تعذّر استخراج النطاق. */
export const APPS_BASE = (() => {
  try {
    const h = window.location.hostname;
    if (!h || h === 'localhost' || /^(\d+\.){3}\d+$/.test(h)) return '';
    return h.replace(/^www\./, '');
  } catch { return ''; }
})();
export const appLink = (slug) => (APPS_BASE ? `https://${slug}.${APPS_BASE}` : `${window.location.origin}/pe/${slug}`);

export const API = (import.meta.env.VITE_API_URL || '/api');
export const KEY_LS = 'palnovaa_engine_key';

export const authHeaders = () => {
  const h = { 'Content-Type': 'application/json' };
  const t = localStorage.getItem('token');
  if (t) h.Authorization = `Bearer ${t}`;
  return h;
};
export const jpost = (p, body) => fetch(`${API}${p}`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) }).then((r) => r.json());
export const jput = (p, body) => fetch(`${API}${p}`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(body) }).then((r) => r.json());
export const jget = (p) => fetch(`${API}${p}`, { headers: authHeaders() }).then((r) => r.json());
export const jdel = (p) => fetch(`${API}${p}`, { method: 'DELETE', headers: authHeaders() }).then((r) => r.json());

/* ====== محمّلات مكتبات الخرائط (CDN، كسولة، بلا تكرار) ====== */
export const MAPLIBS = {
  leafletCss: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css',
  leaflet: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js',
  esri: 'https://cdnjs.cloudflare.com/ajax/libs/esri-leaflet/3.0.12/esri-leaflet.js',
  vectorgrid: 'https://cdn.jsdelivr.net/npm/leaflet.vectorgrid@1.3.0/dist/Leaflet.VectorGrid.bundled.js',
  proj4: 'https://cdnjs.cloudflare.com/ajax/libs/proj4js/2.11.0/proj4.js',
  georaster: 'https://cdn.jsdelivr.net/npm/georaster@1.6.0/dist/georaster.browser.bundle.min.js',
  georasterLayer: 'https://cdn.jsdelivr.net/npm/georaster-layer-for-leaflet@3.10.0/dist/georaster-layer-for-leaflet.min.js',
  geomanCss: 'https://unpkg.com/@geoman-io/leaflet-geoman-free@2.17.0/dist/leaflet-geoman.css',
  geomanJs: 'https://unpkg.com/@geoman-io/leaflet-geoman-free@2.17.0/dist/leaflet-geoman.min.js',
};
/* طبقات أساس الأقمار الصناعيّة */
export const ESRI_IMAGERY = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
export const GOOGLE_SAT = 'https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}';
export const GOOGLE_SAT_SUBS = ['mt0', 'mt1', 'mt2', 'mt3'];
const _libCache = {};
export const loadScript = (url) => {
  if (_libCache[url]) return _libCache[url];
  _libCache[url] = new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = url; s.async = true;
    s.onload = () => res(); s.onerror = () => rej(new Error('تعذّر تحميل مكتبة الخريطة'));
    document.head.appendChild(s);
  });
  return _libCache[url];
};
export const loadCss = (url) => { if (_libCache['css:' + url]) return; _libCache['css:' + url] = true; const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = url; document.head.appendChild(l); };
/* أنظمة إحداثيّات فلسطين (تعريفات proj4) */
export const PROJ_DEFS = {
  'EPSG:28191': '+proj=cass +lat_0=31.73409694444445 +lon_0=35.21208055555556 +x_0=170251.555 +y_0=126867.909 +ellps=clrk80 +towgs84=-275.722,94.7824,340.894,-8.001,-4.42,-11.821,1 +units=m +no_defs',
  'EPSG:28192': '+proj=cass +lat_0=31.73409694444445 +lon_0=35.21208055555556 +x_0=170251.555 +y_0=1126867.909 +ellps=clrk80 +towgs84=-275.722,94.7824,340.894,-8.001,-4.42,-11.821,1 +units=m +no_defs',
  'EPSG:2039': '+proj=tmerc +lat_0=31.73439361111111 +lon_0=35.20451694444445 +k=1.0000067 +x_0=219529.584 +y_0=626907.39 +ellps=GRS80 +towgs84=-24.0024,-17.1032,-17.8444,-0.33077,-1.85269,1.66969,5.4262 +units=m +no_defs',
};
export const ensureProj4 = async () => {
  if (!window.proj4) await loadScript(MAPLIBS.proj4);
  if (window.proj4) for (const [k, def] of Object.entries(PROJ_DEFS)) { try { if (!window.proj4.defs(k)) window.proj4.defs(k, def); } catch { /* */ } }
};
export const ensureLeaflet = async () => { loadCss(MAPLIBS.leafletCss); if (!window.L) await loadScript(MAPLIBS.leaflet); return window.L; };
export const ensureGeoman = async () => { await ensureLeaflet(); loadCss(MAPLIBS.geomanCss); if (!window.L.PM) await loadScript(MAPLIBS.geomanJs); return window.L; };
/* ===== قياسات جيوديسيّة (كرويّة) بلا مكتبات — بالأمتار ===== */
const _ER = 6378137;
const _rad = (d) => (d * Math.PI) / 180;
export const geoDist = (a, b) => { const dLat = _rad(b[0] - a[0]), dLng = _rad(b[1] - a[1]); const h = Math.sin(dLat / 2) ** 2 + Math.cos(_rad(a[0])) * Math.cos(_rad(b[0])) * Math.sin(dLng / 2) ** 2; return 2 * _ER * Math.asin(Math.min(1, Math.sqrt(h))); };
export const lineLen = (ll) => { let s = 0; for (let i = 1; i < ll.length; i++) s += geoDist(ll[i - 1], ll[i]); return s; };     // م
export const ringArea = (ll) => { const n = ll.length; if (n < 3) return 0; let a = 0; for (let i = 0; i < n; i++) { const p1 = ll[i], p2 = ll[(i + 1) % n]; a += _rad(p2[1] - p1[1]) * (2 + Math.sin(_rad(p1[0])) + Math.sin(_rad(p2[0]))); } return Math.abs((a * _ER * _ER) / 2); }; // م²
export const fmtArea = (m2) => (m2 >= 1_000_000 ? (m2 / 1_000_000).toFixed(3) + ' كم²' : (m2 / 1000).toFixed(m2 < 10000 ? 3 : 2) + ' دونم');
export const fmtLen = (m) => (m >= 1000 ? (m / 1000).toFixed(3) + ' كم' : m.toFixed(1) + ' م');
export const ensureEsri = async () => { await ensureLeaflet(); if (!window.L.esri) await loadScript(MAPLIBS.esri); };
export const ensureVectorGrid = async () => { await ensureLeaflet(); if (!window.L.vectorGrid) await loadScript(MAPLIBS.vectorgrid); };
export const ensureGeoraster = async () => {
  await ensureProj4();
  if (!window.parseGeoraster) await loadScript(MAPLIBS.georaster);
  await ensureLeaflet();
  if (!window.GeoRasterLayer) await loadScript(MAPLIBS.georasterLayer);
};

/* ====== محوّلات صيغ خفيفة إلى GeoJSON (بالمتصفّح) ====== */
export const SHP_URL = 'https://unpkg.com/shpjs@6.1.0/dist/shp.min.js';
export const SQLJS_BASE = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/';
export const ensureShp = async () => { if (!window.shp && !window.shpjs) await loadScript(SHP_URL); return window.shp || window.shpjs; };
let _sqlPromise = null;
export const ensureSqlJs = async () => {
  if (window.__PNE_SQL) return window.__PNE_SQL;
  if (!_sqlPromise) _sqlPromise = (async () => {
    if (!window.initSqlJs) await loadScript(SQLJS_BASE + 'sql-wasm.js');
    const SQL = await window.initSqlJs({ locateFile: (f) => SQLJS_BASE + f });
    window.__PNE_SQL = SQL; return SQL;
  })();
  return _sqlPromise;
};
/* محلّل WKB → هندسة GeoJSON (يدعم 2D/3D وكلّ الأنواع) */
export function wkbToGeoJSON(u8) {
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength); let p = 0;
  const read = () => {
    const little = dv.getUint8(p) === 1; p += 1;
    const t = dv.getUint32(p, little); p += 4;
    let base, dims = 2;
    if (t & 0xE0000000) { // EWKB
      if (t & 0x80000000) dims = 3;
      if (t & 0x20000000) p += 4; // SRID
      base = t & 0xff;
    } else { base = t % 1000; const q = Math.floor(t / 1000); if (q === 1 || q === 3) dims = 3; }
    const pt = () => { const c = [dv.getFloat64(p, little), dv.getFloat64(p + 8, little)]; p += 8 * dims; return c; };
    const ring = () => { const n = dv.getUint32(p, little); p += 4; const r = []; for (let i = 0; i < n; i++) r.push(pt()); return r; };
    if (base === 1) return { type: 'Point', coordinates: pt() };
    if (base === 2) { const n = dv.getUint32(p, little); p += 4; const c = []; for (let i = 0; i < n; i++) c.push(pt()); return { type: 'LineString', coordinates: c }; }
    if (base === 3) { const n = dv.getUint32(p, little); p += 4; const r = []; for (let i = 0; i < n; i++) r.push(ring()); return { type: 'Polygon', coordinates: r }; }
    if (base === 4 || base === 5 || base === 6) { const n = dv.getUint32(p, little); p += 4; const c = []; for (let i = 0; i < n; i++) c.push(read().coordinates); return { type: base === 4 ? 'MultiPoint' : base === 5 ? 'MultiLineString' : 'MultiPolygon', coordinates: c }; }
    if (base === 7) { const n = dv.getUint32(p, little); p += 4; const g = []; for (let i = 0; i < n; i++) g.push(read()); return { type: 'GeometryCollection', geometries: g }; }
    return null;
  };
  return read();
}
/* GeoPackage Binary → GeoJSON (يتخطّى ترويسة GPB) */
export function gpkgGeom(u8) {
  if (!u8 || u8.length < 8 || u8[0] !== 0x47 || u8[1] !== 0x50) return null;  // 'GP'
  const envType = (u8[3] >> 1) & 0x07;
  const envBytes = [0, 32, 48, 48, 64][envType] || 0;
  return wkbToGeoJSON(u8.subarray(8 + envBytes));
}

/* محلّل DXF (AutoCAD نصّيّ) → GeoJSON. يدعم LINE/LWPOLYLINE/POLYLINE+VERTEX/POINT/CIRCLE/ARC.
   ملاحظة: إحداثيّات DXF بوحدات الرسم (قد تكون مسقطاً مثل جريد فلسطين/ITM) بلا CRS معرّف — يُعاد إسقاطها من العارض. */
export function dxfToGeoJSON(text) {
  const raw = (text || '').split(/\r\n|\r|\n/);
  const pairs = [];
  for (let i = 0; i + 1 < raw.length; i += 2) { const c = parseInt(raw[i], 10); if (!Number.isNaN(c)) pairs.push([c, raw[i + 1]]); }
  const feats = [];
  const circlePoly = (cx, cy, r, a0, a1) => {
    const pts = []; const n = 48; const s = a0 == null ? 0 : a0 * Math.PI / 180; const e = a1 == null ? 2 * Math.PI : a1 * Math.PI / 180;
    let span = e - s; if (span <= 0) span += 2 * Math.PI;
    for (let i = 0; i <= n; i++) { const t = s + span * (i / n); pts.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]); }
    return pts;
  };
  const push = (geom, layer, type) => { if (geom) feats.push({ type: 'Feature', properties: { layer: layer || '0', cad: type }, geometry: geom }); };
  const emit = (ent) => {
    if (!ent) return;
    const g = (code) => { const f = ent.codes.find((p) => p[0] === code); return f ? parseFloat(f[1]) : undefined; };
    const all = (code) => ent.codes.filter((p) => p[0] === code).map((p) => parseFloat(p[1]));
    const layer = (ent.codes.find((p) => p[0] === 8) || [, '0'])[1];
    if (ent.type === 'LINE') { const x1 = g(10), y1 = g(20), x2 = g(11), y2 = g(21); if ([x1, y1, x2, y2].every(Number.isFinite)) push({ type: 'LineString', coordinates: [[x1, y1], [x2, y2]] }, layer, 'line'); }
    else if (ent.type === 'LWPOLYLINE' || ent.type === 'POLYLINE') {
      const xs = all(10), ys = all(20); const verts = []; for (let i = 0; i < Math.min(xs.length, ys.length); i++) if (Number.isFinite(xs[i]) && Number.isFinite(ys[i])) verts.push([xs[i], ys[i]]);
      if (verts.length >= 2) { const closed = ((g(70) || 0) & 1) === 1; if (closed && verts.length >= 3) { const r = [...verts, verts[0]]; push({ type: 'Polygon', coordinates: [r] }, layer, 'polyline'); } else push({ type: 'LineString', coordinates: verts }, layer, 'polyline'); }
    }
    else if (ent.type === 'POINT') { const x = g(10), y = g(20); if (Number.isFinite(x) && Number.isFinite(y)) push({ type: 'Point', coordinates: [x, y] }, layer, 'point'); }
    else if (ent.type === 'CIRCLE') { const x = g(10), y = g(20), r = g(40); if ([x, y, r].every(Number.isFinite)) push({ type: 'Polygon', coordinates: [circlePoly(x, y, r)] }, layer, 'circle'); }
    else if (ent.type === 'ARC') { const x = g(10), y = g(20), r = g(40); if ([x, y, r].every(Number.isFinite)) push({ type: 'LineString', coordinates: circlePoly(x, y, r, g(50), g(51)) }, layer, 'arc'); }
  };
  const KINDS = new Set(['LINE', 'LWPOLYLINE', 'POLYLINE', 'POINT', 'CIRCLE', 'ARC']);
  let inEnt = false, cur = null;
  for (let k = 0; k < pairs.length; k++) {
    const [code, valR] = pairs[k]; const val = (valR || '').trim();
    if (code === 2 && val === 'ENTITIES') { inEnt = true; continue; }
    if (code === 0) {
      if (inEnt && cur) { emit(cur); cur = null; }
      if (val === 'ENDSEC') { inEnt = false; continue; }
      if (inEnt) cur = KINDS.has(val) ? { type: val, codes: [] } : null;   // نتجاهل VERTEX/SEQEND وغيرها
      continue;
    }
    if (inEnt && cur) cur.codes.push([code, valR]);
  }
  return { type: 'FeatureCollection', features: feats };
}

/* طبقة صورة ArcGIS ديناميكيّة موثوقة: export كصورة مباشرة (لا تحتاج CORS)،
   مع إعادة الإسقاط من إسناد الخدمة إلى Web Mercator عبر الخادم. تتحدّث مع الحركة. */
export const makeArcgisImageLayer = (L, exportBase, layerIds, opacity = 0.85) => {
  const group = L.layerGroup();
  let current = null;
  const redraw = () => {
    const map = group._map; if (!map) return;
    const b = map.getBounds();
    const crs = L.CRS.EPSG3857;
    const sw = crs.project(b.getSouthWest());
    const ne = crs.project(b.getNorthEast());
    const size = map.getSize();
    const layersParam = (layerIds && layerIds.length) ? `&layers=show:${layerIds.join(',')}` : '';
    const url = `${exportBase}/export?bbox=${sw.x},${sw.y},${ne.x},${ne.y}&bboxSR=3857&imageSR=3857&size=${Math.round(size.x)},${Math.round(size.y)}&format=png32&transparent=true&dpi=96${layersParam}&f=image`;
    const ov = L.imageOverlay(url, b, { opacity });
    ov.addTo(group);
    const prev = current; current = ov;
    ov.on('load', () => { if (prev) group.removeLayer(prev); });
    ov.on('error', () => { if (prev) group.removeLayer(prev); });
  };
  group.on('add', () => { redraw(); if (group._map) group._map.on('moveend', redraw); });
  group.on('remove', () => { if (group._map) group._map.off('moveend', redraw); });
  return group;
};

export const SRC = {
  postgis: { n: 'PostGIS', t: 'DB', ctx: 'قاعدة بيانات مكانيّة PostGIS' },
  geojson: { n: 'GeoJSON', t: 'JSON', ctx: 'طبقة GeoJSON' },
  shp: { n: 'Shapefile', t: 'SHP', ctx: 'ملفّ Shapefile' },
  csv: { n: 'CSV', t: 'CSV', ctx: 'جدول CSV بإحداثيّات' },
  tif: { n: 'GeoTIFF', t: 'TIF', ctx: 'بيانات نقطيّة GeoTIFF' },
  wms: { n: 'WMS / WFS', t: 'OGC', ctx: 'خدمة خرائط WMS/WFS' },
  gpkg: { n: 'GeoPackage', t: 'GPKG', ctx: 'ملفّ GeoPackage' },
};
export const MODES = ['تطبيق ويب', 'لوحة مؤشرات', 'أداة تحليل', 'خريطة قصّة'];
export const CRS = ['EPSG:4326', 'EPSG:3857', 'EPSG:28191', 'EPSG:32636'];

export const STEPS = [
  { t: 'تحليل الطلب وتفعيل المهارات', m: 'intent · skills · scope' },
  { t: 'تصميم بنية التطبيق والمكوّنات', m: 'layout · components · state' },
  { t: 'بناء الواجهة والتفاعلات', m: 'charts · tables · forms · maps' },
  { t: 'ربط البيانات والمنطق', m: 'data · CRUD · API connectors' },
  { t: 'التصميم والتجاوب', m: 'RTL · responsive · dark theme' },
  { t: 'التحقّق وتشغيل المعاينة', m: 'validate · preview ready' },
];
export const TPL = [
  { t: 'مؤشر خطر الفيضان', d: 'تلوين القطع حسب درجة الخطر مع لوحات لكلّ حي.', tags: ['Choropleth', 'Turf'], p: 'ابنِ تطبيق ويب يعرض قطع الأراضي في نابلس ملوّنة حسب مؤشر خطر الفيضان، مع لوحة جانبيّة للطبقات، ومؤشّرات لعدد القطع عالية الخطورة والمساحة المعرّضة، وإمكانيّة الضغط على أيّ قطعة لعرض بياناتها.' },
  { t: 'إدارة شبكات المياه', d: 'خطوط الشبكة، الأعطال، وأقرب صمّام إغلاق.', tags: ['Network', 'Routing'], p: 'أريد لوحة لإدارة شبكة المياه: عرض الأنابيب حسب القطر والعمر، تسجيل الأعطال كنقاط على الخريطة، وإيجاد أقرب صمّام إغلاق لأيّ عطل.' },
  { t: 'إمكانيّة الوصول للخدمات', d: 'مناطق الخدمة بزمن المشي للمدارس والمراكز.', tags: ['Isochrones', 'Analysis'], p: 'ابنِ أداة تحليل تحسب مناطق الوصول بالمشي (5/10/15 دقيقة) حول المدارس والمراكز الصحيّة في رام الله، وتُظهر الأحياء غير المخدومة.' },
  { t: 'تتبّع الأسطول الميدانيّ', d: 'مواقع، مسارات، وتنبيهات خروج عن النطاق.', tags: ['Realtime', 'Geofence'], p: 'أريد تطبيقاً لتتبّع مركبات جمع النفايات، مع عرض المسارات اليوميّة وتنبيه عند الخروج عن نطاق العمل المحدّد.' },
];

export const Ico = {
  cube: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1A0D04" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 3 7l9 5 9-5-9-5Z" /><path d="m3 12 9 5 9-5" /><path d="m3 17 9 5 9-5" /></svg>,
  plus: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>,
  chat: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>,
  grid: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>,
  db: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5" /><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></svg>,
  share: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v13" /></svg>,
  rocket: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg>,
  key: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="8" cy="15" r="4" /><path d="m10.8 12.2 8.2-8.2M17 5l2 2M15 7l2 2" /></svg>,
  eye: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" /><circle cx="12" cy="12" r="3" /></svg>,
  eyeOff: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c7 0 11 8 11 8a18 18 0 0 1-2.16 3.19M6.6 6.6A18 18 0 0 0 1 12s4 8 11 8a9 9 0 0 0 5.4-1.6M1 1l22 22M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>,
  mapIco: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"><path d="m3 6 6-2 6 2 6-2v14l-6 2-6-2-6 2V6Z" /><path d="M9 4v16M15 6v16" /></svg>,
  folder: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>,
  chevD: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>,
  code: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m16 18 6-6-6-6M8 6l-6 6 6 6" /></svg>,
  ext: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3" /></svg>,
  close: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>,
  send: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>,
  check: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#3DB37E" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>,
  trash: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>,
  history: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 3v6h6M3 9a9 9 0 1 1 2.5 8" /><path d="M12 8v5l3 2" /></svg>,
  fork: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="6" cy="6" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="12" cy="20" r="2.5" /><path d="M6 8.5v3a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3v-3M12 14.5v3" /></svg>,
  up: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 15V3M8 7l4-4 4 4M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" /></svg>,
  down: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12M8 11l4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></svg>,
  tpl: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /></svg>,
  search: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.35-4.35" /></svg>,
};

export const TICONS = {
  'population-dashboard': (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
      <rect x="3" y="18" width="5" height="11" rx="1.5" fill="#4ECDC4" fillOpacity="0.2" stroke="#4ECDC4" strokeWidth="1.3"/>
      <rect x="10.5" y="12" width="5" height="17" rx="1.5" fill="#4ECDC4" fillOpacity="0.2" stroke="#4ECDC4" strokeWidth="1.3"/>
      <rect x="18" y="6" width="5" height="23" rx="1.5" fill="#4ECDC4" fillOpacity="0.2" stroke="#4ECDC4" strokeWidth="1.3"/>
      <rect x="25.5" y="3" width="5" height="26" rx="1.5" fill="#4ECDC4" fillOpacity="0.25" stroke="#4ECDC4" strokeWidth="1.3"/>
      <path d="M5.5 16 13 10l5.5 4L28 4" stroke="#4ECDC4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="28" cy="4" r="1.5" fill="#4ECDC4"/>
    </svg>
  ),
  'land-use': (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
      <path d="M16 4 4 11l12 7 12-7L16 4Z" fill="#7BC67E" fillOpacity="0.18" stroke="#7BC67E" strokeWidth="1.3" strokeLinejoin="round"/>
      <path d="m4 16 12 7 12-7" stroke="#7BC67E" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="m4 21 12 7 12-7" stroke="#7BC67E" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.6"/>
      <circle cx="16" cy="11" r="2.5" fill="#7BC67E" fillOpacity="0.3" stroke="#7BC67E" strokeWidth="1"/>
    </svg>
  ),
  'field-survey': (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
      <rect x="6" y="4" width="20" height="25" rx="3" fill="#E07B39" fillOpacity="0.08" stroke="#E07B39" strokeWidth="1.3"/>
      <rect x="11" y="2" width="10" height="5" rx="2" fill="#E07B39" fillOpacity="0.2" stroke="#E07B39" strokeWidth="1.2"/>
      <path d="m11 16 3 3 7-7" stroke="#E07B39" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M11 24h10" stroke="#E07B39" strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.4"/>
    </svg>
  ),
  'weather-monitor': (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
      <circle cx="24" cy="7" r="4" fill="#F4B942" fillOpacity="0.2" stroke="#F4B942" strokeWidth="1.2"/>
      <path d="M24 1.5v1M24 12.5v-1M29.5 7h-1M18.5 7h1M27.9 3.1l-.7.7M27.9 10.9l-.7-.7M20.1 10.9l.7-.7M20.1 3.1l.7.7" stroke="#F4B942" strokeWidth="1" strokeLinecap="round"/>
      <path d="M22.5 12a5.5 5.5 0 0 0-10.8-1.5A4.5 4.5 0 0 0 7.5 19h14a4 4 0 0 0 1-7.9Z" fill="#5B9BD5" fillOpacity="0.12" stroke="#5B9BD5" strokeWidth="1.3" strokeLinejoin="round"/>
      <path d="M10 24v3M16 23v4M22 24v3" stroke="#5B9BD5" strokeWidth="1.3" strokeLinecap="round" strokeOpacity="0.5"/>
    </svg>
  ),
  'facility-manager': (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
      <rect x="4" y="8" width="24" height="20" rx="2.5" fill="#9B8EC4" fillOpacity="0.1" stroke="#9B8EC4" strokeWidth="1.3"/>
      <path d="M12 8V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v3" stroke="#9B8EC4" strokeWidth="1.3"/>
      <path d="M4 14h24" stroke="#9B8EC4" strokeWidth="1.2" strokeOpacity="0.4"/>
      <rect x="8" y="11" width="3.5" height="3" rx=".8" fill="#9B8EC4" fillOpacity="0.35"/>
      <rect x="14.2" y="11" width="3.5" height="3" rx=".8" fill="#9B8EC4" fillOpacity="0.35"/>
      <rect x="20.5" y="11" width="3.5" height="3" rx=".8" fill="#9B8EC4" fillOpacity="0.35"/>
      <rect x="8" y="17" width="3.5" height="3" rx=".8" fill="#9B8EC4" fillOpacity="0.25"/>
      <rect x="14.2" y="17" width="3.5" height="3" rx=".8" fill="#9B8EC4" fillOpacity="0.25"/>
      <rect x="20.5" y="17" width="3.5" height="3" rx=".8" fill="#9B8EC4" fillOpacity="0.25"/>
      <rect x="13" y="22" width="6" height="6" rx="1" fill="#9B8EC4" fillOpacity="0.15" stroke="#9B8EC4" strokeWidth="1"/>
    </svg>
  ),
  'route-analyzer': (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
      <circle cx="6" cy="6" r="3.5" fill="#E8715A" fillOpacity="0.2" stroke="#E8715A" strokeWidth="1.3"/>
      <circle cx="26" cy="26" r="3.5" fill="#E8715A" fillOpacity="0.2" stroke="#E8715A" strokeWidth="1.3"/>
      <circle cx="6" cy="6" r="1.2" fill="#E8715A"/>
      <circle cx="26" cy="26" r="1.2" fill="#E8715A"/>
      <path d="M9 8c4 2 5 7 8 10s6 5 8 7" stroke="#E8715A" strokeWidth="1.8" strokeLinecap="round" strokeDasharray="4 3"/>
      <path d="M17 14l2-1.5M17 14l-1.5 2" stroke="#E8715A" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ),
  'interactive-report': (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
      <path d="M19 3H8a3 3 0 0 0-3 3v20a3 3 0 0 0 3 3h16a3 3 0 0 0 3-3V11Z" fill="#D4A843" fillOpacity="0.08" stroke="#D4A843" strokeWidth="1.3" strokeLinejoin="round"/>
      <path d="M19 3v8h8" stroke="#D4A843" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M10 22l3-5 2.5 3 4-6.5 3.5 5.5" stroke="#D4A843" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="10" cy="22" r="1.3" fill="#D4A843"/>
      <circle cx="23" cy="19" r="1.3" fill="#D4A843"/>
    </svg>
  ),
  'city-guide': (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
      <path d="M27 13c0 8.5-11 16-11 16S5 21.5 5 13a11 11 0 1 1 22 0Z" fill="#58A6C9" fillOpacity="0.12" stroke="#58A6C9" strokeWidth="1.3"/>
      <circle cx="16" cy="13" r="4" fill="#58A6C9" fillOpacity="0.2" stroke="#58A6C9" strokeWidth="1.2"/>
      <circle cx="16" cy="13" r="1.5" fill="#58A6C9"/>
    </svg>
  ),
};

/* ====== عرض الكود كمشروع متعدّد الملفّات (شبيه VS Code) ====== */
export const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* ماركداون مبسّط → HTML (محتوى المستندات يحرّره الأدمن فقط) */
export const mdToHtml = (md) => {
  let h = escapeHtml(md || '');
  h = h.replace(/^### (.*)$/gm, '<h3>$1</h3>').replace(/^## (.*)$/gm, '<h2>$1</h2>').replace(/^# (.*)$/gm, '<h1>$1</h1>');
  h = h.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, '<img alt="$1" src="$2" />');
  h = h.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  h = h.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<i>$2</i>');
  h = h.replace(/`([^`]+)`/g, '<code>$1</code>');
  h = h.replace(/^(?:- |• )(.*)$/gm, '<li>$1</li>');
  h = h.replace(/(<li>[\s\S]*?<\/li>)(?!\s*<li>)/g, '<ul>$1</ul>');
  h = h.split(/\n{2,}/).map((p) => (/^\s*<(h\d|ul|img|blockquote)/.test(p) ? p : `<p>${p.replace(/\n/g, '<br>')}</p>`)).join('');
  return h;
};
export function splitProjectFiles(html) {
  if (!html) return [{ name: 'index.html', lang: 'xml', code: '' }];
  const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n\n').trim();
  const scripts = [...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]).join('\n\n').trim();
  let index = html; let sDone = false, jDone = false;
  index = index.replace(/[ \t]*<style[^>]*>[\s\S]*?<\/style>\s*/gi, () => (sDone ? '' : (sDone = true, '    <link rel="stylesheet" href="styles.css">\n')));
  index = index.replace(/[ \t]*<script(?![^>]*\ssrc=)[^>]*>[\s\S]*?<\/script>\s*/gi, () => (jDone ? '' : (jDone = true, '    <script src="app.js"></script>\n')));
  const files = [{ name: 'index.html', lang: 'xml', code: index.trim() }];
  if (styles) files.push({ name: 'styles.css', lang: 'css', code: styles });
  if (scripts) files.push({ name: 'app.js', lang: 'javascript', code: scripts });
  return files;
}
/* أيقونات ملفّات احترافيّة حسب نوع اللغة ولونها (شارات مدوّرة بنمط VS Code) */
const FILE_META = {
  xml: { bg: '#E07B39', fg: '#1a0d04', label: '<>' },
  css: { bg: '#5B9BF0', fg: '#07152b', label: '#' },
  javascript: { bg: '#E3B341', fg: '#2a1f05', label: 'JS' },
  json: { bg: '#9AA0A6', fg: '#101317', label: '{}' },
};
const fileLang = (n) => (n.endsWith('.css') ? 'css' : n.endsWith('.js') ? 'javascript' : n.endsWith('.json') ? 'json' : 'xml');
export function FileIcon({ name }) {
  const m = FILE_META[fileLang(name)] || FILE_META.xml;
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true" style={{ flex: 'none' }}>
      <rect width="16" height="16" rx="4" fill={m.bg} />
      <text x="8" y="8" dy="0.36em" textAnchor="middle" fontSize={m.label.length > 1 ? 6.6 : 9} fontWeight="800" fontFamily="var(--mono), ui-monospace, monospace" fill={m.fg}>{m.label}</text>
    </svg>
  );
}
export const HLJS_CSS = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css';
export const HLJS_JS = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js';
export const ensureHljs = async () => { if (window.hljs) return; loadCss(HLJS_CSS); await loadScript(HLJS_JS); };

/* يحقن ملتقط أخطاء التشغيل في معاينة الـiframe (المعاينة فقط، لا النسخة المنشورة) */
export function injectCatcher(h) {
  const s = `<script>(function(){function p(m){try{parent.postMessage({__pne:'err',msg:String(m).slice(0,280)},'*')}catch(e){}}window.addEventListener('error',function(e){var m=e.message||'خطأ';if(!e.error&&/script error/i.test(m)){p('خطأ تشغيل داخل مكتبةٍ خارجيّة (أخفاه المتصفّح لأنّها عبر أصلٍ آخر). تحقّق من طريقة استدعاء المكتبة — غالباً دالّة/وسيط غير صحيح.');return;}var f=e.filename?(' @'+(e.filename.split('/').pop()||'')+':'+(e.lineno||0)):(e.lineno?(' @'+e.lineno):'');p(m+f);});window.addEventListener('unhandledrejection',function(e){p('promise: '+((e.reason&&e.reason.message)||e.reason||''))});})();<\/script>`;
  if (/<head[^>]*>/i.test(h)) return h.replace(/<head[^>]*>/i, (m) => m + s);
  if (/<html[^>]*>/i.test(h)) return h.replace(/<html[^>]*>/i, (m) => m + s);
  return s + h;
}
export const serializeThread = (msgs) => msgs.map((m) => (m.kind === 'build' ? { ...m, state: m.state === 'running' ? 'done' : m.state, progress: STEPS.length } : m));
