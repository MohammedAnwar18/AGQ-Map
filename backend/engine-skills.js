/* ============================================================================
   PalNovaa Engine — مكتبة المهارات (Skills Library)
   ----------------------------------------------------------------------------
   أنماط مُختبَرة + مكتبات CDN + كشف ذكيّ + قوالب جاهزة.
   تُحقن ديناميكيّاً في سياق التوليد حسب طلب المستخدم.
   ============================================================================ */

const CDN = {
  chartjs:       'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js',
  leafletDraw:   'https://cdnjs.cloudflare.com/ajax/libs/leaflet.draw/1.0.4/leaflet.draw.js',
  leafletDrawCSS:'https://cdnjs.cloudflare.com/ajax/libs/leaflet.draw/1.0.4/leaflet.draw.css',
  markerCluster: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3/leaflet.markercluster.js',
  clusterCSS:    'https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3/MarkerCluster.css',
  clusterDefCSS: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3/MarkerCluster.Default.css',
  leafletHeat:   'https://cdnjs.cloudflare.com/ajax/libs/leaflet.heat/0.2.0/leaflet-heat.js',
  html2canvas:   'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  jspdf:         'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  papaparse:     'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js',
  sortablejs:    'https://cdnjs.cloudflare.com/ajax/libs/Sortable/1.15.0/Sortable.min.js',
  flatpickr:     'https://cdnjs.cloudflare.com/ajax/libs/flatpickr/4.6.13/flatpickr.min.js',
  flatpickrCSS:  'https://cdnjs.cloudflare.com/ajax/libs/flatpickr/4.6.13/flatpickr.min.css',
  animateCSS:    'https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css',
  confetti:      'https://cdnjs.cloudflare.com/ajax/libs/canvas-confetti/1.9.2/confetti.browser.min.js',
};

const SKILLS = {
  charts: {
    name: 'الرسوم البيانيّة',
    keywords: ['رسم بياني','مخطط','chart','graph','pie','bar','line','radar','doughnut','إحصائ','scatter','bubble','polar','تحليل بيان','إنفوجرافيك','infographic'],
    instructions: [
      '— مهارة: الرسوم البيانيّة (Chart.js 4) —',
      `ضمّن: <script src="${CDN.chartjs}"></script>`,
      'أنشئ <canvas id="myChart"> لكلّ مخطّط. أنواع: bar, line, pie, doughnut, radar, scatter, polarArea, bubble.',
      'مخطّط مزدوج: type:"bar" مع datasets أحدها type:"line". محور Y ثانويّ: yAxisID:"y2".',
      'ألوان: مصفوفة COLORS متناسقة مع التصميم. backgroundColor بشفافيّة rgba. شبكة خفيفة borderColor:"rgba(255,255,255,0.06)".',
      'تفاعل: tooltip مفصّل (callbacks.label)، legend onClick لإخفاء السلسلة، responsive:true, maintainAspectRatio:false.',
      'تحديث حيّ: chart.data.datasets[0].data=newArr; chart.update("none");',
    ].join('\n'),
  },

  tables: {
    name: 'الجداول التفاعليّة',
    keywords: ['جدول','table','قائمة','list','grid','ترتيب','sort','فلتر','filter','صفوف','rows','بيانات مجدول','spreadsheet','صفحة بيانات'],
    instructions: [
      '— مهارة: الجداول التفاعليّة —',
      'ابنِ <table> أصليّ مع: <thead> ثابت (position:sticky;top:0)، نقر العمود → ترتيب تصاعدي/تنازلي (مؤشّر ▲▼).',
      'فلترة فوريّة: <input oninput="filterTable()"> يُخفي الصفوف غير المطابقة. ترقيم صفحات: أزرار 1 2 3 + سابق/تالي، pageSize قابل للتغيير.',
      'تصدير CSV: Papa.unparse||يدوي → Blob("text/csv;charset=utf-8",{BOM}) → a.download. زرّ طباعة: window.print() مع @media print مناسب.',
      'تجاوب: wrapper div بـoverflow-x:auto. ألوان صفوف متناوبة: tr:nth-child(even). تظليل hover.',
    ].join('\n'),
  },

  forms: {
    name: 'النماذج والإدخال',
    keywords: ['نموذج','form','إدخال','input','استبيان','survey','تسجيل','registration','اتصل','contact','بحث متقدم','استمارة','طلب','application form'],
    instructions: [
      '— مهارة: النماذج والإدخال —',
      'تحقّق: required + pattern + minlength. رسائل خطأ عربيّة أسفل الحقل (أحمر، تُخفى عند التصحيح). عطّل الزرّ حتى الصحّة.',
      'أنواع: text, email, tel, number, select (مع خيار فارغ), checkbox, radio, textarea, file (مع معاينة صورة/اسم الملف), range.',
      `منتقي تاريخ: اختياريّاً ضمّن <link rel="stylesheet" href="${CDN.flatpickrCSS}"><script src="${CDN.flatpickr}"></script> واستدعِ flatpickr(".date-input",{locale:"ar"}).`,
      'نموذج متعدّد الخطوات: شريط تقدّم أعلى (step indicators)، أزرار السابق/التالي، خطوة مراجعة أخيرة تعرض كلّ القيم قبل الإرسال.',
      'الإرسال: new FormData(form) → Object.fromEntries → حفظ localStorage أو عرض ملخّص نجاح.',
    ].join('\n'),
  },

  dashboard: {
    name: 'لوحات المعلومات',
    keywords: ['لوحة','dashboard','مؤشر','KPI','إحصائيات','statistics','ملخص','summary','تقرير','report','monitor','مراقبة','نظرة عامة','overview','scorecard','metrics'],
    instructions: [
      '— مهارة: لوحات المعلومات —',
      `ضمّن: <script src="${CDN.chartjs}"></script>`,
      'بطاقات KPI: CSS Grid (repeat(auto-fit,minmax(220px,1fr))). كلّ بطاقة: أيقونة SVG ملوّنة + اسم المؤشّر (font-size:0.85rem) + قيمة كبيرة (2rem bold) + نسبة تغيّر (↑ أخضر / ↓ أحمر) + sparkline صغير اختياريّ.',
      'تخطيط: KPIs أعلى → صفّ مخطّطات (grid 2 عمود) → جدول بيانات. شريط فلترة علويّ (dropdown فئة + نطاق تاريخ). شريط جانبي طيّ اختياريّ.',
      'طباعة التقرير: زرّ → @media print{ .no-print{display:none!important} body{background:#fff;color:#000} }.',
      'تحديث محاكاة: setInterval كلّ 5 ثوانٍ يُحدّث القيم بتذبذب واقعيّ (±Math.random()*5%). badge "مباشر 🟢".',
    ].join('\n'),
  },

  mapsAdvanced: {
    name: 'خرائط متقدّمة',
    keywords: ['رسم على الخريطة','draw','قياس','measure','تجميع','cluster','حراري','heatmap','مسار','route','routing','تتبع','track','geofence','كثافة','density','marker cluster','خطوط متساوية'],
    instructions: [
      '— مهارة: خرائط متقدّمة —',
      `رسم أشكال: ضمّن <link href="${CDN.leafletDrawCSS}" rel="stylesheet"><script src="${CDN.leafletDraw}"></script>. new L.Control.Draw({draw:{polygon:true,polyline:true,rectangle:true,circle:true,marker:true},edit:{featureGroup:drawnItems}}). حساب turf.area + turf.length.`,
      `تجميع العلامات: ضمّن <link href="${CDN.clusterCSS}" rel="stylesheet"><link href="${CDN.clusterDefCSS}" rel="stylesheet"><script src="${CDN.markerCluster}"></script>. var markers=L.markerClusterGroup(); markers.addLayers(pointArray); map.addLayer(markers).`,
      `خريطة حراريّة: ضمّن <script src="${CDN.leafletHeat}"></script>. L.heatLayer(latlngs,{radius:25,blur:15,maxZoom:17}).addTo(map).`,
      'أدوات قياس: بوليلاين → turf.length(line,{units:"kilometers"}).toFixed(2)+" كم". بوليغون → (turf.area(poly)/1e6).toFixed(3)+" كم²".',
      'طبقات أساس: L.control.layers({"خرائط Google":googleStreets,"أقمار صناعيّة":googleSat,"OpenStreetMap":osmLayer},{overlays}).addTo(map).',
    ].join('\n'),
  },

  exportPrint: {
    name: 'التصدير والطباعة',
    keywords: ['تصدير','export','PDF','طباعة','print','تحميل','download','صورة','image','CSV','Excel','ملف','مشاركة','share','GeoJSON','screenshot'],
    instructions: [
      '— مهارة: التصدير والطباعة —',
      `CSV: إن توفّر Papa ← Papa.unparse(data)، وإلّا يدوي: cols.join(",")+rows.map(r=>vals.join(",")).join("\\n"). → new Blob(["\\uFEFF"+csv],{type:"text/csv"}) → URL.createObjectURL → a.click(). ضمّن: <script src="${CDN.papaparse}"></script>.`,
      `صورة PNG: ضمّن <script src="${CDN.html2canvas}"></script>. html2canvas(document.querySelector("#target")).then(c=>{const a=document.createElement("a");a.download="export.png";a.href=c.toDataURL();a.click()}).`,
      `PDF: ضمّن أيضاً <script src="${CDN.jspdf}"></script>. html2canvas(el).then(c=>{const pdf=new jspdf.jsPDF();pdf.addImage(c.toDataURL("image/jpeg"),0,0,210,c.height*210/c.width);pdf.save("report.pdf")}).`,
      'GeoJSON: JSON.stringify(featureCollection,null,2) → Blob("application/json") → a.download="data.geojson".',
      'طباعة: @media print { .no-print{display:none!important} body{background:#fff!important;color:#000!important} }. زرّ window.print().',
    ].join('\n'),
  },

  crud: {
    name: 'إدارة السجلات',
    keywords: ['حفظ','save','تعديل','edit','حذف','delete','إدارة','manage','سجل','record','قاعدة','database','CRUD','إضافة','add','مخزون','inventory','أرشيف','archive','عملاء','customers','موظفين','employees','منتجات','products'],
    instructions: [
      '— مهارة: إدارة السجلات (CRUD + localStorage) —',
      'تخزين: const DB="app_data"; const load=()=>JSON.parse(localStorage.getItem(DB)||"[]"); const save=d=>localStorage.setItem(DB,JSON.stringify(d));',
      'إضافة: نموذج → {id:crypto.randomUUID(), ...fields, createdAt:new Date().toISOString()} → push → save → renderList().',
      'تعديل: ملء النموذج بالبيانات → عند الحفظ: find+assign → save → renderList(). حذف: confirm("هل أنت متأكّد؟") → filter → save → renderList().',
      'قائمة: بحث فوري + ترتيب + ترقيم صفحات. عداد إجماليّ. عرض "لا توجد سجلات" إن فارغ.',
      'نسخة احتياطيّة: زرّ تصدير JSON (Blob+download). زرّ استيراد (input[type=file] → FileReader → JSON.parse → save → render).',
    ].join('\n'),
  },

  layout: {
    name: 'التخطيط المتقدّم',
    keywords: ['تبويب','tab','قائمة جانب','sidebar','modal','نافذة منبثقة','accordion','drawer','بطاقات','cards','wizard','steps','خطوات','تبويبات','أقسام','sections','شريط جانبي'],
    instructions: [
      '— مهارة: التخطيط المتقدّم —',
      'تبويبات: أزرار [data-tab] → document.querySelectorAll(".tab-content").forEach(el=>el.hidden=el.id!==activeId). مؤشّر نشط: border-bottom 2px solid accent.',
      'شريط جانبي: width:280px + transform:translateX(100%) + transition:0.3s. زرّ ☰ لفتح/إغلاق. overlay شفّاف للإغلاق بالنقر خارجه.',
      'Modal: position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,0.5). محتوى centered بـmax-width:500px. إغلاق: نقر الخلفيّة أو Escape أو زرّ ✕.',
      'Accordion: details/summary أو div+click toggle maxHeight. أيقونة ▸ تدور 90° عند الفتح. transition:0.3s.',
      'بطاقات: display:grid;gap:16px;grid-template-columns:repeat(auto-fill,minmax(280px,1fr)). border-radius:12px;box-shadow;padding:20px. hover: translateY(-2px).',
      'Toast: position:fixed;bottom:24px;left:50%;transform:translateX(-50%);. fadeIn→wait 3s→fadeOut→remove.',
    ].join('\n'),
  },

  realtime: {
    name: 'بيانات حيّة',
    keywords: ['حي','live','realtime','تحديث تلقائي','auto refresh','مباشر','polling','ساعة','clock','مؤقت','timer','countdown','عداد'],
    instructions: [
      '— مهارة: بيانات حيّة ومحاكاة —',
      'محاكاة: setInterval(()=>{values=values.map(v=>v*(1+(Math.random()-0.5)*0.1)); updateUI()},3000). badge "🟢 مباشر".',
      'ساعة: setInterval(()=>{el.textContent=new Date().toLocaleTimeString("ar-PS")},1000). عداد تنازلي: const end=Date.now()+ms; raf loop → remaining=end-Date.now(); format MM:SS.',
      'حالة اتصال: نقطة خضراء/حمراء + "متصل"/"غير متصل". addEventListener("online/offline").',
      'Skeleton loading: .skeleton{background:linear-gradient(90deg,#1a1e24 25%,#2b3038 50%,#1a1e24 75%);background-size:200%;animation:shimmer 1.5s infinite} @keyframes shimmer{to{background-position:-200%}}',
    ].join('\n'),
  },

  media: {
    name: 'الوسائط',
    keywords: ['صورة','image','gallery','معرض','فيديو','video','صوت','audio','سحب وإفلات','drag drop','رفع','upload','كاميرا','camera','QR','باركود'],
    instructions: [
      '— مهارة: الوسائط —',
      'معرض صور: grid auto-fill minmax(180px,1fr). نقر → lightbox modal (img بحجم كبير + أسهم سابق/تالي + Escape).',
      'رفع بالسحب: div.dropzone {border:2px dashed var(--border);padding:40px;text-align:center}. ondragover→e.preventDefault()+highlight. ondrop→Array.from(e.dataTransfer.files).forEach(processFile). معاينة: FileReader.readAsDataURL→img.src.',
      'QR: img.src=`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`. أو canvas-based مع مكتبة.',
      'فيديو مخصّص: <video> + أزرار play/pause + input[type=range] للتقدّم + عرض currentTime/duration.',
    ].join('\n'),
  },

  dataConnectors: {
    name: 'موصّلات البيانات (MCP)',
    keywords: ['API','بيانات خارجية','external data','overpass','OSM','طقس','weather','ارتفاع','elevation','geocode','ترميز جغرافي','REST','endpoint','open data','بيانات مفتوحة','حكومي','census','سكان','population'],
    instructions: [
      '— مهارة: موصّلات البيانات (MCP-style، بلا مفاتيح) —',
      'OpenStreetMap Overpass: const query=`[out:json][timeout:25];(node["amenity"="hospital"](31.5,34.8,32.6,35.6););out body;`; fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`).then(r=>r.json()).then(d=>{const fc={type:"FeatureCollection",features:d.elements.filter(e=>e.lat).map(e=>({type:"Feature",geometry:{type:"Point",coordinates:[e.lon,e.lat]},properties:{name:e.tags?.name||"",type:e.tags?.amenity||""}}))}; /* use fc */ }).',
      'طقس Open-Meteo (مجّاني): fetch(`https://api.open-meteo.com/v1/forecast?latitude=31.9&longitude=35.2&current=temperature_2m,relative_humidity_2m,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=Asia/Hebron&forecast_days=7`)',
      'ارتفاع Open-Elevation: fetch(`https://api.open-elevation.com/api/v1/lookup?locations=31.95,35.23|32.22,35.26`)',
      'ترميز جغرافيّ Nominatim: fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&limit=5&accept-language=ar`). حدّ: طلب/ثانية.',
      'معالجة الفشل: try/catch حول كلّ fetch. رسالة "⚠ تعذّر تحميل البيانات" مع زرّ "إعادة المحاولة". بيانات بديلة محلّيّة.',
    ].join('\n'),
  },

  accessibility: {
    name: 'إمكانيّة الوصول',
    keywords: ['a11y','accessibility','إمكانية الوصول','قارئ شاشة','screen reader','تباين','contrast','لوحة مفاتيح','keyboard','aria','ذوي الاحتياجات'],
    instructions: [
      '— مهارة: إمكانيّة الوصول (a11y) —',
      'دلالات: استخدم <nav>,<main>,<section>,<article>,<aside>,<header>,<footer> بدل <div> أينما ناسب. <button> للأفعال لا <div onclick>.',
      'ARIA: aria-label لأزرار الأيقونات، aria-live="polite" للتحديثات الحيّة، role="alert" للأخطاء، aria-expanded للقوائم.',
      'لوحة المفاتيح: tabindex="0" للعناصر التفاعليّة. مفتاح Escape يغلق modals. Enter/Space يُفعّل الأزرار. focus-visible outline.',
      'تباين: نصّ #C8CDD4 على خلفيّة #0A0B0D = نسبة >7:1. أزرار accent كبيرة بما يكفي. حجم خطّ ≥14px.',
    ].join('\n'),
  },
};

/**
 * كشف المهارات المناسبة من وصف المستخدم
 */
function detectSkills(prompt) {
  const p = (prompt || '').toLowerCase();
  const scored = [];
  for (const [id, skill] of Object.entries(SKILLS)) {
    let score = 0;
    for (const kw of skill.keywords) {
      if (p.includes(kw.toLowerCase())) score++;
    }
    if (score > 0) scored.push({ id, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 5).map((s) => s.id);
}

/**
 * بناء سياق المهارات لحقنه في البرومبت
 */
function buildSkillsContext(skillIds) {
  if (!skillIds || !skillIds.length) return '';
  const parts = skillIds.map((id) => SKILLS[id]?.instructions).filter(Boolean);
  if (!parts.length) return '';
  return '\n\n— مهارات مُفعَّلة لهذا الطلب (استخدم المكتبات والأنماط حسب الحاجة) —\n\n' + parts.join('\n\n');
}

/**
 * قوالب تطبيقات جاهزة — نقطة بداية بنقرة واحدة
 */
const TEMPLATES = [
  {
    id: 'population-dashboard',
    icon: '📊',
    title: 'لوحة بيانات السكّان',
    desc: 'خريطة + مخطّطات + مؤشّرات KPI لمدن فلسطين',
    prompt: 'ابنِ لوحة بيانات تفاعليّة لسكّان المدن الفلسطينيّة الرئيسيّة: خريطة ملوّنة حسب عدد السكان (choropleth)، أربع بطاقات KPI (إجمالي السكان، عدد المدن، متوسّط الكثافة، أكبر مدينة)، مخطّط أعمدة لأكبر 10 مدن، ومخطّط دائري لتوزيع السكان بالمحافظات. أضف فلترة بالمحافظة وتصدير CSV.',
  },
  {
    id: 'land-use',
    icon: '🗺️',
    title: 'مستكشف استعمالات الأراضي',
    desc: 'خريطة تفاعليّة بطبقات وفلاتر وإحصائيّات',
    prompt: 'ابنِ تطبيق مستكشف استعمالات الأراضي: خريطة بطبقات ملوّنة (سكني=أخضر، تجاري=أزرق، زراعي=أصفر، صناعي=أحمر، خدمات=بنفسجي)، لوحة طبقات لتبديل الظهور، مفتاح ألوان، إحصائيّات (مساحة كلّ نوع بالكم²)، ومخطّط دائري للنِّسَب. بيانات تجريبيّة لمدينة نابلس.',
  },
  {
    id: 'field-survey',
    icon: '📋',
    title: 'نموذج مسح ميدانيّ',
    desc: 'استمارة متعدّدة الخطوات + GPS + رفع صور + تصدير',
    prompt: 'ابنِ تطبيق مسح ميدانيّ متعدّد الخطوات: الخطوة 1 (معلومات الموقع: اسم، إحداثيات من GPS أو نقر الخريطة، عنوان)، الخطوة 2 (تفاصيل: نوع المنشأة dropdown، حالة المبنى radio، ملاحظات textarea، رفع صورة مع معاينة)، الخطوة 3 (مراجعة وإرسال). احفظ في localStorage، اعرض جدول السجلات مع بحث وتصدير CSV و GeoJSON.',
  },
  {
    id: 'weather-monitor',
    icon: '🌤️',
    title: 'لوحة مراقبة الطقس',
    desc: 'بيانات حيّة من Open-Meteo + مخطّطات + خريطة',
    prompt: 'ابنِ لوحة مراقبة طقس تفاعليّة: اجلب بيانات الطقس الحقيقيّة من Open-Meteo API لثلاث مدن فلسطينيّة (نابلس، رام الله، الخليل). اعرض: بطاقات KPI (درجة حرارة حاليّة، رطوبة، سرعة رياح)، مخطّط خطّي لتوقّعات 7 أيام (حرارة عظمى/صغرى)، مخطّط أعمدة للأمطار، وخريطة بعلامات المدن مع popup يعرض الطقس. تحديث تلقائي كلّ 5 دقائق.',
  },
  {
    id: 'facility-manager',
    icon: '🏢',
    title: 'مدير المرافق والمنشآت',
    desc: 'CRUD كامل + خريطة + بحث + تصدير',
    prompt: 'ابنِ تطبيق إدارة مرافق: نموذج إضافة (اسم، نوع dropdown، عنوان، إحداثيات بالنقر على الخريطة، هاتف، حالة التشغيل). جدول تفاعلي بكلّ المرافق (بحث، ترتيب، ترقيم صفحات). خريطة بعلامات المرافق ملوّنة حسب النوع مع popup التفاصيل. تعديل وحذف. إحصائيّات: عدد لكلّ نوع + مخطّط دائري. حفظ localStorage + تصدير CSV و GeoJSON.',
  },
  {
    id: 'route-analyzer',
    icon: '🛣️',
    title: 'محلّل المسارات',
    desc: 'رسم مسارات + حساب مسافة + تحليل مكاني',
    prompt: 'ابنِ تطبيق تحليل مسارات: أدوات رسم على الخريطة (خط لمسار، مضلّع لمنطقة، علامة لنقطة اهتمام). لكلّ مسار: حساب المسافة بالكم (Turf)، عدد نقاط الاهتمام القريبة (buffer + pointsWithinPolygon). لكلّ منطقة: حساب المساحة بالكم². لوحة جانبيّة تعرض القياسات. طبقات أساس متعدّدة (streets + satellite). تصدير الأشكال كـGeoJSON.',
  },
  {
    id: 'interactive-report',
    icon: '📈',
    title: 'تقرير تفاعليّ',
    desc: 'عرض بيانات بمخطّطات + جدول + طباعة PDF',
    prompt: 'ابنِ تقريراً تفاعليّاً عن البنية التحتيّة في المحافظات الفلسطينيّة: قسم مؤشّرات KPI (إجمالي المشاريع، الميزانيّة، نسبة الإنجاز، المتأخّر). قسم مخطّطات (أعمدة: مشاريع لكلّ محافظة، خطّي: تقدّم شهريّ، دائري: توزيع القطاعات). جدول تفصيليّ بالمشاريع (بحث + فلتر + ترتيب). زرّ تصدير PDF وزرّ طباعة بتنسيقٍ نظيف.',
  },
  {
    id: 'city-guide',
    icon: '🏛️',
    title: 'دليل المدينة التفاعلي',
    desc: 'POIs حقيقيّة من OSM + تصنيف + بحث + توجيه',
    prompt: 'ابنِ دليل مدينة تفاعلي لنابلس: اجلب نقاط الاهتمام الحقيقيّة من OpenStreetMap عبر Overpass API (مطاعم، مساجد، مستشفيات، مدارس، حدائق). اعرضها على خريطة بأيقونات مختلفة حسب النوع مع MarkerCluster. شريط بحث بالاسم، فلتر بالتصنيف (أزرار). بطاقة تفاصيل عند النقر (اسم، نوع، عنوان). عدّاد لكلّ تصنيف. تصميم جوّال أوّلاً.',
  },
];

module.exports = { CDN, SKILLS, detectSkills, buildSkillsContext, TEMPLATES };
