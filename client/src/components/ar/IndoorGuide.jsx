import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';

import ARStage from './ARStage';
import FloorPlan from './FloorPlan';
import {
    shortestRoute, routePolyline, distance2D, readableDistance, polylineLength
} from './indoorGeo';
import {
    drawRoute, drawChevrons, drawMarker, drawOffscreenArrow, drawPill,
    drawNearby, guidanceState, PALETTE
} from './arPainter';
import { describeFrame, unpackDescriptor, createRelocalizer } from './visualPlace';

/* ============================================================
   دليل الزائر

   يفتح الرابط فتفتح الكاميرا ومعها خانة بحث. يكتب «مطبخ» أو اسم
   محلّ، فيُرسم له المسار على الأرض ويمشي عليه.

   ── من أين يبدأ ──

   لا GPS داخل المبنى، فلا يعرف الهاتف أين هو عند الفتح. ونسأله
   سؤالاً واحداً: من أين تبدأ؟ — وهي نفس طريقة لوحات «أنت هنا» في
   المولّات، ولها ميزة أنها صادقة: أفضل من تخمين موضع خاطئ يقود
   الناس في الاتجاه المعاكس.

   وبعدها يتقدّم الموضع بعدّ الخطوات مع البوصلة، ويُصحَّح بلمسة
   على أي نقطة يمرّ بها.
   ============================================================ */

const KIND_LABEL = {
    place: 'مكان',
    entrance: 'مدخل',
    junction: 'تقاطع',
    stairs: 'درج',
    elevator: 'مصعد',
    exit: 'مخرج'
};

/** بحث عربي متسامح: يتجاهل التشكيل وصور الألف والهمزات */
const fold = (text) => String(text || '')
    .replace(/[ً-ْـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .toLowerCase()
    .trim();

const IndoorGuide = ({ venue, nodes, edges, places = [], onClose }) => {
    const stage = useRef(null);

    const [query, setQuery] = useState('');
    const [destination, setDestination] = useState(null);
    const [origin, setOrigin] = useState(null);       // النقطة التي انطلقنا منها
    const [picking, setPicking] = useState('none');   // start | search | none
    const [status, setStatus] = useState(null);
    const [plan, setPlan] = useState(false);
    const [arrived, setArrived] = useState(false);
    const [notice, setNotice] = useState(null);

    /*
     * التعرّف البصري على المكان.
     *
     * الكاميرا تُصوّر خمس مرّات في الثانية، وكل إطار يُقارَن ببصمات
     * المكان المحفوظة. تطابقٌ مستقرّ يقول أين أنت — فلا نسألك.
     */
    const [located, setLocated] = useState(null);   // آخر ما تعرّفنا عليه
    const [seeking, setSeeking] = useState(true);

    const flash = useCallback((message, kind = 'ok') => {
        setNotice({ message, kind });
        setTimeout(() => setNotice(null), 2600);
    }, []);

    // ── الأماكن القابلة للبحث ──
    // ‎spots‎ لا ‎places‎: الأخيرة صارت بصمات المكان التي تأتي خاصّيةً
    const spots = useMemo(
        () => nodes.filter(n => n.kind !== 'junction'),
        [nodes]
    );

    const entrances = useMemo(() => {
        const doors = spots.filter(n => n.kind === 'entrance' || n.kind === 'exit');
        return doors.length ? doors : spots;
    }, [spots]);

    const results = useMemo(() => {
        const q = fold(query);
        if (!q) return spots.slice(0, 40);

        return spots
            .map(node => {
                const name = fold(node.name);
                const category = fold(node.category);

                // البداية أقوى من الاحتواء: من يكتب «مط» يريد المطعم
                // لا «قسم المطافئ الخلفي»
                if (name.startsWith(q)) return { node, score: 0 };
                if (name.includes(q)) return { node, score: 1 };
                if (category.includes(q)) return { node, score: 2 };
                return null;
            })
            .filter(Boolean)
            .sort((a, b) => a.score - b.score)
            .slice(0, 40)
            .map(r => r.node);
    }, [query, spots]);

    /*
     * مكتبة البصمات، مفكوكة مرّة واحدة.
     *
     * فكّها في كل إطار يعني فكّ مئتي متّجه خمس مرّات في الثانية —
     * وهي ثابتة لا تتغيّر أثناء الجلسة.
     */
    const library = useMemo(() => places
        .map(place => {
            const descriptor = unpackDescriptor(place);
            return descriptor ? { ...place, descriptor } : null;
        })
        .filter(Boolean), [places]);

    const relocalizer = useRef(createRelocalizer());

    // ── الطريق ──
    const polyline = useMemo(() => {
        if (!origin || !destination) return null;

        const route = shortestRoute(nodes, edges, origin.id, destination.id);
        if (!route) return null;

        return routePolyline(route, nodes, edges);
    }, [origin, destination, nodes, edges]);

    const noRoute = Boolean(origin && destination && !polyline);

    /*
     * حلقة التعرّف.
     *
     * خمس مرّات في الثانية: أسرع منها لا يُضيف — المشهد لا يتغيّر
     * في خُمس ثانية — وأبطأ منها يجعل التعرّف يتأخّر عن خطواتك.
     *
     * وحين نتعرّف نُثبّت الموضع على موضع البصمة: هذا هو ما يُصحّح
     * انحراف عدّ الخطوات كلّما مررتَ بمكان معروف، فلا يتراكم.
     */
    useEffect(() => {
        if (!library.length) { setSeeking(false); return undefined; }

        const tick = setInterval(() => {
            const api = stage.current;
            const frame = api?.grab?.();
            if (!frame) return;

            const query = describeFrame(frame.data, frame.width, frame.height);
            const result = relocalizer.current.push(query, library);

            if (!result.changed || !result.place) return;

            const place = result.place;
            api.anchor({ x: place.x, z: place.z });

            setLocated({ ...place, score: result.score });
            setSeeking(false);

            // أقرب نقطة مسمّاة لموضع البصمة تصير نقطة الانطلاق
            let nearest = null;
            let best = 9;
            for (const node of nodes) {
                if (node.kind === 'junction') continue;
                const d = distance2D(node, place);
                if (d < best) { best = d; nearest = node; }
            }
            if (nearest) setOrigin(nearest);
        }, 200);

        return () => clearInterval(tick);
    }, [library, nodes]);

    /*
     * نبدأ من أقرب مدخل تلقائياً.
     *
     * السؤال «من أين تبدأ؟» كان يسبق الكاميرا ويسدّها — والمطلوب أن
     * تُفتح فيرى ما أمامه. فنبدأ من المدخل — وهو صحيح في أغلب
     * الأحوال لأن من يفتح الرابط يقف عنده — ونقول من أين بدأنا في
     * شارة صغيرة تُغيَّر بلمسة.
     */
    useEffect(() => {
        // التعرّف البصري أصدق من التخمين: ننتظره ما دامت في المكان
        // بصمات، ولا نفترض المدخل إلا حين لا يكون هناك ما يُتعرّف به
        if (origin || located || !entrances.length) return;
        if (library.length) return;

        setOrigin(entrances[0]);
    }, [origin, located, entrances, library]);

    useEffect(() => {
        if (origin) stage.current?.anchor(origin);
    }, [origin]);

    // ── بدء الرحلة ──
    const startFrom = (node) => {
        setOrigin(node);
        setSeeking(false);
        stage.current?.anchor(node);
        setPicking(destination ? 'none' : 'search');
        flash(`انطلقنا من ${node.name}`);
    };

    const goTo = (node) => {
        setDestination(node);
        setArrived(false);
        setPicking(origin ? 'none' : 'start');
        setQuery('');
        if (origin) flash(`إلى ${node.name}`);
    };

    /** «أنا هنا»: يُصحّح الانحراف المتراكم بلمسة واحدة */
    const reanchor = (node) => {
        stage.current?.anchor(node);
        setPicking('none');
        flash(`ثُبّت موضعك عند ${node.name}`);
    };

    // ── الرسم ──
    const paint = useCallback((ctx, view) => {
        const line = polyline;

        // ما حولك يُعرض دائماً، بمسار أو بلا مسار: هذا هو المقصود
        // من فتح الكاميرا — أن ترى ما في المكان لا أن تبحث عنه
        for (const node of nodes) {
            if (node.kind === 'junction') continue;
            const away = distance2D(view.origin, node);
            if (away > 26) continue;

            drawMarker(ctx, node, view, {
                tone: node.id === destination?.id ? PALETTE.target : 'rgba(148,163,184,.8)',
                label: node.id === destination?.id || away < 14,
                highlight: node.id === destination?.id
            });
        }

        drawNearby(ctx, nodes, view);

        if (!line || line.length < 2) {
            if (destination) drawMarker(ctx, destination, view, { tone: PALETTE.target, highlight: true });
            return;
        }

        // خطّ خافت تحت السهام لا فوقها: السهام هي ما يُقرأ، والخطّ
        // يربطها فقط — عريضاً كان يبتلعها
        drawRoute(ctx, line, view, {
            tone: 'rgba(34, 211, 238, .55)',
            glow: 'rgba(34, 211, 238, .16)'
        });
        drawChevrons(ctx, line, view, { spacing: 1.6, phase: (performance.now() / 1600) % 1 });

        const guide = guidanceState(line, view.origin, view.pose);
        if (!guide) return;

        if (guide.arrived) {
            drawPill(ctx, view.width / 2, view.height * 0.42, `وصلت إلى ${destination.name}`, {
                tone: PALETTE.node, size: 16, weight: 800, padding: 14
            });
            return;
        }

        // سهم الحافّة حين يخرج المسار عن الشاشة — يُنهي الدوران في المكان
        drawOffscreenArrow(ctx, guide.target, view);

        if (guide.offTrack) {
            drawPill(ctx, view.width / 2, view.height * 0.34,
                `ابتعدتَ ${readableDistance(guide.offset)} عن المسار`, { tone: '#FB7185' });
        }
    }, [polyline, destination, nodes]);

    // ── الحالة النصّية ──
    // تُحدَّث خمس مرّات في الثانية لا ستّين: الرقم على الشاشة لا
    // يحتاج أكثر، وإعادة الرسم بكل إطار تُتعب الهاتف
    useEffect(() => {
        if (!polyline) { setStatus(null); return undefined; }

        const tick = setInterval(() => {
            const api = stage.current;
            if (!api?.positionRef) return;

            const guide = guidanceState(polyline, api.positionRef.current, api.poseRef.current);
            if (!guide) return;

            setStatus({
                remaining: guide.remaining,
                turn: guide.turn,
                offTrack: guide.offTrack
            });

            if (guide.arrived) setArrived(true);
        }, 200);

        return () => clearInterval(tick);
    }, [polyline]);

    const turnText = (turn) => {
        if (Math.abs(turn) < 22) return 'تابع إلى الأمام';
        if (Math.abs(turn) > 140) return 'استدر للخلف';
        return turn > 0 ? 'إلى اليمين' : 'إلى اليسار';
    };

    const routeLength = polyline ? polylineLength(polyline) : 0;

    return (
        <div className="ai ai-guide" dir="rtl">
            <ARStage
                apiRef={stage}
                eyeHeight={venue.eyeHeight}
                fov={venue.fov}
                onDraw={paint}
                onTap={(at) => {
                    // لمسة على مكان قريب تجعله وجهتك مباشرةً
                    if (!at) return;
                    const hit = nodes
                        .filter(n => n.kind !== 'junction')
                        .find(n => distance2D(n, at) < 2.2);
                    if (hit) goTo(hit);
                }}
                hint={{
                    title: venue.title,
                    note: 'نفتح الكاميرا الخلفية فترى ما أمامك ومعه ما في المكان. ابحث عن وجهتك ثم امشِ على الخطّ.'
                }}
            >
                {/* ── الشريط العلوي ── */}
                <header className="ai-top">
                    {onClose && <button className="ai-x" onClick={onClose} aria-label="إغلاق">✕</button>}

                    <button className="ai-search" onClick={() => setPicking('search')}>
                        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                            <circle cx="11" cy="11" r="7" /><path d="m20 20-3.6-3.6" />
                        </svg>
                        <span>{destination ? destination.name : 'ابحث عن مكان…'}</span>
                    </button>

                    <button className="ai-x" onClick={() => setPlan(true)} aria-label="المخطّط">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
                            <path d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 7z" /><path d="M9 4v13M15 7v12.5" />
                        </svg>
                    </button>
                </header>

                {/* التعرّف: ما يقوله النظام عن مكانك الآن */}
                {!destination && (
                    <button className="ai-from" onClick={() => setPicking('start')}>
                        {located
                            ? <>تعرّفتُ على <b>{located.label || origin?.name || 'المكان'}</b></>
                            : seeking && library.length
                                ? <>يتعرّف على المكان… وجّه الكاميرا حولك</>
                                : origin
                                    ? <>بدأنا من <b>{origin.name}</b> — غيّرها</>
                                    : <>اختر من أين تبدأ</>}
                    </button>
                )}

                {/* ── لافتة التوجيه ── */}
                {polyline && status && !arrived && (
                    <div className={`ai-banner${status.offTrack ? ' is-off' : ''}`}>
                        <b>{turnText(status.turn)}</b>
                        <span>{readableDistance(status.remaining)} إلى {destination.name}</span>
                    </div>
                )}

                {arrived && (
                    <div className="ai-banner is-done">
                        <b>وصلت</b>
                        <span>{destination.name}</span>
                    </div>
                )}

                {noRoute && (
                    <div className="ai-banner is-off">
                        <b>لا طريق محفوظ</b>
                        <span>لم يرسم الأدمن ممرّاً يصل بين هاتين النقطتين بعد</span>
                    </div>
                )}

                {/* ── المخطّط المصغّر ── */}
                {polyline && (
                    <button className="ai-mini" onClick={() => setPlan(true)} aria-label="المخطّط">
                        <FloorPlan
                            nodes={nodes}
                            edges={edges}
                            route={polyline}
                            you={stage.current?.positionRef?.current}
                            heading={stage.current?.poseRef?.current?.heading}
                            selected={destination?.id}
                            compact
                        />
                    </button>
                )}

                {/* ── شريط سفلي ── */}
                <nav className="ai-tools ai-bottom">
                    <button onClick={() => setPicking('start')}>أنا هنا</button>
                    <button onClick={() => setPicking('search')}>وجهة</button>
                    {destination && (
                        <button
                            className="ai-undo"
                            onClick={() => { setDestination(null); setArrived(false); }}
                        >
                            أوقف
                        </button>
                    )}
                </nav>

                {notice && <div className={`ai-flash is-${notice.kind}`}>{notice.message}</div>}
            </ARStage>

            {/* ── البحث ── */}
            {picking === 'search' && (
                <div className="ai-sheet" role="dialog">
                    <header>
                        <b>إلى أين؟</b>
                        <button onClick={() => setPicking('none')} aria-label="إغلاق">✕</button>
                    </header>

                    <div className="ai-searchbar">
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="اكتب اسم المكان…"
                            autoFocus
                        />
                    </div>

                    <div className="ai-sheet-body">
                        {!results.length && (
                            <p className="ai-empty">
                                {spots.length
                                    ? 'لا نتيجة بهذا الاسم'
                                    : 'لا أماكن في هذه الخريطة بعد'}
                            </p>
                        )}

                        {results.map(node => (
                            <button key={node.id} className="ai-result" onClick={() => goTo(node)}>
                                <span className="ai-result-name">{node.name}</span>
                                <span className="ai-result-meta">
                                    {node.category || KIND_LABEL[node.kind] || 'مكان'}
                                    {origin && ` · ${readableDistance(distance2D(origin, node))}`}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* ── نقطة البداية ── */}
            {picking === 'start' && (
                <div className="ai-sheet" role="dialog">
                    <header>
                        <b>من أين تبدأ؟</b>
                        <button onClick={() => setPicking('none')} aria-label="إغلاق">✕</button>
                    </header>

                    <div className="ai-sheet-body">
                        <p className="ai-note">
                            داخل المبنى لا يعرف الهاتف مكانه بنفسه. اختر النقطة التي تقف
                            عندها الآن، وسنتابع تقدّمك بعدها بعدّ خطواتك.
                        </p>

                        {(origin ? spots : entrances).map(node => (
                            <button
                                key={node.id}
                                className={`ai-result${origin?.id === node.id ? ' is-on' : ''}`}
                                onClick={() => (origin ? reanchor(node) : startFrom(node))}
                            >
                                <span className="ai-result-name">{node.name}</span>
                                <span className="ai-result-meta">{KIND_LABEL[node.kind] || 'مكان'}</span>
                            </button>
                        ))}

                        {!spots.length && <p className="ai-empty">لا نقاط في هذه الخريطة بعد</p>}
                    </div>
                </div>
            )}

            {/* ── المخطّط الكامل ── */}
            {plan && (
                <div className="ai-sheet is-plan" role="dialog">
                    <header>
                        <b>{venue.title}</b>
                        <button onClick={() => setPlan(false)} aria-label="إغلاق">✕</button>
                    </header>

                    <div className="ai-sheet-body">
                        <FloorPlan
                            nodes={nodes}
                            edges={edges}
                            route={polyline}
                            you={stage.current?.positionRef?.current}
                            heading={stage.current?.poseRef?.current?.heading}
                            selected={destination?.id}
                            onPick={(id, node) => { goTo(node); setPlan(false); }}
                        />

                        <p className="ai-note">
                            {polyline
                                ? `الطريق ${readableDistance(routeLength)} من ${origin.name} إلى ${destination.name}. المس أي نقطة لتغيير الوجهة.`
                                : 'المس أي نقطة على المخطّط لتكون وجهتك.'}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default IndoorGuide;
