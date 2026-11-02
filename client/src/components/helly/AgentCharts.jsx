import React, { useMemo } from 'react';

/* ============================================================
   رسوم التقرير

   كلّها ‎SVG‎ مكتوب هنا، بلا مكتبة رسم. والسبب أن ما يُرسم بسيط —
   أعمدة وحلقة وشبكة — ومكتبةُ رسوم تعني مئة كيلوبايت تُحمَّل لأجل
   أربعة أشكال، وتعني ألوانها لا ألواننا.

   و‎SVG‎ يتمدّد مع الشاشة بلا إعادة رسم: ‎viewBox‎ واحد ونسبة محفوظة،
   فما يُقرأ على الحاسوب يُقرأ على الهاتف.
   ============================================================ */

/* لوحة التقرير — ألوان بالنوفا لا ألوان مكتبة */
const TONES = ['#fbab15', '#38bdf8', '#4ade80', '#f472b6', '#a78bfa', '#fb923c', '#2dd4bf', '#fb7185'];

const toneAt = (i) => TONES[i % TONES.length];

/* ============================================================
   أعمدة أفقية — للأصناف
   ============================================================ */

/**
 * أعمدة أفقية لا رأسية.
 *
 * الأسماء عربية وطويلة: «مركز طبي» و«محطة وقود». وفي الأعمدة
 * الرأسية تُكتب مائلةً أو تُقصّ، وفي الأفقية تُقرأ كما هي.
 */
export const BarChart = ({ data, max, unit = '', emptyNote = 'لا بيانات' }) => {
    const rows = useMemo(() => {
        const entries = Object.entries(data || {})
            .filter(([, n]) => n > 0)
            .sort((a, b) => b[1] - a[1]);
        return entries.slice(0, 10);
    }, [data]);

    if (!rows.length) return <p className="ag-empty">{emptyNote}</p>;

    const top = max || Math.max(...rows.map(([, n]) => n));

    return (
        <div className="ag-bars">
            {rows.map(([label, value], i) => (
                <div className="ag-bar" key={label}>
                    <span className="ag-bar-label" title={label}>{label}</span>

                    <span className="ag-bar-track">
                        <i
                            style={{
                                width: `${top > 0 ? Math.max(2, (value / top) * 100) : 0}%`,
                                background: toneAt(i)
                            }}
                        />
                    </span>

                    <b className="ag-bar-value">{value}{unit}</b>
                </div>
            ))}
        </div>
    );
};

/* ============================================================
   حلقة — لنسب الأصناف
   ============================================================ */

/**
 * حلقة لا قرص.
 *
 * الفراغ في وسطها يحمل المجموع، فيُقرأ العدد الكلّي والنسب في شكل
 * واحد. والقرص المصمت يُهدر ذلك الموضع.
 */
export const DonutChart = ({ data, total, centreLabel = '' }) => {
    const slices = useMemo(() => {
        const entries = Object.entries(data || {})
            .filter(([, n]) => n > 0)
            .sort((a, b) => b[1] - a[1]);

        const sum = entries.reduce((a, [, n]) => a + n, 0);
        if (!sum) return [];

        /* ما دقّ يُجمع في «أخرى»: ثماني شرائح تُقرأ، وعشرون تصير
           خطوطاً ملوّنة لا معنى لها */
        const head = entries.slice(0, 7);
        const tailSum = entries.slice(7).reduce((a, [, n]) => a + n, 0);
        const shown = tailSum > 0 ? [...head, ['أخرى', tailSum]] : head;

        let at = 0;
        return shown.map(([label, value], i) => {
            const share = value / sum;
            const slice = { label, value, share, from: at, tone: toneAt(i) };
            at += share;
            return slice;
        });
    }, [data]);

    if (!slices.length) return <p className="ag-empty">لا بيانات</p>;

    const R = 54;
    const C = 2 * Math.PI * R;
    const sum = total ?? slices.reduce((a, s) => a + s.value, 0);

    return (
        <div className="ag-donut">
            <svg viewBox="0 0 140 140" role="img" aria-label="توزيع الأصناف">
                {/* نبدأ من أعلى الحلقة لا من يمينها: الدوران ‎−90°‎ */}
                <g transform="translate(70 70) rotate(-90)">
                    <circle r={R} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="18" />

                    {slices.map(s => (
                        <circle
                            key={s.label}
                            r={R}
                            fill="none"
                            stroke={s.tone}
                            strokeWidth="18"
                            strokeDasharray={`${s.share * C} ${C}`}
                            strokeDashoffset={-s.from * C}
                            strokeLinecap="butt"
                        />
                    ))}
                </g>

                <text x="70" y="66" className="ag-donut-num">{sum}</text>
                <text x="70" y="82" className="ag-donut-cap">{centreLabel}</text>
            </svg>

            <ul className="ag-legend">
                {slices.map(s => (
                    <li key={s.label}>
                        <i style={{ background: s.tone }} />
                        <span>{s.label}</span>
                        <b>{Math.round(s.share * 100)}٪</b>
                    </li>
                ))}
            </ul>
        </div>
    );
};

/* ============================================================
   مدرّج المسافات
   ============================================================ */

/**
 * توزيع المسافات على حِزَم.
 *
 * يُجيب «هل المتأثّر ملاصق أم مبثوث على النطاق؟» — وهو سؤال لا
 * يُجيبه متوسّطٌ واحد: متوسّطُ ٥٠ م و٩٥٠ م هو ٥٠٠ م، وهو وصفٌ
 * كاذب لكلتا الحالتين.
 */
export const Histogram = ({ values, bins = 6, max, unit = 'م' }) => {
    const bars = useMemo(() => {
        const live = (values || []).filter(Number.isFinite);
        if (!live.length) return [];

        const top = max || Math.max(...live);
        if (!(top > 0)) return [];

        const width = top / bins;
        const counts = new Array(bins).fill(0);

        for (const v of live) {
            const at = Math.min(bins - 1, Math.floor(v / width));
            counts[at] += 1;
        }

        const peak = Math.max(...counts);
        return counts.map((n, i) => ({
            from: Math.round(i * width),
            to: Math.round((i + 1) * width),
            count: n,
            height: peak > 0 ? n / peak : 0
        }));
    }, [values, bins, max]);

    if (!bars.length) return <p className="ag-empty">لا مسافات لتُرسم</p>;

    return (
        <div className="ag-hist">
            {bars.map((bar, i) => (
                <div className="ag-hist-col" key={i}>
                    <span className="ag-hist-count">{bar.count || ''}</span>

                    <span className="ag-hist-bar">
                        <i style={{
                            height: `${Math.max(bar.count ? 4 : 0, bar.height * 100)}%`,
                            background: toneAt(i)
                        }} />
                    </span>

                    <span className="ag-hist-tick">{bar.to}{unit}</span>
                </div>
            ))}
        </div>
    );
};

/* ============================================================
   مقياس الخطورة
   ============================================================ */

/**
 * قوس من صفر إلى مئة.
 *
 * نصف دائرة لا دائرة كاملة: المقياس له بداية ونهاية، والدائرة
 * الكاملة تُقرأ نسبةً دائرية لا موضعاً على مدى.
 */
export const Gauge = ({ score = 0, band = 'low', label = '' }) => {
    const value = Math.max(0, Math.min(100, score));

    /* قوس نصف دائرة بنصف قطر ‎60‎ — طوله ‎π·r‎ */
    const R = 60;
    const LEN = Math.PI * R;

    const tone = band === 'high' ? '#fb7185' : band === 'medium' ? '#fbbf24' : '#4ade80';

    return (
        <div className={`ag-gauge is-${band}`}>
            <svg viewBox="0 0 150 90" role="img" aria-label={`الخطورة ${value} من 100`}>
                <g transform="translate(75 75)">
                    <path
                        d={`M -${R} 0 A ${R} ${R} 0 0 1 ${R} 0`}
                        fill="none"
                        stroke="rgba(255,255,255,.09)"
                        strokeWidth="13"
                        strokeLinecap="round"
                    />
                    <path
                        d={`M -${R} 0 A ${R} ${R} 0 0 1 ${R} 0`}
                        fill="none"
                        stroke={tone}
                        strokeWidth="13"
                        strokeLinecap="round"
                        strokeDasharray={`${(value / 100) * LEN} ${LEN}`}
                    />
                </g>

                <text x="75" y="64" className="ag-gauge-num" fill={tone}>{value}</text>
            </svg>

            <b className="ag-gauge-label">{label}</b>
        </div>
    );
};

/* ============================================================
   أشرطة الوصول
   ============================================================ */

/**
 * مسافة أقرب خدمة حياتية، مقابل حدٍّ مقبول.
 *
 * الشريط يُقارَن بخطّ الحدّ لا بأطول شريط: المطلوب معرفةُ «أقرب
 * مستشفى على ٨٠٠ م — داخل الحدّ» لا «أطول من شريط الصيدلية».
 */
export const ReachBars = ({ reach, limitM = 1500, readable }) => {
    if (!reach?.length) return <p className="ag-empty">لا بيانات وصول</p>;

    const top = Math.max(limitM, ...reach.map(r => r.distance || 0));

    return (
        <div className="ag-reach">
            {reach.map((row, i) => {
                const missing = row.distance === null;
                const over = !missing && row.distance > limitM;

                return (
                    <div className={`ag-reach-row${missing ? ' is-missing' : over ? ' is-over' : ''}`} key={row.category}>
                        <span className="ag-reach-cat">{row.category}</span>

                        <span className="ag-reach-track">
                            {/* خطّ الحدّ: المرجع الذي يُقاس عليه */}
                            <em style={{ insetInlineStart: `${(limitM / top) * 100}%` }} />

                            {!missing && (
                                <i style={{
                                    width: `${Math.max(2, (row.distance / top) * 100)}%`,
                                    background: over ? '#fb7185' : toneAt(i)
                                }} />
                            )}
                        </span>

                        <b className="ag-reach-val">
                            {missing ? 'غير مسجّل' : readable(row.distance)}
                        </b>
                    </div>
                );
            })}
        </div>
    );
};
