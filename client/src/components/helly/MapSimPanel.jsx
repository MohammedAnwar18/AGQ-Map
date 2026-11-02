import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Map, { Source, Layer, Marker } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';

import { shopService } from '../../services/api';
import { placeCrowd, runOnMap, districtsOf, sideName, circlePolygon } from './spatialSim';
import { seedOf } from './simEngine';
import { readable } from './spatialAgent';

/* ============================================================
   المحاكاة على الخريطة

   المحاكاة السابقة كانت أرقاماً مجرّدة لا تُفهم. وهذه تُرى:

     كل نقطة شخص، ولونها رأيه — أحمر معارض وأخضر مؤيّد
     الدائرة الذهبية موضع الحدث ونطاقه
     المربّعات الشفّافة مناطق، لونها رأي المنطقة
     وزرُّ تشغيل يُمضي الزمن فترى الرأي ينتشر على الخريطة

   ولا رقم على الشاشة إلّا ومعه جملةٌ تقول معناه. فمن أراد «التباين
   0.34» وجده في المحاكاة المجرّدة، ومن أراد أن يفهم ما يحدث
   وجده هنا.
   ============================================================ */

/* ألوان الرأي: أحمر ← رمادي ← أخضر. وهو تدرّج يُقرأ بلا دليل */
const OPINION_RAMP = [
    'interpolate', ['linear'], ['get', 'opinion'],
    -1, '#ef4444',
    -0.35, '#f97316',
    0, '#94a3b8',
    0.35, '#84cc16',
    1, '#22c55e'
];

const SCENARIOS = [
    { key: 'closure', label: 'إغلاق طريق', toward: -0.8, force: 0.75, radius: 600, at: 3, note: 'إغلاق يضرّ من حوله' },
    { key: 'project', label: 'مشروع جديد', toward: 0.75, force: 0.65, radius: 900, at: 3, note: 'افتتاح يُرضي من حوله' },
    { key: 'incident', label: 'حادث', toward: -0.9, force: 0.9, radius: 400, at: 3, note: 'حادث قريب يُقلق بشدّة' },
    { key: 'service', label: 'خدمة جديدة', toward: 0.85, force: 0.6, radius: 1200, at: 3, note: 'خدمة تنفع نطاقاً واسعاً' }
];

const ROUNDS = 24;
const pct = (n) => `${Math.round((n || 0) * 100)}٪`;

/* خريطة قمر صناعي — نفس ما تعرضه الخريطة الرئيسية */
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

    const padLat = Math.max(0.004, (north - south) * 0.08);
    const padLon = Math.max(0.004, (east - west) * 0.08);

    return { south: south - padLat, north: north + padLat, west: west - padLon, east: east + padLon };
};

/* ============================================================ */

const MapSimPanel = () => {
    const [landmarks, setLandmarks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [problem, setProblem] = useState(null);

    const [scenario, setScenario] = useState('closure');
    const [spot, setSpot] = useState(null);
    const [result, setResult] = useState(null);
    const [busy, setBusy] = useState(false);

    const [frame, setFrame] = useState(0);
    const [playing, setPlaying] = useState(false);
    const [showDistricts, setShowDistricts] = useState(true);

    const mapRef = useRef(null);
    const timer = useRef(null);

    const chosen = SCENARIOS.find(s => s.key === scenario) || SCENARIOS[0];

    // ── المعالم ──
    useEffect(() => {
        let alive = true;

        shopService.getAllForMap()
            .then(data => {
                if (!alive) return;
                const rows = Array.isArray(data) ? data : (data?.shops || []);
                setLandmarks(rows.filter(r => Number.isFinite(+r?.latitude) && Number.isFinite(+r?.longitude)));
            })
            .catch(err => { if (alive) setProblem(err?.response?.data?.error || 'تعذّر تحميل المعالم'); })
            .finally(() => { if (alive) setLoading(false); });

        return () => { alive = false; };
    }, []);

    const bounds = useMemo(() => boundsOf(landmarks), [landmarks]);

    const view = useMemo(() => {
        if (!bounds) return { longitude: 35.1839, latitude: 31.9617, zoom: 13 };
        return {
            longitude: (bounds.west + bounds.east) / 2,
            latitude: (bounds.south + bounds.north) / 2,
            zoom: 12.4
        };
    }, [bounds]);

    /* ── التشغيل ── */
    const run = useCallback((at) => {
        if (!landmarks.length || !bounds) return;

        setBusy(true);
        setPlaying(false);

        setTimeout(() => {
            try {
                const seed = seedOf(`${scenario}|${at.latitude.toFixed(4)}|${at.longitude.toFixed(4)}`);
                const agents = placeCrowd(220, landmarks, { seed });

                const made = runOnMap({
                    agents,
                    bounds,
                    rounds: ROUNDS,
                    seed,
                    cells: 6,
                    event: {
                        latitude: at.latitude,
                        longitude: at.longitude,
                        radius: chosen.radius,
                        toward: chosen.toward,
                        force: chosen.force,
                        at: chosen.at,
                        label: chosen.label
                    }
                });

                setResult(made);
                setFrame(0);
                setPlaying(true);
            } finally {
                setBusy(false);
            }
        }, 20);
    }, [landmarks, bounds, scenario, chosen]);

    /* نقرة على الخريطة تضع الحدث وتُشغّل — خطوة واحدة لا خطوتان */
    const onMapClick = useCallback((e) => {
        const at = { latitude: e.lngLat.lat, longitude: e.lngLat.lng };
        setSpot(at);
        run(at);
    }, [run]);

    /* ── الزمن ── */
    useEffect(() => {
        if (!playing || !result) return undefined;

        timer.current = setInterval(() => {
            setFrame(now => {
                if (now >= result.frames.length - 1) { setPlaying(false); return now; }
                return now + 1;
            });
        }, 320);

        return () => clearInterval(timer.current);
    }, [playing, result]);

    const current = result?.frames[Math.min(frame, result.frames.length - 1)] || null;

    /* ── ما يُرسم ── */
    const agentsGeo = useMemo(() => {
        if (!current) return { type: 'FeatureCollection', features: [] };

        return {
            type: 'FeatureCollection',
            features: current.agents.map(a => ({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [a.longitude, a.latitude] },
                properties: { opinion: a.opinion }
            }))
        };
    }, [current]);

    const districtGeo = useMemo(() => {
        if (!current || !showDistricts) return { type: 'FeatureCollection', features: [] };

        return {
            type: 'FeatureCollection',
            features: current.districts.map(d => ({
                type: 'Feature',
                geometry: {
                    type: 'Polygon',
                    coordinates: [[
                        [d.west, d.south], [d.east, d.south],
                        [d.east, d.north], [d.west, d.north], [d.west, d.south]
                    ]]
                },
                properties: { mean: d.mean }
            }))
        };
    }, [current, showDistricts]);

    const ringGeo = useMemo(() => {
        if (!spot) return null;
        return {
            type: 'Feature',
            geometry: circlePolygon(spot, chosen.radius, 64),
            properties: {}
        };
    }, [spot, chosen.radius]);

    const outcome = result?.outcome;
    const swung = outcome?.swung;

    return (
        <div className="ms">
            {/* ══ ١) اختر ══ */}
            <div className="ms-bar">
                <div className="ms-scen">
                    {SCENARIOS.map(s => (
                        <button
                            key={s.key}
                            className={scenario === s.key ? 'is-on' : ''}
                            onClick={() => { setScenario(s.key); if (spot) run(spot); }}
                        >
                            {s.label}
                        </button>
                    ))}
                </div>

                <p className="ms-say">
                    {loading ? 'يقرأ معالم الخريطة…'
                        : problem ? problem
                            : !spot ? '① اضغط على الخريطة في المكان الذي يحدث فيه'
                                : busy ? 'يحسب…'
                                    : chosen.note}
                </p>
            </div>

            {/* ══ ٢) الخريطة ══ */}
            <div className="ms-map">
                <Map
                    ref={mapRef}
                    initialViewState={view}
                    mapStyle={MAP_STYLE}
                    onClick={onMapClick}
                    attributionControl={false}
                    style={{ width: '100%', height: '100%', cursor: 'crosshair' }}
                >
                    {/* المناطق أسفل كل شيء: خلفية تلوّن الأرض */}
                    {showDistricts && (
                        <Source id="ms-districts" type="geojson" data={districtGeo}>
                            <Layer
                                id="ms-districts-fill"
                                type="fill"
                                paint={{
                                    'fill-color': [
                                        'interpolate', ['linear'], ['get', 'mean'],
                                        -1, '#ef4444', -0.2, '#f59e0b', 0, '#64748b',
                                        0.2, '#84cc16', 1, '#22c55e'
                                    ],
                                    'fill-opacity': 0.22
                                }}
                            />
                            <Layer
                                id="ms-districts-line"
                                type="line"
                                paint={{ 'line-color': 'rgba(255,255,255,.18)', 'line-width': 1 }}
                            />
                        </Source>
                    )}

                    {/* دائرة الحدث */}
                    {ringGeo && (
                        <Source id="ms-ring" type="geojson" data={ringGeo}>
                            <Layer id="ms-ring-fill" type="fill"
                                   paint={{ 'fill-color': '#fbab15', 'fill-opacity': 0.1 }} />
                            <Layer id="ms-ring-line" type="line"
                                   paint={{ 'line-color': '#fbab15', 'line-width': 2, 'line-dasharray': [2, 2] }} />
                        </Source>
                    )}

                    {/*
                      * الناس نقاطاً.
                      *
                      * طبقةٌ واحدة بلونٍ مشتقٍّ من الرأي، لا مئتا علامة
                      * منفصلة: الطبقة تُرسم على كرت الرسوم فتتحرّك
                      * بسلاسة، ومئتا عنصر ‎DOM‎ تُثقل كل جولة.
                      */}
                    <Source id="ms-agents" type="geojson" data={agentsGeo}>
                        <Layer
                            id="ms-agents-dots"
                            type="circle"
                            paint={{
                                'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 3, 15, 6.5],
                                'circle-color': OPINION_RAMP,
                                'circle-stroke-width': 0.8,
                                'circle-stroke-color': 'rgba(0,0,0,.45)',
                                'circle-opacity': 0.92
                            }}
                        />
                    </Source>

                    {/* علامة موضع الحدث */}
                    {spot && (
                        <Marker longitude={spot.longitude} latitude={spot.latitude} anchor="center">
                            <span className="ms-pin" />
                        </Marker>
                    )}
                </Map>

                {/* دليل الألوان */}
                <div className="ms-key">
                    <span><i style={{ background: '#ef4444' }} /> معارض</span>
                    <span><i style={{ background: '#94a3b8' }} /> محايد</span>
                    <span><i style={{ background: '#22c55e' }} /> مؤيّد</span>

                    <button
                        className={showDistricts ? 'is-on' : ''}
                        onClick={() => setShowDistricts(v => !v)}
                    >
                        المناطق
                    </button>
                </div>

                {/* شريط الزمن */}
                {result && (
                    <div className="ms-time">
                        <button
                            className="ms-play"
                            onClick={() => {
                                if (frame >= result.frames.length - 1) setFrame(0);
                                setPlaying(v => !v);
                            }}
                            aria-label={playing ? 'إيقاف' : 'تشغيل'}
                        >
                            {playing ? '❚❚' : '▶'}
                        </button>

                        <input
                            type="range"
                            min="0"
                            max={result.frames.length - 1}
                            value={Math.min(frame, result.frames.length - 1)}
                            onChange={(e) => { setPlaying(false); setFrame(+e.target.value); }}
                        />

                        <b>
                            {current?.round === 0 ? 'قبل الحدث' : `يوم ${current?.round}`}
                        </b>
                    </div>
                )}
            </div>

            {/* ══ ٣) القراءة ══ */}
            {current && (
                <div className="ms-read">
                    {/* الشريط: نسب الرأي الآن */}
                    <div className="ms-split" title="نسب الرأي في هذه اللحظة">
                        <i className="is-against" style={{ width: pct(current.againstShare) }}>
                            {current.againstShare > 0.12 && pct(current.againstShare)}
                        </i>
                        <i className="is-mid" style={{ width: pct(current.neutralShare) }}>
                            {current.neutralShare > 0.12 && pct(current.neutralShare)}
                        </i>
                        <i className="is-for" style={{ width: pct(current.forShare) }}>
                            {current.forShare > 0.12 && pct(current.forShare)}
                        </i>
                    </div>

                    <p className="ms-line">
                        {current.round === 0 ? (
                            <>قبل الحدث: <b>{pct(current.forShare)}</b> مؤيّد
                                و<b>{pct(current.againstShare)}</b> معارض.</>
                        ) : (
                            <>
                                بعد {current.round} يوماً من «{chosen.label}»:
                                {' '}<b>{pct(current.forShare)}</b> مؤيّد
                                و<b>{pct(current.againstShare)}</b> معارض
                                {current.note ? ` — وهذا يوم وقوعه.` : '.'}
                            </>
                        )}
                    </p>

                    {/* الخلاصة بعد انتهاء التشغيل */}
                    {outcome && frame >= result.frames.length - 1 && (
                        <div className="ms-cards">
                            <article>
                                <b>{pct(Math.abs(outcome.shift / 2))}</b>
                                <span>
                                    {outcome.shift < -0.02 ? 'تحوّل نحو المعارضة'
                                        : outcome.shift > 0.02 ? 'تحوّل نحو التأييد'
                                            : 'الرأي العامّ لم يتحوّل'}
                                </span>
                            </article>

                            {bounds && outcome.strongestAgainst && (
                                <article>
                                    <b>{sideName(outcome.strongestAgainst, bounds)}</b>
                                    <span>أكثر منطقة معارضةً — {pct(outcome.strongestAgainst.againstShare)} منها</span>
                                </article>
                            )}

                            {bounds && outcome.strongestFor && (
                                <article>
                                    <b>{sideName(outcome.strongestFor, bounds)}</b>
                                    <span>أكثر منطقة تأييداً — {pct(outcome.strongestFor.forShare)} منها</span>
                                </article>
                            )}

                            {bounds && swung && (
                                <article>
                                    <b>{sideName(swung, bounds)}</b>
                                    <span>
                                        أكثر منطقة تغيّراً — انتقلت
                                        {' '}{swung.was > 0 ? 'من التأييد' : 'من المعارضة'}
                                        {' '}{swung.mean > 0 ? 'إلى التأييد' : 'إلى المعارضة'}
                                    </span>
                                </article>
                            )}

                            <article>
                                <b>{readable(chosen.radius)}</b>
                                <span>نطاق الأثر المباشر — وما بعده يصله الخبر من جيرانه</span>
                            </article>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default MapSimPanel;
