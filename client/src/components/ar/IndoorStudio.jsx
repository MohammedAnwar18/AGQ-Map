import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';

import ARStage from './ARStage';
import FloorPlan from './FloorPlan';
import arIndoorService, { arError } from '../../services/arIndoorApi';
import {
    simplifyPath, distance2D, polylineLength, bearingTo, readableDistance
} from './indoorGeo';
import {
    drawFloorGrid, drawRoute, drawChevrons, drawMarker, drawDraft, drawPill,
    drawReticle, drawNearby, PALETTE
} from './arPainter';
import {
    describeFrame, packDescriptor, frameQuality, similarity, MIN_QUALITY
} from './visualPlace';

/* ============================================================
   استوديو الخريطة الداخلية

   هنا يبني الأدمن الخريطة وهو واقف في المكان: يوجّه الكاميرا إلى
   نقطة على الأرض فيسمّيها، ويرسم بإصبعه الممرّ الذي يصل بينها وبين
   غيرها، ثم يحفظ.

   ── لماذا هكذا ──

   البديل رسم مخطّط من فوق على شاشة حاسوب — وهو ما يُنتج خرائط لا
   تطابق المبنى. أمّا القياس من داخله فيُعطي أمتاراً حقيقية: النقطة
   التي تلمسها هي النقطة التي تقف أمامها.

   ── ثلاث أدوات لا أكثر ──

     مكان   المس الأرض فتصير نقطة لها اسم يُبحث عنه
     مسار   اسحب إصبعك على الأرض فيصير ممرّاً يصل نقطتين
     أنا هنا  ثبّت موضعك على نقطة معروفة حين ينحرف العدّ
   ============================================================ */

const KINDS = [
    { key: 'place', label: 'مكان', tone: '#4ADE80' },
    { key: 'entrance', label: 'مدخل', tone: '#38BDF8' },
    { key: 'junction', label: 'تقاطع', tone: '#94A3B8' },
    { key: 'stairs', label: 'درج', tone: '#C084FC' },
    { key: 'elevator', label: 'مصعد', tone: '#F472B6' },
    { key: 'exit', label: 'مخرج', tone: '#FB7185' }
];

const toneOf = (kind) => KINDS.find(k => k.key === kind)?.tone || PALETTE.node;

// كم متراً قبل أن يُعدّ طرف المسار ملتصقاً بنقطة موجودة
const SNAP = 2.6;

let seq = 0;
const nextId = () => `t${Date.now().toString(36)}_${++seq}`;

const IndoorStudio = ({ venue, onClose, onSaved }) => {
    const stage = useRef(null);

    const [nodes, setNodes] = useState([]);
    const [edges, setEdges] = useState([]);
    const [tool, setTool] = useState('place');
    const [draft, setDraft] = useState([]);
    const [naming, setNaming] = useState(null);      // { x, z } بانتظار اسم
    const [selected, setSelected] = useState(null);
    const [sheet, setSheet] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [notice, setNotice] = useState(null);
    const [plan, setPlan] = useState(false);

    const [form, setForm] = useState({ name: '', kind: 'place', category: '' });

    /*
     * التصويب.
     *
     * ‎auto‎ يُفضّل الأرض حين تنظر إليها — وهي مقاسة لا مُخمَّنة.
     * و‎ray‎ لما ليس على الأرض: رفّ، لافتة محلّ، باب مصعد. عندها
     * تقول أنت المسافة بالمسطرة حتى تستقرّ الحلقة على الشيء، لأن
     * كاميرا الهاتف في المتصفّح لا تقيس عمقاً.
     */
    const [aimMode, setAimMode] = useState('auto');
    const [aimDistance, setAimDistance] = useState(3);
    const [aimInfo, setAimInfo] = useState(null);

    // آخر ما أشارت إليه الكاميرا — يُقرأ لحظة الضغط على «أضف»
    const aim = useRef({ x: 0, y: 0, z: 0, distance: 3, onFloor: true });

    /*
     * بصمات المكان.
     *
     * هي ما يجعل الزائر يفتح الكاميرا فيعرف أين هو بلا أن يُسأل.
     * كل بصمة: ما رأته الكاميرا من موضع معيّن، وأين كان ذلك الموضع.
     */
    const [places, setPlaces] = useState([]);
    const [scanning, setScanning] = useState(false);
    const [scanInfo, setScanInfo] = useState(null);

    // مرجع للرسم: الحلقة تقرأ منه ولا تُعاد بإغلاق قديم
    const live = useRef({ nodes, edges, draft, selected, places: [] });
    live.current = { nodes, edges, draft, selected, places };

    const flash = useCallback((message, kind = 'ok') => {
        setNotice({ message, kind });
        setTimeout(() => setNotice(null), 2800);
    }, []);

    // ── تحميل ما هو محفوظ ──
    useEffect(() => {
        let alive = true;

        arIndoorService.get(venue.id)
            .then(data => {
                if (!alive) return;
                setNodes(data.nodes || []);
                setEdges(data.edges || []);
                setPlaces(data.places || []);
            })
            .catch(err => flash(arError(err, 'تعذّر تحميل الخريطة'), 'err'));

        return () => { alive = false; };
    }, [venue.id, flash]);

    // ── منع الخروج بتعديل غير محفوظ ──
    useEffect(() => {
        if (!dirty) return undefined;
        const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [dirty]);

    // ── أقرب نقطة ──
    const nearestNode = useCallback((point, within = SNAP) => {
        let best = null;
        let bestD = within;

        for (const node of live.current.nodes) {
            const d = distance2D(node, point);
            if (d < bestD) { bestD = d; best = node; }
        }
        return best;
    }, []);

    // ── بصمة المكان ──

    /**
     * يلتقط بصمة لما تراه الكاميرا الآن.
     *
     * ويرفض ثلاثة أشياء: إطاراً فقير الحوافّ لا يُميّز شيئاً، وبصمة
     * تُشبه واحدة محفوظة كثيراً فلا تُضيف، وتيّاراً لم يجهز بعد.
     * الرفض هنا أرخص من اكتشافه أثناء الملاحة.
     */
    const capture = useCallback((label) => {
        const api = stage.current;
        const frame = api?.grab?.();
        if (!frame) return { ok: false, why: 'الكاميرا لم تجهز بعد' };

        const descriptor = describeFrame(frame.data, frame.width, frame.height);
        const quality = frameQuality(descriptor);

        if (quality < MIN_QUALITY) {
            return { ok: false, why: 'المشهد خالٍ من المعالم — وجّه الكاميرا إلى ما فيه أثاث أو أبواب' };
        }

        const at = api.positionRef.current;
        const heading = api.poseRef.current.heading;

        // بصمة شديدة الشبه بأخرى لا تُضيف معرفة، وتُبطئ المطابقة
        for (const existing of live.current.places) {
            if (existing.descriptor && similarity(descriptor, existing.descriptor) > 0.93) {
                return { ok: false, why: 'هذه الزاوية ملتقطة سلفاً — استدر قليلاً' };
            }
        }

        const place = {
            id: nextId(),
            node: null,
            label: label || null,
            x: +at.x.toFixed(2),
            z: +at.z.toFixed(2),
            heading: +heading.toFixed(2),
            descriptor,
            ...packDescriptor(descriptor)
        };

        setPlaces(prev => [...prev, place]);
        setDirty(true);
        return { ok: true, place, quality };
    }, []);

    /*
     * مسح المكان: بصمات متتالية وأنت تستدير.
     *
     * بصمة واحدة تعمل من زاوية واحدة فقط. والدوران في المكان مع
     * التقاط كل ثلاثة أرباع الثانية يُعطي غلافاً لكل الاتّجاهات،
     * فيتعرّف الزائر على المكان مهما دخل منه.
     */
    useEffect(() => {
        if (!scanning) { setScanInfo(null); return undefined; }

        const tick = setInterval(() => {
            const result = capture(null);
            setScanInfo(result.ok
                ? { kind: 'ok', text: `التُقطت ${live.current.places.length + 1}` }
                : { kind: 'wait', text: result.why });
        }, 750);

        return () => clearInterval(tick);
    }, [scanning, capture]);

    // ── الأدوات ──

    /**
     * يضع نقطة حيث تُشير الكاميرا.
     *
     * بالزرّ لا باللمس: لمس الشاشة بالإبهام يضع النقطة حيث وقع
     * الإبهام لا حيث تنظر — والفرق نصف متر على الأقلّ. أمّا التصويب
     * بالجهاز كلّه ثم الضغط فيضعها حيث تراها بالضبط.
     */
    const addHere = useCallback(() => {
        const at = aim.current;
        if (!at || !Number.isFinite(at.x)) {
            flash('وجّه الكاميرا إلى ما تريد تحديده', 'err');
            return;
        }

        const existing = nearestNode(at, 1.1);
        if (existing) { setSelected(existing.id); setSheet(true); return; }

        setNaming({
            x: +at.x.toFixed(2),
            z: +at.z.toFixed(2),
            y: +(at.y || 0).toFixed(2),
            onFloor: at.onFloor,
            distance: at.distance
        });
        setForm({ name: '', kind: at.onFloor ? 'place' : 'place', category: '' });
    }, [nearestNode, flash]);

    /** لمسة على الشاشة: تُحدّد نقطة موجودة أو تُثبّت الموضع عليها */
    const onTap = useCallback((at) => {
        if (!at) return;

        const node = nearestNode(at, 2.4);
        if (!node) return;

        if (tool === 'here') {
            stage.current?.anchor(node);
            flash(`ثُبّت موضعك عند ${node.name}`);
            setTool('place');
            return;
        }

        setSelected(node.id);
    }, [tool, nearestNode, flash]);

    // ── رسم المسار بالإصبع ──
    const onDrag = useCallback((at, kind) => {
        if (tool !== 'draw' || !at) return;

        if (kind === 'start') { setDraft([{ x: at.x, z: at.z }]); return; }

        setDraft(prev => {
            const last = prev[prev.length - 1];
            // نقطة كل ربع متر: الإصبع يُنتج مئات النقاط في مسحة،
            // وربعها يصف نفس الخطّ
            if (last && distance2D(last, at) < 0.25) return prev;
            return [...prev, { x: at.x, z: at.z }];
        });
    }, [tool]);

    /**
     * نهاية السحبة: يصير الخطّ ممرّاً.
     *
     * طرفاه يلتقطان أقرب نقطة موجودة، وإن لم توجد أنشأنا تقاطعاً —
     * فالأدمن لا يضطرّ إلى وضع نقطة قبل كل مسار، ولا يبقى المسار
     * معلّقاً بلا طرفين في الرسم البياني.
     */
    const onDragEnd = useCallback(() => {
        const raw = live.current.draft;
        setDraft([]);

        if (tool !== 'draw' || raw.length < 2) return;

        const line = simplifyPath(raw, 0.3);
        const length = polylineLength(line);

        if (length < 1.2) { flash('المسار قصير جداً — ارسم خطّاً أطول', 'err'); return; }

        const created = [];

        const endpoint = (point, label) => {
            const found = nearestNode(point);
            if (found) return found;

            const node = {
                id: nextId(),
                name: label,
                kind: 'junction',
                category: null,
                x: +point.x.toFixed(2),
                z: +point.z.toFixed(2),
                floor: 0,
                note: null
            };
            created.push(node);
            return node;
        };

        const from = endpoint(line[0], 'تقاطع');
        const to = endpoint(line[line.length - 1], 'تقاطع');

        if (from.id === to.id) { flash('طرفا المسار على نفس النقطة', 'err'); return; }

        // نُثبّت الطرفين على النقطتين تماماً: فجوة نصف متر بين نهاية
        // الخطّ ومركز النقطة تظهر قفزةً في الملاحة
        const snapped = [{ x: from.x, z: from.z }, ...line.slice(1, -1), { x: to.x, z: to.z }];

        if (created.length) setNodes(prev => [...prev, ...created]);
        setEdges(prev => [...prev, {
            id: nextId(), from: from.id, to: to.id, kind: 'walk', oneWay: false, path: snapped
        }]);

        setDirty(true);
        flash(`مسار ${readableDistance(length)} بين ${from.name} و${to.name}`);
    }, [tool, nearestNode, flash]);

    // ── تسمية نقطة جديدة ──
    const commitNode = () => {
        const name = form.name.trim();
        if (name.length < 2 && form.kind !== 'junction') {
            flash('اكتب اسماً يُبحث عنه', 'err');
            return;
        }

        const node = {
            id: nextId(),
            name: name || 'تقاطع',
            kind: form.kind,
            category: form.category.trim() || null,
            x: naming.x,
            z: naming.z,
            y: naming.y || 0,
            floor: 0,
            note: null
        };

        setNodes(prev => [...prev, node]);

        // بصمة تُلتقط مع النقطة: الاسم وحده لا يُعرّف المكان بصرياً،
        // وهذه هي ما تجعل الزائر يعرف أنه هنا
        const shot = capture(node.name);

        setNaming(null);
        setDirty(true);
        flash(shot.ok
            ? `أُضيف ${node.name} ومعه بصمة المكان`
            : `أُضيف ${node.name} — بلا بصمة: ${shot.why}`);
    };

    const removeNode = (id) => {
        setNodes(prev => prev.filter(n => n.id !== id));
        // الروابط المعلّقة تُحذف معها: رابط إلى نقطة محذوفة يُسقط
        // الملاحة أو يُهمَل صامتاً — وكلاهما أسوأ من حذفه هنا
        setEdges(prev => prev.filter(e => e.from !== id && e.to !== id));
        setSelected(null);
        setDirty(true);
    };

    const renameNode = (id, patch) => {
        setNodes(prev => prev.map(n => (n.id === id ? { ...n, ...patch } : n)));
        setDirty(true);
    };

    const undoEdge = () => {
        setEdges(prev => prev.slice(0, -1));
        setDirty(true);
        flash('حُذف آخر مسار');
    };

    // ── الحفظ ──
    const save = async () => {
        setSaving(true);
        try {
            const result = await arIndoorService.saveMap(venue.id, nodes, edges, places);
            setDirty(false);
            onSaved?.();
            flash(`حُفظت — ${result.nodes} نقطة، ${result.edges} مسار، ${result.places} بصمة`
                + (result.skipped ? ` (تُجوهل ${result.skipped} رابط يتيم)` : ''));
        } catch (err) {
            flash(arError(err, 'تعذّر الحفظ'), 'err');
        } finally {
            setSaving(false);
        }
    };

    // ── الرسم على الكاميرا ──
    const paint = useCallback((ctx, view, aiming) => {
        const { nodes: ns, edges: es, draft: dr, selected: sel } = live.current;

        if (aiming) aim.current = aiming;
        drawFloorGrid(ctx, view);

        // المسارات المحفوظة
        const byId = new Map(ns.map(n => [n.id, n]));
        for (const edge of es) {
            const line = edge.path?.length > 1
                ? edge.path
                : [byId.get(edge.from), byId.get(edge.to)].filter(Boolean);

            if (line.length > 1) {
                drawRoute(ctx, line, view, { tone: 'rgba(56,189,248,.85)', glow: 'rgba(56,189,248,.18)' });
                drawChevrons(ctx, line, view, { spacing: 3, phase: 0 });
            }
        }

        // النقاط — البعيدة جداً تُسقط لافتتها كي لا تتكدّس
        for (const node of ns) {
            const far = distance2D(view.origin, node) > 26;
            drawMarker(ctx, node, view, {
                tone: toneOf(node.kind),
                label: !far,
                highlight: node.id === sel
            });
        }

        // ما يُرسم الآن
        if (dr.length > 1) {
            drawDraft(ctx, dr, view);
            const length = polylineLength(dr);
            drawPill(ctx, view.width / 2, view.height - 96, `طول المسار ${readableDistance(length)}`, {
                tone: PALETTE.draw
            });
        }

        // ما حولك: ما وضعتَه ولو كان خارج الشاشة
        drawNearby(ctx, ns, view);

        // الشاخص — ما تُشير إليه الكاميرا الآن
        if (tool === 'place' && aiming) drawReticle(ctx, aiming, view);

        if (tool === 'draw' && dr.length === 0) {
            drawPill(ctx, view.width / 2, view.height - 118, 'اسحب إصبعك على الأرض لرسم الممرّ', {
                tone: PALETTE.draw
            });
        }
    }, [tool]);

    // القراءة تُحدَّث خمس مرّات في الثانية لا ستّين: الرقم على
    // الشاشة لا يحتاج أكثر، وإعادة الرسم بكل إطار تُتعب الهاتف
    useEffect(() => {
        if (tool !== 'place') { setAimInfo(null); return undefined; }
        const tick = setInterval(() => setAimInfo({ ...aim.current }), 200);
        return () => clearInterval(tick);
    }, [tool]);

    const spots = useMemo(() => nodes.filter(n => n.kind !== 'junction'), [nodes]);
    const selectedNode = nodes.find(n => n.id === selected);

    return (
        <div className="ai" dir="rtl">
            <ARStage
                apiRef={stage}
                eyeHeight={venue.eyeHeight}
                fov={venue.fov}
                aimDistance={aimDistance}
                aimMode={aimMode}
                onDraw={paint}
                onTap={tool === 'draw' ? undefined : onTap}
                onDrag={tool === 'draw' ? onDrag : undefined}
                onDragEnd={onDragEnd}
                hint={{
                    title: venue.title,
                    note: 'قف في المكان ووجّه الكاميرا إلى ما تريد تحديده. ما تراه هو ما يُحفظ.'
                }}
            >
                {/* ── الشريط العلوي ── */}
                <header className="ai-top">
                    <button className="ai-x" onClick={onClose} aria-label="إغلاق">✕</button>

                    <div className="ai-title">
                        <b>{venue.title}</b>
                        <span>{spots.length} مكاناً · {edges.length} مسار · {places.length} بصمة</span>
                    </div>

                    <button
                        className={`ai-save${dirty ? ' is-dirty' : ''}`}
                        onClick={save}
                        disabled={saving || !dirty}
                    >
                        {saving ? '…' : dirty ? 'احفظ' : '✓ محفوظ'}
                    </button>
                </header>

                {/* ── التصويب ── */}
                {tool === 'place' && (
                    <div className="ai-aim">
                        <div className="ai-aim-read">
                            <b>{aimInfo ? `${aimInfo.distance.toFixed(1)} م` : '—'}</b>
                            <span>
                                {aimInfo?.onFloor
                                    ? 'على الأرض'
                                    : `ارتفاع ${(aimInfo?.y || 0).toFixed(1)} م`}
                            </span>
                        </div>

                        <div className="ai-aim-mode">
                            <button
                                className={aimMode === 'auto' ? 'is-on' : ''}
                                onClick={() => setAimMode('auto')}
                            >
                                أرضية
                            </button>
                            <button
                                className={aimMode === 'ray' ? 'is-on' : ''}
                                onClick={() => setAimMode('ray')}
                            >
                                مرتفع
                            </button>
                        </div>

                        {aimMode === 'ray' && (
                            <label className="ai-aim-range">
                                <span>بُعد الشيء عنك</span>
                                <input
                                    type="range" min="0.5" max="20" step="0.25"
                                    value={aimDistance}
                                    onChange={(e) => setAimDistance(parseFloat(e.target.value))}
                                />
                            </label>
                        )}

                        <button className="ai-shutter" onClick={addHere}>
                            حدّد ما أمامك
                        </button>
                    </div>
                )}

                {/* ── الأدوات ── */}
                <nav className="ai-tools">
                    {[
                        ['place', 'مكان', 'ضع نقطة على الأرض'],
                        ['draw', 'مسار', 'ارسم الممرّ بإصبعك'],
                        ['here', 'أنا هنا', 'ثبّت موضعك على نقطة']
                    ].map(([key, label, title]) => (
                        <button
                            key={key}
                            className={tool === key ? 'is-on' : ''}
                            onClick={() => setTool(key)}
                            title={title}
                        >
                            {label}
                        </button>
                    ))}

                    <button
                        className={scanning ? 'is-on' : ''}
                        onClick={() => setScanning(v => !v)}
                        title="التقط بصمات للمكان وأنت تستدير"
                    >
                        {scanning ? `يمسح · ${places.length}` : 'امسح المكان'}
                    </button>

                    <button onClick={() => setPlan(true)} title="مخطّط من فوق">مخطّط</button>
                    <button onClick={() => setSheet(true)} title="قائمة الأماكن">القائمة</button>
                    {edges.length > 0 && <button onClick={undoEdge} className="ai-undo">تراجع</button>}
                </nav>

                {scanning && (
                    <div className="ai-scan">
                        <b>استدر ببطء حول نفسك</b>
                        <span>{scanInfo?.text || 'يلتقط…'}</span>
                        <i>{places.length} بصمة</i>
                    </div>
                )}

                {notice && <div className={`ai-flash is-${notice.kind}`}>{notice.message}</div>}
            </ARStage>

            {/* ── تسمية نقطة ── */}
            {naming && (
                <div className="ai-modal" role="dialog">
                    <div className="ai-modal-card">
                        <b>نقطة جديدة</b>
                        <span className="ai-coords">
                            على بُعد {readableDistance(naming.distance || 0)} منك
                            {naming.onFloor ? ' · على الأرض' : ` · بارتفاع ${naming.y.toFixed(1)} م`}
                        </span>

                        <label htmlFor="ai-name">الاسم كما يبحث عنه الزائر</label>
                        <input
                            id="ai-name"
                            value={form.name}
                            onChange={(e) => setForm(f => ({ ...f, name: e.target.value.slice(0, 80) }))}
                            placeholder="المطبخ · صيدلية الشفاء · المصعد"
                            autoFocus
                        />

                        <label>النوع</label>
                        <div className="ai-kinds">
                            {KINDS.map(k => (
                                <button
                                    key={k.key}
                                    className={form.kind === k.key ? 'is-on' : ''}
                                    style={{ '--tone': k.tone }}
                                    onClick={() => setForm(f => ({ ...f, kind: k.key }))}
                                >
                                    {k.label}
                                </button>
                            ))}
                        </div>

                        <input
                            value={form.category}
                            onChange={(e) => setForm(f => ({ ...f, category: e.target.value.slice(0, 40) }))}
                            placeholder="تصنيف اختياري: مطاعم، عيادات…"
                        />

                        <div className="ai-modal-row">
                            <button className="ai-btn ai-primary" onClick={commitNode}>أضف</button>
                            <button className="ai-btn" onClick={() => setNaming(null)}>إلغاء</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── القائمة ── */}
            {sheet && (
                <div className="ai-sheet" role="dialog">
                    <header>
                        <b>أماكن الخريطة</b>
                        <button onClick={() => setSheet(false)} aria-label="إغلاق">✕</button>
                    </header>

                    <div className="ai-sheet-body">
                        {!nodes.length && <p className="ai-empty">لا نقاط بعد. وجّه الكاميرا واضغط «حدّد ما أمامك».</p>}

                        {nodes.map(node => (
                            <div key={node.id} className={`ai-row${node.id === selected ? ' is-on' : ''}`}>
                                <i style={{ background: toneOf(node.kind) }} />

                                <input
                                    value={node.name}
                                    onChange={(e) => renameNode(node.id, { name: e.target.value.slice(0, 80) })}
                                />

                                <span className="ai-row-meta">
                                    {edges.filter(e => e.from === node.id || e.to === node.id).length} مسار
                                </span>

                                <button onClick={() => removeNode(node.id)} aria-label="حذف">✕</button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── المخطّط من فوق ── */}
            {plan && (
                <div className="ai-sheet is-plan" role="dialog">
                    <header>
                        <b>مخطّط الخريطة</b>
                        <button onClick={() => setPlan(false)} aria-label="إغلاق">✕</button>
                    </header>

                    <div className="ai-sheet-body">
                        <FloorPlan
                            nodes={nodes}
                            edges={edges}
                            you={stage.current?.positionRef?.current}
                            heading={stage.current?.poseRef?.current?.heading}
                            selected={selected}
                            onPick={setSelected}
                        />
                        <p className="ai-note">
                            كل ما تراه هنا قِيس من داخل المكان: النقطة التي لمستها على الأرض
                            هي النقطة التي وقفتَ أمامها، والمسافات بالأمتار الحقيقية.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default IndoorStudio;
