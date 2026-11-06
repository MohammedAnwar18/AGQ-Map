import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Map, { Source, Layer, Marker } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';

import { shopService } from '../../services/api';
import { readSurroundings, geocode, inferKind } from './osmClient';
import { readable, compassOf } from './spatialAgent';
import { FIRE_LOAD, hourLabel } from './hazardScience';
import { HAZARDS, KNOBS, analyseEvent, severityOfEvent } from './consequence';
import { Gauge } from './AgentCharts';

/* ============================================================
   استوديو التحليل المكانيّ الذكيّ — المنطق العلميّ

   سؤال هذه الصفحة واحد: وقع حدثٌ هنا، فماذا يحدث للمعالم؟

   ويُجاب بسلسلةٍ ماديّة لا برأي: سعةُ الطريق ومستوى خدمته، وطولُ
   الطابور، وزمنُ البديل، وزمنُ وصول الإسعاف، ومن يقع في النطاق في
   هذه الساعة — وكل رقمٍ معه معياره (HCM · NFPA · SFPE · WHO · ERG).

   والبيانات كلّها مفتوحة المصدر وتُقرأ لحظياً من المتصفّح مباشرةً:
   صورةٌ جوّية من Esri، وأسماء المناطق من طبقة المرجع، وشبكةُ الطرق
   والمساحاتُ الخضراء والمعالمُ بأصنافها من OpenStreetMap عبر
   Overpass، والترميزُ الجغرافيّ (من وصفِ مكانٍ إلى إحداثيّة) من
   Nominatim — بلا مفتاح ولا تسجيل، فيعمل لأيّ زائر.
   ============================================================ */

/* صورةٌ جوّية (Esri) أساساً، وطبقةُ مرجعٍ شفّافة فوقها تُظهر أسماء
   الأحياء والمناطق والطرق الرئيسية فقط — دون فوضى المحلّات. */
const MAP_STYLE = {
    version: 8,
    sources: {
        sat: {
            type: 'raster',
            tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
            tileSize: 256,
            maxzoom: 19,
            attribution: 'Esri · Maxar · Earthstar Geographics'
        }
    },
    layers: [{ id: 'sat', type: 'raster', source: 'sat' }]
};

const LABELS_TILES = ['https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'];

const TONE_WORD = { high: 'عاجل', warn: 'انتبه', info: 'معلومة' };
const BAND_WORD = { high: 'شدّة عالية', medium: 'شدّة متوسّطة', low: 'شدّة محدودة' };

/* ألوان مستوى الخدمة — من الانسياب إلى الانهيار */
const LOS_COLOUR = {
    A: '#22c55e', B: '#84cc16', C: '#eab308',
    D: '#f97316', E: '#ef4444', F: '#b91c1c'
};

const boundsOf = (items) => {
    const live = (items || []).filter(i => Number.isFinite(+i?.latitude));
    if (live.length < 2) return null;
    let south = 90, north = -90, west = 180, east = -180;
    for (const i of live) {
        south = Math.min(south, +i.latitude);
        north = Math.max(north, +i.latitude);
        west = Math.min(west, +i.longitude);
        east = Math.max(east, +i.longitude);
    }
    return { south, north, west, east };
};

/** يُقسّم أشكال التقرير على طبقات الخريطة */
const pick = (shapes, ...layers) => ({
    type: 'FeatureCollection',
    features: (shapes?.features || []).filter(f => layers.includes(f.properties.layer))
});

/* ============================================================ */

const AgentStudio = () => {
    const mapRef = useRef(null);

    const [dbLandmarks, setDbLandmarks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [problem, setProblem] = useState(null);

    const [kind, setKind] = useState('accident');
    const [radius, setRadius] = useState(HAZARDS.accident.radius);
    const [hour, setHour] = useState(8);
    const [knobs, setKnobs] = useState({ blockedLanes: 2, durationHours: 6, windToward: 90, load: 'building' });

    const [spot, setSpot] = useState(null);
    const [spotName, setSpotName] = useState(null);

    /* محيط OSM المقروء لحظياً: طرق ومعالم ومساحات خضراء */
    const [osm, setOsm] = useState({ roads: [], places: [], greens: [] });
    const [reading, setReading] = useState(false);

    /* شريط وصف الحدث ومكانه */
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);

    const [tab, setTab] = useState('result');
    const [shown, setShown] = useState({ labels: true, zones: true, roads: true, greens: true, places: false });
    const [picked, setPicked] = useState(null);

    const hazard = HAZARDS[kind] || HAZARDS.accident;

    // ── معالم قاعدة PalNovaa (تُدمج مع معالم OSM، ومخفيّة افتراضياً على الخريطة) ──
    useEffect(() => {
        let alive = true;
        shopService.getAllForMap()
            .then(data => {
                if (!alive) return;
                const rows = Array.isArray(data) ? data : (data?.shops || []);
                setDbLandmarks(rows
                    .filter(r => Number.isFinite(+r?.latitude) && Number.isFinite(+r?.longitude))
                    .map(r => ({
                        id: r.id,
                        name: r.name || 'بلا اسم',
                        category: r.category || 'غير مصنّف',
                        latitude: +r.latitude,
                        longitude: +r.longitude,
                        source: 'db'
                    })));
            })
            .catch(() => { /* القاعدة قد لا تكون متاحة للزائر — نكتفي بمعالم OSM */ })
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, []);

    /* المعالم الداخلة في التحليل: قاعدة PalNovaa + معالم OSM معاً */
    const landmarks = useMemo(
        () => [...dbLandmarks, ...(osm.places || [])],
        [dbLandmarks, osm]
    );

    const bounds = useMemo(() => boundsOf(dbLandmarks), [dbLandmarks]);
    const view = useMemo(() => (bounds ? {
        longitude: (bounds.west + bounds.east) / 2,
        latitude: (bounds.south + bounds.north) / 2,
        zoom: 12.2
    } : { longitude: 35.21, latitude: 31.90, zoom: 11.5 }), [bounds]);

    /* التحليل حسابٌ محض، يُعاد عند كل تغيّر فيُرى أثر كل متغيّر لحظته */
    const analysis = useMemo(() => {
        if (!spot) return { report: null, failed: null };
        try {
            return {
                report: analyseEvent({ ...spot, kind, radius, hour, ...knobs }, landmarks, osm.roads, osm.greens),
                failed: null
            };
        } catch (err) {
            return { report: null, failed: err?.message || 'تعذّر التحليل' };
        }
    }, [spot, kind, radius, hour, knobs, landmarks, osm]);

    const report = analysis.report;
    const severity = useMemo(() => severityOfEvent(report), [report]);

    const changeKind = (key) => {
        setKind(key);
        setRadius(HAZARDS[key].radius);
        setTab('result');
    };

    const setKnob = (key, value) => setKnobs(prev => ({ ...prev, [key]: value }));

    /* ── قراءة محيط الموضع من OpenStreetMap ── */
    const readAround = useCallback(async (at, r, signal) => {
        setReading(true);
        setProblem(null);
        try {
            const data = await readSurroundings(at.latitude, at.longitude, Math.max(300, r), { signal });
            if (signal?.aborted) return;
            setOsm({ roads: data.roads, places: data.places, greens: data.greens });
        } catch (err) {
            if (err?.name === 'AbortError') return;
            setProblem('تعذّرت قراءة محيط OpenStreetMap — خوادمه مشغولة، أعد المحاولة بعد لحظات');
            setOsm({ roads: [], places: [], greens: [] });
        } finally {
            if (!signal?.aborted) setReading(false);
        }
    }, []);

    /* النقر يضع الموضع؛ ثم تُقرأ الشبكة والمحيط تلقائياً */
    const place = (at) => {
        setSpot(at);
        setPicked(null);
        setSpotName(null);
    };

    /* قراءةٌ تلقائية مُهذَّبة: عند تغيّر الموضع أو النطاق، بعد استقرارٍ قصير */
    useEffect(() => {
        if (!spot) return;
        const ctrl = new AbortController();
        const t = setTimeout(() => readAround(spot, radius, ctrl.signal), 450);
        return () => { clearTimeout(t); ctrl.abort(); };
    }, [spot, radius, readAround]);

    /* ── الترميز الجغرافيّ: من وصفِ مكانٍ إلى إحداثيّة ── */
    const runSearch = useCallback(async () => {
        const q = query.trim();
        if (q.length < 2) return;

        /* استدلال نوع الحدث من الوصف — اقتراحٌ يُصحّحه المستخدم بنقرة */
        const guessed = inferKind(q);
        if (guessed) changeKind(guessed);

        setSearching(true);
        setResults([]);
        try {
            const found = await geocode(q, { limit: 6 });
            if (found.length === 1) {
                selectResult(found[0]);
            } else {
                setResults(found);
                if (!found.length) setProblem('لم يُعرَف المكان من الوصف — جرّب اسم حيٍّ أو شارعٍ أو مدينة');
            }
        } finally {
            setSearching(false);
        }
    }, [query]);

    const selectResult = (res) => {
        setResults([]);
        setProblem(null);
        setSpotName(res.name || res.full || null);
        const at = { latitude: res.latitude, longitude: res.longitude };
        setSpot(at);
        setPicked(null);
        mapRef.current?.flyTo({ center: [res.longitude, res.latitude], zoom: 15, duration: 1200 });
    };

    /* ── طبقات الخريطة ── */
    const zonesGeo = useMemo(() => pick(report?.shapes, 'scope', 'plume', 'isolate', 'heat'), [report]);
    const roadsGeo = useMemo(() => pick(report?.shapes, 'road', 'alternative'), [report]);
    const queueGeo = useMemo(() => pick(report?.shapes, 'queue'), [report]);

    const greensGeo = useMemo(() => ({
        type: 'FeatureCollection',
        features: (osm.greens || []).map(g => ({
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: [g.ring] },
            properties: { group: g.group, name: g.name || g.say }
        }))
    }), [osm.greens]);

    const greenLabels = useMemo(
        () => (osm.greens || []).filter(g => g.name).slice(0, 14),
        [osm.greens]
    );

    /* وسوم أسماء الطرق المتأثّرة والبدائل — على الخريطة لا في الجدول وحده */
    const roadLabels = useMemo(() => {
        const feats = (report?.shapes?.features || [])
            .filter(f => f.properties.layer === 'road' || f.properties.layer === 'alternative');
        const seen = new Set();
        const out = [];
        for (const f of feats) {
            const lab = f.properties.label;
            if (!lab || seen.has(lab)) continue;
            seen.add(lab);
            const c = f.geometry.coordinates;
            const mid = c[Math.floor(c.length / 2)];
            if (mid) out.push({ lon: mid[0], lat: mid[1], label: lab, alt: f.properties.layer === 'alternative' });
            if (out.length >= 6) break;
        }
        return out;
    }, [report]);

    const placesGeo = useMemo(() => ({
        type: 'FeatureCollection',
        features: (report?.places || []).map(p => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [p.longitude, p.latitude] },
            properties: { name: p.name, heads: p.heads, open: p.occupancy.open ? 1 : 0, life: p.lifeline ? 1 : 0 }
        }))
    }), [report]);

    const clock = hourLabel(hour);

    /* تصدير التقرير نصّاً — لحفظه أو مشاركته */
    const exportReport = () => {
        if (!report) return;
        const lines = [];
        lines.push('تقرير التحليل المكانيّ الذكيّ — PalNovaa Foresight');
        lines.push(`الموضع: ${spotName || `${spot.latitude.toFixed(5)}, ${spot.longitude.toFixed(5)}`}`);
        lines.push(`الحدث: ${hazard.label} · الساعة ${report.clock.text} · النطاق ${readable(report.radius)}`);
        lines.push(`الشدّة: ${severity.score}/100 (${BAND_WORD[severity.band]})`);
        lines.push(`في النطاق: ${report.totals.heads} شخصاً · ${report.totals.places} معلماً · ${report.totals.lifeline} خدمة حياتية · ${report.roads.length} طريقاً`);
        lines.push('');
        lines.push('── النتائج ──');
        report.findings.forEach((f, i) => {
            lines.push(`${i + 1}) [${TONE_WORD[f.tone]}] ${f.head}`);
            lines.push(`   ${f.body}`);
            if (f.cite) lines.push(`   المرجع: ${f.cite}`);
        });
        lines.push('');
        lines.push('── المعايير ──');
        report.standards.forEach(s => lines.push(`• ${s.code} — ${s.body}: ${s.about}`));
        lines.push('');
        lines.push('مصادر البيانات: Esri (صور) · OpenStreetMap (طرق ومعالم ومساحات) · Nominatim (ترميز جغرافي)');

        const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `foresight-${Date.now()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="st">
            {/* ══ شريط وصف الحدث ومكانه ══ */}
            <div className="st-search">
                <div className="st-search-field">
                    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                        <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && runSearch()}
                        placeholder="صِف الحدث ومكانه… مثال: «حريق قرب مدرسة البيرة الثانوية» أو «حادث على شارع القدس رام الله»"
                    />
                    {query && (
                        <button className="st-search-clear" onClick={() => { setQuery(''); setResults([]); }} aria-label="مسح">✕</button>
                    )}
                    <button className="st-search-go" onClick={runSearch} disabled={searching || query.trim().length < 2}>
                        {searching ? 'يبحث…' : 'حدّد المكان'}
                    </button>
                </div>

                {results.length > 0 && (
                    <ul className="st-results">
                        {results.map((r, i) => (
                            <li key={i} onClick={() => selectResult(r)}>
                                <b>{r.name}</b>
                                <span>{r.full}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* ══ أنواع الأحداث ══ */}
            <div className="st-bar">
                <div className="st-kinds">
                    {Object.entries(HAZARDS).map(([key, h]) => (
                        <button
                            key={key}
                            className={kind === key ? 'is-on' : ''}
                            onClick={() => changeKind(key)}
                            title={h.physics}
                        >
                            <i>{h.icon}</i> {h.label}
                        </button>
                    ))}
                </div>

                <div className="st-dials">
                    <div className="st-dial is-wide">
                        <label>
                            ساعة الحدث
                            <b className={clock.peak ? 'is-peak' : ''}>
                                {clock.text}{clock.peak ? ' · ذروة' : ''}
                            </b>
                        </label>
                        <input type="range" min="0" max="23" step="1" value={hour}
                               onChange={(e) => setHour(+e.target.value)} />
                        <span className="st-dial-why">
                            {(clock.share * 100).toFixed(1)}٪ من حركة اليوم تمرّ في هذه الساعة
                        </span>
                    </div>

                    <div className="st-dial">
                        <label>نطاق الدراسة <b>{readable(radius)}</b></label>
                        <input type="range" min="200" max="3000" step="100" value={radius}
                               onChange={(e) => setRadius(+e.target.value)} />
                    </div>

                    {hazard.knobs.map(key => {
                        const knob = KNOBS[key];
                        if (!knob) return null;
                        if (knob.options) {
                            return (
                                <div className="st-dial" key={key}>
                                    <label>{knob.label}</label>
                                    <div className="st-chips">
                                        {knob.options.map(opt => (
                                            <button key={opt} className={knobs[key] === opt ? 'is-on' : ''}
                                                    onClick={() => setKnob(key, opt)}>
                                                {FIRE_LOAD[opt]?.say || opt}
                                            </button>
                                        ))}
                                    </div>
                                    <span className="st-dial-why">{knob.why}</span>
                                </div>
                            );
                        }
                        return (
                            <div className="st-dial" key={key}>
                                <label>
                                    {knob.label}
                                    <b>{knobs[key]}{knob.unit === '°' ? `° ${compassOf(knobs[key])}` : ` ${knob.unit}`}</b>
                                </label>
                                <input type="range" min={knob.min} max={knob.max} step={knob.step}
                                       value={knobs[key] ?? knob.fallback}
                                       onChange={(e) => setKnob(key, +e.target.value)} />
                                <span className="st-dial-why">{knob.why}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            <p className={`st-say${problem || analysis.failed ? ' is-bad' : ''}`}>
                {loading ? 'جاهز — اكتب وصف الحدث ومكانه، أو انقر على الخريطة…'
                    : (problem || analysis.failed) ? (problem || analysis.failed)
                        : reading ? 'يقرأ محيط الموضع من OpenStreetMap…'
                            : !spot ? `اكتب وصف الحدث ومكانه أعلاه، أو انقر على الخريطة حيث وقع «${hazard.label}»`
                                : `${hazard.icon} ${hazard.label} — ${hazard.physics}`}
            </p>

            {/* ══ الجسم ══ */}
            <div className="st-body">
                <div className="st-map">
                    <Map
                        ref={mapRef}
                        initialViewState={view}
                        mapStyle={MAP_STYLE}
                        onClick={(e) => place({ latitude: e.lngLat.lat, longitude: e.lngLat.lng })}
                        attributionControl={false}
                        style={{ width: '100%', height: '100%', cursor: 'crosshair' }}
                    >
                        {/* طبقة أسماء المناطق والأحياء (Esri) — شفّافة فوق الصورة */}
                        <Source id="esri-labels" type="raster" tiles={LABELS_TILES} tileSize={256}>
                            <Layer id="esri-labels-layer" type="raster"
                                   layout={{ visibility: shown.labels ? 'visible' : 'none' }}
                                   paint={{ 'raster-opacity': 0.92 }} />
                        </Source>

                        {/* المساحات الخضراء والمائية من OSM */}
                        {shown.greens && (
                            <Source id="st-greens" type="geojson" data={greensGeo}>
                                <Layer id="st-green-fill" type="fill" filter={['==', ['get', 'group'], 'veg']}
                                       paint={{ 'fill-color': '#22c55e', 'fill-opacity': 0.22 }} />
                                <Layer id="st-green-line" type="line" filter={['==', ['get', 'group'], 'veg']}
                                       paint={{ 'line-color': 'rgba(34,197,94,.8)', 'line-width': 1.2 }} />
                                <Layer id="st-water-fill" type="fill" filter={['==', ['get', 'group'], 'water']}
                                       paint={{ 'fill-color': '#38bdf8', 'fill-opacity': 0.3 }} />
                                <Layer id="st-water-line" type="line" filter={['==', ['get', 'group'], 'water']}
                                       paint={{ 'line-color': 'rgba(56,189,248,.85)', 'line-width': 1.2 }} />
                            </Source>
                        )}

                        {shown.zones && (
                            <Source id="st-zones" type="geojson" data={zonesGeo}>
                                <Layer id="st-plume-fill" type="fill" filter={['==', ['get', 'layer'], 'plume']}
                                       paint={{ 'fill-color': '#a78bfa', 'fill-opacity': 0.2 }} />
                                <Layer id="st-plume-line" type="line" filter={['==', ['get', 'layer'], 'plume']}
                                       paint={{ 'line-color': 'rgba(167,139,250,.85)', 'line-width': 2 }} />
                                <Layer id="st-isolate-fill" type="fill" filter={['==', ['get', 'layer'], 'isolate']}
                                       paint={{ 'fill-color': '#f97316', 'fill-opacity': 0.14 }} />
                                <Layer id="st-isolate-line" type="line" filter={['==', ['get', 'layer'], 'isolate']}
                                       paint={{ 'line-color': 'rgba(249,115,22,.95)', 'line-width': 2.2 }} />
                                <Layer id="st-scope-line" type="line" filter={['==', ['get', 'layer'], 'scope']}
                                       paint={{ 'line-color': 'rgba(56,189,248,.6)', 'line-width': 1.4, 'line-dasharray': [3, 2] }} />
                                <Layer id="st-heat-line" type="line" filter={['==', ['get', 'layer'], 'heat']}
                                       paint={{ 'line-color': '#ef4444', 'line-width': 1.8, 'line-opacity': 0.9 }} />
                            </Source>
                        )}

                        {shown.roads && (
                            <Source id="st-roads" type="geojson" data={roadsGeo}>
                                <Layer id="st-alt-line" type="line" filter={['==', ['get', 'layer'], 'alternative']}
                                       layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                                       paint={{ 'line-color': '#22d3ee', 'line-width': 3, 'line-opacity': 0.85, 'line-dasharray': [2, 1.5] }} />
                                <Layer id="st-road-line" type="line" filter={['==', ['get', 'layer'], 'road']}
                                       layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                                       paint={{
                                           'line-color': ['match', ['get', 'grade'],
                                               'A', LOS_COLOUR.A, 'B', LOS_COLOUR.B, 'C', LOS_COLOUR.C,
                                               'D', LOS_COLOUR.D, 'E', LOS_COLOUR.E, 'F', LOS_COLOUR.F, '#94a3b8'],
                                           'line-width': 5.5, 'line-opacity': 0.92
                                       }} />
                            </Source>
                        )}

                        {shown.roads && (
                            <Source id="st-queue" type="geojson" data={queueGeo}>
                                <Layer id="st-queue-line" type="line" layout={{ 'line-cap': 'butt' }}
                                       paint={{ 'line-color': '#fde047', 'line-width': 9, 'line-opacity': 0.75, 'line-dasharray': [1.2, 0.9] }} />
                            </Source>
                        )}

                        {shown.places && (
                            <Source id="st-places" type="geojson" data={placesGeo}>
                                <Layer id="st-places-dots" type="circle" paint={{
                                    'circle-radius': ['interpolate', ['linear'], ['get', 'heads'], 0, 4, 400, 18],
                                    'circle-color': ['case',
                                        ['==', ['get', 'life'], 1], '#fb7185',
                                        ['==', ['get', 'open'], 1], '#fbbf24', '#64748b'],
                                    'circle-opacity': 0.82,
                                    'circle-stroke-width': 1.2,
                                    'circle-stroke-color': 'rgba(0,0,0,.55)'
                                }} />
                            </Source>
                        )}

                        {/* أسماء المساحات الخضراء */}
                        {shown.greens && greenLabels.map((g, i) => (
                            <Marker key={`gl${i}`} longitude={g.longitude} latitude={g.latitude} anchor="center">
                                <span className={`st-glabel is-${g.group}`}>{g.name}</span>
                            </Marker>
                        ))}

                        {/* أسماء الطرق المتأثّرة والبدائل */}
                        {shown.roads && roadLabels.map((r, i) => (
                            <Marker key={`rl${i}`} longitude={r.lon} latitude={r.lat} anchor="center">
                                <span className={`st-rlabel${r.alt ? ' is-alt' : ''}`}>{r.label}</span>
                            </Marker>
                        ))}

                        {spot && (
                            <Marker longitude={spot.longitude} latitude={spot.latitude} anchor="center">
                                <span className="st-pin" />
                            </Marker>
                        )}

                        {picked && (
                            <Marker longitude={picked.longitude} latitude={picked.latitude} anchor="bottom">
                                <span className="st-tip">{picked.name}</span>
                            </Marker>
                        )}
                    </Map>

                    {/* مبدّل الطبقات */}
                    <div className="st-layers">
                        {[
                            ['labels', 'الأسماء'],
                            ['zones', 'النطاقات'],
                            ['roads', 'الطرق'],
                            ['greens', 'المساحات الخضراء'],
                            ['places', 'المعالم']
                        ].map(([key, label]) => (
                            <button key={key} className={shown[key] ? 'is-on' : ''}
                                    onClick={() => setShown(prev => ({ ...prev, [key]: !prev[key] }))}>
                                {label}
                            </button>
                        ))}
                    </div>

                    {/* حالة قراءة OSM */}
                    <div className="st-osm">
                        <button onClick={() => spot && readAround(spot, radius)} disabled={!spot || reading}>
                            {reading ? 'يقرأ المحيط…'
                                : osm.roads.length || osm.greens.length
                                    ? `المحيط: ${osm.roads.length} طريق · ${osm.greens.length} مساحة`
                                    : 'اقرأ المحيط من OSM'}
                        </button>
                        <span>بيانات مفتوحة · OpenStreetMap + Esri</span>
                    </div>
                </div>

                {/* ── اللوحة ── */}
                <aside className="st-side">
                    {!report ? (
                        <div className="st-blank">
                            <b>ابدأ التحليل</b>
                            <p>
                                اكتب وصف الحدث ومكانه في الأعلى، أو انقر على الخريطة. فتُقرأ شبكة
                                الطرق والمساحات والمعالم من OpenStreetMap لحظياً، وتُحسب سلسلة الأثر
                                الماديّة: سعة الطريق ومستوى خدمته، وطول الطابور، والبدائل وزمنها،
                                وزمن وصول الإسعاف، ومن يقع في النطاق هذه الساعة.
                            </p>
                            <p className="st-blank-note">
                                ولكل نتيجةٍ معيارها مكتوباً — HCM · NFPA · SFPE · WHO · UN-Habitat · ERG —
                                فلا رقم بلا مرجع.
                            </p>
                        </div>
                    ) : (
                        <>
                            <nav className="st-tabs">
                                {[
                                    ['result', `النتائج (${report.findings.length})`],
                                    ['places', `المعالم (${report.totals.places})`],
                                    ['standards', 'المعايير']
                                ].map(([key, label]) => (
                                    <button key={key} className={tab === key ? 'is-on' : ''}
                                            onClick={() => setTab(key)}>
                                        {label}
                                    </button>
                                ))}
                            </nav>

                            {tab === 'result' && (
                                <div className="st-pane">
                                    {spotName && <div className="st-where">📍 {spotName}</div>}

                                    <div className="st-top">
                                        <Gauge score={severity.score} band={severity.band}
                                               label={BAND_WORD[severity.band]} />
                                        <div className="st-nums">
                                            <div><b>{report.totals.urgent}</b><span>نتيجة عاجلة</span></div>
                                            <div><b>{report.totals.heads}</b><span>شخصاً في النطاق</span></div>
                                            <div><b>{report.totals.lifeline}</b><span>خدمة حياتية</span></div>
                                            <div><b>{report.roads.length}</b><span>طريقاً مقروءاً</span></div>
                                        </div>
                                    </div>

                                    <div className="st-parts">
                                        {severity.parts.map(part => (
                                            <div className="st-part" key={part.of}>
                                                <label>{part.say}<b>+{Math.round(part.points)}</b></label>
                                                <i><em style={{ width: `${Math.round(part.share * 100)}%` }} /></i>
                                                <span>{Math.round(part.value)} من {part.per} مرجعاً</span>
                                            </div>
                                        ))}
                                    </div>

                                    {report.findings.map((finding, i) => (
                                        <article className={`st-find is-${finding.tone}`} key={i}>
                                            <span className="st-find-tag">{TONE_WORD[finding.tone]}</span>
                                            <b>{finding.head}</b>
                                            <p>{finding.body}</p>
                                            {finding.cite && <cite>{finding.cite}</cite>}
                                        </article>
                                    ))}

                                    <button className="st-export" onClick={exportReport}>
                                        ⭳ تصدير التقرير
                                    </button>
                                </div>
                            )}

                            {tab === 'places' && (
                                <div className="st-pane">
                                    <p className="st-hint">
                                        من يقع في النطاق، ومن فيه {report.clock.text}. والعدد مقدَّر من
                                        صنف المنشأة ودوامها لا من عدّادٍ حقيقيّ. المصادر: OpenStreetMap وقاعدة PalNovaa.
                                    </p>
                                    <ul className="st-list">
                                        {report.places.map(p => (
                                            <li key={p.id || p.name}
                                                className={p.occupancy.open ? '' : 'is-shut'}
                                                onMouseEnter={() => setPicked(p)}
                                                onMouseLeave={() => setPicked(null)}>
                                                <span>
                                                    {p.name}
                                                    {p.lifeline && <i className="st-life">حياتية</i>}
                                                </span>
                                                <em>{p.category} · {p.occupancy.say}</em>
                                                <i>
                                                    {readable(p.distance)} {compassOf(p.bearing)} · {p.occupancy.open ? `${Math.round(p.heads)} شخصاً` : 'مغلق الآن'}
                                                </i>
                                            </li>
                                        ))}
                                        {!report.places.length && <li><span>لا معلم داخل النطاق</span></li>}
                                    </ul>

                                    {!!report.roads.length && (
                                        <section>
                                            <h4>الطرق المقروءة من OpenStreetMap</h4>
                                            <ul className="st-list is-roads">
                                                {report.roads.slice(0, 12).map(r => (
                                                    <li key={r.id}>
                                                        <span>{r.name || r.cls.say}</span>
                                                        <em>
                                                            {r.cls.say} · {r.lanes} مسار{r.lanesTagged ? '' : ' (مُستكمَل)'}
                                                            {' · '}{r.speed} كم/س{r.speedTagged ? '' : ' (من التصنيف)'}
                                                            {r.oneway ? ' · اتجاه واحد' : ''}
                                                        </em>
                                                        <i>سعة {r.capacity} مركبة/ساعة · {readable(r.length)}</i>
                                                    </li>
                                                ))}
                                            </ul>
                                        </section>
                                    )}

                                    {!!(osm.greens || []).length && (
                                        <section>
                                            <h4>المساحات الخضراء والمائية (OpenStreetMap)</h4>
                                            <ul className="st-list is-greens">
                                                {osm.greens.slice(0, 10).map(g => (
                                                    <li key={g.id}>
                                                        <span>{g.name || g.say}</span>
                                                        <em>{g.say}{g.group === 'water' ? ' · مائي' : ' · أخضر'}</em>
                                                        <i>{readable(g.distance)}</i>
                                                    </li>
                                                ))}
                                            </ul>
                                        </section>
                                    )}
                                </div>
                            )}

                            {tab === 'standards' && (
                                <div className="st-pane">
                                    <p className="st-hint">
                                        المعايير الداخلة في تحليل «{hazard.label}». ولا رقم في النتائج
                                        إلّا وهو من أحدها أو من نموذجٍ منشور.
                                    </p>
                                    {report.standards.map(s => (
                                        <article className="st-std" key={s.code}>
                                            <b>{s.code}</b>
                                            <em>{s.body}</em>
                                            <p>{s.about}</p>
                                        </article>
                                    ))}
                                    <section>
                                        <h4>فيزياء هذا الحدث</h4>
                                        <p className="st-hint">{hazard.physics}</p>
                                    </section>
                                </div>
                            )}
                        </>
                    )}
                </aside>
            </div>
        </div>
    );
};

export default AgentStudio;
