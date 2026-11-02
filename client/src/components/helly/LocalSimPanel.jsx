import React, { useState, useCallback, useMemo } from 'react';

import {
    buildCrowd, runSimulation, influenceRanking, tippingPoint,
    seedOf, ARCHETYPES
} from './simEngine';
import { BarChart, DonutChart, Histogram, TrendChart } from './AgentCharts';

/* ============================================================
   المحاكاة المحليّة

   مجتمعٌ من وكلاء يتحرّك رأيه جولةً جولة، محسوباً بنماذج ديناميكا
   الرأي المنشورة — بلا مفتاح ولا طلب خارجي ولا حصّة تنتهي.

   وما يُقرأ هنا ثلاثة أشياء مختلفة لا تُغني إحداها عن الأخرى:

     التباين     كم تباعدت الآراء
     الاستقطاب   هل صارت كتلتين متكافئتين، أم هي متّصلة مبثوثة
     عدد الكتل   كم رأياً مستقلّاً بقي

   فمجتمعٌ تباينه عالٍ واستقطابه صفر مبثوثٌ لا منشقّ — وهو حال
   مختلف تماماً، ويُعالَج بغير ما يُعالَج به الانشقاق.
   ============================================================ */

const PRESETS = [
    {
        key: 'closure',
        label: 'إغلاق طريق',
        note: 'بلدية تُغلق شارعاً رئيسياً لصيانة أسبوعين',
        events: [{ at: 4, toward: -0.7, force: 0.6, label: 'الإغلاق يبدأ' },
                 { at: 14, toward: 0.5, force: 0.45, label: 'مسار بديل يُفتح' }]
    },
    {
        key: 'project',
        label: 'مشروع جديد',
        note: 'افتتاح مركز تجاري في حيّ سكنيّ',
        events: [{ at: 5, toward: 0.8, force: 0.55, label: 'الإعلان' },
                 { at: 18, toward: -0.4, force: 0.4, label: 'ازدحام وشكاوى' }]
    },
    {
        key: 'price',
        label: 'قرار أسعار',
        note: 'رفع تسعيرة خدمة عامّة',
        events: [{ at: 6, toward: -0.85, force: 0.7, label: 'القرار يُعلَن' }]
    },
    {
        key: 'quiet',
        label: 'بلا حدث',
        note: 'مجتمع يُترك لنفسه — لرؤية ما يفعله بلا تدخّل',
        events: []
    }
];

const KIND_LABELS = Object.fromEntries(
    Object.entries(ARCHETYPES).map(([k, v]) => [k, v.label])
);

const pct = (n) => `${Math.round(n * 100)}٪`;

/* ============================================================ */

const LocalSimPanel = () => {
    const [size, setSize] = useState(120);
    const [rounds, setRounds] = useState(30);
    const [split, setSplit] = useState(0.62);
    const [noise, setNoise] = useState(0);
    const [preset, setPreset] = useState('closure');
    const [topic, setTopic] = useState('');

    const [result, setResult] = useState(null);
    const [busy, setBusy] = useState(false);
    const [tab, setTab] = useState('trend');

    const chosen = PRESETS.find(p => p.key === preset) || PRESETS[0];

    /*
     * التشغيل.
     *
     * البذرة من نصّ الموضوع: فنفس السيناريو يُعطي نفس المجتمع ونفس
     * المسار — وهذا ما يجعل المحاكاة قابلة للمراجعة والمقارنة بدل
     * أن تكون رميةَ حظّ تختلف كل مرّة.
     */
    const run = useCallback(() => {
        setBusy(true);

        setTimeout(() => {
            try {
                const seed = seedOf(`${topic}|${preset}|${size}|${split}`);
                const agents = buildCrowd(size, { seed, split });

                const made = runSimulation({
                    agents,
                    rounds,
                    seed,
                    noise,
                    events: chosen.events
                });

                setResult({
                    ...made,
                    topic: topic.trim() || chosen.note,
                    preset: chosen,
                    seed,
                    at: new Date()
                });
                setTab('trend');
            } finally {
                setBusy(false);
            }
        }, 20);
    }, [topic, preset, size, split, rounds, noise, chosen]);

    // ── ما يُرسم ──
    const series = useMemo(() => {
        if (!result) return [];
        const rs = result.rounds;

        return [
            { label: 'متوسّط الرأي', tone: '#fbab15', values: rs.map(r => r.mean) },
            { label: 'الاستقطاب', tone: '#fb7185', values: rs.map(r => r.polarisation) },
            { label: 'التباين', tone: '#38bdf8', values: rs.map(r => r.variance) }
        ];
    }, [result]);

    const marks = useMemo(
        () => (result?.events || []).map(e => ({ at: e.at, label: e.label })),
        [result]
    );

    const kindCounts = useMemo(() => {
        if (!result) return {};
        const out = {};
        for (const a of result.agents) {
            const label = KIND_LABELS[a.kind] || a.kind;
            out[label] = (out[label] || 0) + 1;
        }
        return out;
    }, [result]);

    const movers = useMemo(() => (result ? influenceRanking(result, 8) : []), [result]);
    const tip = useMemo(() => (result ? tippingPoint(result.rounds) : null), [result]);

    const last = result?.rounds[result.rounds.length - 1];
    const first = result?.rounds[0];

    return (
        <div className="ag">
            <header className="ag-head">
                <div className="ag-title">
                    <span className="ag-mark">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="6" cy="7" r="2.3" />
                            <circle cx="18" cy="7" r="2.3" />
                            <circle cx="12" cy="17.5" r="2.3" />
                            <path d="M8 8.6 10.6 15.6M16 8.6 13.4 15.6M8.3 7h7.4" />
                        </svg>
                    </span>

                    <div>
                        <b>المحاكاة المحليّة</b>
                        <span>ديناميكا رأي محسوبة — بلا مفتاح ولا حصّة</span>
                    </div>
                </div>
            </header>

            {/* ══ المُدخل ══ */}
            <section className="ag-input">
                <div className="ag-field">
                    <label>السيناريو</label>
                    <div className="ag-kinds">
                        {PRESETS.map(p => (
                            <button key={p.key} className={preset === p.key ? 'is-on' : ''} onClick={() => setPreset(p.key)}>
                                {p.label}
                            </button>
                        ))}
                    </div>
                    <i className="ag-hint">{chosen.note}</i>
                </div>

                <div className="ag-field">
                    <label>موضوع المحاكاة (يُشتقّ منه المجتمع — نفس النصّ نفس النتيجة)</label>
                    <input
                        value={topic}
                        onChange={(e) => setTopic(e.target.value.slice(0, 160))}
                        placeholder={chosen.note}
                    />
                </div>

                <div className="ag-row">
                    <div className="ag-field">
                        <label>عدد الوكلاء — {size}</label>
                        <input className="ag-slide" type="range" min="20" max="400" step="10"
                               value={size} onChange={(e) => setSize(+e.target.value)} />
                    </div>

                    <div className="ag-field">
                        <label>عدد الجولات — {rounds}</label>
                        <input className="ag-slide" type="range" min="10" max="80" step="5"
                               value={rounds} onChange={(e) => setRounds(+e.target.value)} />
                    </div>
                </div>

                <div className="ag-row">
                    <div className="ag-field">
                        <label>حدّة الانقسام الابتدائي — {split.toFixed(2)}</label>
                        <input className="ag-slide" type="range" min="0.2" max="0.95" step="0.01"
                               value={split} onChange={(e) => setSplit(+e.target.value)} />
                        <i className="ag-hint">
                            دون ٠٫٥ يبدأ المجتمع متّصلاً بلا كتل، وفوقها بكتلتين واضحتين.
                        </i>
                    </div>

                    <div className="ag-field">
                        <label>تشويش — {noise.toFixed(2)}</label>
                        <input className="ag-slide" type="range" min="0" max="0.3" step="0.01"
                               value={noise} onChange={(e) => setNoise(+e.target.value)} />
                        <i className="ag-hint">تقلّبٌ عشوائي صغير في كل جولة. صفرٌ يعني مساراً نقيّاً.</i>
                    </div>
                </div>

                <button className="ag-run" onClick={run} disabled={busy}>
                    {busy ? 'يُشغّل…' : 'شغّل المحاكاة'}
                </button>

                <p className="ag-note">
                    النماذج المستعملة: <b>Friedkin–Johnsen</b> للعناد الذي يُرجع كل وكيل إلى رأيه
                    الأوّل، و<b>Hegselmann–Krause</b> للثقة المحدودة التي تجعله لا يسمع إلّا من
                    قاربه رأياً، و<b>Watts–Strogatz</b> لشبكة «عالم صغير». وكل جولة محسوبة لا
                    مُولَّدة، فنفس المُدخل يُعطي نفس المسار حرفياً.
                </p>
            </section>

            {/* ══ النتيجة ══ */}
            {result && (
                <section className="ag-report">
                    <div className="ag-verdict">
                        <div className="ag-figures">
                            <div>
                                <b>{last.mean.toFixed(2)}</b>
                                <span>متوسّط الرأي (−١ إلى ١)</span>
                            </div>
                            <div>
                                <b>{pct(last.polarisation)}</b>
                                <span>الاستقطاب</span>
                            </div>
                            <div>
                                <b>{result.outcome.clusters.length}</b>
                                <span>كتلة رأي</span>
                            </div>
                            <div>
                                <b>{result.outcome.shift >= 0 ? '+' : ''}{result.outcome.shift.toFixed(2)}</b>
                                <span>إزاحة عن البداية</span>
                            </div>
                        </div>

                        <div className="ag-stamp">
                            <b>{result.outcome.consensus ? 'انتهى إلى توافق' : `${result.outcome.clusters.length} كتلة رأي`}</b>
                            <span>{result.topic}</span>
                            <span>{result.agents.length} وكيلاً · {result.rounds.length - 1} جولة</span>
                            <span>فجوة القياس {result.gap.toFixed(2)}</span>
                            <time>{result.at.toLocaleString('ar')}</time>
                        </div>
                    </div>

                    <nav className="ag-tabs">
                        {[
                            ['trend', 'المسار'],
                            ['shape', 'شكل الرأي'],
                            ['who', 'من أثّر'],
                            ['read', 'القراءة']
                        ].map(([key, label]) => (
                            <button key={key} className={tab === key ? 'is-on' : ''} onClick={() => setTab(key)}>
                                {label}
                            </button>
                        ))}
                    </nav>

                    {/* ── المسار ── */}
                    {tab === 'trend' && (
                        <div className="ag-card">
                            <h4>مسار الرأي عبر الجولات</h4>
                            <TrendChart series={series} marks={marks} domain={[-1, 1]} />

                            {marks.length > 0 && (
                                <ul className="ag-move-list">
                                    {marks.map((m, i) => (
                                        <li key={i}>
                                            <span>{m.label}</span>
                                            <i>جولة {m.at}</i>
                                        </li>
                                    ))}
                                </ul>
                            )}

                            <p className="ag-cap">
                                الخطوط الذهبية الرأسية هي الحوادث. والخطّ المتقطّع الأفقي هو الصفر —
                                فوقه تأييد وتحته رفض. ويُرسم المسار لا النهاية وحدها: متوسّطٌ انتهى
                                إلى الصفر قد يكون بقي صفراً أو صعد ثمّ هبط، وهما حكايتان مختلفتان.
                            </p>
                        </div>
                    )}

                    {/* ── شكل الرأي ── */}
                    {tab === 'shape' && (
                        <div className="ag-grid">
                            <div className="ag-card">
                                <h4>توزيع الآراء في النهاية</h4>
                                <Histogram
                                    values={last.values.map(v => v + 1)}
                                    max={2}
                                    bins={8}
                                    unit=""
                                />
                                <p className="ag-cap">
                                    المحور من صفر (رفض تامّ) إلى ٢ (تأييد تامّ)، ومنتصفه الحياد.
                                    قمّتان تعنيان انشقاقاً، وقمّةٌ واحدة توافقاً.
                                </p>
                            </div>

                            <div className="ag-card">
                                <h4>كتل الرأي</h4>
                                {result.outcome.clusters.length ? (
                                    <div className="ag-table">
                                        <div className="ag-tr is-head">
                                            <span>#</span><span>مركز الكتلة</span><span>حجمها</span>
                                        </div>
                                        {result.outcome.clusters.map((group, i) => (
                                            <div className="ag-tr" key={i}>
                                                <span>{i + 1}</span>
                                                <span className="ag-td-num">
                                                    <b>{group.centre.toFixed(2)}</b>
                                                    <i>{group.from.toFixed(2)} .. {group.to.toFixed(2)}</i>
                                                </span>
                                                <span className="ag-td-num">
                                                    <b>{group.size}</b><i>{pct(group.share)}</i>
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                ) : <p className="ag-empty">لا كتل</p>}
                            </div>

                            <div className="ag-card">
                                <h4>أنماط الوكلاء</h4>
                                <DonutChart data={kindCounts} centreLabel="وكيلاً" />
                            </div>

                            <div className="ag-card">
                                <h4>من البداية إلى النهاية</h4>
                                <div className="ag-stat">
                                    <b>{first.variance.toFixed(2)} → {last.variance.toFixed(2)}</b>
                                    <span>التباين</span>
                                </div>
                                <div className="ag-stat">
                                    <b>{pct(first.polarisation)} → {pct(last.polarisation)}</b>
                                    <span>الاستقطاب</span>
                                </div>
                                <div className="ag-stat">
                                    <b>{first.clusters} → {last.clusters}</b>
                                    <span>عدد الكتل</span>
                                </div>
                                <p className="ag-cap">
                                    التباين والاستقطاب شيئان مختلفان: مجتمعٌ تباينه عالٍ واستقطابه
                                    صفر مبثوثٌ لا منشقّ.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* ── من أثّر ── */}
                    {tab === 'who' && (
                        <div className="ag-card">
                            <h4>أعلى الوكلاء نفوذاً</h4>

                            <div className="ag-table">
                                <div className="ag-tr is-head">
                                    <span>النمط</span><span>نفوذه</span><span>ثقله</span><span>تحرّك هو</span>
                                </div>

                                {movers.map(m => (
                                    <div className="ag-tr" key={m.id}>
                                        <span className="ag-td-name">{m.label} <i style={{ opacity: .55, fontSize: 10 }}>#{m.id}</i></span>
                                        <span className="ag-td-num">
                                            <b>{m.influence.toFixed(2)}</b>
                                            <i>{m.degree} رابطاً</i>
                                        </span>
                                        <span className="ag-td-num">
                                            <b>{m.reach.toFixed(1)}</b>
                                            <i>عناد {m.stubborn.toFixed(2)}</i>
                                        </span>
                                        <span className="ag-td-num">
                                            <b>{m.moved >= 0 ? '+' : ''}{m.moved.toFixed(2)}</b>
                                            <i>{m.start.toFixed(2)} → {m.opinion.toFixed(2)}</i>
                                        </span>
                                    </div>
                                ))}
                            </div>

                            <p className="ag-cap">
                                النفوذ يُقاس بكم تحرّك جيرانُه <b>نحوه</b> لا بثقله ولا بعدد روابطه.
                                فمؤثّرٌ معزول ثقلُه عالٍ ونفوذه صفر، ومن يتصدّر هنا عادةً من يتحرّك
                                هو قليلاً ويتحرّك غيره إليه — وهذا هو الفرق بين الثقل المُعلَن
                                والنفوذ الواقع.
                            </p>
                        </div>
                    )}

                    {/* ── القراءة ── */}
                    {tab === 'read' && (
                        <div className="ag-moves">
                            <article className={`ag-move is-${result.outcome.consensus ? 'info' : last.polarisation > 0.4 ? 'high' : 'warn'}`}>
                                <span className="ag-move-tag">المحصّلة</span>
                                <b>
                                    {result.outcome.consensus
                                        ? 'المجتمع انتهى إلى رأي واحد'
                                        : last.polarisation > 0.4
                                            ? `انشقاق إلى ${result.outcome.clusters.length} كتلة متكافئة`
                                            : `${result.outcome.clusters.length} كتلة، والرأي مبثوث لا منشقّ`}
                                </b>
                                <p>
                                    المتوسّط انتقل من {first.mean.toFixed(2)} إلى {last.mean.toFixed(2)}،
                                    والتباين من {first.variance.toFixed(2)} إلى {last.variance.toFixed(2)}.
                                    {result.outcome.settled
                                        ? ` واستقرّ المجتمع عند الجولة ${result.outcome.settled}.`
                                        : ' ولم يستقرّ حتى آخر جولة — زد الجولات لترى إلى أين يمضي.'}
                                </p>
                            </article>

                            {tip && (
                                <article className="ag-move is-high">
                                    <span className="ag-move-tag">نقطة الانقلاب</span>
                                    <b>أكبر تغيّر عند الجولة {tip.round}</b>
                                    <p>
                                        تحرّك المتوسّط {tip.jump.toFixed(3)} في جولة واحدة
                                        {tip.note ? ` — وهي جولة «${tip.note}»، فالحدث هو السبب.`
                                            : ' — ولا حدث فيها، فالتغيّر من الديناميكا نفسها لا من تدخّل.'}
                                    </p>
                                </article>
                            )}

                            <article className="ag-move is-info">
                                <span className="ag-move-tag">أثر الحوادث</span>
                                <b>
                                    {marks.length
                                        ? `${marks.length} حدثاً حُقن في المحاكاة`
                                        : 'بلا حوادث — المجتمع تُرك لنفسه'}
                                </b>
                                <p>
                                    {marks.length
                                        ? 'أثر الحدث يخبو ثلاثة أرباعه في كل جولة. فإن عاد المتوسّط إلى ما كان فالعناد أرجعه، وإن بقي حيث دُفع فقد رسخ التغيير — وهذا هو الفرق بين هزّة وتحوّل.'
                                        : 'ومع ذلك يتحرّك الرأي: الثقة المحدودة والعناد وحدهما يُنتجان توافقاً أو تفكّكاً بلا أي تدخّل خارجي.'}
                                </p>
                            </article>

                            <article className="ag-move is-info">
                                <span className="ag-move-tag">إعادة</span>
                                <b>هذه المحاكاة تُعاد حرفياً</b>
                                <p>
                                    بذرتها {result.seed} مشتقّة من نصّ الموضوع والإعدادات. فنفس
                                    المُدخل يُعطي نفس المسار بالضبط — وهو ما يجعل المقارنة بين
                                    سيناريوين ذات معنى.
                                </p>
                            </article>
                        </div>
                    )}
                </section>
            )}
        </div>
    );
};

export default LocalSimPanel;
