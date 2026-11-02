import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Map, { Source, Layer, Marker } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';

import { shopService } from '../../services/api';
import hellyService from '../../services/hellyApi';
import { readable, compassOf } from './spatialAgent';
import { FIRE_LOAD, hourLabel } from './hazardScience';
import { HAZARDS, KNOBS, analyseEvent, severityOfEvent } from './consequence';
import { Gauge } from './AgentCharts';

/* ============================================================
   استوديو التحليل المكاني — المنطق العلميّ

   سؤال هذه الصفحة واحد: وقع حدثٌ هنا، فماذا يحدث للمعالم؟

   ولا يُجاب عنه برأي. يُجاب بسلسلةٍ ماديّة: حادثٌ يُغلق مسارين
   على شريان ⇒ السعة تنزل من ‎3200‎ إلى ‎1600‎ مركبة/ساعة ⇒ الوارد
   في هذه الساعة ‎2090‎ ⇒ مستوى الخدمة ينهار من ‎B‎ إلى ‎F‎ ⇒ طابور
   ينمو ‎29‎ متراً كل دقيقة ⇒ البديل يُضيف ‎1.0‎ دقيقة ⇒ وأقرب
   مستشفى يصير على ‎6.1‎ دقيقة، فيتجاوز حدّ ‎NFPA 1710‎.

   كل رقم في هذه السلسلة مردودٌ إلى نموذجٍ منشور، ومعيارُه مكتوب
   بجانبه. وثلاثة متغيّرات تُغيّر الناتج تغييراً حقيقياً:

     نوع الحدث    الحريق يُشعّ ويُدخّن، والانقطاع يُعطّل، والحادث يُزحم
     ساعة اليوم   المدرسة ممتلئة العاشرة وخاوية الثالثة، والطريق كذلك
     مقابض النوع  المسارات المغلقة، ومدّة الانقطاع، واتجاه الريح

   والبيانات مفتوحة المصدر كلّها: معالم الخريطة من قاعدة الموقع،
   وشبكة الطرق من ‎OpenStreetMap‎ عبر ‎Overpass‎ — بلا مفتاح ولا حدّ.
   ============================================================ */

const MAP_STYLE = {
    version: 8,
    sources: {
        base: {
            type: 'raster',
            tiles: ['https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}'],
            tileSize: 256,
            attribution: 'Google'
        }
    },
    layers: [{ id: 'base', type: 'raster', source: 'base' }]
};

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
    const [landmarks, setLandmarks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [problem, setProblem] = useState(null);

    const [kind, setKind] = useState('accident');
    const [radius, setRadius] = useState(HAZARDS.accident.radius);
    const [hour, setHour] = useState(8);
    const [knobs, setKnobs] = useState({ blockedLanes: 2, durationHours: 6, windToward: 90, load: 'building' });

    const [spot, setSpot] = useState(null);
    const [roads, setRoads] = useState([]);
    const [roadsAt, setRoadsAt] = useState(null);
    const [reading, setReading] = useState(false);

    const [tab, setTab] = useState('result');
    const [shown, setShown] = useState({ zones: true, roads: true, places: true });
    const [picked, setPicked] = useState(null);

    const hazard = HAZARDS[kind] || HAZARDS.accident;

    // ── المعالم ──
    useEffect(() => {
        let alive = true;

        shopService.getAllForMap()
            .then(data => {
                if (!alive) return;
                const rows = Array.isArray(data) ? data : (data?.shops || []);
                setLandmarks(rows
                    .filter(r => Number.isFinite(+r?.latitude) && Number.isFinite(+r?.longitude))
                    .map(r => ({
                        id: r.id,
                        name: r.name || 'بلا اسم',
                        category: r.category || 'غير مصنّف',
                        latitude: +r.latitude,
                        longitude: +r.longitude
                    })));
            })
            .catch(err => { if (alive) setProblem(err?.response?.data?.error || 'تعذّر تحميل المعالم'); })
            .finally(() => { if (alive) setLoading(false); });

        return () => { alive = false; };
    }, []);

    const bounds = useMemo(() => boundsOf(landmarks), [landmarks]);

    const view = useMemo(() => (bounds ? {
        longitude: (bounds.west + bounds.east) / 2,
        latitude: (bounds.south + bounds.north) / 2,
        zoom: 12.4
    } : { longitude: 35.1839, latitude: 31.9617, zoom: 13 }), [bounds]);

    /*
     * التحليل حسابٌ محض، فلا يحتاج زرّاً ولا انتظاراً.
     *
     * يُعاد عند كل تغيّر: نقل الموضع، أو تبديل النوع، أو تحريك
     * الساعة، أو تدوير الريح. فيرى المستخدم أثر كل متغيّر لحظةَ
     * تحريكه — وهذا ما يجعله يفهم السلسلة لا يقرأ نتيجتها فقط.
     */
    const analysis = useMemo(() => {
        if (!spot) return { report: null, failed: null };

        try {
            return {
                report: analyseEvent({ ...spot, kind, radius, hour, ...knobs }, landmarks, roads),
                failed: null
            };
        } catch (err) {
            /* الخطأ يُردّ قيمةً لا يُكتب في الحالة: الكتابة أثناء
               العرض تُعيد التصيير من داخله */
            return { report: null, failed: err?.message || 'تعذّر التحليل' };
        }
    }, [spot, kind, radius, hour, knobs, landmarks, roads]);

    const report = analysis.report;
    const severity = useMemo(() => severityOfEvent(report), [report]);

    /* تبديل النوع يُعيد النطاق إلى نطاق النوع ويُفرغ ما لا يخصّه */
    const changeKind = (key) => {
        setKind(key);
        setRadius(HAZARDS[key].radius);
        setTab('result');
    };

    /*
     * قراءة الشبكة من ‎OSM‎.
     *
     * بلا طرقٍ حقيقية يبقى التحليل المروريّ عاجزاً — فيقول ذلك
     * صريحاً بدل أن يُخمّن. والقراءة لحظية لا تُخزَّن.
     */
    const readNetwork = useCallback(async (at) => {
        if (!at) return;

        setReading(true);
        setProblem(null);

        try {
            const net = await hellyService.readRoads(at.latitude, at.longitude, Math.max(300, radius));
            setRoads(net.roads || []);
            setRoadsAt(at);
        } catch (err) {
            setProblem(err?.response?.data?.error || 'تعذّرت قراءة شبكة الطرق');
            setRoads([]);
        } finally {
            setReading(false);
        }
    }, [radius]);

    /* الموضع الجديد يُسقط شبكةً قُرئت لموضعٍ بعيد */
    const place = (at) => {
        setSpot(at);
        setPicked(null);

        if (roadsAt) {
            const far = Math.abs(roadsAt.latitude - at.latitude) > 0.02
                || Math.abs(roadsAt.longitude - at.longitude) > 0.02;
            if (far) { setRoads([]); setRoadsAt(null); }
        }
    };

    const setKnob = (key, value) => setKnobs(prev => ({ ...prev, [key]: value }));

    /* ── طبقات الخريطة ── */
    const zonesGeo = useMemo(() => pick(report?.shapes, 'scope', 'plume', 'isolate', 'heat'), [report]);
    const roadsGeo = useMemo(() => pick(report?.shapes, 'road', 'alternative'), [report]);
    const queueGeo = useMemo(() => pick(report?.shapes, 'queue'), [report]);

    const placesGeo = useMemo(() => ({
        type: 'FeatureCollection',
        features: (report?.places || []).map(p => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [p.longitude, p.latitude] },
            properties: {
                name: p.name,
                heads: p.heads,
                open: p.occupancy.open ? 1 : 0,
                life: p.lifeline ? 1 : 0
            }
        }))
    }), [report]);

    const clock = hourLabel(hour);

    return (
        <div className="st">
            {/* ══ الشريط العلوي ══ */}
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
                    {/* الساعة — المتغيّر الذي يُغيّر كل شيء */}
                    <div className="st-dial is-wide">
                        <label>
                            ساعة الحدث
                            <b className={clock.peak ? 'is-peak' : ''}>
                                {clock.text}{clock.peak ? ' · ذروة' : ''}
                            </b>
                        </label>
                        <input
                            type="range" min="0" max="23" step="1"
                            value={hour}
                            onChange={(e) => setHour(+e.target.value)}
                        />
                        <span className="st-dial-why">
                            {(clock.share * 100).toFixed(1)}٪ من حركة اليوم تمرّ في هذه الساعة
                        </span>
                    </div>

                    <div className="st-dial">
                        <label>نطاق الدراسة <b>{readable(radius)}</b></label>
                        <input
                            type="range" min="200" max="3000" step="100"
                            value={radius}
                            onChange={(e) => setRadius(+e.target.value)}
                        />
                    </div>

                    {/* مقابض النوع — تظهر لما يخصّه فقط */}
                    {hazard.knobs.map(key => {
                        const knob = KNOBS[key];
                        if (!knob) return null;

                        if (knob.options) {
                            return (
                                <div className="st-dial" key={key}>
                                    <label>{knob.label}</label>
                                    <div className="st-chips">
                                        {knob.options.map(opt => (
                                            <button
                                                key={opt}
                                                className={knobs[key] === opt ? 'is-on' : ''}
                                                onClick={() => setKnob(key, opt)}
                                            >
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
                                    <b>
                                        {knobs[key]}{knob.unit === '°'
                                            ? `° ${compassOf(knobs[key])}`
                                            : ` ${knob.unit}`}
                                    </b>
                                </label>
                                <input
                                    type="range"
                                    min={knob.min} max={knob.max} step={knob.step}
                                    value={knobs[key] ?? knob.fallback}
                                    onChange={(e) => setKnob(key, +e.target.value)}
                                />
                                <span className="st-dial-why">{knob.why}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            <p className={`st-say${problem || analysis.failed ? ' is-bad' : ''}`}>
                {loading ? 'يقرأ معالم الخريطة…'
                    : (problem || analysis.failed) ? (problem || analysis.failed)
                        : !spot ? `اضغط على الخريطة حيث وقع «${hazard.label}»`
                            : `${hazard.icon} ${hazard.label} — ${hazard.physics}`}
            </p>

            {/* ══ الجسم ══ */}
            <div className="st-body">
                {/* ── الخريطة ── */}
                <div className="st-map">
                    <Map
                        initialViewState={view}
                        mapStyle={MAP_STYLE}
                        onClick={(e) => place({ latitude: e.lngLat.lat, longitude: e.lngLat.lng })}
                        attributionControl={false}
                        style={{ width: '100%', height: '100%', cursor: 'crosshair' }}
                    >
                        {/* النطاقات: الدراسة، وممرّ الدخان، والعزل، وحلقات الحرارة */}
                        {shown.zones && (
                            <Source id="st-zones" type="geojson" data={zonesGeo}>
                                {/* ممرّ الدخان أوّلاً فيبقى تحت ما هو أضيق منه */}
                                <Layer id="st-plume-fill" type="fill" filter={['==', ['get', 'layer'], 'plume']}
                                       paint={{ 'fill-color': '#a78bfa', 'fill-opacity': 0.2 }} />
                                <Layer id="st-plume-line" type="line" filter={['==', ['get', 'layer'], 'plume']}
                                       paint={{ 'line-color': 'rgba(167,139,250,.85)', 'line-width': 2 }} />

                                <Layer id="st-isolate-fill" type="fill" filter={['==', ['get', 'layer'], 'isolate']}
                                       paint={{ 'fill-color': '#f97316', 'fill-opacity': 0.14 }} />
                                <Layer id="st-isolate-line" type="line" filter={['==', ['get', 'layer'], 'isolate']}
                                       paint={{ 'line-color': 'rgba(249,115,22,.95)', 'line-width': 2.2 }} />

                                {/* نطاق الدراسة حدوداً لا مساحةً — كي لا يحجب ما تحته */}
                                <Layer id="st-scope-line" type="line" filter={['==', ['get', 'layer'], 'scope']}
                                       paint={{
                                           'line-color': 'rgba(56,189,248,.6)',
                                           'line-width': 1.4,
                                           'line-dasharray': [3, 2]
                                       }} />

                                {/* حلقات الحرارة حلقاتٌ لا أقراص، فتُقرأ متداخلة */}
                                <Layer id="st-heat-line" type="line" filter={['==', ['get', 'layer'], 'heat']}
                                       paint={{ 'line-color': '#ef4444', 'line-width': 1.8, 'line-opacity': 0.9 }} />
                            </Source>
                        )}

                        {/* الطرق: المتأثّر بلون مستوى خدمته، والبدائل بالأزرق */}
                        {shown.roads && (
                            <Source id="st-roads" type="geojson" data={roadsGeo}>
                                {/* البدائل متقطّعةً تحت، فلا تُشوّش الطريق المتأثّر */}
                                <Layer id="st-alt-line" type="line"
                                       filter={['==', ['get', 'layer'], 'alternative']}
                                       layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                                       paint={{
                                           'line-color': '#22d3ee',
                                           'line-width': 3,
                                           'line-opacity': 0.85,
                                           'line-dasharray': [2, 1.5]
                                       }} />

                                {/* الطريق المتأثّر بلون مستوى خدمته بعد الحدث */}
                                <Layer id="st-road-line" type="line"
                                       filter={['==', ['get', 'layer'], 'road']}
                                       layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                                       paint={{
                                           'line-color': ['match', ['get', 'grade'],
                                               'A', LOS_COLOUR.A, 'B', LOS_COLOUR.B, 'C', LOS_COLOUR.C,
                                               'D', LOS_COLOUR.D, 'E', LOS_COLOUR.E, 'F', LOS_COLOUR.F,
                                               '#94a3b8'],
                                           'line-width': 5.5,
                                           'line-opacity': 0.92
                                       }} />
                            </Source>
                        )}

                        {/* الطابور — يُرى ممتدّاً على الشارع نفسه */}
                        {shown.roads && (
                            <Source id="st-queue" type="geojson" data={queueGeo}>
                                <Layer id="st-queue-line" type="line" layout={{ 'line-cap': 'butt' }} paint={{
                                    'line-color': '#fde047',
                                    'line-width': 9,
                                    'line-opacity': 0.75,
                                    'line-dasharray': [1.2, 0.9]
                                }} />
                            </Source>
                        )}

                        {/* المعالم: حجمها بعدد من فيها الآن */}
                        {shown.places && (
                            <Source id="st-places" type="geojson" data={placesGeo}>
                                <Layer id="st-places-dots" type="circle" paint={{
                                    'circle-radius': ['interpolate', ['linear'], ['get', 'heads'], 0, 4, 400, 18],
                                    'circle-color': ['case',
                                        ['==', ['get', 'life'], 1], '#fb7185',
                                        ['==', ['get', 'open'], 1], '#fbbf24',
                                        '#64748b'],
                                    'circle-opacity': 0.8,
                                    'circle-stroke-width': 1.2,
                                    'circle-stroke-color': 'rgba(0,0,0,.55)'
                                }} />
                            </Source>
                        )}

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

                    {/* شبكة الطرق */}
                    <div className="st-osm">
                        <button onClick={() => readNetwork(spot)} disabled={!spot || reading}>
                            {reading ? 'يقرأ…' : roads.length ? `الشبكة: ${roads.length} طريقاً` : 'اقرأ شبكة الطرق'}
                        </button>
                        <span>OpenStreetMap · مفتوح المصدر</span>
                    </div>

                    {/* مبدّل الطبقات */}
                    <div className="st-layers">
                        {[
                            ['zones', 'النطاقات'],
                            ['roads', 'الطرق والطابور'],
                            ['places', 'المعالم']
                        ].map(([key, label]) => (
                            <button
                                key={key}
                                className={shown[key] ? 'is-on' : ''}
                                onClick={() => setShown(prev => ({ ...prev, [key]: !prev[key] }))}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    {/* دليل الألوان */}
                    <div className="st-key">
                        <span><i style={{ background: LOS_COLOUR.F }} /> مستوى خدمة F</span>
                        <span><i style={{ background: LOS_COLOUR.A }} /> مستوى A</span>
                        <span><i style={{ background: '#fde047' }} /> طابور</span>
                        <span><i style={{ background: '#22d3ee' }} /> بديل</span>
                        <span><i style={{ background: '#fb7185' }} /> خدمة حياتية</span>
                        {kind === 'fire' && <span><i style={{ background: '#a78bfa' }} /> ممرّ الدخان</span>}
                    </div>
                </div>

                {/* ── اللوحة ── */}
                <aside className="st-side">
                    {!report ? (
                        <div className="st-blank">
                            <b>اضغط على الخريطة</b>
                            <p>
                                فتُحسب سلسلة الأثر الماديّة لهذا الموضع: سعة الطريق ومستوى
                                خدمته، وطول الطابور، والبدائل وزمنها، وزمن وصول الإسعاف،
                                ومن يقع في النطاق في هذه الساعة بالضبط.
                            </p>
                            <p className="st-blank-note">
                                ولكل نتيجةٍ معيارها مكتوباً — ‎HCM‎ و‎NFPA‎ و‎SFPE‎ و‎WHO‎
                                و‎UN-Habitat‎ و‎ERG‎ — فلا رقم بلا مرجع.
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

                            {/* ══ النتائج ══ */}
                            {tab === 'result' && (
                                <div className="st-pane">
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

                                    {/*
                                      * تفصيل الشدّة.
                                      *
                                      * الرقم وحده يُقبَل أو يُرفَض، وتفصيلُه
                                      * يُفهَم. فيُعرض من أين جاءت كل نقطة.
                                      */}
                                    <div className="st-parts">
                                        {severity.parts.map(part => (
                                            <div className="st-part" key={part.of}>
                                                <label>
                                                    {part.say}
                                                    <b>+{Math.round(part.points)}</b>
                                                </label>
                                                <i><em style={{ width: `${Math.round(part.share * 100)}%` }} /></i>
                                                <span>
                                                    {Math.round(part.value)} من {part.per} مرجعاً
                                                </span>
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
                                </div>
                            )}

                            {/* ══ المعالم ══ */}
                            {tab === 'places' && (
                                <div className="st-pane">
                                    <p className="st-hint">
                                        من يقع في النطاق، ومن فيه {report.clock.text}. والعدد مقدَّر من
                                        صنف المنشأة ودوامها لا من عدّادٍ حقيقيّ.
                                    </p>

                                    <ul className="st-list">
                                        {report.places.map(p => (
                                            <li
                                                key={p.id || p.name}
                                                className={p.occupancy.open ? '' : 'is-shut'}
                                                onMouseEnter={() => setPicked(p)}
                                                onMouseLeave={() => setPicked(null)}
                                            >
                                                <span>
                                                    {p.name}
                                                    {p.lifeline && <i className="st-life">حياتية</i>}
                                                </span>
                                                <em>{p.category} · {p.occupancy.say}</em>
                                                <i>
                                                    {readable(p.distance)} {compassOf(p.bearing)}
                                                    {' · '}
                                                    {p.occupancy.open
                                                        ? `${Math.round(p.heads)} شخصاً`
                                                        : 'مغلق الآن'}
                                                </i>
                                            </li>
                                        ))}
                                        {!report.places.length && (
                                            <li><span>لا معلم داخل النطاق</span></li>
                                        )}
                                    </ul>

                                    {!!report.roads.length && (
                                        <section>
                                            <h4>الطرق المقروءة من OpenStreetMap</h4>
                                            <ul className="st-list is-roads">
                                                {report.roads.slice(0, 12).map(r => (
                                                    <li key={r.id}>
                                                        <span>{r.name || r.cls.say}</span>
                                                        <em>
                                                            {r.cls.say} · {r.lanes} مسار
                                                            {r.lanesTagged ? '' : ' (مُستكمَل)'}
                                                            {' · '}{r.speed} كم/س
                                                            {r.speedTagged ? '' : ' (من التصنيف)'}
                                                            {r.oneway ? ' · اتجاه واحد' : ''}
                                                        </em>
                                                        <i>سعة {r.capacity} مركبة/ساعة · {readable(r.length)}</i>
                                                    </li>
                                                ))}
                                            </ul>
                                        </section>
                                    )}
                                </div>
                            )}

                            {/* ══ المعايير ══ */}
                            {tab === 'standards' && (
                                <div className="st-pane">
                                    <p className="st-hint">
                                        المعايير الداخلة في تحليل «{hazard.label}». ولا رقم في
                                        النتائج إلّا وهو من أحدها أو من نموذجٍ منشور.
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
