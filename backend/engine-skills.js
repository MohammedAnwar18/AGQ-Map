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
  esriLeaflet:   'https://cdnjs.cloudflare.com/ajax/libs/esri-leaflet/3.0.12/esri-leaflet.js',
  echarts:       'https://cdnjs.cloudflare.com/ajax/libs/echarts/5.5.0/echarts.min.js',
  maplibre:      'https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/4.7.1/maplibre-gl.js',
  maplibreCSS:   'https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/4.7.1/maplibre-gl.css',
  three:         'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
  gsap:          'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js',
  jsts:          'https://cdnjs.cloudflare.com/ajax/libs/jsts/2.12.1/jsts.min.js',
  d3:            'https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js',
  georaster:     'https://cdn.jsdelivr.net/npm/georaster@1.6.0/dist/georaster.browser.bundle.min.js',
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

  arcgis: {
    name: 'موصّل ArcGIS REST',
    keywords: ['arcgis','esri','mapserver','featureserver','imageserver','rest services','rest/services','geomolg','orthophoto','أورثوفوتو','أورثو','خدمة طبقات','خادم طبقات','قسائم','قطع أراضي','مخطط هيكلي','طبقات حكومية'],
    instructions: [
      '— مهارة: موصّل ArcGIS REST (طبقات جغرافيّة حيّة) —',
      'الطريقة الموثوقة والافتراضيّة: جلب كلّ طبقة كـGeoJSON عبر نقطة query (تدعم CORS وتعيد الإسقاط إلى 4326) ورسمها بـLeaflet العاديّ. لا تعتمد على esri featureLayer ولا dynamicMapLayer الافتراضيّ لأنّ نقطة export في خوادم مثل GeoMOLG بلا CORS فتظهر الطبقة فارغة.',
      'لكلّ طبقة: fetch("<serviceUrl>/<MapServer|FeatureServer>/<layerId>/query?where=1%3D1&outFields=*&outSR=4326&returnGeometry=true&f=geojson&resultRecordCount=4000").then(r=>r.json()).then(gj=>{ const lyr=L.geoJSON(gj,{ style:{color:"#E07B39",weight:1.5,fillColor:"#E07B39",fillOpacity:0.2}, pointToLayer:(f,ll)=>L.circleMarker(ll,{radius:5,color:"#E07B39",fillColor:"#F0954F",fillOpacity:0.85,weight:1}), onEachFeature:(f,l)=>{ if(f.properties) l.bindPopup(Object.entries(f.properties).slice(0,12).map(([k,v])=>"<b>"+k+"</b>: "+v).join("<br>")); } }).addTo(map); try{ map.fitBounds(lyr.getBounds()); }catch(e){} });',
      'طبقات نقطيّة/مُبلّطة لا تدعم query (أورثوفوتو صور): استعمل صورة ديناميكيّة فقط: L.esri.dynamicMapLayer({url:"<serviceUrl>/MapServer", f:"image", useCors:false, opacity:0.9}).addTo(map) — f:"image" يحمّلها كصورة مباشرة بلا حاجة CORS.',
      'الإسناد يُدار خادميّاً: outSR=4326 في الاستعلام و f:"image" في الصورة يعيدان الإسقاط تلقائياً من PG1923 (wkid 28191) إلى Web Mercator — لا تحوّل يدويّاً.',
      'عدّة طبقات: ارسم كلّ معرّف بنداء مستقلّ، وأضِف L.control.layers لتبديل الظهور. عالِج فشل الجلب برسالةٍ واضحة وزرّ إعادة. استخدم رابط الخدمة ومعرّفات الطبقات حرفيّاً كما تُعطى.',
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

  // مهارة التصميم المميّز — مقتبسة ومُكيَّفة من Anthropic frontend-design
  design: {
    name: 'التصميم المميّز',
    keywords: ['تصميم','design','واجهة','ui','ux','عصري','modern','أنيق','احترافي','هوية','identity','جمالي','جميل','شكل','لوك','look','aesthetic','landing','صفحة هبوط','بورتفوليو','portfolio','ستايل','style','ثيم'],
    instructions: [
      '— مهارة: التصميم المميّز (هوية بصريّة لا تبدو مُولّدة آليّاً) —',
      'اعمل كمدير تصميم: اتّخذ قراراتٍ مقصودةً خاصّةً بموضوع التطبيق (صناعته ومفرداته البصريّة) بدل القوالب العامّة. «اصرف جرأتك في مكانٍ واحد»: أبرِز عنصراً واحداً مميّزاً وأبقِ ما حوله هادئاً منضبطاً، واحذف أيّ زينةٍ لا تخدم الهدف.',
      'تجنّب أكثر الأنماط التي تفضح التوليد الآليّ: خلفيّة كريميّة (#F4F1EA) مع لمسة طينيّة (#D97757)؛ أسود شبه تامّ مع لمسةٍ أخضر/أحمر فاقعٍ واحد؛ تقطيع كلّ المحتوى إلى بطاقاتٍ متطابقةٍ بنفس نصف القطر ونفس الظلّ الرماديّ الناعم؛ أوشحة تدرّجٍ كزينة؛ إيبرو ALL-CAPS متباعدٌ فوق كلّ عنوان؛ ربط ميتا بنقاطٍ وسطيّة («أ · ب · ج»)؛ علامة «→» في نهاية الأزرار؛ أرقام 01/02/03 إلّا إن كان المحتوى تسلسلاً فعليّاً.',
      'الطباعة تحمل الشخصيّة: عائلةٌ واحدة أو اثنتان واضحتا التمييز، ومقياسٌ طباعيّ متعمّد بأوزانٍ مقصودة؛ ولا تُبرِز كلمةً واحدةً في العنوان بلونٍ أو مائل. اجعل طول السطر أقلّ من 80 محرفاً.',
      'البنية معلومةٌ لا زينة: الحدود والفواصل والترقيم تُستعمَل فقط حين تنقل معنى. الحركة باعتدال: لحظةٌ واحدةٌ منسّقةٌ عند التحميل أفضل من تأثيراتٍ مبعثرة، والحركة التي تستجيب لفعل المستخدم مُرحَّبٌ بها؛ احترم prefers-reduced-motion.',
      'الكتابة جزءٌ من التصميم: صوتٌ فعّال، وأسماء بلغة المستخدم، وأزرارٌ تقول ما سيحدث بالضبط («احفظ التغييرات» لا «إرسال»)، وحالات الفراغ/الخطأ توجيهٌ لا مزاج.',
      'قبل الكود: ضع لوحةً مختصرة (4–6 ألوانٍ مسمّاة + الخطوط + مفهوم تخطيط) ثمّ راجِعها — لو أيّ جزءٍ يشبه ما ستنتجه لأيّ طلبٍ مشابه، غيّره واجعله خاصّاً بهذا الطلب.',
    ].join('\n'),
  },

  // مهارة الثيمات — لوحات ألوان احترافيّة جاهزة (مقتبسة من Anthropic theme-factory)
  themes: {
    name: 'ثيمات الألوان',
    keywords: ['ثيم','theme','ألوان','palette','لون','colors','تدرج','داكن','dark','فاتح','light','هوية بصرية','نمط ألوان','لوحة ألوان','scheme','خطوط','fonts'],
    instructions: [
      '— مهارة: ثيمات ألوانٍ احترافيّة جاهزة —',
      'اختر لوحةً تناسب موضوع التطبيق وعرّفها كمتغيّرات CSS في :root (خلفيّة/سطح/نصّ/تمييز/دلالات) والتزم بها في كلّ مكان. لوحاتٌ جاهزة (الأساس · التمييز · داكن · فاتح):',
      '• ابتكار تقنيّ: #0066FF · #00FFFF · #1E1E1E · #FFFFFF — للتقنية والذكاء الاصطناعيّ.',
      '• أعماق المحيط: #1A2332 · #2D8B8B · #A8DADC · #F1FAEE — هادئٌ احترافيّ.',
      '• ساعة ذهبيّة: #F4A900 · #C1666B · #4A403A · #D4B896 — دافئٌ راقٍ.',
      '• غروب بوليفارد: #E76F51 · #F4A261 · #264653 · #E9C46A — نابضٌ ودود.',
      '• مجرّة منتصف الليل: #4A4E8F · #A490C2 · #2B1E3E · #E6E6FA — عصريٌّ أنيق.',
      '• مظلّة الغابة: #2D4A2B · #A4AC86 · #FAF9F6 · #7D8471 — طبيعيٌّ هادئ.',
      '• حديقة نباتيّة: #4A7C59 · #F9A620 · #B7472A · #F5F3ED — حيويٌّ عضويّ.',
      '• بساطةٌ حديثة: #36454F · #708090 · #FFFFFF · #D3D3D3 — رسميٌّ نظيف.',
      '• صقيع قطبيّ: #4A6FA5 · #D4E4F7 · #FAFAFA · #C0C0C0 — خفيفٌ أنيق.',
      '• وردة الصحراء: #B87D6D · #D4A5A5 · #5D2E46 · #E8D5C4 — ناعمٌ راقٍ.',
      'خطوط مقترحة (Google Fonts): عناوين Tajawal/Cairo للعربيّة، وInter/Manrope للّاتينيّة. يمكنك توليد لوحةٍ مخصّصةٍ متناسقةٍ إن لم تناسب أيٌّ منها، مع ضمان تباين WCAG AA.',
    ].join('\n'),
  },

  // مهارة الحركة — أنيميشن واعٍ ومنضبط
  motion: {
    name: 'الحركة والانتقالات',
    keywords: ['حركة','انيميشن','أنيميشن','animation','transition','انتقال','تأثير','effect','تمرير','scroll','parallax','بارالاكس','reveal','ظهور متدرج','micro','hover','تحريك','motion'],
    instructions: [
      '— مهارة: الحركة والانتقالات (بذوقٍ واعتدال) —',
      'المبدأ: لحظةٌ واحدةٌ منسّقةٌ عند التحميل، أو كشفٌ واحدٌ، أفضل من تأثيراتٍ مبعثرة. الحركة التي تستجيب لفعل المستخدم (فتح/تأكيد/توسيع) مُرحَّبٌ بها. التزِم دائماً: @media (prefers-reduced-motion: reduce){*{animation:none!important;transition:none!important}}.',
      'CSS أوّلاً: transition:transform .2s, opacity .2s للأزرار والبطاقات؛ و@keyframes للظهور (fade/slide/scale) بمنحنى cubic-bezier لطيف. حرّك transform وopacity فقط للأداء (تجنّب تحريك left/top/width).',
      'كشفٌ عند التمرير بلا مكتبة: const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add("in");io.unobserve(e.target)}}),{threshold:.15}); document.querySelectorAll(".reveal").forEach(el=>io.observe(el)); مع .reveal{opacity:0;transform:translateY(16px);transition:.6s} .reveal.in{opacity:1;transform:none}.',
      `جاهز (اختياريّ): animate.css عبر <link rel="stylesheet" href="${CDN.animateCSS}"> ثمّ class="animate__animated animate__fadeInUp".`,
      `تتابعٌ متقدّم لمشهدٍ واحدٍ مهمّ فقط (اختياريّ): GSAP عبر <script src="${CDN.gsap}"></script> ثمّ gsap.from(".item",{y:24,opacity:0,stagger:.08,duration:.6,ease:"power2.out"}).`,
      `احتفاءٌ بنجاحٍ مهمّ: <script src="${CDN.confetti}"></script> ثمّ confetti({particleCount:120,spread:70}).`,
    ].join('\n'),
  },

  // مهارة 3D — خرائط تضاريس ومجسّمات (بلا مفاتيح)
  map3d: {
    name: 'خرائط ومجسّمات 3D',
    keywords: ['3d','ثلاثي الأبعاد','ثلاثيّ الأبعاد','تضاريس','terrain','مجسم','مجسّم','كرة أرضية','globe','مبانٍ','مباني','extrusion','بثق','dem','ارتفاعات','ثري دي','three','maplibre','منظور','pitch','tilt','ميلان'],
    instructions: [
      '— مهارة: خرائط ومجسّمات ثلاثيّة الأبعاد (بلا مفاتيح) —',
      `خريطة 3D بتضاريس حقيقيّة (MapLibre GL): ضمّن <link href="${CDN.maplibreCSS}" rel="stylesheet"><script src="${CDN.maplibre}"></script>. ثمّ:`,
      'const map=new maplibregl.Map({container:"map",center:[35.23,31.95],zoom:11,pitch:62,bearing:-18,maxPitch:85,style:{version:8,sources:{osm:{type:"raster",tiles:["https://a.tile.openstreetmap.org/{z}/{x}/{y}.png","https://b.tile.openstreetmap.org/{z}/{x}/{y}.png"],tileSize:256,attribution:"© OpenStreetMap"},dem:{type:"raster-dem",tiles:["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],encoding:"terrarium",tileSize:256,maxzoom:13}},layers:[{id:"osm",type:"raster",source:"osm"},{id:"hills",type:"hillshade",source:"dem"}],terrain:{source:"dem",exaggeration:1.5},sky:{}}}); map.addControl(new maplibregl.NavigationControl({visualizePitch:true}));',
      'طبقات/مبانٍ مبثوقة (fill-extrusion) من GeoJSON فيه خاصيّة ارتفاع: map.on("load",()=>{map.addSource("b",{type:"geojson",data:fc}); map.addLayer({id:"b3d",type:"fill-extrusion",source:"b",paint:{"fill-extrusion-color":"#E07B39","fill-extrusion-height":["get","height"],"fill-extrusion-base":0,"fill-extrusion-opacity":.85}})});',
      `مشاهد 3D عامّة (Three.js r128 — كرة أرضيّة/تصوّر بيانات): ضمّن <script src="${CDN.three}"></script>. أنشئ scene + PerspectiveCamera + WebGLRenderer({antialias:true})؛ أضِف AmbientLight + DirectionalLight؛ ادفع الرسم بـrequestAnimationFrame مع mesh.rotation.y+=0.003؛ وعالِج تغيّر الحجم (camera.aspect=w/h; camera.updateProjectionMatrix(); renderer.setSize(w,h)). للكرة: SphereGeometry + MeshPhongMaterial بخامة.`,
      'أداء: حمّل maplibre/three فقط عند الحاجة الفعليّة لـ3D؛ وللخرائط ثنائيّة الأبعاد العاديّة استعمل Leaflet كالمعتاد.',
    ].join('\n'),
  },

  // مهارة الرسوم المتقدّمة — ECharts لما يعجز Chart.js
  chartsAdvanced: {
    name: 'رسوم بيانيّة متقدّمة',
    keywords: ['echarts','حراري','heatmap','treemap','شجري','sankey','تدفق','سانكي','gauge','عداد قياس','جيدج','قمع','funnel','candlestick','شمعة','شموع','شبكة علاقات','graph','network','مبعثر ضخم','مخطط متقدم','تريماب','sunburst','boxplot'],
    instructions: [
      '— مهارة: رسوم بيانيّة متقدّمة (Apache ECharts 5) —',
      `استعملها لما تعجز Chart.js. ضمّن <script src="${CDN.echarts}"></script>. ثمّ const chart=echarts.init(document.getElementById("c"),null,{renderer:"canvas"}); chart.setOption(option); window.addEventListener("resize",()=>chart.resize());`,
      'أنواعٌ قويّة: heatmap (+visualMap)، treemap، sankey (nodes+links)، gauge (عدّادات)، funnel (قمع)، graph (شبكة علاقات force)، candlestick (شموع ماليّة)، sunburst، boxplot، scatter ضخم.',
      'Sankey: {series:[{type:"sankey",data:[{name:"أ"},{name:"ب"},{name:"ج"}],links:[{source:"أ",target:"ب",value:10},{source:"ب",target:"ج",value:6}],emphasis:{focus:"adjacency"}}]}.',
      'Gauge: {series:[{type:"gauge",progress:{show:true},max:100,data:[{value:72,name:"الإنجاز"}]}]}.',
      'Heatmap: {tooltip:{},grid:{height:"60%"},xAxis:{type:"category",data:xs},yAxis:{type:"category",data:ys},visualMap:{min:0,max:100,calculable:true,orient:"horizontal",left:"center",bottom:"2%"},series:[{type:"heatmap",data:[[0,0,45],[1,0,80]]}]}.',
      'التصميم: color:[ألوان التطبيق]، backgroundColor:"transparent"، textStyle:{color:"#C8CDD4"}، ومحاور خافتة. تحديثٌ حيّ: chart.setOption({series:[{data:newData}]}).',
    ].join('\n'),
  },

  // مهارة الطوبولوجيا المتقدّمة — JSTS (منفذ JTS) لعمليّاتٍ هندسيّةٍ قويّة يصعب على Turf ضمانها
  topology: {
    name: 'التحليل المكانيّ المتقدّم (JSTS)',
    keywords: ['اتحاد','union','تقاطع','intersection','فرق هندسي','difference','symmetric','طوبولوجيا','topology','تبسيط مضلع','simplify','تصحيح هندسة','صلاحية هندسة','geometry valid','دمج مضلعات','merge polygons','علاقة مكانية','spatial relation','مغلف محدب','convex hull','overlay','jsts','طبقات متراكبة','تراكب'],
    instructions: [
      '— مهارة: التحليل المكانيّ المتقدّم والطوبولوجيا (JSTS) —',
      `استعملها للعمليّات الهندسيّة القويّة التي يصعب على Turf ضمانها على المضلّعات المعقّدة/المتعدّدة. ضمّن <script src="${CDN.jsts}"></script> (المتغيّر العامّ jsts). حوّل بين GeoJSON وهندسة JSTS:`,
      'const reader=new jsts.io.GeoJSONReader(), writer=new jsts.io.GeoJSONWriter(); const a=reader.read(geojsonA.geometry), b=reader.read(geojsonB.geometry);',
      'عمليّات التراكب: a.union(b) اتحاد · a.intersection(b) تقاطع · a.difference(b) فرق · a.symDifference(b). النتيجة → writer.write(result) تُعيد هندسة GeoJSON ترسمها بـL.geoJSON({type:"Feature",geometry:result}).',
      'اتحاد طبقةٍ كاملةٍ بثبات: const geoms=features.map(f=>reader.read(f.geometry)); const merged=new jsts.operation.union.UnaryUnionOp(new jsts.geom.GeometryFactory().createGeometryCollection(geoms)).union();',
      'تصحيح هندسة غير صالحة: if(!g.isValid()) g=g.buffer(0);. تبسيطٌ يحفظ الطوبولوجيا: jsts.simplify.TopologyPreservingSimplifier.simplify(g, tolerance).',
      'علاقات مكانيّة دقيقة: a.contains(b) · within · crosses · overlaps · touches · intersects · disjoint. ومغلّف محدب: g.convexHull().',
      'ملاحظة مهمّة: buffer/المسافات في JSTS بوحدات إحداثيّات المدخل (درجات لـlat/lon) — للقياسات المتريّة (مساحة/مسافة/محيط بالمتر) ابقَ على Turf؛ واستعمل JSTS للطوبولوجيا والـoverlay القويّ وتصحيح الهندسة.',
    ].join('\n'),
  },

  // مهارة تحليل التضاريس بالمتصفّح — بديلٌ خفيف لـWhiteboxTools بلا خادم
  terrain: {
    name: 'تحليل التضاريس (DEM)',
    keywords: ['تضاريس','terrain','ارتفاع رقمي','نموذج ارتفاع','dem','hillshade','تظليل تضاريسي','ميل','slope','انحدار','اتجاه المنحدر','aspect','كنتور','contour','خطوط كنتور','منحنيات تسوية','isolines','تحليل تضاريس','استواء'],
    instructions: [
      '— مهارة: تحليل التضاريس بالمتصفّح (DEM → hillshade/slope/aspect/كنتور) —',
      'المبدأ: نقرأ شبكة ارتفاعات GeoTIFF (DEM) كاملةً في الذاكرة ونحسب المشتقّات بنافذة 3×3 (طريقة Horn)، ونرسم الناتج طبقةً فوق الخريطة. بلا خادم.',
      `قراءة الـDEM: ضمّن <script src="${CDN.georaster}"></script> ثمّ fetch(demUrl).then(r=>r.arrayBuffer()).then(parseGeoraster).then(g=>{ const z=g.values[0]; const W=g.width,H=g.height,cs=g.pixelWidth; const bounds=[[g.ymin,g.xmin],[g.ymax,g.xmax]]; const nd=g.noDataValue; /* احسب ثمّ ارسم */ });`,
      'جوار آمن: const at=(r,c)=>{const v=z[Math.min(H-1,Math.max(0,r))][Math.min(W-1,Math.max(0,c))]; return v===nd?0:v;};',
      'المشتقّات (Horn): dzdx=((at(r-1,c+1)+2*at(r,c+1)+at(r+1,c+1))-(at(r-1,c-1)+2*at(r,c-1)+at(r+1,c-1)))/(8*cs); dzdy=((at(r+1,c-1)+2*at(r+1,c)+at(r+1,c+1))-(at(r-1,c-1)+2*at(r-1,c)+at(r-1,c+1)))/(8*cs);',
      'الميل: slopeDeg=Math.atan(Math.hypot(dzdx,dzdy))*180/Math.PI. الاتّجاه: let a=Math.atan2(dzdy,-dzdx)*180/Math.PI; const aspect=(a<0?a+360:a). التظليل: const AZ=(360-315+90)*Math.PI/180,ALT=45*Math.PI/180,s=Math.atan(Math.hypot(dzdx,dzdy)),asp=Math.atan2(dzdy,-dzdx); const hs=255*Math.max(0,Math.cos(ALT)*Math.cos(s)+Math.sin(ALT)*Math.sin(s)*Math.cos(AZ-asp));',
      'العرض: أنشئ <canvas> بحجم W×H، املأ ImageData (رماديّ hs للتظليل، تدرّج لونيّ للميل/الاتّجاه)، ثمّ L.imageOverlay(canvas.toDataURL(),bounds,{opacity:0.85}).addTo(map); map.fitBounds(bounds). زرّ لتبديل الطبقة (تظليل/ميل/اتّجاه).',
      `الكنتور: ضمّن <script src="${CDN.d3}"></script>. flat=[].concat(...z); const lines=d3.contours().size([W,H]).thresholds(d3.range(min,max,step))(flat). حوّل إحداثيّات الشبكة إلى جغرافيّة: lng=g.xmin+col*g.pixelWidth, lat=g.ymax-row*g.pixelHeight، ثمّ ارسمها L.geoJSON(reprojected,{style:{color:"#E07B39",weight:1}}).addTo(map) مع label للارتفاع.`,
      'دقّة متريّة: إن كان الـDEM بالدرجات (lat/lon) فحجم الخليّة بالأمتار ≈ g.pixelWidth*111320*cos(خط العرض) لنتائج ميلٍ واقعيّة؛ للتظليل البصريّ القيمة التقريبيّة تكفي. أداء: للشبكات الكبيرة احسب مرّةً وخزّن، أو صغّر العيّنة.',
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
    title: 'لوحة بيانات السكّان',
    desc: 'خريطة + مخطّطات + مؤشّرات KPI لمدن فلسطين',
    prompt: 'ابنِ لوحة بيانات تفاعليّة لسكّان المدن الفلسطينيّة الرئيسيّة: خريطة ملوّنة حسب عدد السكان (choropleth)، أربع بطاقات KPI (إجمالي السكان، عدد المدن، متوسّط الكثافة، أكبر مدينة)، مخطّط أعمدة لأكبر 10 مدن، ومخطّط دائري لتوزيع السكان بالمحافظات. أضف فلترة بالمحافظة وتصدير CSV.',
  },
  {
    id: 'land-use',
    title: 'مستكشف استعمالات الأراضي',
    desc: 'خريطة تفاعليّة بطبقات وفلاتر وإحصائيّات',
    prompt: 'ابنِ تطبيق مستكشف استعمالات الأراضي: خريطة بطبقات ملوّنة (سكني=أخضر، تجاري=أزرق، زراعي=أصفر، صناعي=أحمر، خدمات=بنفسجي)، لوحة طبقات لتبديل الظهور، مفتاح ألوان، إحصائيّات (مساحة كلّ نوع بالكم²)، ومخطّط دائري للنِّسَب. بيانات تجريبيّة لمدينة نابلس.',
  },
  {
    id: 'field-survey',
    title: 'نموذج مسح ميدانيّ',
    desc: 'استمارة متعدّدة الخطوات + GPS + رفع صور + تصدير',
    prompt: 'ابنِ تطبيق مسح ميدانيّ متعدّد الخطوات: الخطوة 1 (معلومات الموقع: اسم، إحداثيات من GPS أو نقر الخريطة، عنوان)، الخطوة 2 (تفاصيل: نوع المنشأة dropdown، حالة المبنى radio، ملاحظات textarea، رفع صورة مع معاينة)، الخطوة 3 (مراجعة وإرسال). احفظ في localStorage، اعرض جدول السجلات مع بحث وتصدير CSV و GeoJSON.',
  },
  {
    id: 'weather-monitor',
    title: 'لوحة مراقبة الطقس',
    desc: 'بيانات حيّة من Open-Meteo + مخطّطات + خريطة',
    prompt: 'ابنِ لوحة مراقبة طقس تفاعليّة: اجلب بيانات الطقس الحقيقيّة من Open-Meteo API لثلاث مدن فلسطينيّة (نابلس، رام الله، الخليل). اعرض: بطاقات KPI (درجة حرارة حاليّة، رطوبة، سرعة رياح)، مخطّط خطّي لتوقّعات 7 أيام (حرارة عظمى/صغرى)، مخطّط أعمدة للأمطار، وخريطة بعلامات المدن مع popup يعرض الطقس. تحديث تلقائي كلّ 5 دقائق.',
  },
  {
    id: 'facility-manager',
    title: 'مدير المرافق والمنشآت',
    desc: 'CRUD كامل + خريطة + بحث + تصدير',
    prompt: 'ابنِ تطبيق إدارة مرافق: نموذج إضافة (اسم، نوع dropdown، عنوان، إحداثيات بالنقر على الخريطة، هاتف، حالة التشغيل). جدول تفاعلي بكلّ المرافق (بحث، ترتيب، ترقيم صفحات). خريطة بعلامات المرافق ملوّنة حسب النوع مع popup التفاصيل. تعديل وحذف. إحصائيّات: عدد لكلّ نوع + مخطّط دائري. حفظ localStorage + تصدير CSV و GeoJSON.',
  },
  {
    id: 'route-analyzer',
    title: 'محلّل المسارات',
    desc: 'رسم مسارات + حساب مسافة + تحليل مكاني',
    prompt: 'ابنِ تطبيق تحليل مسارات: أدوات رسم على الخريطة (خط لمسار، مضلّع لمنطقة، علامة لنقطة اهتمام). لكلّ مسار: حساب المسافة بالكم (Turf)، عدد نقاط الاهتمام القريبة (buffer + pointsWithinPolygon). لكلّ منطقة: حساب المساحة بالكم². لوحة جانبيّة تعرض القياسات. طبقات أساس متعدّدة (streets + satellite). تصدير الأشكال كـGeoJSON.',
  },
  {
    id: 'interactive-report',
    title: 'تقرير تفاعليّ',
    desc: 'عرض بيانات بمخطّطات + جدول + طباعة PDF',
    prompt: 'ابنِ تقريراً تفاعليّاً عن البنية التحتيّة في المحافظات الفلسطينيّة: قسم مؤشّرات KPI (إجمالي المشاريع، الميزانيّة، نسبة الإنجاز، المتأخّر). قسم مخطّطات (أعمدة: مشاريع لكلّ محافظة، خطّي: تقدّم شهريّ، دائري: توزيع القطاعات). جدول تفصيليّ بالمشاريع (بحث + فلتر + ترتيب). زرّ تصدير PDF وزرّ طباعة بتنسيقٍ نظيف.',
  },
  {
    id: 'city-guide',
    title: 'دليل المدينة التفاعلي',
    desc: 'POIs حقيقيّة من OSM + تصنيف + بحث + توجيه',
    prompt: 'ابنِ دليل مدينة تفاعلي لنابلس: اجلب نقاط الاهتمام الحقيقيّة من OpenStreetMap عبر Overpass API (مطاعم، مساجد، مستشفيات، مدارس، حدائق). اعرضها على خريطة بأيقونات مختلفة حسب النوع مع MarkerCluster. شريط بحث بالاسم، فلتر بالتصنيف (أزرار). بطاقة تفاصيل عند النقر (اسم، نوع، عنوان). عدّاد لكلّ تصنيف. تصميم جوّال أوّلاً.',
  },
];

module.exports = { CDN, SKILLS, detectSkills, buildSkillsContext, TEMPLATES };
