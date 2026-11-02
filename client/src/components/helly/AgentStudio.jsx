import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Map, { Source, Layer, Marker } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';

import { shopService } from '../../services/api';
import {
    analyse, severityOf, readable, compassOf, EVENT_KINDS, LIFELINE
} from './spatialAgent';
import { placeCrowd, runOnMap, sideName, circlePolygon } from './spatialSim';
import { seedOf } from './simEngine';
import { Gauge, DonutChart, ReachBars, Histogram } from './AgentCharts';

/* ============================================================
   استوديو الوكيل المكاني

   صفحة واحدة لما كان صفحتين. وكانتا تسألان نفس السؤال الأوّل —
   «أين يقع الحدث؟» — ثم تفترقان، فيضطرّ من يريد الجوابين إلى
   إدخال الموضع مرّتين ومقارنة شاشتين.

   وهما متكاملان لا متشابهان:

     الأثر الآن    ما الموجود حول الموضع، وشدّة الأثر، وأقرب خدمة
     كيف ينتشر     كيف يتحرّك رأي الناس حوله يوماً بعد يوم

   فالأوّل لقطةٌ من الواقع، والثاني ما يترتّب عليه. وضغطةٌ واحدة
   على الخريطة تُنتجهما معاً.

   ولا مفتاح ولا طلب خارجي: الحساب كلّه هنا من معالم الخريطة.
   ============================================================ */

const ROUNDS = 24;
const CROWD = 220;
const REACH_LIMIT = 1500;

const pct = (n) => `${Math.round((n || 0) * 100)}٪`;

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

/* تدرّج الرأي: أحمر ← رمادي ← أخضر، يُقرأ بلا دليل */
const OPINION_RAMP = [
    'interpolate', ['linear'], ['get', 'opinion'],
    -1, '#ef4444', -0.35, '#f97316', 0, '#94a3b8', 0.35, '#84cc16', 1, '#22c55e'
];

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

const LEVEL_WORD = { high: 'عاجل', warn: 'انتبه', info: 'معلومة' };
const BAND_WORD = { high: 'خطورة عالية', medium: 'خطورة متوسّطة', low: 'خطورة منخفضة' };

/* ============================================================ */

const AgentStudio = () => {
    const [landmarks, setLandmarks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [problem, setProblem] = useState(null);

    const [kind, setKind] = useState('closure');
    const [radius, setRadius] = useState(EVENT_KINDS.closure.radius);
    const [spot, setSpot] = useState(null);

    const [report, setReport] = useState(null);
    const [sim, setSim] = useState(null);
    const [busy, setBusy] = useState(false);

    const [tab, setTab] = useState('impact');
    const [frame, setFrame] = useState(0);
    const [playing, setPlaying] = useState(false);
    const [layer, setLayer] = useState('places');   // places | people | districts

    const timer = useRef(null);
    const def = EVENT_KINDS[kind] || EVENT_KINDS.closure;

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
     * ضغطةٌ واحدة تُنتج الجوابين.
     *
     * التحليل فوريّ لأنّه حسابٌ على المعالم وحدها، والمحاكاة تُبنى
     * معه فتكون جاهزة حين يضغط ▶ — فلا انتظار بين السؤال والجواب.
     */
    const place = useCallback((at) => {
        if (!landmarks.length || !bounds) return;

        setBusy(true);
        setSpot(at);
        setPlaying(false);
        setFrame(0);

        setTimeout(() => {
            try {
                const event = { ...at, kind, radius };
                const made = analyse(event, landmarks, bounds);
                setReport({ ...made, event, severity: severityOf(made), at: new Date() });

                const seed = seedOf(`${kind}|${at.latitude.toFixed(4)}|${at.longitude.toFixed(4)}`);
                const crowd = placeCrowd(CROWD, landmarks, { seed });

                setSim(runOnMap({
                    agents: crowd,
                    bounds,
                    rounds: ROUNDS,
                    seed,
                    cells: 6,
                    event: {
                        ...at,
                        radius,
                        toward: def.toward ?? -0.7,
                        force: def.force ?? 0.6,
                        at: 3,
                        label: def.label
                    }
                }));

                setTab('impact');
            } catch (err) {
                setProblem(err?.message || 'تعذّر التحليل');
            } finally {
                setBusy(false);
            }
        }, 20);
    }, [landmarks, bounds, kind, radius, def]);

    /* تغيير النمط أو النطاق يُعيد الحساب على نفس الموضع */
    const changeKind = (key) => {
        setKind(key);
        setRadius(EVENT_KINDS[key].radius);
    };

    useEffect(() => {
        if (spot) place(spot);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [kind, radius]);

    // ── الزمن ──
    useEffect(() => {
        if (!playing || !sim) return undefined;

        timer.current = setInterval(() => {
            setFrame(now => {
                if (now >= sim.frames.length - 1) { setPlaying(false); return now; }
                return now + 1;
            });
        }, 300);

        return () => clearInterval(timer.current);
    }, [playing, sim]);

    const current = sim?.frames[Math.min(frame, sim.frames.length - 1)] || null;

    /* ── طبقات الخريطة ── */
    const affectedGeo = useMemo(() => {
        if (!report) return { type: 'FeatureCollection', features: [] };

        return {
            type: 'FeatureCollection',
            features: report.affected.map(a => ({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [a.longitude, a.latitude] },
                properties: { impact: a.impact, name: a.name, life: LIFELINE.includes(a.category) ? 1 : 0 }
            }))
        };
    }, [report]);

    const peopleGeo = useMemo(() => {
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
        if (!current) return { type: 'FeatureCollection', features: [] };

        return {
            type: 'FeatureCollection',
            features: current.districts.map(d => ({
                type: 'Feature',
                geometry: {
                    type: 'Polygon',
                    coordinates: [[[d.west, d.south], [d.east, d.south],
                                   [d.east, d.north], [d.west, d.north], [d.west, d.south]]]
                },
                properties: { mean: d.mean }
            }))
        };
    }, [current]);

    const ringGeo = useMemo(() => (spot
        ? { type: 'Feature', geometry: circlePolygon(spot, radius, 64), properties: {} }
        : null), [spot, radius]);

    const distances = useMemo(() => (report?.affected || []).map(a => a.distance), [report]);
    const outcome = sim?.outcome;

    return (
        <div className="st">
            {/* ══ الشريط العلوي ══ */}
            <div className="st-bar">
                <div className="st-kinds">
                    {Object.entries(EVENT_KINDS).map(([key, k]) => (
                        <button key={key} className={kind === key ? 'is-on' : ''} onClick={() => changeKind(key)}>
                            {k.label}
                        </button>
                    ))}
                </div>

                <div className="st-radius">
                    <label>نطاق الأثر</label>
                    <input
                        type="range" min="200" max="3000" step="100"
                        value={radius}
                        onChange={(e) => setRadius(+e.target.value)}
                    />
                    <b>{readable(radius)}</b>
                </div>
            </div>

            <p className={`st-say${problem ? ' is-bad' : ''}`}>
                {loading ? 'يقرأ معالم الخريطة…'
                    : problem ? problem
                        : !spot ? `اضغط على الخريطة حيث يقع «${def.label}»`
                            : busy ? 'يحلّل…'
                                : def.say || def.label}
            </p>

            {/* ══ الجسم: خريطة + لوحة ══ */}
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
                        {/* المناطق خلفيةً */}
                        {layer === 'districts' && (
                            <Source id="st-dist" type="geojson" data={districtGeo}>
                                <Layer id="st-dist-fill" type="fill" paint={{
                                    'fill-color': ['interpolate', ['linear'], ['get', 'mean'],
                                        -1, '#ef4444', -0.2, '#f59e0b', 0, '#64748b', 0.2, '#84cc16', 1, '#22c55e'],
                                    'fill-opacity': 0.25
                                }} />
                                <Layer id="st-dist-line" type="line"
                                       paint={{ 'line-color': 'rgba(255,255,255,.16)', 'line-width': 1 }} />
                            </Source>
                        )}

                        {/* دائرة الحدث */}
                        {ringGeo && (
                            <Source id="st-ring" type="geojson" data={ringGeo}>
                                <Layer id="st-ring-fill" type="fill"
                                       paint={{ 'fill-color': '#fbab15', 'fill-opacity': 0.1 }} />
                                <Layer id="st-ring-line" type="line"
                                       paint={{ 'line-color': '#fbab15', 'line-width': 2, 'line-dasharray': [2, 2] }} />
                            </Source>
                        )}

                        {/*
                          * المعالم المتأثّرة: حجمها بأثرها لا بمسافتها.
                          *
                          * فيُرى المستشفى أكبر من المقهى الملاصق — وهو
                          * ترتيب الأولوية نفسه الذي في الجدول، مرسوماً.
                          */}
                        {layer === 'places' && (
                            <Source id="st-hit" type="geojson" data={affectedGeo}>
                                <Layer id="st-hit-dots" type="circle" paint={{
                                    'circle-radius': ['interpolate', ['linear'], ['get', 'impact'], 0, 4, 12, 14],
                                    'circle-color': ['case', ['==', ['get', 'life'], 1], '#fb7185', '#38bdf8'],
                                    'circle-opacity': 0.75,
                                    'circle-stroke-width': 1.2,
                                    'circle-stroke-color': 'rgba(0,0,0,.5)'
                                }} />
                            </Source>
                        )}

                        {/* الناس وآراؤهم */}
                        {layer === 'people' && (
                            <Source id="st-people" type="geojson" data={peopleGeo}>
                                <Layer id="st-people-dots" type="circle" paint={{
                                    'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 3, 15, 6.5],
                                    'circle-color': OPINION_RAMP,
                                    'circle-stroke-width': 0.8,
                                    'circle-stroke-color': 'rgba(0,0,0,.45)',
                                    'circle-opacity': 0.92
                                }} />
                            </Source>
                        )}

                        {spot && (
                            <Marker longitude={spot.longitude} latitude={spot.latitude} anchor="center">
                                <span className="st-pin" />
                            </Marker>
                        )}
                    </Map>

                    {/* مبدّل الطبقة */}
                    <div className="st-layers">
                        {[
                            ['places', 'المعالم المتأثّرة'],
                            ['people', 'آراء الناس'],
                            ['districts', 'المناطق']
                        ].map(([key, label]) => (
                            <button key={key} className={layer === key ? 'is-on' : ''} onClick={() => setLayer(key)}>
                                {label}
                            </button>
                        ))}
                    </div>

                    {/* دليل الألوان — يتبع الطبقة */}
                    <div className="st-key">
                        {layer === 'places' ? (
                            <>
                                <span><i style={{ background: '#fb7185' }} /> خدمة حياتية</span>
                                <span><i style={{ background: '#38bdf8' }} /> معلم آخر</span>
                                <span className="st-key-note">الحجم = شدّة الأثر</span>
                            </>
                        ) : (
                            <>
                                <span><i style={{ background: '#ef4444' }} /> معارض</span>
                                <span><i style={{ background: '#94a3b8' }} /> محايد</span>
                                <span><i style={{ background: '#22c55e' }} /> مؤيّد</span>
                            </>
                        )}
                    </div>

                    {/* شريط الزمن — مع طبقتي الرأي */}
                    {sim && layer !== 'places' && (
                        <div className="st-time">
                            <button
                                className="st-play"
                                onClick={() => {
                                    if (frame >= sim.frames.length - 1) setFrame(0);
                                    setPlaying(v => !v);
                                }}
                                aria-label={playing ? 'إيقاف' : 'تشغيل'}
                            >
                                {playing ? '❚❚' : '▶'}
                            </button>

                            <input
                                type="range" min="0" max={sim.frames.length - 1}
                                value={Math.min(frame, sim.frames.length - 1)}
                                onChange={(e) => { setPlaying(false); setFrame(+e.target.value); }}
                            />

                            <b>{current?.round === 0 ? 'قبل' : `يوم ${current?.round}`}</b>
                        </div>
                    )}
                </div>

                {/* ── اللوحة ── */}
                <aside className="st-side">
                    {!report ? (
                        <div className="st-blank">
                            <b>اضغط على الخريطة</b>
                            <p>
                                فيُحلَّل ما حول الموضع من معالم حقيقية، وتُبنى معه محاكاةٌ
                                لانتشار الرأي — بضغطة واحدة وبلا أي إعداد.
                            </p>
                        </div>
                    ) : (
                        <>
                            <nav className="st-tabs">
                                {[
                                    ['impact', 'الأثر الآن'],
                                    ['spread', 'كيف ينتشر'],
                                    ['detail', 'التفصيل']
                                ].map(([key, label]) => (
                                    <button key={key} className={tab === key ? 'is-on' : ''}
                                            onClick={() => { setTab(key); if (key === 'spread') setLayer('people'); }}>
                                        {label}
                                    </button>
                                ))}
                            </nav>

                            {/* ══ الأثر الآن ══ */}
                            {tab === 'impact' && (
                                <div className="st-pane">
                                    <div className="st-top">
                                        <Gauge score={report.severity.score} band={report.severity.band}
                                               label={BAND_WORD[report.severity.band]} />

                                        <div className="st-nums">
                                            <div><b>{report.totals.affected}</b><span>معلماً متأثّراً</span></div>
                                            <div><b>{report.totals.critical}</b><span>منها حرجة</span></div>
                                        </div>
                                    </div>

                                    {report.moves.map((move, i) => (
                                        <article className={`st-move is-${move.level}`} key={i}>
                                            <span>{LEVEL_WORD[move.level]}</span>
                                            <b>{move.title}</b>
                                            <p>{move.why}</p>
                                        </article>
                                    ))}
                                </div>
                            )}

                            {/* ══ كيف ينتشر ══ */}
                            {tab === 'spread' && current && (
                                <div className="st-pane">
                                    <div className="st-split">
                                        <i className="is-against" style={{ width: pct(current.againstShare) }}>
                                            {current.againstShare > 0.14 && pct(current.againstShare)}
                                        </i>
                                        <i className="is-mid" style={{ width: pct(current.neutralShare) }} />
                                        <i className="is-for" style={{ width: pct(current.forShare) }}>
                                            {current.forShare > 0.14 && pct(current.forShare)}
                                        </i>
                                    </div>

                                    <p className="st-line">
                                        {current.round === 0
                                            ? <>قبل الحدث: <b>{pct(current.forShare)}</b> مؤيّد و<b>{pct(current.againstShare)}</b> معارض.</>
                                            : <>بعد {current.round} يوماً: <b>{pct(current.forShare)}</b> مؤيّد
                                                و<b>{pct(current.againstShare)}</b> معارض.</>}
                                    </p>

                                    <p className="st-hint">
                                        اضغط ▶ على الخريطة لترى الألوان تنتشر. النقاط أشخاص، ولونها رأيهم.
                                    </p>

                                    {outcome && bounds && (
                                        <div className="st-cards">
                                            {outcome.strongestAgainst && (
                                                <article>
                                                    <b>{sideName(outcome.strongestAgainst, bounds)}</b>
                                                    <span>أكثر معارضةً — {pct(outcome.strongestAgainst.againstShare)}</span>
                                                </article>
                                            )}
                                            {outcome.strongestFor && (
                                                <article>
                                                    <b>{sideName(outcome.strongestFor, bounds)}</b>
                                                    <span>أكثر تأييداً — {pct(outcome.strongestFor.forShare)}</span>
                                                </article>
                                            )}
                                            {outcome.swung && (
                                                <article>
                                                    <b>{sideName(outcome.swung, bounds)}</b>
                                                    <span>أكثر تغيّراً في الرأي</span>
                                                </article>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ══ التفصيل ══ */}
                            {tab === 'detail' && (
                                <div className="st-pane">
                                    <section>
                                        <h4>أقرب خدمة حياتية</h4>
                                        <ReachBars reach={report.reach} limitM={REACH_LIMIT} readable={readable} />
                                    </section>

                                    <section>
                                        <h4>أصناف المتأثّر</h4>
                                        <DonutChart data={report.counts} centreLabel="معلماً" />
                                    </section>

                                    <section>
                                        <h4>بُعدها عن الموضع</h4>
                                        <Histogram values={distances} max={radius} bins={5} />
                                    </section>

                                    <section>
                                        <h4>أعلى المعالم أثراً</h4>
                                        <ul className="st-list">
                                            {report.affected.slice(0, 8).map(a => (
                                                <li key={a.id || a.name}>
                                                    <span>{a.name}</span>
                                                    <i>{readable(a.distance)} {compassOf(a.bearing)}</i>
                                                </li>
                                            ))}
                                            {!report.affected.length && <li><span>لا معلم داخل النطاق</span></li>}
                                        </ul>
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
