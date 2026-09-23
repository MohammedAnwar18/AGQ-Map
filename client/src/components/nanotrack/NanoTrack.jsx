import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';

import ARStage from '../ar/ARStage';
import {
    drawRoute, drawChevrons, drawMarker, drawPacer, drawOffscreenArrow,
    drawReticle, drawFloorGrid, drawPill, guidanceState, pointAt, PALETTE
} from '../ar/arPainter';
import { distance2D, polylineLength, readableDistance, simplifyPath } from '../ar/indoorGeo';
import {
    makeFrame, toVenue, pathFromVenue, gradeBase, errorAt, BASE_NOTE, MIN_BASE
} from './nanoFrame';
import { listTracks, saveTrack, deleteTrack, exportTrack } from './nanoStore';
import '../ar/IndoorAR.css';
import './NanoTrack.css';

/* ============================================================
   نانوتراك

   مسار يُرسم مرّة على أرض مكانٍ ما، ويبقى هناك.

   الحيلة كلّها في ‎nanoFrame‎: شريطان لاصقان على الأرض يصيران محور
   إحداثيات يخصّ هذا المكان. كل نقطة تُحفظ مسافةً منهما لا من
   الهاتف، فتعود غداً حيث تركتَها مهما اختلف موضع بدء الكاميرا أو
   انحراف البوصلة.

   وهذا الملفّ هو الواجهة فقط: يُعاير، ويجمع النقاط، ويرسم. أمّا
   الرياضيات فمُختبَرة وحدها، والرسم مُستعار من رسّام الواقع
   المعزّز الداخلي — نفس السهام التي تمشي على البلاط هناك.
   ============================================================ */

/* المسافة بين نقطتين في التسجيل التلقائي — سبعون سنتيمتراً تقريباً
   خطوة واحدة، فيتبع المسارُ الممرَّ بلا أن يمتلئ بنقاط متلاصقة */
const AUTO_STEP = 0.7;

/**
 * يقلّل نقاط المسار بلا أن يبتلع اسماً.
 *
 * التسجيل بالمشي يترك مئة نقطة في ممرّ مستقيم، وعشرٌ منها
 * تصف نفس الشكل. لكنّ ‎RDP‎ لا يعرف الأسماء فيحذف نقطة سمّيتَها
 * لأنّها واقعة على استقامة — وهي أكثر ما يهمّ صاحبها. فنقطّع
 * المسار عند المسمّى ونُبسّط ما بينها.
 */
const thin = (points, tolerance = 0.2) => {
    if (points.length < 3) return points.slice();

    const out = [];
    let run = [points[0]];

    const flush = (end) => {
        run.push(end);
        const kept = simplifyPath(run, tolerance);
        out.push(...(out.length ? kept.slice(1) : kept));
        run = [end];
    };

    for (let i = 1; i < points.length; i++) {
        if (points[i].label || i === points.length - 1) flush(points[i]);
        else run.push(points[i]);
    }

    return out;
};

const PHASES = {
    zero: {
        title: 'قف على الشريط الأوّل',
        note: 'هذا هو صفر المكان. ضع طرف قدمك عليه بالضبط — كل شيء بعده يُقاس منه.',
        action: 'ثبّت نقطة الصفر'
    },
    aim: {
        title: 'امشِ إلى الشريط الثاني',
        note: 'ابتعد متراً على الأقلّ، وكلّما أبعدتَ صارت الدقّة أعلى. هذا الخطّ يقول أين «قُدّام».',
        action: 'ثبّت الاتّجاه'
    }
};

const fmtDate = (ms) => {
    try {
        return new Intl.DateTimeFormat('ar', { day: 'numeric', month: 'short' }).format(new Date(ms));
    } catch {
        return '';
    }
};

/* ============================================================
   القائمة — ما حُفظ من قبل
   ============================================================ */

const TrackList = ({ tracks, onOpen, onNew, onRemove, onClose, notice }) => (
    <div className="nt-list">
        <header className="nt-head">
            <button className="nt-x" onClick={onClose} aria-label="إغلاق">✕</button>
            <div>
                <b>نانوتراك</b>
                <span>مسار يُرسم مرّة ويبقى في مكانه</span>
            </div>
        </header>

        <div className="nt-scroll">
            {/*
              * الشرح أوّل ما يُرى، ومرّة واحدة.
              *
              * الشريطان هما الفكرة كلّها، ومن لا يفهمهما سيضعهما في
              * مكان مختلف كل مرّة ثم يظنّ الميزة معطّلة.
              */}
            <section className="nt-explain">
                <b>الشريطان</b>
                <p>
                    الهاتف لا يعرف أين هو: كل مرّة تفتح الكاميرا يعتبر موضعه هو الصفر.
                    فنُعطيه علامتين ثابتتين على الأرض — لاصق، أو حتّى زاوية بلاطة تعرفها:
                </p>
                <ol>
                    <li><b>الأوّل</b> نقطة الصفر، عند الباب مثلاً.</li>
                    <li><b>الثاني</b> على بُعد متر أو أكثر، ويحدّد «قُدّام».</li>
                </ol>
                <p className="nt-dim">
                    كل نقطة تحفظها تُخزَّن مسافةً منهما. ثبّتهما في نفس المكان في المرّة
                    القادمة فيعود المسار كما رسمتَه.
                </p>
            </section>

            {notice && <div className={`nt-flash is-${notice.kind}`}>{notice.message}</div>}

            <button className="nt-new" onClick={onNew}>
                <span>+</span> مسار جديد
            </button>

            {tracks.length === 0 ? (
                <p className="nt-empty">لا مسارات بعد.</p>
            ) : tracks.map(track => {
                const length = polylineLength(track.points);
                const grade = gradeBase(track.base);

                return (
                    <article key={track.id} className="nt-card">
                        <div className="nt-card-top">
                            <b>{track.name}</b>
                            <time>{fmtDate(track.updatedAt)}</time>
                        </div>

                        <span className="nt-meta">
                            {track.points.length} نقطة · {readableDistance(length)} ·
                            {' '}قاعدة {track.base.toFixed(1)} م
                            <i className={`nt-grade is-${grade}`} />
                        </span>

                        <div className="nt-card-act">
                            <button className="nt-go" onClick={() => onOpen(track, 'guide')}>أرشدني</button>
                            <button onClick={() => onOpen(track, 'record')}>أكمل الرسم</button>
                            <button onClick={() => onRemove(track)} className="nt-del">حذف</button>
                        </div>

                        {/* ما المحفوظ فعلاً — حتّى يفهم المستخدم ما يُخزَّن عنه */}
                        <details className="nt-raw">
                            <summary>الإحداثيات المحفوظة</summary>
                            <pre>{exportTrack(track)}</pre>
                        </details>
                    </article>
                );
            })}
        </div>
    </div>
);

/* ============================================================
   المسرح — المعايرة والرسم والإرشاد
   ============================================================ */

const NanoStage = ({ track, mode, onDone, onSaved }) => {
    const stage = useRef(null);

    // 'zero' → 'aim' → 'work'
    const [phase, setPhase] = useState('zero');
    const [span, setSpan] = useState(0);

    // مسار موجود يُفتح بنقاطه: «أكمل الرسم» يُضيف إليها
    // ولا يمحوها — والحفظ يستبدل المسار كلّه بما على الشاشة
    const [points, setPoints] = useState(track?.points || []);
    const [auto, setAuto] = useState(false);
    const [naming, setNaming] = useState(null);
    const [name, setName] = useState(track?.name || '');
    const [notice, setNotice] = useState(null);
    const [guide, setGuide] = useState(null);

    const frame = useRef(null);
    const tapeA = useRef(null);
    const lastAuto = useRef(null);

    /*
     * ما يقرؤه الرسّام في كل إطار.
     *
     * الرسم يعمل ستّين مرّة في الثانية، وقراءة الحالة منه مباشرةً
     * تعني أن كل نقطة جديدة تُعيد بناء دالّة الرسم. فالمرجع يحمل
     * آخر حالة، والرسّام يُبنى مرّة واحدة.
     */
    const live = useRef({ points: [], phase: 'zero', mode });
    live.current = { points, phase, mode };

    const flash = useCallback((message, kind = 'ok') => {
        setNotice({ message, kind });
        setTimeout(() => setNotice(n => (n?.message === message ? null : n)), 2600);
    }, []);

    // ── المعايرة ──

    /**
     * الشريط الأوّل: نُجبر إحداثيات الجلسة على أن تبدأ منه.
     *
     * ‎anchor‎ تكتب موضع الماشي، فيصير الصفر هو الشريط حرفياً. وبهذا
     * لا نحمل إزاحةً في كل حساب لاحق.
     */
    const markZero = useCallback(() => {
        const api = stage.current;
        if (!api?.ready) { flash('انتظر حتى تجهز الكاميرا', 'err'); return; }

        api.anchor({ x: 0, z: 0 });
        tapeA.current = { x: 0, z: 0 };
        lastAuto.current = null;

        setPhase('aim');
        flash('الصفر مثبَّت — امشِ الآن إلى الشريط الثاني');
    }, [flash]);

    /** الشريط الثاني: منه يُبنى الإطار، وبه تُقاس القاعدة */
    const markAim = useCallback(() => {
        const api = stage.current;
        const at = api?.positionRef?.current;
        if (!at) return;

        const built = makeFrame(tapeA.current, at, { base: track?.base });
        if (!built) {
            flash(`ابتعد أكثر — القاعدة الآن ${distance2D(tapeA.current, at).toFixed(2)} م والحدّ ${MIN_BASE} م`, 'err');
            return;
        }

        frame.current = built;
        lastAuto.current = { ...at };

        setPhase('work');
        setSpan(built.span);

        if (mode === 'guide') {
            flash('المسار عاد إلى مكانه — اتبع السهام');
        } else {
            flash(track ? 'الإطار جاهز — أكمل رسم المسار' : 'الإطار جاهز — وجّه الكاميرا واحفظ نقطة');
        }
    }, [flash, mode, track]);

    /*
     * القاعدة وهي تطول تحت قدميك.
     *
     * الرقم يتحرّك بينما تمشي، فيقرّر المستخدم متى يقف بدل أن يخمّن.
     * وهو الفرق بين قاعدة متر تُفسد كل شيء وقاعدة أربعة أمتار تُثبّته.
     */
    useEffect(() => {
        if (phase !== 'aim') return undefined;

        const tick = setInterval(() => {
            const at = stage.current?.positionRef?.current;
            if (at && tapeA.current) setSpan(distance2D(tapeA.current, at));
        }, 180);

        return () => clearInterval(tick);
    }, [phase]);

    // ── الرسم ──

    /** نقطة حيث تنظر — تُحفظ بإحداثيات المكان لا بإحداثيات الهاتف */
    const addHere = useCallback((label = null) => {
        const api = stage.current;
        const at = api?.aimRef?.current;
        if (!frame.current || !at || !Number.isFinite(at.x)) return;

        const venue = toVenue(at, frame.current);
        setPoints(prev => [...prev, label ? { ...venue, label } : venue]);
        lastAuto.current = { x: at.x, z: at.z };
    }, []);

    /*
     * التسجيل التلقائي بالمشي.
     *
     * نقطة كل سبعين سنتيمتراً من موضعك أنت لا من تصويبك: المسار هنا
     * هو الممرّ الذي تمشي فيه، وموضع قدميك هو وصفه الصحيح.
     */
    useEffect(() => {
        if (!auto || phase !== 'work') return undefined;

        const tick = setInterval(() => {
            const at = stage.current?.positionRef?.current;
            if (!at || !frame.current) return;
            if (lastAuto.current && distance2D(lastAuto.current, at) < AUTO_STEP) return;

            lastAuto.current = { ...at };
            setPoints(prev => [...prev, toVenue(at, frame.current)]);
        }, 240);

        return () => clearInterval(tick);
    }, [auto, phase]);

    const undo = useCallback(() => setPoints(prev => prev.slice(0, -1)), []);

    const commit = useCallback(() => {
        if (!frame.current) return;

        const clean = thin(points, 0.2);
        const result = saveTrack({
            id: track?.id,
            name: name.trim() || 'مسار',
            points: clean,
            base: frame.current.base,
            height: track?.height
        });

        if (!result.ok) { flash(result.why, 'err'); return; }

        setNaming(false);
        onSaved(result.track);
    }, [points, name, track, flash, onSaved]);

    // ── الإرشاد ──

    useEffect(() => {
        if (mode !== 'guide' || phase !== 'work') return undefined;

        const tick = setInterval(() => {
            const api = stage.current;
            if (!api || !frame.current || points.length < 2) return;

            const line = pathFromVenue(points, frame.current);
            setGuide(guidanceState(line, api.positionRef.current, api.poseRef.current));
        }, 220);

        return () => clearInterval(tick);
    }, [mode, phase, points]);

    // ── ما يُرسم فوق الصورة ──

    const paint = useCallback((ctx, view, aiming) => {
        const state = live.current;

        // قبل المعايرة: شبكة على الأرض تقول إن الأرض مقروءة، وشاخص
        // يقول أين يقع ما تنظر إليه. بلا هذا يبدو الإعداد معطّلاً.
        if (state.phase !== 'work') {
            drawFloorGrid(ctx, view, { extent: 5, step: 1 });

            if (state.phase === 'aim') {
                drawRoute(ctx, [{ x: 0, z: 0 }, view.origin], view, {
                    tone: 'rgba(251, 171, 21, .85)',
                    glow: 'rgba(251, 171, 21, .18)'
                });
                drawMarker(ctx, { x: 0, z: 0, name: 'الصفر' }, view, { tone: PALETTE.target });
            }

            if (aiming) drawReticle(ctx, aiming, view, { label: false });
            return;
        }

        if (!frame.current) return;

        const line = pathFromVenue(state.points, frame.current);

        if (line.length > 1) {
            drawRoute(ctx, line, view);
            drawChevrons(ctx, line, view, { spacing: 1.5, phase: performance.now() / 1400 });
        }

        // البداية والنهاية: النهاية دبّوس أحمر لأنها الوجهة
        if (line.length) {
            drawMarker(ctx, { ...line[0], name: 'البداية' }, view, { tone: PALETTE.junction });

            if (line.length > 1) {
                const last = line[line.length - 1];
                drawMarker(ctx, { ...last, name: last.label || 'الوجهة' }, view,
                    { tone: '#FB7185', highlight: true });
                drawOffscreenArrow(ctx, last, view, '#FB7185');
            }
        }

        // نقاط وسطى مسمّاة
        for (const at of line) if (at.label) drawMarker(ctx, { ...at, name: at.label }, view, { tone: PALETTE.node });

        // الكرة التي تسبقك بمترين على الخطّ
        if (state.mode === 'guide' && line.length > 1) {
            const on = guidanceState(line, view.origin, view.pose);
            if (on && !on.arrived) {
                const ahead = pointAt(line, Math.min(on.total, on.along + 2));
                if (ahead) drawPacer(ctx, ahead, view, { bob: performance.now() / 260 });
            }
        }

        if (state.mode !== 'guide' && aiming) drawReticle(ctx, aiming, view);

        // عدّاد النقاط على الصورة لا في اللوحة: عينك على الأرض
        // حين تضغط، لا على أسفل الشاشة. وتحت الشريط العلويّ لئلّا يُحجب
        if (state.mode !== 'guide') {
            drawPill(ctx, view.width / 2, 96, `${state.points.length} نقطة`,
                { tone: PALETTE.route, size: 12 });
        }
    }, []);

    const grade = gradeBase(span);
    const drift = span > 0 ? errorAt(10, span) : null;
    const walked = useMemo(() => polylineLength(points), [points]);

    return (
        <div className="nt-stage">
            <header className="nt-bar">
                <button className="nt-x" onClick={onDone} aria-label="خروج">✕</button>
                <b>{mode === 'guide' ? track.name : (name || 'مسار جديد')}</b>
                {phase === 'work' && mode !== 'guide' && (
                    <button className="nt-save" onClick={() => setNaming(true)} disabled={points.length < 2}>
                        احفظ
                    </button>
                )}
            </header>

            <ARStage
                apiRef={stage}
                height={track?.height || 1.7}
                onDraw={paint}
                hint={{
                    title: mode === 'guide' ? `إرشاد — ${track.name}` : 'نانوتراك',
                    note: 'نفتح الكاميرا الخلفية. جهّز الشريطين على الأرض قبل أن تبدأ.'
                }}
            >

                {/* ── المعايرة ── */}
                {phase !== 'work' && (
                    <div className="nt-panel">
                        <b>{PHASES[phase].title}</b>
                        <p>{PHASES[phase].note}</p>

                        {phase === 'aim' && (
                            <div className="nt-base">
                                <strong>{span.toFixed(2)} م</strong>
                                <span className={`nt-note is-${grade}`}>{BASE_NOTE[grade]}</span>
                                {drift !== null && grade !== 'short' && (
                                    <i>على بُعد ١٠ م ينزاح المسار ≈ {(drift * 100).toFixed(0)} سم</i>
                                )}
                            </div>
                        )}

                        <button
                            className="nt-act"
                            onClick={phase === 'zero' ? markZero : markAim}
                            disabled={phase === 'aim' && span < MIN_BASE}
                        >
                            {PHASES[phase].action}
                        </button>

                        {phase === 'aim' && track && (
                            <span className="nt-dim">
                                قاعدة هذا المسار يوم إنشائه {track.base.toFixed(2)} م — كلّما اقتربتَ منها
                                صار المقياس أصدق.
                            </span>
                        )}
                    </div>
                )}

                {/* ── الرسم ── */}
                {phase === 'work' && mode !== 'guide' && (
                    <div className="nt-panel is-work">
                        <div className="nt-tools">
                            <button className="nt-act" onClick={() => addHere()}>احفظ نقطة</button>
                            <button
                                className={`nt-toggle${auto ? ' is-on' : ''}`}
                                onClick={() => setAuto(v => !v)}
                            >
                                {auto ? 'أوقف المشي' : 'سجّل بالمشي'}
                            </button>
                            <button className="nt-undo" onClick={undo} disabled={!points.length}>تراجع</button>
                        </div>

                        <span className="nt-dim">
                            {points.length} نقطة · {readableDistance(walked)}
                            {auto ? ' · نقطة كل ٧٠ سم وأنت تمشي' : ''}
                        </span>
                    </div>
                )}

                {/* ── الإرشاد ── */}
                {phase === 'work' && mode === 'guide' && guide && (
                    <div className={`nt-guide${guide.arrived ? ' is-there' : ''}`}>
                        {guide.arrived ? (
                            <b>وصلت</b>
                        ) : (
                            <>
                                <strong>{readableDistance(guide.remaining)}</strong>
                                <span>
                                    {Math.abs(guide.turn) < 25 ? 'امشِ إلى الأمام'
                                        : guide.turn > 0 ? `استدر يميناً ${Math.round(Math.abs(guide.turn))}°`
                                            : `استدر يساراً ${Math.round(Math.abs(guide.turn))}°`}
                                </span>
                                {guide.offTrack && <i>ابتعدتَ عن المسار {readableDistance(guide.offset)}</i>}
                            </>
                        )}
                    </div>
                )}

                {auto && <div className="nt-rec"><i />يسجّل</div>}
                {notice && <div className={`nt-flash is-${notice.kind}`}>{notice.message}</div>}
            </ARStage>

            {/* ── التسمية والحفظ ── */}
            {naming && (
                <div className="nt-modal" role="dialog">
                    <div className="nt-modal-card">
                        <b>احفظ المسار</b>
                        <span className="nt-dim">
                            {points.length} نقطة · {readableDistance(walked)} · قاعدة {frame.current?.base.toFixed(2)} م
                        </span>

                        <label htmlFor="nt-name">الاسم</label>
                        <input
                            id="nt-name"
                            value={name}
                            onChange={(e) => setName(e.target.value.slice(0, 60))}
                            placeholder="المطبخ · غرفة الاجتماعات · المخزن"
                            autoFocus
                        />

                        <p className="nt-dim">
                            يُحفظ في هذا المتصفّح على هذا الهاتف. ثبّت الشريطين في نفس موضعهما
                            في المرّة القادمة ليعود المسار كما هو.
                        </p>

                        <div className="nt-modal-act">
                            <button className="nt-act" onClick={commit}>احفظ</button>
                            <button onClick={() => setNaming(false)}>رجوع</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

/* ============================================================ */

const NanoTrack = ({ onClose }) => {
    const [tracks, setTracks] = useState(() => listTracks());
    const [open, setOpen] = useState(null);      // { track, mode }
    const [notice, setNotice] = useState(null);

    const refresh = useCallback(() => setTracks(listTracks()), []);

    const remove = useCallback((track) => {
        // eslint-disable-next-line no-alert
        if (!window.confirm(`حذف «${track.name}»؟ لا رجعة في هذا.`)) return;

        const result = deleteTrack(track.id);
        refresh();
        setNotice(result.ok
            ? { kind: 'ok', message: 'حُذف المسار' }
            : { kind: 'err', message: result.why });
    }, [refresh]);

    const saved = useCallback((track) => {
        refresh();
        setOpen(null);
        setNotice({ kind: 'ok', message: `حُفظ «${track.name}» — ${track.points.length} نقطة` });
    }, [refresh]);

    useEffect(() => {
        if (!notice) return undefined;
        const t = setTimeout(() => setNotice(null), 3200);
        return () => clearTimeout(t);
    }, [notice]);

    return (
        <div className="nt">
            {open ? (
                <NanoStage
                    key={`${open.track?.id || 'new'}-${open.mode}`}
                    track={open.track}
                    mode={open.mode}
                    onDone={() => setOpen(null)}
                    onSaved={saved}
                />
            ) : (
                <TrackList
                    tracks={tracks}
                    notice={notice}
                    onNew={() => setOpen({ track: null, mode: 'record' })}
                    onOpen={(track, mode) => setOpen({ track, mode })}
                    onRemove={remove}
                    onClose={onClose}
                />
            )}
        </div>
    );
};

export default NanoTrack;
