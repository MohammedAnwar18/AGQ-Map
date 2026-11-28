import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getImageUrl } from '../services/api';
import useEngineBranding from '../hooks/useEngineBranding';
import './PalNovaaEngine.css';

import {
  APPS_BASE, appLink, API, KEY_LS, KEY_THINK_LS, KEY_CODE_LS, authHeaders, jpost, jput, jget, jdel, MAPLIBS, ESRI_IMAGERY, GOOGLE_SAT, GOOGLE_SAT_SUBS, loadScript, loadCss, PROJ_DEFS, ensureProj4, ensureLeaflet, ensureGeoman, geoDist, lineLen, ringArea, fmtArea, fmtLen, ensureEsri, ensureVectorGrid, ensureGeoraster, SHP_URL, SQLJS_BASE, ensureShp, ensureSqlJs, ensureGdal, wkbToGeoJSON, gpkgGeom, dxfToGeoJSON, makeArcgisImageLayer, SRC, MODES, CRS, STEPS, STAGES, SICONS, TPL, Ico, TICONS, escapeHtml, mdToHtml, splitProjectFiles, FileIcon, HLJS_CSS, HLJS_JS, ensureHljs, injectCatcher, serializeThread
} from './engine/kit';

export default function PalNovaaEnginePage() {
  const navigate = useNavigate();
  const { user, updateUser, logout } = useAuth();
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
  const [files, setFiles] = useState(null);        // مشروعٌ موسّع: خريطة ملفّات {path: content} أو null (ملفٌّ واحد)
  const expanded = true;   // الوضع الموسّع صار أساس العمل: مشروعٌ متعدّد الملفّات دائماً
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
  const [liveDoc, setLiveDoc] = useState('');      // معاينةٌ تدريجيّة أثناء الكتابة
  const liveAt = useRef(0);
  const streamBufRef = useRef('');
  const flushSched = useRef(false);

  const [tplSearch, setTplSearch] = useState('');
  const [activeFile, setActiveFile] = useState('index.html');
  const [hljsReady, setHljsReady] = useState(false);
  const [pvKey, setPvKey] = useState(0);   // يُجبر المعاينة على التجدّد الفوري مع كلّ تغيير كود
  const [device, setDevice] = useState('desktop');  // معاينة متجاوبة: سطح مكتب/لوحيّ/جوّال
  const [drawer, setDrawer] = useState(false);       // الجوّال: القائمة الجانبيّة كدُرجٍ منزلق
  const [mobilePane, setMobilePane] = useState('chat'); // الجوّال: لوحٌ واحد (محادثة | معاينة)
  const [menu, setMenu] = useState(null);
  const [modal, setModal] = useState(null);
  const [pg, setPg] = useState({ host: '', db: '' });
  const [toast, setToast] = useState('');

  /* الإعدادات: الملفّ الشخصيّ مرتبطٌ بالحساب الأساسيّ؛ لون الخلفية يُحفظ على الجهاز */
  const ls = (k, d = '') => { try { return localStorage.getItem(k) || d; } catch { return d; } };
  const [nameDraft2, setNameDraft2] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);     // صورةٌ قيد الرفع
  const [avatarPreview, setAvatarPreview] = useState('');  // معاينةٌ فوريّة (dataURL)
  const [savingProf, setSavingProf] = useState(false);
  const [bgColor, setBgColor] = useState(() => ls('pne-bg'));
  const avatarRef = useRef(null);
  const homeTaRef = useRef(null);
  const chatTaRef = useRef(null);
  const fitTa = (el) => { if (el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 340) + 'px'; } };
  const acctPic = getImageUrl(user?.profile_picture) || '';
  const displayName = userName || '';
  const avatarUrl = avatarPreview || acctPic;
  const avInitials = (displayName ? displayName.trim().slice(0, 2) : (user?.username || 'PN').slice(0, 2));
  const updBg = (v) => { setBgColor(v); try { v ? localStorage.setItem('pne-bg', v) : localStorage.removeItem('pne-bg'); } catch { /* */ } };
  /* صارت صفحةً كاملةً بدل النافذة — نفسُ الحالة ونفسُ المعالجات. */
  const openSettings = () => { setNameDraft2(userName || ''); setAvatarFile(null); setAvatarPreview(''); setDrawer(false); setView('settings'); };
  const onAvatar = (e) => {
    const f = e.target.files?.[0];
    if (f) {
      if (!/^image\//.test(f.type)) showToast('اختر ملفّ صورة');
      else if (f.size > 10e6) showToast('الصورة كبيرة — حتى 10MB');
      else { setAvatarFile(f); const r = new FileReader(); r.onload = () => setAvatarPreview(String(r.result)); r.readAsDataURL(f); }
    }
    e.target.value = '';
  };
  const profDirty = (nameDraft2.trim() && nameDraft2.trim() !== (userName || '')) || !!avatarFile;
  const saveProfile = async () => {
    if (!profDirty || savingProf) return;
    setSavingProf(true);
    try {
      const fd = new FormData();
      if (nameDraft2.trim() && nameDraft2.trim() !== (userName || '')) fd.append('full_name', nameDraft2.trim());
      if (avatarFile) fd.append('profile_picture', avatarFile);
      const tok = localStorage.getItem('token');
      const res = await fetch(`${API}/users/profile`, { method: 'PUT', headers: tok ? { Authorization: `Bearer ${tok}` } : {}, body: fd });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.user) {
        updateUser({ full_name: d.user.full_name, profile_picture: d.user.profile_picture });
        setAvatarFile(null); setAvatarPreview('');
        showToast('حُفظ الملفّ الشخصيّ ✓');
      } else showToast(d.error || 'تعذّر حفظ الملفّ');
    } catch { showToast('تعذّر الاتصال بالخادم'); }
    setSavingProf(false);
  };
  /* عدّاد التوكينز — الحساب المجّانيّ: ميزانيّة 110 ألف توكن (تقديريّة، تُضبط لاحقاً) */
  const FREE_TOKENS = 110000;
  const tokMeter = balance ? (() => {
    const pro = balance.plan === 'pro';
    const frac = balance.allowance_usd > 0 ? Math.min(1, (balance.used_usd || 0) / balance.allowance_usd) : 0;
    return { pro, frac, used: Math.round(frac * FREE_TOKENS), budget: FREE_TOKENS, usd: balance.used_usd || 0 };
  })() : null;
  const BG_PRESETS = [
    { k: '', c: '#0A0B0D', n: 'افتراضيّ' },
    { k: '#0E1116', c: '#0E1116', n: 'رماديّ داكن' },
    { k: '#0B1220', c: '#0B1220', n: 'أزرق ليليّ' },
    { k: '#0A1410', c: '#0A1410', n: 'أخضر غابيّ' },
    { k: '#140A10', c: '#140A10', n: 'نبيذيّ' },
    { k: '#0E0A1A', c: '#0E0A1A', n: 'نيليّ' },
    { k: '#140F08', c: '#140F08', n: 'كهرمانيّ' },
    { k: '#000000', c: '#000000', n: 'فحميّ' },
  ];
  useEffect(() => { fitTa(homeTaRef.current); }, [prompt]);
  useEffect(() => { fitTa(chatTaRef.current); }, [prompt2]);

  /* نافذة ترحيبٍ تظهر مرّةً واحدة لكلّ مستخدمٍ عند أوّل دخولٍ للمحرّك */
  const [showWelcome, setShowWelcome] = useState(false);
  const welcomeKey = `pne_welcome_${user?.id || user?.userId || user?.username || 'guest'}`;
  useEffect(() => {
    if (!user) return;
    try { if (!localStorage.getItem(welcomeKey)) setShowWelcome(true); } catch { /* */ }
  }, [user, welcomeKey]);
  const closeWelcome = () => { setShowWelcome(false); try { localStorage.setItem(welcomeKey, '1'); } catch { /* */ } };

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
  const [arcIng, setArcIng] = useState(null);       // معرّف الطبقة قيد السحب والتخزين عندي
  const [arcWhere, setArcWhere] = useState('');      // فلتر اختياريّ (where) للسحب الجزئيّ
  /* لوحة الاستعلام: نرى ماذا سنسحب قبل أن نسحبه — حقولٌ وعدٌّ وقيمٌ فريدة */
  const [arcQL, setArcQL] = useState(null);          // رقم الطبقة التي فُتحت لوحتُها
  const [arcMeta, setArcMeta] = useState({});        // layerId → { fields, geometryType, total }
  const [arcQBusy, setArcQBusy] = useState('');      // 'meta' | 'count' | 'values'
  const [arcCnt, setArcCnt] = useState(null);        // { id, n } نتيجة آخر عدّ
  const [arcVals, setArcVals] = useState(null);      // { field, values }
  const [arcField, setArcField] = useState('');      // الحقل المختار لجلب قيمه
  const [arcPick, setArcPick] = useState([]);        // القيم المحدَّدة من الحقل
  const [arcVFilter, setArcVFilter] = useState('');  // بحثٌ داخل القيم

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

  /* «بناء البيانات» صار صفحةً مستقلّة: PalNovaaDataBuilderPage (راوت /palnovaa-engine/data) لتخفيف هذه الصفحة وتسريعها. */

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
  const [dragOver, setDragOver] = useState(false);   // مكتبة البيانات: إبرازُ منطقة الإفلات
  const loadProjects = useCallback(() => { jget('/engine/projects').then((d) => { if (d?.ok) setProjects(d.projects || []); }).catch(() => {}); }, []);
  const loadDatasets = useCallback(() => { jget('/engine/datasets').then((d) => { if (d?.ok) setMyDatasets(d.datasets || []); }).catch(() => {}); }, []);
  const loadBalance = useCallback(() => { jget('/engine/balance').then((d) => { if (d?.ok) setBalance(d.balance); }).catch(() => {}); }, []);
  const loadTemplates = useCallback(() => { jget('/engine/templates').then((d) => { if (d?.ok && d.templates?.length) setTemplates(d.templates); }).catch(() => {}); }, []);
  useEffect(() => { loadProjects(); loadDatasets(); loadBalance(); loadTemplates(); }, [loadProjects, loadDatasets, loadBalance, loadTemplates]);

  /* فهرسة محركات البحث: عنوانٌ ووصفٌ وبياناتٌ منظّمة خاصّة بصفحة المحرّك، تُستعاد عند المغادرة */
  useEffect(() => {
    const TITLE = 'PalNovaa Engine — بناء تطبيقات GIS بالذكاء الاصطناعيّ';
    const DESC = 'PalNovaa Engine: مولّد تطبيقات خرائط ونظم معلومات جغرافيّة (GIS) بالذكاء الاصطناعيّ. صِف فكرتك بالعربيّة فيبني لك تطبيق ويب تفاعليّاً بخرائط وبيانات حقيقيّة (GeoMOLG، GeoJSON، ArcGIS) بلا كتابة كود.';
    const prevTitle = document.title;
    document.title = TITLE;
    const restorers = [];
    const upsert = (attr, key, val) => {
      let el = document.head.querySelector(`meta[${attr}="${key}"]`); let created = false;
      if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el); created = true; }
      const prev = el.getAttribute('content'); el.setAttribute('content', val);
      restorers.push(() => { if (created) el.remove(); else if (prev != null) el.setAttribute('content', prev); });
    };
    upsert('name', 'description', DESC);
    upsert('property', 'og:title', TITLE); upsert('property', 'og:description', DESC);
    upsert('name', 'twitter:title', TITLE); upsert('name', 'twitter:description', DESC);
    const origin = (typeof location !== 'undefined' && location.origin) ? location.origin : '';
    const ld = document.createElement('script'); ld.type = 'application/ld+json'; ld.id = 'pne-ld';
    ld.textContent = JSON.stringify({
      '@context': 'https://schema.org', '@type': 'WebApplication',
      name: 'PalNovaa Engine', alternateName: 'محرّك بالنوفا', inLanguage: 'ar',
      applicationCategory: 'DesignApplication', operatingSystem: 'Web',
      url: origin + '/palnovaa-engine', description: DESC,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      publisher: { '@type': 'Organization', name: 'PalNovaa' },
    });
    document.head.appendChild(ld);
    return () => { document.title = prevTitle; restorers.forEach((f) => f()); ld.remove(); };
  }, []);

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
  /* File Geodatabase وغيرها → GeoJSON داخل المتصفّح عبر GDAL/WASM.
     التحويل كلّه على جهاز المستخدم: لا يُرفَع الملفّ الخام إطلاقاً، بل الطبقات
     الناتجة فقط — وهذا هو مصدر السرعة مع الملفّات الضخمة. */
  const handleGdal = async (f, name) => {
    showToast('جارٍ تحضير محرّك GDAL (تحميلٌ لمرّةٍ واحدة)…');
    const Gdal = await ensureGdal();
    showToast('جارٍ قراءة الملفّ…');
    const res = await Gdal.open(f);
    const datasets = res?.datasets || [];
    if (!datasets.length) throw new Error('لم يتعرّف GDAL على أيّ بيانات في الملفّ');

    const emit = async (ds, layerName, label) => {
      const opts = ['-f', 'GeoJSON', '-t_srs', 'EPSG:4326'];
      if (layerName) opts.push(layerName);
      const out = await Gdal.ogr2ogr(ds, opts);
      const bytes = await Gdal.getFileBytes(out);
      const txt = new TextDecoder('utf-8').decode(bytes);
      let fc = null; try { fc = JSON.parse(txt); } catch { return null; }
      if (!fc || !Array.isArray(fc.features) || !fc.features.length) return null;
      return addDatasetResult(await uploadText(String(label).slice(0, 120), 'geojson', JSON.stringify(fc)));
    };

    let count = 0, last = null;
    for (const ds of datasets) {
      let layers = [];
      try { const info = await Gdal.getInfo(ds); layers = (info && info.layers) || []; } catch { /* */ }
      if (layers.length > 1) {
        for (const ly of layers) {
          const ln = ly && (ly.name || ly.layerName);
          if (!ln) continue;
          const d = await emit(ds, ln, `${name} · ${ln}`);
          if (d) { last = d; count++; }
        }
      } else {
        const ln = layers[0] && (layers[0].name || layers[0].layerName);
        const d = await emit(ds, null, ln ? `${name} · ${ln}` : name);
        if (d) { last = d; count++; }
      }
    }
    try { await Gdal.close(); } catch { /* */ }
    if (!count) throw new Error('لا طبقاتٍ متجهيّةً صالحةً في الملفّ');
    showToast(count === 1 ? `أُضيفت «${last.name}» (${last.feature_count} عنصر)` : `أُضيفت ${count} طبقات من الملفّ`);
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
      } else if (ext === 'gdb') {
        await handleGdal(f, name);               // File Geodatabase (مضغوطة)
      } else if (ext === 'kml' || ext === 'kmz' || ext === 'gml' || ext === 'tab' || ext === 'fgb') {
        await handleGdal(f, name);               // صيغٌ يقرؤها GDAL وحده
      } else if (ext === 'zip' || ext === 'shp') {
        // الشيب فايل أوّلاً بالمكتبة الخفيفة؛ وإن لم يكن شيب فايل (قد يكون
        // Geodatabase مضغوطة) نتراجع إلى GDAL بدل أن نفشل.
        try { await handleShapefile(f, name); }
        catch (shpErr) {
          if (ext === 'shp') throw shpErr;
          showToast('ليس Shapefile — أُجرّب قراءته بـGDAL…');
          await handleGdal(f, name);
        }
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
    if (d.files && typeof d.files === 'object') setFiles(d.files); else if (!isEdit) setFiles(null);
    setDirty(true); if (d.balance) setBalance(d.balance); setTab('app'); setMobilePane('preview');
    setMessages((m) => m.map((x) => (x.id === `b${bId}` ? { ...x, progress: STEPS.length, state: 'done', stage: null, done: STAGES.map((g) => g.id), usage: d.usage, elapsed: d.elapsed, model: d.model } : x)));
    const diffFailed = isEdit && (d.mode === 'files-noop' || (d.mode === 'diff' && !d.applied));
    const isDiff = d.mode === 'diff' || d.mode === 'files-diff';
    setMessages((m) => [...m, {
      id: `n${bId}`, role: 'ai', kind: 'note',
      text: diffFailed
        ? 'لم أتمكّن من تحديد موضع التعديل بدقّة فأبقيتُ التطبيق كما هو دون أيّ تغيير. أعِد صياغة الطلب بوضوحٍ أكبر (مثلاً: اذكر اسم الزرّ أو الجزء أو نصّ رسالة الخطأ).'
        : (isEdit ? (isDiff ? `طبّقتُ التعديل بدقّةٍ وسرعة (${d.applied} تغيير موضعيّ) دون المساس ببقيّة الكود.` : 'طبّقتُ التعديل وحدّثت المعاينة.') : (d.summary || 'التطبيق جاهزٌ للمعاينة.')),
    }]);
    showToast(diffFailed ? 'لم يُطبَّق التعديل — أعِد الصياغة' : (isEdit ? (isDiff ? 'تعديلٌ فوريّ ✓' : 'تمّ التعديل ✓') : 'تمّ البناء ✓ — المعاينة جاهزة'));
  };
  const finishError = (reason, isEdit, bId) => {
    const text = reason === '__missing'
      ? 'لا يوجد مفتاح موديل على الخادم. اضبط PALNOVAA_CLAUDE_KEY أو PALNOVAA_GEMINI_KEY في بيئة النشر.'
      : (reason || 'تعذّر التوليد.');
    setMessages((m) => m.map((x) => (x.id === `b${bId}` ? { ...x, state: 'error' } : x)));
    setMessages((m) => [...m, { id: `e${bId}${Math.random().toString(36).slice(2, 5)}`, role: 'err', text }]);
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
          else if (ev.type === 'stage') {
            // مرحلةٌ حقيقيّة من الخادم: تُعلَّم السابقةُ منتهيةً وتُفتَح الحاليّة
            setMessages((m) => m.map((x) => {
              if (x.id !== `b${bId}`) return x;
              const i = STAGES.findIndex((g) => g.id === ev.id);
              const done = i > 0 ? STAGES.slice(0, i).map((g) => g.id) : [];
              return { ...x, stage: ev.id, done };
            }));
          }
          else if (ev.type === 'think') { /* إشارةُ تفكيرٍ فقط — لا يُعرَض نصّه */ }
          else if (ev.type === 'plan') {
            setMessages((m) => m.map((x) => (x.id === `b${bId}` ? { ...x, plan: ev.text || '' } : x)));
          }
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
    setBusy(true); setView('workspace'); setIframeErr('');
    if (!isEdit) setTitle(rawText.trim().slice(0, 48));

    const chipsSnap = isEdit ? [] : [...attached];
    const dsSnap = isEdit ? [] : datasets.map((d) => ({ slug: d.slug, name: d.name }));
    const bId = ++buildIdRef.current;
    setMessages((m) => [...m,
      { id: `u${bId}`, role: 'user', text: rawText.trim(), chips: chipsSnap, ds: dsSnap },
      { id: `b${bId}`, role: 'ai', kind: 'build', progress: 0, state: 'running', stage: 'think', done: [], think: '' },
    ]);
    setTab('app');

    // لا مؤقّتٌ وهميّ: المراحل تُدفَع من الخادم عبر أحداث SSE (stage/think).
    // يبقى مؤقّتٌ احتياطيٌّ واحدٌ فقط لمسار عدم البثّ، ينقل المرحلة إلى «كتابة الكود».
    timerRef.current = setTimeout(() => {
      setMessages((m) => m.map((x) => (x.id === `b${bId}` && x.state === 'running' && x.stage === 'think'
        ? { ...x, stage: 'code', done: ['think', 'skills'] } : x)));
    }, 2600);

    // الوضع الموسّع: مشروعٌ جديد إن فُعّل، أو تعديلُ مشروعٍ موسّعٍ قائم (نرسل ملفّاته)
    const useExpanded = expanded || (isEdit && !!files);
    const body = { prompt: withContext(rawText), currentHtml: isEdit ? html : '', datasets: datasets.map((x) => x.slug), origin: window.location.origin, expanded: useExpanded, files: (isEdit && files) ? files : undefined };
    try {
      const handled = await tryStream(body, bId, isEdit);
      if (!handled) await nonStream(body, bId, isEdit);
    } finally {
      clearTimeout(timerRef.current);
      setBusy(false); setStreamCode(''); streamBufRef.current = ''; setLiveDoc(''); liveAt.current = 0;
    }
  };

  const resetHeal = () => { autoHealRef.current = { tries: 0, lastErr: '' }; };
  const enhancePrompt = async () => {
    const base = prompt.trim();
    if (!base) { showToast('اكتب فكرةً مختصرةً أولاً'); return; }
    if (enhancing || busy) return;
    setEnhancing(true);
    try {
      const d = await jpost('/engine/enhance', { prompt: base });
      if (d?.ok && d.prompt) { setPrompt(d.prompt); showToast('حُسّن الوصف ✨ — عدّله أو ابنِ مباشرةً'); }
      else showToast(d?.reason === 'missing_key' ? 'لا يوجد مفتاح موديل على الخادم' : 'تعذّر التحسين، جرّب مجدّداً');
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
    if (slug) res = await jput(`/engine/projects/${slug}`, { html, title, summary, thread: serializeThread(messagesRef.current), files: files || undefined });
    else res = await jpost('/engine/projects', { title, summary, html, thread: serializeThread(messagesRef.current), files: files || undefined });
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
    setView('home'); setMessages([]); setHtml(''); setFiles(null); setTitle('محادثة جديدة'); setSummary('');
    setSlug(null); setPublicUrl(''); setDirty(false); setPrompt(''); setPrompt2(''); setMenu(null);
    setDatasets([]); setAttached([]); setIframeErr(''); setTplSearch(''); resetHeal();
  };
  const openProject = async (p) => {
    setMenu(null); setDrawer(false);
    // فتحٌ متفائل: التبديل والاسم والمعاينة (بمؤشّر تحميل) فوراً، ثمّ يُملأ المحتوى عند وصوله — إحساسٌ فوريّ
    setView('workspace'); setTab('app');
    setSlug(p.slug); setTitle(p.title || 'مشروع'); setHtml(''); setFiles(null); setSummary('');
    setDirty(false); setIframeErr(''); resetHeal();
    setMessages([{ id: `load${p.slug}`, role: 'ai', kind: 'note', text: 'جارٍ فتح المشروع…', suggests: [] }]);
    try {
      const d = await jget(`/engine/projects/${p.slug}`);
      if (d?.ok) {
        setHtml(d.project.html); setTitle(d.project.title); setSummary(d.project.summary || '');
        const pf = d.project.files && typeof d.project.files === 'object' ? d.project.files : null; setFiles(pf);
        setPublicUrl(d.project.public_url || '');
        const thread = Array.isArray(d.project.thread) ? d.project.thread : null;
        setMessages(thread && thread.length ? thread : [{ id: `open${p.slug}`, role: 'ai', kind: 'note', text: `فُتح المشروع: ${d.project.title}. تابع التعديل أو افتح الرابط الدائم.`, suggests: [] }]);
      } else setMessages([{ id: `e${p.slug}`, role: 'err', text: 'تعذّر فتح المشروع — حدّث الصفحة وحاول ثانيةً.' }]);
    } catch { setMessages([{ id: `e${p.slug}`, role: 'err', text: 'تعذّر الاتصال بالخادم.' }]); }
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
    if (d?.ok) { setHtml(d.project.html); setFiles(null); setTitle(d.project.title); setSummary(d.project.summary || ''); if (d.project.public_url) setPublicUrl(d.project.public_url); setIframeErr(''); showToast('استُرجعت النسخة'); }
    else showToast('تعذّر الاسترجاع');
  };


  /* ---- ArcGIS REST ---- */
  const openArcgis = () => { setMenu(null); setArcData(null); setArcSel([]); setArcStack([]); setArcErr(''); setArcFilter(''); setArcWhere(''); setArcQL(null); setArcCnt(null); setArcVals(null); setArcField(''); setArcUrl(ARCGIS_DEFAULT); setModal('arcgis'); };
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
  /* ---- لوحة الاستعلام على طبقة ArcGIS ---- */
  const arcQParams = (layer) => `url=${encodeURIComponent(arcData.url)}&layer=${layer.id}`;

  const openArcQ = async (layer) => {
    if (arcQL === layer.id) { setArcQL(null); return; }
    setArcQL(layer.id); setArcCnt(null); setArcVals(null); setArcField(''); setArcPick([]); setArcVFilter('');
    if (arcMeta[layer.id]) return;
    setArcQBusy('meta');
    try {
      const d = await jget(`/engine/arcgis/layer?${arcQParams(layer)}`);
      if (d?.ok) {
        const c = await jget(`/engine/arcgis/count?${arcQParams(layer)}&where=1%3D1`).catch(() => null);
        setArcMeta((m) => ({ ...m, [layer.id]: { fields: d.fields || [], geometryType: d.geometryType, total: c?.ok ? c.count : null } }));
      } else showToast(d?.reason || 'تعذّر قراءة حقول الطبقة');
    } catch { showToast('تعذّر الاتصال بالخادم'); }
    setArcQBusy('');
  };

  const arcCountNow = async (layer) => {
    setArcQBusy('count'); setArcCnt(null);
    try {
      const d = await jget(`/engine/arcgis/count?${arcQParams(layer)}&where=${encodeURIComponent(arcEffWhere())}`);
      if (d?.ok) setArcCnt({ id: layer.id, n: d.count });
      else showToast(d?.reason || 'استعلامٌ غير صالح');
    } catch { showToast('تعذّر الاتصال بالخادم'); }
    setArcQBusy('');
  };

  const arcLoadVals = async (layer, field) => {
    if (!field) return;
    setArcQBusy('values'); setArcVals(null);
    try {
      const d = await jget(`/engine/arcgis/values?${arcQParams(layer)}&field=${encodeURIComponent(field)}`);
      if (d?.ok) setArcVals({ field, values: d.values || [] });
      else showToast(d?.reason || 'تعذّر جلب القيم');
    } catch { showToast('تعذّر الاتصال بالخادم'); }
    setArcQBusy('');
  };

  // إدراجٌ بالنقر: اسمُ حقلٍ في صندوق الفلتر اليدويّ
  const arcInsert = (txt) => setArcWhere((w) => (w.trim() ? `${w.trim()} AND ${txt}` : txt));

  /* الفلتر الفعّال = ما كتبتَه يدويّاً + شرطُ القيم التي حدّدتَها.
     يُستعمل في العدّ والتنزيل والعرض، ويُعرَض للمستخدم كما سيُرسَل تماماً. */
  const arcValClause = () => {
    if (!arcVals || !arcPick.length) return '';
    const esc = (v) => String(v).replace(/'/g, "''");
    return arcPick.length === 1
      ? `${arcVals.field}='${esc(arcPick[0])}'`
      : `${arcVals.field} IN (${arcPick.map((v) => `'${esc(v)}'`).join(', ')})`;
  };
  const arcEffWhere = () => {
    const parts = [(arcWhere || '').trim(), arcValClause()].filter(Boolean);
    return parts.length ? parts.map((p) => (parts.length > 1 ? `(${p})` : p)).join(' AND ') : '1=1';
  };
  const togglePick = (v) => setArcPick((a) => (a.includes(v) ? a.filter((x) => x !== v) : [...a, v]));

  const downloadArcLayer = async (layer) => {
    if (!arcData || arcDl !== null) return;
    const base = `${arcData.url}/${layer.id}/query`;
    setArcDl(layer.id); showToast(`جارٍ تنزيل «${layer.name}»…`);
    try {
      let offset = 0, all = [], guard = 0;
      while (guard++ < 120) {
        const u = `${base}?where=${encodeURIComponent(arcEffWhere())}&outFields=*&outSR=4326&f=geojson&returnGeometry=true&resultOffset=${offset}&resultRecordCount=2000`;
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
  // «اسحب وخزّن عندي»: نفس الترقيم المُثبَت، لكن بدل التنزيل نخزّن الطبقة مملوكةً كـGeoJSON (تقطيعٌ تلقائيّ للكبير)
  const ingestArcLayer = async (layer, arcShow) => {
    if (!arcData || arcIng !== null || arcDl !== null) return;
    const base = `${arcData.url}/${layer.id}/query`;
    const whereRaw = arcEffWhere();
    const whereEnc = encodeURIComponent(whereRaw);
    setArcIng(layer.id); showToast(`جارٍ سحب «${layer.name}» وتخزينها عندك…`);
    try {
      let offset = 0, all = [], guard = 0;
      while (guard++ < 200) {
        const u = `${base}?where=${whereEnc}&outFields=*&outSR=4326&f=geojson&returnGeometry=true&resultOffset=${offset}&resultRecordCount=2000`;
        const r = await fetch(u);
        const j = await r.json();
        if (j.error) throw new Error(j.error.message || 'خطأ من الخادم');
        const feats = j.features || [];
        all = all.concat(feats);
        const more = j.exceededTransferLimit || j.properties?.exceededTransferLimit;
        if (!more || feats.length === 0) break;
        offset += feats.length;
        if (all.length > 400000) break;   // سقف أمان
      }
      if (!all.length) { showToast('لا معالم في هذه الطبقة لهذا الفلتر'); setArcIng(null); return; }
      const fc = { type: 'FeatureCollection', features: all };
      const name = `${String(arcData.name).split('/').pop()} · ${layer.name}`.slice(0, 120);
      const res = await jpost('/engine/arcgis/ingest', {
        name, content: JSON.stringify(fc),
        source: { serviceUrl: arcData.url, serviceType: arcData.serviceType, layerId: layer.id, where: whereRaw },
      });
      if (res?.ok) {
        setMyDatasets((a) => [res.dataset, ...a]); attachDataset(res.dataset);
        showToast(`خُزّنت «${layer.name}» عندك (${all.length} معلم${res.tiled ? ' · تايلز ذكيّة' : ''})`);
        if (arcShow) { setModal(null); openExplorer(res.dataset); }
      } else showToast(res?.reason || 'تعذّر التخزين');
    } catch (e) { showToast(`تعذّر السحب: ${String(e.message || e).slice(0, 70)}`); }
    setArcIng(null);
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

  // المفاتيح صارت على الخادم حصراً — نمسح أيّ مفتاحٍ قديمٍ بقي على الجهاز
  useEffect(() => {
    try { [KEY_LS, KEY_THINK_LS, KEY_CODE_LS].forEach((k) => localStorage.removeItem(k)); } catch { /* */ }
  }, []);

  /* المعاينة التدريجيّة: المشروع يصل بصيغة أقسامٍ «===FILE: path===»، فنُجمّعه
     لحظةً بلحظة — ندمج ما وصل من CSS/JS داخل index.html (مع إبقاء روابط CDN كما
     هي)، ثمّ نُغلق المستند الجزئيّ إغلاقاً آمناً كي يرسمه المتصفّح وهو يُكتَب. */
  useEffect(() => {
    if (!busy || streamCode.length < 400) return;
    if (Date.now() - liveAt.current < 700) return;   // إعادة رسمٍ كلّ 0.7s لا كلّ إطار
    liveAt.current = Date.now();

    const parts = streamCode.split(/^===FILE:\s*(.+?)\s*===\s*$/m);
    const files = {};
    for (let i = 1; i < parts.length; i += 2) files[parts[i].trim()] = parts[i + 1] || '';

    let h = files['index.html'];
    if (!h) h = /<html|<!doctype/i.test(streamCode) ? streamCode : '';
    if (!h) return;

    // ادمج الملفّات المحلّيّة التي وصلت؛ وما لم يصل بعد يبقى وسمُه كما هو
    h = h.replace(/<link[^>]+href=["']([^"']+\.css)["'][^>]*>/gi, (mm, p) => (files[p] ? '<style>\n' + files[p] + '\n</style>' : mm));
    h = h.replace(/<script[^>]+src=["']([^"']+\.js)["'][^>]*><\/script>/gi, (mm, p) => (files[p] ? '<script>\n' + files[p] + '\n</script>' : mm));

    const lt = h.lastIndexOf('<');
    if (lt > h.lastIndexOf('>')) h = h.slice(0, lt);   // اقطع آخر وسمٍ ناقص
    const cnt = (re) => (h.match(re) || []).length;
    if (cnt(/<script\b/gi) > cnt(/<\/script\s*>/gi)) h += '\n</script>';
    if (cnt(/<style\b/gi) > cnt(/<\/style\s*>/gi)) h += '\n</style>';
    if (!/<\/body\s*>/i.test(h)) h += '\n</body>';
    if (!/<\/html\s*>/i.test(h)) h += '\n</html>';
    setLiveDoc(h);
  }, [streamCode, busy]);
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

  /* عرضٌ فقط — لا يمسّ أيّ منطق: زمنٌ نسبيّ مختصر، ومجموعُ معالم الطبقات. */
  const sinceTxt = (d) => {
    const ms = Date.now() - new Date(d).getTime();
    if (!isFinite(ms) || ms < 0) return '';
    const mi = Math.floor(ms / 60000);
    if (mi < 1) return 'الآن';
    if (mi < 60) return `قبل ${mi} دقيقة`;
    const h = Math.floor(mi / 60);
    if (h < 24) return `قبل ${h} ساعة`;
    const dd = Math.floor(h / 24);
    if (dd < 30) return `قبل ${dd} يوم`;
    return `قبل ${Math.floor(dd / 30)} شهر`;
  };
  const totalFeatures = myDatasets.reduce((a, d) => a + (Number(d.feature_count) || 0), 0);
  const fmtBytes = (b) => {
    const v = Number(b) || 0;
    if (!v) return '—';
    if (v < 1024) return `${v} B`;
    if (v < 1048576) return `${(v / 1024).toFixed(1)} KB`;
    if (v < 1073741824) return `${(v / 1048576).toFixed(1)} MB`;
    return `${(v / 1073741824).toFixed(2)} GB`;
  };
  const totalBytes = myDatasets.reduce((a, d) => a + (Number(d.meta && d.meta.bytes) || 0), 0);
  const nfmt = (v) => (Number(v) || 0).toLocaleString('en-US');

  /* أيقوناتُ اللوح الجانبيّ — مسارات lucide الأصليّة بمقاس 16 وسماكة 2
     وأطرافٍ مستديرة، كما في المرجع تماماً. منفصلةٌ عن Ico المشتركة عمداً. */
  const NAVI = (() => {
    const w = (children) => (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
    );
    return {
      plus: w(<><path d="M5 12h14" /><path d="M12 5v14" /></>),
      compass: w(<><circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" /></>),
      database: w(<><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5V19A9 3 0 0 0 21 19V5" /><path d="M3 12A9 3 0 0 0 21 12" /></>),
      map: w(<><path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z" /><path d="M15 5.764v15" /><path d="M9 3.236v15" /></>),
      layers: w(<><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" /><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" /><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" /></>),
      dollar: w(<><circle cx="12" cy="12" r="10" /><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" /><path d="M12 18V6" /></>),
      card: w(<><rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" x2="22" y1="10" y2="10" /></>),
      book: w(<><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></>),
      user: w(<><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>),
      key: w(<><path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4" /><path d="m21 2-9.6 9.6" /><circle cx="7.5" cy="15.5" r="5.5" /></>),
      gauge: w(<><path d="m12 14 4-4" /><path d="M3.34 19a10 10 0 1 1 17.32 0" /></>),
      palette: w(<><circle cx="13.5" cy="6.5" r=".5" fill="currentColor" /><circle cx="17.5" cy="10.5" r=".5" fill="currentColor" /><circle cx="8.5" cy="7.5" r=".5" fill="currentColor" /><circle cx="6.5" cy="12.5" r=".5" fill="currentColor" /><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" /></>),
      logout: w(<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" /></>),
      save: w(<><path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" /><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7" /><path d="M7 3v4a1 1 0 0 0 1 1h7" /></>),
      gear: w(<><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></>),
    };
  })();

  /* =========================================================================== */
  return (
    <div className="pne-root" dir="rtl" style={bgColor ? { '--bg': bgColor } : undefined}>
      <input ref={fileRef} type="file" accept=".geojson,.json,.csv,.tif,.tiff,.geotiff,.zip,.shp,.gdb,.gpkg,.kml,.kmz,.gml,.tab,.fgb,.dxf,.dwg" hidden onChange={onFile} />
      <input ref={avatarRef} type="file" accept="image/*" hidden onChange={onAvatar} />
      <div className={`app ${collapsed ? 'collapsed' : ''} ${view === 'home' || view === 'data' || view === 'settings' ? 'lite' : ''}`}>

        {/* ============ SIDEBAR ============ */}
        {drawer && <div className="nav-scrim" onClick={() => setDrawer(false)} />}
        <aside className={`sidebar ${drawer ? 'open' : ''}`}>
          <div className="brand" onClick={() => collapsed && setCollapsed(false)}>
            <span className="brand-mark">
              {/* شعارُ محرّك بالنوفا الأصليّ — حرفُ الـP المزدوج على بلاطةٍ برتقاليّة */}
              <svg viewBox="0 0 512 512" width="28" height="28" aria-hidden="true">
                <rect width="512" height="512" rx="118" fill="#E07B39" />
                <g transform="translate(79.2 89.6) scale(5.2)" fill="none" strokeWidth="5" strokeLinecap="round">
                  <path d="M14 58V6h19a20 20 0 0 1 0 40H14" stroke="#1A0D04" strokeLinejoin="round" />
                  <path d="M23 15.5h10a10.5 10.5 0 0 1 0 21H23" stroke="#1A0D04" />
                  <circle cx="33" cy="26" r="2.8" fill="#1A0D04" stroke="none" />
                </g>
              </svg>
            </span>
            <div className="brand-name">PalNovaa <span>Engine</span></div>
            <button className="collapse-btn" title="طيّ القائمة" onClick={(e) => { e.stopPropagation(); setCollapsed(true); }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M15 4v16" /></svg>
            </button>
          </div>
          {/* صفٌّ واحدٌ لكلّ بند — لا زرَّ شاذًّا عن الإيقاع، كما في المرجع. */}
          <nav className="nav" onClick={() => setDrawer(false)}>
            <div className="nav-sec">البناء</div>
            <a className="nav-lead" onClick={() => newProject()}>{NAVI.plus}<span>مشروع جديد</span></a>
            <a className={view === 'home' ? 'active' : ''} onClick={() => setView('home')}>{NAVI.compass}<span>المحادثات</span></a>

            <div className="nav-sec">البيانات</div>
            <a className={view === 'data' ? 'active' : ''} onClick={() => setView('data')}>{NAVI.database}<span>مكتبة البيانات</span><span className="count">{myDatasets.length || ''}</span></a>
            <a className={explorerOpen ? 'active' : ''} onClick={() => openExplorer()}>{NAVI.map}<span>معاينة البيانات</span></a>
            <a onClick={() => navigate('/palnovaa-engine/data')} title="يفتح في صفحةٍ مستقلّة أسرع — مشبوكة ببياناتك">{NAVI.layers}<span>بناء البيانات</span></a>

            <div className="nav-sec">الحساب</div>
            <a onClick={() => navigate('/palnovaa-engine/pricing')}>{NAVI.dollar}<span>الأسعار والترقية</span></a>
            {user?.role === 'admin' && <a onClick={() => navigate('/palnovaa-engine/payments')}>{NAVI.card}<span>إدارة الدفع</span></a>}

            <div className="nav-sec">المرجع</div>
            <a onClick={openDocsCenter}>{NAVI.book}<span>المستندات</span></a>
            <a className={view === 'settings' ? 'active' : ''} onClick={openSettings}>{NAVI.gear}<span>الإعدادات</span></a>
          </nav>
          <div className="side-section">مشاريعي</div>
          <div className="history" onClick={() => setDrawer(false)}>
            {projects.length === 0 && <div className="empty">لا مشاريع بعد</div>}
            {projects.map((p) => (
              <a key={p.slug} className={`hist-item ${slug === p.slug ? 'active' : ''}`} title={p.title} onClick={() => openProject(p)}>
                <span className="dot" style={{ background: 'var(--ok)' }} /><span className="hist-title">{p.title}</span>
                <button className="hist-del" title="حذف" onClick={(e) => deleteProject(p, e)}>{Ico.trash}</button>
              </a>
            ))}
          </div>
          <button className="side-foot" title="الإعدادات والملفّ الشخصيّ" onClick={openSettings}>
            <div className="avatar">{avatarUrl ? <img src={avatarUrl} alt="" /> : avInitials}</div>
            <div className="who">
              <b>{displayName || 'PalNovaa 1.0'}{balance && <span className={`plan-badge ${balance.plan === 'pro' ? 'pro' : ''}`}>{balance.plan === 'pro' ? 'Pro' : 'مجّاني'}</span>}</b>
              {tokMeter && !tokMeter.pro
                ? <span className="foot-meter" title={`استُهلك ${tokMeter.used.toLocaleString('en')} من ${FREE_TOKENS.toLocaleString('en')} توكن`}><i style={{ width: `${Math.max(3, Math.round(tokMeter.frac * 100))}%` }} /></span>
                : <small>{balance ? (balance.plan === 'pro' ? 'خطّة Pro — غير محدودة' : 'الخطّة المجّانيّة') : 'المحرّك الذكيّ'}</small>}
            </div>
            <span className="foot-gear">{NAVI.gear}</span>
          </button>
        </aside>

        {/* ============ MAIN ============ */}
        <main className="main">
          <header className="topbar">
            <button className="icon-btn nav-toggle" title="القائمة" onClick={() => { setCollapsed(false); setDrawer(true); }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
            </button>
            {(view === 'data' || view === 'settings') && (
              <div className="crumbs">
                <span className="crumb-home" onClick={() => setView('home')}>مساحة العمل</span>
                <span className="sep">/</span><b className="crumb-flat">{view === 'data' ? 'مكتبة البيانات' : 'الإعدادات'}</b>
              </div>
            )}
            {view !== 'data' && view !== 'settings' && (<>
            <div className="crumbs">
              <span className="crumb-home" onClick={() => { if (view !== 'home') setView('home'); }}>مساحة العمل</span>
              <span className="sep">/</span>
              {(renaming
                    ? <input className="crumb-rename" autoFocus value={nameDraft} placeholder="اسم المشروع…"
                        onChange={(e) => setNameDraft(e.target.value)} onBlur={commitRename}
                        onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenaming(false); }} />
                    : <button className="crumb-title" title="سمِّ المشروع" onClick={beginRename}>
                        <b>{title}</b>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                      </button>)}
            </div>
            <span className={`status-pill ${allChips.length ? 'on' : ''}`}><i /><span>{allChips.length ? `${allChips.length} مرفق` : 'لا مصدر بيانات'}</span></span>
            <div className="top-actions">
              <button className="icon-btn" title="النُّسَخ والتراجع" data-menu-anchor onClick={(e) => openMenu('versions', e)} disabled={!slug}>{Ico.history}</button>
              <button className="icon-btn" title="نسخ المشروع (fork)" onClick={forkProject} disabled={!slug}>{Ico.fork}</button>
              <button className="btn" onClick={onShare} disabled={!html}>{Ico.share}<span>حفظ</span></button>
              <button className="btn primary" onClick={onDeploy} disabled={!html || busy}>{Ico.rocket}<span>{slug && !dirty ? 'منشور' : 'نشر التطبيق'}</span></button>
            </div>
            </>)}
          </header>

          {/* ===== HOME ===== */}
          {view === 'home' && (
            <section className="home" onMouseMove={onHomeMove}>
              <svg className="contours" ref={contoursRef} preserveAspectRatio="xMidYMid slice" />
              <div className="home-inner">
                <div className="hm-head">
                  <div className="hm-eyebrow">{greeting}{displayName ? ` · ${displayName}` : ''}</div>
                  <h1 className="hero">ماذا نبني اليوم؟</h1>
                </div>

                <div className="composer">
                  <div className="cmp-head">
                    <span className="cmp-file"><i />وصف المشروع</span>
                    <span className="cmp-state"><i />{balance ? (balance.plan === 'pro' ? 'المحرّك جاهز · Pro' : 'المحرّك جاهز · مجّاني') : 'المحرّك جاهز'}</span>
                  </div>
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
                  <textarea ref={homeTaRef} value={prompt} maxLength={4000}
                    placeholder="صِف التطبيق الذي تريده… مثال: خريطةٌ لمساجد محافظة رام الله والبيرة، مع لوحة إحصاءاتٍ وفلترةٍ بالبلدة وتصدير CSV."
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendHome(); } }} rows={3} />
                  <div className="composer-bar">
                    {/* «إضافة بيانات» انتقلت إلى القائمة الجانبيّة — بندٌ دائمٌ أوضحُ من زرٍّ داخل المُحرِّر. */}
                    <button className="tool chip mono only-desk" data-menu-anchor onClick={(e) => openMenu('mode', e)}><span className="tk">النوع</span><span className="v">{mode}</span></button>
                    <button className="tool chip mono only-desk" data-menu-anchor onClick={(e) => openMenu('crs', e)}><span className="tk">الإسناد</span><span className="v">{crs}</span></button>
                    <button className="tool chip only-mob" title="خيارات المشروع" onClick={() => setModal('opts')}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" /></svg>
                      <span>خيارات</span>
                    </button>
                    <span className="bar-sp" />
                    <button className={`tool enhance ${enhancing ? 'busy' : ''}`} title="حسّن الوصف تلقائياً قبل البناء" disabled={!prompt.trim() || enhancing || busy} onClick={enhancePrompt}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.4 2.4M15.3 15.3l2.4 2.4M17.7 6.3l-2.4 2.4M8.7 15.3l-2.4 2.4" /></svg>
                      {enhancing ? 'يحسّن…' : 'تحسين'}
                    </button>
                    <span className="cmp-count">{prompt.length}/4000 · Enter</span>
                    <button className="send build" disabled={!prompt.trim() || busy} title="ابنِ التطبيق" onClick={sendHome}>{Ico.send}<span>ابنِ التطبيق</span></button>
                  </div>
                </div>
                <div className="hm-stats">
                  <div className="hm-stat"><div className="hs-top"><span>المشاريع</span>{Ico.folder}</div><b>{nfmt(projects.length)}</b></div>
                  <div className="hm-stat"><div className="hs-top"><span>الطبقات</span>{Ico.db}</div><b>{nfmt(myDatasets.length)}</b></div>
                  <div className="hm-stat"><div className="hs-top"><span>المعالم</span>{Ico.mapIco}</div><b>{nfmt(totalFeatures)}</b></div>
                  <div className="hm-stat">
                    <div className="hs-top"><span>الخطّة</span>{Ico.cube}</div>
                    <b className="hs-plan">{balance ? (balance.plan === 'pro' ? 'Pro' : 'مجّاني') : '—'}</b>
                    {tokMeter && !tokMeter.pro && <span className="hs-meter" title={`استُهلك ${nfmt(tokMeter.used)} من ${nfmt(FREE_TOKENS)} توكن`}><i style={{ width: `${Math.max(3, Math.round(tokMeter.frac * 100))}%` }} /></span>}
                  </div>
                </div>

                <div className="hm-cols">
                  <section className="hm-col">
                    <div className="block-title"><h3>آخر المشاريع{projects.length > 0 && <span className="bt-count">{projects.length}</span>}</h3><a onClick={() => newProject()}>مشروع جديد</a></div>
                    <div className="hm-list">
                      {projects.slice(0, 5).map((p) => (
                        <div className="hm-proj" key={p.slug} title={p.title} onClick={() => openProject(p)}>
                          <span className="hp-bar" />
                          <span className="hp-txt"><b>{p.title}</b><small>{sinceTxt(p.updated_at)}</small></span>
                          <span className="hp-go"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg></span>
                        </div>
                      ))}
                      {projects.length === 0 && <div className="hm-empty">لا مشاريع بعد — اكتب وصفك بالأعلى واضغط «ابنِ التطبيق».</div>}
                    </div>
                  </section>

                  <section className="hm-col">
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
                      {myDatasets.length === 0 && <div className="hm-empty">لا طبقات محفوظة بعد — أضِف مصادرك من زرّ «البيانات»، وتُخزَّن هنا.</div>}
                    </div>
                  </section>
                </div>
              </div>
            </section>
          )}

          {/* ===== مكتبة البيانات ===== */}
          {view === 'data' && (
            <section className="datalib">
              <div className="dl-inner">
                <div className="dl-head">
                  <div className="dl-head-txt">
                    <div className="hm-eyebrow">التخزين</div>
                    <h1 className="dl-title">مكتبة البيانات</h1>
                    <p className="dl-sub">ملفّاتٌ مكانيّةٌ تُرفَع مباشرةً إلى التخزين السحابيّ. أرفِقها بمشاريعك من المُحرِّر.</p>
                  </div>
                  <button className="dl-upload" onClick={() => fileRef.current?.click()}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m17 8-5-5-5 5" /><path d="M12 3v13" /></svg>
                    <span>رفع ملفّات</span>
                  </button>
                </div>

                <div className="dl-grid">
                  {/* الإفلاتُ يمرّ على onFile نفسه الذي يستعمله زرُّ الرفع — لا مسارَ ثانٍ */}
                  <div className={`dl-drop ${dragOver ? 'over' : ''}`}
                    onClick={() => fileRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); if (!dragOver) setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) onFile({ target: { files: [f] } }); }}>
                    <span className="dl-drop-ic">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m17 8-5-5-5 5" /><path d="M12 3v13" /></svg>
                    </span>
                    <b>أفلِت الملفّات المكانيّة هنا</b>
                    <small>.geojson .json .kml .kmz .csv .zip .shp .gpkg .tif .tiff .dxf</small>
                  </div>

                  <aside className="dl-card">
                    <div className="dl-card-top"><b>تخزين مساحة العمل</b><span className="dl-used">{fmtBytes(totalBytes)}</span></div>
                    <div className="dl-mini">
                      <div><b>{nfmt(myDatasets.length)}</b><span>طبقة</span></div>
                      <div><b>{nfmt(totalFeatures)}</b><span>معلم</span></div>
                    </div>
                    <p className="dl-note">الحدُّ لكلّ ملفّ: <b>40MB</b> للطبقات المتّجهة و<b>500MB</b> لصور GeoTIFF. لا سقفَ على مجموع مساحة العمل.</p>
                    <div className="dl-fmts">
                      {['GeoJSON', 'KML / KMZ', 'CSV', 'Shapefile (مضغوط)', 'GeoPackage', 'GeoTIFF', 'AutoCAD DXF'].map((f) => (
                        <div className="dl-fmt" key={f}><span>{f}</span><em>يُعرَض</em></div>
                      ))}
                    </div>
                  </aside>
                </div>

                <div className="dl-table">
                  <div className="dl-tr dl-th"><span>الاسم</span><span>الصيغة</span><span>النوع</span><span>الخريطة</span><span>الحجم</span><span>أُضيف</span><span /></div>
                  {myDatasets.map((d) => (
                    <div className="dl-tr" key={d.slug}>
                      <span className="dl-name" title={d.name}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /></svg>
                        <b>{d.name}</b>
                      </span>
                      <span className="dl-fmt-c">{(d.kind || '').toUpperCase()}</span>
                      <span>{d.kind === 'geotiff' ? 'راستر' : 'متّجه'}</span>
                      <span><button className="dl-link" onClick={() => openExplorer(d)}>يُعرَض</button></span>
                      <span className="dl-size">{fmtBytes(d.meta && d.meta.bytes)}</span>
                      <span className="dl-when">{sinceTxt(d.created_at)}</span>
                      <span className="dl-acts">
                        <button title="إرفاقها بالمشروع" onClick={() => { attachDataset(d); setView('home'); }}>{Ico.plus}</button>
                        <button title="تنزيل" onClick={() => window.open(`${API}/engine/datasets/${d.slug}/data`, '_blank', 'noopener')}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5" /><path d="M12 15V3" /></svg>
                        </button>
                        <button className="danger" title="حذف" onClick={() => removeDataset(d)}>{Ico.trash}</button>
                      </span>
                    </div>
                  ))}
                  {myDatasets.length === 0 && <div className="dl-empty">لا طبقاتٍ بعد — أفلِت ملفّاً في المساحة أعلاه، أو اضغط «رفع ملفّات».</div>}
                </div>
              </div>
            </section>
          )}

          {/* ===== الإعدادات ===== */}
          {view === 'settings' && (
            <section className="setpage">
              <div className="sp-inner">
                <div className="sp-head">
                  <div className="hm-eyebrow">الحساب</div>
                  <h1 className="dl-title">الإعدادات</h1>
                  <p className="dl-sub">ملفّك الشخصيّ في محرّك بالنوفا، وحسابُ الدخول.</p>
                </div>

                <div className="sp-sec">
                  <div className="sp-lbl"><b>{NAVI.user}<span>الملفّ الشخصيّ</span></b><small>يظهر في مساحة عملك.</small></div>
                  <div className="sp-card">
                    <div className="sp-f2">
                      <label className="sp-field">
                        <span>الاسم</span>
                        <input value={nameDraft2} placeholder={userName || 'اسمك…'} maxLength={80} onChange={(e) => setNameDraft2(e.target.value)} />
                      </label>
                      <div className="sp-field">
                        <span>الصورة</span>
                        <div className="sp-avrow">
                          <button className="sp-av" title="تغيير الصورة" onClick={() => avatarRef.current?.click()}>
                            {avatarUrl ? <img src={avatarUrl} alt="" /> : <em>{avInitials}</em>}
                          </button>
                          <button className="sp-avbtn" onClick={() => avatarRef.current?.click()}>{avatarUrl ? 'تغيير الصورة' : 'رفع صورة'}</button>
                        </div>
                      </div>
                    </div>
                    <div className="sp-cardfoot">
                      <span className="sp-meta">البريد <b>{user?.email || '—'}</b> · الدور <b>{user?.role === 'admin' ? 'أدمن' : 'مستخدم'}</b></span>
                      <button className="sp-save" disabled={!profDirty || savingProf} onClick={saveProfile}>{NAVI.save}<span>{savingProf ? 'يحفظ…' : 'حفظ'}</span></button>
                    </div>
                  </div>
                </div>

                <div className="sp-sec">
                  <div className="sp-lbl"><b>{NAVI.key}<span>حساب الدخول</span></b><small>هويّتك وجلستك الحاليّة.</small></div>
                  <div className="sp-card">
                    <div className="sp-who">
                      <span className="sp-who-av">{avatarUrl ? <img src={avatarUrl} alt="" /> : <em>{avInitials}</em>}</span>
                      <span className="sp-who-txt"><b>{displayName || 'مستخدم'}</b><small>{user?.email || ''}</small></span>
                      <span className={`plan-badge ${balance?.plan === 'pro' ? 'pro' : ''}`}>{balance ? (balance.plan === 'pro' ? 'Pro' : 'مجّاني') : '—'}</span>
                    </div>
                    <div className="sp-hr" />
                    <div className="sp-actions">
                      <button className="sp-ghost" onClick={() => navigate('/palnovaa-engine/pricing')}>{NAVI.dollar}<span>الخطط والفوترة</span></button>
                      <button className="sp-out" onClick={() => logout()}>{NAVI.logout}<span>تسجيل الخروج</span></button>
                    </div>
                  </div>
                </div>

                <div className="sp-sec">
                  <div className="sp-lbl"><b>{NAVI.gauge}<span>الاستهلاك</span></b><small>ما صُرف من حصّتك هذه الدورة.</small></div>
                  <div className="sp-card">
                    {tokMeter ? (tokMeter.pro ? (<>
                      <div className="sp-usetop"><b>خطّة Pro</b><span className="plan-badge pro">Pro</span></div>
                      <div className="sp-track"><i style={{ width: `${Math.round(tokMeter.frac * 100)}%` }} /></div>
                      <p className="sp-note">استهلاكٌ غير محدود — هذا الخطّ يبيّن ما صُرف هذه الدورة.</p>
                    </>) : (<>
                      <div className="sp-usetop"><b>{nfmt(tokMeter.used)}<span> / {nfmt(FREE_TOKENS)} توكن</span></b><span className="sp-pct">{Math.round(tokMeter.frac * 100)}%</span></div>
                      <div className="sp-track"><i className={tokMeter.frac > 0.85 ? 'hot' : ''} style={{ width: `${Math.round(tokMeter.frac * 100)}%` }} /></div>
                      <p className="sp-note">ميزانيّة الخطّة المجّانيّة — تكفي لبناء عدّة تطبيقاتٍ مرتّبة. عند النفاد تُتاح الترقية إلى Pro.</p>
                    </>)) : <p className="sp-note">يُحمَّل الرصيد…</p>}
                  </div>
                </div>

                <div className="sp-sec">
                  <div className="sp-lbl"><b>{NAVI.palette}<span>المظهر</span></b><small>لونُ خلفيّة مساحة العمل. يُطبَّق فوراً ويُحفظ على جهازك.</small></div>
                  <div className="sp-card">
                    <div className="sp-swatches">
                      {BG_PRESETS.map((b) => (
                        <button key={b.n} className={`sp-swatch ${(bgColor || '') === b.k ? 'on' : ''}`} title={b.n} onClick={() => updBg(b.k)}>
                          <span className="sp-tile" style={{ background: b.c }}>{(bgColor || '') === b.k && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>}</span>
                          <small>{b.n}</small>
                        </button>
                      ))}
                    </div>
                    <label className="sp-custom">
                      <span><b>لونٌ مخصّص</b><small>اختر أيّ لونٍ داكن</small></span>
                      <input type="color" value={bgColor || '#0A0B0D'} onChange={(e) => updBg(e.target.value)} />
                    </label>
                  </div>
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
          {/* ===== WORKSPACE ===== */}
          <section className={`workspace ${view === 'workspace' ? 'on' : ''} mp-${mobilePane}`}>
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
                        </div>
                      </div>
                    </div>
                  );
                  if (m.kind === 'build') {
                    const finished = m.progress >= STEPS.length && m.state !== 'running';
                    const mark = (
                      <svg className="pn-mark" viewBox="0 0 80 80" width="24" height="24" aria-hidden="true">
                        <g className="o"><path transform="translate(7 14)" d="M14 58V6h19a20 20 0 0 1 0 40H14" fill="none" stroke="currentColor" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" /></g>
                        <g className="i"><path transform="translate(7 14)" d="M23 15.5h10a10.5 10.5 0 0 1 0 21H23" fill="none" stroke="#E07B39" strokeWidth="5.5" strokeLinecap="round" /></g>
                        <g className="d"><circle cx="40" cy="40" r="2.8" fill="#E07B39" /></g>
                      </svg>
                    );
                    const errored = m.state === 'error';
                    const running = m.state === 'running';
                    const doneSet = m.done || [];
                    const curIdx = Math.max(0, STAGES.findIndex((g) => g.id === m.stage));
                    const pct = Math.round(((finished ? STAGES.length : doneSet.length) / STAGES.length) * 100);
                    const curStage = STAGES[curIdx] || STAGES[0];
                    return (
                    <div className="msg-ai fade-in" key={m.id}>
                      <div className="ai-av">{Ico.cube}</div>
                      <div className="body">
                        <div className={`pn-build ${errored ? 'err' : finished ? 'done' : 'run'}`}>
                          <div className="pn-build-row">
                            <span className="pn-build-mark">{errored ? <span className="pn-build-x">!</span> : finished ? Ico.check : mark}</span>
                            <span className="pn-build-title">{errored ? 'توقّف البناء' : finished ? 'تمّ البناء بنجاح' : (curStage?.t || 'أُحلّل وأبني')}</span>
                            <span className="pn-build-seg" aria-hidden="true">
                              {STAGES.map((g, i) => <i key={g.id} className={doneSet.includes(g.id) ? 'on' : (running && i === curIdx ? 'cur' : '')} />)}
                            </span>
                          </div>
                          {!finished && !errored && <div className="pn-build-bar"><span style={{ width: `${Math.max(6, pct)}%` }} /></div>}

                          {/* المراحل الحقيقيّة — أيقونةٌ واسمٌ لكلّ مرحلة (مدفوعةٌ بأحداث الخادم) */}
                          {!errored && (
                            <div className="pn-stages">
                              {/* كشفٌ تدريجيّ: لا تظهر المرحلة قبل أن يبلغها البناء */}
                              {STAGES.slice(0, finished ? STAGES.length : curIdx + 1).map((g, i) => {
                                const isDone = finished || i < curIdx || doneSet.includes(g.id);
                                const isCur = running && !finished && i === curIdx;
                                return (
                                  <div className={`pn-stage ${isDone ? 'done' : isCur ? 'cur' : 'idle'}`} key={g.id}>
                                    <span className="pn-stage-ic">{isCur ? <span className="pn-stage-spin" /> : SICONS[g.id]}</span>
                                    <span className="pn-stage-txt"><b>{g.t}</b><small>{g.m}</small></span>
                                    {isCur && <span className="pn-stage-dots" aria-label="يفكّر"><i /><i /><i /></span>}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        {isAdmin && m.usage && (() => {
                          const tin = (m.usage.input || 0) + (m.usage.cacheRead || 0) + (m.usage.cacheWrite || 0);
                          const tout = m.usage.output || 0;
                          const total = tin + tout;
                          const secs = m.elapsed ? m.elapsed / 1000 : 0;
                          const tps = secs > 0 ? Math.round(tout / secs) : 0;
                          const fmt = (n) => (n || 0).toLocaleString('en-US');
                          return (
                            <div className="adm-meter" title="قياس إداريّ — يظهر لك وحدك">
                              <span className="adm-tag">{Ico.cube}<span>قياس الأدمن</span></span>
                              <div className="adm-cells">
                                <div className="adm-cell"><b>{fmt(tin)}</b><span>إدخال</span></div>
                                <div className="adm-cell"><b>{fmt(tout)}</b><span>إخراج</span></div>
                                <div className="adm-cell adm-sum"><b>{fmt(total)}</b><span>إجماليّ</span></div>
                                {m.usage.cacheRead ? <div className="adm-cell"><b>{fmt(m.usage.cacheRead)}</b><span>مخزّن</span></div> : null}
                                {secs > 0 && <div className="adm-cell"><b>{secs.toFixed(1)}s</b><span>الزمن</span></div>}
                                {tps > 0 && <div className="adm-cell"><b>{fmt(tps)}</b><span>رمز/ث</span></div>}
                              </div>
                              {m.model && <span className="adm-model">{m.model}</span>}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                    );
                  }
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
                  <textarea ref={chatTaRef} value={prompt2} maxLength={4000} placeholder="اطلب تعديلاً: أضِف مخطّطاً، غيّر الألوان، أضِف جدولاً، صدّر PDF…"
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
                  {!html && !liveDoc && (<div className="pv-empty">{busy ? <div className="ld"><div className="ring" /><span>يكتب PalNovaa تطبيقك مباشرةً… ستظهر المعاينة هنا وهي تُبنى</span></div> : <span>اكتب وصفاً وابدأ البناء لتظهر المعاينة هنا.</span>}</div>)}
                  {(html || liveDoc) && <div className={`pv-stage dev-${device}`}><iframe key={html ? pvKey : 'live'} className="pv-frame" title="preview" srcDoc={html ? previewDoc : liveDoc} sandbox="allow-scripts allow-popups allow-forms allow-modals" /></div>}
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
                    const langOf = (n) => (n.endsWith('.css') ? 'css' : (n.endsWith('.js') || n.endsWith('.mjs')) ? 'javascript' : n.endsWith('.json') ? 'json' : 'xml');
                    const codeFiles = streaming
                      ? [
                          { name: 'index.html', lang: 'xml', code: streamCode },
                          { name: 'styles.css', lang: 'css', code: '', pending: true },
                          { name: 'app.js', lang: 'javascript', code: '', pending: true },
                        ]
                      : (files && typeof files === 'object' && Object.keys(files).length)
                        ? Object.entries(files).map(([name, code]) => ({ name, lang: langOf(name), code: String(code) }))
                        : splitProjectFiles(html);
                    const active = streaming ? codeFiles[0] : (codeFiles.find((f) => f.name === activeFile) || codeFiles[0]);
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
                          {codeFiles.map((f) => (
                            <button key={f.name} className={`vs-file ${active.name === f.name ? 'on' : ''} ${f.pending ? 'pending' : ''}`} onClick={() => pick(f)}>
                              <span className="vs-ic"><FileIcon name={f.name} /></span>{f.name}
                              {streaming && f.name === 'index.html' && <span className="vs-writing" title="يكتب…" />}
                            </button>
                          ))}
                        </div>
                        <div className="vs-main">
                          <div className="vs-tabs">
                            {codeFiles.map((f) => (
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
            {/* شريط تبديلٍ للجوّال: لوحٌ واحد في كلّ مرّة (محادثة ⇄ معاينة) */}
            <div className="mobile-tabs">
              <button className={mobilePane === 'chat' ? 'on' : ''} onClick={() => setMobilePane('chat')}>{Ico.chat}<span>المحادثة</span></button>
              <button className={mobilePane === 'preview' ? 'on' : ''} onClick={() => setMobilePane('preview')}>{Ico.eye}<span>المعاينة</span></button>
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
      {/* ============ MODAL: خيارات المشروع (للجوّال) ============ */}
      {modal === 'opts' && (
        <div className="scrim" onClick={(e) => { if (e.target.classList.contains('scrim')) setModal(null); }}>
          <div className="modal opts-modal">
            <div className="modal-head"><div><b>خيارات المشروع</b><small>اختر النوع ونظام الإسناد ونمط البناء</small></div><button className="icon-btn" onClick={() => setModal(null)}>{Ico.close}</button></div>
            <div className="opts-body">
              <div className="opts-group">
                <label>نوع المُخرَج</label>
                <div className="opts-chips">{MODES.map((m) => <button key={m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>{m}</button>)}</div>
              </div>
              <div className="opts-group">
                <label>نظام الإسناد (CRS)</label>
                <div className="opts-chips">{CRS.map((c) => <button key={c} className={`mono ${crs === c ? 'on' : ''}`} onClick={() => setCrs(c)}>{c}</button>)}</div>
              </div>
            </div>
            <div className="modal-foot"><button className="btn accent sp" onClick={() => setModal(null)}>تمّ</button></div>
          </div>
        </div>
      )}

      {/* نافذةُ الإعدادات حُذفت — صارت صفحةً كاملةً (view === 'settings'). */}

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
                  {(arcData.layers || []).length > 0 && (
                    <div className="arc-where">
                      <input type="text" value={arcWhere} onChange={(e) => setArcWhere(e.target.value)}
                        placeholder="فلتر اختياريّ للسحب الجزئيّ — مثلاً: CITY='نابلس' (اتركه فارغاً لكلّ المعالم)" />
                    </div>
                  )}
                  {(arcData.layers || []).length === 0 && <div className="arc-empty">لا طبقات في هذه الخدمة.</div>}
                  {(arcData.layers || []).map((l) => {
                    const meta = arcMeta[l.id];
                    const open = arcQL === l.id;
                    return (
                    <React.Fragment key={l.id}>
                    <div className={`arc-layer ${open ? 'q-open' : ''}`}>
                      <label className="arc-lcheck">
                        <input type="checkbox" checked={arcSel.includes(l.id)} onChange={() => toggleArcLayer(l.id)} />
                        <span className="arc-lname"><b>{l.name}</b>{l.geometryType && <span className="arc-geom mono">{l.geometryType.replace('esriGeometry', '')}</span>}</span>
                      </label>
                      <span className="arc-lid mono">#{l.id}</span>
                      <button className={`arc-q ${open ? 'on' : ''}`} title="استعلام: اعرف الحقول واعدد النتائج قبل السحب" onClick={() => openArcQ(l)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.6-3.6" /></svg>
                      </button>
                      <button className="arc-store" title="اسحب الطبقة (بالفلتر إن وُجد) وخزّنها عندك" disabled={arcIng !== null || arcDl !== null} onClick={() => ingestArcLayer(l)}>
                        {arcIng === l.id ? <span className="ring" /> : Ico.db}
                      </button>
                      <button className="arc-dl" title="تنزيل GeoJSON (بالفلتر إن وُجد)" disabled={arcDl !== null || arcIng !== null} onClick={() => downloadArcLayer(l)}>
                        {arcDl === l.id ? <span className="ring" /> : Ico.down}
                      </button>
                    </div>

                    {open && (
                      <div className="arc-qp">
                        {arcQBusy === 'meta' && !meta && <div className="arc-qp-load"><span className="ring" /> جارٍ قراءة الحقول…</div>}
                        {meta && (<>
                          <div className="arc-qp-head">
                            <span>إجماليّ المعالم في الطبقة</span>
                            <b className="mono">{meta.total != null ? meta.total.toLocaleString('en') : '—'}</b>
                          </div>

                          <div className="arc-qp-sec">
                            <label>الحقول — انقر لإدراج اسم الحقل في الفلتر</label>
                            <div className="arc-chips">
                              {meta.fields.map((f) => (
                                <button key={f.name} className="arc-chip" title={`${f.alias} · ${f.type}`} onClick={() => arcInsert(f.name)}>{f.name}</button>
                              ))}
                            </div>
                          </div>

                          <div className="arc-qp-sec">
                            <label>اختر حقلاً ثمّ حدّد ما تريده منه</label>
                            <select className="arc-qp-sel" value={arcField} onChange={(e) => {
                              const v = e.target.value;
                              setArcField(v); setArcPick([]); setArcVals(null); setArcVFilter('');
                              if (v) arcLoadVals(l, v);
                            }}>
                              <option value="">— اختر حقلاً —</option>
                              {meta.fields.filter((f) => /String|SmallInteger|Integer|Double/i.test(f.type)).map((f) => (
                                <option key={f.name} value={f.name}>{f.name}{f.alias && f.alias !== f.name ? ` — ${f.alias}` : ''}</option>
                              ))}
                            </select>

                            {arcQBusy === 'values' && <div className="arc-qp-load"><span className="ring" /> جارٍ جلب القيم… (قد تستغرق نصف دقيقة للطبقات الضخمة)</div>}

                            {arcVals && arcVals.values.length > 0 && (() => {
                              const q = arcVFilter.trim().toLowerCase();
                              const shown = q ? arcVals.values.filter((v) => String(v).toLowerCase().includes(q)) : arcVals.values;
                              return (
                                <div className="arc-pick">
                                  <div className="arc-pick-bar">
                                    <input type="text" value={arcVFilter} onChange={(e) => setArcVFilter(e.target.value)} placeholder="ابحث في القيم…" />
                                    <button className="arc-pick-all" onClick={() => setArcPick(shown.map(String))}>تحديد الظاهر</button>
                                    <button className="arc-pick-all" onClick={() => setArcPick([])}>مسح</button>
                                  </div>
                                  <div className="arc-pick-list">
                                    {shown.length === 0 && <span className="arc-qp-note">لا نتائج للبحث.</span>}
                                    {shown.map((v, i) => {
                                      const sv = String(v);
                                      return (
                                        <label className={`arc-pick-row ${arcPick.includes(sv) ? 'on' : ''}`} key={i}>
                                          <input type="checkbox" checked={arcPick.includes(sv)} onChange={() => togglePick(sv)} />
                                          <span>{sv}</span>
                                        </label>
                                      );
                                    })}
                                  </div>
                                  <div className="arc-pick-sum">محدَّد: <b>{arcPick.length}</b> من {arcVals.values.length}</div>
                                </div>
                              );
                            })()}
                            {arcVals && arcVals.values.length === 0 && <span className="arc-qp-note">لا قيم في هذا الحقل.</span>}
                          </div>

                          <div className="arc-qp-sec">
                            <label>الاستعلام الذي سيُنفَّذ</label>
                            <code className="arc-qp-where">{arcEffWhere()}</code>
                            <div className="arc-qp-row" style={{ marginTop: 9 }}>
                              <button className="btn" disabled={arcQBusy === 'count'} onClick={() => arcCountNow(l)}>
                                {arcQBusy === 'count' ? <span className="ring" /> : 'احسب العدد'}
                              </button>
                              {arcCnt && arcCnt.id === l.id && (
                                <span className="arc-qp-count">المطابق: <b className="mono">{arcCnt.n.toLocaleString('en')}</b> معلم</span>
                              )}
                            </div>
                            <div className="arc-qp-row" style={{ marginTop: 9 }}>
                              <button className="btn accent" disabled={arcDl !== null || arcIng !== null} onClick={() => downloadArcLayer(l)}>
                                {arcDl === l.id ? <span className="ring" /> : 'نزّل GeoJSON'}
                              </button>
                              <button className="btn" disabled={arcIng !== null || arcDl !== null} onClick={() => ingestArcLayer(l, true)}>
                                {arcIng === l.id ? <span className="ring" /> : 'اعرض على الخريطة'}
                              </button>
                            </div>
                            <span className="arc-qp-note">«نزّل» يحفظ الطبقة الناتجة على جهازك. «اعرض» يخزّنها في بياناتك ويفتحها في العارض.</span>
                          </div>
                        </>)}
                      </div>
                    )}
                    </React.Fragment>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="modal-foot">
              <span className="note">زرّ «أرفق» = طبقاتٌ حيّة من الخادم. زرّ التخزين {Ico.db} بجانب كلّ طبقة = اسحبها وامتلكها عندك (تُعرَض بذكاء — تايلز للكبير).</span>
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

      {/* ترحيبٌ لأوّل دخول (مرّةً واحدة) */}
      {showWelcome && (
        <div className="pnw-scrim" onClick={(e) => { if (e.target.classList.contains('pnw-scrim')) closeWelcome(); }}>
          <div className="pnw-card" role="dialog" aria-label="مرحباً بك في PalNovaa Engine">
            <button className="pnw-x" onClick={closeWelcome} aria-label="إغلاق">{Ico.close}</button>
            <div className="pnw-media"><img src="/engine-welcome.png" alt="PalNovaa Engine 1.0" /></div>
            <div className="pnw-body">
              <h2 className="pnw-title">تستخدم الآن نموذج <span>PalNovaa Engine 1.0</span></h2>
              <p className="pnw-sub">ولديك رصيد بناءٍ بقيمة <b>110 ألف توكِن</b> — ابدأ ببناء أوّل تطبيقٍ لك الآن.</p>
              <button className="pnw-cta" onClick={closeWelcome}>لنبدأ البناء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
