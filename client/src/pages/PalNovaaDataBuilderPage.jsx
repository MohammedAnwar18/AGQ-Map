// ============================================================================
// PalNovaa Engine — صفحة «بناء البيانات» المستقلّة (محرّر GIS)
// فُصلت عن صفحة المحرّك لتخفيف كودها وتسريعها (chunk كسول منفصل).
// مشبوكة بالمحرّك عبر نفس واجهة /engine/datasets — ما يُحفَظ هنا يظهر في «بياناتي».
// ============================================================================
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  API, jpost, ensureGeoman, ensureProj4, GOOGLE_SAT_SUBS,
  lineLen, ringArea, fmtArea, fmtLen, Ico,
} from './engine/kit';
import './PalNovaaEngine.css';

const STREETS_URL = 'https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
const SAT_URL = 'https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}';
const SAFE_INLINE_BYTES = 4 * 1024 * 1024;   // تحت حدّ جسم طلب Vercel (~4.5MB)

const B_CRS = [
  { v: 'EPSG:4326', n: 'WGS 84 — درجات (°)' },
  { v: 'EPSG:28191', n: 'فلسطين · Grid (م)' },
  { v: 'EPSG:28192', n: 'فلسطين · Belt (م)' },
];
const B_TYPE_AR = { point: 'نقاط', line: 'خطوط', polygon: 'مساحات' };
const B_PALETTE = [
  { stroke: '#E07B39', fill: '#F0A869' }, { stroke: '#5B9BD5', fill: '#8FC1E8' },
  { stroke: '#7BC67E', fill: '#A9DBAB' }, { stroke: '#E3B341', fill: '#F0D083' },
  { stroke: '#C678DD', fill: '#DDA9EB' }, { stroke: '#E5607A', fill: '#F09AAC' },
];

// رفع المحتوى النصّيّ (GeoJSON/CSV) إلى «بياناتي» — مباشر إن كبُر وإلّا JSON
const uploadLargeFile = async (file, name, kind) => {
  const pre = await jpost('/engine/datasets/presign', { name, kind, bytes: file.size });
  if (!pre?.ok) return pre;
  const put = await fetch(pre.uploadUrl, { method: 'PUT', headers: { 'Content-Type': pre.contentType }, body: file });
  if (!put.ok) return { ok: false, reason: `فشل الرفع إلى التخزين (${put.status})` };
  return jpost('/engine/datasets/finalize', { slug: pre.slug, name, kind });
};
const uploadText = async (name, kind, content) => {
  const bytes = new Blob([content]).size;
  if (bytes > SAFE_INLINE_BYTES) {
    const file = new File([content], `${name}.${kind === 'csv' ? 'csv' : 'geojson'}`, { type: kind === 'csv' ? 'text/csv' : 'application/geo+json' });
    return uploadLargeFile(file, name, kind);
  }
  return jpost('/engine/datasets', { name, kind, content });
};

export default function PalNovaaDataBuilderPage() {
  const navigate = useNavigate();
  const goEngine = () => navigate('/palnovaa-engine');

  const [bErr, setBErr] = useState('');
  const [bBase, setBBase] = useState('imagery');       // imagery | streets
  const [bTool, setBTool] = useState('select');        // select|point|line|polygon|edit|drag|remove
  const [bCrs, setBCrs] = useState('EPSG:4326');
  const [bLayers, setBLayers] = useState([]);
  const [bActive, setBActive] = useState(null);
  const [bSel, setBSel] = useState(null);              // {layerId,fid}
  const [bTableOpen, setBTableOpen] = useState(null);  // layerId
  const [bSumCol, setBSumCol] = useState('');
  const [bSaving, setBSaving] = useState('');
  const [bTick, setBTick] = useState(0);
  const [toast, setToast] = useState('');

  const bMap = useRef(null); const bMapEl = useRef(null);
  const bGroups = useRef({});      // layerId → { group, feats:{fid:leafletLayer} }
  const bLayersRef = useRef([]); useEffect(() => { bLayersRef.current = bLayers; }, [bLayers]);
  const bActiveRef = useRef(null); useEffect(() => { bActiveRef.current = bActive; }, [bActive]);
  const bCrsRef = useRef('EPSG:4326'); useEffect(() => { bCrsRef.current = bCrs; }, [bCrs]);
  const bFid = useRef(1);
  const bHiRef = useRef(null);
  const bLatRef = useRef(null); const bLonRef = useRef(null); const bZoomRef = useRef(null);
  const toastTimer = useRef(null);

  const showToast = (m) => { setToast(m); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(''), 2400); };

  const styleFor = (m) => (m.type === 'line'
    ? { color: m.color.stroke, weight: m.weight || 3 }
    : { color: m.color.stroke, weight: m.weight || 2, fillColor: m.color.fill, fillOpacity: 0.4 });
  const applyOne = (lyr, m) => { try {
    if (m.type === 'point') { if (lyr.setStyle) lyr.setStyle({ color: m.color.stroke, weight: m.weight || 2, fillColor: m.color.fill, fillOpacity: 0.95 }); if (lyr.setRadius) lyr.setRadius(6); }
    else if (m.type === 'line') { lyr.setStyle({ color: m.color.stroke, weight: m.weight || 3 }); if (lyr._casing) lyr._casing.setStyle({ color: m.color.fill, weight: (m.weight || 3) + 5 }); }
    else { lyr.setStyle({ color: m.color.stroke, weight: m.weight || 2, fillColor: m.color.fill, fillOpacity: 0.4 }); }
  } catch { /* */ } };
  const applyAll = (m) => { const g = bGroups.current[m.id]; if (g) Object.values(g.feats).forEach((lyr) => applyOne(lyr, m)); };

  const bMeasure = (m, fid) => {
    const lyr = bGroups.current[m.id]?.feats[fid]; if (!lyr) return null;
    try {
      if (m.type === 'point') { const ll = lyr.getLatLng(); return { kind: 'point', lat: ll.lat, lng: ll.lng }; }
      if (m.type === 'line') { const ll = lyr.getLatLngs().map((p) => [p.lat, p.lng]); return { kind: 'line', len: lineLen(ll) }; }
      const ring = (lyr.getLatLngs()[0] || []).map((p) => [p.lat, p.lng]); return { kind: 'polygon', area: ringArea(ring), per: lineLen([...ring, ring[0] || ring[0]]) };
    } catch { return null; }
  };
  const bCoord = (lat, lng) => {
    const c = bCrsRef.current;
    if (c === 'EPSG:4326' || !window.proj4) return `${lat.toFixed(5)}، ${lng.toFixed(5)}`;
    try { const p = window.proj4('EPSG:4326', c, [lng, lat]); return `${p[0].toFixed(2)}، ${p[1].toFixed(2)}`; } catch { return '—'; }
  };

  const createBLayer = (type) => {
    const L = window.L; if (!L || !bMap.current) return null;
    const id = 'L' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const color = { ...B_PALETTE[bLayersRef.current.length % B_PALETTE.length] };
    const n = bLayersRef.current.filter((l) => l.type === type).length + 1;
    const meta = { id, name: `${B_TYPE_AR[type]} ${n}`, type, color, weight: type === 'line' ? 3 : 2, visible: true, crs: bCrsRef.current, fields: [], rows: {}, feats: [] };
    bGroups.current[id] = { group: L.featureGroup().addTo(bMap.current), feats: {} };
    bActiveRef.current = id;
    setBLayers((a) => [...a, meta]); setBActive(id);
    return meta;
  };

  const onPmCreate = (e) => {
    const map = bMap.current, L = window.L; const lyr = e.layer;
    const meta = bLayersRef.current.find((l) => l.id === bActiveRef.current);
    if (!meta) { try { map.removeLayer(lyr); } catch { /* */ } return; }
    const g = bGroups.current[meta.id]; if (!g) return;
    const fid = bFid.current++; lyr._fid = fid; lyr._lid = meta.id;
    try { map.removeLayer(lyr); } catch { /* */ }
    if (meta.type === 'line') { const casing = L.polyline(lyr.getLatLngs(), { color: meta.color.fill, weight: (meta.weight || 3) + 5, opacity: 0.9, interactive: false }); lyr._casing = casing; g.group.addLayer(casing); }
    g.group.addLayer(lyr); applyOne(lyr, meta);
    lyr.on('click', () => { bHighlight(meta.id, fid); });
    lyr.on('pm:edit pm:markerdragend pm:update', () => { if (lyr._casing && lyr.getLatLngs) { try { lyr._casing.setLatLngs(lyr.getLatLngs()); } catch { /* */ } } setBTick((t) => t + 1); });
    lyr.on('pm:remove', () => { if (lyr._casing) { try { g.group.removeLayer(lyr._casing); } catch { /* */ } } delete g.feats[fid]; setBLayers((a) => a.map((l) => { if (l.id !== meta.id) return l; const r = { ...l.rows }; delete r[fid]; return { ...l, feats: l.feats.filter((x) => x !== fid), rows: r }; })); });
    g.feats[fid] = lyr;
    setBLayers((a) => a.map((l) => (l.id === meta.id ? { ...l, feats: [...l.feats, fid], rows: { ...l.rows, [fid]: {} } } : l)));
  };

  const bSetTool = (tool) => {
    const map = bMap.current; if (!map || !map.pm) return;
    try { map.pm.disableDraw(); map.pm.disableGlobalEditMode(); map.pm.disableGlobalDragMode(); map.pm.disableGlobalRemovalMode(); } catch { /* */ }
    setBTool(tool);
    if (tool === 'point' || tool === 'line' || tool === 'polygon') {
      let cur = bLayersRef.current.find((l) => l.id === bActiveRef.current);
      if (!cur || cur.type !== tool) cur = createBLayer(tool);
      if (!cur) return;
      const shape = tool === 'point' ? 'CircleMarker' : tool === 'line' ? 'Line' : 'Polygon';
      try { map.pm.enableDraw(shape, { continueDrawing: true, snappable: true, pathOptions: styleFor(cur), templineStyle: { color: cur.color.stroke }, hintlineStyle: { color: cur.color.stroke, dashArray: '5,5' } }); } catch { /* */ }
    } else if (tool === 'edit') { try { map.pm.enableGlobalEditMode(); } catch { /* */ } }
    else if (tool === 'drag') { try { map.pm.enableGlobalDragMode(); } catch { /* */ } }
    else if (tool === 'remove') { try { map.pm.enableGlobalRemovalMode(); } catch { /* */ } }
  };

  const bSelectLayer = (id) => { setBActive(id); bActiveRef.current = id; const t = bTool; if (t === 'point' || t === 'line' || t === 'polygon') { const m = bLayersRef.current.find((l) => l.id === id); if (m) bSetTool(m.type); } };
  const bRename = (id, name) => setBLayers((a) => a.map((l) => (l.id === id ? { ...l, name } : l)));
  const bSetColor = (id, slot, val) => setBLayers((a) => a.map((l) => { if (l.id !== id) return l; const nm = { ...l, color: { ...l.color, [slot]: val } }; applyAll(nm); return nm; }));
  const bToggleVis = (m) => { const g = bGroups.current[m.id]; if (!g) return; if (m.visible) { try { bMap.current.removeLayer(g.group); } catch { /* */ } } else g.group.addTo(bMap.current); setBLayers((a) => a.map((l) => (l.id === m.id ? { ...l, visible: !l.visible } : l))); };
  const bZoomLayer = (m) => { const g = bGroups.current[m.id]; if (g && g.group.getLayers().length) { try { bMap.current.fitBounds(g.group.getBounds().pad(0.2)); } catch { /* */ } } };
  const bDeleteLayer = (m) => { if (!window.confirm(`حذف الطبقة «${m.name}» وكلّ عناصرها؟`)) return; const g = bGroups.current[m.id]; if (g) { try { bMap.current.removeLayer(g.group); } catch { /* */ } delete bGroups.current[m.id]; } setBLayers((a) => a.filter((l) => l.id !== m.id)); if (bActiveRef.current === m.id) { bActiveRef.current = null; setBActive(null); } if (bTableOpen === m.id) setBTableOpen(null); };
  const bDeleteFeat = (layerId, fid) => { const g = bGroups.current[layerId]; const lyr = g?.feats[fid]; if (lyr) { if (lyr._casing) g.group.removeLayer(lyr._casing); g.group.removeLayer(lyr); delete g.feats[fid]; } setBLayers((a) => a.map((l) => { if (l.id !== layerId) return l; const r = { ...l.rows }; delete r[fid]; return { ...l, feats: l.feats.filter((f) => f !== fid), rows: r }; })); setBSel(null); };
  const bFocusFeat = (layerId, fid) => { const lyr = bGroups.current[layerId]?.feats[fid]; if (!lyr) return; try { if (lyr.getBounds) bMap.current.fitBounds(lyr.getBounds().pad(0.4)); else bMap.current.panTo(lyr.getLatLng()); } catch { /* */ } bHighlight(layerId, fid); };
  const bHighlight = (layerId, fid) => {
    const prev = bHiRef.current;
    if (prev) { const pm = bLayersRef.current.find((l) => l.id === prev.layerId); const pl = bGroups.current[prev.layerId]?.feats[prev.fid]; if (pm && pl) applyOne(pl, pm); }
    const m = bLayersRef.current.find((l) => l.id === layerId); const lyr = bGroups.current[layerId]?.feats[fid];
    if (m && lyr) { try { if (m.type === 'point') { lyr.setStyle({ color: '#FFD27A', weight: 3, fillColor: m.color.fill, fillOpacity: 1 }); lyr.setRadius(8); if (lyr.bringToFront) lyr.bringToFront(); } else { lyr.setStyle({ color: '#FFD27A', weight: (m.weight || 2) + 2 }); if (lyr.bringToFront) lyr.bringToFront(); } } catch { /* */ } }
    bHiRef.current = { layerId, fid };
    setBSel({ layerId, fid }); setBTableOpen(layerId);
  };

  const bAddField = (layerId) => setBLayers((a) => a.map((l) => { if (l.id !== layerId) return l; const n = l.fields.length + 1; return { ...l, fields: [...l.fields, { id: 'f' + Date.now().toString(36) + n, name: 'حقل ' + n }] }; }));
  const bRenameField = (layerId, fieldId, name) => setBLayers((a) => a.map((l) => (l.id === layerId ? { ...l, fields: l.fields.map((f) => (f.id === fieldId ? { ...f, name } : f)) } : l)));
  const bDelField = (layerId, fieldId) => setBLayers((a) => a.map((l) => (l.id === layerId ? { ...l, fields: l.fields.filter((f) => f.id !== fieldId) } : l)));
  const bSetCell = (layerId, fid, fieldId, val) => setBLayers((a) => a.map((l) => (l.id === layerId ? { ...l, rows: { ...l.rows, [fid]: { ...(l.rows[fid] || {}), [fieldId]: val } } } : l)));

  const bSaveLayer = async (m) => {
    const g = bGroups.current[m.id]; if (!g) return;
    const feats = m.feats.map((fid) => {
      const lyr = g.feats[fid]; if (!lyr) return null; let geometry;
      try {
        if (m.type === 'point') { const ll = lyr.getLatLng(); geometry = { type: 'Point', coordinates: [ll.lng, ll.lat] }; }
        else if (m.type === 'line') { geometry = { type: 'LineString', coordinates: lyr.getLatLngs().map((p) => [p.lng, p.lat]) }; }
        else { const ring = lyr.getLatLngs()[0].map((p) => [p.lng, p.lat]); if (ring.length && (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1])) ring.push(ring[0]); geometry = { type: 'Polygon', coordinates: [ring] }; }
      } catch { return null; }
      const props = {}; (m.fields || []).forEach((f) => { props[f.name] = (m.rows[fid] || {})[f.id] ?? ''; });
      const mm = bMeasure(m, fid); if (mm) { if (mm.kind === 'polygon') { props['المساحة_م2'] = Math.round(mm.area); props['المحيط_م'] = Math.round(mm.per); } else if (mm.kind === 'line') { props['الطول_م'] = Math.round(mm.len); } }
      props._crs = m.crs; return { type: 'Feature', geometry, properties: props };
    }).filter(Boolean);
    if (!feats.length) { showToast('لا عناصر في هذه الطبقة لحفظها'); return; }
    const fc = { type: 'FeatureCollection', crs: { type: 'name', properties: { name: m.crs } }, features: feats };
    setBSaving(m.id);
    try {
      const res = await uploadText(m.name, 'geojson', JSON.stringify(fc));
      if (!res?.ok) throw new Error(res?.reason || 'فشل الحفظ');
      showToast(`حُفظت «${res.dataset?.name || m.name}» في بياناتك ✓`);
    } catch (err) { showToast('تعذّر الحفظ: ' + (err.message || '')); }
    finally { setBSaving(''); }
  };

  const bSwitchBase = (which) => { const map = bMap.current; if (map && map.__base) { map.__base.setUrl(which === 'streets' ? STREETS_URL : SAT_URL); setBBase(which); } };

  // تهيئة الخريطة + أدوات الرسم (Geoman) عند التركيب
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const L = await ensureGeoman(); await ensureProj4();
        if (cancelled || bMap.current || !bMapEl.current) return;
        const map = L.map(bMapEl.current, { center: [31.95, 35.23], zoom: 9, zoomControl: true, attributionControl: false });
        map.zoomControl.setPosition('topleft');
        map.__base = L.tileLayer(SAT_URL, { subdomains: GOOGLE_SAT_SUBS, maxZoom: 21, maxNativeZoom: 21 }).addTo(map);
        L.control.scale({ imperial: false, position: 'bottomleft', maxWidth: 140 }).addTo(map);
        try { map.pm.setGlobalOptions({ snappable: true, snapDistance: 16 }); } catch { /* */ }
        const setZoom = () => { if (bZoomRef.current) bZoomRef.current.textContent = 'z' + map.getZoom(); };
        map.on('zoomend', setZoom); setZoom();
        map.on('mousemove', (e) => {
          const yEl = bLatRef.current, xEl = bLonRef.current; if (!yEl || !xEl) return; const c = bCrsRef.current;
          if (c === 'EPSG:4326' || !window.proj4) { yEl.textContent = e.latlng.lat.toFixed(5) + '°'; xEl.textContent = e.latlng.lng.toFixed(5) + '°'; }
          else { try { const p = window.proj4('EPSG:4326', c, [e.latlng.lng, e.latlng.lat]); xEl.textContent = p[0].toFixed(2); yEl.textContent = p[1].toFixed(2); } catch { yEl.textContent = '—'; xEl.textContent = '—'; } }
        });
        map.on('pm:create', onPmCreate);
        bMap.current = map; setTimeout(() => map.invalidateSize(), 90);
      } catch { if (!cancelled) setBErr('تعذّر تحميل الخريطة أو أدوات الرسم — تحقّق من الاتصال.'); }
    })();
    return () => { cancelled = true; const map = bMap.current; if (map) { try { map.remove(); } catch { /* */ } bMap.current = null; } };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Esc → رجوع للمحرّك
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') goEngine(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="pne-root" dir="rtl">
      <div className="gb-overlay open gb-page">
        <header className="gb-top">
          <div className="gb-brand"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 3 8l9 5 9-5-9-5Z" /><path d="m3 13 9 5 9-5M3 18l9 5 9-5" opacity=".55" /></svg><b>بناء البيانات</b></div>
          <div className="gb-tools" role="toolbar">
            <button className={bTool === 'select' ? 'on' : ''} onClick={() => bSetTool('select')} title="تحديد"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m3 3 7.5 18 2.3-7.2L20 11.5 3 3Z" /></svg></button>
            <span className="gb-div" />
            <button className={bTool === 'point' ? 'on' : ''} onClick={() => bSetTool('point')} title="رسم نقاط"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="4.5" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="8" /></svg></button>
            <button className={bTool === 'line' ? 'on' : ''} onClick={() => bSetTool('line')} title="رسم خطوط"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20 20 4" /><circle cx="4" cy="20" r="2.2" fill="currentColor" stroke="none" /><circle cx="20" cy="4" r="2.2" fill="currentColor" stroke="none" /></svg></button>
            <button className={bTool === 'polygon' ? 'on' : ''} onClick={() => bSetTool('polygon')} title="رسم مساحات"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M12 3 21 9v7l-9 5-9-5V9Z" fill="currentColor" fillOpacity=".18" /></svg></button>
            <span className="gb-div" />
            <button className={bTool === 'edit' ? 'on' : ''} onClick={() => bSetTool('edit')} title="تعديل الرؤوس"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 19 19 5" /><rect x="2.5" y="16.5" width="4" height="4" rx="1" fill="currentColor" stroke="none" /><rect x="17.5" y="2.5" width="4" height="4" rx="1" fill="currentColor" stroke="none" /></svg></button>
            <button className={bTool === 'drag' ? 'on' : ''} onClick={() => bSetTool('drag')} title="تحريك المعالم"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M2 12h20M12 2 9 5m3-3 3 3M12 22l-3-3m3 3 3-3M2 12l3-3m-3 3 3 3M22 12l-3-3m3 3-3 3" /></svg></button>
            <button className={bTool === 'remove' ? 'on' : ''} onClick={() => bSetTool('remove')} title="حذف بالنقر"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" /></svg></button>
          </div>
          <label className="gb-crs" title="نظام الإحداثيّات — يُطبَّق على ما ترسمه ويظهر في العدّادات والجدول">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" /></svg>
            <select value={bCrs} onChange={(e) => setBCrs(e.target.value)}>{B_CRS.map((o) => <option key={o.v} value={o.v}>{o.n}</option>)}</select>
          </label>
          <button className="gb-close" onClick={goEngine} title="رجوع للمحرّك (Esc)">{Ico.close}<span>رجوع للمحرّك</span></button>
        </header>

        <div className="gb-body">
          <div className="gb-map-wrap">
            <div ref={bMapEl} className="gb-map" />
            <div className="gb-base">
              <button className={bBase === 'imagery' ? 'on' : ''} onClick={() => bSwitchBase('imagery')}>أقمار جوجل</button>
              <button className={bBase === 'streets' ? 'on' : ''} onClick={() => bSwitchBase('streets')}>خريطة</button>
            </div>
            {bLayers.length === 0 && !bErr && <div className="gb-hint">اختر أداة رسم (نقطة/خط/مساحة) من الأعلى وابدأ الرسم — تُنشأ طبقةٌ تلقائياً بنظام الإحداثيّات المختار.</div>}
            {bErr && <div className="exp-err">⚠️ {bErr}</div>}
            <div className="gb-status">
              <span className="gb-coord"><i>{bCrs === 'EPSG:4326' ? 'عرض' : 'Y شمال'}</i><b ref={bLatRef} className="mono">—</b></span>
              <span className="gb-coord"><i>{bCrs === 'EPSG:4326' ? 'طول' : 'X شرق'}</i><b ref={bLonRef} className="mono">—</b></span>
              <span className="gb-unit mono">{bCrs === 'EPSG:4326' ? '°' : 'م'}</span>
              <span className="gb-sep" /><span className="mono" ref={bZoomRef}>z9</span>
              <span className="gb-sep" /><span className="mono gb-proj">{bCrs}</span>
            </div>
          </div>

          <aside className="gb-side">
            <div className="gb-side-head"><b>الطبقات</b><span className="count mono">{bLayers.length}</span></div>
            <div className="gb-layers">
              {bLayers.length === 0 && <div className="gb-empty">لا طبقات بعد — اختر أداة رسم (نقطة/خط/مساحة) من الشريط العلويّ وابدأ، فتظهر الطبقات هنا تلقائياً.</div>}
              {bLayers.map((l) => (
                <div className={`gb-layer ${bActive === l.id ? 'active' : ''}`} key={l.id}>
                  <div className="gb-layer-main" onClick={() => bSelectLayer(l.id)} title="اجعلها الطبقة الفعّالة للرسم">
                    <span className={`gb-type t-${l.type}`}>{l.type === 'point' ? '●' : l.type === 'line' ? '╱' : '▰'}</span>
                    <input className="gb-name" value={l.name} onChange={(e) => bRename(l.id, e.target.value)} onClick={(e) => e.stopPropagation()} />
                    <span className="gb-fc mono">{l.feats.length}</span>
                  </div>
                  <div className="gb-layer-bar">
                    <label className="gb-sw" title="لون الحدّ/الخط"><input type="color" value={l.color.stroke} onChange={(e) => bSetColor(l.id, 'stroke', e.target.value)} /><i style={{ background: l.color.stroke }} /></label>
                    <label className="gb-sw" title={l.type === 'line' ? 'لون الهالة' : 'لون التعبئة'}><input type="color" value={l.color.fill} onChange={(e) => bSetColor(l.id, 'fill', e.target.value)} /><i style={{ background: l.color.fill }} /></label>
                    <button title={l.visible ? 'إخفاء' : 'إظهار'} onClick={() => bToggleVis(l)}>{l.visible ? Ico.eye : Ico.eyeOff}</button>
                    <button title="تقريب على الطبقة" onClick={() => bZoomLayer(l)}>{Ico.mapIco}</button>
                    <button title="الجدول الوصفيّ" className={bTableOpen === l.id ? 'on' : ''} onClick={() => setBTableOpen(bTableOpen === l.id ? null : l.id)}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M3 14h18M9 4v16" /></svg></button>
                    <button title="حفظ في بياناتك" disabled={bSaving === l.id} onClick={() => bSaveLayer(l)}>{bSaving === l.id ? <span className="ring" /> : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" /><path d="M17 21v-8H7v8M7 3v5h8" /></svg>}</button>
                    <button title="حذف الطبقة" className="danger" onClick={() => bDeleteLayer(l)}>{Ico.trash}</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="gb-side-foot">لونان لكلّ طبقة: الحدّ/الخط والتعبئة/الهالة — بالنقر على المربّعين. اسمُ الطبقة قابلٌ للتحرير. ما تحفظه يظهر في «بياناتي» داخل المحرّك.</div>
          </aside>
        </div>

        {bTableOpen && (() => {
          const m = bLayers.find((l) => l.id === bTableOpen); if (!m) return null;
          const sumVal = bSumCol ? m.feats.reduce((s, fid) => { const v = parseFloat((m.rows[fid] || {})[bSumCol]); return s + (isNaN(v) ? 0 : v); }, 0) : null;
          const totalArea = m.type === 'polygon' ? m.feats.reduce((s, fid) => { const mm = bMeasure(m, fid); return s + (mm ? mm.area : 0); }, 0) : null;
          const totalLen = m.type === 'line' ? m.feats.reduce((s, fid) => { const mm = bMeasure(m, fid); return s + (mm ? mm.len : 0); }, 0) : null;
          return (
            <div className="gb-table" data-tick={bTick}>
              <div className="gb-table-head">
                <b>{m.name}</b><span className="gb-th-count mono">{m.feats.length} عنصر</span>
                <button className="gb-addfield" onClick={() => bAddField(m.id)}>＋ حقل</button>
                <div className="gb-sumpick">جمع عمود
                  <select value={bSumCol} onChange={(e) => setBSumCol(e.target.value)}><option value="">—</option>{m.fields.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select>
                  {sumVal !== null && <b className="mono">{sumVal.toLocaleString('en')}</b>}
                </div>
                <button className="gb-table-close" onClick={() => setBTableOpen(null)} title="إغلاق الجدول">{Ico.close}</button>
              </div>
              <div className="gb-table-scroll">
                <table>
                  <thead><tr>
                    <th className="gb-w1">#</th>
                    <th className="gb-wmeas">{m.type === 'point' ? 'الإحداثيّات' : m.type === 'line' ? 'الطول' : 'المساحة'}</th>
                    {m.fields.map((f) => (<th key={f.id}><div className="gb-fh"><input value={f.name} onChange={(e) => bRenameField(m.id, f.id, e.target.value)} /><button onClick={() => bDelField(m.id, f.id)} title="حذف الحقل">×</button></div></th>))}
                    <th className="gb-w1" />
                  </tr></thead>
                  <tbody>
                    {m.feats.length === 0 && <tr><td colSpan={3 + m.fields.length} className="gb-tempty">ارسم عناصر على الخريطة لتظهر صفوفها هنا.</td></tr>}
                    {m.feats.map((fid, i) => { const mm = bMeasure(m, fid); return (
                      <tr key={fid} className={bSel && bSel.fid === fid && bSel.layerId === m.id ? 'sel' : ''} onClick={() => bFocusFeat(m.id, fid)}>
                        <td className="mono">{i + 1}</td>
                        <td className="mono gb-meas">{mm ? (mm.kind === 'point' ? bCoord(mm.lat, mm.lng) : mm.kind === 'line' ? fmtLen(mm.len) : fmtArea(mm.area)) : '—'}</td>
                        {m.fields.map((f) => (<td key={f.id}><input value={(m.rows[fid] || {})[f.id] || ''} onClick={(e) => e.stopPropagation()} onChange={(e) => bSetCell(m.id, fid, f.id, e.target.value)} /></td>))}
                        <td><button className="gb-delrow" title="حذف العنصر" onClick={(e) => { e.stopPropagation(); bDeleteFeat(m.id, fid); }}>{Ico.trash}</button></td>
                      </tr>
                    ); })}
                  </tbody>
                </table>
              </div>
              <div className="gb-table-foot">
                {totalArea !== null && <span>إجمالي المساحة: <b className="mono">{fmtArea(totalArea)}</b></span>}
                {totalLen !== null && <span>إجمالي الطول: <b className="mono">{fmtLen(totalLen)}</b></span>}
                <span className="gb-foot-hint">الجدول لا يُضايق الرسم — افتحه وأغلقه متى شئت؛ أدخِل القيم واحسب المجموع فوراً.</span>
              </div>
            </div>
          );
        })()}

        {toast && <div className="toast">{toast}</div>}
      </div>
    </div>
  );
}
