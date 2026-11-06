import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Map, { Source, Layer, Marker } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';

import { shopService } from '../../services/api';
import { readSurroundings, geocode, reverseGeocode, inferKind, fetchNews, fetchBrief } from './osmClient';
import { readable, compassOf } from './spatialAgent';
import { FIRE_LOAD, hourLabel } from './hazardScience';
import { HAZARDS, KNOBS, analyseEvent, severityOfEvent } from './consequence';
import { Gauge } from './AgentCharts';

/* ============================================================
   استوديو التحليل المكانيّ الذكيّ — المنطق العلميّ

   سؤال هذه الصفحة واحد: وقع حدثٌ هنا، فماذا يحدث للمحيط؟

   ويُجاب بسلسلةٍ ماديّة لا برأي: سعةُ الطريق ومستوى خدمته، وطولُ
   الطابور، وزمنُ البديل، وزمنُ وصول الإسعاف، ومن يقع في النطاق في
   هذه الساعة، وما الغطاء الأرضيّ حوله — وكل رقمٍ معه معياره
   (HCM · NFPA · SFPE · WHO · ERG).

   والبيانات كلّها مفتوحة المصدر وتُقرأ لحظياً: صورةٌ جوّية من Esri،
   وأسماء المناطق من طبقة المرجع، وشبكةُ الطرق واستعمالاتُ الأرض
   والمعالمُ من OpenStreetMap، والترميزُ الجغرافيّ من Nominatim،
   والأخبارُ اللحظيّة عبر وسيط المنصّة العامّ — بلا مفتاح ولا تسجيل.
   ============================================================ */

/* خريطة أساسٍ متّجهة (vector) من OpenStreetMap عبر OpenFreeMap —
   بلا مفتاح ولا تسجيل، وتعمل لأيّ زائر. والتحليل يُرسم فوقها على
   الشوارع نفسها. */
const BASEMAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

const TONE_WORD = { high: 'عاجل', warn: 'انتبه', info: 'معلومة' };
const BAND_WORD = { high: 'شدّة عالية', medium: 'شدّة متوسّطة', low: 'شدّة محدودة' };

/* ألوان مستوى الخدمة — من الانسياب إلى الانهيار */
const LOS_COLOUR = {
    A: '#22c55e', B: '#84cc16', C: '#eab308',
    D: '#f97316', E: '#ef4444', F: '#b91c1c'
};

/* شدّة أثر الحدث على الشارع حسب قربه — ترسمها الشوارع نفسها */
const SEV = [
    { color: '#38bdf8', say: 'خارج النطاق' },   // 0
    { color: '#facc15', say: 'طرفيّ' },          // 1
    { color: '#f97316', say: 'متوسّط' },         // 2
    { color: '#dc2626', say: 'شديد' }            // 3
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
    return { south, north, west, east };
};

/** يُقسّم أشكال التقرير على طبقات الخريطة */
const pick = (shapes, ...layers) => ({
    type: 'FeatureCollection',
    features: (shapes?.features || []).filter(f => layers.includes(f.properties.layer))
});

const COVER_FILL = { urban: '#64748b', bare: '#b4854a' };

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
    const [spotCity, setSpotCity] = useState(null);

    /* محيط OSM المقروء لحظياً: طرق ومشاة ومعالم ومساحات وغطاء أرضيّ */
    const [osm, setOsm] = useState({ roads: [], walk: [], places: [], greens: [], cover: [], context: null });
    const [reading, setReading] = useState(false);

    /* شريط وصف الحدث ومكانه */
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);

    /* الأخبار اللحظيّة قربَ الموضع */
    const [news, setNews] = useState({ loading: false, items: [], source: null, ok: null });

    /* الموجز الذكيّ (Gemini + بحث حيّ) */
    const [brief, setBrief] = useState({ loading: false, text: null, sources: [], ok: null });

    const [tab, setTab] = useState('result');
    const [shown, setShown] = useState({
        streets: true, roads: true, zones: false, greens: false, cover: false, places: false
    });

    /* مفتاح Gemini — يُحفظ في المتصفّح وحده (لا في الخادم ولا في الحزمة) */
    const [geminiKey, setGeminiKey] = useState(() => {
        try { return localStorage.getItem('foresight_gemini_key') || ''; } catch { return ''; }
    });
    const [keyDraft, setKeyDraft] = useState('');
    const saveKey = () => {
        const k = keyDraft.trim();
        try { if (k) localStorage.setItem('foresight_gemini_key', k); else localStorage.removeItem('foresight_gemini_key'); } catch { /* */ }
        setGeminiKey(k);
        setKeyDraft('');
    };
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
                report: analyseEvent(
                    { ...spot, kind, radius, hour, ...knobs },
                    landmarks, osm.roads, osm.greens,
                    { context: osm.context }
                ),
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
            setOsm({
                roads: data.roads, walk: data.walk, places: data.places,
                greens: data.greens, cover: data.cover, context: data.context
            });
        } catch (err) {
            if (err?.name === 'AbortError') return;
            setProblem('تعذّرت قراءة محيط OpenStreetMap — خوادمه مشغولة، أعد المحاولة بعد لحظات');
            setOsm({ roads: [], walk: [], places: [], greens: [], cover: [], context: null });
        } finally {
            if (!signal?.aborted) setReading(false);
        }
    }, []);

    /* النقر يضع الموضع؛ ثم تُقرأ الشبكة والمحيط تلقائياً، ويُسمّى المكان عكسيّاً */
    const place = (at) => {
        setSpot(at);
        setPicked(null);
        setSpotName(null);
        setSpotCity(null);
        reverseGeocode(at.latitude, at.longitude)
            .then(info => { if (info) { setSpotName(info.name); setSpotCity(info.city); } })
            .catch(() => {});
    };

    /* قراءةٌ تلقائية مُهذَّبة: عند تغيّر الموضع أو النطاق، بعد استقرارٍ قصير */
    useEffect(() => {
        if (!spot) return;
        const ctrl = new AbortController();
        const t = setTimeout(() => readAround(spot, radius, ctrl.signal), 450);
        return () => { clearTimeout(t); ctrl.abort(); };
    }, [spot, radius, readAround]);

    /* ── الأخبار اللحظيّة: تُجلب عند استقرار الموضع/النوع/المدينة ── */
    useEffect(() => {
        if (!spot) { setNews({ loading: false, items: [], source: null, ok: null }); return; }
        const ctrl = new AbortController();
        const q = (query && query.trim()) || spotName || spotCity || '';
        const t = setTimeout(async () => {
            setNews(n => ({ ...n, loading: true }));
            try {
                const res = await fetchNews(q, { kind, city: spotCity, signal: ctrl.signal, limit: 10 });
                setNews({ loading: false, items: res.articles || [], source: res.source, ok: res.ok });
            } catch (e) {
                if (e?.name === 'AbortError') return;
                setNews({ loading: false, items: [], source: null, ok: false });
            }
        }, 700);
        return () => { clearTimeout(t); ctrl.abort(); };
    }, [spot, kind, spotCity, spotName, query]);

    /* ── الموجز الذكيّ: تحليلٌ مسنودٌ بالبحث الحيّ عند استقرار المدخلات ── */
    useEffect(() => {
        if (!spot) { setBrief({ loading: false, text: null, sources: [], ok: null }); return; }
        const ctrl = new AbortController();
        const nearby = (osm.places || []).slice(0, 10).map(p => `${p.name} (${p.category})`);
        const t = setTimeout(async () => {
            setBrief(b => ({ ...b, loading: true }));
            try {
                const res = await fetchBrief({
                    description: (query && query.trim()) || null,
                    place: (query && query.trim()) || spotName || null,
                    city: spotCity || null,
                    kind, hour,
                    lat: spot.latitude, lon: spot.longitude,
                    cover: osm.context?.dominant || null,
                    nearby
                }, { signal: ctrl.signal, geminiKey });
                setBrief({ loading: false, text: res.brief, sources: res.sources || [], ok: res.ok, reason: res.reason, needsKey: res.needsKey });
            } catch (e) {
                if (e?.name === 'AbortError') return;
                setBrief({ loading: false, text: null, sources: [], ok: false });
            }
        }, 900);
        return () => { clearTimeout(t); ctrl.abort(); };
    }, [spot, kind, hour, spotCity, spotName, osm.context, osm.places, geminiKey]);

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
        setSpotCity(res.city || null);
        const at = { latitude: res.latitude, longitude: res.longitude };
        setSpot(at);
        setPicked(null);
        mapRef.current?.flyTo({ center: [res.longitude, res.latitude], zoom: 15, duration: 1200 });
    };

    /* ── طبقات الخريطة ── */
    const zonesGeo = useMemo(() => pick(report?.shapes, 'scope', 'plume', 'isolate', 'heat'), [report]);
    const roadsGeo = useMemo(() => pick(report?.shapes, 'road', 'alternative'), [report]);
    const queueGeo = useMemo(() => pick(report?.shapes, 'queue'), [report]);
    /* شبكة الشوارع من OSM — هي سطح التحليل: كل شارعٍ يُلوَّن بشدّة أثر
       الحدث عليه حسب قربه منه، فيُقرأ الأثر على الشوارع نفسها لا على
       مناطقَ مجرّدة. (core=٣٥٪ من النطاق، mid=٧٠٪) */
    const networkGeo = useMemo(() => {
        const R = Math.max(1, radius);
        const core = R * 0.35, mid = R * 0.7;
        const sevOf = (d) => {
            if (!Number.isFinite(d)) return 0;
            if (d <= core) return 3;
            if (d <= mid) return 2;
            if (d <= R) return 1;
            return 0;
        };
        return {
            type: 'FeatureCollection',
            features: (osm.roads || []).flatMap(r => {
                const sev = spot ? sevOf(r.distance) : 0;
                return (r.lines || []).map(line => ({
                    type: 'Feature',
                    geometry: { type: 'LineString', coordinates: line },
                    properties: { cls: r.highway, name: r.name || '', sev }
                }));
            })
        };
    }, [osm.roads, radius, spot]);

    const greensGeo = useMemo(() => ({
        type: 'FeatureCollection',
        features: (osm.greens || []).map(g => ({
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: [g.ring] },
            properties: { group: g.group, name: g.name || g.say }
        }))
    }), [osm.greens]);

    /* الغطاء الأرضيّ المبنيّ والمكشوف — طبقةٌ مستقلّة عن الخضراء */
    const coverGeo = useMemo(() => ({
        type: 'FeatureCollection',
        features: (osm.cover || [])
            .filter(c => c.group === 'urban' || c.group === 'bare')
            .map(c => ({
                type: 'Feature',
                geometry: { type: 'Polygon', coordinates: [c.ring] },
                properties: { group: c.group, say: c.say }
            }))
    }), [osm.cover]);

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
    const ctx = osm.context;

    /* تصدير التقرير نصّاً — لحفظه أو مشاركته */
    const exportReport = () => {
        if (!report) return;
        const lines = [];
        lines.push('تقرير التحليل المكانيّ الذكيّ — PalNovaa Foresight');
        lines.push(`الموضع: ${spotName || `${spot.latitude.toFixed(5)}, ${spot.longitude.toFixed(5)}`}`);
        lines.push(`الحدث: ${hazard.label} · الساعة ${report.clock.text} · النطاق ${readable(report.radius)}`);
        lines.push(`الشدّة: ${severity.score}/100 (${BAND_WORD[severity.band]})`);
        if (ctx?.dominant) {
            lines.push(`الغطاء الأرضيّ: الغالب ${ctx.dominant} · نسيج مبنيّ ${Math.round((ctx.mix?.urban || 0) * 100)}٪ · نباتيّ ${Math.round((ctx.mix?.veg || 0) * 100)}٪`);
        }
        lines.push(`في النطاق: ${report.totals.heads} شخصاً بالمعالم${report.totals.ambient ? ` · نحو ${report.totals.ambient} محيطاً تقديراً` : ''} · ${report.totals.places} معلماً · ${report.totals.lifeline} خدمة حياتية · ${report.roads.length} طريقاً`);
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
        if (news.items.length) {
            lines.push('');
            lines.push('── أخبارٌ قربَ الموضع (GDELT) ──');
            news.items.slice(0, 6).forEach(a => lines.push(`• ${a.title} — ${a.domain || ''} (${a.url})`));
        }
        lines.push('');
        lines.push('مصادر البيانات: Esri (صور) · OpenStreetMap (طرق واستعمالات أرض ومعالم) · Nominatim (ترميز جغرافي) · GDELT (أخبار)');

        const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `foresight-${Date.now()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    };

    /* بطاقة الموجز الذكيّ — القرار والمصادر، أو إعداد المفتاح إن لزم */
    const renderBrief = () => (
        <>
            {brief.loading && (
                <div className="st-news-busy"><span className="hla-spin" />يحلّل السياق ويبحث في المصادر…</div>
            )}

            {!brief.loading && brief.text && (
                <article className="st-brief">
                    <div className="st-brief-head"><span>✦</span> القرار الذكيّ</div>
                    <div className="st-brief-body">
                        {brief.text.split('\n').filter(Boolean).map((ln, i) => (
                            <p key={i} className={ln.trim().startsWith('•') ? 'is-bullet' : ''}>{ln.replace(/^•\s*/, '')}</p>
                        ))}
                    </div>
                    {brief.sources.length > 0 && (
                        <div className="st-brief-src">
                            <b>المصادر</b>
                            <div>
                                {brief.sources.map((s, i) => (
                                    <a key={i} href={s.uri} target="_blank" rel="noopener noreferrer" title={s.title}>
                                        {i + 1}. {(() => { try { return new URL(s.uri).hostname.replace(/^www\./, ''); } catch { return s.title; } })()}
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}
                </article>
            )}

            {!brief.loading && !brief.text && (
                <div className="st-brief-setup">
                    <p>
                        {brief.needsKey || !geminiKey
                            ? 'التحليل الذكيّ (Gemini + بحث حيّ) يحتاج مفتاحك — يُحفظ في متصفّحك وحده ولا يُرسل لأحد غير Google:'
                            : (brief.reason ? `تعذّر التحليل: ${brief.reason}` : 'حدّد موضعاً ووصفاً ليُبنى القرار الذكيّ.')}
                    </p>
                    <div className="st-keyrow">
                        <input type="password" placeholder="الصق مفتاح Gemini هنا…" value={keyDraft}
                               onChange={(e) => setKeyDraft(e.target.value)}
                               onKeyDown={(e) => e.key === 'Enter' && saveKey()} />
                        <button onClick={saveKey} disabled={!keyDraft.trim()}>حفظ</button>
                    </div>
                    {geminiKey && (
                        <small className="st-key-saved">
                            مفتاحٌ محفوظ ✓
                            <button className="st-link" onClick={() => { setGeminiKey(''); try { localStorage.removeItem('foresight_gemini_key'); } catch { /* */ } }}>إزالة</button>
                        </small>
                    )}
                    <small className="st-key-help">تحصل على المفتاح من Google AI Studio → API keys.</small>
                </div>
            )}
        </>
    );

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

            {/* ══ السيناريو المُستدَلّ من وصف المستخدم ══ */}
            <div className="st-bar">
                <div className="st-scenario">
                    <span className="st-scenario-tag">السيناريو المُستدَلّ من وصفك</span>
                    <b>{hazard.icon} {hazard.label}</b>
                    <select value={kind} onChange={(e) => changeKind(e.target.value)} title="صحّحه إن لزم">
                        {Object.entries(HAZARDS).map(([key, h]) => (
                            <option key={key} value={key}>{h.icon} {h.label}</option>
                        ))}
                    </select>
                    <em>{hazard.physics}</em>
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
                        mapStyle={BASEMAP_STYLE}
                        onClick={(e) => place({ latitude: e.lngLat.lat, longitude: e.lngLat.lng })}
                        attributionControl={false}
                        style={{ width: '100%', height: '100%', cursor: 'crosshair' }}
                    >
                        {/* الغطاء الأرضيّ المبنيّ/المكشوف */}
                        {shown.cover && (
                            <Source id="st-cover" type="geojson" data={coverGeo}>
                                <Layer id="st-cover-fill" type="fill" paint={{
                                    'fill-color': ['match', ['get', 'group'], 'urban', COVER_FILL.urban, 'bare', COVER_FILL.bare, '#64748b'],
                                    'fill-opacity': 0.14
                                }} />
                                <Layer id="st-cover-line" type="line" paint={{
                                    'line-color': ['match', ['get', 'group'], 'urban', 'rgba(100,116,139,.55)', 'bare', 'rgba(180,133,74,.6)', 'rgba(148,163,184,.5)'],
                                    'line-width': 0.8
                                }} />
                            </Source>
                        )}

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

                        {/* شبكة الشوارع من OSM — سطح التحليل: كل شارعٍ مُلوَّنٌ
                            بشدّة أثر الحدث عليه حسب قربه منه */}
                        {shown.streets && (
                            <Source id="st-network" type="geojson" data={networkGeo}>
                                <Layer id="st-network-case" type="line"
                                       layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                                       paint={{
                                           'line-color': 'rgba(2,6,16,.6)',
                                           'line-width': ['+',
                                               ['match', ['get', 'cls'],
                                                   'motorway', 6, 'trunk', 5.5, 'primary', 4.5, 'secondary', 3.6, 'tertiary', 2.8, 2.2],
                                               ['match', ['get', 'sev'], 3, 3, 2, 2, 1, 1, 0]]
                                       }} />
                                <Layer id="st-network-line" type="line"
                                       layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                                       paint={{
                                           'line-color': ['match', ['get', 'sev'],
                                               3, '#dc2626', 2, '#f97316', 1, '#facc15',
                                               ['match', ['get', 'cls'],
                                                   'motorway', '#f59e0b', 'trunk', '#f59e0b', 'primary', '#fbbf24',
                                                   'secondary', '#e5e7eb', 'tertiary', '#e5e7eb', '#cbd5e1']],
                                           'line-width': ['+',
                                               ['match', ['get', 'cls'],
                                                   'motorway', 3.2, 'trunk', 3, 'primary', 2.4, 'secondary', 1.8, 'tertiary', 1.4, 1],
                                               ['match', ['get', 'sev'], 3, 2.2, 2, 1.4, 1, 0.7, 0]],
                                           'line-opacity': ['match', ['get', 'sev'], 0, 0.82, 0.97]
                                       }} />
                            </Source>
                        )}

                        {shown.zones && (
                            <Source id="st-zones" type="geojson" data={zonesGeo}>
                                <Layer id="st-plume-fill" type="fill" filter={['==', ['get', 'layer'], 'plume']}
                                       paint={{ 'fill-color': '#a78bfa', 'fill-opacity': 0.18 }} />
                                <Layer id="st-plume-line" type="line" filter={['==', ['get', 'layer'], 'plume']}
                                       paint={{ 'line-color': 'rgba(167,139,250,.85)', 'line-width': 2 }} />
                                <Layer id="st-isolate-line" type="line" filter={['==', ['get', 'layer'], 'isolate']}
                                       paint={{ 'line-color': 'rgba(249,115,22,.95)', 'line-width': 2.2, 'line-dasharray': [2, 1.2] }} />
                                <Layer id="st-scope-line" type="line" filter={['==', ['get', 'layer'], 'scope']}
                                       paint={{ 'line-color': 'rgba(226,232,240,.7)', 'line-width': 1.4, 'line-dasharray': [3, 2] }} />
                                <Layer id="st-heat-ring" type="line" filter={['==', ['get', 'layer'], 'heat']}
                                       paint={{ 'line-color': 'rgba(239,68,68,.9)', 'line-width': 1.4, 'line-opacity': 0.8 }} />
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
                            ['streets', 'شبكة الشوارع'],
                            ['roads', 'الطرق المتأثّرة'],
                            ['zones', 'نطاقات الحدث'],
                            ['greens', 'المساحات الخضراء'],
                            ['cover', 'استعمال الأرض'],
                            ['places', 'المعالم']
                        ].map(([key, label]) => (
                            <button key={key} className={shown[key] ? 'is-on' : ''}
                                    onClick={() => setShown(prev => ({ ...prev, [key]: !prev[key] }))}>
                                {label}
                            </button>
                        ))}
                    </div>

                    {/* دليل شدّة الأثر على الشوارع */}
                    {spot && shown.streets && (osm.roads?.length > 0) && (
                        <div className="st-heat-legend">
                            <b>شدّة الأثر على الشوارع</b>
                            <div className="st-impact-swatches">
                                {[3, 2, 1].map(s => (
                                    <span key={s}>
                                        <i style={{ background: SEV[s].color }} />{SEV[s].say}
                                    </span>
                                ))}
                            </div>
                            <em>كلّ شارعٍ يُلوَّن بحسب قربه من الحدث — التحليل على الشبكة نفسها</em>
                        </div>
                    )}

                    {/* سياق الغطاء الأرضيّ */}
                    {ctx?.dominant && (
                        <div className="st-cover-chip">
                            <span>الغالب: <b>{ctx.dominant}</b></span>
                            <span>بناء {Math.round((ctx.mix?.urban || 0) * 100)}٪ · نبات {Math.round((ctx.mix?.veg || 0) * 100)}٪</span>
                        </div>
                    )}

                    {/* حالة قراءة OSM */}
                    <div className="st-osm">
                        <button onClick={() => spot && readAround(spot, radius)} disabled={!spot || reading}>
                            {reading ? 'يقرأ المحيط…'
                                : osm.roads.length || osm.greens.length || osm.cover.length
                                    ? `المحيط: ${osm.roads.length} طريق · ${osm.places.length} معلم · ${osm.cover.length} غطاء`
                                    : 'اقرأ المحيط من OSM'}
                        </button>
                        <span>خريطةٌ وبياناتٌ مفتوحة · © OpenStreetMap · OpenFreeMap</span>
                    </div>
                </div>

                {/* ── اللوحة ── */}
                <aside className="st-side">
                    {!report ? (
                        <div className="st-blank">
                            <b>ابدأ التحليل</b>
                            <p>
                                اكتب وصف الحدث ومكانه في الأعلى، أو انقر على خريطة OpenStreetMap
                                المتّجهة. فتُقرأ شبكة الطرق واستعمالات الأرض والمعالم لحظياً، ويُجرى
                                التحليل على الشوارع نفسها: كلُّ شارعٍ يُلوَّن بشدّة الأثر، مع سلسلة
                                الأثر الماديّة — سعة الطريق ومستوى خدمته، والطابور، والبدائل، وزمن
                                وصول الإسعاف، ومن يقع في النطاق هذه الساعة — وقرارٌ ذكيّ مسنودٌ بمصادر.
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
                                    ['news', 'السياق الذكيّ'],
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

                                    {renderBrief()}

                                    <div className="st-top">
                                        <Gauge score={severity.score} band={severity.band}
                                               label={BAND_WORD[severity.band]} />
                                        <div className="st-nums">
                                            <div><b>{report.totals.urgent}</b><span>نتيجة عاجلة</span></div>
                                            <div><b>{report.totals.heads}</b><span>شخصاً بالمعالم</span></div>
                                            <div><b>{report.totals.ambient ? report.totals.ambient.toLocaleString('ar-EG') : '—'}</b><span>محيطاً تقديراً</span></div>
                                            <div><b>{report.totals.lifeline}</b><span>خدمة حياتية</span></div>
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

                            {tab === 'news' && (
                                <div className="st-pane">
                                    <p className="st-hint">
                                        قرارٌ ذكيّ يفهم «{hazard.label}» عند «{spotCity || spotName || 'الموضع'}»،
                                        يجلب ما يتّصل به من مصادرَ حيّة ويربطه بموضع الوقوع والسيناريو
                                        (Gemini + بحث Google) — سياقٌ يُقرأ مع التحليل العلميّ لا جزءٌ من حسابه.
                                    </p>

                                    {renderBrief()}

                                    {/* عناوين إخبارية حيّة (GDELT) */}
                                    {(news.loading || news.items.length > 0) && (
                                        <section className="st-news-sec">
                                            <h4>عناوين إخبارية قربَ الموضع</h4>
                                            {news.loading && <div className="st-news-busy"><span className="hla-spin" />يجلب العناوين…</div>}
                                            <ul className="st-news">
                                                {news.items.map((a, i) => (
                                                    <li key={i}>
                                                        <a href={a.url} target="_blank" rel="noopener noreferrer">
                                                            {a.image && <img src={a.image} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
                                                            <div>
                                                                <b>{a.title}</b>
                                                                <em>{a.domain || ''}{a.date ? ` · ${new Date(a.date).toLocaleDateString('ar-EG')}` : ''}</em>
                                                            </div>
                                                        </a>
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
