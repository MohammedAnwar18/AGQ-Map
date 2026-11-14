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
  const [view, setView] = useState('home');  // home | workspace | templates
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
  const [balance, setBalance] = useState(null);
  const [iframeErr, setIframeErr] = useState('');
  const [streamCode, setStreamCode] = useState('');
  const streamBufRef = useRef('');
  const flushSched = useRef(false);

  const [tplSearch, setTplSearch] = useState('');
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

  const SAFE_INLINE_BYTES = 4 * 1024 * 1024;   // تحت حدّ جسم طلب Vercel (~4.5MB)
  const uploadLargeFile = async (file, name, kind) => {
    const pre = await jpost('/engine/datasets/presign', { name, kind, bytes: file.size });
    if (!pre?.ok) return pre;
    const put = await fetch(pre.uploadUrl, { method: 'PUT', headers: { 'Content-Type': pre.contentType }, body: file });
    if (!put.ok) return { ok: false, reason: `فشل الرفع إلى التخزين (${put.status})` };
    return jpost('/engine/datasets/finalize', { slug: pre.slug, name, kind });
  };
  const onFile = async (e) => {
    const f = e.target.files?.[0]; if (e.target) e.target.value = '';
    if (!f) return;
    const isTiff = /\.(tif|tiff|geotiff)$/i.test(f.name);
    const maxBytes = isTiff ? 500 * 1024 * 1024 : 40 * 1024 * 1024;
    if (f.size > maxBytes) { showToast(`الملفّ كبيرٌ جداً (الحدّ ${isTiff ? 500 : 40}MB)`); return; }
    const kind = isTiff ? 'geotiff' : (/\.csv$/i.test(f.name) ? 'csv' : 'geojson');
    const name = f.name.replace(/\.[^.]+$/, '');
    showToast(isTiff ? 'جارٍ رفع صورة GeoTIFF…' : (f.size > SAFE_INLINE_BYTES ? 'جارٍ رفع الملفّ الكبير…' : 'جارٍ رفع البيانات…'));
    try {
      // GeoTIFF دائماً عبر الرفع المباشر (ثنائيّ)؛ GeoJSON/CSV: مباشر إن كبُر وإلّا JSON
      const d = (isTiff || f.size > SAFE_INLINE_BYTES)
        ? await uploadLargeFile(f, name, kind)
        : await jpost('/engine/datasets', { name, kind, content: await f.text() });
      if (d?.ok) {
        setMyDatasets((a) => [d.dataset, ...a]); attachDataset(d.dataset);
        const m = d.dataset.meta || {};
        const note = m.raster ? `${m.width}×${m.height}، ${m.bands} نطاق` : `${d.dataset.feature_count} عنصر${m.tiled ? '، مُقسَّمة إلى تايلز' : ''}`;
        showToast(`أُرفقت «${d.dataset.name}» (${note})`);
      } else showToast(d?.reason || 'تعذّر الرفع');
    } catch (err) { showToast('تعذّر الرفع: ' + String(err.message || err).slice(0, 50)); }
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
    setDirty(true); if (d.balance) setBalance(d.balance); setTab('app');
    setMessages((m) => m.map((x) => (x.id === `b${bId}` ? { ...x, progress: STEPS.length, state: 'done', usage: d.usage } : x)));
    setMessages((m) => [...m, {
      id: `n${bId}`, role: 'ai', kind: 'note',
      text: isEdit ? 'طبّقتُ التعديل وحدّثت المعاينة.' : (d.summary || 'التطبيق جاهزٌ للمعاينة.'),
      suggests: isEdit ? ['أحسنت — أضِف ميزة أخرى'] : ['أضِف فلتراً حسب المنطقة', 'غيّر تدرّج الألوان', 'أضِف لوحة مؤشّرات', 'صدّر PDF', 'أضِف بحثاً عن موقع'],
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
    setDatasets([]); setAttached([]); setIframeErr(''); setTplSearch('');
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

  const urlText = slug ? `${window.location.host}/pe/${slug}` : (html ? 'معاينة محليّة — انشر للحصول على رابط' : 'بانتظار التوليد…');
  const previewDoc = html ? injectCatcher(html) : '';
  const dsLabel = (k) => (k === 'arcgis' ? 'ESRI' : k === 'geotiff' ? 'TIF' : (k || 'DATA').toUpperCase());
  const dsIcon = (k) => (k === 'arcgis' ? 'GIS' : k === 'geotiff' ? 'TIF' : (k || 'D').slice(0, 4).toUpperCase());
  const dsMeta = (d) => {
    if (d.kind === 'arcgis') return `ArcGIS · ${d.feature_count} طبقة`;
    if (d.kind === 'geotiff') { const m = d.meta || {}; return `GeoTIFF · ${m.width || '?'}×${m.height || '?'} · ${m.bands || '?'} نطاق`; }
    const gt = d.meta && d.meta.geometryTypes ? Object.keys(d.meta.geometryTypes)[0]?.replace(/^Multi/, '') : null;
    const tiled = d.meta && d.meta.tiled ? ' · تايلز' : '';
    return `${(d.kind || '').toUpperCase()} · ${d.feature_count}${gt ? ` · ${gt}` : ''}${tiled}`;
  };
  const allChips = [...attached.map((k) => ({ k, t: SRC[k].t, n: SRC[k].n, kind: 'src' })), ...datasets.map((d) => ({ k: d.slug, t: dsLabel(d.kind), n: d.name, kind: 'ds' }))];

  /* =========================================================================== */
  return (
    <div className="pne-root" dir="rtl">
      <input ref={fileRef} type="file" accept=".geojson,.json,.csv,.tif,.tiff,.geotiff" hidden onChange={onFile} />
      <div className={`app ${collapsed ? 'collapsed' : ''}`}>

        {/* ============ SIDEBAR ============ */}
        <aside className="sidebar">
          <div className="brand" onClick={() => collapsed && setCollapsed(false)}>
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
            <a onClick={() => navigate('/palnovaa-engine/pricing')}>{Ico.rocket}<span>الأسعار والترقية</span></a>
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
            <div className="who"><b>PalNovaa 1.0</b><small>{balance ? `${balance.plan === 'pro' ? 'Pro' : 'مجّاني'} · بقي $${balance.remaining_usd}` : 'المحرّك الذكيّ'}</small></div>
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
                  <textarea value={prompt} maxLength={4000}
                    placeholder=""
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendHome(); } }} rows={3} />
                  <div className="composer-bar">
                    <button className="tool" data-menu-anchor onClick={(e) => openMenu('attach', e)}>{Ico.plus}البيانات</button>
                    <button className="tool" data-menu-anchor onClick={(e) => openMenu('mode', e)}>النوع: <span className="v">{mode}</span></button>
                    <button className="tool mono" data-menu-anchor onClick={(e) => openMenu('crs', e)}><span className="v">{crs}</span></button>
                    <button className="send" disabled={!prompt.trim() || busy} title="إرسال" onClick={sendHome}>{Ico.send}</button>
                  </div>
                </div>
                <div className="composer-foot"><span>Enter للإرسال · Shift+Enter لسطر جديد{prompt.length > 0 ? ` · ${prompt.length}/4000` : ''}</span><span>{balance ? `${balance.plan === 'pro' ? 'Pro' : 'مجّاني'} · رصيد $${balance.remaining_usd} من $${balance.allowance_usd}` : 'Leaflet · Turf · Chart.js · Papa Parse'}</span></div>

                <div className="block-title"><h3>بياناتك</h3><a onClick={() => fileRef.current?.click()}>رفع GeoJSON · CSV · GeoTIFF</a></div>
                <div className="sources">
                  <button className="source" onClick={() => fileRef.current?.click()}><span className="s-ic">{Ico.up}</span><span><b>رفع ملفّ</b><small>geojson · csv · tiff</small></span></button>
                  {myDatasets.slice(0, 4).map((d) => (
                    <button className="source" key={d.slug} onClick={() => attachDataset(d)}><span className="s-ic">{Ico.db}</span><span><b>{d.name}</b><small>{dsMeta(d)}</small></span><span className="st" /></button>
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
                        <p>استنفدتَ رصيدك المجّانيّ {balance ? `($${balance.allowance_usd})` : ''}. للمتابعة اشترك في <b>Pro</b> بـ<b>$5</b> وتفتح رصيداً أكبر، أو أضِف مفتاحك الخاصّ.</p>
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
            <button className="menu-item" onClick={() => { setMenu(null); fileRef.current?.click(); }}><span className="mi-ic">UP</span><span><b>رفع ملفّ بيانات</b><small>GeoJSON · CSV · GeoTIFF — كبيرها يُقسَّم تلقائياً</small></span></button>
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
            <button className="menu-item" onClick={() => { setMenu(null); fileRef.current?.click(); }}><span className="mi-ic">UP</span><span><b>رفع ملفّ جديد</b><small>geojson · csv · tiff</small></span></button>
            <button className="menu-item" onClick={openArcgis}><span className="mi-ic">GIS</span><span><b>ربط خادم ArcGIS REST</b><small>طبقات حيّة من GeoMOLG وغيره</small></span></button>
            <button className="menu-item" onClick={openHdx}><span className="mi-ic">HDX</span><span><b>بيانات HDX الإنسانيّة</b><small>بحث وتنزيل وإضافة — 256 مجموعة فلسطينيّة</small></span></button>
            {myDatasets.length === 0 && <div style={{ padding: '8px 10px', color: 'var(--faint)', fontSize: 12.5 }}>لا بيانات بعد</div>}
            {myDatasets.map((d) => (
              <div className="menu-item" key={d.slug}><span className="mi-ic">{dsIcon(d.kind)}</span><span onClick={() => attachDataset(d)} style={{ cursor: 'pointer', flex: 1 }}><b>{d.name}</b><small>{dsMeta(d)}</small></span>
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
