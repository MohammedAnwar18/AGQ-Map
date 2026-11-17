import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import useEngineBranding from '../hooks/useEngineBranding';
import './PalNovaaEngine.css';

/* رابط التطبيق المنشور: نطاقٌ فرعيّ أنيق <slug>.palnovaa.com (عبر Cloudflare Worker)،
   مع تراجعٍ إلى /pe/<slug> في التطوير (localhost/IP) أو إن تعذّر استخراج النطاق. */
const APPS_BASE = (() => {
  try {
    const h = window.location.hostname;
    if (!h || h === 'localhost' || /^(\d+\.){3}\d+$/.test(h)) return '';
    return h.replace(/^www\./, '');
  } catch { return ''; }
})();
const appLink = (slug) => (APPS_BASE ? `https://${slug}.${APPS_BASE}` : `${window.location.origin}/pe/${slug}`);

/* ============================================================================
   PalNovaa Engine — واجهة المحرّك (نظامٌ متكامل شبيهٌ بريبلت)
   توليد حقيقيّ + حفظ المحادثة + نُسَخ/تراجع + بياناتٌ حقيقيّة (رفع) + fork +
   حدود استخدام + إصلاحٌ ذاتيّ لأخطاء التشغيل. التخزين R2 + Postgres.
   ============================================================================ */

const API = (import.meta.env.VITE_API_URL || '/api');
const KEY_LS = 'palnovaa_engine_key';

const authHeaders = () => {
  const h = { 'Content-Type': 'application/json' };
  const t = localStorage.getItem('token');
  if (t) h.Authorization = `Bearer ${t}`;
  return h;
};
const jpost = (p, body) => fetch(`${API}${p}`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) }).then((r) => r.json());
const jput = (p, body) => fetch(`${API}${p}`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(body) }).then((r) => r.json());
const jget = (p) => fetch(`${API}${p}`, { headers: authHeaders() }).then((r) => r.json());
const jdel = (p) => fetch(`${API}${p}`, { method: 'DELETE', headers: authHeaders() }).then((r) => r.json());

/* ====== محمّلات مكتبات الخرائط (CDN، كسولة، بلا تكرار) — لعارض البيانات ====== */
const MAPLIBS = {
  leafletCss: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css',
  leaflet: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js',
  esri: 'https://cdnjs.cloudflare.com/ajax/libs/esri-leaflet/3.0.12/esri-leaflet.js',
  vectorgrid: 'https://cdn.jsdelivr.net/npm/leaflet.vectorgrid@1.3.0/dist/Leaflet.VectorGrid.bundled.js',
  proj4: 'https://cdnjs.cloudflare.com/ajax/libs/proj4js/2.11.0/proj4.js',
  georaster: 'https://cdn.jsdelivr.net/npm/georaster@1.6.0/dist/georaster.browser.bundle.min.js',
  georasterLayer: 'https://cdn.jsdelivr.net/npm/georaster-layer-for-leaflet@3.10.0/dist/georaster-layer-for-leaflet.min.js',
};
const _libCache = {};
const loadScript = (url) => {
  if (_libCache[url]) return _libCache[url];
  _libCache[url] = new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = url; s.async = true;
    s.onload = () => res(); s.onerror = () => rej(new Error('تعذّر تحميل مكتبة الخريطة'));
    document.head.appendChild(s);
  });
  return _libCache[url];
};
const loadCss = (url) => { if (_libCache['css:' + url]) return; _libCache['css:' + url] = true; const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = url; document.head.appendChild(l); };
/* أنظمة إحداثيّات فلسطين (تعريفات proj4) */
const PROJ_DEFS = {
  'EPSG:28191': '+proj=cass +lat_0=31.73409694444445 +lon_0=35.21208055555556 +x_0=170251.555 +y_0=126867.909 +ellps=clrk80 +towgs84=-275.722,94.7824,340.894,-8.001,-4.42,-11.821,1 +units=m +no_defs',
  'EPSG:28192': '+proj=cass +lat_0=31.73409694444445 +lon_0=35.21208055555556 +x_0=170251.555 +y_0=1126867.909 +ellps=clrk80 +towgs84=-275.722,94.7824,340.894,-8.001,-4.42,-11.821,1 +units=m +no_defs',
  'EPSG:2039': '+proj=tmerc +lat_0=31.73439361111111 +lon_0=35.20451694444445 +k=1.0000067 +x_0=219529.584 +y_0=626907.39 +ellps=GRS80 +towgs84=-24.0024,-17.1032,-17.8444,-0.33077,-1.85269,1.66969,5.4262 +units=m +no_defs',
};
const ensureProj4 = async () => {
  if (!window.proj4) await loadScript(MAPLIBS.proj4);
  if (window.proj4) for (const [k, def] of Object.entries(PROJ_DEFS)) { try { if (!window.proj4.defs(k)) window.proj4.defs(k, def); } catch { /* */ } }
};
const ensureLeaflet = async () => { loadCss(MAPLIBS.leafletCss); if (!window.L) await loadScript(MAPLIBS.leaflet); return window.L; };
const ensureEsri = async () => { await ensureLeaflet(); if (!window.L.esri) await loadScript(MAPLIBS.esri); };
const ensureVectorGrid = async () => { await ensureLeaflet(); if (!window.L.vectorGrid) await loadScript(MAPLIBS.vectorgrid); };
const ensureGeoraster = async () => {
  await ensureProj4();
  if (!window.parseGeoraster) await loadScript(MAPLIBS.georaster);
  await ensureLeaflet();
  if (!window.GeoRasterLayer) await loadScript(MAPLIBS.georasterLayer);
};

/* ====== محوّلات صيغ خفيفة إلى GeoJSON (بالمتصفّح) ====== */
const SHP_URL = 'https://unpkg.com/shpjs@6.1.0/dist/shp.min.js';
const SQLJS_BASE = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/';
const ensureShp = async () => { if (!window.shp && !window.shpjs) await loadScript(SHP_URL); return window.shp || window.shpjs; };
let _sqlPromise = null;
const ensureSqlJs = async () => {
  if (window.__PNE_SQL) return window.__PNE_SQL;
  if (!_sqlPromise) _sqlPromise = (async () => {
    if (!window.initSqlJs) await loadScript(SQLJS_BASE + 'sql-wasm.js');
    const SQL = await window.initSqlJs({ locateFile: (f) => SQLJS_BASE + f });
    window.__PNE_SQL = SQL; return SQL;
  })();
  return _sqlPromise;
};
/* محلّل WKB → هندسة GeoJSON (يدعم 2D/3D وكلّ الأنواع) */
function wkbToGeoJSON(u8) {
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
function gpkgGeom(u8) {
  if (!u8 || u8.length < 8 || u8[0] !== 0x47 || u8[1] !== 0x50) return null;  // 'GP'
  const envType = (u8[3] >> 1) & 0x07;
  const envBytes = [0, 32, 48, 48, 64][envType] || 0;
  return wkbToGeoJSON(u8.subarray(8 + envBytes));
}

/* محلّل DXF (AutoCAD نصّيّ) → GeoJSON. يدعم LINE/LWPOLYLINE/POLYLINE+VERTEX/POINT/CIRCLE/ARC.
   ملاحظة: إحداثيّات DXF بوحدات الرسم (قد تكون مسقطاً مثل جريد فلسطين/ITM) بلا CRS معرّف — يُعاد إسقاطها من العارض. */
function dxfToGeoJSON(text) {
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
const makeArcgisImageLayer = (L, exportBase, layerIds, opacity = 0.85) => {
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

const SRC = {
  postgis: { n: 'PostGIS', t: 'DB', ctx: 'قاعدة بيانات مكانيّة PostGIS' },
  geojson: { n: 'GeoJSON', t: 'JSON', ctx: 'طبقة GeoJSON' },
  shp: { n: 'Shapefile', t: 'SHP', ctx: 'ملفّ Shapefile' },
  csv: { n: 'CSV', t: 'CSV', ctx: 'جدول CSV بإحداثيّات' },
  tif: { n: 'GeoTIFF', t: 'TIF', ctx: 'بيانات نقطيّة GeoTIFF' },
  wms: { n: 'WMS / WFS', t: 'OGC', ctx: 'خدمة خرائط WMS/WFS' },
  gpkg: { n: 'GeoPackage', t: 'GPKG', ctx: 'ملفّ GeoPackage' },
};
const MODES = ['تطبيق ويب', 'لوحة مؤشرات', 'أداة تحليل', 'خريطة قصّة'];
const CRS = ['EPSG:4326', 'EPSG:3857', 'EPSG:28191', 'EPSG:32636'];

const STEPS = [
  { t: 'تحليل الطلب وتفعيل المهارات', m: 'intent · skills · scope' },
  { t: 'تصميم بنية التطبيق والمكوّنات', m: 'layout · components · state' },
  { t: 'بناء الواجهة والتفاعلات', m: 'charts · tables · forms · maps' },
  { t: 'ربط البيانات والمنطق', m: 'data · CRUD · API connectors' },
  { t: 'التصميم والتجاوب', m: 'RTL · responsive · dark theme' },
  { t: 'التحقّق وتشغيل المعاينة', m: 'validate · preview ready' },
];
const TPL = [
  { t: 'مؤشر خطر الفيضان', d: 'تلوين القطع حسب درجة الخطر مع لوحات لكلّ حي.', tags: ['Choropleth', 'Turf'], p: 'ابنِ تطبيق ويب يعرض قطع الأراضي في نابلس ملوّنة حسب مؤشر خطر الفيضان، مع لوحة جانبيّة للطبقات، ومؤشّرات لعدد القطع عالية الخطورة والمساحة المعرّضة، وإمكانيّة الضغط على أيّ قطعة لعرض بياناتها.' },
  { t: 'إدارة شبكات المياه', d: 'خطوط الشبكة، الأعطال، وأقرب صمّام إغلاق.', tags: ['Network', 'Routing'], p: 'أريد لوحة لإدارة شبكة المياه: عرض الأنابيب حسب القطر والعمر، تسجيل الأعطال كنقاط على الخريطة، وإيجاد أقرب صمّام إغلاق لأيّ عطل.' },
  { t: 'إمكانيّة الوصول للخدمات', d: 'مناطق الخدمة بزمن المشي للمدارس والمراكز.', tags: ['Isochrones', 'Analysis'], p: 'ابنِ أداة تحليل تحسب مناطق الوصول بالمشي (5/10/15 دقيقة) حول المدارس والمراكز الصحيّة في رام الله، وتُظهر الأحياء غير المخدومة.' },
  { t: 'تتبّع الأسطول الميدانيّ', d: 'مواقع، مسارات، وتنبيهات خروج عن النطاق.', tags: ['Realtime', 'Geofence'], p: 'أريد تطبيقاً لتتبّع مركبات جمع النفايات، مع عرض المسارات اليوميّة وتنبيه عند الخروج عن نطاق العمل المحدّد.' },
];

const Ico = {
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

const TICONS = {
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
const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* ماركداون مبسّط → HTML (محتوى المستندات يحرّره الأدمن فقط) */
const mdToHtml = (md) => {
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
function splitProjectFiles(html) {
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
function FileIcon({ name }) {
  const m = FILE_META[fileLang(name)] || FILE_META.xml;
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true" style={{ flex: 'none' }}>
      <rect width="16" height="16" rx="4" fill={m.bg} />
      <text x="8" y="8" dy="0.36em" textAnchor="middle" fontSize={m.label.length > 1 ? 6.6 : 9} fontWeight="800" fontFamily="var(--mono), ui-monospace, monospace" fill={m.fg}>{m.label}</text>
    </svg>
  );
}
const HLJS_CSS = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css';
const HLJS_JS = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js';
const ensureHljs = async () => { if (window.hljs) return; loadCss(HLJS_CSS); await loadScript(HLJS_JS); };

/* يحقن ملتقط أخطاء التشغيل في معاينة الـiframe (المعاينة فقط، لا النسخة المنشورة) */
function injectCatcher(h) {
  const s = `<script>(function(){function p(m){try{parent.postMessage({__pne:'err',msg:String(m).slice(0,280)},'*')}catch(e){}}window.addEventListener('error',function(e){p((e.message||'خطأ')+(e.lineno?(' @'+e.lineno):''))});window.addEventListener('unhandledrejection',function(e){p('promise: '+((e.reason&&e.reason.message)||e.reason||''))});})();<\/script>`;
  if (/<head[^>]*>/i.test(h)) return h.replace(/<head[^>]*>/i, (m) => m + s);
  if (/<html[^>]*>/i.test(h)) return h.replace(/<html[^>]*>/i, (m) => m + s);
  return s + h;
}
const serializeThread = (msgs) => msgs.map((m) => (m.kind === 'build' ? { ...m, state: m.state === 'running' ? 'done' : m.state, progress: STEPS.length } : m));

export default function PalNovaaEnginePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  useEngineBranding();
  const greeting = (() => {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return 'صباح الخير';
    if (h >= 12 && h < 17) return 'نهارٌ سعيد';
    if (h >= 17 && h < 22) return 'مساء الخير';
    return 'سهرةٌ ممتعة';
  })();
  const userName = (user && (user.full_name || user.username)) || '';

  const [collapsed, setCollapsed] = useState(false);
  const [view, setView] = useState('home');  // home | workspace | templates
  const [prompt, setPrompt] = useState('');
  const [prompt2, setPrompt2] = useState('');
  const [enhancing, setEnhancing] = useState(false);
  const [attached, setAttached] = useState([]);     // تلميحات مصادر عامّة
  const [datasets, setDatasets] = useState([]);     // بيانات مرفقة (مرفوعة)
  const [myDatasets, setMyDatasets] = useState([]); // المتاحة
  /* مركز المستندات */
  const [docsOpen, setDocsOpen] = useState(false);
  const [docs, setDocs] = useState([]);
  const [docOpen, setDocOpen] = useState(null);   // المستند المفتوح (تفصيل)
  const [docEdit, setDocEdit] = useState(null);    // المستند قيد التحرير (أدمن)
  const [docBusy, setDocBusy] = useState(false);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docCat, setDocCat] = useState('');       // تصنيف مُختار
  const [docSearch, setDocSearch] = useState('');
  const [docSort, setDocSort] = useState('new');   // new | downloads | title
  const [attachedExts, setAttachedExts] = useState([]); // إضافات (أدوات/أصول) مربوطة بالبناء الحاليّ
  const isAdmin = user?.role === 'admin';
  const [mode, setMode] = useState(MODES[0]);
  const [crs, setCrs] = useState(CRS[0]);

  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);

  const [html, setHtml] = useState('');
  const [title, setTitle] = useState('محادثة جديدة');
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [summary, setSummary] = useState('');
  const [slug, setSlug] = useState(null);
  const [publicUrl, setPublicUrl] = useState('');
  const [dirty, setDirty] = useState(false);
  const [tab, setTab] = useState('app');

  const [projects, setProjects] = useState([]);
  const [versions, setVersions] = useState([]);
  const [balance, setBalance] = useState(null);
  const [iframeErr, setIframeErr] = useState('');
  const [streamCode, setStreamCode] = useState('');
  const streamBufRef = useRef('');
  const flushSched = useRef(false);

  const [tplSearch, setTplSearch] = useState('');
  const [activeFile, setActiveFile] = useState('index.html');
  const [hljsReady, setHljsReady] = useState(false);
  const [pvKey, setPvKey] = useState(0);   // يُجبر المعاينة على التجدّد الفوري مع كلّ تغيير كود
  const [device, setDevice] = useState('desktop');  // معاينة متجاوبة: سطح مكتب/لوحيّ/جوّال
  const [menu, setMenu] = useState(null);
  const [modal, setModal] = useState(null);
  const [keyDraft, setKeyDraft] = useState(localStorage.getItem(KEY_LS) || '');
  const [pg, setPg] = useState({ host: '', db: '' });
  const [toast, setToast] = useState('');

  /* ArcGIS REST connector */
  const ARCGIS_DEFAULT = 'https://orthophotos.geomolg.ps/adaptor/rest/services';
  const ARCGIS_PRESETS = [
    { label: 'GeoMOLG فلسطين', url: 'https://orthophotos.geomolg.ps/adaptor/rest/services' },
    { label: 'OCHA — طبقات فلسطين', url: 'https://gis.unocha.org/server/rest/services/Hosted' },
    { label: 'OCHA الأمم المتّحدة', url: 'https://gis.unocha.org/server/rest/services' },
  ];
  const [arcUrl, setArcUrl] = useState(ARCGIS_DEFAULT);
  const [arcData, setArcData] = useState(null);     // نتيجة التصفّح { kind, ... }
  const [arcSel, setArcSel] = useState([]);         // طبقات محدّدة لخدمة
  const [arcStack, setArcStack] = useState([]);     // مسار التصفّح للرجوع
  const [arcBusy, setArcBusy] = useState(false);
  const [arcErr, setArcErr] = useState('');
  const [arcFilter, setArcFilter] = useState('');
  const [arcDl, setArcDl] = useState(null);         // معرّف الطبقة قيد التنزيل

  /* HDX (Humanitarian Data Exchange) connector */
  const [hdxQ, setHdxQ] = useState('');
  const [hdxRes, setHdxRes] = useState([]);
  const [hdxCount, setHdxCount] = useState(0);
  const [hdxPage, setHdxPage] = useState(1);
  const [hdxBusy, setHdxBusy] = useState(false);
  const [hdxErr, setHdxErr] = useState('');
  const [hdxAtt, setHdxAtt] = useState(null);       // رابط المورد قيد الإضافة

  /* عارض البيانات (explorer): نافذة مستقلّة — خريطة جوجل + طبقات */
  const [explorerOpen, setExplorerOpen] = useState(false);
  const [explorerErr, setExplorerErr] = useState('');
  const [mapReady, setMapReady] = useState(false);
  const [activeLayers, setActiveLayers] = useState({}); // slug → true
  const [layerBusy, setLayerBusy] = useState(null);     // slug قيد التحميل
  const [baseMap, setBaseMap] = useState('streets');
  const mapRef = useRef(null);
  const mapElRef = useRef(null);
  const layerObjs = useRef({});                         // slug → طبقة Leaflet
  const pendingFocus = useRef(null);
  const expLatRef = useRef(null); const expLonRef = useRef(null); const expZoomRef = useRef(null);
  const [expCrs, setExpCrs] = useState('EPSG:4326');
  const expCrsRef = useRef('EPSG:4326');
  useEffect(() => { expCrsRef.current = expCrs; }, [expCrs]);

  const contoursRef = useRef(null);
  const latRef = useRef(null); const lonRef = useRef(null); const arrowRef = useRef(null);
  const threadRef = useRef(null);
  const buildIdRef = useRef(0);
  const timerRef = useRef(null);
  const toastTimer = useRef(null);
  const fileRef = useRef(null);
  const messagesRef = useRef([]);
  const autoHealRef = useRef({ tries: 0, lastErr: '' });  // الإصلاح الذاتيّ: ميزانيّة محاولاتٍ لكلّ بناء
  const codeScrollRef = useRef(null);  // تمرير عرض الكود تلقائياً أثناء الكتابة الحيّة

  useEffect(() => { messagesRef.current = messages; }, [messages]);

  // تجديد المعاينة فوراً عند أيّ تغيير في الكود، والانتقال لتبويب المعاينة
  useEffect(() => { if (html) { setPvKey((k) => k + 1); setTab('app'); } }, [html]);

  // تحميل مُلوّن الكود (highlight.js) عند عرض تبويب الكود
  useEffect(() => {
    if (tab === 'code' && html && !hljsReady) { ensureHljs().then(() => setHljsReady(true)).catch(() => {}); }
  }, [tab, html, hljsReady]);

  const showToast = useCallback((m) => {
    setToast(m); clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2400);
  }, []);

  const [templates, setTemplates] = useState([]);
  const loadProjects = useCallback(() => { jget('/engine/projects').then((d) => { if (d?.ok) setProjects(d.projects || []); }).catch(() => {}); }, []);
  const loadDatasets = useCallback(() => { jget('/engine/datasets').then((d) => { if (d?.ok) setMyDatasets(d.datasets || []); }).catch(() => {}); }, []);
  const loadBalance = useCallback(() => { jget('/engine/balance').then((d) => { if (d?.ok) setBalance(d.balance); }).catch(() => {}); }, []);
  const loadTemplates = useCallback(() => { jget('/engine/templates').then((d) => { if (d?.ok && d.templates?.length) setTemplates(d.templates); }).catch(() => {}); }, []);
  useEffect(() => { loadProjects(); loadDatasets(); loadBalance(); loadTemplates(); }, [loadProjects, loadDatasets, loadBalance, loadTemplates]);

  /* contour background */
  useEffect(() => {
    const svg = contoursRef.current; if (!svg) return;
    svg.setAttribute('viewBox', '0 0 1200 800');
    let h = '';
    for (let i = 0; i < 16; i++) {
      const r = 60 + i * 42, cx = 640, cy = 300; let d = '';
      for (let a = 0; a <= 360; a += 6) {
        const t = a * Math.PI / 180, w = 1 + 0.12 * Math.sin(3 * t + i * 0.5) + 0.07 * Math.cos(5 * t - i * 0.3);
        d += (a ? 'L' : 'M') + (cx + Math.cos(t) * r * 1.35 * w).toFixed(1) + ' ' + (cy + Math.sin(t) * r * 0.8 * w).toFixed(1);
      }
      h += `<path d="${d}Z" fill="none" stroke="${i % 4 === 0 ? '#2B3038' : '#1A1E24'}" stroke-width="${i % 4 === 0 ? 1.1 : 0.8}"/>`;
      if (i === 5 || i === 9) h += `<path class="isoline" pathLength="1" d="${d}Z" fill="none" stroke="#E07B39" stroke-opacity="${i === 5 ? 0.85 : 0.5}" stroke-width="1.2" stroke-linecap="round" style="animation-duration:${i === 5 ? 18 : 26}s;${i === 9 ? 'animation-direction:reverse' : ''}"/>`;
    }
    svg.innerHTML = h;
  }, []);

  useEffect(() => { if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight; }, [messages]);

  useEffect(() => {
    const onClick = (e) => { if (!e.target.closest('.menu') && !e.target.closest('[data-menu-anchor]')) setMenu(null); };
    const onKey = (e) => {
      if (e.key === 'Escape') { setMenu(null); setModal(null); }
    };
    document.addEventListener('click', onClick); document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('click', onClick); document.removeEventListener('keydown', onKey); };
  }, []);

  /* self-heal: استقبال أخطاء المعاينة */
  useEffect(() => {
    const onMsg = (e) => { const d = e.data; if (d && d.__pne === 'err' && d.msg) setIframeErr(d.msg); };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  /* self-heal تلقائيّ: عند رصد خطأ تشغيل، يصلحه المحرّك وحده (حتى محاولتين، ويتوقّف لو تكرّر الخطأ نفسه — بلا حلقات) */
  useEffect(() => {
    if (!iframeErr || busy || !html) return;
    const st = autoHealRef.current;
    if (st.tries >= 2 || st.lastErr === iframeErr) return;  // استُنفدت الميزانيّة أو الخطأ نفسه تكرّر → نترك الزرّ اليدويّ
    st.tries += 1; st.lastErr = iframeErr;
    const msg = iframeErr; setIframeErr('');
    showToast('رصدتُ خطأً وأُصلحه تلقائياً…');
    runBuild(`التطبيق يُصدر خطأ JavaScript أثناء التشغيل: "${msg}". أصلح السبب الجذريّ وأعِد إخراج المستند كاملاً وهو يعمل بلا أخطاء.`, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iframeErr, busy]);

  useEffect(() => () => { clearTimeout(timerRef.current); clearTimeout(toastTimer.current); }, []);

  /* تمرير عرض الكود لأسفل أثناء الكتابة الحيّة (إحساس IDE) */
  useEffect(() => { if (busy && codeScrollRef.current) codeScrollRef.current.scrollTop = codeScrollRef.current.scrollHeight; }, [streamCode, busy]);

  /* autosave: بعد ضبط slug، كلّ تغيير كود يُحفَظ ويُنشَر وتُسجَّل نسخة */
  useEffect(() => {
    if (!slug || !html) return;
    const t = setTimeout(() => {
      jput(`/engine/projects/${slug}`, { html, title, summary, thread: serializeThread(messagesRef.current) })
        .then((d) => { if (d?.public_url) setPublicUrl(d.public_url); setDirty(false); }).catch(() => {});
    }, 1100);
    return () => clearTimeout(t);
  }, [html, slug]); // eslint-disable-line react-hooks/exhaustive-deps

  const onHomeMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
    if (latRef.current) latRef.current.textContent = (32.2450 - fy * 0.048).toFixed(4) + '° N';
    if (lonRef.current) lonRef.current.textContent = (35.2150 + fx * 0.078).toFixed(4) + '° E';
    if (arrowRef.current) arrowRef.current.style.transform = `rotate(${(fx - 0.5) * 14}deg)`;
  };

  const addSrc = (k, label) => { setAttached((a) => (a.includes(k) ? a : [...a, k])); showToast(`تمّ إرفاق ${label || SRC[k]?.n || k}`); };
  const rmSrc = (k) => setAttached((a) => a.filter((x) => x !== k));
  const attachDataset = (d) => { setDatasets((a) => (a.find((x) => x.slug === d.slug) ? a : [...a, d])); showToast(`أُرفقت «${d.name}»`); setMenu(null); };
  const rmDataset = (s) => setDatasets((a) => a.filter((x) => x.slug !== s));
  /* حذف طبقة محفوظة نهائياً من «بياناتك» (مع إزالتها من المرفقات إن كانت) */
  const removeDataset = async (d) => {
    try {
      await jdel(`/engine/datasets/${d.slug}`);
      setMyDatasets((a) => a.filter((x) => x.slug !== d.slug));
      setDatasets((a) => a.filter((x) => x.slug !== d.slug));
      showToast(`حُذفت «${d.name}»`);
    } catch { showToast('تعذّر الحذف'); }
  };

  const SAFE_INLINE_BYTES = 4 * 1024 * 1024;   // تحت حدّ جسم طلب Vercel (~4.5MB)
  const uploadLargeFile = async (file, name, kind) => {
    const pre = await jpost('/engine/datasets/presign', { name, kind, bytes: file.size });
    if (!pre?.ok) return pre;
    const put = await fetch(pre.uploadUrl, { method: 'PUT', headers: { 'Content-Type': pre.contentType }, body: file });
    if (!put.ok) return { ok: false, reason: `فشل الرفع إلى التخزين (${put.status})` };
    return jpost('/engine/datasets/finalize', { slug: pre.slug, name, kind });
  };
  // رفع محتوى نصّيّ (GeoJSON/CSV): مباشر إن كبُر وإلّا JSON
  const uploadText = async (name, kind, content) => {
    const bytes = new Blob([content]).size;
    if (bytes > SAFE_INLINE_BYTES) {
      const file = new File([content], `${name}.${kind === 'csv' ? 'csv' : 'geojson'}`, { type: kind === 'csv' ? 'text/csv' : 'application/geo+json' });
      return uploadLargeFile(file, name, kind);
    }
    return jpost('/engine/datasets', { name, kind, content });
  };
  const addDatasetResult = (d) => {
    if (!d?.ok) throw new Error(d?.reason || 'فشل الحفظ');
    setMyDatasets((a) => [d.dataset, ...a]); attachDataset(d.dataset); return d.dataset;
  };
  // Shapefile (.zip/.shp) → GeoJSON عبر shpjs (قد يحوي عدّة طبقات)
  const handleShapefile = async (f, name) => {
    showToast('جارٍ قراءة Shapefile…');
    const shp = await ensureShp();
    const out = await shp(await f.arrayBuffer());
    const list = Array.isArray(out) ? out : [out];
    let n = 0, last = null;
    for (const fc of list) {
      if (!fc || !Array.isArray(fc.features) || !fc.features.length) continue;
      const lname = String(fc.fileName || name).replace(/\.[^.]+$/, '');
      last = addDatasetResult(await uploadText(lname, 'geojson', JSON.stringify(fc))); n++;
    }
    if (!n) throw new Error('لا طبقات صالحة في الملفّ');
    showToast(n === 1 ? `أُضيفت «${last.name}» (${last.feature_count} عنصر)` : `أُضيفت ${n} طبقات من Shapefile`);
  };
  // GeoPackage (.gpkg) → GeoJSON عبر sql.js
  const handleGeopackage = async (f, name) => {
    showToast('جارٍ قراءة GeoPackage…');
    const SQL = await ensureSqlJs();
    const db = new SQL.Database(new Uint8Array(await f.arrayBuffer()));
    try {
      const tables = db.exec("SELECT table_name, srs_id FROM gpkg_contents WHERE data_type='features'");
      if (!tables.length) throw new Error('لا طبقات معالم');
      let n = 0, last = null;
      for (const [table, srsId] of tables[0].values) {
        let geomCol = 'geom';
        try { const gc = db.exec(`SELECT column_name FROM gpkg_geometry_columns WHERE table_name='${table}'`); if (gc.length) geomCol = gc[0].values[0][0]; } catch { /* */ }
        const q = db.exec(`SELECT * FROM "${table}"`);
        if (!q.length) continue;
        const cols = q[0].columns; const gi = cols.indexOf(geomCol);
        const features = [];
        for (const row of q[0].values) {
          let geometry = null; try { if (gi >= 0 && row[gi]) geometry = gpkgGeom(row[gi]); } catch { /* */ }
          if (!geometry) continue;
          const props = {}; cols.forEach((c, i) => { if (i !== gi) props[c] = row[i]; });
          features.push({ type: 'Feature', geometry, properties: props });
        }
        if (!features.length) continue;
        let fc = { type: 'FeatureCollection', features };
        if (srsId && srsId !== 4326 && srsId !== 0 && srsId !== -1) fc = await reprojectFC(fc, srsId);
        last = addDatasetResult(await uploadText(String(table), 'geojson', JSON.stringify(fc))); n++;
      }
      if (!n) throw new Error('لا طبقات صالحة');
      showToast(n === 1 ? `أُضيفت «${last.name}» (${last.feature_count} عنصر)` : `أُضيفت ${n} طبقات من GeoPackage`);
    } finally { db.close(); }
  };
  const reprojectFC = async (fc, srsId) => {
    await ensureProj4();
    const code = `EPSG:${srsId}`;
    if (!window.proj4 || (srsId !== 3857 && !window.proj4.defs(code))) { showToast(`إسناد ${code} غير مدعوم — عُرضت كما هي`); return fc; }
    const from = srsId === 3857 ? 'EPSG:3857' : code;
    const tx = (c) => { try { const p = window.proj4(from, 'EPSG:4326', [c[0], c[1]]); return [p[0], p[1], ...c.slice(2)]; } catch { return c; } };
    const walk = (co) => (typeof co[0] === 'number' ? tx(co) : co.map(walk));
    fc.features.forEach((ft) => { if (ft.geometry && ft.geometry.coordinates) ft.geometry.coordinates = walk(ft.geometry.coordinates); });
    return fc;
  };
  const onFile = async (e) => {
    const f = e.target.files?.[0]; if (e.target) e.target.value = '';
    if (!f) return;
    const ext = (f.name.toLowerCase().match(/\.([a-z0-9]+)$/) || [, ''])[1];
    const name = f.name.replace(/\.[^.]+$/, '');
    try {
      if (/^(tif|tiff|geotiff)$/.test(ext)) {
        if (f.size > 500 * 1024 * 1024) { showToast('الملفّ كبيرٌ جداً (الحدّ 500MB)'); return; }
        showToast('جارٍ رفع صورة GeoTIFF…');
        const d = await uploadLargeFile(f, name, 'geotiff');
        const ds = addDatasetResult(d); const m = ds.meta || {};
        showToast(`أُرفقت «${ds.name}» (${m.width}×${m.height}، ${m.bands} نطاق)`);
      } else if (ext === 'zip' || ext === 'shp') {
        await handleShapefile(f, name);
      } else if (ext === 'gpkg') {
        await handleGeopackage(f, name);
      } else if (ext === 'dxf') {
        if (f.size > 40 * 1024 * 1024) { showToast('ملفّ DXF كبير (الحدّ 40MB)'); return; }
        showToast('جارٍ تحويل DXF (AutoCAD)…');
        const fc = dxfToGeoJSON(await f.text());
        if (!fc.features.length) { showToast('لم يُعثر على كياناتٍ مدعومة في DXF (LINE/POLYLINE/POINT/CIRCLE/ARC)'); return; }
        const ds = addDatasetResult(await uploadText(name, 'geojson', JSON.stringify(fc)));
        showToast(`أُرفق «${ds.name}» (${fc.features.length} كيان CAD — عيّن نظام الإحداثيّات من العارض)`);
      } else if (ext === 'dwg') {
        showToast('DWG صيغةٌ ثنائيّةٌ مغلقة — صدّره إلى DXF من AutoCAD (Save As → DXF) ثمّ ارفعه');
      } else {
        if (f.size > 40 * 1024 * 1024) { showToast('الملفّ كبيرٌ جداً (الحدّ 40MB)'); return; }
        const kind = ext === 'csv' ? 'csv' : 'geojson';
        showToast(f.size > SAFE_INLINE_BYTES ? 'جارٍ رفع الملفّ الكبير…' : 'جارٍ رفع البيانات…');
        const d = f.size > SAFE_INLINE_BYTES ? await uploadLargeFile(f, name, kind) : await jpost('/engine/datasets', { name, kind, content: await f.text() });
        const ds = addDatasetResult(d); const m = ds.meta || {};
        showToast(`أُرفقت «${ds.name}» (${ds.feature_count} عنصر${m.tiled ? '، مُقسَّمة إلى تايلز' : ''})`);
      }
    } catch (err) { showToast('تعذّر: ' + String(err.message || err).slice(0, 55)); }
  };

  const openMenu = (name, e) => {
    e.stopPropagation();
    if (name === 'versions') loadVersions();
    const r = e.currentTarget.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    // عرض القائمة ثابتٌ (انظر CSS)؛ نُثبّت يسارها بحيث تبقى داخل الشاشة كاملةً (RTL)
    const MW = Math.min(320, vw - 24);
    const left = Math.max(12, Math.min(r.right - MW, vw - MW - 12));
    const spaceBelow = vh - r.bottom;
    // لو ما في مساحة كافية تحت الزرّ، افتح القائمة للأعلى فتبقى ظاهرة بالكامل
    if (spaceBelow < 320 && r.top > spaceBelow) setMenu({ name, left, bottom: vh - r.top + 6, maxH: Math.max(180, r.top - 16) });
    else setMenu({ name, left, top: r.bottom + 6, maxH: Math.max(180, spaceBelow - 16) });
  };

  const withContext = (text) => {
    let p = text.trim(); const parts = [];
    if (attached.length) parts.push('مصادر لاستخدامها (أو محاكاتها ببياناتٍ تجريبيّة واقعيّة): ' + attached.map((k) => SRC[k]?.ctx || k).join('، ') + '.');
    if (mode && mode !== MODES[0]) parts.push('نوع المُخرَج المطلوب: ' + mode + '.');
    if (crs && crs !== CRS[0]) parts.push('نظام الإسناد: ' + crs + '.');
    if (parts.length) p += '\n\n[' + parts.join(' ') + ']';
    if (attachedExts.length) {
      p += '\n\n[إضافاتٌ جاهزةٌ يجب تضمينها واستعمالها في التطبيق كما هي (أدوات تحليل/أيقونات/نصوص/ألوان):]';
      attachedExts.forEach((e) => { p += `\n\n— ${e.title} (${e.kind === 'asset' ? 'أصول' : 'أداة'}):\n\`\`\`\n${(e.code || '').slice(0, 8000)}\n\`\`\``; });
    }
    return p;
  };

  const finishSuccess = (d, isEdit, bId) => {
    setHtml(d.html); if (d.title) setTitle(d.title); if (d.summary) setSummary(d.summary);
    setDirty(true); if (d.balance) setBalance(d.balance); setTab('app');
    setMessages((m) => m.map((x) => (x.id === `b${bId}` ? { ...x, progress: STEPS.length, state: 'done', usage: d.usage } : x)));
    setMessages((m) => [...m, {
      id: `n${bId}`, role: 'ai', kind: 'note',
      text: isEdit ? (d.mode === 'diff' ? `طبّقتُ التعديل بدقّةٍ وسرعة (${d.applied || ''} تغيير موضعيّ) وحدّثت المعاينة.` : 'طبّقتُ التعديل وحدّثت المعاينة.') : (d.summary || 'التطبيق جاهزٌ للمعاينة.'),
      suggests: isEdit ? ['أحسنت — أضِف ميزة أخرى'] : ['أضِف فلتراً حسب المنطقة', 'غيّر تدرّج الألوان', 'أضِف لوحة مؤشّرات', 'صدّر PDF', 'أضِف بحثاً عن موقع'],
    }]);
    showToast(isEdit ? (d.mode === 'diff' ? 'تعديلٌ فوريّ ✓' : 'تمّ التعديل ✓') : 'تمّ البناء ✓ — المعاينة جاهزة');
  };
  const finishError = (reason, isEdit, bId) => {
    const text = reason === '__missing'
      ? 'لا يوجد مفتاح موديل. أضِف مفتاح PalNovaa من زرّ المفتاح، أو اضبط PALNOVAA_MODEL_KEY في الخادم.'
      : (reason || 'تعذّر التوليد.');
    setMessages((m) => m.map((x) => (x.id === `b${bId}` ? { ...x, state: 'error' } : x)));
    setMessages((m) => [...m, { id: `e${bId}${Math.random().toString(36).slice(2, 5)}`, role: 'err', text }]);
    if (reason === '__missing') setModal('key');
  };
  const finishLimit = (bId, bal, plan) => {
    if (bal) setBalance(bal);
    setMessages((m) => m.map((x) => (x.id === `b${bId}` ? { ...x, state: 'error' } : x)));
    setMessages((m) => [...m, { id: `up${bId}`, role: 'ai', kind: 'upgrade', plan: plan || bal?.plan }]);
  };

  const scheduleStreamFlush = (txt) => {
    streamBufRef.current = txt;
    if (flushSched.current) return;
    flushSched.current = true;
    requestAnimationFrame(() => { flushSched.current = false; setStreamCode(streamBufRef.current); });
  };

  // البثّ الحيّ: يعيد true إن أنهى (نجاح/خطأ مُعالَج)، و false ليُستكمَل بالنداء العاديّ
  const tryStream = async (body, bId, isEdit) => {
    let resp;
    try { resp = await fetch(`${API}/engine/generate-stream`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) }); }
    catch { return false; }
    if (!resp.ok || !resp.body) return false;
    setTab('code'); setStreamCode('');
    const reader = resp.body.getReader(); const dec = new TextDecoder();
    let buf = '', acc = '';
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const raw = buf.slice(0, i); buf = buf.slice(i + 2);
          const dl = raw.split('\n').find((l) => l.startsWith('data:'));
          if (!dl) continue;
          const pl = dl.slice(5).trim(); if (!pl) continue;
          let ev; try { ev = JSON.parse(pl); } catch { continue; }
          if (ev.type === 'delta') { acc += ev.text || ''; scheduleStreamFlush(acc); }
          else if (ev.type === 'done') { clearTimeout(timerRef.current); setStreamCode(acc); finishSuccess(ev, isEdit, bId); return true; }
          else if (ev.type === 'error') {
            clearTimeout(timerRef.current);
            if (ev.reason === 'limit_reached') finishLimit(bId, ev.balance, ev.plan);
            else finishError(ev.reason === 'missing_key' ? '__missing' : (ev.message || ev.reason || 'تعذّر التوليد.'), isEdit, bId);
            return true;
          }
        }
      }
    } catch { /* انقطع البثّ */ }
    return false; // لم يصل done → fallback
  };

  const nonStream = async (body, bId, isEdit) => {
    try {
      const d = await jpost('/engine/generate', body);
      if (d?.ok && d.html) finishSuccess(d, isEdit, bId);
      else if (d?.reason === 'limit_reached') finishLimit(bId, d.balance, d.plan);
      else finishError(d?.reason === 'missing_key' ? '__missing' : (d?.message || d?.reason || 'تعذّر التوليد.'), isEdit, bId);
    } catch { finishError('خطأ في الاتصال بالخادم. جرّب مجدّداً.', isEdit, bId); }
  };

  const runBuild = async (rawText, isEdit) => {
    if (busy || !rawText.trim()) return;
    const key = localStorage.getItem(KEY_LS) || '';
    setBusy(true); setView('workspace'); setIframeErr('');
    if (!isEdit) setTitle(rawText.trim().slice(0, 48));

    const chipsSnap = isEdit ? [] : [...attached];
    const dsSnap = isEdit ? [] : datasets.map((d) => ({ slug: d.slug, name: d.name }));
    const bId = ++buildIdRef.current;
    setMessages((m) => [...m,
      { id: `u${bId}`, role: 'user', text: rawText.trim(), chips: chipsSnap, ds: dsSnap },
      { id: `b${bId}`, role: 'ai', kind: 'build', progress: 0, state: 'running' },
    ]);
    setTab('app');

    const tick = () => {
      setMessages((m) => m.map((x) => (x.id === `b${bId}` && x.state === 'running' && x.progress < STEPS.length - 1 ? { ...x, progress: x.progress + 1 } : x)));
      timerRef.current = setTimeout(tick, 1400);
    };
    timerRef.current = setTimeout(tick, 1100);

    const body = { prompt: withContext(rawText), currentHtml: isEdit ? html : '', key, datasets: datasets.map((x) => x.slug), origin: window.location.origin };
    try {
      const handled = await tryStream(body, bId, isEdit);
      if (!handled) await nonStream(body, bId, isEdit);
    } finally {
      clearTimeout(timerRef.current);
      setBusy(false); setStreamCode(''); streamBufRef.current = '';
    }
  };

  const resetHeal = () => { autoHealRef.current = { tries: 0, lastErr: '' }; };
  const enhancePrompt = async () => {
    const base = prompt.trim();
    if (!base) { showToast('اكتب فكرةً مختصرةً أولاً'); return; }
    if (enhancing || busy) return;
    setEnhancing(true);
    try {
      const key = localStorage.getItem(KEY_LS) || '';
      const d = await jpost('/engine/enhance', { prompt: base, key });
      if (d?.ok && d.prompt) { setPrompt(d.prompt); showToast('حُسّن الوصف ✨ — عدّله أو ابنِ مباشرةً'); }
      else showToast(d?.reason === 'missing_key' ? 'أضِف مفتاح الموديل أولاً' : 'تعذّر التحسين، جرّب مجدّداً');
    } catch { showToast('تعذّر الاتصال بالخادم'); }
    finally { setEnhancing(false); }
  };
  const sendHome = () => { if (prompt.trim()) { resetHeal(); runBuild(prompt, false); setPrompt(''); } };
  const sendEdit = () => { if (prompt2.trim() && html) { resetHeal(); runBuild(prompt2, true); setPrompt2(''); } };
  const autoFix = () => { resetHeal(); const msg = iframeErr; setIframeErr(''); runBuild(`التطبيق يُصدر خطأ JavaScript أثناء التشغيل: "${msg}". أصلح السبب الجذريّ وأعِد إخراج المستند كاملاً وهو يعمل بلا أخطاء.`, true); };

  /* تنزيل المشروع HTML / فتحه بتبويبٍ مستقلّ (يعمل حتى قبل النشر) */
  const downloadHtml = () => {
    if (!html) return;
    const safe = (title || 'palnovaa-app').replace(/[^\w؀-ۿ -]+/g, '').trim() || 'app';
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `${safe}.html`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
    showToast('نُزِّل ملفّ HTML');
  };
  const copyCode = () => {
    if (!html || !navigator.clipboard) { showToast('تعذّر النسخ'); return; }
    navigator.clipboard.writeText(html).then(() => showToast('نُسخ الكود')).catch(() => showToast('تعذّر النسخ'));
  };

  const persist = async () => {
    if (!html) return null;
    let res;
    if (slug) res = await jput(`/engine/projects/${slug}`, { html, title, summary, thread: serializeThread(messagesRef.current) });
    else res = await jpost('/engine/projects', { title, summary, html, thread: serializeThread(messagesRef.current) });
    if (res?.ok) {
      const s = res.project?.slug || slug; setSlug(s);
      if (res.public_url) setPublicUrl(res.public_url);
      setDirty(false); loadProjects(); return s;
    }
    showToast(res?.reason === 'forbidden' ? 'هذا المشروع ليس لك' : 'تعذّر الحفظ'); return null;
  };

  const onDeploy = async () => { if (!html || busy) return; showToast('جارٍ النشر…'); const s = await persist(); if (s) showToast('تمّ النشر — رابطٌ دائم جاهز'); };
  const onShare = async () => {
    if (!html || busy) return;
    showToast('جارٍ الحفظ…');
    const s = await persist();            // يحفظ أحدث نسخة وينشرها → الرابط الدائم جاهز
    if (!s) return;                        // persist يُظهر سبب الفشل
    const link = appLink(s);
    try { await navigator.clipboard.writeText(link); showToast('تمّ الحفظ ونسخ الرابط ✓'); }
    catch { showToast('تمّ الحفظ — ' + link); }
  };
  const openLive = () => { if (slug) window.open(appLink(slug), '_blank'); };

  /* إعادة تسمية المشروع (تُحفظ تلقائياً إن كان منشوراً) */
  const beginRename = () => { setNameDraft((title && title !== 'محادثة جديدة') ? title : ''); setRenaming(true); };
  const commitRename = async () => {
    const n = nameDraft.trim().slice(0, 60);
    setRenaming(false);
    if (!n || n === title) return;
    setTitle(n);
    if (slug) {
      const res = await jput(`/engine/projects/${slug}`, { title: n });
      if (res?.ok) { showToast('أُعيدت التسمية ✓'); loadProjects(); }
      else showToast('تعذّر حفظ الاسم');
    } else { setDirty(true); showToast('سُمّي المشروع — انشر لحفظه'); }
  };

  const newProject = () => {
    clearTimeout(timerRef.current);
    setView('home'); setMessages([]); setHtml(''); setTitle('محادثة جديدة'); setSummary('');
    setSlug(null); setPublicUrl(''); setDirty(false); setPrompt(''); setPrompt2(''); setMenu(null);
    setDatasets([]); setAttached([]); setIframeErr(''); setTplSearch(''); resetHeal();
  };
  const openProject = async (p) => {
    setMenu(null);
    const d = await jget(`/engine/projects/${p.slug}`);
    if (d?.ok) {
      setHtml(d.project.html); setTitle(d.project.title); setSummary(d.project.summary || '');
      setSlug(d.project.slug); setPublicUrl(d.project.public_url || ''); setDirty(false); setIframeErr(''); resetHeal();
      const thread = Array.isArray(d.project.thread) ? d.project.thread : null;
      setMessages(thread && thread.length ? thread : [{ id: `open${p.slug}`, role: 'ai', kind: 'note', text: `فُتح المشروع: ${d.project.title}. تابع التعديل أو افتح الرابط الدائم.`, suggests: [] }]);
      setView('workspace'); setTab('app');
    }
  };
  const deleteProject = async (p, e) => {
    e.stopPropagation();
    if (!window.confirm(`حذف «${p.title}»؟`)) return;
    const d = await jdel(`/engine/projects/${p.slug}`);
    if (d?.reason === 'forbidden') { showToast('لا يمكنك حذف مشروع غيرك'); return; }
    if (slug === p.slug) newProject(); loadProjects();
  };
  const forkProject = async () => {
    if (!slug) return; showToast('جارٍ إنشاء نسخة…');
    const d = await jpost(`/engine/projects/${slug}/fork`, {});
    if (d?.ok) { showToast('أُنشئت نسخةٌ جديدة'); loadProjects(); openProject({ slug: d.project.slug, title: d.project.title }); }
    else showToast('تعذّر النسخ');
  };

  const loadVersions = async () => { if (!slug) { setVersions([]); return; } const d = await jget(`/engine/projects/${slug}/versions`); setVersions(d?.ok ? d.versions : []); };
  const restoreVersion = async (vid) => {
    setMenu(null); showToast('جارٍ الاسترجاع…');
    const d = await jpost(`/engine/projects/${slug}/restore`, { versionId: vid });
    if (d?.ok) { setHtml(d.project.html); setTitle(d.project.title); setSummary(d.project.summary || ''); if (d.project.public_url) setPublicUrl(d.project.public_url); setIframeErr(''); showToast('استُرجعت النسخة'); }
    else showToast('تعذّر الاسترجاع');
  };

  const saveKey = () => { const k = keyDraft.trim(); if (k) localStorage.setItem(KEY_LS, k); else localStorage.removeItem(KEY_LS); setModal(null); showToast(k ? 'تمّ حفظ المفتاح على جهازك' : 'أُزيل المفتاح'); };

  /* ---- ArcGIS REST ---- */
  const openArcgis = () => { setMenu(null); setArcData(null); setArcSel([]); setArcStack([]); setArcErr(''); setArcFilter(''); setArcUrl(ARCGIS_DEFAULT); setModal('arcgis'); };
  const browseArc = async (url, push = true) => {
    const target = (url || arcUrl || '').trim(); if (!target) return;
    setArcBusy(true); setArcErr(''); setArcFilter('');
    try {
      const d = await jget(`/engine/arcgis/browse?url=${encodeURIComponent(target)}`);
      if (d?.ok) {
        if (push && arcData) setArcStack((s) => [...s, arcData]);
        setArcData(d); setArcUrl(target);
        if (d.kind === 'service') setArcSel((d.layers || []).map((l) => l.id));
      } else { setArcErr(d?.reason || 'تعذّر التصفّح'); }
    } catch { setArcErr('تعذّر الاتصال بالخادم'); }
    setArcBusy(false);
  };
  const arcBack = () => { setArcStack((s) => { const n = [...s]; const prev = n.pop(); if (prev) { setArcData(prev); setArcErr(''); setArcFilter(''); } return n; }); };
  const toggleArcLayer = (id) => setArcSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const attachArcgis = async () => {
    const d = arcData; if (!d || d.kind !== 'service') return;
    const chosen = (d.layers || []).filter((l) => arcSel.includes(l.id));
    const name = String(d.name || 'خادم ArcGIS').split('/').pop();
    setArcBusy(true);
    const res = await jpost('/engine/arcgis/save', { name, url: d.url, serviceType: d.serviceType, layers: chosen });
    setArcBusy(false);
    if (res?.ok) { setMyDatasets((a) => [res.dataset, ...a]); attachDataset(res.dataset); setModal(null); showToast(`أُرفق «${name}» (${chosen.length || 'كلّ'} طبقة)`); }
    else showToast(res?.reason || 'تعذّر الحفظ');
  };
  const downloadArcLayer = async (layer) => {
    if (!arcData || arcDl !== null) return;
    const base = `${arcData.url}/${layer.id}/query`;
    setArcDl(layer.id); showToast(`جارٍ تنزيل «${layer.name}»…`);
    try {
      let offset = 0, all = [], guard = 0;
      while (guard++ < 120) {
        const u = `${base}?where=1%3D1&outFields=*&outSR=4326&f=geojson&returnGeometry=true&resultOffset=${offset}&resultRecordCount=2000`;
        const r = await fetch(u);
        const j = await r.json();
        if (j.error) throw new Error(j.error.message || 'خطأ من الخادم');
        const feats = j.features || [];
        all = all.concat(feats);
        const more = j.exceededTransferLimit || j.properties?.exceededTransferLimit;
        if (!more || feats.length === 0) break;
        offset += feats.length;
      }
      if (!all.length) { showToast('لا عناصر في هذه الطبقة'); setArcDl(null); return; }
      const fc = { type: 'FeatureCollection', features: all };
      const safe = String(layer.name || 'layer').replace(/[^\w؀-ۿ-]+/g, '_').slice(0, 60);
      const blob = new Blob([JSON.stringify(fc)], { type: 'application/geo+json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = `${safe}.geojson`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1500);
      showToast(`نُزّلت «${layer.name}» (${all.length} عنصر)`);
    } catch (e) { showToast(`تعذّر التنزيل: ${String(e.message || e).slice(0, 60)}`); }
    setArcDl(null);
  };

  /* ---- HDX ---- */
  const HDX_TOPICS = [
    { label: 'حدود إداريّة', q: 'administrative boundaries' },
    { label: 'صحّة', q: 'health facilities' },
    { label: 'تعليم', q: 'education schools' },
    { label: 'طرق', q: 'roads' },
    { label: 'مياه', q: 'water' },
    { label: 'نزوح', q: 'displacement' },
    { label: 'سكّان', q: 'population' },
    { label: 'أمن غذائي', q: 'food security' },
  ];
  const hdxAttachable = (r) => /\.(geojson|json|csv)$/i.test(String(r.url || '').split('?')[0]);
  const searchHdx = async (q, page) => {
    setHdxBusy(true); setHdxErr('');
    try {
      const d = await jget(`/engine/hdx/search?q=${encodeURIComponent(q ?? hdxQ)}&page=${page || 1}`);
      if (d?.ok) { setHdxRes(d.datasets || []); setHdxCount(d.count || 0); setHdxPage(d.page || 1); }
      else setHdxErr(d?.reason || 'تعذّر البحث');
    } catch { setHdxErr('تعذّر الاتصال بالخادم'); }
    setHdxBusy(false);
  };
  const openHdx = () => { setMenu(null); setHdxQ(''); setHdxErr(''); setModal('hdx'); searchHdx('', 1); };
  const downloadHdxResource = (r) => { try { window.open(r.url, '_blank', 'noopener'); showToast('يبدأ التنزيل في تبويب جديد…'); } catch { showToast('تعذّر فتح رابط التنزيل'); } };
  const attachHdxResource = async (ds, r) => {
    if (hdxAtt) return;
    setHdxAtt(r.url); showToast('جارٍ إضافة المورد كمصدر…');
    const res = await jpost('/engine/hdx/attach', { url: r.url, name: `${ds.title} — ${r.name}`.slice(0, 150), format: r.format });
    setHdxAtt(null);
    if (res?.ok) { setMyDatasets((a) => [res.dataset, ...a]); attachDataset(res.dataset); setModal(null); showToast(`أُضيفت كمصدر بيانات (${res.dataset.feature_count} عنصر)`); }
    else showToast(res?.reason || 'تعذّر الإضافة');
  };
  const hdxPages = Math.max(1, Math.ceil(hdxCount / 20));

  /* ---- عارض البيانات (Explorer) ---- */
  const STREETS_URL = 'https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
  const SAT_URL = 'https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}';
  const popupHtml = (props) => {
    if (!props) return 'لا خصائص';
    const rows = Object.entries(props).filter(([k]) => !/^(SHAPE__|__|OBJECTID$|globalid$)/i.test(k)).slice(0, 14)
      .map(([k, v]) => `<div style="display:flex;gap:8px;margin:2px 0;font-size:12px"><b style="color:#8a9;min-width:70px">${k}</b><span style="color:#ddd">${v == null ? '—' : String(v).slice(0, 90)}</span></div>`).join('');
    return `<div style="min-width:170px;max-height:230px;overflow:auto;direction:rtl">${rows || 'لا خصائص'}</div>`;
  };
  const csvToLayer = (text, L, col = '#E07B39') => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) throw new Error('CSV فارغ');
    const delim = lines[0].includes('\t') ? '\t' : (lines[0].split(';').length > lines[0].split(',').length ? ';' : ',');
    const header = lines[0].split(delim).map((h) => h.trim().replace(/^"|"$/g, ''));
    const latI = header.findIndex((h) => /^(lat|latitude|y)$/i.test(h));
    const lonI = header.findIndex((h) => /^(lon|lng|long|longitude|x)$/i.test(h));
    if (latI < 0 || lonI < 0) throw new Error('لا أعمدة إحداثيّات (lat/lon)');
    const grp = L.layerGroup();
    for (let i = 1; i < lines.length && i < 6000; i++) {
      const cells = lines[i].split(delim);
      const lat = parseFloat(cells[latI]), lon = parseFloat(cells[lonI]);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      const props = {}; header.forEach((h, j) => { props[h] = (cells[j] || '').replace(/^"|"$/g, ''); });
      L.circleMarker([lat, lon], { radius: 5, color: col, fillColor: col, fillOpacity: 0.85, weight: 1 }).bindPopup(popupHtml(props)).addTo(grp);
    }
    return grp;
  };
  const buildLayer = async (d) => {
    const origin = window.location.origin;
    const col = LAYER_COLOR(d);
    if (d.kind === 'geotiff') {
      await ensureGeoraster();
      const georaster = await window.parseGeoraster(d.url);
      return new window.GeoRasterLayer({ georaster, opacity: 0.85, resolution: 256 });
    }
    if (d.kind === 'arcgis') {
      await ensureLeaflet(); await ensureProj4();
      const L = window.L; const m = d.meta || {}; const svc = m.serviceUrl; const type = m.serviceType || 'MapServer';
      if (!svc) throw new Error('هذا المصدر محفوظٌ قديماً — أعِد إضافته');
      const base = `${svc}/${type === 'FeatureServer' ? 'FeatureServer' : 'MapServer'}`;
      const grp = L.featureGroup();
      let vectorCount = 0; const imageIds = [];
      // جرّب رسم كلّ طبقة كـGeoJSON متّجه (تفاعليّ)؛ ما يفشل → صورة
      for (const l of (m.layers || [])) {
        let gj = null;
        try { gj = await fetch(`${base}/${l.id}/query?where=1%3D1&outFields=*&outSR=4326&returnGeometry=true&f=geojson&resultRecordCount=4000`).then((r) => r.json()); } catch { /* */ }
        if (gj && Array.isArray(gj.features) && gj.features.length) {
          L.geoJSON(gj, {
            style: { color: col, weight: 1.6, fillColor: col, fillOpacity: 0.2 },
            pointToLayer: (f, ll) => L.circleMarker(ll, { radius: 5, color: col, fillColor: col, fillOpacity: 0.85, weight: 1 }),
            onEachFeature: (f, ly) => { if (f.properties) ly.bindPopup(popupHtml(f.properties)); },
          }).addTo(grp);
          vectorCount += gj.features.length;
        } else imageIds.push(l.id);
      }
      // الطبقات التي لا تدعم الاستعلام (نقطيّة/مُبلّطة مثل الأورثوفوتو) → صورة ديناميكيّة موثوقة
      if (imageIds.length || (m.layers || []).length === 0) makeArcgisImageLayer(L, base, imageIds, 0.9).addTo(grp);
      // نطاق التكبير: من معلومات الخدمة (CORS متاح) عبر proj4
      try {
        const info = await fetch(`${base}?f=json`).then((r) => r.json());
        const ext = info.fullExtent || info.extent;
        const wk = ext && ext.spatialReference && (ext.spatialReference.latestWkid || ext.spatialReference.wkid);
        if (ext && wk && window.proj4) {
          const from = 'EPSG:' + wk;
          const toLL = (x, y) => { try { const p = window.proj4(from, 'EPSG:4326', [x, y]); return [p[1], p[0]]; } catch { return null; } };
          const sw = toLL(ext.xmin, ext.ymin), ne = toLL(ext.xmax, ext.ymax);
          if (sw && ne) grp.__fitBounds = L.latLngBounds([sw, ne]);
        }
      } catch { /* */ }
      void vectorCount;
      return grp;
    }
    if (d.kind === 'geojson' && d.meta && d.meta.tiled) {
      await ensureVectorGrid();
      const L = window.L;
      const url = `${origin}/api/engine/datasets/${d.slug}/tiles/{z}/{x}/{y}.pbf`;
      const vg = L.vectorGrid.protobuf(url, {
        vectorTileLayerStyles: { data: { color: col, weight: 1.2, fill: true, fillColor: col, fillOpacity: 0.25, radius: 4 } },
        interactive: true, maxNativeZoom: 20,
      });
      vg.on('click', (e) => { window.L.popup().setLatLng(e.latlng).setContent(popupHtml(e.layer && e.layer.properties)).openOn(mapRef.current); });
      return vg;
    }
    await ensureLeaflet();
    const L = window.L;
    const res = await fetch(`${origin}/api/engine/datasets/${d.slug}/data`);
    if (d.kind === 'csv') return csvToLayer(await res.text(), L, col);
    const gj = await res.json();
    return L.geoJSON(gj, {
      style: { color: col, weight: 1.5, fillColor: col, fillOpacity: 0.2 },
      pointToLayer: (f, latlng) => L.circleMarker(latlng, { radius: 5, color: col, fillColor: col, fillOpacity: 0.85, weight: 1 }),
      onEachFeature: (f, lyr) => { if (f.properties) lyr.bindPopup(popupHtml(f.properties)); },
    });
  };
  const fitToLayer = (d, layer) => {
    const L = window.L; const map = mapRef.current; if (!map) return;
    try {
      if (layer && layer.__fitBounds && layer.__fitBounds.isValid && layer.__fitBounds.isValid()) { map.fitBounds(layer.__fitBounds, { maxZoom: 15, padding: [26, 26] }); return; }
      if (d.meta && Array.isArray(d.meta.bbox) && d.kind !== 'geotiff') {
        const [minx, miny, maxx, maxy] = d.meta.bbox;
        if ([minx, miny, maxx, maxy].every(Number.isFinite) && Math.abs(minx) <= 180 && Math.abs(maxy) <= 90) { map.fitBounds(L.latLngBounds([[miny, minx], [maxy, maxx]]), { maxZoom: 15, padding: [26, 26] }); return; }
      }
      if (layer.getBounds) { const b = layer.getBounds(); if (b && b.isValid && b.isValid()) map.fitBounds(b, { maxZoom: 16, padding: [26, 26] }); }
    } catch { /* */ }
  };
  const toggleLayer = async (d) => {
    const map = mapRef.current; if (!map) return;
    if (layerObjs.current[d.slug]) {
      map.removeLayer(layerObjs.current[d.slug]); delete layerObjs.current[d.slug];
      setActiveLayers((a) => { const n = { ...a }; delete n[d.slug]; return n; });
      return;
    }
    setLayerBusy(d.slug); setExplorerErr('');
    try {
      const layer = await buildLayer(d);
      if (!layer) throw new Error('نوع غير مدعوم');
      layer.addTo(map); layerObjs.current[d.slug] = layer;
      setActiveLayers((a) => ({ ...a, [d.slug]: true }));
      fitToLayer(d, layer);
    } catch (e) { showToast('تعذّر عرض «' + d.name + '»: ' + String(e.message || '').slice(0, 45)); }
    setLayerBusy(null);
  };
  const switchBase = (which) => { const map = mapRef.current; if (map && map.__base) { map.__base.setUrl(which === 'sat' ? SAT_URL : STREETS_URL); setBaseMap(which); } };
  const openExplorer = (d) => { setMenu(null); if (d && d.slug) pendingFocus.current = d; loadDatasets(); setExplorerOpen(true); };

  /* ---- مركز المستندات ---- */
  const loadDocs = () => { setDocsLoading(true); jget('/engine/docs').then((d) => { setDocs(d?.ok ? (d.docs || []) : []); }).catch(() => setDocs([])).finally(() => setDocsLoading(false)); };
  const openDocsCenter = () => { setMenu(null); setDocOpen(null); setDocEdit(null); setDocCat(''); setDocSearch(''); loadDocs(); setDocsOpen(true); };
  const downloadDoc = async (slug, fileUrl) => {
    try { const r = await jpost(`/engine/docs/${slug}/download`, {}); const url = (r?.ok && r.file_url) || fileUrl; if (url) window.open(url, '_blank', 'noopener'); loadDocs(); }
    catch { if (fileUrl) window.open(fileUrl, '_blank', 'noopener'); }
  };
  const openDoc = async (slug) => { const d = await jget(`/engine/docs/${slug}`); if (d?.ok) setDocOpen(d.doc); else showToast('تعذّر فتح الإضافة'); };
  const saveDoc = async () => {
    const d = docEdit; if (!d || !(d.title || '').trim()) { showToast('العنوان مطلوب'); return; }
    setDocBusy(true);
    const payload = { title: d.title, excerpt: d.excerpt || '', cover_url: d.cover_url || '', body: d.body || '', file_url: d.file_url || '', file_name: d.file_name || '', kind: d.kind || 'article', published: d.published !== false, sort_order: d.sort_order || 0 };
    const res = d.slug ? await jput(`/engine/docs/${d.slug}`, payload) : await jpost('/engine/docs', payload);
    setDocBusy(false);
    if (res?.ok) { showToast('حُفظت الإضافة'); setDocEdit(null); loadDocs(); } else showToast('تعذّر الحفظ: ' + (res?.reason || ''));
  };
  const deleteDoc = async (slug) => { if (!window.confirm('حذف هذه الإضافة؟')) return; await jdel(`/engine/docs/${slug}`); loadDocs(); if (docOpen?.slug === slug) setDocOpen(null); };
  const attachDoc = async (slug) => {
    showToast('جارٍ الإضافة لبياناتك…');
    const res = await jpost(`/engine/docs/${slug}/attach`, {});
    if (res?.ok && res.dataset) { addDatasetResult(res.dataset); showToast(`أُضيف «${res.dataset.name}» إلى بياناتك`); }
    else showToast('تعذّر الإضافة: ' + (res?.reason || ''));
  };
  /* ربط إضافة (أداة/أصول) بالبناء → تُحقن في توليد الـAI */
  const attachExt = async (d) => {
    let full = d;
    if (!d.code) { const r = await jget(`/engine/docs/${d.slug}`); if (r?.ok) full = r.doc; }
    if (!full.code) { showToast('لا كود في هذه الإضافة'); return; }
    setAttachedExts((a) => (a.find((x) => x.slug === full.slug) ? a : [...a, { slug: full.slug, title: full.title, kind: full.kind, code: full.code }]));
    showToast(`أُضيفت «${full.title}» للبناء — سيستعملها المحرّك`);
  };
  const rmExt = (slug) => setAttachedExts((a) => a.filter((x) => x.slug !== slug));
  const copyExtCode = (code) => { if (!navigator.clipboard) { showToast('تعذّر النسخ'); return; } navigator.clipboard.writeText(code || '').then(() => showToast('نُسخ الكود')).catch(() => showToast('تعذّر النسخ')); };
  const exportCode = (d) => {
    if (!d.code) return;
    const ext = d.kind === 'asset' ? 'txt' : 'js';
    const safe = (d.title || 'extension').replace(/[^\w؀-ۿ -]+/g, '').trim() || 'extension';
    const url = URL.createObjectURL(new Blob([d.code], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `${safe}.${ext}`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
    showToast('صُدِّر الكود');
  };
  const uploadDocAsset = async (file, field) => {
    if (!file) return;
    showToast('جارٍ الرفع…');
    try {
      const pre = await jpost('/engine/docs/presign', { filename: file.name, contentType: file.type || 'application/octet-stream' });
      if (!pre?.ok) { showToast(pre?.reason || 'تعذّر الرفع'); return; }
      await fetch(pre.uploadUrl, { method: 'PUT', headers: { 'Content-Type': pre.contentType }, body: file });
      setDocEdit((e) => ({ ...e, [field]: pre.publicUrl, ...(field === 'file_url' ? { file_name: file.name } : {}) }));
      showToast('تمّ الرفع ✓');
    } catch { showToast('تعذّر الرفع'); }
  };
  const closeExplorer = () => {
    const map = mapRef.current;
    if (map) Object.values(layerObjs.current).forEach((ly) => { try { map.removeLayer(ly); } catch { /* */ } });
    layerObjs.current = {}; setActiveLayers({}); setExplorerErr(''); pendingFocus.current = null;
    setExplorerOpen(false);
  };

  // تهيئة خريطة العارض عند فتح النافذة (مرّةً واحدة)
  useEffect(() => {
    if (!explorerOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const L = await ensureLeaflet();
        ensureProj4();
        if (cancelled) return;
        if (mapRef.current) { setTimeout(() => mapRef.current.invalidateSize(), 60); setMapReady(true); return; }
        if (!mapElRef.current) return;
        const map = L.map(mapElRef.current, { center: [31.95, 35.23], zoom: 9, zoomControl: true, attributionControl: false });
        map.zoomControl.setPosition('topleft');
        map.__base = L.tileLayer(STREETS_URL, { subdomains: ['mt0', 'mt1', 'mt2', 'mt3'], maxZoom: 20 }).addTo(map);
        L.control.scale({ imperial: false, position: 'bottomleft', maxWidth: 140 }).addTo(map);
        const setZoom = () => { if (expZoomRef.current) expZoomRef.current.textContent = 'z' + map.getZoom(); };
        map.on('mousemove', (e) => {
          const yEl = expLatRef.current, xEl = expLonRef.current; if (!yEl || !xEl) return;
          const c = expCrsRef.current;
          if (c === 'EPSG:4326' || !window.proj4) {
            yEl.textContent = e.latlng.lat.toFixed(5) + '° N';
            xEl.textContent = e.latlng.lng.toFixed(5) + '° E';
          } else {
            try {
              const p = window.proj4('EPSG:4326', c, [e.latlng.lng, e.latlng.lat]);
              xEl.textContent = p[0].toFixed(2);
              yEl.textContent = p[1].toFixed(2);
            } catch { yEl.textContent = '—'; xEl.textContent = '—'; }
          }
        });
        map.on('zoomend', setZoom); setZoom();
        mapRef.current = map; setMapReady(true);
        setTimeout(() => map.invalidateSize(), 90);
      } catch { if (!cancelled) setExplorerErr('تعذّر تحميل الخريطة — تحقّق من الاتصال.'); }
    })();
    return () => { cancelled = true; };
  }, [explorerOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Escape يغلق النافذة (إلّا إن كانت نافذةٌ منبثقة مفتوحة فوقها)
  useEffect(() => {
    if (!explorerOpen) return;
    const onKey = (e) => { if (e.key === 'Escape' && !modal) closeExplorer(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [explorerOpen, modal]); // eslint-disable-line react-hooks/exhaustive-deps

  // عرض الطبقة المطلوبة تلقائياً بعد جهوزيّة الخريطة
  useEffect(() => {
    if (explorerOpen && mapReady && pendingFocus.current) {
      const d = pendingFocus.current; pendingFocus.current = null;
      if (!layerObjs.current[d.slug]) toggleLayer(d);
    }
  }, [explorerOpen, mapReady]); // eslint-disable-line react-hooks/exhaustive-deps

  const urlText = slug ? (APPS_BASE ? `${slug}.${APPS_BASE}` : `${window.location.host}/pe/${slug}`) : (html ? 'معاينة محليّة — انشر للحصول على رابط' : 'بانتظار التوليد…');
  const previewDoc = html ? injectCatcher(html) : '';
  const dsLabel = (k) => (k === 'arcgis' ? 'ESRI' : k === 'geotiff' ? 'TIF' : (k || 'DATA').toUpperCase());
  const dsIcon = (k) => (k === 'arcgis' ? 'GIS' : k === 'geotiff' ? 'TIF' : (k || 'D').slice(0, 4).toUpperCase());
  const LAYER_COLOR = (d) => ({ geojson: '#E07B39', csv: '#F0954F', arcgis: '#5B9BD5', geotiff: '#7BC67E' }[d.kind] || '#E07B39');
  const EXP_CRS_OPTS = [
    { v: 'EPSG:4326', n: 'WGS 84 — طول/عرض (°)' },
    { v: 'EPSG:28191', n: 'شبكة فلسطين 1923 · Grid (م)' },
    { v: 'EPSG:28192', n: 'حزام فلسطين 1923 · Belt (م)' },
    { v: 'EPSG:2039', n: 'ITM — إسرائيلي TM (م)' },
  ];
  const dsMeta = (d) => {
    if (d.kind === 'arcgis') return `ArcGIS · ${d.feature_count} طبقة`;
    if (d.kind === 'geotiff') { const m = d.meta || {}; return `GeoTIFF · ${m.width || '?'}×${m.height || '?'} · ${m.bands || '?'} نطاق`; }
    const gt = d.meta && d.meta.geometryTypes ? Object.keys(d.meta.geometryTypes)[0]?.replace(/^Multi/, '') : null;
    const tiled = d.meta && d.meta.tiled ? ' · تايلز' : '';
    return `${(d.kind || '').toUpperCase()} · ${d.feature_count}${gt ? ` · ${gt}` : ''}${tiled}`;
  };
  const allChips = [...attached.map((k) => ({ k, t: SRC[k].t, n: SRC[k].n, kind: 'src' })), ...datasets.map((d) => ({ k: d.slug, t: dsLabel(d.kind), n: d.name, kind: 'ds' }))];

  /* سوق المستندات: تصنيفات + فلترة + فرز */
  const docCategories = (() => {
    const m = {};
    docs.forEach((d) => { const c = (d.category || '').trim(); if (c) m[c] = (m[c] || 0) + 1; });
    return Object.entries(m).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  })();
  const docsFiltered = (() => {
    let a = docs;
    if (docCat) a = a.filter((d) => (d.category || '') === docCat);
    if (docSearch.trim()) { const q = docSearch.trim().toLowerCase(); a = a.filter((d) => `${d.title} ${d.excerpt} ${d.author} ${d.category}`.toLowerCase().includes(q)); }
    a = [...a];
    if (docSort === 'downloads') a.sort((x, y) => (y.downloads || 0) - (x.downloads || 0));
    else if (docSort === 'title') a.sort((x, y) => String(x.title).localeCompare(String(y.title), 'ar'));
    else a.sort((x, y) => new Date(y.created_at) - new Date(x.created_at));
    return a;
  })();
  const fmtDocDate = (d) => { try { return new Date(d).toLocaleDateString('ar', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return ''; } };

  /* =========================================================================== */
  return (
    <div className="pne-root" dir="rtl">
      <input ref={fileRef} type="file" accept=".geojson,.json,.csv,.tif,.tiff,.geotiff,.zip,.shp,.gpkg,.dxf,.dwg" hidden onChange={onFile} />
      <div className={`app ${collapsed ? 'collapsed' : ''}`}>

        {/* ============ SIDEBAR ============ */}
        <aside className="sidebar">
          <div className="brand" onClick={() => collapsed && setCollapsed(false)}>
            <span className="brand-mark"><svg viewBox="0 0 512 512" width="26" height="26"><rect width="512" height="512" rx="112" fill="#E07B39" /><g transform="translate(79.2 89.6) scale(5.2)" fill="none" strokeWidth="5" strokeLinecap="round"><path d="M14 58V6h19a20 20 0 0 1 0 40H14" stroke="#1A0D04" strokeLinejoin="round" /><path d="M23 15.5h10a10.5 10.5 0 0 1 0 21H23" stroke="#1A0D04" /><circle cx="33" cy="26" r="2.8" fill="#1A0D04" stroke="none" /></g></svg></span>
            <div className="brand-name">PalNovaa <span>Engine</span></div>
            <button className="collapse-btn" title="طيّ القائمة" onClick={(e) => { e.stopPropagation(); setCollapsed(true); }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M15 4v16" /></svg>
            </button>
          </div>
          <button className="new-btn" onClick={newProject}>{Ico.plus}<span>مشروع جديد</span><kbd>جديد</kbd></button>
          <nav className="nav">
            <a className={view === 'home' ? 'active' : ''} onClick={() => { if (view === 'templates') setView('home'); }}>{Ico.chat}<span>المحادثات</span></a>
            <a className={view === 'templates' ? 'active' : ''} onClick={() => setView('templates')}>{Ico.tpl}<span>القوالب الجاهزة</span><span className="count">{(templates.length || TPL.length) || ''}</span></a>
            <a data-menu-anchor onClick={(e) => openMenu('data', e)}>{Ico.db}<span>بياناتي</span><span className="count">{myDatasets.length || ''}</span></a>
            <a className={explorerOpen ? 'active' : ''} onClick={() => openExplorer()}>{Ico.mapIco}<span>معاينة البيانات</span></a>
            <a onClick={() => navigate('/palnovaa-engine/pricing')}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M14.6 9.2c-.6-.7-1.5-1-2.6-1-1.4 0-2.5.8-2.5 2 0 1.3 1.2 1.7 2.5 2s2.6.7 2.6 2c0 1.2-1.2 2-2.6 2-1.1 0-2-.3-2.6-1M12 6.8v10.4" /></svg><span>الأسعار والترقية</span></a>
            {user?.role === 'admin' && <a onClick={() => navigate('/palnovaa-engine/payments')}>{Ico.db}<span>إدارة الدفع</span></a>}
          </nav>
          <div className="side-section">مشاريعي</div>
          <div className="history">
            {projects.length === 0 && <div className="empty">لا مشاريع بعد</div>}
            {projects.map((p) => (
              <a key={p.slug} className={`hist-item ${slug === p.slug ? 'active' : ''}`} title={p.title} onClick={() => openProject(p)}>
                <span className="dot" style={{ background: 'var(--ok)' }} /><span className="hist-title">{p.title}</span>
                <button className="hist-del" title="حذف" onClick={(e) => deleteProject(p, e)}>{Ico.trash}</button>
              </a>
            ))}
          </div>
          <div className="side-foot">
            <div className="avatar">PN</div>
            <div className="who">
              <b>{userName || 'PalNovaa 1.0'}{balance && <span className={`plan-badge ${balance.plan === 'pro' ? 'pro' : ''}`}>{balance.plan === 'pro' ? 'Pro' : 'مجّاني'}</span>}</b>
              <small>{balance ? (balance.plan === 'pro' ? 'خطّة Pro' : 'الخطّة المجّانيّة') : 'المحرّك الذكيّ'}</small>
            </div>
          </div>
        </aside>

        {/* ============ MAIN ============ */}
        <main className="main">
          <header className="topbar">
            <div className="crumbs"><span style={{ cursor: 'pointer' }} onClick={() => { if (view !== 'home') setView('home'); }}>مساحة العمل</span><span className="sep">/</span><b>{view === 'templates' ? 'القوالب الجاهزة' : title}</b></div>
            <span className={`status-pill ${allChips.length ? 'on' : ''}`}><i /><span>{allChips.length ? `${allChips.length} مرفق` : 'لا مصدر بيانات'}</span></span>
            <div className="top-actions">
              <button className="icon-btn" title="النُّسَخ والتراجع" data-menu-anchor onClick={(e) => openMenu('versions', e)} disabled={!slug}>{Ico.history}</button>
              <button className="icon-btn" title="نسخ المشروع (fork)" onClick={forkProject} disabled={!slug}>{Ico.fork}</button>
              <button className="icon-btn" title="مفتاح الموديل" onClick={() => { setKeyDraft(localStorage.getItem(KEY_LS) || ''); setModal('key'); }}>{Ico.key}</button>
              <button className="btn" onClick={onShare} disabled={!html}>{Ico.share}<span>مشاركة</span></button>
              <button className="btn primary" onClick={onDeploy} disabled={!html || busy}>{Ico.rocket}<span>{slug && !dirty ? 'منشور' : 'نشر التطبيق'}</span></button>
            </div>
          </header>

          {/* ===== HOME ===== */}
          {view === 'home' && (
            <section className="home" onMouseMove={onHomeMove}>
              <svg className="contours" ref={contoursRef} preserveAspectRatio="xMidYMid slice" />
              <div className="home-inner">
                {userName && <h2 className="hero-greet">{greeting} {userName}</h2>}
                <h1 className="hero">ماذا تريد أن تبني اليوم؟</h1>

                <div className="composer">
                  {(allChips.length > 0 || attachedExts.length > 0) && (
                    <div className="chips">
                      {allChips.map((c) => (
                        <span className="chip" key={c.kind + c.k}><span className="ct">{c.t}</span>{c.n}
                          <button title="إزالة" onClick={() => (c.kind === 'ds' ? rmDataset(c.k) : rmSrc(c.k))}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M18 6 6 18M6 6l12 12" /></svg></button>
                        </span>
                      ))}
                      {attachedExts.map((e) => (
                        <span className="chip ext" key={'x' + e.slug}><span className="ct">{e.kind === 'asset' ? 'أصول' : 'أداة'}</span>{e.title}
                          <button title="إزالة" onClick={() => rmExt(e.slug)}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M18 6 6 18M6 6l12 12" /></svg></button>
                        </span>
                      ))}
                    </div>
                  )}
                  <textarea value={prompt} maxLength={4000}
                    placeholder=""
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendHome(); } }} rows={3} />
                  <div className="composer-bar">
                    <button className="tool chip" data-menu-anchor onClick={(e) => openMenu('attach', e)}>{Ico.plus}<span>البيانات</span></button>
                    <button className="tool chip" data-menu-anchor onClick={(e) => openMenu('mode', e)}><span className="tk">النوع</span><span className="v">{mode}</span></button>
                    <button className="tool chip mono" data-menu-anchor onClick={(e) => openMenu('crs', e)}><span className="tk">الإسناد</span><span className="v">{crs}</span></button>
                    <span className="bar-sp" />
                    <button className={`tool enhance ${enhancing ? 'busy' : ''}`} title="حسّن الوصف تلقائياً قبل البناء" disabled={!prompt.trim() || enhancing || busy} onClick={enhancePrompt}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.4 2.4M15.3 15.3l2.4 2.4M17.7 6.3l-2.4 2.4M8.7 15.3l-2.4 2.4" /></svg>
                      {enhancing ? 'يحسّن…' : 'تحسين'}
                    </button>
                    <button className="send" disabled={!prompt.trim() || busy} title="إرسال" onClick={sendHome}>{Ico.send}</button>
                  </div>
                </div>
                <div className="composer-foot"><span>Enter للإرسال · Shift+Enter لسطر جديد{prompt.length > 0 ? ` · ${prompt.length}/4000` : ''}</span><span>{balance ? (balance.plan === 'pro' ? 'Pro' : 'مجّاني') : 'Leaflet · Turf · Chart.js · Papa Parse'}</span></div>

                <div className="block-title"><h3>بياناتك{myDatasets.length > 0 && <span className="bt-count">{myDatasets.length}</span>}</h3><a onClick={() => fileRef.current?.click()}>رفع ملفّ</a></div>
                <div className="sources">
                  {myDatasets.map((d) => (
                    <div className="source" key={d.slug}>
                      <span className="s-ic">{dsIcon(d.kind)}</span>
                      <span className="s-txt" title="أضِفها كمصدرٍ للبناء" onClick={() => attachDataset(d)}><b>{d.name}</b><small>{dsMeta(d)}</small></span>
                      <button className="s-act" title="معاينة على الخريطة" onClick={() => openExplorer(d)}>{Ico.eye}</button>
                      <button className="s-act danger" title="حذف الطبقة" onClick={() => removeDataset(d)}>{Ico.trash}</button>
                    </div>
                  ))}
                  {myDatasets.length === 0 && <div style={{ gridColumn: '1/-1', padding: '14px 4px', color: 'var(--faint)', fontSize: 13 }}>لا طبقات محفوظة بعد — أضِف مصادرك من زرّ «البيانات» بالأعلى، وتُخزَّن هنا.</div>}
                </div>
              </div>
            </section>
          )}

          {view === 'home' && (
            <div className="mapbar">
              <div className="scale"><i /><span><em style={{ fontStyle: 'normal' }}>0</em><em style={{ fontStyle: 'normal' }}>250</em><em style={{ fontStyle: 'normal' }}>500 m</em></span></div>
              <span className="sep" />
              <div className="xy"><span>LAT <b ref={latRef}>32.2211° N</b></span><span>LON <b ref={lonRef}>35.2544° E</b></span></div>
              <span className="sep" /><span>{crs}</span>
              <div className="north"><span>N</span><svg ref={arrowRef} width="14" height="14" viewBox="0 0 24 24"><path d="M12 2 18 21 12 17 6 21Z" fill="none" stroke="#5A616B" strokeWidth="1.5" strokeLinejoin="round" /><path d="M12 2 12 17 6 21Z" fill="#E07B39" opacity=".8" /></svg></div>
            </div>
          )}

          {/* ===== TEMPLATES ===== */}
          {view === 'templates' && (
            <section className="home">
              <svg className="contours" ref={contoursRef} preserveAspectRatio="xMidYMid slice" />
              <div className="home-inner" style={{ paddingTop: '5vh' }}>
                <div className="tpl-header">
                  <div>
                    <h2 className="tpl-title">قوالب جاهزة للبدء السريع</h2>
                    <p className="tpl-subtitle">اختر قالباً وابدأ البناء بنقرة واحدة — أو عدّل الوصف حسب حاجتك</p>
                  </div>
                  <div className="tpl-search">
                    {Ico.search}
                    <input type="text" placeholder="ابحث في القوالب…" value={tplSearch} onChange={(e) => setTplSearch(e.target.value)} />
                  </div>
                </div>
                <div className="templates">
                  {(templates.length ? templates : TPL)
                    .filter((t) => {
                      if (!tplSearch.trim()) return true;
                      const q = tplSearch.toLowerCase();
                      return (t.title || t.t || '').toLowerCase().includes(q) || (t.desc || t.d || '').toLowerCase().includes(q) || (t.tags || []).some((g) => g.toLowerCase().includes(q));
                    })
                    .map((t, i) => (
                    <button className="tpl" key={t.id || i} onClick={() => { setPrompt(t.prompt || t.p); setView('home'); }}>
                      <div className="tpl-icon">{TICONS[t.id] || <svg width="28" height="28" viewBox="0 0 32 32" fill="none" stroke="#E07B39" strokeWidth="1.3"><path d="M16 4 4 11l12 7 12-7L16 4Z" fill="#E07B39" fillOpacity="0.12"/><path d="m4 16 12 7 12-7"/><path d="m4 21 12 7 12-7"/></svg>}</div>
                      <div><b>{t.title || t.t}</b><p>{t.desc || t.d}</p>{t.tags && <div className="tags">{t.tags.map((g) => <span className="tag" key={g}>{g}</span>)}</div>}</div>
                    </button>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* ===== WORKSPACE ===== */}
          <section className={`workspace ${view === 'workspace' ? 'on' : ''}`}>
            <div className="chat">
              <div className="thread" ref={threadRef}>
                {messages.map((m) => {
                  if (m.role === 'user') return (
                    <div className="msg-user fade-in" key={m.id}>{m.text}
                      {(m.chips?.length > 0 || m.ds?.length > 0) && (
                        <div className="chips">
                          {m.chips?.map((k) => <span className="chip" key={k}><span className="ct">{SRC[k]?.t}</span>{SRC[k]?.n}</span>)}
                          {m.ds?.map((d) => <span className="chip" key={d.slug}><span className="ct">DATA</span>{d.name}</span>)}
                        </div>
                      )}
                    </div>
                  );
                  if (m.role === 'err') return (
                    <div className="msg-ai fade-in" key={m.id}><div className="ai-av">{Ico.cube}</div><div className="body"><div className="msg-err">⚠️ {m.text}</div></div></div>
                  );
                  if (m.kind === 'upgrade') return (
                    <div className="msg-ai fade-in" key={m.id}>
                      <div className="ai-av">{Ico.cube}</div>
                      <div className="body">
                        <p>استنفدتَ حصّتك المجّانيّة لهذه الفترة. للمتابعة اشترك في <b>Pro</b> بـ<b>$5</b> وتفتح حصّةً أكبر، أو أضِف مفتاحك الخاصّ.</p>
                        <div className="suggests">
                          <button className="suggest" style={{ borderColor: 'var(--accent-line)', color: 'var(--accent-2)' }} onClick={() => navigate('/palnovaa-engine/pricing')}>اشترك في Pro — $5</button>
                          <button className="suggest" onClick={() => { setKeyDraft(localStorage.getItem(KEY_LS) || ''); setModal('key'); }}>استخدم مفتاحي الخاصّ</button>
                        </div>
                      </div>
                    </div>
                  );
                  if (m.kind === 'build') return (
                    <div className="msg-ai fade-in" key={m.id}>
                      <div className="ai-av">{Ico.cube}</div>
                      <div className="body">
                        <p>{m.state === 'error' ? 'توقّف البناء.' : 'فهمتُ المطلوب — أبني التطبيق الآن:'}</p>
                        <div className="steps">
                          <div className="steps-head"><b>خطّة البناء</b><span>{Math.min(m.progress, STEPS.length)} / {STEPS.length}</span></div>
                          <div className="progress"><i style={{ width: `${(Math.min(m.progress, STEPS.length) / STEPS.length) * 100}%` }} /></div>
                          {STEPS.map((s, i) => {
                            const cls = i < m.progress ? 'done' : (i === m.progress && m.state === 'running' ? 'run' : '');
                            return (<div className={`step ${cls}`} key={i}><span className="si">{i < m.progress ? Ico.check : <span className="ring" />}</span><span>{s.t}<span className="meta">{s.m}</span></span></div>);
                          })}
                        </div>
                        {m.usage && <div style={{ fontSize: 11, color: 'var(--faint)', fontFamily: 'var(--mono)', direction: 'ltr' }}>tokens in {(m.usage.input + m.usage.cacheRead + m.usage.cacheWrite) || 0} · out {m.usage.output || 0}{m.usage.cacheRead ? ` · cache ${m.usage.cacheRead}` : ''}</div>}
                      </div>
                    </div>
                  );
                  return (
                    <div className="msg-ai fade-in" key={m.id}>
                      <div className="ai-av">{Ico.cube}</div>
                      <div className="body"><p>{m.text}</p>{m.suggests?.length > 0 && <div className="suggests">{m.suggests.map((s) => <button className="suggest" key={s} onClick={() => setPrompt2(s)}>{s}</button>)}</div>}</div>
                    </div>
                  );
                })}
              </div>
              <div className="chat-composer">
                <div className="composer">
                  <textarea value={prompt2} maxLength={4000} placeholder="اطلب تعديلاً: أضِف مخطّطاً، غيّر الألوان، أضِف جدولاً، صدّر PDF…"
                    onChange={(e) => setPrompt2(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendEdit(); } }} rows={2} />
                  <div className="composer-bar">
                    <button className="tool" data-menu-anchor onClick={(e) => openMenu('attach', e)}>{Ico.plus}البيانات</button>
                    <button className="send" disabled={!prompt2.trim() || !html || busy} onClick={sendEdit}>{Ico.send}</button>
                  </div>
                </div>
              </div>
            </div>

            <div className="preview">
              <div className="pv-bar">
                <button className={`tab ${tab === 'app' ? 'on' : ''}`} onClick={() => setTab('app')}>{Ico.eye}معاينة</button>
                <button className={`tab ${tab === 'code' ? 'on' : ''}`} onClick={() => setTab('code')}>{Ico.code}الكود</button>
                {tab === 'app' && html && (
                  <div className="pv-devices" title="معاينة بأحجام الأجهزة">
                    <button className={device === 'desktop' ? 'on' : ''} title="سطح المكتب" onClick={() => setDevice('desktop')}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></svg></button>
                    <button className={device === 'tablet' ? 'on' : ''} title="لوحيّ" onClick={() => setDevice('tablet')}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M12 18h.01" /></svg></button>
                    <button className={device === 'mobile' ? 'on' : ''} title="جوّال" onClick={() => setDevice('mobile')}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="7" y="2" width="10" height="20" rx="2" /><path d="M12 18h.01" /></svg></button>
                  </div>
                )}
                {tab === 'code' && html && (
                  <button className="icon-btn" title="نسخ الكود" onClick={copyCode}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h8" /></svg></button>
                )}
                <div className={`url ${slug ? 'live' : ''}`}><i /><span>{urlText}</span></div>
                <button className="icon-btn" title="تنزيل HTML" onClick={downloadHtml} disabled={!html}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" /></svg></button>
                <button className="btn pv-live" title="فتح الرابط الدائم للتطبيق المنشور" onClick={openLive} disabled={!slug}>{Ico.ext}<span>الفتح الدائم</span></button>
              </div>
              <div className="pv-body">
                <div className={`pane ${tab === 'app' ? 'on' : ''}`}>
                  {!html && (<div className="pv-empty">{busy ? <div className="ld"><div className="ring" /><span>يكتب PalNovaa 1.0 تطبيقك مباشرةً… (شاهد الكود في تبويب «الكود»)</span></div> : <span>اكتب وصفاً وابدأ البناء لتظهر المعاينة هنا.</span>}</div>)}
                  {html && <div className={`pv-stage dev-${device}`}><iframe key={pvKey} className="pv-frame" title="preview" srcDoc={previewDoc} sandbox="allow-scripts allow-popups allow-forms allow-modals" /></div>}
                  {html && iframeErr && !busy && (
                    <div style={{ position: 'absolute', left: 14, right: 14, bottom: 14, background: 'rgba(227,100,80,.14)', border: '1px solid rgba(227,100,80,.45)', borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, zIndex: 3, backdropFilter: 'blur(4px)' }}>
                      <span style={{ fontSize: 12.5, color: '#f0b3a8', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', direction: 'ltr' }}>⚠ خطأ تشغيل (تعذّر الإصلاح التلقائيّ): {iframeErr}</span>
                      <button className="btn accent" style={{ height: 30 }} onClick={autoFix}>أصلح الآن</button>
                      <button className="icon-btn" style={{ width: 28, height: 28 }} onClick={() => setIframeErr('')}>{Ico.close}</button>
                    </div>
                  )}
                </div>
                <div className={`pane ${tab === 'code' ? 'on' : ''}`}>
                  {((busy && streamCode) || html) ? (() => {
                    const streaming = busy && !!streamCode;
                    const files = streaming
                      ? [
                          { name: 'index.html', lang: 'xml', code: streamCode },
                          { name: 'styles.css', lang: 'css', code: '', pending: true },
                          { name: 'app.js', lang: 'javascript', code: '', pending: true },
                        ]
                      : splitProjectFiles(html);
                    const active = streaming ? files[0] : (files.find((f) => f.name === activeFile) || files[0]);
                    let hi; try { hi = (hljsReady && window.hljs) ? window.hljs.highlight(active.code, { language: active.lang, ignoreIllegal: true }).value : escapeHtml(active.code); } catch { hi = escapeHtml(active.code); }
                    const lines = Math.max(1, active.code.split('\n').length);
                    const pick = (f) => { if (!f.pending) setActiveFile(f.name); };
                    return (
                      <div className="vscode">
                        <div className="vs-tree">
                          <div className="vs-root">
                            {Ico.chevD}{Ico.folder}
                            {renaming ? (
                              <input className="vs-rename" autoFocus value={nameDraft}
                                onChange={(e) => setNameDraft(e.target.value)}
                                onBlur={commitRename}
                                onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenaming(false); }} />
                            ) : (
                              <>
                                <b title={title}>{(title && title !== 'محادثة جديدة') ? title.slice(0, 26) : 'المشروع'}</b>
                                <button className="vs-rename-btn" title="إعادة تسمية المشروع" onClick={beginRename}>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                                </button>
                              </>
                            )}
                          </div>
                          {files.map((f) => (
                            <button key={f.name} className={`vs-file ${active.name === f.name ? 'on' : ''} ${f.pending ? 'pending' : ''}`} onClick={() => pick(f)}>
                              <span className="vs-ic"><FileIcon name={f.name} /></span>{f.name}
                              {streaming && f.name === 'index.html' && <span className="vs-writing" title="يكتب…" />}
                            </button>
                          ))}
                        </div>
                        <div className="vs-main">
                          <div className="vs-tabs">
                            {files.map((f) => (
                              <button key={f.name} className={`vs-tab ${active.name === f.name ? 'on' : ''} ${f.pending ? 'pending' : ''}`} onClick={() => pick(f)}>
                                <span className="vs-ic"><FileIcon name={f.name} /></span>{f.name}
                              </button>
                            ))}
                          </div>
                          <div className="vs-code" ref={codeScrollRef}>
                            <div className="vs-gutter">{Array.from({ length: lines }, (_, i) => <span key={i}>{i + 1}</span>)}</div>
                            <pre className="vs-pre"><code className="hljs" dangerouslySetInnerHTML={{ __html: hi + (streaming ? '<span class="vs-caret">▋</span>' : '') }} /></pre>
                          </div>
                        </div>
                      </div>
                    );
                  })() : (
                    <div className="code"><pre>— لا كود بعد —</pre></div>
                  )}
                </div>
              </div>
            </div>
          </section>

        </main>
      </div>

      {/* ============ DOCS OVERLAY (مركز المستندات) ============ */}
      {docsOpen && (
        <div className="docs-overlay" dir="rtl">
          <header className="docs-bar">
            <div className="docs-head"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M19.44 12.99c-.49.18-.82.59-.9 1.06a1.03 1.03 0 0 0 .3.88l.05.05a2.5 2.5 0 1 1-3.54 3.53l-.05-.05a1.03 1.03 0 0 0-1.76.73v.14a2.5 2.5 0 0 1-5 0v-.07a1.03 1.03 0 0 0-.67-.94 1.03 1.03 0 0 0-1.14.21l-.05.05a2.5 2.5 0 1 1-3.54-3.53l.05-.05a1.03 1.03 0 0 0-.73-1.76H2.5a2.5 2.5 0 0 1 0-5h.07a1.03 1.03 0 0 0 .94-1.81l-.05-.05A2.5 2.5 0 1 1 7 2.84l.05.05a1.03 1.03 0 0 0 1.76-.73V2a2.5 2.5 0 0 1 5 0v.07a1.03 1.03 0 0 0 1.81.94l.05-.05A2.5 2.5 0 1 1 20.16 7l-.05.05a1.03 1.03 0 0 0 .73 1.76H21a2.5 2.5 0 0 1 0 5h-.07a1.03 1.03 0 0 0-.49.23z" /></svg><b>الإضافات</b><span>إضافاتٌ تُوسّع المحرّك — طبقات وأدوات وقوالب</span></div>
            <div className="docs-actions">
              {isAdmin && !docOpen && <button className="btn accent" onClick={() => setDocEdit({ kind: 'file', published: true })}>+ إضافة جديدة</button>}
              <button className="icon-btn" title="إغلاق" onClick={() => { setDocsOpen(false); setDocOpen(null); setDocEdit(null); }}>{Ico.close}</button>
            </div>
          </header>
          {!docOpen ? (
            <div className="docs-market">
              <aside className="docs-cats">
                <button className={!docCat ? 'on' : ''} onClick={() => setDocCat('')}>الكلّ<span>{docs.length}</span></button>
                {docCategories.map((c) => (
                  <button key={c.name} className={docCat === c.name ? 'on' : ''} onClick={() => setDocCat(c.name)}>{c.name}<span>{c.count}</span></button>
                ))}
              </aside>
              <div className="docs-main">
                <div className="docs-toolbar">
                  <input className="docs-search" placeholder="ابحث في الإضافات…" value={docSearch} onChange={(e) => setDocSearch(e.target.value)} />
                  <select className="docs-sort" value={docSort} onChange={(e) => setDocSort(e.target.value)}>
                    <option value="new">الأحدث</option>
                    <option value="downloads">الأكثر تنزيلاً</option>
                    <option value="title">الاسم</option>
                  </select>
                  <span className="docs-count">{docsFiltered.length} إضافة</span>
                </div>
                {docsLoading ? (
                  <div className="docs-empty">…جارِ التحميل</div>
                ) : docsFiltered.length === 0 ? (
                  <div className="docs-empty">لا إضافات{isAdmin ? ' — أضِف أوّل إضافة من «+ إضافة جديدة».' : ' مطابقة.'}</div>
                ) : (
                  <div className="docs-grid">
                    {docsFiltered.map((d) => (
                      <div className="doc-card" key={d.slug}>
                        <div className="doc-ic" style={d.cover_url ? { backgroundImage: `url("${d.cover_url}")` } : undefined}>
                          {!d.cover_url && <span className="doc-ic-ph">{d.kind === 'tool' ? '🧩' : d.kind === 'asset' ? '🎨' : d.file_url ? '📦' : '📄'}</span>}
                          {!d.published && <span className="doc-badge draft">مسودّة</span>}
                        </div>
                        <div className="doc-info">
                          <b className="doc-t" onClick={() => openDoc(d.slug)}>{d.title}</b>
                          {d.author && <span className="doc-by">by {d.author}</span>}
                          <p className="doc-desc">{d.excerpt}</p>
                          <div className="doc-foot">
                            <span className="doc-date">🗓 {fmtDocDate(d.created_at)}{d.version ? ` · v${d.version}` : ''}</span>
                          </div>
                          <div className="doc-dl">
                            {(d.kind === 'tool' || d.kind === 'asset')
                              ? <button className="doc-dlbtn" onClick={() => attachExt(d)}>＋ أضِف للمشروع</button>
                              : d.file_url
                                ? <button className="doc-dlbtn" onClick={() => downloadDoc(d.slug, d.file_url)}>⬇ تنزيل</button>
                                : <button className="doc-dlbtn ghost" onClick={() => openDoc(d.slug)}>اقرأ المزيد</button>}
                            <span className="doc-count">{(d.kind === 'tool' || d.kind === 'asset') ? (d.kind === 'asset' ? '🎨 أصول' : '🧩 أداة') : `⬇ ${(d.downloads || 0).toLocaleString('ar')}`}</span>
                          </div>
                        </div>
                        {isAdmin && (
                          <div className="doc-admin">
                            <button title="تحرير" onClick={async () => { const r = await jget(`/engine/docs/${d.slug}`); if (r?.ok) setDocEdit(r.doc); }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg></button>
                            <button title="حذف" onClick={() => deleteDoc(d.slug)}>{Ico.trash}</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="docs-body">
              <article className="doc-detail">
                <button className="doc-back" onClick={() => setDocOpen(null)}>→ رجوع للقائمة</button>
                {docOpen.cover_url && <img className="doc-detail-cover" src={docOpen.cover_url} alt="" />}
                <h1>{docOpen.title}</h1>
                <div className="doc-detail-meta">
                  {docOpen.author && <span>بقلم {docOpen.author}</span>}
                  {docOpen.category && <span>· {docOpen.category}</span>}
                  {docOpen.version && <span>· v{docOpen.version}</span>}
                  <span>· ⬇ {(docOpen.downloads || 0).toLocaleString('ar')}</span>
                </div>
                {(docOpen.kind === 'tool' || docOpen.kind === 'asset') && docOpen.code && (
                  <div className="doc-file">
                    <button className="btn accent" onClick={() => attachExt(docOpen)}>＋ أضِف للمشروع</button>
                    <button className="btn" onClick={() => copyExtCode(docOpen.code)}>نسخ الكود</button>
                    <button className="btn" onClick={() => exportCode(docOpen)}>تصدير</button>
                  </div>
                )}
                {(docOpen.kind === 'tool' || docOpen.kind === 'asset') && docOpen.code && (
                  <pre className="doc-code" dir="ltr"><code>{docOpen.code}</code></pre>
                )}
                {docOpen.file_url && (
                  <div className="doc-file">
                    <button className="btn accent" onClick={() => downloadDoc(docOpen.slug, docOpen.file_url)}>⬇ تنزيل {docOpen.file_name || 'الملفّ'}</button>
                    {/\.(geojson|json|csv)(\?|$)/i.test(docOpen.file_url + ' ' + (docOpen.file_name || '')) && <button className="btn" onClick={() => attachDoc(docOpen.slug)}>＋ أضِف إلى بياناتي</button>}
                  </div>
                )}
                <div className="doc-body" dangerouslySetInnerHTML={{ __html: mdToHtml(docOpen.body) }} />
              </article>
            </div>
          )}
          {docEdit && (
            <div className="docs-editor-scrim" onClick={() => setDocEdit(null)}>
              <div className="docs-editor" onClick={(e) => e.stopPropagation()}>
                <h3>{docEdit.slug ? 'تحرير إضافة' : 'إضافة جديدة'}</h3>
                <label>النوع</label>
                <select value={docEdit.kind || 'tool'} onChange={(e) => setDocEdit({ ...docEdit, kind: e.target.value })}>
                  <option value="tool">أداة (كود تحليل مكانيّ — تُحقن في البناء)</option>
                  <option value="asset">أصول (أيقونات/نصوص/ألوان — تُحقن في البناء)</option>
                  <option value="file">ملفّ/طبقة (تنزيل + إضافة لبياناتي)</option>
                  <option value="article">مقال/دليل</option>
                </select>
                <label>الاسم</label>
                <input value={docEdit.title || ''} onChange={(e) => setDocEdit({ ...docEdit, title: e.target.value })} placeholder="اسم الإضافة" />
                <div className="doc-row2">
                  <div><label>الكاتب / المصدر</label><input value={docEdit.author || ''} onChange={(e) => setDocEdit({ ...docEdit, author: e.target.value })} placeholder="مثلاً: PalNovaa" /></div>
                  <div><label>الإصدار</label><input value={docEdit.version || ''} onChange={(e) => setDocEdit({ ...docEdit, version: e.target.value })} placeholder="1.0" /></div>
                </div>
                <label>التصنيف</label>
                <input list="doc-cats" value={docEdit.category || ''} onChange={(e) => setDocEdit({ ...docEdit, category: e.target.value })} placeholder="مثلاً: أقمار صناعيّة / طبقات / قوالب / أدلّة" />
                <datalist id="doc-cats"><option value="أقمار صناعيّة" /><option value="طبقات جاهزة" /><option value="قوالب" /><option value="أدلّة" /><option value="موارد فلسطين" /><option value="أدوات" /></datalist>
                <label>مقتطف (يظهر على البطاقة)</label>
                <input value={docEdit.excerpt || ''} onChange={(e) => setDocEdit({ ...docEdit, excerpt: e.target.value })} placeholder="وصفٌ قصير" />
                <label>صورة الغلاف</label>
                <div className="doc-row"><input value={docEdit.cover_url || ''} onChange={(e) => setDocEdit({ ...docEdit, cover_url: e.target.value })} placeholder="رابط صورة أو ارفع" /><label className="doc-up">رفع<input type="file" accept="image/*" hidden onChange={(e) => uploadDocAsset(e.target.files?.[0], 'cover_url')} /></label></div>
                {(docEdit.kind === 'tool' || docEdit.kind === 'asset') && (
                  <>
                    <label>الكود {docEdit.kind === 'asset' ? '(أيقونات SVG / متغيّرات ألوان CSS / نصوص)' : '(دالّة/كود جاهز يُحقن في بناء الـAI)'}</label>
                    <textarea value={docEdit.code || ''} onChange={(e) => setDocEdit({ ...docEdit, code: e.target.value })} rows={9} dir="ltr" style={{ fontFamily: 'var(--mono)', fontSize: 12.5 }} placeholder={docEdit.kind === 'asset' ? ':root{ --brand:#E07B39 }\n<svg>...</svg>' : 'function bufferKm(geojson, km){ /* ... */ }'} />
                  </>
                )}
                <label>المحتوى/الوصف (ماركداون)</label>
                <textarea value={docEdit.body || ''} onChange={(e) => setDocEdit({ ...docEdit, body: e.target.value })} rows={6} placeholder={'# عنوان\nشرح الاستعمال... **عريض** و[رابط](https://...)'} />
                <label>ملفّ للتنزيل (اختياريّ)</label>
                <div className="doc-row"><input value={docEdit.file_url || ''} onChange={(e) => setDocEdit({ ...docEdit, file_url: e.target.value })} placeholder="رابط ملفّ أو ارفع (geojson/csv يصير قابلاً للإضافة لبياناتك)" /><label className="doc-up">رفع<input type="file" hidden onChange={(e) => uploadDocAsset(e.target.files?.[0], 'file_url')} /></label></div>
                <label className="doc-check"><input type="checkbox" checked={docEdit.published !== false} onChange={(e) => setDocEdit({ ...docEdit, published: e.target.checked })} /> منشور (يظهر للمستخدمين)</label>
                <div className="docs-editor-foot"><button className="btn" onClick={() => setDocEdit(null)}>إلغاء</button><button className="btn accent" disabled={docBusy} onClick={saveDoc}>{docBusy ? 'يحفظ…' : 'حفظ'}</button></div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============ EXPLORER OVERLAY (معاينة البيانات — نافذة مستقلّة) ============ */}
      <div className={`exp-overlay ${explorerOpen ? 'open' : ''}`}>
        <header className="exp-top">
          <div className="exp-title">{Ico.mapIco}<b>معاينة البيانات</b><span>عرض طبقاتك على الخريطة</span></div>
          <button className="exp-close" onClick={closeExplorer} title="إغلاق (Esc)">{Ico.close}<span>إغلاق</span></button>
        </header>
        <div className="exp-body">
          <aside className="exp-side">
            <div className="exp-side-head"><b>بياناتي</b><span className="count mono">{myDatasets.length}</span></div>
            <div className="exp-actions">
              <button onClick={() => fileRef.current?.click()}>{Ico.up}<span>رفع ملفّ</span></button>
              <button onClick={openArcgis}>{Ico.mapIco}<span>ArcGIS</span></button>
              <button onClick={openHdx}>{Ico.db}<span>HDX</span></button>
            </div>
            <div className="exp-list">
              {myDatasets.length === 0 && <div className="exp-empty">لا بيانات محفوظة بعد — أضِفها من الأزرار فوق (رفع · ArcGIS · HDX) وتظهر هنا مباشرةً.</div>}
              {myDatasets.map((d) => (
                <button className={`exp-item ${activeLayers[d.slug] ? 'on' : ''}`} key={d.slug} onClick={() => toggleLayer(d)}>
                  <span className="exp-eye">{layerBusy === d.slug ? <span className="ring" /> : (activeLayers[d.slug] ? Ico.eye : Ico.eyeOff)}</span>
                  <span className="exp-sw" style={{ background: activeLayers[d.slug] ? LAYER_COLOR(d) : 'transparent', borderColor: LAYER_COLOR(d) }} />
                  <span className="exp-info"><b>{d.name}</b><small>{dsMeta(d)}</small></span>
                  <span className="exp-badge mono">{dsLabel(d.kind)}</span>
                </button>
              ))}
            </div>
            <div className="exp-side-foot">اضغط أيّ طبقة لعرضها / إخفائها</div>
          </aside>

          <div className="exp-map-wrap">
            <div className="exp-mapbar">
              <div className="exp-base">
                <button className={baseMap === 'streets' ? 'on' : ''} onClick={() => switchBase('streets')}>خريطة</button>
                <button className={baseMap === 'sat' ? 'on' : ''} onClick={() => switchBase('sat')}>أقمار صناعيّة</button>
              </div>
              <span className="exp-shown">{Object.keys(activeLayers).length ? `${Object.keys(activeLayers).length} طبقة معروضة` : 'اختر طبقة من البار الجانبيّ'}</span>
            </div>

            <div className="exp-map-area">
              <div ref={mapElRef} className="exp-map" />

              {/* سهم الشمال */}
              <div className="exp-north" title="الشمال">
                <svg width="30" height="38" viewBox="0 0 30 38"><path d="M15 2 24 32 15 26 6 32Z" fill="none" stroke="#C8CDD4" strokeWidth="1.4" strokeLinejoin="round" /><path d="M15 2 15 26 6 32Z" fill="#E07B39" opacity=".9" /><text x="15" y="37" textAnchor="middle" fontSize="9" fill="#C8CDD4" fontFamily="sans-serif">N</text></svg>
              </div>

              {/* الليجند */}
              {Object.keys(activeLayers).length > 0 && (
                <div className="exp-legend">
                  <div className="exp-legend-head">مفتاح الخريطة</div>
                  {myDatasets.filter((d) => activeLayers[d.slug]).map((d) => (
                    <div className="exp-legend-row" key={d.slug}>
                      <span className="exp-legend-sw" style={{ background: LAYER_COLOR(d), borderColor: LAYER_COLOR(d) }} />
                      <span className="exp-legend-name">{d.name}</span>
                      <span className="exp-legend-type mono">{dsLabel(d.kind)}</span>
                    </div>
                  ))}
                </div>
              )}

              {explorerErr && <div className="exp-err">⚠️ {explorerErr}</div>}
            </div>

            {/* الشريط السفليّ: مُبدّل نظام الإحداثيّات + العدّادات الحيّة */}
            <div className="exp-status">
              <label className="exp-crs-pick" title="غيّر نظام الإحداثيّات للعدّادات">
                {Ico.mapIco}
                <select value={expCrs} onChange={(e) => setExpCrs(e.target.value)}>
                  {EXP_CRS_OPTS.map((o) => <option key={o.v} value={o.v}>{o.n}</option>)}
                </select>
              </label>
              <span className="exp-sep" />
              <span className="exp-coord"><i>{expCrs === 'EPSG:4326' ? 'دائرة العرض' : 'شمال Y'}</i> <b ref={expLatRef} className="mono">—</b></span>
              <span className="exp-coord"><i>{expCrs === 'EPSG:4326' ? 'خطّ الطول' : 'شرق X'}</i> <b ref={expLonRef} className="mono">—</b></span>
              <span className="exp-unit mono">{expCrs === 'EPSG:4326' ? '°' : 'م'}</span>
              <span className="exp-sep" />
              <span className="exp-zoom mono" ref={expZoomRef}>z9</span>
              <span className="exp-proj mono">{expCrs}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ============ MENUS ============ */}
      {menu && (
        <div className="menu" style={{ top: menu.top, bottom: menu.bottom, left: menu.left, maxHeight: menu.maxH }}>
          {menu.name === 'attach' && (<>
            <h6>رفع بياناتك</h6>
            <button className="menu-item" onClick={() => { setMenu(null); fileRef.current?.click(); }}><span className="mi-ic">UP</span><span><b>رفع ملفّ بيانات</b><small>GeoJSON·CSV·Shapefile·GeoPackage·GeoTIFF·AutoCAD DXF</small></span></button>
            <button className="menu-item" onClick={openArcgis}><span className="mi-ic">GIS</span><span><b>خادم ArcGIS REST</b><small>طبقات حيّة من GeoMOLG وغيره</small></span></button>
            <button className="menu-item" onClick={openHdx}><span className="mi-ic">HDX</span><span><b>بيانات HDX الإنسانيّة</b><small>256 مجموعة فلسطينيّة — بحث وتنزيل وإضافة</small></span></button>
            <button className="menu-item" onClick={() => { setMenu(null); setModal('postgis'); }}><span className="mi-ic">PG</span><span><b>PostgreSQL / PostGIS</b><small>كمصدرٍ لبناء التطبيق</small></span></button>
            {myDatasets.length > 0 && <h6>بياناتي</h6>}
            {myDatasets.map((d) => (
              <button className="menu-item" key={d.slug} onClick={() => attachDataset(d)}><span className="mi-ic">{dsIcon(d.kind)}</span><span><b>{d.name}</b><small>{dsMeta(d)}</small></span></button>
            ))}
            <h6>تلميحات مصادر</h6>
            {['geojson', 'shp', 'csv', 'tif', 'wms'].map((k) => (
              <button className="menu-item" key={k} onClick={() => { addSrc(k); setMenu(null); }}><span className="mi-ic">{SRC[k].t}</span><span><b>{SRC[k].n}</b><small>{SRC[k].ctx}</small></span></button>
            ))}
          </>)}
          {menu.name === 'data' && (<>
            <h6>بياناتي</h6>
            <button className="menu-item" onClick={() => { setMenu(null); fileRef.current?.click(); }}><span className="mi-ic">UP</span><span><b>رفع ملفّ جديد</b><small>geojson·csv·shp·gpkg·tiff·dxf</small></span></button>
            <button className="menu-item" onClick={openArcgis}><span className="mi-ic">GIS</span><span><b>ربط خادم ArcGIS REST</b><small>طبقات حيّة من GeoMOLG وغيره</small></span></button>
            <button className="menu-item" onClick={openHdx}><span className="mi-ic">HDX</span><span><b>بيانات HDX الإنسانيّة</b><small>بحث وتنزيل وإضافة — 256 مجموعة فلسطينيّة</small></span></button>
            {myDatasets.length > 0 && <button className="menu-item" onClick={() => openExplorer()}><span className="mi-ic">{Ico.mapIco}</span><span><b>معاينة الكلّ على الخريطة</b><small>طبقاتك المحفوظة تُدار من «بياناتك» في الرئيسيّة</small></span></button>}
          </>)}
          {menu.name === 'mode' && (<>
            <h6>نوع المُخرَج</h6>
            {MODES.map((x) => (<button className={`menu-item ${mode === x ? 'sel' : ''}`} key={x} onClick={() => { setMode(x); setMenu(null); }}><span><b>{x}</b></span><span className="chk">✓</span></button>))}
          </>)}
          {menu.name === 'crs' && (<>
            <h6>نظام الإسناد المكانيّ</h6>
            {CRS.map((x) => (<button className={`menu-item ${crs === x ? 'sel' : ''}`} key={x} onClick={() => { setCrs(x); setMenu(null); }}><span><b className="mono">{x}</b></span><span className="chk">✓</span></button>))}
          </>)}
          {menu.name === 'versions' && (<>
            <h6>النُّسَخ (تراجع)</h6>
            {versions.length === 0 && <div style={{ padding: '8px 10px', color: 'var(--faint)', fontSize: 12.5 }}>لا نُسَخ محفوظة بعد — تُسجَّل مع كلّ تعديل.</div>}
            {versions.map((v) => (
              <button className="menu-item" key={v.id} onClick={() => restoreVersion(v.id)}><span className="mi-ic">{Ico.history}</span><span><b>{v.title || 'نسخة'}</b><small>{v.label || 'تلقائيّ'} · {new Date(v.created_at).toLocaleString('ar')}</small></span></button>
            ))}
          </>)}
        </div>
      )}

      {/* ============ MODAL: API KEY ============ */}
      {modal === 'key' && (
        <div className="scrim" onClick={(e) => { if (e.target.classList.contains('scrim')) setModal(null); }}>
          <div className="modal">
            <div className="modal-head"><span className="s-ic">{Ico.key}</span><div><b>مفتاح موديل PalNovaa</b><small>Claude Sonnet (sk-ant-…) موصى به — أو OpenRouter/Groq/Gemini</small></div><button className="icon-btn" onClick={() => setModal(null)}>{Ico.close}</button></div>
            <div className="modal-body"><div className="field"><label>المفتاح (يُحفَظ على جهازك، ويُرسَل للخادم عند التوليد فقط)</label><input type="password" value={keyDraft} placeholder="sk-ant-… أو sk-or-… أو AIza…" onChange={(e) => setKeyDraft(e.target.value)} /></div></div>
            <div className="modal-foot"><span className="note">يُكتشف المزوّد تلقائياً من بادئة المفتاح.</span><button className="btn accent sp" onClick={saveKey}>حفظ المفتاح</button></div>
          </div>
        </div>
      )}

      {/* ============ MODAL: POSTGIS ============ */}
      {modal === 'postgis' && (
        <div className="scrim" onClick={(e) => { if (e.target.classList.contains('scrim')) setModal(null); }}>
          <div className="modal">
            <div className="modal-head"><span className="s-ic">{Ico.db}</span><div><b>ربط قاعدة بيانات PostGIS</b><small>تُستخدم كمصدرٍ لبناء التطبيق</small></div><button className="icon-btn" onClick={() => setModal(null)}>{Ico.close}</button></div>
            <div className="modal-body">
              <div className="field"><label>المضيف</label><input value={pg.host} placeholder="db.example.com" onChange={(e) => setPg({ ...pg, host: e.target.value })} /></div>
              <div className="field"><label>قاعدة البيانات</label><input value={pg.db} placeholder="gis" onChange={(e) => setPg({ ...pg, db: e.target.value })} /></div>
            </div>
            <div className="modal-foot"><span className="note">بيانات الاعتماد لا تُخزَّن ولا تُرسَل للموديل.</span><button className="btn accent sp" onClick={() => { addSrc('postgis', pg.db ? `PostGIS · ${pg.db}` : 'PostGIS'); setModal(null); setPg({ host: '', db: '' }); }}>ربط المصدر</button></div>
          </div>
        </div>
      )}

      {/* ============ MODAL: ARCGIS REST ============ */}
      {modal === 'arcgis' && (
        <div className="scrim" onClick={(e) => { if (e.target.classList.contains('scrim')) setModal(null); }}>
          <div className="modal arcgis-modal">
            <div className="modal-head">
              <span className="s-ic">{Ico.db}</span>
              <div><b>ربط خادم ArcGIS REST</b><small>تصفّح الخدمات واختر الطبقات الحيّة لبناء تطبيقك عليها</small></div>
              <button className="icon-btn" onClick={() => setModal(null)}>{Ico.close}</button>
            </div>
            <div className="modal-body">
              <div className="arc-urlbar">
                <input value={arcUrl} placeholder="https://…/rest/services" spellCheck={false}
                  onChange={(e) => setArcUrl(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { setArcStack([]); browseArc(arcUrl, false); } }} />
                <button className="btn accent" disabled={arcBusy || !arcUrl.trim()} onClick={() => { setArcStack([]); browseArc(arcUrl, false); }}>{arcBusy ? '…' : 'تصفّح'}</button>
              </div>
              <div className="arc-presets">
                <span>خوادم جاهزة:</span>
                {ARCGIS_PRESETS.map((p) => (
                  <button key={p.url} className={arcUrl === p.url ? 'on' : ''} onClick={() => { setArcStack([]); setArcUrl(p.url); browseArc(p.url, false); }}>{p.label}</button>
                ))}
              </div>

              {(arcStack.length > 0 || (arcData && arcData.kind === 'service')) && (
                <div className="arc-crumbs">
                  <button className="arc-back" onClick={arcBack} disabled={!arcStack.length}>← رجوع</button>
                  {arcData?.kind === 'service' && <span className="arc-here mono">{arcData.serviceType}</span>}
                </div>
              )}

              {arcErr && <div className="msg-err" style={{ marginTop: 4 }}>⚠️ {arcErr}</div>}

              {arcBusy && !arcData && <div className="arc-loading"><span className="ring" /> جارٍ التصفّح…</div>}

              {/* دليل: مجلّدات + خدمات */}
              {arcData && arcData.kind === 'directory' && (
                <div className="arc-list">
                  <div className="arc-search">{Ico.search}<input placeholder="تصفية بالاسم…" value={arcFilter} onChange={(e) => setArcFilter(e.target.value)} /></div>
                  {arcData.folders?.filter((f) => f.name.toLowerCase().includes(arcFilter.toLowerCase())).map((f) => (
                    <button className="arc-row folder" key={f.url} onClick={() => browseArc(f.url)}>
                      <span className="arc-ic">📁</span><b>{f.name}</b><span className="arc-type">مجلّد</span>
                    </button>
                  ))}
                  {arcData.services?.filter((s) => s.name.toLowerCase().includes(arcFilter.toLowerCase())).map((s) => (
                    <button className="arc-row" key={s.url} onClick={() => browseArc(s.url)}>
                      <span className="arc-ic">{s.type === 'FeatureServer' ? '▦' : s.type === 'ImageServer' ? '🛰' : '🗺'}</span>
                      <b>{s.name}</b><span className="arc-type mono">{s.type}</span>
                    </button>
                  ))}
                  {!arcData.folders?.length && !arcData.services?.length && <div className="arc-empty">لا خدمات في هذا المسار.</div>}
                </div>
              )}

              {/* خدمة: اختيار الطبقات */}
              {arcData && arcData.kind === 'service' && (
                <div className="arc-list">
                  <div className="arc-svc-name">{String(arcData.name).split('/').pop()}{arcData.description ? <small>{arcData.description}</small> : null}</div>
                  {(arcData.layers || []).length === 0 && <div className="arc-empty">لا طبقات في هذه الخدمة.</div>}
                  {(arcData.layers || []).map((l) => (
                    <div className="arc-layer" key={l.id}>
                      <label className="arc-lcheck">
                        <input type="checkbox" checked={arcSel.includes(l.id)} onChange={() => toggleArcLayer(l.id)} />
                        <span className="arc-lname"><b>{l.name}</b>{l.geometryType && <span className="arc-geom mono">{l.geometryType.replace('esriGeometry', '')}</span>}</span>
                      </label>
                      <span className="arc-lid mono">#{l.id}</span>
                      <button className="arc-dl" title="تنزيل الطبقة GeoJSON" disabled={arcDl !== null} onClick={() => downloadArcLayer(l)}>
                        {arcDl === l.id ? <span className="ring" /> : Ico.down}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-foot">
              <span className="note">تُستهلَك الطبقات حيّةً عبر esri-leaflet — الخادم يعيد الإسقاط تلقائياً.</span>
              {arcData?.kind === 'service'
                ? <button className="btn accent sp" disabled={arcBusy || !arcSel.length} onClick={attachArcgis}>أرفق {arcSel.length || ''} طبقة</button>
                : <button className="btn sp" onClick={() => setModal(null)}>إغلاق</button>}
            </div>
          </div>
        </div>
      )}

      {/* ============ MODAL: HDX ============ */}
      {modal === 'hdx' && (
        <div className="scrim" onClick={(e) => { if (e.target.classList.contains('scrim')) setModal(null); }}>
          <div className="modal arcgis-modal hdx-modal">
            <div className="modal-head">
              <span className="s-ic">{Ico.db}</span>
              <div><b>بيانات HDX الإنسانيّة</b><small>بورصة البيانات الإنسانيّة — مجموعات فلسطين ({hdxCount || '…'})</small></div>
              <button className="icon-btn" onClick={() => setModal(null)}>{Ico.close}</button>
            </div>
            <div className="modal-body">
              <div className="hdx-explain">
                <b>كيف تستعمل البيانات؟</b> لكلّ ملفّ خياران: <b>«أضِف كمصدر»</b> (GeoJSON/CSV) فيصير مرفقاً، ثمّ اكتب طلبك مثل «اعرض هذه البيانات على خريطة» ليبنيه المحرّك تلقائياً؛ أو <b>«تنزيل»</b> ليحفظه على جهازك.
              </div>
              <div className="arc-urlbar">
                <input value={hdxQ} placeholder="ابحث: health, education, roads, population…" spellCheck={false}
                  onChange={(e) => setHdxQ(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') searchHdx(hdxQ, 1); }} />
                <button className="btn accent" disabled={hdxBusy} onClick={() => searchHdx(hdxQ, 1)}>{hdxBusy ? '…' : 'بحث'}</button>
              </div>
              <div className="arc-presets">
                <span>مواضيع:</span>
                {HDX_TOPICS.map((t) => (
                  <button key={t.q} className={hdxQ === t.q ? 'on' : ''} onClick={() => { setHdxQ(t.q); searchHdx(t.q, 1); }}>{t.label}</button>
                ))}
              </div>

              {hdxErr && <div className="msg-err" style={{ marginTop: 4 }}>⚠️ {hdxErr}</div>}
              {hdxBusy && !hdxRes.length && <div className="arc-loading"><span className="ring" /> جارٍ البحث…</div>}
              {!hdxBusy && !hdxErr && !hdxRes.length && <div className="arc-empty">لا نتائج — جرّب كلمةً أخرى.</div>}

              <div className="arc-list">
                {hdxRes.map((ds) => {
                  const resources = ds.resources || [];
                  const fmts = [...new Set(resources.map((r) => r.format).filter(Boolean))].slice(0, 5);
                  return (
                    <div className="hdx-card" key={ds.id}>
                      <div className="hdx-title">{ds.title || ds.id}</div>
                      <div className="hdx-meta">
                        {ds.org && <span className="hdx-org">{ds.org}</span>}
                        {fmts.map((f) => <span className="hdx-fmt mono" key={f}>{f}</span>)}
                      </div>
                      {ds.notes && <p className="hdx-notes">{ds.notes}</p>}
                      <div className="hdx-reslist">
                        {resources.length === 0 && <div className="hdx-nores">لا ملفّات في هذه المجموعة — افتح صفحة HDX.</div>}
                        {resources.slice(0, 6).map((r, i) => (
                          <div className="hdx-res" key={i}>
                            <span className="hdx-fmt mono">{r.format || '?'}</span>
                            <span className="hdx-rname" title={r.name}>{r.name}</span>
                            {hdxAttachable(r) && (
                              <button className="hdx-btn add" disabled={hdxAtt !== null} onClick={() => attachHdxResource(ds, r)}>
                                {hdxAtt === r.url ? <span className="ring" /> : Ico.plus}<span>أضِف كمصدر</span>
                              </button>
                            )}
                            <button className="hdx-btn" onClick={() => downloadHdxResource(r)}>{Ico.down}<span>تنزيل</span></button>
                          </div>
                        ))}
                        {resources.length > 6 && <div className="hdx-more">+{resources.length - 6} ملفّ آخر على HDX</div>}
                      </div>
                      <a className="hdx-src" href={ds.url} target="_blank" rel="noopener noreferrer">فتح الصفحة الكاملة على HDX ↗</a>
                    </div>
                  );
                })}
              </div>

              {hdxRes.length > 0 && hdxPages > 1 && (
                <div className="hdx-pager">
                  <button className="btn" disabled={hdxBusy || hdxPage <= 1} onClick={() => searchHdx(hdxQ, hdxPage - 1)}>السابق</button>
                  <span className="mono">{hdxPage} / {hdxPages}</span>
                  <button className="btn" disabled={hdxBusy || hdxPage >= hdxPages} onClick={() => searchHdx(hdxQ, hdxPage + 1)}>التالي</button>
                </div>
              )}
            </div>
            <div className="modal-foot">
              <span className="note">GeoJSON و CSV تُضاف كمصدر يبني عليه المحرّك؛ بقيّة الصيغ تُنزَّل على جهازك.</span>
              <button className="btn sp" onClick={() => setModal(null)}>إغلاق</button>
            </div>
          </div>
        </div>
      )}

      <div className={`toast ${toast ? 'show' : ''}`}><i /><span>{toast}</span></div>
    </div>
  );
}
