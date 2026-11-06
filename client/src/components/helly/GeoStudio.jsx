import React, { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import './GeoStudio.css';

/* ============================================================================
   PalNovaa Foresight — محلّل جيومكانيّ احترافيّ (GeoStudio)
   ----------------------------------------------------------------------------
   نظامٌ مكانيٌّ كامل يعمل في المتصفّح بلا خادم ولا مفاتيح:
     • رسمٌ دقيق (نقطة/خط/مضلّع/مستطيل/دائرة) مع الالتصاق بالرؤوس والتحرير.
     • محرّك تحليلٍ مكانيّ بمكتبة Turf.js: الهندسة والقياس، القرب والنطاقات،
       النمط والإحصاء المكانيّ (أقرب جار، LISA، Getis-Ord Gi*، موران، كثافة)،
       التحليل حسب الميتاداتا، وتراكب المضلّعات.
     • اختيار الموقع الأمثل (MCDA موزون) وباني النماذج الجيومكانيّة (ModelBuilder).
     • استيراد/تصدير GeoJSON، وبحثٌ عن المواقع (Nominatim، بلا مفتاح).
   المحرّك مكتوبٌ بأسلوبٍ تحكّميّ (Leaflet مباشرة) ومُحاطٌ بغلاف React، فكلّ
   الحسابات حتميّة: نفس المُدخل يعطي نفس المُخرج.
   ============================================================================ */

export default function GeoStudio({ onClose }) {
    const rootRef = useRef(null);

    useEffect(() => {
        const root = rootRef.current;
        if (!root) return;
        let cleanup = () => {};
        let cancelled = false;

        (async () => {
            const L = (await import('leaflet')).default;
            // leaflet-draw يتوقّع L عالميّاً قبل تقييمه
            if (typeof window !== 'undefined') window.L = L;
            await import('leaflet-draw');
            const turf = await import('@turf/turf');
            if (cancelled) return;
            cleanup = startStudio(root, L, turf, { onClose });
        })();

        return () => { cancelled = true; try { cleanup(); } catch (e) { /* noop */ } };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="geo-studio" dir="rtl" ref={rootRef} data-theme="dark">
            {/* ===================== شريط الأوامر العلويّ ===================== */}
            <div id="topbar">
                <div className="brand">
                    <span className="mk" aria-hidden="true">◎</span>
                    <span className="brand-txt">محلّل جيومكانيّ<small>PalNovaa Foresight · تحليل مكانيّ ونمذجة</small></span>
                </div>

                <div className="gs-search">
                    <span className="gs-search-ico" aria-hidden="true">⌕</span>
                    <input id="gsSearch" type="text" placeholder="ابحث عن موقع على الخريطة…" autoComplete="off" spellCheck="false" />
                    <button id="gsSearchBtn" className="gs-search-go" title="بحث">انتقال</button>
                    <div id="gsSearchRes" className="gs-search-res" />
                </div>

                <div className="spacer" />
                <button className="tbtn ghost" id="btnTheme" title="الوضع الليليّ/النهاريّ">◐</button>
                <button className="tbtn" id="btnImport"><span className="ic">⬇</span> استيراد</button>
                <button className="tbtn ghost" id="btnExport" title="تصدير النتائج GeoJSON"><span className="ic">⬆</span> تصدير</button>
                <button className="tbtn ghost" id="btnClear">مسح</button>
                {onClose && <button className="tbtn ghost gs-close" id="btnClose" title="إغلاق" onClick={onClose}>✕</button>}
            </div>

            {/* ===================== الجسم ===================== */}
            <div id="main">
                <div id="map" />
                <div id="coords">
                    <span>Lat <b id="cLat">—</b></span><span className="sep" />
                    <span>Lng <b id="cLng">—</b></span><span className="sep" />
                    <span id="cScale">—</span>
                </div>

                <aside id="rail">
                    <div className="railtabs">
                        <button className="railtab active" data-tab="tools"><span className="g">⚙</span> الأدوات</button>
                        <button className="railtab" data-tab="model"><span className="g">◇</span> النموذج</button>
                        <button className="railtab" data-tab="data"><span className="g">▤</span> البيانات</button>
                    </div>
                    <div id="railbody" style={{ position: 'relative' }}>

                        {/* ----------- لوحة الأدوات ----------- */}
                        <div className="pane active" id="toolsPane">
                            <div className="sec">
                                <div className="sechd"><span className="ico">✎</span> الرسم الدقيق على الخريطة</div>
                                <div className="toolrow">
                                    <button className="tool" data-draw="marker"><span className="g">📍</span>نقطة</button>
                                    <button className="tool" data-draw="polyline"><span className="g">⟋</span>خط</button>
                                    <button className="tool" data-draw="polygon"><span className="g">⬠</span>مضلّع</button>
                                    <button className="tool" data-draw="rectangle"><span className="g">▭</span>مستطيل</button>
                                    <button className="tool" data-draw="circle"><span className="g">◯</span>دائرة</button>
                                </div>
                                <div className="draw-opts">
                                    <label className="chk"><input type="checkbox" id="optSnap" defaultChecked /> الالتصاق بالرؤوس</label>
                                    <label className="chk"><input type="checkbox" id="optEdit" /> تحرير العناصر</label>
                                </div>
                            </div>

                            <div className="sec">
                                <div className="sechd"><span className="ico">⚙</span> خوارزميات التحليل المكانيّ
                                    <span className="tip" title="اختر عنصراً أو عدّة عناصر بالنقر عليها، أو اترك الكل. النتيجة تظهر بلونٍ مميّز على الخريطة.">؟</span>
                                </div>
                                <div className="opgrouphd">الهندسة والقياس</div>
                                <div className="ops" id="opsGeom" />
                                <div className="opgrouphd">القرب والنطاقات</div>
                                <div className="ops" id="opsProx" />
                                <div className="opgrouphd">النمط والإحصاء المكانيّ</div>
                                <div className="ops" id="opsStat" />
                                <div className="opgrouphd">تحليل حسب البيانات (الميتاداتا)</div>
                                <div className="ops" id="opsAttr" />
                                <div className="opgrouphd">تراكب المضلّعات</div>
                                <div className="ops" id="opsOverlay" />
                            </div>

                            <div className="sec">
                                <div className="sechd"><span className="ico">★</span> اختيار الموقع الأمثل
                                    <span className="tip" title="ترتيب المواقع من الأفضل إلى الأسوأ حسب عدّة معايير بأوزان.">؟</span>
                                </div>
                                <div style={{ padding: '0 14px 14px' }}>
                                    <button className="op star full" id="btnSuit" style={{ justifyContent: 'center' }}>
                                        <span className="g">⌖</span> أفضل / أسوأ موقع (ملاءمة بأوزان)<span className="badge">PRO</span>
                                    </button>
                                </div>
                            </div>

                            <div className="hint">
                                <strong>الخوارزمية تقرأ بياناتك:</strong> استورد عناصر لها خصائص رقمية (سكّان، شدّة، سعر…)،
                                وستتعرّف الأدوات تلقائياً على الحقول. جرّب <span className="k">Getis-Ord Gi*</span> للبقع الساخنة،
                                و<span className="k">IDW</span> لاستكمال سطح، و<span className="k">أفضل موقع</span> لترتيب المواقع بأوزان المعايير.
                            </div>
                        </div>

                        {/* ----------- لوحة النموذج ----------- */}
                        <div className="pane" id="modelPane">
                            <div className="mb-toolbar" id="mbToolbar" />
                            <div className="mb-chain" id="mbChain" />
                            <div className="mb-status" id="mbStatus" />
                            <div className="mb-run">
                                <button className="tbtn pri" id="mbRun" style={{ flex: 1, justifyContent: 'center' }}>▶ تشغيل النموذج</button>
                                <button className="tbtn ghost" id="mbClear">مسح</button>
                            </div>
                        </div>

                        {/* ----------- لوحة البيانات ----------- */}
                        <div className="pane" id="dataPane">
                            <div className="sec">
                                <div className="sechd"><span className="ico">▤</span> الطبقات
                                    <span className="tip" title="انقر اسم الطبقة لتحديد عناصرها للتحليل.">؟</span>
                                </div>
                                <div className="layers" id="layers" />
                                <div className="empty" id="layersEmpty">لا توجد طبقات بعد.<br />ارسم عنصراً أو استورد GeoJSON من الأعلى.</div>
                            </div>
                            <div className="hint">
                                <strong>الدقّة:</strong> كلّ القياسات تُحسب على القطع الناقص (WGS84) بمكتبة Turf.js —
                                المساحات بالكيلومتر المربّع، الأطوال بالكيلومتر، والإحداثيات بستّ منازل عشرية (دقّة ~٠٫١ متر).
                            </div>
                        </div>

                        {/* لوحة المعاملات تغطّي جسم الرّف */}
                        <div id="paramPanel">
                            <div className="ph"><span className="g" id="ppIco">◎</span> <span id="ppTitle">الأداة</span> <button className="back" id="ppBack">×</button></div>
                            <div className="pc" id="ppContent" />
                            <div className="pf"><button className="tbtn pri" id="ppRun" style={{ flex: 1, justifyContent: 'center' }}>تنفيذ التحليل</button></div>
                        </div>
                    </div>
                </aside>

                <section id="results">
                    <header><span className="g">▣</span> <span id="resTitle">النتيجة</span> <button id="resClose">×</button></header>
                    <div className="body" id="resBody" />
                </section>

                <div id="toast" />
            </div>

            {/* ===================== نافذة الاستيراد ===================== */}
            <div className="modal" id="importModal">
                <div className="mbox">
                    <header>⬇ استيراد طبقة GeoJSON <button id="imClose">×</button></header>
                    <div className="mbody">
                        <p>الصق كود GeoJSON، أو ارفع ملف <code>.geojson</code> / <code>.json</code>. يُدعم Feature و FeatureCollection و Geometry.
                            تُنقل خصائص (properties) العناصر الرقمية تلقائياً للاستخدام في الإحصاء المكانيّ.</p>
                        <textarea id="gjText" placeholder='{"type":"FeatureCollection","features":[ ... ]}' spellCheck="false" />
                        <div className="samples">
                            <span style={{ fontSize: '11.5px', color: 'var(--ink-soft)' }}>عيّنات:</span>
                            <button className="chip" data-sample="cities">مدن (بقيم سكّانية)</button>
                            <button className="chip" data-sample="route">مسار</button>
                            <button className="chip" data-sample="zones">مناطق</button>
                            <button className="chip" data-sample="incidents">حوادث (نقاط)</button>
                        </div>
                    </div>
                    <footer>
                        <button className="tbtn pri" id="gjLoad">تحميل</button>
                        <button className="tbtn ghost" id="gjFile">رفع ملف…</button>
                        <input type="file" id="fileInput" accept=".geojson,.json,application/geo+json,application/json" />
                    </footer>
                </div>
            </div>

            {/* ===================== نافذة إضافة عقدة ===================== */}
            <div className="modal" id="nodeModal">
                <div className="mbox">
                    <header>◇ إضافة عقدة للنموذج <button id="nmClose">×</button></header>
                    <div className="mbody" id="nmBody" />
                </div>
            </div>

            {/* ===================== نافذة الملاءمة ===================== */}
            <div className="modal" id="suitModal">
                <div className="mbox">
                    <header>⌖ اختيار الموقع الأمثل (ملاءمة متعدّدة المعايير) <button id="suClose">×</button></header>
                    <div className="mbody">
                        <p>تُرتَّب المواقع المرشّحة من <b>الأفضل</b> إلى <b>الأسوأ</b> حسب معايير بأوزان. كلّ معيار يُعاير (min-max)
                            ثم يُضرب بوزنه وتُجمع النتائج (٠–١٠٠). المعيار إمّا <b>حقل في البيانات</b> أو <b>القرب من طبقة أخرى</b>.</p>
                        <div id="suCandWrap" style={{ marginBottom: '12px' }} />
                        <div id="suCrit" />
                        <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                            <button className="mb-add" id="suAddField"><span className="g">＋</span> معيار من حقل</button>
                            <button className="mb-add" id="suAddDist"><span className="g">＋</span> معيار قرب من طبقة</button>
                        </div>
                        <div className="wtotal" id="suTotal" style={{ marginTop: '10px' }}><span>مجموع الأوزان</span><b>0%</b></div>
                    </div>
                    <footer>
                        <button className="tbtn pri" id="suRun" style={{ flex: 1, justifyContent: 'center' }}>تشغيل التحليل وترتيب المواقع</button>
                    </footer>
                </div>
            </div>
        </div>
    );
}

/* ============================================================================
   محرّك الاستوديو — يُشغَّل مرّة واحدة بعد تحميل Leaflet/Turf.
   كلّ البحث عن العناصر مُقيّدٌ بجذر المكوّن (root) كي لا يصطدم بباقي التطبيق.
   يُعيد دالّة تنظيفٍ تُزيل الخريطة ومستمعي الأحداث.
   ============================================================================ */
function startStudio(root, L, turf, opts) {
    'use strict';
    var $ = function (id) { return root.querySelector('#' + id); };
    var $$ = function (sel) { return root.querySelectorAll(sel); };
    function getCss(v) { return getComputedStyle(root).getPropertyValue(v).trim(); }
    var listeners = [];
    function on(target, type, fn) { target.addEventListener(type, fn); listeners.push([target, type, fn]); }

    // الوضع الافتراضيّ داكن (البيئة المحيطة داكنة)
    if (!root.getAttribute('data-theme')) root.setAttribute('data-theme', 'dark');

    // ===================================================================== MAP
    var map = L.map($('map'), { zoomControl: false, attributionControl: true }).setView([31.9, 35.2], 9);
    L.control.zoom({ position: 'topright' }).addTo(map);
    // خرائط Google (الطريق — العاديّة)
    var GOOGLE = 'https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
    var base = L.tileLayer(GOOGLE, { maxZoom: 20, subdomains: ['mt0', 'mt1', 'mt2', 'mt3'], attribution: 'خرائط Google · تحليل: Turf.js' }).addTo(map);
    function isDark() { return (root.getAttribute('data-theme') || 'dark') !== 'light'; }
    function syncBase() { /* خريطة Google واحدة للوضعين */ }
    syncBase();

    // قراءة الإحداثيّات والمقياس
    map.on('mousemove', function (e) { $('cLat').textContent = e.latlng.lat.toFixed(6); $('cLng').textContent = e.latlng.lng.toFixed(6); });
    function updScale() {
        var c = map.getCenter(), z = map.getZoom();
        var mPerPx = 40075016.686 * Math.abs(Math.cos(c.lat * Math.PI / 180)) / Math.pow(2, z + 8);
        var target = mPerPx * 80, p = Math.pow(10, Math.floor(Math.log10(target))), d = target / p, r = d >= 5 ? 5 : d >= 2 ? 2 : 1, dist = r * p;
        $('cScale').textContent = dist >= 1000 ? (dist / 1000) + ' كم' : Math.round(dist) + ' م';
    }
    map.on('zoomend moveend', updScale); updScale();

    // =================================================================== STATE
    var drawnItems = new L.FeatureGroup().addTo(map);
    var resultItems = new L.FeatureGroup().addTo(map);
    var layers = [];
    var selectedLayerIds = new Set();
    var uid = 1;

    function col(kind) { return kind === 'result' ? getCss('--geo-result') : kind === 'layer' ? getCss('--geo-layer') : getCss('--geo-draw'); }
    function fmt(n, d) { if (n === undefined || n === null || isNaN(n)) return '—'; return Number(n).toLocaleString('ar-EG', { maximumFractionDigits: d === undefined ? 2 : d }); }
    function fmtEn(n, d) { if (n === undefined || n === null || isNaN(n)) return '—'; return Number(n).toFixed(d === undefined ? 2 : d); }

    function toast(msg, type) { var t = $('toast'); var el = document.createElement('div'); el.className = 'tst' + (type ? ' ' + type : ''); el.textContent = msg; t.appendChild(el); setTimeout(function () { el.style.transition = 'opacity .3s'; el.style.opacity = '0'; setTimeout(function () { el.remove(); }, 300); }, 3400); }

    function styleFor(kind) { var c = col(kind); return { color: c, weight: 3, opacity: .95, fillColor: c, fillOpacity: kind === 'result' ? .2 : .13 }; }
    function pointMarker(ll, kind, val) { var c = col(kind); var r = val && val.r ? val.r : 7; return L.circleMarker(ll, { radius: r, color: '#fff', weight: 2, fillColor: (val && val.color) || c, fillOpacity: 1 }); }

    // =============================================================== ADD LAYER
    function addGeoJSON(gj, name, kind, oo) {
        kind = kind || 'layer'; oo = oo || {};
        var group = kind === 'result' ? resultItems : drawnItems;
        var count = 0;
        var gl = L.geoJSON(gj, {
            style: oo.style || function () { return styleFor(kind); },
            pointToLayer: oo.pointToLayer || function (f, ll) { return pointMarker(ll, kind); },
            onEachFeature: function (f, lyr) { count++; lyr._kind = kind; lyr._feature = f; attachSelect(lyr); bindInfoPopup(lyr, f); if (oo.onEach) oo.onEach(f, lyr); }
        });
        gl.eachLayer(function (l) { group.addLayer(l); });
        var rec = { id: uid++, name: name, kind: kind, gl: gl, group: group, color: col(kind), count: count, visible: true };
        layers.push(rec); renderLayers(); refreshOps(); refreshModelInputs();
        return rec;
    }

    function attachSelect(lyr) {
        lyr.on('click', function (e) {
            if (lyr._kind === 'result') return;
            var id = L.Util.stamp(lyr);
            if (selectedLayerIds.has(id)) { selectedLayerIds.delete(id); setSel(lyr, false); }
            else { selectedLayerIds.add(id); setSel(lyr, true); }
            L.DomEvent.stopPropagation(e); refreshOps(); renderLayers();
        });
    }
    function setSel(lyr, onf) { if (lyr.setStyle && lyr._kind !== 'result') { if (onf) lyr.setStyle({ weight: 5, color: getCss('--accent'), fillColor: getCss('--accent') }); else lyr.setStyle(styleFor(lyr._kind)); } }
    map.on('click', function () { if (editMode) return; selectedLayerIds.forEach(function (id) { drawnItems.eachLayer(function (l) { if (L.Util.stamp(l) === id) setSel(l, false); }); }); selectedLayerIds.clear(); refreshOps(); renderLayers(); });

    function geomAr(t) { return ({ Point: 'نقطة', MultiPoint: 'نقاط', LineString: 'خط', MultiLineString: 'خطوط', Polygon: 'مضلّع', MultiPolygon: 'مضلّعات' })[t] || t; }
    function bindInfoPopup(lyr, f) {
        var g = lyr.toGeoJSON ? lyr.toGeoJSON() : f; var type = g.geometry && g.geometry.type;
        var nm = (f && f.properties && f.properties.name) || 'عنصر';
        var html = '<b>' + nm + '</b><br>النوع: ' + geomAr(type);
        try {
            if (type && type.indexOf('Polygon') >= 0) { html += '<br>المساحة: ' + fmt(turf.area(g) / 1e6, 4) + ' كم²<br>المحيط: ' + fmt(turf.length(turf.polygonToLine(g), { units: 'kilometers' }), 3) + ' كم'; }
            if (type && type.indexOf('LineString') >= 0) { html += '<br>الطول: ' + fmt(turf.length(g, { units: 'kilometers' }), 4) + ' كم'; }
            if (type === 'Point') { html += '<br>' + g.geometry.coordinates[1].toFixed(6) + ', ' + g.geometry.coordinates[0].toFixed(6); }
        } catch (e) { }
        var P = f && f.properties || {};
        var special = '';
        if (P._score !== undefined) { special += '<br><b style="color:' + (P._best ? getCss('--good') : P._worst ? getCss('--bad') : getCss('--geo-result')) + '">درجة الملاءمة: ' + P._score + '/100 (الترتيب ' + P._rank + ')' + (P._best ? ' ★ الأفضل' : P._worst ? ' ✗ الأسوأ' : '') + '</b>'; }
        if (P.gi_z !== undefined) { special += '<br>Gi* (Z) = <b>' + P.gi_z + '</b> — ' + (P.cls === 'hot' ? 'بقعة ساخنة' : P.cls === 'cold' ? 'بقعة باردة' : 'غير دالّة'); }
        if (P.cluster !== undefined) { special += '<br>تصنيف LISA: <b>' + P.cluster + '</b>'; }
        if (P._val !== undefined) { special += '<br>القيمة: <b>' + fmt(P._val, 2) + '</b> (الفئة ' + (P._class + 1) + ')'; }
        if (P.in_zone !== undefined) { special += '<br>ضمن: <b>' + P.in_zone + '</b>'; }
        html += special;
        var skip = { name: 1, _score: 1, _best: 1, _worst: 1, _rank: 1, _class: 1, _val: 1, gi_z: 1, cls: 1, cluster: 1, value: 1, localI: 1, norm: 1, dens: 1, idw: 1, membership: 1, distance: 1, r: 1, in_zone: 1 };
        var keys = Object.keys(P).filter(function (k) { return !skip[k] && typeof P[k] !== 'object'; });
        if (keys.length) { html += '<hr style="border:none;border-top:1px solid var(--line-soft);margin:6px 0">'; keys.slice(0, 8).forEach(function (k) { html += '<small>' + k.replace(/^poly_/, 'منطقة·') + ': <b>' + P[k] + '</b></small><br>'; }); }
        lyr.bindPopup(html);
    }

    // ========================================================= COLLECT FEATURES
    function allFeatures() { var f = []; drawnItems.eachLayer(function (l) { if (l._kind === 'result') return; try { var g = l.toGeoJSON(); if (g.type === 'FeatureCollection') g.features.forEach(function (x) { f.push(x); }); else f.push(g); } catch (e) { } }); return f; }
    function sourceFeatures(filterType) {
        var f = []; var hasSel = selectedLayerIds.size > 0;
        drawnItems.eachLayer(function (l) { if (l._kind === 'result') return; if (hasSel && !selectedLayerIds.has(L.Util.stamp(l))) return; try { var g = l.toGeoJSON(); if (g.type === 'FeatureCollection') g.features.forEach(function (x) { f.push(x); }); else f.push(g); } catch (e) { } });
        if (filterType) f = f.filter(function (x) { var t = x.geometry && x.geometry.type; return filterType.some(function (y) { return t && t.indexOf(y) >= 0; }); });
        return f;
    }
    function fc(a) { return { type: 'FeatureCollection', features: a }; }
    function isPoly(f) { return f.geometry && f.geometry.type.indexOf('Polygon') >= 0; }
    function explodePts(feats) {
        var out = []; feats.forEach(function (f) {
            var t = f.geometry && f.geometry.type;
            if (t === 'Point') out.push(f);
            else if (t === 'MultiPoint') f.geometry.coordinates.forEach(function (c) { out.push(turf.point(c, f.properties)); });
            else { try { turf.coordAll(f).forEach(function (c) { out.push(turf.point(c)); }); } catch (e) { } }
        });
        var seen = {}, u = []; out.forEach(function (p) { var k = p.geometry.coordinates.map(function (x) { return x.toFixed(7); }).join(','); if (!seen[k]) { seen[k] = 1; u.push(p); } }); return u;
    }
    function countCoords(f) { try { return turf.coordAll(f).length; } catch (e) { return 0; } }
    function numericField(feats) {
        for (var i = 0; i < feats.length; i++) { var p = feats[i].properties || {}; for (var k in p) { if (typeof p[k] === 'number' && k !== 'r' && k !== 'membership' && k !== 'norm' && k !== 'dens') return k; } } return null;
    }
    function numericFields(feats) {
        var set = {}; feats.forEach(function (f) { var p = f.properties || {}; for (var k in p) { if (typeof p[k] === 'number' && ['r', 'membership', 'norm', 'dens', 'localI', 'distance'].indexOf(k) < 0) set[k] = 1; } }); return Object.keys(set);
    }
    function fieldVals(feats, field) { return feats.map(function (f) { var v = f.properties && f.properties[field]; return typeof v === 'number' ? v : 0; }); }

    function moransI(pts, vals, bandKm) {
        var n = pts.length, mean = vals.reduce(function (a, b) { return a + b; }, 0) / n, W = 0, num = 0, den = 0;
        for (var i = 0; i < n; i++) {
            den += (vals[i] - mean) * (vals[i] - mean);
            for (var j = 0; j < n; j++) { if (i === j) continue; var d = turf.distance(pts[i], pts[j], { units: 'kilometers' }); if (d <= bandKm) { W++; num += (vals[i] - mean) * (vals[j] - mean); } }
        }
        if (W === 0 || den === 0) return { I: 0, EI: -1 / (n - 1), W: 0 };
        return { I: (n / W) * (num / den), EI: -1 / (n - 1), W: W };
    }
    function getisOrdGi(pts, vals, bandKm) {
        var n = pts.length, mean = vals.reduce(function (a, b) { return a + b; }, 0) / n;
        var S = Math.sqrt(Math.max(0, vals.reduce(function (a, b) { return a + b * b; }, 0) / n - mean * mean));
        var out = [];
        for (var i = 0; i < n; i++) {
            var sumW = 0, sumWX = 0, sumW2 = 0;
            for (var j = 0; j < n; j++) { var d = turf.distance(pts[i], pts[j], { units: 'kilometers' }); var w = (i === j || d <= bandKm) ? 1 : 0; if (w) { sumW += w; sumWX += w * vals[j]; sumW2 += w; } }
            var numr = sumWX - mean * sumW; var denr = S * Math.sqrt(Math.max(1e-12, (n * sumW2 - sumW * sumW) / (n - 1)));
            out.push(denr === 0 ? 0 : numr / denr);
        }
        return out;
    }
    function idwValue(samples, vals, target, power) {
        var num = 0, den = 0; for (var i = 0; i < samples.length; i++) { var d = turf.distance(samples[i], target, { units: 'kilometers' }); if (d < 1e-9) return vals[i]; var w = 1 / Math.pow(d, power); num += w * vals[i]; den += w; } return den ? num / den : 0;
    }
    function classBreaks(vals, k, method) {
        var sorted = vals.slice().sort(function (a, b) { return a - b; }); var mn = sorted[0], mx = sorted[sorted.length - 1], br = [mn];
        if (method === 'quantile') { for (var i = 1; i < k; i++) { br.push(sorted[Math.floor(i / k * sorted.length)]); } }
        else { for (var j = 1; j < k; j++) { br.push(mn + (mx - mn) * j / k); } }
        br.push(mx); return br;
    }
    var CLASS_COLORS = ['#fde68a', '#fbbf24', '#f59e0b', '#d97706', '#b45309'];

    // =================================================================== RESULTS
    function showResult(title, metrics, extra) {
        $('resTitle').textContent = title; var b = $('resBody'); b.innerHTML = '';
        (metrics || []).forEach(function (m) { var d = document.createElement('div'); d.className = 'metric'; d.innerHTML = '<span class="k">' + m.k + '</span><span class="v">' + m.v + (m.u ? ' <small>' + m.u + '</small>' : '') + '</span>'; b.appendChild(d); });
        if (extra && extra.legend) { var lg = document.createElement('div'); lg.className = 'reslegend'; extra.legend.forEach(function (it) { lg.innerHTML += '<span class="li"><span class="sw" style="background:' + it.c + '"></span>' + it.t + '</span>'; }); b.appendChild(lg); }
        if (extra && extra.note) { var n = document.createElement('div'); n.className = 'resnote'; n.textContent = extra.note; b.appendChild(n); }
        $('results').classList.add('show');
    }
    $('resClose').onclick = function () { $('results').classList.remove('show'); };

    // ============================================================ ANALYSIS ENGINE
    var FUZZY_REF = 'بحسب الفصل ٧ (النمذجة بالمجموعات الضبابية): دالة العضوية الجيبية — القرب يتناقص تدريجياً لا فجأة.';
    var LISA_REF = 'بحسب الفصل ٢ (MCDA + الإحصاء المكاني): مؤشر موران المحلي LISA (Anselin) لكشف التبعية المكانية.';

    var OPS = [
        { id: 'measure', g: '📐', label: 'قياس (طول/مساحة)', group: 'geom', needs: ['Point', 'LineString', 'Polygon'], min: 1,
            compute: function (f) {
                var len = 0, ar = 0, nP = 0, nL = 0, nG = 0; f.forEach(function (x) {
                    var t = x.geometry.type;
                    if (t.indexOf('Point') >= 0) nP++;
                    if (t.indexOf('LineString') >= 0) { nL++; len += turf.length(x, { units: 'kilometers' }); }
                    if (t.indexOf('Polygon') >= 0) { nG++; ar += turf.area(x); len += turf.length(turf.polygonToLine(x), { units: 'kilometers' }); }
                });
                var m = [{ k: 'عدد العناصر', v: fmt(f.length, 0) }];
                if (nP) m.push({ k: 'نقاط', v: fmt(nP, 0) }); if (nL) m.push({ k: 'خطوط', v: fmt(nL, 0) }); if (nG) m.push({ k: 'مضلّعات', v: fmt(nG, 0) });
                if (len) m.push({ k: 'إجمالي الطول/المحيط', v: fmt(len, 4), u: 'كم' });
                if (ar) { m.push({ k: 'إجمالي المساحة', v: fmt(ar / 1e6, 4), u: 'كم²' }); m.push({ k: '(هكتار)', v: fmt(ar / 1e4, 2), u: 'هـ' }); }
                return { metrics: m, name: 'قياس' };
            } },
        { id: 'centroid', g: '⊙', label: 'المركز الهندسي', group: 'geom', needs: ['Point', 'LineString', 'Polygon'], min: 1,
            compute: function (f) { var c = turf.centroid(fc(f)); return { gj: c, name: 'المركز الهندسي', metrics: [{ k: 'خط العرض', v: fmtEn(c.geometry.coordinates[1], 6) }, { k: 'خط الطول', v: fmtEn(c.geometry.coordinates[0], 6) }] }; } },
        { id: 'center', g: '✛', label: 'مركز الكتلة', group: 'geom', needs: ['Point', 'LineString', 'Polygon'], min: 1,
            compute: function (f) { var c = turf.centerOfMass(fc(f)); return { gj: c, name: 'مركز الكتلة', metrics: [{ k: 'خط العرض', v: fmtEn(c.geometry.coordinates[1], 6) }, { k: 'خط الطول', v: fmtEn(c.geometry.coordinates[0], 6) }] }; } },
        { id: 'bbox', g: '▢', label: 'الإطار المحيط', group: 'geom', needs: ['Point', 'LineString', 'Polygon'], min: 1,
            compute: function (f) { var bb = turf.bbox(fc(f)); var poly = turf.bboxPolygon(bb); return { gj: poly, name: 'الإطار المحيط', metrics: [{ k: 'المساحة', v: fmt(turf.area(poly) / 1e6, 3), u: 'كم²' }, { k: 'العرض', v: fmt(turf.distance([bb[0], bb[1]], [bb[2], bb[1]], { units: 'kilometers' }), 3), u: 'كم' }, { k: 'الارتفاع', v: fmt(turf.distance([bb[0], bb[1]], [bb[0], bb[3]], { units: 'kilometers' }), 3), u: 'كم' }] }; } },
        { id: 'convex', g: '⬡', label: 'الغلاف المحدّب', group: 'geom', needs: ['Point', 'LineString', 'Polygon'], min: 3,
            compute: function (f) { var h = turf.convex(fc(explodePts(f))); if (!h) throw 'تحتاج ٣ نقاط غير على استقامة واحدة'; return { gj: h, name: 'الغلاف المحدّب', metrics: [{ k: 'المساحة', v: fmt(turf.area(h) / 1e6, 3), u: 'كم²' }, { k: 'المحيط', v: fmt(turf.length(turf.polygonToLine(h), { units: 'kilometers' }), 3), u: 'كم' }] }; } },
        { id: 'concave', g: '❋', label: 'الغلاف المقعّر', group: 'geom', needs: ['Point'], min: 3,
            params: [{ id: 'maxEdge', label: 'أقصى طول حافة (كم)', type: 'range', min: 1, max: 50, step: 1, def: 15, unit: 'كم' }],
            compute: function (f, P) { var pts = explodePts(f); var h = turf.concave(fc(pts), { maxEdge: P.maxEdge, units: 'kilometers' }); if (!h) throw 'تعذّر — جرّب زيادة أقصى طول حافة'; return { gj: h, name: 'الغلاف المقعّر', metrics: [{ k: 'المساحة', v: fmt(turf.area(h) / 1e6, 3), u: 'كم²' }] }; } },
        { id: 'simplify', g: '∿', label: 'تبسيط', group: 'geom', needs: ['LineString', 'Polygon'], min: 1,
            params: [{ id: 'tol', label: 'درجة التبسيط (التسامح)', type: 'range', min: 0.0005, max: 0.05, step: 0.0005, def: 0.01, dec: 4 }],
            compute: function (f, P) { var before = 0, after = 0; var out = f.filter(function (x) { return x.geometry.type.indexOf('Point') < 0; }).map(function (x) { before += countCoords(x); var s = turf.simplify(x, { tolerance: P.tol, highQuality: true }); after += countCoords(s); return s; }); if (!out.length) throw 'اختر خطاً أو مضلّعاً'; return { gj: fc(out), name: 'مبسّط', metrics: [{ k: 'النقاط قبل', v: fmt(before, 0) }, { k: 'النقاط بعد', v: fmt(after, 0) }, { k: 'نسبة التقليل', v: fmt((1 - after / before) * 100, 1), u: '%' }] }; } },

        { id: 'buffer', g: '◎', label: 'نطاق (Buffer)', group: 'prox', needs: ['Point', 'LineString', 'Polygon'], min: 1,
            params: [{ id: 'dist', label: 'مسافة النطاق', type: 'range', min: 0.05, max: 30, step: 0.05, def: 2, unit: 'كم', dec: 2 }, { id: 'steps', label: 'نعومة الحواف (قطاعات)', type: 'range', min: 8, max: 64, step: 4, def: 24, dec: 0 }],
            compute: function (f, P) { var out = f.map(function (x) { return turf.buffer(x, P.dist, { units: 'kilometers', steps: P.steps }); }).filter(Boolean); var ar = out.reduce(function (s, p) { return s + turf.area(p); }, 0) / 1e6; return { gj: fc(out), name: 'نطاق ' + P.dist + ' كم', metrics: [{ k: 'المسافة', v: fmt(P.dist, 2), u: 'كم' }, { k: 'عدد النطاقات', v: fmt(out.length, 0) }, { k: 'إجمالي المساحة', v: fmt(ar, 3), u: 'كم²' }] }; } },
        { id: 'fuzzy', g: '◉', label: 'نطاق ضبابي (Fuzzy)', group: 'prox', needs: ['Point', 'LineString', 'Polygon'], min: 1, star: true,
            params: [{ id: 'p1', label: 'P₁ — نهاية العضوية الكاملة', type: 'range', min: 0.1, max: 15, step: 0.1, def: 2, unit: 'كم', dec: 1 }, { id: 'p2', label: 'P₂ — بداية انعدام العضوية', type: 'range', min: 0.5, max: 40, step: 0.5, def: 10, unit: 'كم', dec: 1 }, { id: 'rings', label: 'عدد الحلقات', type: 'range', min: 3, max: 12, step: 1, def: 6, dec: 0 }],
            compute: function (f, P) {
                if (P.p2 <= P.p1) throw 'يجب أن يكون P₂ أكبر من P₁';
                var rings = []; var n = P.rings;
                for (var i = n; i >= 1; i--) { var d = P.p1 + (P.p2 - P.p1) * (i / n); var mu = 0.5 * (1 + Math.cos(Math.PI * (d - P.p1) / (P.p2 - P.p1))); if (i === n) mu = 0.001; var buf = null; f.forEach(function (x) { var b = turf.buffer(x, d, { units: 'kilometers', steps: 24 }); buf = buf ? turf.union(buf, b) : b; }); if (buf) { buf.properties = { membership: Math.round(mu * 100) / 100, distance: Math.round(d * 100) / 100 }; rings.push(buf); } }
                var core = null; f.forEach(function (x) { var b = turf.buffer(x, P.p1, { units: 'kilometers', steps: 24 }); core = core ? turf.union(core, b) : b; }); if (core) { core.properties = { membership: 1, distance: P.p1 }; rings.push(core); }
                return {
                    gj: fc(rings), name: 'نطاق ضبابي', _fuzzy: true,
                    metrics: [{ k: 'عضوية كاملة حتى', v: fmt(P.p1, 1), u: 'كم' }, { k: 'تنعدم عند', v: fmt(P.p2, 1), u: 'كم' }, { k: 'عدد مستويات العضوية', v: fmt(rings.length, 0) }],
                    extra: { legend: [{ c: 'rgba(123,92,255,.75)', t: 'عضوية عالية (قريب)' }, { c: 'rgba(123,92,255,.18)', t: 'عضوية منخفضة (بعيد)' }], note: FUZZY_REF }
                };
            } },
        { id: 'nearest', g: '↔', label: 'أقرب نقطتين', group: 'prox', needs: ['Point'], min: 2,
            compute: function (f) { var pts = explodePts(f); if (pts.length < 2) throw 'تحتاج نقطتين'; var best = null; for (var i = 0; i < pts.length; i++)for (var j = i + 1; j < pts.length; j++) { var d = turf.distance(pts[i], pts[j], { units: 'kilometers' }); if (!best || d < best.d) best = { d: d, a: pts[i], b: pts[j] }; } var line = turf.lineString([best.a.geometry.coordinates, best.b.geometry.coordinates]); return { gj: line, name: 'أقرب نقطتين', metrics: [{ k: 'المسافة', v: fmt(best.d, 4), u: 'كم' }, { k: '(متر)', v: fmt(best.d * 1000, 1), u: 'م' }] }; } },
        { id: 'voronoi', g: '⬟', label: 'فورونوي (Thiessen)', group: 'prox', needs: ['Point'], min: 3, star: true,
            compute: function (f) { var pts = explodePts(f); if (pts.length < 3) throw 'تحتاج ٣ نقاط'; var bb = turf.bbox(fc(pts)); var pad = (Math.max(bb[2] - bb[0], bb[3] - bb[1])) * 0.2 || 0.1; var v = turf.voronoi(fc(pts), { bbox: [bb[0] - pad, bb[1] - pad, bb[2] + pad, bb[3] + pad] }); var cells = v.features.filter(Boolean); return { gj: fc(cells), name: 'مضلّعات فورونوي', metrics: [{ k: 'عدد الخلايا', v: fmt(cells.length, 0) }, { k: 'عدد النقاط', v: fmt(pts.length, 0) }], extra: { note: 'كل خلية تمثّل منطقة النفوذ الأقرب لنقطة واحدة — أساس تحليل الخدمات والتغطية.' } }; } },
        { id: 'tin', g: '▲', label: 'شبكة مثلّثات TIN', group: 'prox', needs: ['Point'], min: 3,
            compute: function (f) { var pts = explodePts(f); if (pts.length < 3) throw 'تحتاج ٣ نقاط'; var t = turf.tin(fc(pts)); return { gj: t, name: 'شبكة TIN', metrics: [{ k: 'عدد المثلّثات', v: fmt(t.features.length, 0) }] }; } },

        { id: 'nni', g: '⁖', label: 'مؤشر أقرب جار', group: 'stat', needs: ['Point'], min: 3, star: true,
            compute: function (f) {
                var pts = explodePts(f); var n = pts.length; if (n < 3) throw 'تحتاج ٣ نقاط على الأقل';
                var bb = turf.bbox(fc(pts)); var areaKm2 = turf.area(turf.bboxPolygon(bb)) / 1e6; if (areaKm2 <= 0) throw 'النقاط متطابقة';
                var sum = 0; for (var i = 0; i < n; i++) { var min = Infinity; for (var j = 0; j < n; j++) { if (i === j) continue; var d = turf.distance(pts[i], pts[j], { units: 'kilometers' }); if (d < min) min = d; } sum += min; }
                var dObs = sum / n; var dExp = 0.5 / Math.sqrt(n / areaKm2); var R = dObs / dExp;
                var SE = 0.26136 / Math.sqrt(n * n / areaKm2); var Z = (dObs - dExp) / SE;
                var verdict = R < 0.9 ? 'توزّع عنقودي (Clustered)' : R > 1.1 ? 'توزّع متباعد (Dispersed)' : 'توزّع عشوائي (Random)';
                var vcol = R < 0.9 ? getCss('--hh') : R > 1.1 ? getCss('--ll') : getCss('--warn');
                return {
                    name: 'مؤشر أقرب جار', metrics: [
                        { k: 'عدد النقاط', v: fmt(n, 0) },
                        { k: 'متوسط المسافة المرصودة', v: fmt(dObs, 4), u: 'كم' },
                        { k: 'المسافة المتوقّعة (عشوائي)', v: fmt(dExp, 4), u: 'كم' },
                        { k: 'نسبة أقرب جار R', v: fmt(R, 3) },
                        { k: 'قيمة Z', v: fmt(Z, 2) }],
                    extra: { legend: [{ c: vcol, t: verdict }], note: 'R<1 تجمّع، R≈1 عشوائي، R>1 تباعد. |Z|>1.96 يعني دلالة إحصائية ٩٥٪ (Clark & Evans؛ قانون توبلر الأول).' }
                };
            } },
        { id: 'lisa', g: '◰', label: 'بقع ساخنة LISA', group: 'stat', needs: ['Point'], min: 5, star: true,
            params: [{ id: 'k', label: 'عدد الجيران (k)', type: 'range', min: 2, max: 12, step: 1, def: 4, dec: 0 }],
            compute: function (f, P) {
                var pts = explodePts(f); var n = pts.length; if (n < 5) throw 'تحتاج ٥ نقاط على الأقل';
                var field = numericField(pts);
                var vals = pts.map(function (p, i) { return field ? (p.properties[field] || 0) : localDensity(pts, i, P.k); });
                var mean = vals.reduce(function (a, b) { return a + b; }, 0) / n;
                var variance = vals.reduce(function (a, b) { return a + (b - mean) * (b - mean); }, 0) / n; var sd = Math.sqrt(variance) || 1;
                var feats = []; var cnt = { HH: 0, LL: 0, HL: 0, LH: 0, NS: 0 };
                for (var i = 0; i < n; i++) {
                    var dists = []; for (var j = 0; j < n; j++) { if (i === j) continue; dists.push({ j: j, d: turf.distance(pts[i], pts[j], { units: 'kilometers' }) }); }
                    dists.sort(function (a, b) { return a.d - b.d; }); var nb = dists.slice(0, Math.min(P.k, dists.length));
                    var zi = (vals[i] - mean) / sd; var wsum = 0, lagsum = 0;
                    nb.forEach(function (e) { var w = 1; wsum += w; lagsum += w * (vals[e.j] - mean) / sd; });
                    var lag = wsum ? lagsum / wsum : 0; var Ii = zi * lag;
                    var cls, sig = Ii > 0.3 || Ii < -0.3;
                    if (!sig) cls = 'NS';
                    else if (zi > 0 && lag > 0) cls = 'HH'; else if (zi < 0 && lag < 0) cls = 'LL'; else if (zi > 0 && lag < 0) cls = 'HL'; else cls = 'LH';
                    cnt[cls]++;
                    feats.push(turf.point(pts[i].geometry.coordinates, { cluster: cls, value: Math.round(vals[i] * 100) / 100, localI: Math.round(Ii * 100) / 100 }));
                }
                var CM = { HH: getCss('--hh'), LL: getCss('--ll'), HL: getCss('--hl'), LH: getCss('--lh'), NS: getCss('--ns') };
                return {
                    gj: fc(feats), name: 'تحليل LISA للتجمّعات', _lisa: true, _cm: CM,
                    metrics: [
                        { k: 'المتغيّر المحلّل', v: field || 'كثافة محلية' },
                        { k: 'عالي-عالي (بقع ساخنة)', v: fmt(cnt.HH, 0) },
                        { k: 'منخفض-منخفض (بقع باردة)', v: fmt(cnt.LL, 0) },
                        { k: 'قيم شاذّة (HL/LH)', v: fmt(cnt.HL + cnt.LH, 0) },
                        { k: 'غير دالّة', v: fmt(cnt.NS, 0) }],
                    extra: { legend: [{ c: CM.HH, t: 'عالي-عالي' }, { c: CM.LL, t: 'منخفض-منخفض' }, { c: CM.HL, t: 'عالي-منخفض' }, { c: CM.LH, t: 'منخفض-عالي' }, { c: CM.NS, t: 'غير دالّة' }], note: LISA_REF }
                };
            } },
        { id: 'kde', g: '▦', label: 'كثافة (شبكة Heat)', group: 'stat', needs: ['Point'], min: 3, star: true,
            params: [{ id: 'cell', label: 'حجم الخلية', type: 'range', min: 0.5, max: 10, step: 0.5, def: 3, unit: 'كم', dec: 1 }, { id: 'radius', label: 'نطاق التأثير', type: 'range', min: 1, max: 20, step: 1, def: 6, unit: 'كم', dec: 0 }],
            compute: function (f, P) {
                var pts = explodePts(f); if (pts.length < 3) throw 'تحتاج ٣ نقاط';
                var bb = turf.bbox(fc(pts)); var pad = P.radius / 111; bb = [bb[0] - pad, bb[1] - pad, bb[2] + pad, bb[3] + pad];
                var grid = turf.pointGrid(bb, P.cell, { units: 'kilometers' });
                var maxD = 0; var cellPolys = [];
                grid.features.forEach(function (g) {
                    var c = g.geometry.coordinates, dens = 0;
                    pts.forEach(function (p) { var d = turf.distance(c, p.geometry.coordinates, { units: 'kilometers' }); if (d < P.radius) { var u = d / P.radius; dens += (1 - u * u); } });
                    if (dens > maxD) maxD = dens;
                    if (dens > 0.01) { var half = P.cell / 2 / 111 / Math.cos(c[1] * Math.PI / 180), halfy = P.cell / 2 / 111; var sq = turf.polygon([[[c[0] - half, c[1] - halfy], [c[0] + half, c[1] - halfy], [c[0] + half, c[1] + halfy], [c[0] - half, c[1] + halfy], [c[0] - half, c[1] - halfy]]], { dens: dens }); cellPolys.push(sq); }
                });
                cellPolys.forEach(function (p) { p.properties.norm = p.properties.dens / maxD; });
                return {
                    gj: fc(cellPolys), name: 'سطح الكثافة', _kde: true,
                    metrics: [{ k: 'عدد النقاط', v: fmt(pts.length, 0) }, { k: 'خلايا نشطة', v: fmt(cellPolys.length, 0) }, { k: 'حجم الخلية', v: fmt(P.cell, 1), u: 'كم' }],
                    extra: { legend: [{ c: 'rgba(245,158,11,.9)', t: 'كثافة عالية' }, { c: 'rgba(245,158,11,.15)', t: 'كثافة منخفضة' }], note: 'تقدير كثافة بنواة كروية (Epanechnikov) — تجمّعات الظواهر النقطية.' }
                };
            } },
        { id: 'count', g: '⊡', label: 'نقاط داخل مضلّع', group: 'stat', needs: ['Point', 'Polygon'], min: 2,
            compute: function (f) { var pts = explodePts(f.filter(function (x) { return x.geometry.type.indexOf('Point') >= 0; })); var polys = f.filter(isPoly); if (!polys.length || !pts.length) throw 'تحتاج مضلّعاً ونقطة'; var within = turf.pointsWithinPolygon(fc(pts), fc(polys)); return { gj: within, name: 'النقاط الداخلة (' + within.features.length + ')', metrics: [{ k: 'إجمالي النقاط', v: fmt(pts.length, 0) }, { k: 'داخل المضلّعات', v: fmt(within.features.length, 0) }, { k: 'خارجها', v: fmt(pts.length - within.features.length, 0) }, { k: 'النسبة الداخلة', v: fmt(within.features.length / pts.length * 100, 1), u: '%' }] }; } },

        { id: 'union', g: '⬢', label: 'الاتحاد', group: 'overlay', needs: ['Polygon'], min: 2,
            compute: function (f) { var p = f.filter(isPoly); if (p.length < 2) throw 'تحتاج مضلّعين'; var u = p[0]; for (var i = 1; i < p.length; i++)u = turf.union(u, p[i]); return { gj: u, name: 'الاتحاد', metrics: [{ k: 'المساحة', v: fmt(turf.area(u) / 1e6, 3), u: 'كم²' }] }; } },
        { id: 'intersect', g: '◑', label: 'التقاطع', group: 'overlay', needs: ['Polygon'], min: 2,
            compute: function (f) { var p = f.filter(isPoly); if (p.length < 2) throw 'تحتاج مضلّعين'; var it = p[0]; for (var i = 1; i < p.length; i++) { it = it && turf.intersect(it, p[i]); } if (!it) throw 'لا يوجد تقاطع'; return { gj: it, name: 'التقاطع', metrics: [{ k: 'المساحة', v: fmt(turf.area(it) / 1e6, 3), u: 'كم²' }] }; } },
        { id: 'difference', g: '◐', label: 'الفرق', group: 'overlay', needs: ['Polygon'], min: 2,
            compute: function (f) { var p = f.filter(isPoly); if (p.length < 2) throw 'تحتاج مضلّعين (الأول ناقص الباقي)'; var d = p[0]; for (var i = 1; i < p.length; i++) { d = d && turf.difference(d, p[i]); } if (!d) throw 'النتيجة فارغة'; return { gj: d, name: 'الفرق', metrics: [{ k: 'المساحة', v: fmt(turf.area(d) / 1e6, 3), u: 'كم²' }] }; } },
        { id: 'dissolve', g: '❖', label: 'الدمج', group: 'overlay', needs: ['Polygon'], min: 2,
            compute: function (f) { var p = f.filter(isPoly); if (p.length < 2) throw 'تحتاج مضلّعين'; var u = p[0]; for (var i = 1; i < p.length; i++)u = turf.union(u, p[i]); return { gj: u, name: 'المدموج', metrics: [{ k: 'المساحة الكلية', v: fmt(turf.area(u) / 1e6, 3), u: 'كم²' }] }; } },

        { id: 'choropleth', g: '◱', label: 'تصنيف حسب حقل', group: 'attr', needs: ['Point', 'Polygon'], min: 3, star: true, needsField: true,
            params: [{ id: 'field', type: 'field', label: 'الحقل الرقمي' }, { id: 'classes', label: 'عدد الفئات', type: 'range', min: 3, max: 5, step: 1, def: 5, dec: 0 }, { id: 'method', type: 'seg', label: 'طريقة التصنيف', opts: [{ v: 'quantile', t: 'كمّيات متساوية' }, { v: 'equal', t: 'فترات متساوية' }], def: 'quantile' }],
            compute: function (f, P) {
                if (!P.field) throw 'اختر حقلاً رقمياً'; var vals = fieldVals(f, P.field); var br = classBreaks(vals, P.classes, P.method);
                var feats = f.map(function (x) { var v = x.properties[P.field] || 0; var ci = 0; for (var i = 0; i < P.classes; i++) { if (v >= br[i]) ci = i; } var g2 = JSON.parse(JSON.stringify(x)); g2.properties._class = ci; g2.properties._val = v; return g2; });
                var legend = []; for (var i = 0; i < P.classes; i++) { legend.push({ c: CLASS_COLORS[i], t: fmt(br[i], 1) + ' – ' + fmt(br[i + 1], 1) }); }
                return {
                    gj: fc(feats), name: 'تصنيف: ' + P.field, _choro: true, _nc: P.classes,
                    metrics: [{ k: 'الحقل', v: P.field }, { k: 'العناصر', v: fmt(f.length, 0) }, { k: 'أدنى قيمة', v: fmt(Math.min.apply(null, vals), 2) }, { k: 'أعلى قيمة', v: fmt(Math.max.apply(null, vals), 2) }],
                    extra: { legend: legend, note: 'تصنيف لوني متدرّج حسب قيمة الحقل — خرائط الكوروبليث.' }
                };
            } },
        { id: 'getis', g: '◉', label: 'بقع ساخنة Gi* (Getis-Ord)', group: 'attr', needs: ['Point'], min: 6, star: true, needsField: true,
            params: [{ id: 'field', type: 'field', label: 'الحقل المُحلّل' }, { id: 'band', label: 'نطاق الجوار', type: 'range', min: 1, max: 30, step: 1, def: 8, unit: 'كم', dec: 0 }],
            compute: function (f, P) {
                var pts = explodePts(f); if (pts.length < 6) throw 'تحتاج ٦ نقاط'; var field = P.field || numericField(pts);
                var vals = field ? fieldVals(pts, field) : pts.map(function (p, i) { return localDensity(pts, i, 4); });
                var gi = getisOrdGi(pts, vals, P.band);
                var CM = { hot: getCss('--hh'), cold: getCss('--ll'), ns: getCss('--ns') }; var nHot = 0, nCold = 0;
                var feats = pts.map(function (p, i) { var z = gi[i]; var c = z > 1.96 ? 'hot' : z < -1.96 ? 'cold' : 'ns'; if (c === 'hot') nHot++; if (c === 'cold') nCold++; return turf.point(p.geometry.coordinates, { gi_z: Math.round(z * 100) / 100, cls: c, value: vals[i] }); });
                return {
                    gj: fc(feats), name: 'بقع ساخنة Gi*', _gi: true, _cm: CM,
                    metrics: [{ k: 'الحقل', v: field || 'كثافة' }, { k: 'بقع ساخنة (عالية)', v: fmt(nHot, 0) }, { k: 'بقع باردة (منخفضة)', v: fmt(nCold, 0) }, { k: 'نطاق الجوار', v: fmt(P.band, 0), u: 'كم' }],
                    extra: { legend: [{ c: CM.hot, t: 'بقعة ساخنة (z>1.96)' }, { c: CM.cold, t: 'بقعة باردة (z<-1.96)' }, { c: CM.ns, t: 'غير دالّة' }], note: 'إحصاء Getis-Ord Gi* كقيمة Z — موجب=تجمّع قيم عالية، سالب=تجمّع قيم منخفضة.' }
                };
            } },
        { id: 'moran', g: '∿', label: 'موران العام (تجمّع المتغيّر)', group: 'attr', needs: ['Point'], min: 5, star: true, needsField: true,
            params: [{ id: 'field', type: 'field', label: 'الحقل المُحلّل' }, { id: 'band', label: 'نطاق الجوار', type: 'range', min: 1, max: 30, step: 1, def: 10, unit: 'كم', dec: 0 }],
            compute: function (f, P) {
                var pts = explodePts(f); var field = P.field || numericField(pts); if (!field) throw 'لا يوجد حقل رقمي — استورد بيانات بخصائص';
                var vals = fieldVals(pts, field); var m = moransI(pts, vals, P.band);
                var verdict = m.I > 0.1 ? 'تجمّع مكاني موجب (قيم متشابهة متجاورة)' : m.I < -0.1 ? 'تجمّع مكاني سالب (قيم متباينة متجاورة)' : 'توزّع عشوائي';
                var vcol = m.I > 0.1 ? getCss('--hh') : m.I < -0.1 ? getCss('--ll') : getCss('--warn');
                return {
                    name: 'مؤشر موران العام', metrics: [{ k: 'الحقل', v: field }, { k: 'مؤشر موران I', v: fmt(m.I, 3) }, { k: 'القيمة المتوقّعة E[I]', v: fmt(m.EI, 3) }, { k: 'عدد الروابط', v: fmt(m.W, 0) }],
                    extra: { legend: [{ c: vcol, t: verdict }], note: 'I بين -1 و 1 تقريباً: قرب 1 تجمّع قوي، 0 عشوائي، سالب تنافر (قانون توبلر الأول).' }
                };
            } },
        { id: 'idw', g: '▦', label: 'استكمال IDW (سطح)', group: 'attr', needs: ['Point'], min: 3, star: true, needsField: true,
            params: [{ id: 'field', type: 'field', label: 'الحقل المُستكمَل' }, { id: 'cell', label: 'حجم الخلية', type: 'range', min: 0.5, max: 10, step: 0.5, def: 2, unit: 'كم', dec: 1 }, { id: 'power', label: 'أُسّ المسافة (p)', type: 'range', min: 1, max: 4, step: 0.5, def: 2, dec: 1 }],
            compute: function (f, P) {
                var pts = explodePts(f); var field = P.field || numericField(pts); if (!field) throw 'اختر حقلاً رقمياً للاستكمال';
                var vals = fieldVals(pts, field); var bb = turf.bbox(fc(pts)); var pad = P.cell / 111 * 2; bb = [bb[0] - pad, bb[1] - pad, bb[2] + pad, bb[3] + pad];
                var grid = turf.pointGrid(bb, P.cell, { units: 'kilometers' }); var mn = Infinity, mx = -Infinity; var cells = [];
                grid.features.forEach(function (g) { var c = g.geometry.coordinates; var v = idwValue(pts, vals, g, P.power); if (v < mn) mn = v; if (v > mx) mx = v; var half = P.cell / 2 / 111 / Math.max(0.1, Math.cos(c[1] * Math.PI / 180)), hy = P.cell / 2 / 111; cells.push(turf.polygon([[[c[0] - half, c[1] - hy], [c[0] + half, c[1] - hy], [c[0] + half, c[1] + hy], [c[0] - half, c[1] + hy], [c[0] - half, c[1] - hy]]], { idw: v })); });
                cells.forEach(function (c) { c.properties.norm = mx > mn ? (c.properties.idw - mn) / (mx - mn) : 0.5; });
                return {
                    gj: fc(cells), name: 'سطح IDW: ' + field, _idw: true,
                    metrics: [{ k: 'الحقل', v: field }, { k: 'نقاط المصدر', v: fmt(pts.length, 0) }, { k: 'خلايا الشبكة', v: fmt(cells.length, 0) }, { k: 'المدى', v: fmt(mn, 1) + ' – ' + fmt(mx, 1) }],
                    extra: { legend: [{ c: 'rgba(34,211,238,.9)', t: 'قيمة عالية' }, { c: 'rgba(34,211,238,.12)', t: 'قيمة منخفضة' }], note: 'الوزن بعكس المسافة (IDW) — تنبؤ قيمة الحقل في كل مكان (قانون توبلر).' }
                };
            } },
        { id: 'sjoin', g: '⧉', label: 'ربط مكاني بين طبقتين', group: 'attr', needs: ['Point', 'Polygon'], min: 2,
            compute: function (f) {
                var pts = explodePts(f.filter(function (x) { return x.geometry.type.indexOf('Point') >= 0; })); var polys = f.filter(isPoly); if (!pts.length || !polys.length) throw 'يحتاج نقاطاً ومضلّعات';
                var joined = 0; var feats = pts.map(function (p) { var g2 = JSON.parse(JSON.stringify(p)); for (var i = 0; i < polys.length; i++) { if (turf.booleanPointInPolygon(p, polys[i])) { var pp = polys[i].properties || {}; for (var k in pp) { if (k !== 'name') g2.properties['poly_' + k] = pp[k]; } g2.properties.in_zone = (pp.name || ('منطقة ' + (i + 1))); joined++; break; } } return g2; });
                return {
                    gj: fc(feats), name: 'نتيجة الربط المكاني', metrics: [{ k: 'نقاط', v: fmt(pts.length, 0) }, { k: 'نقاط مرتبطة بمنطقة', v: fmt(joined, 0) }, { k: 'خارج المناطق', v: fmt(pts.length - joined, 0) }],
                    extra: { note: 'يُلحق خصائص المضلّع الحاوي بكل نقطة — تكامل المعالم (Spatial Join). افتح نقطة لرؤية الحقول المُضافة.' }
                };
            } },
        { id: 'query', g: '⌕', label: 'استعلام حسب حقل', group: 'attr', needs: ['Point', 'Polygon'], min: 1, star: true, needsField: true,
            params: [{ id: 'field', type: 'field', label: 'الحقل' }, { id: 'opr', type: 'seg', label: 'الشرط', opts: [{ v: 'gt', t: 'أكبر من' }, { v: 'lt', t: 'أصغر من' }, { v: 'ge', t: '≥ المتوسط' }], def: 'gt' }, { id: 'thr', label: 'القيمة', type: 'range', min: 0, max: 100, step: 1, def: 50, dec: 0 }],
            compute: function (f, P) {
                if (!P.field) throw 'اختر حقلاً'; var vals = fieldVals(f, P.field); var mean = vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
                var sel = f.filter(function (x) { var v = x.properties[P.field] || 0; return P.opr === 'gt' ? v > P.thr : P.opr === 'lt' ? v < P.thr : v >= mean; });
                if (!sel.length) throw 'لا عناصر مطابقة للشرط'; var lbl = P.opr === 'ge' ? ('≥ المتوسط (' + fmt(mean, 1) + ')') : (P.opr === 'gt' ? '> ' : '< ') + P.thr;
                return {
                    gj: fc(sel), name: 'مطابقون: ' + P.field + ' ' + lbl, metrics: [{ k: 'إجمالي العناصر', v: fmt(f.length, 0) }, { k: 'مطابقة للشرط', v: fmt(sel.length, 0) }, { k: 'الشرط', v: P.field + ' ' + lbl }],
                    extra: { note: 'تحديد المعالم حسب قيمة في الميتاداتا — الاستعلام الوصفي (Attribute Query).' }
                };
            } }
    ];

    function localDensity(pts, i, k) { var dists = []; for (var j = 0; j < pts.length; j++) { if (i === j) continue; dists.push(turf.distance(pts[i], pts[j], { units: 'kilometers' })); } dists.sort(function (a, b) { return a - b; }); var kk = Math.min(k, dists.length); var s = 0; for (var m = 0; m < kk; m++)s += dists[m]; var avg = s / kk; return avg > 0 ? 1 / avg : 0; }

    function renderResult(r) {
        resultItems.clearLayers();
        layers = layers.filter(function (l) { return l.kind !== 'result'; });
        if (!r.gj) { renderLayers(); return; }
        var oo = {};
        if (r._lisa) { oo.pointToLayer = function (f, ll) { return pointMarker(ll, 'result', { color: r._cm[f.properties.cluster], r: f.properties.cluster === 'NS' ? 5 : 8 }); }; }
        else if (r._gi) { oo.pointToLayer = function (f, ll) { var c = f.properties.cls; return pointMarker(ll, 'result', { color: r._cm[c], r: c === 'ns' ? 5 : 8 }); }; }
        else if (r._kde) { oo.style = function (f) { var n = f.properties.norm; return { color: 'transparent', weight: 0, fillColor: getCss('--accent'), fillOpacity: 0.1 + n * 0.72 }; }; }
        else if (r._idw) { oo.style = function (f) { var n = f.properties.norm; return { color: 'transparent', weight: 0, fillColor: getCss('--geo-layer'), fillOpacity: 0.08 + n * 0.74 }; }; }
        else if (r._fuzzy) { oo.style = function (f) { var m = f.properties.membership; return { color: getCss('--geo-result'), weight: 1, opacity: 0.5, fillColor: getCss('--geo-result'), fillOpacity: 0.1 + m * 0.5 }; }; }
        else if (r._choro) { oo.style = function (f) { var c = CLASS_COLORS[f.properties._class]; return { color: c, weight: f.geometry.type.indexOf('Point') >= 0 ? 2 : 1.5, opacity: 1, fillColor: c, fillOpacity: 0.75 }; }; oo.pointToLayer = function (f, ll) { return pointMarker(ll, 'result', { color: CLASS_COLORS[f.properties._class], r: 7 }); }; }
        else if (r._suit) { oo.pointToLayer = function (f, ll) { var n = f.properties._score / 100; var c = f.properties._best ? getCss('--good') : f.properties._worst ? getCss('--bad') : getCss('--geo-result'); return pointMarker(ll, 'result', { color: c, r: 5 + n * 8 }); }; oo.style = function (f) { var n = f.properties._score / 100; return { color: getCss('--geo-result'), weight: f.properties._best ? 3 : 1, fillColor: getCss('--geo-result'), fillOpacity: 0.12 + n * 0.6 }; }; }
        addGeoJSON(r.gj, r.name || 'نتيجة', 'result', oo);
        try { map.fitBounds(resultItems.getBounds(), { padding: [50, 50], maxZoom: 14 }); } catch (e) { }
    }

    function runOp(op, P) {
        try {
            var feats = sourceFeatures(op.needs);
            if (feats.length < op.min) { toast('تحتاج ' + op.min + ' عنصر على الأقل من النوع المناسب لهذه الأداة', 'err'); return; }
            var r = op.compute(feats, P || {});
            renderResult(r);
            if (r.metrics) showResult(r.name || op.label, r.metrics, r.extra);
            toast('تم: ' + op.label, 'ok');
            $('paramPanel').classList.remove('show');
        } catch (err) { toast(typeof err === 'string' ? err : (err.message || 'خطأ في التحليل'), 'err'); }
    }

    // ================================================== SITE SUITABILITY (MCDA)
    var suitCrit = [];
    function openSuit() {
        var cand = layers.filter(function (l) { return l.kind !== 'result'; });
        if (!cand.length) { toast('استورد أو ارسم مواقع مرشّحة أولاً', 'err'); return; }
        suitCrit = [];
        var wrap = $('suCandWrap'); var opts = ''; cand.forEach(function (l) { opts += '<option value="' + l.id + '">' + l.name + ' (' + l.count + ')</option>'; });
        wrap.innerHTML = '<label style="font-size:12px;color:var(--ink-soft);display:block;margin-bottom:6px">طبقة المواقع المرشّحة (التي نرتّبها):</label><select id="suCand">' + opts + '</select>';
        var feats = layerFeatures(cand[0].id); var flds = numericFields(feats);
        if (flds.length) suitCrit.push({ kind: 'field', field: flds[0], weight: 50, invert: false });
        if (cand.length > 1) suitCrit.push({ kind: 'dist', layerId: cand[1].id, weight: 50, invert: true });
        else if (flds.length > 1) suitCrit.push({ kind: 'field', field: flds[1], weight: 50, invert: true });
        $('suCand').onchange = renderSuitCrit;
        renderSuitCrit();
        $('suitModal').classList.add('show');
    }
    function renderSuitCrit() {
        var box = $('suCrit'); box.innerHTML = '';
        var candId = parseInt($('suCand').value); var feats = layerFeatures(candId); var flds = numericFields(feats);
        var otherLayers = layers.filter(function (l) { return l.kind !== 'result' && l.id !== candId; });
        suitCrit.forEach(function (cr, idx) {
            var el = document.createElement('div'); el.className = 'crit';
            var ch = document.createElement('div'); ch.className = 'ch';
            if (cr.kind === 'field') {
                var sel = document.createElement('select'); flds.forEach(function (fn) { sel.innerHTML += '<option value="' + fn + '"' + (cr.field === fn ? ' selected' : '') + '>حقل: ' + fn + '</option>'; }); sel.onchange = function () { cr.field = this.value; }; ch.appendChild(sel);
            } else {
                var sel2 = document.createElement('select'); otherLayers.forEach(function (l) { sel2.innerHTML += '<option value="' + l.id + '"' + (cr.layerId === l.id ? ' selected' : '') + '>القرب من: ' + l.name + '</option>'; }); sel2.onchange = function () { cr.layerId = parseInt(this.value); }; ch.appendChild(sel2);
            }
            var del = document.createElement('button'); del.textContent = '×'; del.title = 'حذف'; del.onclick = function () { suitCrit.splice(idx, 1); renderSuitCrit(); }; ch.appendChild(del);
            el.appendChild(ch);
            var dir = document.createElement('div'); dir.className = 'seg'; dir.style.marginTop = '2px';
            var b1 = document.createElement('button'); b1.textContent = 'الأعلى أفضل'; var b2 = document.createElement('button'); b2.textContent = 'الأقل أفضل';
            (cr.invert ? b2 : b1).classList.add('on');
            b1.onclick = function () { cr.invert = false; b1.classList.add('on'); b2.classList.remove('on'); }; b2.onclick = function () { cr.invert = true; b2.classList.add('on'); b1.classList.remove('on'); };
            dir.appendChild(b1); dir.appendChild(b2); el.appendChild(dir);
            var wr = document.createElement('div'); wr.className = 'wr';
            var w = document.createElement('input'); w.type = 'range'; w.min = 0; w.max = 100; w.step = 5; w.value = cr.weight;
            var wv = document.createElement('span'); wv.className = 'wv'; wv.textContent = cr.weight + '%';
            w.oninput = function () { cr.weight = parseInt(this.value); wv.textContent = cr.weight + '%'; updSuitTotal(); };
            wr.appendChild(w); wr.appendChild(wv); el.appendChild(wr);
            box.appendChild(el);
        });
        updSuitTotal();
    }
    function updSuitTotal() { var t = suitCrit.reduce(function (a, c) { return a + c.weight; }, 0); var el = $('suTotal'); el.querySelector('b').textContent = t + '%'; el.className = 'wtotal ' + (t === 100 ? 'ok' : 'bad'); }
    $('suAddField').onclick = function () { var candId = parseInt($('suCand').value); var flds = numericFields(layerFeatures(candId)); if (!flds.length) { toast('لا حقول رقمية في هذه الطبقة', 'err'); return; } suitCrit.push({ kind: 'field', field: flds[0], weight: 0, invert: false }); renderSuitCrit(); };
    $('suAddDist').onclick = function () { var candId = parseInt($('suCand').value); var others = layers.filter(function (l) { return l.kind !== 'result' && l.id !== candId; }); if (!others.length) { toast('تحتاج طبقة أخرى للقرب منها', 'err'); return; } suitCrit.push({ kind: 'dist', layerId: others[0].id, weight: 0, invert: true }); renderSuitCrit(); };
    $('suClose').onclick = function () { $('suitModal').classList.remove('show'); };
    on($('suitModal'), 'click', function (e) { if (e.target === this) this.classList.remove('show'); });
    $('btnSuit').onclick = openSuit;

    $('suRun').onclick = function () {
        try {
            if (!suitCrit.length) throw 'أضف معياراً واحداً على الأقل';
            var candId = parseInt($('suCand').value); var feats = layerFeatures(candId);
            if (feats.length < 2) throw 'تحتاج موقعين مرشّحين على الأقل';
            var centroids = feats.map(function (f) { return f.geometry.type === 'Point' ? f : turf.centroid(f); });
            var wsum = suitCrit.reduce(function (a, c) { return a + c.weight; }, 0); if (wsum <= 0) throw 'اضبط الأوزان';
            var scores = new Array(feats.length).fill(0);
            suitCrit.forEach(function (cr) {
                var raw;
                if (cr.kind === 'field') { raw = feats.map(function (f) { var v = f.properties && f.properties[cr.field]; return typeof v === 'number' ? v : 0; }); }
                else { var other = layerFeatures(cr.layerId); var oc = other.map(function (o) { return o.geometry.type === 'Point' ? o : turf.centroid(o); }); raw = centroids.map(function (ct) { var mn = Infinity; oc.forEach(function (o) { var d = turf.distance(ct, o, { units: 'kilometers' }); if (d < mn) mn = d; }); return mn; }); }
                var mn = Math.min.apply(null, raw), mx = Math.max.apply(null, raw);
                for (var i = 0; i < feats.length; i++) { var s = mx === mn ? 0.5 : (raw[i] - mn) / (mx - mn); if (cr.invert) s = 1 - s; scores[i] += s * cr.weight; }
            });
            scores = scores.map(function (s) { return s / wsum * 100; });
            var best = 0, worst = 0; for (var i = 1; i < scores.length; i++) { if (scores[i] > scores[best]) best = i; if (scores[i] < scores[worst]) worst = i; }
            var out = feats.map(function (f, i) { var g2 = JSON.parse(JSON.stringify(f)); g2.properties._score = Math.round(scores[i] * 10) / 10; g2.properties._best = (i === best); g2.properties._worst = (i === worst); g2.properties._rank = 0; return g2; });
            var order = out.map(function (f, i) { return { i: i, s: scores[i] }; }).sort(function (a, b) { return b.s - a.s; });
            order.forEach(function (o, r) { out[o.i].properties._rank = r + 1; });
            renderResult({ gj: fc(out), name: 'ترتيب الملاءمة', _suit: true });
            showResult('اختيار الموقع الأمثل', [
                { k: 'عدد المواقع', v: fmt(feats.length, 0) },
                { k: '🟢 أفضل موقع', v: (feats[best].properties.name || ('#' + (best + 1))), u: '' },
                { k: 'درجة الأفضل', v: fmt(scores[best], 1), u: '/100' },
                { k: '🔴 أسوأ موقع', v: (feats[worst].properties.name || ('#' + (worst + 1))), u: '' },
                { k: 'درجة الأسوأ', v: fmt(scores[worst], 1), u: '/100' }
            ], { legend: [{ c: getCss('--good'), t: 'الأفضل' }, { c: getCss('--geo-result'), t: 'متوسط' }, { c: getCss('--bad'), t: 'الأسوأ' }], note: 'تحليل متعدد المعايير بأوزان (MCDA): حجم الرمز ولونه يعكسان الدرجة. افتح أي موقع لرؤية درجته وترتيبه.' });
            $('suitModal').classList.remove('show');
            toast('أفضل موقع: ' + (feats[best].properties.name || ('#' + (best + 1))), 'ok');
        } catch (err) { toast(typeof err === 'string' ? err : (err.message || 'خطأ'), 'err'); }
    };

    // ================================================================= OPS UI
    function opButton(op) {
        var b = document.createElement('button'); b.className = 'op' + (op.star ? ' star' : ''); b.dataset.op = op.id;
        b.innerHTML = '<span class="g">' + op.g + '</span>' + op.label + (op.star ? '<span class="badge">PRO</span>' : '');
        b.onclick = function () { if (b.disabled) return; if (op.params && op.params.length) openParamPanel(op); else runOp(op); };
        return b;
    }
    function renderOps() {
        var groups = { geom: 'opsGeom', prox: 'opsProx', stat: 'opsStat', attr: 'opsAttr', overlay: 'opsOverlay' };
        for (var k in groups) { $(groups[k]).innerHTML = ''; }
        OPS.forEach(function (op) { var box = $(groups[op.group]); if (box) box.appendChild(opButton(op)); });
        refreshOps();
    }
    function refreshOps() {
        var feats = sourceFeatures();
        $$('.op').forEach(function (b) {
            var op = OPS.find(function (o) { return o.id === b.dataset.op; }); if (!op) return;
            var avail = feats.filter(function (f) { var t = f.geometry && f.geometry.type; return op.needs.some(function (x) { return t && t.indexOf(x) >= 0; }); });
            b.disabled = avail.length < op.min;
        });
    }

    var curOp = null, curP = {};
    var PRO_DESC = { fuzzy: 'نطاق متدرّج العضوية بدل الحد القاطع: القرب الكامل حتى P₁ ثم يتناقص تدريجياً حتى ينعدم عند P₂.<span class="ref">' + FUZZY_REF + '</span>', lisa: 'يصنّف كل نقطة إلى بقعة ساخنة/باردة أو قيمة شاذّة حسب تشابهها مع جيرانها.<span class="ref">' + LISA_REF + '</span>', getis: 'إحصاء Getis-Ord Gi* الرسمي — يحسب قيمة Z لكل نقطة من قيم جيرانها ضمن نطاق محدّد، فيكشف البقع الساخنة والباردة الحقيقية.', moran: 'مؤشر موران العام — هل يتجمّع المتغيّر مكانياً أم يتوزّع عشوائياً عبر كامل المنطقة؟', idw: 'الاستكمال بعكس المسافة — يتنبّأ بقيمة الحقل في كل نقطة من الشبكة كمتوسط موزون بعكس المسافة للنقاط المجاورة.', choropleth: 'تصنيف لوني متدرّج للعناصر حسب قيمة حقل رقمي — خريطة كوروبليث.', query: 'تحديد المعالم التي تحقّق شرطاً على حقل في بياناتها.' };
    function openParamPanel(op) {
        curOp = op; curP = {};
        var srcFeats = sourceFeatures(op.needs);
        op.params.forEach(function (pr) { if (pr.type === 'field') { var flds = numericFields(srcFeats); curP[pr.id] = flds[0] || null; } else curP[pr.id] = pr.def; });
        $('ppTitle').textContent = op.label; $('ppIco').textContent = op.g;
        var c = $('ppContent'); c.innerHTML = '';
        if (op.star && PRO_DESC[op.id]) { var d = document.createElement('div'); d.className = 'pdesc'; d.innerHTML = PRO_DESC[op.id]; c.appendChild(d); }
        op.params.forEach(function (pr) {
            var field = document.createElement('div'); field.className = 'field';
            var lab = document.createElement('label'); lab.textContent = pr.label; field.appendChild(lab);
            if (pr.type === 'range') {
                var row = document.createElement('div'); row.className = 'prow';
                var inp = document.createElement('input'); inp.type = 'range'; inp.min = pr.min; inp.max = pr.max; inp.step = pr.step; inp.value = pr.def;
                var val = document.createElement('span'); val.className = 'val';
                var show = function () { var v = parseFloat(inp.value); curP[pr.id] = v; val.textContent = (pr.dec !== undefined ? fmt(v, pr.dec) : fmt(v, 2)) + (pr.unit ? ' ' + pr.unit : ''); };
                inp.oninput = show; show();
                row.appendChild(inp); row.appendChild(val); field.appendChild(row);
            } else if (pr.type === 'field') {
                var flds = numericFields(srcFeats);
                if (!flds.length) { var warn = document.createElement('div'); warn.style.cssText = 'font-size:11.5px;color:var(--bad);padding:6px 0'; warn.textContent = 'لا توجد حقول رقمية في العناصر المختارة. استورد بيانات بخصائص رقمية (مثل عيّنة «حوادث» أو «مدن»).'; field.appendChild(warn); }
                else { var sel = document.createElement('select'); flds.forEach(function (fn) { var o = document.createElement('option'); o.value = fn; o.textContent = fn; sel.appendChild(o); }); sel.value = curP[pr.id]; sel.onchange = function () { curP[pr.id] = this.value; }; field.appendChild(sel); }
            } else if (pr.type === 'seg') {
                var seg = document.createElement('div'); seg.className = 'seg';
                pr.opts.forEach(function (o) { var b = document.createElement('button'); b.textContent = o.t; if (o.v === pr.def) b.classList.add('on'); b.onclick = function () { curP[pr.id] = o.v; seg.querySelectorAll('button').forEach(function (x) { x.classList.remove('on'); }); b.classList.add('on'); }; seg.appendChild(b); });
                field.appendChild(seg);
            }
            c.appendChild(field);
        });
        $('ppRun').onclick = function () { runOp(op, curP); };
        $('paramPanel').classList.add('show');
    }
    $('ppBack').onclick = function () { $('paramPanel').classList.remove('show'); };

    // =============================================================== LAYERS UI
    function renderLayers() {
        var box = $('layers'); box.innerHTML = ''; $('layersEmpty').style.display = layers.length ? 'none' : 'block';
        layers.slice().reverse().forEach(function (l) {
            var anySel = false; l.gl.eachLayer(function (x) { if (selectedLayerIds.has(L.Util.stamp(x))) anySel = true; });
            var d = document.createElement('div'); d.className = 'lyr' + (anySel ? ' sel' : '');
            d.innerHTML = '<span class="sw" style="background:' + l.color + '"></span><span class="nm">' + l.name + '</span><span class="ct">' + l.count + '</span><button class="zoom" title="تكبير">⊕</button><button class="eye" title="إظهار/إخفاء">' + (l.visible ? '◉' : '◎') + '</button><button class="del" title="حذف">🗑</button>';
            d.querySelector('.nm').onclick = function () { if (l.kind === 'result') return; l.gl.eachLayer(function (x) { var id = L.Util.stamp(x); if (anySel) { selectedLayerIds.delete(id); setSel(x, false); } else { selectedLayerIds.add(id); setSel(x, true); } }); refreshOps(); renderLayers(); };
            d.querySelector('.zoom').onclick = function () { try { map.fitBounds(l.gl.getBounds(), { padding: [50, 50], maxZoom: 15 }); } catch (e) { } };
            d.querySelector('.eye').onclick = function () { l.visible = !l.visible; if (l.visible) l.gl.eachLayer(function (x) { l.group.addLayer(x); }); else l.gl.eachLayer(function (x) { l.group.removeLayer(x); }); renderLayers(); };
            d.querySelector('.del').onclick = function () { l.gl.eachLayer(function (x) { l.group.removeLayer(x); selectedLayerIds.delete(L.Util.stamp(x)); }); layers = layers.filter(function (z) { return z.id !== l.id; }); renderLayers(); refreshOps(); refreshModelInputs(); };
            box.appendChild(d);
        });
    }

    // ================================================================= DRAWING
    var activeDrawer = null, editMode = false, editHandler = null;
    function drawStyle() { return styleFor('draw'); }
    var handlers = {
        marker: function () { return new L.Draw.Marker(map, { icon: new L.DivIcon({ className: '', html: '<div style="width:14px;height:14px;border-radius:50%;background:' + getCss('--geo-draw') + ';border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>', iconSize: [14, 14], iconAnchor: [7, 7] }) }); },
        polyline: function () { return new L.Draw.Polyline(map, { shapeOptions: drawStyle(), showLength: true, metric: true }); },
        polygon: function () { return new L.Draw.Polygon(map, { shapeOptions: drawStyle(), allowIntersection: false, showArea: true, metric: true }); },
        rectangle: function () { return new L.Draw.Rectangle(map, { shapeOptions: drawStyle() }); },
        circle: function () { return new L.Draw.Circle(map, { shapeOptions: drawStyle(), showRadius: true, metric: true }); }
    };
    $$('.tool').forEach(function (btn) {
        btn.onclick = function () {
            var type = btn.dataset.draw;
            $$('.tool').forEach(function (b) { b.classList.remove('active'); });
            if (activeDrawer) { activeDrawer.disable(); activeDrawer = null; }
            if (editMode) { $('optEdit').checked = false; toggleEdit(false); }
            btn.classList.add('active');
            activeDrawer = handlers[type](); activeDrawer.enable();
        };
    });

    function snapGeometry(gj) {
        if (!$('optSnap').checked) return gj;
        var all = allFeatures(); if (!all.length) return gj;
        var snapCoord = function (c) {
            var best = c, bestD = 15; var tp = map.latLngToContainerPoint(L.latLng(c[1], c[0]));
            all.forEach(function (f) { try { turf.coordAll(f).forEach(function (oc) { var op = map.latLngToContainerPoint(L.latLng(oc[1], oc[0])); var d = tp.distanceTo(op); if (d < bestD) { bestD = d; best = oc; } }); } catch (e) { } });
            return best;
        };
        try { turf.coordEach(gj, function (coord) { var s = snapCoord(coord); coord[0] = s[0]; coord[1] = s[1]; }); } catch (e) { }
        return gj;
    }

    map.on(L.Draw.Event.CREATED, function (e) {
        var lyr = e.layer; var gj;
        if (e.layerType === 'circle') {
            var c = lyr.getLatLng(); var radKm = lyr.getRadius() / 1000; gj = turf.buffer(turf.point([c.lng, c.lat]), radKm, { units: 'kilometers', steps: 48 });
            gj.properties = { name: 'دائرة', radius_km: Math.round(radKm * 1000) / 1000 };
        } else { gj = lyr.toGeoJSON(); }
        gj = snapGeometry(gj);
        var nm = ({ marker: 'نقطة', polyline: 'خط', polygon: 'مضلّع', rectangle: 'مستطيل', circle: 'دائرة' })[e.layerType] || 'عنصر';
        addGeoJSON(gj, nm + ' مرسوم', 'draw');
        $$('.tool').forEach(function (b) { b.classList.remove('active'); }); activeDrawer = null;
    });

    function toggleEdit(onf) {
        editMode = onf;
        if (onf) {
            if (activeDrawer) { activeDrawer.disable(); activeDrawer = null; $$('.tool').forEach(function (b) { b.classList.remove('active'); }); }
            editHandler = new L.EditToolbar.Edit(map, { featureGroup: drawnItems });
            editHandler.enable(); toast('وضع التحرير: اسحب الرؤوس لتعديلها، ثم ألغِ التحديد للحفظ');
        } else if (editHandler) { editHandler.save(); editHandler.disable(); editHandler = null; renderLayers(); refreshOps(); }
    }
    $('optEdit').onchange = function () { toggleEdit(this.checked); };

    // =========================================================== IMPORT / EXPORT
    var importModal = $('importModal');
    $('btnImport').onclick = function () { importModal.classList.add('show'); };
    $('imClose').onclick = function () { importModal.classList.remove('show'); };
    on(importModal, 'click', function (e) { if (e.target === importModal) importModal.classList.remove('show'); });
    function doImport(text, name) {
        var gj; try { gj = JSON.parse(text); } catch (e) { toast('كود GeoJSON غير صالح', 'err'); return; }
        try { var rec = addGeoJSON(gj, name || 'طبقة مستوردة', 'layer'); if (!rec.count) { toast('لا عناصر صالحة', 'err'); } else { try { map.fitBounds(drawnItems.getBounds(), { padding: [50, 50] }); } catch (e) { } toast('تم استيراد ' + rec.count + ' عنصر', 'ok'); } importModal.classList.remove('show'); $('gjText').value = ''; } catch (e) { toast('تعذّر: ' + (e.message || e), 'err'); }
    }
    $('gjLoad').onclick = function () { var t = $('gjText').value.trim(); if (!t) { toast('الصق كود أولاً', 'err'); return; } doImport(t); };
    $('gjFile').onclick = function () { $('fileInput').click(); };
    $('fileInput').onchange = function (e) { var f = e.target.files[0]; if (!f) return; var r = new FileReader(); r.onload = function () { doImport(r.result, f.name.replace(/\.[^.]+$/, '')); }; r.readAsText(f); e.target.value = ''; };

    $('btnExport').onclick = function () {
        var feats = []; drawnItems.eachLayer(function (l) { try { var g = l.toGeoJSON(); if (g.type === 'FeatureCollection') g.features.forEach(function (x) { feats.push(x); }); else feats.push(g); } catch (e) { } });
        resultItems.eachLayer(function (l) { try { var g = l.toGeoJSON(); if (g.type === 'FeatureCollection') g.features.forEach(function (x) { feats.push(x); }); else feats.push(g); } catch (e) { } });
        if (!feats.length) { toast('لا يوجد ما يُصدّر', 'err'); return; }
        var out = JSON.stringify(fc(feats), null, 2);
        try {
            var blob = new Blob([out], { type: 'application/geo+json' });
            var url = URL.createObjectURL(blob); var a = document.createElement('a');
            a.href = url; a.download = 'palnovaa-foresight.geojson'; document.body.appendChild(a); a.click();
            setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 400);
            toast('تم تنزيل GeoJSON', 'ok');
        } catch (e) {
            $('gjText').value = out; importModal.classList.add('show');
            toast('GeoJSON جاهز في الصندوق — انسخه', 'ok');
        }
    };

    // ================================================================= SAMPLES
    function pt(x, y, n, extra) { var p = Object.assign({ name: n }, extra || {}); return { type: 'Feature', properties: p, geometry: { type: 'Point', coordinates: [x, y] } }; }
    function sq(cx, cy, r, n) { return { type: 'Feature', properties: { name: n }, geometry: { type: 'Polygon', coordinates: [[[cx - r, cy - r], [cx + r, cy - r], [cx + r, cy + r], [cx - r, cy + r], [cx - r, cy - r]]] } }; }
    var SAMPLES = {
        cities: { name: 'مدن', gj: { type: 'FeatureCollection', features: [pt(35.10, 31.53, 'الخليل', { pop: 215000 }), pt(35.20, 31.71, 'بيت لحم', { pop: 28000 }), pt(35.23, 31.90, 'القدس', { pop: 360000 }), pt(35.45, 31.90, 'أريحا', { pop: 20000 }), pt(35.26, 32.22, 'نابلس', { pop: 156000 }), pt(35.30, 32.46, 'جنين', { pop: 49000 }), pt(35.00, 32.31, 'طولكرم', { pop: 57000 }), pt(34.97, 32.19, 'قلقيلية', { pop: 51000 }), pt(35.11, 31.98, 'رام الله', { pop: 38000 }), pt(35.28, 32.34, 'طوباس', { pop: 16000 })] } },
        route: { name: 'مسار', gj: turf.lineString([[35.23, 31.90], [35.11, 31.98], [35.26, 32.22], [35.30, 32.46]], { name: 'الطريق الشمالي' }) },
        zones: { name: 'مناطق', gj: { type: 'FeatureCollection', features: [sq(35.15, 31.95, 0.16, 'منطقة أ'), sq(35.27, 32.08, 0.14, 'منطقة ب'), sq(35.20, 32.25, 0.18, 'منطقة ج')] } },
        incidents: { name: 'حوادث', gj: { type: 'FeatureCollection', features: (function () { var a = []; var seeds = [[35.22, 31.90], [35.25, 32.21], [35.12, 31.97]]; var sd = 7; function rnd() { sd = (sd * 9301 + 49297) % 233280; return sd / 233280; } seeds.forEach(function (s, si) { for (var i = 0; i < 8; i++) { a.push(pt(s[0] + (rnd() - 0.5) * 0.12, s[1] + (rnd() - 0.5) * 0.12, 'حادث ' + (si * 8 + i + 1), { severity: Math.floor(rnd() * 5) + 1 })); } }); return a; })() } }
    };
    $$('#importModal .chip').forEach(function (c) { c.onclick = function () { var s = SAMPLES[c.dataset.sample]; doImport(JSON.stringify(s.gj), s.name); }; });

    // ========================================================== MODEL BUILDER
    var model = [];
    var MB_OPS = [
        { opId: 'buffer', g: '◎', label: 'نطاق', params: [{ id: 'dist', label: 'المسافة (كم)', min: 0.1, max: 30, step: 0.1, def: 2, dec: 1 }] },
        { opId: 'fuzzy_single', g: '◉', label: 'نطاق ضبابي', params: [{ id: 'p1', label: 'P₁ (كم)', min: 0.1, max: 15, step: 0.1, def: 2, dec: 1 }, { id: 'p2', label: 'P₂ (كم)', min: 0.5, max: 40, step: 0.5, def: 10, dec: 1 }] },
        { opId: 'centroid', g: '⊙', label: 'المركز', params: [] },
        { opId: 'convex', g: '⬡', label: 'غلاف محدّب', params: [] },
        { opId: 'dissolve', g: '❖', label: 'دمج', params: [] },
        { opId: 'intersect_prev', g: '◑', label: 'تقاطع مع طبقة', params: [{ id: 'layer', label: 'الطبقة الثانية', type: 'layer' }] },
        { opId: 'clip', g: '✂', label: 'قصّ ضمن طبقة', params: [{ id: 'layer', label: 'طبقة القصّ', type: 'layer' }] },
        { opId: 'simplify', g: '∿', label: 'تبسيط', params: [{ id: 'tol', label: 'التسامح', min: 0.0005, max: 0.05, step: 0.0005, def: 0.01, dec: 4 }] },
        { opId: 'count_in', g: '⊡', label: 'عدّ نقاط ضمن طبقة', params: [{ id: 'layer', label: 'طبقة المضلّعات', type: 'layer' }] }
    ];
    function mbOp(id) { return MB_OPS.find(function (o) { return o.opId === id; }); }

    function renderModelToolbar() {
        var tb = $('mbToolbar'); tb.innerHTML = '';
        var addInput = document.createElement('button'); addInput.className = 'mb-add'; addInput.innerHTML = '<span class="g">＋</span> طبقة إدخال';
        addInput.onclick = function () { openNodeModal('input'); }; tb.appendChild(addInput);
        var addOp = document.createElement('button'); addOp.className = 'mb-add'; addOp.innerHTML = '<span class="g">⚙</span> خطوة معالجة';
        addOp.onclick = function () { if (!model.length) { toast('أضف طبقة إدخال أولاً', 'err'); return; } openNodeModal('op'); }; tb.appendChild(addOp);
    }

    function openNodeModal(kind) {
        var nm = $('nodeModal'); var body = $('nmBody'); body.innerHTML = '';
        if (kind === 'input') {
            var srcLayers = layers.filter(function (l) { return l.kind !== 'result'; });
            if (!srcLayers.length) { body.innerHTML = '<p>لا توجد طبقات. ارسم أو استورد عناصر أولاً من تبويب الأدوات.</p>'; }
            else {
                body.innerHTML = '<p>اختر طبقة الإدخال التي يبدأ منها النموذج:</p>';
                srcLayers.forEach(function (l) { var b = document.createElement('button'); b.className = 'mb-add'; b.style.width = '100%'; b.style.marginBottom = '6px'; b.style.justifyContent = 'flex-start'; b.innerHTML = '<span class="sw" style="width:11px;height:11px;border-radius:3px;background:' + l.color + '"></span> ' + l.name + ' <span style="color:var(--ink-faint);font-size:10px">(' + l.count + ')</span>'; b.onclick = function () { model.push({ type: 'input', layerId: l.id, name: l.name }); nm.classList.remove('show'); renderModel(); }; body.appendChild(b); });
            }
        } else {
            body.innerHTML = '<p>اختر عملية المعالجة. ستُطبّق على ناتج الخطوة السابقة:</p>';
            MB_OPS.forEach(function (o) { var b = document.createElement('button'); b.className = 'mb-add'; b.style.width = '100%'; b.style.marginBottom = '6px'; b.style.justifyContent = 'flex-start'; b.innerHTML = '<span class="g">' + o.g + '</span> ' + o.label; b.onclick = function () { var params = {}; (o.params || []).forEach(function (p) { if (p.type !== 'layer') params[p.id] = p.def; else params[p.id] = null; }); model.push({ type: 'op', opId: o.opId, params: params }); nm.classList.remove('show'); renderModel(); }; body.appendChild(b); });
        }
        nm.classList.add('show');
    }
    $('nmClose').onclick = function () { $('nodeModal').classList.remove('show'); };
    on($('nodeModal'), 'click', function (e) { if (e.target === this) this.classList.remove('show'); });

    function renderModel() {
        var chain = $('mbChain'); chain.innerHTML = '';
        if (!model.length) { chain.innerHTML = '<div class="mb-empty"><span class="big">◇</span>ابنِ نموذجاً جيومكانياً كما في ArcGIS ModelBuilder:<br>اربط طبقة إدخال بسلسلة خطوات معالجة، وناتج كل خطوة يصبح مدخل التالية.<br><br>ابدأ بإضافة «طبقة إدخال».</div>'; renderModelToolbar(); return; }
        model.forEach(function (node, i) {
            if (i > 0) { var c = document.createElement('div'); c.className = 'mb-connector'; chain.appendChild(c); }
            var el = document.createElement('div'); el.className = 'mb-node ' + (node.type === 'input' ? 'input' : 'op');
            var op = node.type === 'op' ? mbOp(node.opId) : null;
            var title = node.type === 'input' ? node.name : (op ? op.label : node.opId);
            var g = node.type === 'input' ? '▤' : (op ? op.g : '⚙');
            var head = document.createElement('div'); head.className = 'nh';
            head.innerHTML = '<span class="g">' + g + '</span><span class="ttl">' + title + '</span><span class="step">' + (i + 1) + '</span><button title="حذف">×</button>';
            head.querySelector('button').onclick = function () { model.splice(i, 1); renderModel(); };
            el.appendChild(head);
            if (op && op.params && op.params.length) {
                var nb = document.createElement('div'); nb.className = 'nb';
                op.params.forEach(function (p) {
                    var lab = document.createElement('label'); lab.textContent = p.label;
                    if (p.type === 'layer') {
                        var sel = document.createElement('select');
                        var opts = '<option value="">— اختر —</option>';
                        layers.filter(function (l) { return l.kind !== 'result'; }).forEach(function (l) { opts += '<option value="' + l.id + '"' + (node.params[p.id] == l.id ? ' selected' : '') + '>' + l.name + '</option>'; });
                        sel.innerHTML = opts; sel.onchange = function () { node.params[p.id] = this.value ? parseInt(this.value) : null; };
                        lab.appendChild(sel);
                    } else {
                        var row = document.createElement('div'); row.className = 'nrow';
                        var inp = document.createElement('input'); inp.type = 'range'; inp.min = p.min; inp.max = p.max; inp.step = p.step; inp.value = node.params[p.id];
                        var v = document.createElement('span'); v.className = 'v'; var show = function () { node.params[p.id] = parseFloat(inp.value); v.textContent = fmt(parseFloat(inp.value), p.dec !== undefined ? p.dec : 1); }; inp.oninput = show; show();
                        row.appendChild(inp); row.appendChild(v); lab.appendChild(row);
                    }
                    nb.appendChild(lab);
                });
                el.appendChild(nb);
            }
            chain.appendChild(el);
        });
        var c2 = document.createElement('div'); c2.className = 'mb-connector'; chain.appendChild(c2);
        var out = document.createElement('div'); out.className = 'mb-node output';
        out.innerHTML = '<div class="nh"><span class="g">▣</span><span class="ttl">المخرجات</span></div>';
        chain.appendChild(out);
        renderModelToolbar();
    }
    function refreshModelInputs() { if ($('modelPane').classList.contains('active')) renderModel(); }

    function layerFeatures(layerId) { var rec = layers.find(function (l) { return l.id === layerId; }); if (!rec) return []; var f = []; rec.gl.eachLayer(function (l) { try { var g = l.toGeoJSON(); if (g.type === 'FeatureCollection') g.features.forEach(function (x) { f.push(x); }); else f.push(g); } catch (e) { } }); return f; }

    function runModel() {
        var st = $('mbStatus'); st.className = 'mb-status';
        if (model.length < 1 || model[0].type !== 'input') { st.className = 'mb-status err'; st.textContent = 'يجب أن يبدأ النموذج بطبقة إدخال.'; return; }
        try {
            var cur = layerFeatures(model[0].layerId);
            if (!cur.length) throw 'طبقة الإدخال فارغة';
            var log = [model[0].name];
            for (var i = 1; i < model.length; i++) {
                var node = model[i]; var P = node.params || {}; var op = mbOp(node.opId);
                cur = applyModelOp(node.opId, cur, P);
                if (!cur || !cur.length) throw 'الخطوة ' + (i + 1) + ' (' + (op ? op.label : node.opId) + ') لم تُنتج عناصر';
                log.push(op ? op.label : node.opId);
            }
            renderResult({ gj: fc(cur), name: 'ناتج النموذج' });
            st.className = 'mb-status ok'; st.textContent = '✓ تم التشغيل: ' + log.join(' → ') + ' (' + cur.length + ' عنصر)';
            showResult('ناتج النموذج', [{ k: 'عدد الخطوات', v: fmt(model.length - 1, 0) }, { k: 'عناصر المخرجات', v: fmt(cur.length, 0) }], { note: 'سلسلة: ' + log.join(' → ') });
            toast('تم تشغيل النموذج بنجاح', 'ok');
        } catch (err) { st.className = 'mb-status err'; st.textContent = '✗ ' + (typeof err === 'string' ? err : (err.message || 'خطأ')); toast('خطأ في النموذج: ' + (typeof err === 'string' ? err : err.message), 'err'); }
    }

    function applyModelOp(opId, feats, P) {
        switch (opId) {
            case 'buffer': return feats.map(function (x) { return turf.buffer(x, P.dist, { units: 'kilometers', steps: 24 }); }).filter(Boolean);
            case 'fuzzy_single': { if (P.p2 <= P.p1) throw 'P₂>P₁ مطلوب'; var mid = (P.p1 + P.p2) / 2; return feats.map(function (x) { var b = turf.buffer(x, mid, { units: 'kilometers', steps: 24 }); if (b) b.properties = { membership: 0.5 }; return b; }).filter(Boolean); }
            case 'centroid': return [turf.centroid(fc(feats))];
            case 'convex': { var pts = explodePts(feats); var h = turf.convex(fc(pts)); if (!h) throw 'يحتاج ٣ نقاط'; return [h]; }
            case 'dissolve': { var p = feats.filter(isPoly); if (p.length < 1) throw 'يحتاج مضلّعات'; var u = p[0]; for (var i = 1; i < p.length; i++)u = turf.union(u, p[i]); return [u]; }
            case 'simplify': return feats.map(function (x) { return x.geometry.type.indexOf('Point') >= 0 ? x : turf.simplify(x, { tolerance: P.tol, highQuality: true }); });
            case 'intersect_prev': { if (!P.layer) throw 'اختر الطبقة الثانية'; var other = layerFeatures(P.layer).filter(isPoly); var a = feats.filter(isPoly); if (!a.length || !other.length) throw 'يحتاج مضلّعات في الطرفين'; var ua = a[0]; for (var k = 1; k < a.length; k++)ua = turf.union(ua, a[k]); var ub = other[0]; for (var m = 1; m < other.length; m++)ub = turf.union(ub, other[m]); var it = turf.intersect(ua, ub); if (!it) throw 'لا تقاطع'; return [it]; }
            case 'clip': { if (!P.layer) throw 'اختر طبقة القصّ'; var mask = layerFeatures(P.layer).filter(isPoly); if (!mask.length) throw 'طبقة القصّ ليست مضلّعات'; var um = mask[0]; for (var n = 1; n < mask.length; n++)um = turf.union(um, mask[n]); var out = []; feats.forEach(function (x) { if (x.geometry.type.indexOf('Point') >= 0) { if (turf.booleanPointInPolygon(x, um)) out.push(x); } else if (isPoly(x)) { var c = turf.intersect(x, um); if (c) out.push(c); } }); return out; }
            case 'count_in': { if (!P.layer) throw 'اختر طبقة المضلّعات'; var polys = layerFeatures(P.layer).filter(isPoly); var pts2 = explodePts(feats); var within = turf.pointsWithinPolygon(fc(pts2), fc(polys)); return within.features; }
            default: throw 'عملية غير معروفة';
        }
    }
    $('mbRun').onclick = runModel;
    $('mbClear').onclick = function () { model = []; $('mbStatus').textContent = ''; $('mbStatus').className = 'mb-status'; renderModel(); };

    // ===================================================================== TABS
    $$('.railtab').forEach(function (t) {
        t.onclick = function () {
            $$('.railtab').forEach(function (x) { x.classList.remove('active'); });
            $$('.pane').forEach(function (x) { x.classList.remove('active'); });
            t.classList.add('active');
            var tab = t.dataset.tab;
            $(tab === 'tools' ? 'toolsPane' : tab === 'model' ? 'modelPane' : 'dataPane').classList.add('active');
            if (tab === 'model') renderModel();
            if (tab === 'data') renderLayers();
        };
    });

    // ================================================================== TOP BAR
    $('btnClear').onclick = function () { drawnItems.clearLayers(); resultItems.clearLayers(); layers = []; selectedLayerIds.clear(); model = []; renderLayers(); refreshOps(); renderModel(); $('results').classList.remove('show'); $('mbStatus').textContent = ''; toast('تم مسح الكل'); };
    $('btnTheme').onclick = function () { var cur = root.getAttribute('data-theme') || 'dark'; var next = cur === 'dark' ? 'light' : 'dark'; root.setAttribute('data-theme', next); syncBase(); layers.forEach(function (l) { l.color = col(l.kind); l.gl.eachLayer(function (x) { if (x.setStyle && x._kind !== 'result') x.setStyle(styleFor(x._kind)); }); }); renderLayers(); };

    // ======================================================= GEOCODE (Nominatim)
    var searchBox = $('gsSearch'), searchRes = $('gsSearchRes');
    function doGeocode() {
        var q = searchBox.value.trim(); if (!q) return;
        searchRes.innerHTML = '<div class="gs-sr-item muted">…يبحث</div>'; searchRes.classList.add('show');
        fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&accept-language=ar&q=' + encodeURIComponent(q), { headers: { Accept: 'application/json' } })
            .then(function (r) { return r.json(); })
            .then(function (list) {
                searchRes.innerHTML = '';
                if (!list || !list.length) { searchRes.innerHTML = '<div class="gs-sr-item muted">لا نتائج</div>'; return; }
                list.forEach(function (it) {
                    var d = document.createElement('div'); d.className = 'gs-sr-item'; d.textContent = it.display_name;
                    d.onclick = function () { var lat = parseFloat(it.lat), lon = parseFloat(it.lon); map.flyTo([lat, lon], 14); searchRes.classList.remove('show'); searchBox.value = it.display_name.split(',')[0]; };
                    searchRes.appendChild(d);
                });
            })
            .catch(function () { searchRes.innerHTML = '<div class="gs-sr-item muted">تعذّر البحث</div>'; });
    }
    on(searchBox, 'keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); doGeocode(); } });
    $('gsSearchBtn').onclick = doGeocode;
    on(root, 'click', function (e) { if (!searchRes.contains(e.target) && e.target !== searchBox && e.target !== $('gsSearchBtn')) searchRes.classList.remove('show'); });

    // ================================================================ THEME SYNC
    var mq = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)')) || null;
    var mqHandler = function () { if (!root.getAttribute('data-theme')) syncBase(); };
    if (mq) { try { mq.addEventListener('change', mqHandler); } catch (e) { try { mq.addListener(mqHandler); } catch (e2) { } } }

    // ===================================================================== INIT
    renderOps(); renderLayers(); renderModel();
    doImport(JSON.stringify(SAMPLES.cities.gj), 'مدن (مثال)');
    $('results').classList.remove('show');
    setTimeout(function () { try { map.invalidateSize(); } catch (e) { } }, 250);
    setTimeout(function () { toast('ابدأ: جرّب «مؤشر أقرب جار» على طبقة المدن، أو افتح تبويب «النموذج»'); }, 800);

    // ================================================================== CLEANUP
    return function cleanup() {
        if (mq) { try { mq.removeEventListener('change', mqHandler); } catch (e) { try { mq.removeListener(mqHandler); } catch (e2) { } } }
        listeners.forEach(function (t) { try { t[0].removeEventListener(t[1], t[2]); } catch (e) { } });
        try { map.remove(); } catch (e) { }
    };
}
