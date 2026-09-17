import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import Map, { Source, Layer, NavigationControl, Popup } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { hellyService } from '../services/hellyApi';
import { STANCE_TONE, STANCES, toneOf } from './hellyTheme';
import './HellySpatial.css';

/* ============================================================
   الربط المكاني — HellyAgents على الخريطة

   شقّان متتابعان:

   ١) مرسم النطاق (AreaStudio): ترسم مضلّعاً، أو تضرب نطاقاً دائرياً،
      أو تنقر شارعاً فيُلتقط بمحوره وعرضه. ثم نسأل OpenStreetMap عمّا
      يقع داخل ذلك النطاق فعلاً — محال ومدارس ومساجد وشوارع — ونبني
      الوكلاء من تلك البيانات، فيصيرون سكّان المكان لا شخصيات عامّة.

   ٢) لوحة الترجيح (ForecastPanel): تعرض الاحتمالية وكيف حُسبت،
      بنداً بنداً، مع خطّ الرأي عبر الجولات وخريطة حرارة للتأييد.
      الرقم محسوب في الخادم من حالة المحاكاة، لا مُولّد من نموذج
      لغوي — ولذلك يمكن ردّه إلى معادلته أمام المستخدم.

   المخطّطات كلها SVG مكتوب هنا: لا مكتبة رسم في المشروع، والتحكّم
   اليدوي يعطي دقّة أعلى في واجهة عربية تُقرأ من اليمين.
   ============================================================ */

// خريطة داكنة من بيانات OpenStreetMap — بلا مفتاح، وتلائم لغة اللوحة
const DARK_STYLE = {
    version: 8,
    sources: {
        osmdark: {
            type: 'raster',
            tiles: [
                'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
                'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
                'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png'
            ],
            tileSize: 256,
            attribution: '© OpenStreetMap © CARTO'
        }
    },
    layers: [{ id: 'osmdark', type: 'raster', source: 'osmdark' }]
};

const ACCENT = '#22D3EE';
const GOLD = '#FBAB15';

const FALLBACK_CENTER = { longitude: 35.2042, latitude: 31.9038, zoom: 14 };

// ── هندسة ────────────────────────────────────────────────────

/** نفس معادلة الخادم بالضبط، حتى لا تختلف المساحة المعروضة عن المحسوبة */
const polygonAreaKm2 = (ring) => {
    if (!ring || ring.length < 3) return 0;

    const R = 6371;
    const toRad = (d) => (d * Math.PI) / 180;
    let total = 0;

    for (let i = 0; i < ring.length; i++) {
        const [lon1, lat1] = ring[i];
        const [lon2, lat2] = ring[(i + 1) % ring.length];
        total += toRad(lon2 - lon1) * (2 + Math.sin(toRad(lat1)) + Math.sin(toRad(lat2)));
    }
    return Math.abs((total * R * R) / 2);
};

const circleRing = (center, radiusM, steps = 64) => {
    const [lon, lat] = center;
    const dLat = radiusM / 111320;
    const dLon = radiusM / (111320 * Math.cos((lat * Math.PI) / 180) || 1);

    const ring = [];
    for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * Math.PI * 2;
        ring.push([lon + dLon * Math.cos(t), lat + dLat * Math.sin(t)]);
    }
    return ring;
};

const ringBounds = (ring) => {
    const lons = ring.map(p => p[0]);
    const lats = ring.map(p => p[1]);
    return [
        [Math.min(...lons), Math.min(...lats)],
        [Math.max(...lons), Math.max(...lats)]
    ];
};

const fmtArea = (km2) => (km2 >= 1 ? `${km2.toFixed(2)} كم²` : `${Math.round(km2 * 1e6).toLocaleString('ar-EG')} م²`);

const polygonFeature = (ring) => ({
    type: 'FeatureCollection',
    features: ring ? [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] }, properties: {} }] : []
});

const pointFeatures = (items, props = () => ({})) => ({
    type: 'FeatureCollection',
    features: items
        .filter(p => Number.isFinite(p.lon) && Number.isFinite(p.lat))
        .map(p => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
            properties: props(p)
        }))
});

// ── مخطّطات SVG ──────────────────────────────────────────────

const polar = (cx, cy, r, deg) => {
    const rad = (deg * Math.PI) / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
};

const arcPath = (cx, cy, r, from, to) => {
    const [x1, y1] = polar(cx, cy, r, from);
    const [x2, y2] = polar(cx, cy, r, to);
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${Math.abs(to - from) > 180 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
};

/** عدّاد نصف دائري للاحتمالية — الطرف الأيسر معارضة والأيمن تأييد */
const Gauge = ({ value }) => {
    const cx = 132, cy = 126, r = 98;
    const angle = 180 + (value / 100) * 180;
    const [nx, ny] = polar(cx, cy, r - 26, angle);

    return (
        <svg className="hsp-gauge" viewBox="0 0 264 156" role="img" aria-label={`الاحتمالية ${value}%`}>
            <defs>
                <linearGradient id="hsp-gauge-grad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#ef4444" />
                    <stop offset="35%" stopColor="#fb923c" />
                    <stop offset="55%" stopColor="#94a3b8" />
                    <stop offset="78%" stopColor="#4ade80" />
                    <stop offset="100%" stopColor="#22c55e" />
                </linearGradient>
            </defs>

            <path d={arcPath(cx, cy, r, 180, 360)} fill="none" stroke="#16273F" strokeWidth="19" strokeLinecap="round" />
            <path
                d={arcPath(cx, cy, r, 180, Math.max(180.5, angle))}
                fill="none" stroke="url(#hsp-gauge-grad)" strokeWidth="19" strokeLinecap="round"
            />

            {[0, 25, 50, 75, 100].map(t => {
                const a = 180 + (t / 100) * 180;
                const [x1, y1] = polar(cx, cy, r - 13, a);
                const [x2, y2] = polar(cx, cy, r + 13, a);
                return <line key={t} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#0B1526" strokeWidth="2" />;
            })}

            <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={GOLD} strokeWidth="3.4" strokeLinecap="round" />
            <circle cx={cx} cy={cy} r="7" fill={GOLD} />
            <circle cx={cx} cy={cy} r="3" fill="#070C18" />

            <text className="hsp-gauge-num" x={cx} y={cy - 26} textAnchor="middle">{value}</text>
            <text className="hsp-gauge-pct" x={cx} y={cy - 6} textAnchor="middle">احتمالية التأييد ٪</text>

            <text className="hsp-gauge-end" x="18" y="150" textAnchor="start">معارضة</text>
            <text className="hsp-gauge-end" x="246" y="150" textAnchor="end">تأييد</text>
        </svg>
    );
};

/** خطّ الرأي عبر الجولات — الزمن يجري من اليمين إلى اليسار */
const TrendChart = ({ trend }) => {
    const W = 380, H = 200;
    const pad = { t: 18, r: 40, b: 30, l: 40 };
    const n = trend.length;

    const x = (i) => W - pad.r - (i / Math.max(1, n - 1)) * (W - pad.l - pad.r);
    const y = (v) => pad.t + ((100 - v) / 200) * (H - pad.t - pad.b);

    const line = trend.map((t, i) => `${i ? 'L' : 'M'} ${x(i).toFixed(1)} ${y(t.support).toFixed(1)}`).join(' ');
    const area = `${line} L ${x(n - 1).toFixed(1)} ${y(0).toFixed(1)} L ${x(0).toFixed(1)} ${y(0).toFixed(1)} Z`;

    return (
        <svg className="hsp-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="خطّ الرأي عبر الجولات">
            <defs>
                <linearGradient id="hsp-trend-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={ACCENT} stopOpacity="0.30" />
                    <stop offset="100%" stopColor={ACCENT} stopOpacity="0.02" />
                </linearGradient>
            </defs>

            {[100, 50, 0, -50, -100].map(v => (
                <g key={v}>
                    <line
                        x1={pad.l} y1={y(v)} x2={W - pad.r} y2={y(v)}
                        stroke={v === 0 ? '#2B4A70' : '#16273F'}
                        strokeWidth={v === 0 ? 1.4 : 1}
                        strokeDasharray={v === 0 ? '' : '3 5'}
                    />
                    <text className="hsp-chart-tick" x={W - pad.r + 6} y={y(v) + 3.5}>{v > 0 ? `+${v}` : v}</text>
                </g>
            ))}

            <path d={area} fill="url(#hsp-trend-fill)" />
            <path d={line} fill="none" stroke={ACCENT} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />

            {trend.map((t, i) => (
                <g key={t.round}>
                    <circle
                        cx={x(i)} cy={y(t.support)} r={i === n - 1 ? 5.2 : 3.2}
                        fill={i === n - 1 ? GOLD : '#070C18'}
                        stroke={i === n - 1 ? GOLD : ACCENT}
                        strokeWidth="2"
                    />
                    <title>{`الجولة ${t.round} — المؤشّر ${t.support}`}</title>
                    {(i === 0 || i === n - 1 || n <= 8) && (
                        <text className="hsp-chart-tick" x={x(i)} y={H - 10} textAnchor="middle">ج{t.round}</text>
                    )}
                </g>
            ))}
        </svg>
    );
};

/** شريط توزيع المواقف — قبل وبعد */
const SplitBar = ({ counts, total }) => (
    <div className="hsp-split">
        {STANCES.map(s => {
            const count = counts?.[s] || 0;
            if (!count) return null;
            return (
                <span
                    key={s}
                    style={{ width: `${(count / (total || 1)) * 100}%`, background: STANCE_TONE[s] }}
                    title={`${s}: ${count}`}
                >
                    {count / (total || 1) > 0.11 ? count : ''}
                </span>
            );
        })}
    </div>
);

/** شريط متفرّع من المنتصف: يساراً معارضة ويميناً تأييد */
const DivergingBar = ({ value }) => {
    const magnitude = Math.min(50, Math.abs(value) / 2);
    const positive = value >= 0;

    return (
        <div className="hsp-diverge">
            <i className="hsp-diverge-zero" />
            <i
                className="hsp-diverge-fill"
                style={{
                    insetInlineStart: positive ? '50%' : `${50 - magnitude}%`,
                    width: `${magnitude}%`,
                    background: positive ? '#22c55e' : '#ef4444'
                }}
            />
        </div>
    );
};

// ============================================================
//  مرسم النطاق
// ============================================================

const TOOLS = [
    { key: 'polygon', label: 'مضلّع حرّ', hint: 'انقر على الخريطة نقطةً نقطة لرسم حدود المنطقة، ثم أنهِ الرسم.' },
    { key: 'circle', label: 'نطاق دائري', hint: 'انقر لتحديد المركز، واضبط نصف القطر بالمسطرة أدناه.' },
    { key: 'street', label: 'التقاط شارع', hint: 'انقر على شارع فنلتقط محوره من OpenStreetMap ونبني شريطاً حوله.' }
];

export const AreaStudio = ({ onLaunch, onFlash, busy }) => {
    const mapRef = useRef(null);

    const [tool, setTool] = useState('polygon');
    const [draft, setDraft] = useState([]);       // رؤوس قيد الرسم
    const [ring, setRing] = useState(null);       // الحلقة المغلقة النهائية
    const [center, setCenter] = useState(null);   // مركز النطاق الدائري
    const [radius, setRadius] = useState(350);
    const [width, setWidth] = useState(35);
    const [street, setStreet] = useState(null);

    const [probe, setProbe] = useState(null);
    const [working, setWorking] = useState(null);

    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);

    const [form, setForm] = useState({ topic: '', seed: '', agent_count: 14, total_rounds: 6 });

    const [initialView, setInitialView] = useState(FALLBACK_CENTER);
    const [located, setLocated] = useState(false);

    // نبدأ من موقع المستخدم إن سمح، وإلا من مركز افتراضي
    useEffect(() => {
        if (!navigator.geolocation) return setLocated(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setInitialView({ longitude: pos.coords.longitude, latitude: pos.coords.latitude, zoom: 15 });
                setLocated(true);
            },
            () => setLocated(true),
            { timeout: 6000 }
        );
    }, []);

    const area = ring ? polygonAreaKm2(ring) : 0;

    const resetShape = useCallback(() => {
        setDraft([]); setRing(null); setCenter(null); setStreet(null); setProbe(null);
    }, []);

    const switchTool = (key) => { setTool(key); resetShape(); };

    // ── النقر على الخريطة ──
    const onMapClick = async (event) => {
        const { lng, lat } = event.lngLat;

        if (tool === 'polygon') {
            setProbe(null);
            // نقرة بعد إنهاء الرسم تبدأ مضلّعاً جديداً بدل أن تُلحق برأسٍ ضائع
            if (ring) {
                setRing(null);
                setDraft([[lng, lat]]);
                return;
            }
            setDraft(prev => [...prev, [lng, lat]]);
            return;
        }

        if (tool === 'circle') {
            setProbe(null);
            setCenter([lng, lat]);
            setRing(circleRing([lng, lat], radius));
            return;
        }

        // التقاط شارع
        setProbe(null);
        setWorking('يبحث عن أقرب شارع…');
        try {
            const data = await hellyService.captureStreet(lat, lng, width);
            setRing(data.ring);
            setStreet(data.street);
            onFlash?.(`التُقط: ${data.street.name || 'شارع بلا اسم'}`);
        } catch (e) {
            onFlash?.(e?.response?.data?.error || 'تعذّر التقاط الشارع', 'err');
        } finally {
            setWorking(null);
        }
    };

    // تغيير نصف القطر يُعيد بناء الدائرة فوراً
    useEffect(() => {
        if (tool === 'circle' && center) setRing(circleRing(center, radius));
    }, [tool, center, radius]);

    const finishPolygon = () => {
        if (draft.length < 3) return onFlash?.('تحتاج ثلاث نقاط على الأقل', 'err');
        setRing([...draft, draft[0]]);
    };

    const undoVertex = () => {
        setRing(null);
        setDraft(prev => prev.slice(0, -1));
    };

    // ── البحث عن مكان ──
    const runSearch = async () => {
        const q = query.trim();
        if (q.length < 2) return;

        setWorking('يبحث…');
        try {
            const { results: found } = await hellyService.searchPlace(q);
            setResults(found);
            if (!found.length) onFlash?.('لا نتائج لهذا الاسم', 'err');
        } catch {
            onFlash?.('تعذّر البحث', 'err');
        } finally {
            setWorking(null);
        }
    };

    const goTo = (place) => {
        setResults([]);
        setQuery(place.name.split('،')[0]);
        mapRef.current?.flyTo({ center: [place.lon, place.lat], zoom: 16, duration: 1200 });
    };

    // ── فحص المنطقة ──
    const runProbe = async () => {
        if (!ring) return;

        setWorking('يقرأ ما في المنطقة من OpenStreetMap…');
        try {
            const data = await hellyService.probeArea(ring);
            setProbe(data);
            onFlash?.(`قُرئ ${data.context.total_features} عنصراً داخل النطاق`);
        } catch (e) {
            onFlash?.(e?.response?.data?.error || 'تعذّر فحص المنطقة', 'err');
        } finally {
            setWorking(null);
        }
    };

    const launch = () => {
        if (!form.topic.trim()) return onFlash?.('اكتب السيناريو أولاً', 'err');
        onLaunch({
            ...form,
            area: { ring, place_name: probe?.place_name || null, context: probe?.context || null }
        });
    };

    // ── طبقات الخريطة ──
    const shapeData = useMemo(() => polygonFeature(ring), [ring]);
    const draftLine = useMemo(() => ({
        type: 'FeatureCollection',
        features: draft.length >= 2
            ? [{ type: 'Feature', geometry: { type: 'LineString', coordinates: draft }, properties: {} }]
            : []
    }), [draft]);
    const vertexData = useMemo(() => pointFeatures(draft.map(([lon, lat]) => ({ lon, lat }))), [draft]);
    const placeData = useMemo(
        () => pointFeatures(probe?.context?.places || []),
        [probe]
    );

    const counts = probe?.context?.counts || {};
    const labels = probe?.context?.labels || {};
    const sortedCounts = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const maxCount = sortedCounts[0]?.[1] || 1;

    const activeTool = TOOLS.find(t => t.key === tool);

    return (
        <div className="hsp">
            <div className="hsp-mapwrap">
                {located && (
                    <Map
                        ref={mapRef}
                        initialViewState={initialView}
                        mapStyle={DARK_STYLE}
                        onClick={onMapClick}
                        cursor="crosshair"
                        style={{ width: '100%', height: '100%' }}
                        attributionControl={false}
                    >
                        <NavigationControl position="top-left" showCompass={false} />

                        <Source id="hsp-shape" type="geojson" data={shapeData}>
                            <Layer id="hsp-shape-fill" type="fill" paint={{ 'fill-color': ACCENT, 'fill-opacity': 0.14 }} />
                            <Layer id="hsp-shape-line" type="line" paint={{ 'line-color': ACCENT, 'line-width': 2.4 }} />
                        </Source>

                        <Source id="hsp-draft" type="geojson" data={draftLine}>
                            <Layer
                                id="hsp-draft-line" type="line"
                                paint={{ 'line-color': GOLD, 'line-width': 2, 'line-dasharray': [2, 1.6] }}
                            />
                        </Source>

                        <Source id="hsp-places" type="geojson" data={placeData}>
                            <Layer
                                id="hsp-places-dot" type="circle"
                                paint={{
                                    'circle-radius': 3.4,
                                    'circle-color': '#7DD3FC',
                                    'circle-opacity': 0.9,
                                    'circle-stroke-width': 1,
                                    'circle-stroke-color': '#0B1526'
                                }}
                            />
                        </Source>

                        <Source id="hsp-vertices" type="geojson" data={vertexData}>
                            <Layer
                                id="hsp-vertex-dot" type="circle"
                                paint={{
                                    'circle-radius': 5,
                                    'circle-color': GOLD,
                                    'circle-stroke-width': 2,
                                    'circle-stroke-color': '#070C18'
                                }}
                            />
                        </Source>
                    </Map>
                )}

                {working && <div className="hsp-maptoast"><span className="hsp-spin" />{working}</div>}

                {ring && (
                    <div className="hsp-readout">
                        <b>{fmtArea(area)}</b>
                        <span>{street?.name || probe?.place_name || 'نطاق محدّد'}</span>
                    </div>
                )}
            </div>

            <aside className="hsp-panel">
                <div className="hsp-panel-head">
                    <h2>الربط المكاني</h2>
                    <p>حدّد نطاقاً على الأرض، واقرأ ما فيه من OpenStreetMap، ثم أسكنه وكلاءك.</p>
                </div>

                {/* البحث */}
                <div className="hsp-search">
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && runSearch()}
                        placeholder="اذهب إلى مكان: رام الله، شارع ركب…"
                    />
                    <button onClick={runSearch} disabled={Boolean(working)}>بحث</button>

                    {results.length > 0 && (
                        <ul className="hsp-results">
                            {results.map((r, i) => (
                                <li key={i}>
                                    <button onClick={() => goTo(r)}>
                                        <b>{r.name.split('،')[0]}</b>
                                        <span>{r.name.split('،').slice(1, 4).join('،')}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* الأدوات */}
                <div className="hsp-tools">
                    {TOOLS.map(t => (
                        <button
                            key={t.key}
                            className={`hsp-tool${tool === t.key ? ' is-on' : ''}`}
                            onClick={() => switchTool(t.key)}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
                <p className="hsp-hint">{activeTool.hint}</p>

                {tool === 'circle' && (
                    <label className="hsp-slider">
                        <span>نصف القطر <b>{radius} م</b></span>
                        <input
                            type="range" min="50" max="2000" step="25"
                            value={radius} onChange={(e) => setRadius(+e.target.value)}
                        />
                    </label>
                )}

                {tool === 'street' && (
                    <label className="hsp-slider">
                        <span>عرض الشريط حول الشارع <b>{width} م</b></span>
                        <input
                            type="range" min="10" max="120" step="5"
                            value={width} onChange={(e) => setWidth(+e.target.value)}
                        />
                    </label>
                )}

                {tool === 'polygon' && draft.length > 0 && (
                    <div className="hsp-drawbtns">
                        <button className="hsp-btn hsp-btn-primary" onClick={finishPolygon} disabled={draft.length < 3}>
                            أنهِ الرسم ({draft.length} نقاط)
                        </button>
                        <button className="hsp-btn" onClick={undoVertex}>تراجع</button>
                        <button className="hsp-btn" onClick={resetShape}>مسح</button>
                    </div>
                )}

                {ring && tool !== 'polygon' && (
                    <div className="hsp-drawbtns">
                        <button className="hsp-btn" onClick={resetShape}>مسح النطاق</button>
                    </div>
                )}

                {/* الفحص */}
                {ring && !probe && (
                    <button
                        className="hsp-btn hsp-btn-primary hsp-wide"
                        onClick={runProbe}
                        disabled={Boolean(working)}
                    >
                        افحص المنطقة في OpenStreetMap
                    </button>
                )}

                {/* نتيجة الفحص */}
                {probe && (
                    <div className="hsp-card">
                        <div className="hsp-card-head">
                            <b>{probe.place_name || 'نطاق غير مسمّى'}</b>
                            <span>{fmtArea(area)} · {probe.context.total_features} عنصراً</span>
                        </div>

                        {sortedCounts.length > 0 ? (
                            <div className="hsp-counts">
                                {sortedCounts.map(([key, n]) => (
                                    <div className="hsp-count" key={key}>
                                        <span>{labels[key] || key}</span>
                                        <i style={{ width: `${(n / maxCount) * 100}%` }} />
                                        <b>{n}</b>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="hsp-muted">لا معالم مسجّلة داخل هذا النطاق — وسّعه قليلاً.</p>
                        )}

                        {probe.context.streets?.length > 0 && (
                            <>
                                <h4>الشوارع</h4>
                                <div className="hsp-chips">
                                    {probe.context.streets.slice(0, 12).map(s => <span key={s}>{s}</span>)}
                                </div>
                            </>
                        )}

                        {probe.context.places?.length > 0 && (
                            <>
                                <h4>من المعالم</h4>
                                <div className="hsp-chips is-soft">
                                    {probe.context.places.slice(0, 10).map((p, i) => <span key={i}>{p.name}</span>)}
                                </div>
                            </>
                        )}

                        <button className="hsp-btn hsp-relink" onClick={runProbe} disabled={Boolean(working)}>
                            أعد الفحص
                        </button>
                    </div>
                )}

                {/* السيناريو */}
                {probe && (
                    <div className="hsp-card">
                        <h3>السيناريو على هذا المكان</h3>

                        <label className="hsp-field">
                            <span>ماذا يجري هنا؟</span>
                            <textarea
                                rows={3}
                                value={form.topic}
                                onChange={(e) => setForm({ ...form, topic: e.target.value })}
                                placeholder="مثال: تحويل هذا الشارع إلى ممشى للمشاة وإغلاقه أمام السيارات"
                            />
                        </label>

                        <label className="hsp-field">
                            <span>مادة خلفية <em>(اختياري)</em></span>
                            <textarea
                                rows={3}
                                value={form.seed}
                                onChange={(e) => setForm({ ...form, seed: e.target.value })}
                                placeholder="أرقام، قرارات سابقة، مواقف معروفة…"
                            />
                        </label>

                        <div className="hsp-row">
                            <label className="hsp-slider">
                                <span>الوكلاء <b>{form.agent_count}</b></span>
                                <input
                                    type="range" min="3" max="40"
                                    value={form.agent_count}
                                    onChange={(e) => setForm({ ...form, agent_count: +e.target.value })}
                                />
                            </label>
                            <label className="hsp-slider">
                                <span>الجولات <b>{form.total_rounds}</b></span>
                                <input
                                    type="range" min="1" max="40"
                                    value={form.total_rounds}
                                    onChange={(e) => setForm({ ...form, total_rounds: +e.target.value })}
                                />
                            </label>
                        </div>

                        <p className="hsp-note">
                            سيُبنى كل وكيل من معالم هذا النطاق بالاسم، ويُثبَّت في نقطة داخله،
                            فتصير الجولات والنتائج مقروءة على الخريطة لا في قائمة فقط.
                        </p>

                        <button
                            className="hsp-btn hsp-btn-primary hsp-wide"
                            onClick={launch}
                            disabled={Boolean(busy) || Boolean(working)}
                        >
                            ابدأ المحاكاة المكانية
                        </button>
                    </div>
                )}
            </aside>
        </div>
    );
};

// ============================================================
//  لوحة الترجيح
// ============================================================

const DIRECTION = {
    up: { label: 'يميل صعوداً', tone: '#22c55e' },
    flat: { label: 'مستقرّ', tone: '#94a3b8' },
    down: { label: 'يميل هبوطاً', tone: '#ef4444' }
};

export const ForecastPanel = ({ data, onClose }) => {
    const [picked, setPicked] = useState(null);
    const spatial = data.spatial;

    const bounds = useMemo(
        () => (spatial?.ring ? ringBounds(spatial.ring) : null),
        [spatial]
    );

    const agentsData = useMemo(
        () => (spatial ? pointFeatures(spatial.points, p => ({
            id: p.id, name: p.name, stance: p.stance, tone: toneOf(p.stance),
            size: 5 + Math.min(10, p.influence) * 0.55,
            role: p.place_role || '', said: p.last_said || '',
            moved: p.stance !== p.initial_stance ? 1 : 0
        })) : null),
        [spatial]
    );

    const cellsData = useMemo(() => {
        if (!spatial?.cells?.length) return null;
        return {
            type: 'FeatureCollection',
            features: spatial.cells.map(c => ({
                type: 'Feature',
                properties: {
                    // اللون يُحسب هنا لا في تعبير الأسلوب: أوضح وأسهل ضبطاً
                    color: c.support >= 0 ? '#22c55e' : '#ef4444',
                    weight: Math.min(0.42, 0.06 + (Math.abs(c.support) / 100) * 0.36)
                },
                geometry: {
                    type: 'Polygon',
                    coordinates: [[
                        [c.min_lon, c.min_lat], [c.max_lon, c.min_lat],
                        [c.max_lon, c.max_lat], [c.min_lon, c.max_lat], [c.min_lon, c.min_lat]
                    ]]
                }
            }))
        };
    }, [spatial]);

    const ringData = useMemo(() => polygonFeature(spatial?.ring), [spatial]);

    const dir = DIRECTION[data.direction] || DIRECTION.flat;
    const total = Object.values(data.distribution).reduce((a, b) => a + b, 0) || 1;

    const onMapClick = (event) => {
        const feature = event.features?.[0];
        if (!feature) return setPicked(null);
        setPicked({ ...feature.properties, lngLat: event.lngLat });
    };

    return (
        <div className="hsp-overlay" onClick={onClose}>
            <div className="hsp-sheet" onClick={(e) => e.stopPropagation()} dir="rtl">
                <header className="hsp-sheet-head">
                    <div>
                        <h2>الترجيح والتحليل</h2>
                        <p>{data.topic}</p>
                    </div>
                    <button className="hsp-x" onClick={onClose} aria-label="إغلاق">✕</button>
                </header>

                <div className="hsp-sheet-body">
                    {/* الرقم */}
                    <section className="hsp-hero">
                        <Gauge value={data.probability} />

                        <div className="hsp-hero-side">
                            <div className="hsp-verdict" style={{ '--tone': dir.tone }}>
                                <b>{data.label}</b>
                                <span>{dir.label} · {data.rounds_done} من {data.total_rounds} جولة</span>
                            </div>

                            <div className="hsp-conf">
                                <div className="hsp-conf-top">
                                    <span>درجة الثقة في هذا الرقم</span>
                                    <b>{data.confidence}%</b>
                                </div>
                                <div className="hsp-track"><i style={{ width: `${data.confidence}%` }} /></div>
                                <p>
                                    الثقة لا تعني ترجيحاً؛ تعني كم تكفي العيّنة والعمق والاستقرار
                                    لاعتماد النسبة أعلاه.
                                </p>
                            </div>

                            <div className="hsp-formula">
                                <span>الأساس <b>{data.base}</b></span>
                                <em>{data.momentum_adj >= 0 ? '+' : '−'}</em>
                                <span>الزخم <b>{Math.abs(data.momentum_adj)}</b></span>
                                <em>=</em>
                                <span className="is-out">الاحتمالية <b>{data.probability}</b></span>
                            </div>
                        </div>
                    </section>

                    {/* لماذا */}
                    <section className="hsp-sec">
                        <h3>لماذا هذه النسبة بالضبط</h3>
                        <div className="hsp-why">
                            {data.breakdown.map(item => (
                                <article className={`hsp-why-card is-${item.kind}`} key={item.key}>
                                    <header>
                                        <b>{item.title}</b>
                                        <span>{item.value}</span>
                                    </header>
                                    <p>{item.detail}</p>
                                </article>
                            ))}
                        </div>
                        <p className="hsp-muted">
                            الرقم محسوب في الخادم من مواقف الوكلاء ونفوذهم وسجلّ الجولات؛
                            لم يقترح النموذج اللغوي أيّ نسبة منه.
                        </p>
                    </section>

                    {/* مكوّنات الثقة */}
                    <section className="hsp-sec">
                        <h3>مِمَّ تتكوّن الثقة</h3>
                        <div className="hsp-conflist">
                            {data.confidence_breakdown.map(item => (
                                <div className="hsp-confrow" key={item.key}>
                                    <div className="hsp-confrow-top">
                                        <b>{item.title}</b>
                                        <span>{item.value}</span>
                                        <em>وزنه {item.weight}</em>
                                    </div>
                                    <div className="hsp-track is-thin"><i style={{ width: `${item.score}%` }} /></div>
                                    <p>{item.detail}</p>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* الحركة */}
                    <section className="hsp-sec hsp-two">
                        <div>
                            <h3>خطّ الرأي عبر الجولات</h3>
                            <TrendChart trend={data.trend} />
                            <p className="hsp-muted">
                                المؤشّر من ‎-100‎ (معارضة تامّة) إلى ‎+100‎ (تأييد تام)، مرجّحاً بالنفوذ.
                                الزمن يجري من اليمين إلى اليسار.
                            </p>
                        </div>

                        <div>
                            <h3>التوزيع قبل وبعد</h3>
                            <div className="hsp-beforeafter">
                                <label>عند الانطلاق</label>
                                <SplitBar counts={data.initial_distribution} total={total} />
                                <label>الآن</label>
                                <SplitBar counts={data.distribution} total={total} />
                            </div>

                            <div className="hsp-legend">
                                {STANCES.map(s => (
                                    <span key={s}><i style={{ background: STANCE_TONE[s] }} />{s}</span>
                                ))}
                            </div>

                            <div className="hsp-stats">
                                <div><b>{data.index}</b><span>مؤشّر الميل</span></div>
                                <div><b>{data.polarization}%</b><span>الاستقطاب</span></div>
                                <div><b>{data.drivers.movers.length}</b><span>غيّروا موقفهم</span></div>
                            </div>
                        </div>
                    </section>

                    {/* من حرّك الرأي */}
                    <section className="hsp-sec">
                        <h3>من حرّك الرأي</h3>
                        <div className="hsp-drivers">
                            <div>
                                <h4>الأكثر نفوذاً</h4>
                                {data.drivers.influencers.map(a => (
                                    <div className="hsp-driver" key={a.id} style={{ '--tone': toneOf(a.stance) }}>
                                        <i />
                                        <b>{a.name}</b>
                                        <span>{a.place_role || a.stance}</span>
                                        <em>نفوذ {a.influence}</em>
                                    </div>
                                ))}
                            </div>

                            <div>
                                <h4>من تحوّل</h4>
                                {data.drivers.movers.length === 0 ? (
                                    <p className="hsp-muted">لم يتحوّل أحد بعد.</p>
                                ) : data.drivers.movers.map(a => (
                                    <div className="hsp-driver" key={a.id} style={{ '--tone': toneOf(a.to) }}>
                                        <i />
                                        <b>{a.name}</b>
                                        <span>{a.from} ← {a.to}</span>
                                        <em>{a.shifts} تحوّل</em>
                                    </div>
                                ))}
                            </div>

                            <div>
                                <h4>نقاط الانقلاب</h4>
                                {data.drivers.turning_points.length === 0 ? (
                                    <p className="hsp-muted">لا قفزات حادّة — الرأي تحرّك بالتدريج.</p>
                                ) : data.drivers.turning_points.map(t => (
                                    <div className="hsp-turn" key={t.round}>
                                        <b className={t.delta >= 0 ? 'is-up' : 'is-down'}>
                                            {t.delta >= 0 ? '▲' : '▼'} {Math.abs(t.delta)}
                                        </b>
                                        <div>
                                            <span>الجولة {t.round}</span>
                                            {t.trigger && <p>بعد: {t.trigger}</p>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>

                    {/* الطبقة المكانية */}
                    {spatial && (
                        <section className="hsp-sec">
                            <h3>
                                على الأرض
                                {spatial.place_name && <small> — {spatial.place_name}</small>}
                            </h3>

                            <div className="hsp-fmap">
                                <Map
                                    initialViewState={bounds ? { bounds, fitBoundsOptions: { padding: 42 } } : FALLBACK_CENTER}
                                    mapStyle={DARK_STYLE}
                                    style={{ width: '100%', height: '100%' }}
                                    attributionControl={false}
                                    interactiveLayerIds={['hsp-agent-dot']}
                                    onClick={onMapClick}
                                >
                                    <NavigationControl position="top-left" showCompass={false} />

                                    <Source id="hsp-f-ring" type="geojson" data={ringData}>
                                        <Layer id="hsp-f-ring-line" type="line" paint={{ 'line-color': ACCENT, 'line-width': 2, 'line-opacity': 0.75 }} />
                                    </Source>

                                    {cellsData && (
                                        <Source id="hsp-f-cells" type="geojson" data={cellsData}>
                                            <Layer
                                                id="hsp-f-cells-fill" type="fill"
                                                paint={{ 'fill-color': ['get', 'color'], 'fill-opacity': ['get', 'weight'] }}
                                            />
                                        </Source>
                                    )}

                                    {agentsData && (
                                        <Source id="hsp-f-agents" type="geojson" data={agentsData}>
                                            <Layer
                                                id="hsp-agent-dot" type="circle"
                                                paint={{
                                                    'circle-radius': ['get', 'size'],
                                                    'circle-color': ['get', 'tone'],
                                                    'circle-opacity': 0.92,
                                                    'circle-stroke-width': ['case', ['==', ['get', 'moved'], 1], 2.4, 1.2],
                                                    'circle-stroke-color': ['case', ['==', ['get', 'moved'], 1], GOLD, '#070C18']
                                                }}
                                            />
                                        </Source>
                                    )}

                                    {picked && (
                                        <Popup
                                            longitude={picked.lngLat.lng}
                                            latitude={picked.lngLat.lat}
                                            onClose={() => setPicked(null)}
                                            closeButton={false}
                                            maxWidth="260px"
                                        >
                                            <div className="hsp-pop" dir="rtl">
                                                <b>{picked.name}</b>
                                                <span style={{ color: toneOf(picked.stance) }}>{picked.stance}</span>
                                                {picked.role && <em>{picked.role}</em>}
                                                {picked.said && <p>{picked.said}</p>}
                                            </div>
                                        </Popup>
                                    )}
                                </Map>

                                <div className="hsp-fmap-key">
                                    {STANCES.map(s => (
                                        <span key={s}><i style={{ background: STANCE_TONE[s] }} />{s}</span>
                                    ))}
                                    <span className="is-moved"><i />من تحوّل موقفه</span>
                                </div>
                            </div>

                            <div className="hsp-spatialstats">
                                <div><b>{spatial.area_km2} كم²</b><span>مساحة النطاق</span></div>
                                <div><b>{spatial.points.length}</b><span>وكيلاً مثبّتاً</span></div>
                                <div><b>{spatial.anchored}</b><span>مربوطين بمعلم</span></div>
                                <div><b>{spatial.cells.length}</b><span>خليّة رصد</span></div>
                            </div>

                            {spatial.by_kind?.length > 0 && (
                                <>
                                    <h4 className="hsp-subhead">
                                        التأييد بحسب ما يجاور الوكيل
                                        <small>يميناً تأييد · يساراً معارضة</small>
                                    </h4>
                                    <div className="hsp-kinds">
                                        {spatial.by_kind.map(k => (
                                            <div className="hsp-kind" key={k.kind}>
                                                <span className="hsp-kind-name">{k.kind}</span>
                                                <DivergingBar value={k.support} />
                                                <span className="hsp-kind-val">
                                                    {k.support >= 0 ? '+' : ''}{k.support}
                                                    <em>{k.count} وكيلاً</em>
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}

                            {spatial.hotspot && spatial.coldspot && spatial.hotspot !== spatial.coldspot && (
                                <div className="hsp-spots">
                                    <div className="is-hot">
                                        <b>أشدّ بقعة تأييداً</b>
                                        <span>المؤشّر {spatial.hotspot.support} · {spatial.hotspot.count} وكلاء</span>
                                    </div>
                                    <div className="is-cold">
                                        <b>أشدّ بقعة معارضة</b>
                                        <span>المؤشّر {spatial.coldspot.support} · {spatial.coldspot.count} وكلاء</span>
                                    </div>
                                </div>
                            )}
                        </section>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AreaStudio;
