import React, { useState, useEffect, useMemo, useCallback } from 'react';

import { shopService } from '../../services/api';
import {
    analyse, severityOf, readable, compassOf, EVENT_KINDS,
    countBy, hotspots, serviceGaps, LIFELINE
} from './spatialAgent';
import { BarChart, DonutChart, Histogram, Gauge, ReachBars } from './AgentCharts';

/* ============================================================
   الوكيل المكاني — الواجهة

   يقرأ معالم الخريطة الحقيقية، ويأخذ حدثاً وموضعاً ونطاقاً، ثم
   يُخرج تقريراً: درجة خطورة، وما تأثّر مرتّباً بالأثر، وجداول
   وصول، ورسوماً، وقراراً مُسبَّباً.

   ولا مفتاح ولا طلب إلى نموذج لغوي: الحساب كلّه في المتصفّح من
   بيانات الخريطة. فيعمل بلا إنترنت بعد تحميل المعالم، ونتيجته
   واحدة لنفس المُدخل.
   ============================================================ */

/* حدود فلسطين تقريباً — تُستعمل حين لا تكفي المعالم لرسم حدود */
const FALLBACK_BOUNDS = { south: 31.2, north: 32.6, west: 34.2, east: 35.6 };

/* حدّ الوصول المقبول لخدمة حياتية — يُقاس عليه جدول الوصول */
const REACH_LIMIT = 1500;

const RADII = [300, 500, 800, 1200, 2000, 3000];

/** حدود تُحيط بالمعالم مع هامش — أساس الشبكات والفجوات */
const boundsOf = (items) => {
    const live = (items || []).filter(i => Number.isFinite(+i?.latitude) && Number.isFinite(+i?.longitude));
    if (live.length < 2) return FALLBACK_BOUNDS;

    let south = 90;
    let north = -90;
    let west = 180;
    let east = -180;

    for (const i of live) {
        const lat = +i.latitude;
        const lon = +i.longitude;
        if (lat < south) south = lat;
        if (lat > north) north = lat;
        if (lon < west) west = lon;
        if (lon > east) east = lon;
    }

    /* هامش عُشر الامتداد: الفجوات على الحافّة تحتاج خلايا خارجها
       كي تُقاس، وبلا هامش تُقطع عند آخر معلم */
    const padLat = Math.max(0.002, (north - south) * 0.1);
    const padLon = Math.max(0.002, (east - west) * 0.1);

    return {
        south: south - padLat,
        north: north + padLat,
        west: west - padLon,
        east: east + padLon
    };
};

const LEVEL_WORD = { high: 'عالٍ', warn: 'تحذير', info: 'معلومة' };
const BAND_WORD = { high: 'خطورة عالية', medium: 'خطورة متوسّطة', low: 'خطورة منخفضة' };

/* ============================================================ */

const SpatialAgentPanel = () => {
    const [landmarks, setLandmarks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [problem, setProblem] = useState(null);

    const [kind, setKind] = useState('closure');
    const [radius, setRadius] = useState(500);
    const [spot, setSpot] = useState(null);         // { latitude, longitude }
    const [spotText, setSpotText] = useState('');
    const [note, setNote] = useState('');

    const [report, setReport] = useState(null);
    const [thinking, setThinking] = useState(false);
    const [tab, setTab] = useState('decision');


    /* المعالم من نفس المسار الذي تقرؤه الخريطة، فما يُحلَّل هو
       ما يُرى عليها لا مجموعة أخرى */
    useEffect(() => {
        let alive = true;

        shopService.getAllForMap()
            .then(data => { if (alive) setLandmarks(normalise(data)); })
            .catch(err => { if (alive) setProblem(messageOf(err)); })
            .finally(() => { if (alive) setLoading(false); });

        return () => { alive = false; };
    }, []);

    const bounds = useMemo(() => boundsOf(landmarks), [landmarks]);

    /* مركز المعالم — موضع افتراضي للحدث قبل أن يختار المستخدم */
    const defaultSpot = useMemo(() => {
        if (!landmarks.length) return { latitude: 31.9617, longitude: 35.1839 };
        return {
            latitude: (bounds.south + bounds.north) / 2,
            longitude: (bounds.west + bounds.east) / 2
        };
    }, [landmarks, bounds]);

    const where = spot || defaultSpot;

    /** يقرأ موضعاً مكتوباً «31.96, 35.18» */
    const applyText = () => {
        const parts = String(spotText).split(/[,\s]+/).map(Number).filter(Number.isFinite);
        if (parts.length < 2) { setProblem('اكتب الموضع هكذا: 31.9617, 35.1839'); return; }

        const [lat, lon] = parts;
        if (Math.abs(lat) > 90 || Math.abs(lon) > 180) { setProblem('الموضع خارج نطاق الأرض'); return; }

        setProblem(null);
        setSpot({ latitude: lat, longitude: lon });
    };

    const useMyPlace = () => {
        if (!navigator.geolocation) { setProblem('هذا الجهاز لا يُتيح تحديد الموقع'); return; }

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setProblem(null);
                setSpot({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
                setSpotText(`${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`);
            },
            () => setProblem('تعذّر تحديد موقعك — اكتب الموضع يدوياً')
        );
    };

    /*
     * التحليل.
     *
     * محليٌّ كلّه، ومع ذلك يُؤجَّل إطاراً: الحساب على ألف معلم يشغل
     * الخيط عشرات المللي، فبلا تأجيل تجمد الواجهة قبل أن تُرسم
     * «يحلّل». والتأجيل يجعل الانتقال محسوساً كعمل لا كتجمّد.
     */
    const run = useCallback(() => {
        if (!landmarks.length) { setProblem('لا معالم محمّلة بعد'); return; }

        setThinking(true);
        setProblem(null);

        setTimeout(() => {
            try {
                const event = { ...where, kind, radius, note };
                const made = analyse(event, landmarks, bounds);

                setReport({
                    ...made,
                    event,
                    severity: severityOf(made),
                    at: new Date()
                });
                setTab('decision');
            } catch (err) {
                setProblem(err?.message || 'تعذّر التحليل');
            } finally {
                setThinking(false);
            }
        }, 30);
    }, [landmarks, where, kind, radius, note, bounds]);

    /* بؤر الكثافة والفجوات — تُحسب مع التقرير لا في كل رسم */
    const extra = useMemo(() => {
        if (!report || !landmarks.length) return null;

        const lifeline = landmarks.filter(l => LIFELINE.includes(l.category));

        return {
            spots: hotspots(bounds, landmarks, { cellM: 400, radiusM: 500, top: 5 }),
            gaps: serviceGaps(bounds, lifeline, { cellM: 700, thresholdM: REACH_LIMIT })
        };
    }, [report, landmarks, bounds]);

    const distances = useMemo(
        () => (report?.affected || []).map(a => a.distance),
        [report]
    );

    return (
        <div className="ag">
            {/* ══ الترويسة ══ */}
            <header className="ag-head">
                <div className="ag-title">
                    <span className="ag-mark">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                            <circle cx="12" cy="10" r="2.6" />
                            <path d="M12 1v2M23 10h-2M1 10h2" />
                        </svg>
                    </span>

                    <div>
                        <b>الوكيل المكاني</b>
                        <span>
                            {loading ? 'يقرأ معالم الخريطة…' : `${landmarks.length} معلماً على الخريطة · تحليل محليّ بلا مفتاح`}
                        </span>
                    </div>
                </div>
            </header>

            {problem && <div className="ag-bad">{problem}</div>}

            {/* ══ المُدخل ══ */}
            <section className="ag-input">
                <div className="ag-field">
                    <label>نمط الحدث</label>
                    <div className="ag-kinds">
                        {Object.entries(EVENT_KINDS).map(([key, def]) => (
                            <button
                                key={key}
                                className={kind === key ? 'is-on' : ''}
                                onClick={() => { setKind(key); setRadius(def.radius); }}
                            >
                                {def.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="ag-row">
                    <div className="ag-field">
                        <label>الموضع</label>
                        <div className="ag-spot">
                            <input
                                value={spotText}
                                onChange={(e) => setSpotText(e.target.value)}
                                onBlur={applyText}
                                onKeyDown={(e) => e.key === 'Enter' && applyText()}
                                placeholder={`${defaultSpot.latitude.toFixed(5)}, ${defaultSpot.longitude.toFixed(5)}`}
                                inputMode="decimal"
                            />
                            <button onClick={useMyPlace} title="موقعي">موقعي</button>
                        </div>
                        <i className="ag-hint">
                            {spot ? 'موضع محدَّد' : 'بلا تحديد — يُستعمل مركز المعالم'}
                        </i>
                    </div>

                    <div className="ag-field">
                        <label>نطاق الأثر</label>
                        <div className="ag-radii">
                            {RADII.map(r => (
                                <button key={r} className={radius === r ? 'is-on' : ''} onClick={() => setRadius(r)}>
                                    {readable(r)}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="ag-field">
                    <label>وصف الحدث (اختياري — يُدرج في التقرير)</label>
                    <input
                        value={note}
                        onChange={(e) => setNote(e.target.value.slice(0, 240))}
                        placeholder="مثلاً: إغلاق الشارع الرئيسي لأعمال صيانة من الثامنة صباحاً"
                    />
                </div>

                <button className="ag-run" onClick={run} disabled={thinking || loading}>
                    {thinking ? 'يحلّل…' : 'حلّل الحدث'}
                </button>

                <p className="ag-note">
                    كل رقم في التقرير محسوب من معالم الخريطة بإحصاء مكاني — لا نموذج لغويّ ولا
                    مفتاح ولا طلب خارجي. ونتيجته واحدة لنفس المُدخل.
                </p>
            </section>

            {/* ══ التقرير ══ */}
            {report && (
                <section className="ag-report">
                    {/* ── الرأس: الخطورة والأرقام الكبرى ── */}
                    <div className="ag-verdict">
                        <Gauge
                            score={report.severity.score}
                            band={report.severity.band}
                            label={BAND_WORD[report.severity.band]}
                        />

                        <div className="ag-figures">
                            <div><b>{report.totals.affected}</b><span>معلماً متأثّراً</span></div>
                            <div><b>{report.totals.critical}</b><span>منها حرجة</span></div>
                            <div><b>{Math.round(report.totals.perKm2)}</b><span>معلم/كم²</span></div>
                            <div><b>{report.diversity.kinds}</b><span>صنفاً مختلفاً</span></div>
                        </div>

                        <div className="ag-stamp">
                            <b>{report.kind.label}</b>
                            <span>نطاق {readable(report.radius)}</span>
                            <span>{report.event.latitude.toFixed(5)}, {report.event.longitude.toFixed(5)}</span>
                            <time>{report.at.toLocaleString('ar')}</time>
                        </div>
                    </div>

                    {report.event.note && <p className="ag-brief">{report.event.note}</p>}

                    {/* ── التبويبات ── */}
                    <nav className="ag-tabs">
                        {[
                            ['decision', 'القرار'],
                            ['affected', `المتأثّر (${report.totals.affected})`],
                            ['charts', 'الرسوم'],
                            ['reach', 'الوصول'],
                            ['area', 'المنطقة']
                        ].map(([key, label]) => (
                            <button key={key} className={tab === key ? 'is-on' : ''} onClick={() => setTab(key)}>
                                {label}
                            </button>
                        ))}
                    </nav>

                    {/* ── القرار ── */}
                    {tab === 'decision' && (
                        <div className="ag-moves">
                            {report.moves.map((move, i) => (
                                <article className={`ag-move is-${move.level}`} key={i}>
                                    <span className="ag-move-tag">{LEVEL_WORD[move.level]}</span>
                                    <b>{move.title}</b>
                                    <p>{move.why}</p>

                                    {move.data?.length > 0 && (
                                        <ul className="ag-move-list">
                                            {move.data.slice(0, 6).map(item => (
                                                <li key={item.id || item.name}>
                                                    <span>{item.name}</span>
                                                    {Number.isFinite(item.distance) && (
                                                        <i>{readable(item.distance)} {compassOf(item.bearing || 0)}</i>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </article>
                            ))}

                            <p className="ag-asks">
                                <b>يسأل هذا النمط عن:</b> {report.kind.asks.join(' · ')}
                            </p>
                        </div>
                    )}

                    {/* ── المتأثّر ── */}
                    {tab === 'affected' && (
                        report.affected.length ? (
                            <div className="ag-table">
                                <div className="ag-tr is-head">
                                    <span>المعلم</span>
                                    <span>الصنف</span>
                                    <span>المسافة</span>
                                    <span>الأثر</span>
                                </div>

                                {report.affected.map(item => (
                                    <div className="ag-tr" key={item.id || item.name}>
                                        <span className="ag-td-name">{item.name}</span>
                                        <span className="ag-td-cat">{item.category}</span>
                                        <span className="ag-td-num">
                                            {readable(item.distance)}
                                            <i>{compassOf(item.bearing)}</i>
                                        </span>
                                        <span className="ag-td-num">
                                            <b>{item.impact.toFixed(1)}</b>
                                            <i>حرج {item.criticality}</i>
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : <p className="ag-empty">لا معلم داخل النطاق</p>
                    )}

                    {/* ── الرسوم ── */}
                    {tab === 'charts' && (
                        <div className="ag-grid">
                            <div className="ag-card">
                                <h4>أصناف المتأثّر</h4>
                                <DonutChart data={report.counts} centreLabel="معلماً" />
                            </div>

                            <div className="ag-card">
                                <h4>توزيع المسافات عن الموضع</h4>
                                <Histogram values={distances} max={report.radius} bins={6} />
                                <p className="ag-cap">
                                    يُظهر إن كان المتأثّر ملاصقاً أم مبثوثاً على النطاق — وهو ما
                                    لا يقوله متوسّطٌ واحد.
                                </p>
                            </div>

                            <div className="ag-card">
                                <h4>أكثر الأصناف على الخريطة كلّها</h4>
                                <BarChart data={report.allCounts} />
                            </div>

                            <div className="ag-card">
                                <h4>التنوّع الوظيفي داخل النطاق</h4>
                                <div className="ag-stat">
                                    <b>{report.diversity.h.toFixed(2)}</b>
                                    <span>دليل شانون</span>
                                </div>
                                <div className="ag-stat">
                                    <b>{Math.round(report.diversity.evenness * 100)}٪</b>
                                    <span>توازن الأصناف</span>
                                </div>
                                <p className="ag-cap">
                                    صفرٌ يعني صنفاً واحداً، والمئة توازناً تاماً. ونطاقٌ متنوّع
                                    يعني أثراً موزّعاً على وظائف مختلفة لا على وظيفة واحدة.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* ── الوصول ── */}
                    {tab === 'reach' && (
                        <div className="ag-card">
                            <h4>أقرب خدمة حياتية من الموضع</h4>
                            <ReachBars reach={report.reach} limitM={REACH_LIMIT} readable={readable} />
                            <p className="ag-cap">
                                الخطّ الرأسي حدُّ {readable(REACH_LIMIT)}. وما تجاوزه بالأحمر، وما
                                ليس مسجّلاً على الخريطة يُقال «غير مسجّل» لا يُحسب صفراً.
                            </p>
                        </div>
                    )}

                    {/* ── المنطقة ── */}
                    {tab === 'area' && extra && (
                        <div className="ag-grid">
                            <div className="ag-card">
                                <h4>نمط التوزيع داخل النطاق</h4>
                                {report.nni ? (
                                    <>
                                        <div className="ag-stat">
                                            <b>{report.nni.ratio.toFixed(2)}</b>
                                            <span>دليل أقرب جار (R)</span>
                                        </div>
                                        <p className="ag-verdict-word">
                                            {report.nni.verdict === 'clustered' ? 'توزيع متجمّع — سوق أو تجمّع خدمي'
                                                : report.nni.verdict === 'dispersed' ? 'توزيع متباعد منتظم'
                                                    : 'توزيع عشوائي'}
                                        </p>
                                        <p className="ag-cap">
                                            متوسّط أقرب جار {readable(report.nni.observed)} مقابل
                                            {' '}{readable(report.nni.expected)} متوقّعاً لو كان التوزيع عشوائياً.
                                            أقلّ من ٠٫٨ تجمّع، وأكثر من ١٫٢ تباعد.
                                        </p>
                                    </>
                                ) : <p className="ag-empty">يحتاج ثلاثة معالم على الأقلّ داخل النطاق</p>}
                            </div>

                            <div className="ag-card">
                                <h4>تغطية الخدمات الحياتية</h4>
                                <div className="ag-stat">
                                    <b>{Math.round(extra.gaps.coverage * 100)}٪</b>
                                    <span>من المساحة داخل {readable(REACH_LIMIT)} من خدمة</span>
                                </div>
                                {extra.gaps.worst && (
                                    <p className="ag-cap">
                                        أبعد موضع عن أقرب خدمة حياتية: {readable(extra.gaps.worst.distance)}
                                        {' '}عند {extra.gaps.worst.latitude.toFixed(4)}, {extra.gaps.worst.longitude.toFixed(4)}.
                                        <br />
                                        والقياس جغرافيّ لا سكّانيّ: لا نملك بيانات سكّان، فالفجوة
                                        تعني مساحةً بعيدة لا بالضرورة سكّاناً محرومين.
                                    </p>
                                )}
                            </div>

                            <div className="ag-card ag-wide">
                                <h4>بؤر الكثافة على الخريطة</h4>
                                {extra.spots.length ? (
                                    <div className="ag-table">
                                        <div className="ag-tr is-head">
                                            <span>#</span><span>الموضع</span><span>معالم في ٥٠٠ م</span>
                                        </div>
                                        {extra.spots.map((s, i) => (
                                            <div className="ag-tr" key={i}>
                                                <span>{i + 1}</span>
                                                <span className="ag-td-num" style={{ direction: 'ltr' }}>
                                                    {s.latitude.toFixed(4)}, {s.longitude.toFixed(4)}
                                                </span>
                                                <span className="ag-td-num"><b>{s.count}</b></span>
                                            </div>
                                        ))}
                                    </div>
                                ) : <p className="ag-empty">لا بؤر</p>}
                            </div>
                        </div>
                    )}
                </section>
            )}
        </div>
    );
};

/* ============================================================
   قراءة المعالم
   ============================================================ */

const normalise = (data) => {
    const rows = Array.isArray(data) ? data : (data?.shops || data?.items || []);

    return rows
        .filter(r => Number.isFinite(+r?.latitude) && Number.isFinite(+r?.longitude))
        .map(r => ({
            id: r.id,
            name: r.name || 'بلا اسم',
            category: r.category || 'غير مصنّف',
            latitude: +r.latitude,
            longitude: +r.longitude
        }));
};

const messageOf = (err) => err?.response?.data?.error || err?.message || 'تعذّر تحميل المعالم';

export default SpatialAgentPanel;
