import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './PalNovaaEngine.css';

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
  { t: 'تحليل الطلب واستخراج المتطلبات', m: 'intent · entities · scope' },
  { t: 'تصميم بنية التطبيق والطبقات', m: 'layout · layers · state' },
  { t: 'توليد الخريطة والترميز', m: 'Leaflet · Google tiles · symbology' },
  { t: 'بناء الواجهة واللوحات والتفاعلات', m: 'panels · legend · KPIs · popups' },
  { t: 'تجهيز البيانات والتحليل المكانيّ', m: 'GeoJSON · Turf.js' },
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
  code: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m16 18 6-6-6-6M8 6l-6 6 6 6" /></svg>,
  ext: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3" /></svg>,
  close: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>,
  send: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>,
  check: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#3DB37E" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>,
  trash: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>,
  history: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 3v6h6M3 9a9 9 0 1 1 2.5 8" /><path d="M12 8v5l3 2" /></svg>,
  fork: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="6" cy="6" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="12" cy="20" r="2.5" /><path d="M6 8.5v3a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3v-3M12 14.5v3" /></svg>,
  up: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 15V3M8 7l4-4 4 4M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" /></svg>,
};

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

  const [collapsed, setCollapsed] = useState(false);
  const [view, setView] = useState('home');
  const [prompt, setPrompt] = useState('');
  const [prompt2, setPrompt2] = useState('');
  const [attached, setAttached] = useState([]);     // تلميحات مصادر عامّة
  const [datasets, setDatasets] = useState([]);     // بيانات مرفقة (مرفوعة)
  const [myDatasets, setMyDatasets] = useState([]); // المتاحة
  const [mode, setMode] = useState(MODES[0]);
  const [crs, setCrs] = useState(CRS[0]);

  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);

  const [html, setHtml] = useState('');
  const [title, setTitle] = useState('محادثة جديدة');
  const [summary, setSummary] = useState('');
  const [slug, setSlug] = useState(null);
  const [publicUrl, setPublicUrl] = useState('');
  const [dirty, setDirty] = useState(false);
  const [tab, setTab] = useState('app');

  const [projects, setProjects] = useState([]);
  const [versions, setVersions] = useState([]);
  const [quota, setQuota] = useState(null);
  const [iframeErr, setIframeErr] = useState('');
  const [streamCode, setStreamCode] = useState('');
  const streamBufRef = useRef('');
  const flushSched = useRef(false);

  const [menu, setMenu] = useState(null);
  const [modal, setModal] = useState(null);
  const [keyDraft, setKeyDraft] = useState(localStorage.getItem(KEY_LS) || '');
  const [pg, setPg] = useState({ host: '', db: '' });
  const [toast, setToast] = useState('');

  const contoursRef = useRef(null);
  const latRef = useRef(null); const lonRef = useRef(null); const arrowRef = useRef(null);
  const threadRef = useRef(null);
  const buildIdRef = useRef(0);
  const timerRef = useRef(null);
  const toastTimer = useRef(null);
  const fileRef = useRef(null);
  const messagesRef = useRef([]);

  useEffect(() => { messagesRef.current = messages; }, [messages]);

  const showToast = useCallback((m) => {
    setToast(m); clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2400);
  }, []);

  const loadProjects = useCallback(() => { jget('/engine/projects').then((d) => { if (d?.ok) setProjects(d.projects || []); }).catch(() => {}); }, []);
  const loadDatasets = useCallback(() => { jget('/engine/datasets').then((d) => { if (d?.ok) setMyDatasets(d.datasets || []); }).catch(() => {}); }, []);
  useEffect(() => { loadProjects(); loadDatasets(); }, [loadProjects, loadDatasets]);

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
    const onKey = (e) => { if (e.key === 'Escape') { setMenu(null); setModal(null); } };
    document.addEventListener('click', onClick); document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('click', onClick); document.removeEventListener('keydown', onKey); };
  }, []);

  /* self-heal: استقبال أخطاء المعاينة */
  useEffect(() => {
    const onMsg = (e) => { const d = e.data; if (d && d.__pne === 'err' && d.msg) setIframeErr(d.msg); };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  useEffect(() => () => { clearTimeout(timerRef.current); clearTimeout(toastTimer.current); }, []);

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

  const onFile = async (e) => {
    const f = e.target.files?.[0]; if (e.target) e.target.value = '';
    if (!f) return;
    if (f.size > 6 * 1024 * 1024) { showToast('الملفّ كبيرٌ جداً (الحدّ 6MB)'); return; }
    const text = await f.text();
    const kind = /\.csv$/i.test(f.name) ? 'csv' : 'geojson';
    showToast('جارٍ رفع البيانات…');
    const d = await jpost('/engine/datasets', { name: f.name.replace(/\.[^.]+$/, ''), kind, content: text });
    if (d?.ok) { setMyDatasets((a) => [d.dataset, ...a]); attachDataset(d.dataset); showToast(`أُرفقت «${d.dataset.name}» (${d.dataset.feature_count} عنصر)`); }
    else showToast(d?.reason || 'تعذّر الرفع');
  };

  const openMenu = (name, e) => {
    e.stopPropagation();
    if (name === 'versions') loadVersions();
    const r = e.currentTarget.getBoundingClientRect();
    const left = Math.max(12, Math.min(r.left, window.innerWidth - 302));
    const top = Math.min(r.bottom + 6, window.innerHeight - 60);
    setMenu({ name, top, left });
  };

  const withContext = (text) => {
    let p = text.trim(); const parts = [];
    if (attached.length) parts.push('مصادر لاستخدامها (أو محاكاتها ببياناتٍ تجريبيّة واقعيّة): ' + attached.map((k) => SRC[k]?.ctx || k).join('، ') + '.');
    if (mode && mode !== MODES[0]) parts.push('نوع المُخرَج المطلوب: ' + mode + '.');
    if (crs && crs !== CRS[0]) parts.push('نظام الإسناد: ' + crs + '.');
    if (parts.length) p += '\n\n[' + parts.join(' ') + ']';
    return p;
  };

  const finishSuccess = (d, isEdit, bId) => {
    setHtml(d.html); if (d.title) setTitle(d.title); if (d.summary) setSummary(d.summary);
    setDirty(true); if (d.quota) setQuota(d.quota); setTab('app');
    setMessages((m) => m.map((x) => (x.id === `b${bId}` ? { ...x, progress: STEPS.length, state: 'done', usage: d.usage } : x)));
    setMessages((m) => [...m, {
      id: `n${bId}`, role: 'ai', kind: 'note',
      text: isEdit ? 'طبّقتُ التعديل وحدّثت المعاينة.' : (d.summary || 'التطبيق جاهزٌ للمعاينة.'),
      suggests: isEdit ? [] : ['أضِف فلتراً حسب المنطقة', 'غيّر تدرّج الألوان', 'أضِف لوحة مؤشّرات', 'أضِف بحثاً عن موقع'],
    }]);
    showToast('المعاينة جاهزة');
  };
  const finishError = (reason, isEdit, bId) => {
    const text = reason === '__missing'
      ? 'لا يوجد مفتاح موديل. أضِف مفتاح PalNovaa من زرّ المفتاح، أو اضبط PALNOVAA_MODEL_KEY في الخادم.'
      : (reason || 'تعذّر التوليد.');
    setMessages((m) => m.map((x) => (x.id === `b${bId}` ? { ...x, state: 'error' } : x)));
    setMessages((m) => [...m, { id: `e${bId}${Math.random().toString(36).slice(2, 5)}`, role: 'err', text }]);
    if (reason === '__missing') setModal('key');
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
            finishError(ev.reason === 'missing_key' ? '__missing' : (ev.message || ev.reason || 'تعذّر التوليد.'), isEdit, bId);
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

  const sendHome = () => { if (prompt.trim()) { runBuild(prompt, false); setPrompt(''); } };
  const sendEdit = () => { if (prompt2.trim() && html) { runBuild(prompt2, true); setPrompt2(''); } };
  const autoFix = () => { const msg = iframeErr; setIframeErr(''); runBuild(`التطبيق يُصدر خطأ JavaScript أثناء التشغيل: "${msg}". أصلح السبب الجذريّ وأعِد إخراج المستند كاملاً وهو يعمل بلا أخطاء.`, true); };

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
  const onShare = async () => { if (!html) return; const s = slug || await persist(); if (!s) return; const link = `${window.location.origin}/pe/${s}`; try { await navigator.clipboard.writeText(link); showToast('تمّ نسخ رابط المشاركة'); } catch { showToast(link); } };
  const openLive = () => { if (slug) window.open(`${window.location.origin}/pe/${slug}`, '_blank'); };

  const newProject = () => {
    clearTimeout(timerRef.current);
    setView('home'); setMessages([]); setHtml(''); setTitle('محادثة جديدة'); setSummary('');
    setSlug(null); setPublicUrl(''); setDirty(false); setPrompt(''); setPrompt2(''); setMenu(null);
    setDatasets([]); setAttached([]); setIframeErr('');
  };
  const openProject = async (p) => {
    setMenu(null);
    const d = await jget(`/engine/projects/${p.slug}`);
    if (d?.ok) {
      setHtml(d.project.html); setTitle(d.project.title); setSummary(d.project.summary || '');
      setSlug(d.project.slug); setPublicUrl(d.project.public_url || ''); setDirty(false); setIframeErr('');
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

  const urlText = slug ? `${window.location.host}/pe/${slug}` : (html ? 'معاينة محليّة — انشر للحصول على رابط' : 'بانتظار التوليد…');
  const previewDoc = html ? injectCatcher(html) : '';
  const allChips = [...attached.map((k) => ({ k, t: SRC[k].t, n: SRC[k].n, kind: 'src' })), ...datasets.map((d) => ({ k: d.slug, t: (d.kind || 'DATA').toUpperCase(), n: d.name, kind: 'ds' }))];

  /* =========================================================================== */
  return (
    <div className="pne-root" dir="rtl">
      <input ref={fileRef} type="file" accept=".geojson,.json,.csv" hidden onChange={onFile} />
      <div className={`app ${collapsed ? 'collapsed' : ''}`}>

        {/* ============ SIDEBAR ============ */}
        <aside className="sidebar">
          <div className="brand" onClick={() => collapsed && setCollapsed(false)}>
            <div className="brand-mark">{Ico.cube}</div>
            <div className="brand-name">PalNovaa <span>Engine</span></div>
            <button className="collapse-btn" title="طيّ القائمة" onClick={(e) => { e.stopPropagation(); setCollapsed(true); }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M15 4v16" /></svg>
            </button>
          </div>
          <button className="new-btn" onClick={newProject}>{Ico.plus}<span>مشروع جديد</span><kbd>جديد</kbd></button>
          <nav className="nav">
            <a className="active">{Ico.chat}<span>المحادثات</span></a>
            <a data-menu-anchor onClick={(e) => openMenu('data', e)}>{Ico.db}<span>بياناتي</span><span className="count">{myDatasets.length || ''}</span></a>
            <a onClick={() => navigate('/palnovaa-engine/pricing')}>{Ico.rocket}<span>الأسعار والترقية</span></a>
            <a onClick={() => navigate('/map')}>{Ico.grid}<span>عودة إلى المنصّة</span></a>
          </nav>
          <div className="side-section">مشاريعي</div>
          <div className="history">
            {projects.length === 0 && <div className="empty">لا مشاريع بعد</div>}
            {projects.map((p) => (
              <a key={p.slug} className={slug === p.slug ? 'active' : ''} title={p.title} onClick={() => openProject(p)}>
                <span className="dot" style={{ background: 'var(--ok)' }} />{p.title}
              </a>
            ))}
          </div>
          <div className="side-foot">
            <div className="avatar">PN</div>
            <div className="who"><b>PalNovaa 1.0</b><small>{quota ? `بقي اليوم ${Math.max(0, quota.limit - quota.used)}/${quota.limit}` : 'المحرّك الذكيّ'}</small></div>
          </div>
        </aside>

        {/* ============ MAIN ============ */}
        <main className="main">
          <header className="topbar">
            <div className="crumbs"><span>مساحة العمل</span><span className="sep">/</span><b>{title}</b></div>
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
                <h1 className="hero">ماذا تريد أن تبني اليوم؟</h1>

                <div className="composer">
                  {allChips.length > 0 && (
                    <div className="chips">
                      {allChips.map((c) => (
                        <span className="chip" key={c.kind + c.k}><span className="ct">{c.t}</span>{c.n}
                          <button title="إزالة" onClick={() => (c.kind === 'ds' ? rmDataset(c.k) : rmSrc(c.k))}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M18 6 6 18M6 6l12 12" /></svg></button>
                        </span>
                      ))}
                    </div>
                  )}
                  <textarea value={prompt}
                    placeholder="صِف تطبيق GIS الذي تريده… مثلاً: خريطة تفاعليّة لقطع الأراضي في نابلس ملوّنة حسب الاستخدام، مع فلترة ولوحة مؤشّرات."
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendHome(); } }} rows={3} />
                  <div className="composer-bar">
                    <button className="tool" data-menu-anchor onClick={(e) => openMenu('attach', e)}>{Ico.plus}البيانات</button>
                    <button className="tool" data-menu-anchor onClick={(e) => openMenu('mode', e)}>النوع: <span className="v">{mode}</span></button>
                    <button className="tool mono" data-menu-anchor onClick={(e) => openMenu('crs', e)}><span className="v">{crs}</span></button>
                    <button className="send" disabled={!prompt.trim() || busy} title="إرسال" onClick={sendHome}>{Ico.send}</button>
                  </div>
                </div>
                <div className="composer-foot"><span>Enter للإرسال · Shift + Enter لسطر جديد</span><span>{quota ? `بقي اليوم: ${Math.max(0, quota.limit - quota.used)}/${quota.limit}` : 'Leaflet · Turf · Google Tiles'}</span></div>

                <div className="block-title"><h3>قوالب للبدء السريع</h3><a onClick={() => navigate('/map')}>المنصّة</a></div>
                <div className="templates">
                  {TPL.map((t, i) => (
                    <button className="tpl" key={i} onClick={() => setPrompt(t.p)}>
                      <div className="thumb" />
                      <div><b>{t.t}</b><p>{t.d}</p><div className="tags">{t.tags.map((g) => <span className="tag" key={g}>{g}</span>)}</div></div>
                    </button>
                  ))}
                </div>

                <div className="block-title"><h3>بياناتك</h3><a onClick={() => fileRef.current?.click()}>رفع GeoJSON / CSV</a></div>
                <div className="sources">
                  <button className="source" onClick={() => fileRef.current?.click()}><span className="s-ic">{Ico.up}</span><span><b>رفع ملفّ</b><small>geojson · csv</small></span></button>
                  {myDatasets.slice(0, 4).map((d) => (
                    <button className="source" key={d.slug} onClick={() => attachDataset(d)}><span className="s-ic">{Ico.db}</span><span><b>{d.name}</b><small>{(d.kind || '').toUpperCase()} · {d.feature_count}</small></span><span className="st" /></button>
                  ))}
                  {myDatasets.length === 0 && <button className="source add" onClick={() => setModal('postgis')}>{Ico.plus}ربط PostGIS</button>}
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
                  <textarea value={prompt2} placeholder="اطلب تعديلاً: أضِف طبقة، غيّر الترميز، أضِف فلتراً…"
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
                <div className={`url ${slug ? 'live' : ''}`}><i /><span>{urlText}</span></div>
                <button className="icon-btn" title="فتح الرابط الدائم" onClick={openLive} disabled={!slug}>{Ico.ext}</button>
              </div>
              <div className="pv-body">
                <div className={`pane ${tab === 'app' ? 'on' : ''}`}>
                  {!html && (<div className="pv-empty">{busy ? <div className="ld"><div className="ring" /><span>يكتب PalNovaa 1.0 تطبيقك مباشرةً… (شاهد الكود في تبويب «الكود»)</span></div> : <span>اكتب وصفاً وابدأ البناء لتظهر المعاينة هنا.</span>}</div>)}
                  {html && <iframe className="pv-frame" title="preview" srcDoc={previewDoc} sandbox="allow-scripts allow-popups allow-forms allow-modals" />}
                  {html && iframeErr && !busy && (
                    <div style={{ position: 'absolute', left: 14, right: 14, bottom: 14, background: 'rgba(227,100,80,.14)', border: '1px solid rgba(227,100,80,.45)', borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, zIndex: 3, backdropFilter: 'blur(4px)' }}>
                      <span style={{ fontSize: 12.5, color: '#f0b3a8', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', direction: 'ltr' }}>⚠ خطأ تشغيل: {iframeErr}</span>
                      <button className="btn accent" style={{ height: 30 }} onClick={autoFix}>إصلاح تلقائيّ</button>
                      <button className="icon-btn" style={{ width: 28, height: 28 }} onClick={() => setIframeErr('')}>{Ico.close}</button>
                    </div>
                  )}
                </div>
                <div className={`pane ${tab === 'code' ? 'on' : ''}`}><div className="code"><pre>{busy && streamCode ? streamCode + '▋' : (html || '— لا كود بعد —')}</pre></div></div>
              </div>
            </div>
          </section>
        </main>
      </div>

      {/* ============ MENUS ============ */}
      {menu && (
        <div className="menu" style={{ top: menu.top, left: menu.left }}>
          {menu.name === 'attach' && (<>
            <h6>رفع بياناتك</h6>
            <button className="menu-item" onClick={() => { setMenu(null); fileRef.current?.click(); }}><span className="mi-ic">UP</span><span><b>رفع GeoJSON / CSV</b><small>تُخزَّن وتُستخدَم فعليّاً في التطبيق</small></span></button>
            <button className="menu-item" onClick={() => { setMenu(null); setModal('postgis'); }}><span className="mi-ic">PG</span><span><b>PostgreSQL / PostGIS</b><small>كمصدرٍ لبناء التطبيق</small></span></button>
            {myDatasets.length > 0 && <h6>بياناتي</h6>}
            {myDatasets.map((d) => (
              <button className="menu-item" key={d.slug} onClick={() => attachDataset(d)}><span className="mi-ic">{(d.kind || 'D').slice(0, 4).toUpperCase()}</span><span><b>{d.name}</b><small>{(d.kind || '').toUpperCase()} · {d.feature_count} عنصر</small></span></button>
            ))}
            <h6>تلميحات مصادر</h6>
            {['geojson', 'shp', 'csv', 'tif', 'wms'].map((k) => (
              <button className="menu-item" key={k} onClick={() => { addSrc(k); setMenu(null); }}><span className="mi-ic">{SRC[k].t}</span><span><b>{SRC[k].n}</b><small>{SRC[k].ctx}</small></span></button>
            ))}
          </>)}
          {menu.name === 'data' && (<>
            <h6>بياناتي</h6>
            <button className="menu-item" onClick={() => { setMenu(null); fileRef.current?.click(); }}><span className="mi-ic">UP</span><span><b>رفع ملفّ جديد</b><small>geojson · csv</small></span></button>
            {myDatasets.length === 0 && <div style={{ padding: '8px 10px', color: 'var(--faint)', fontSize: 12.5 }}>لا بيانات بعد</div>}
            {myDatasets.map((d) => (
              <div className="menu-item" key={d.slug}><span className="mi-ic">{(d.kind || 'D').slice(0, 4).toUpperCase()}</span><span onClick={() => attachDataset(d)} style={{ cursor: 'pointer', flex: 1 }}><b>{d.name}</b><small>{(d.kind || '').toUpperCase()} · {d.feature_count}</small></span>
                <button className="del" onClick={async (e) => { e.stopPropagation(); await jdel(`/engine/datasets/${d.slug}`); loadDatasets(); setDatasets((a) => a.filter((x) => x.slug !== d.slug)); }}>{Ico.trash}</button></div>
            ))}
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

      <div className={`toast ${toast ? 'show' : ''}`}><i /><span>{toast}</span></div>
    </div>
  );
}
