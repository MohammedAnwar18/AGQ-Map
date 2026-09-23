import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';

import ARStage from './ARStage';
import FloorPlan from './FloorPlan';
import arIndoorService, { arError } from '../../services/arIndoorApi';
import {
    simplifyPath, distance2D, polylineLength, projectOnPath, slicePath, readableDistance
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

/*
 * من أين جاء البُعد.
 *
 * يُقال للمستخدم صراحةً: ما قيس من الأرض قياس، وما جاء بالحركة
 * تثليث، وما بقي تقدير. وإخفاء الفرق يجعله يثق بالتقدير كما يثق
 * بالقياس — ثم يكتشف الفرق عند الملاحة.
 */
const SOURCE_LABEL = {
    floor: 'مقيس من الأرض',
    motion: 'مقيس بالحركة',
    guess: 'تقديري — امشِ قليلاً'
};

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
     * لا مسطرة ولا رقم يُدخله أحد: البُعد يأتي من الأرض حين تنظر
     * إليها، ومن حركتك حين لا تكون كذلك. و‎ray‎ يُجبر الثاني لمن
     * أراد تحديد شيء مرتفع فوق أرض قريبة.
     */
    const [aimInfo, setAimInfo] = useState(null);

    // آخر ما أشارت إليه الكاميرا — يُقرأ لحظة الضغط على «أضف»
    const aim = useRef({ x: 0, y: 0, z: 0, distance: 3, source: 'floor' });

    /*
     * بصمات المكان.
     *
     * هي ما يجعل الزائر يفتح الكاميرا فيعرف أين هو بلا أن يُسأل.
     * كل بصمة: ما رأته الكاميرا من موضع معيّن، وأين كان ذلك الموضع.
     */
    const [places, setPlaces] = useState([]);
    const [scanning, setScanning] = useState(false);
    const [scanInfo, setScanInfo] = useState(null);

    /*
     * التسجيل بالمشي.
     *
     * الطريقة الطبيعية لبناء خريطة مبنى: تمشي فيه والكاميرا تعمل،
     * فيُرسم الممرّ من خطواتك نفسها، وتضغط «علّم» كلّما مررتَ بشيء
     * يستحقّ اسماً. ورسمُ الممرّات بالإصبع يبقى للتصحيح.
     *
     * والبصمات تُلتقط على الطريق تلقائياً كل مترين — فالمكان
     * يُمسح وأنت تمشي فيه لا في جولة ثانية.
     */
    const [recording, setRecording] = useState(false);
    const [track, setTrack] = useState([]);
    const [walked, setWalked] = useState(0);

    const lastPoint = useRef(null);
    const lastShot = useRef(null);
    const pending = useRef([]);   // ما عُلّم أثناء المشية

    // مرجع للرسم: الحلقة تقرأ منه ولا تُعاد بإغلاق قديم
    const live = useRef({ nodes, edges, draft, selected, places: [], track: [], recording: false });
    live.current = { nodes, edges, draft, selected, places, track, recording };

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

    // ── التسجيل بالمشي ──

    /**
     * يتتبّع خطواتك ويبني منها الممرّ.
     *
     * نقطة كل ثلاثة أرباع المتر: أقلّ منها يملأ المسار بنقاط لا
     * تصف شيئاً، وأكثر منها يقطع الزوايا. والبصمة كل مترين، فتُغطّى
     * المشية بما يكفي للتعرّف عليها من أي موضع فيها.
     */
    useEffect(() => {
        if (!recording) return undefined;

        const tick = setInterval(() => {
            const api = stage.current;
            if (!api?.positionRef) return;

            const at = { ...api.positionRef.current };
            const previous = lastPoint.current;

            if (previous && distance2D(previous, at) < 0.75) return;

            lastPoint.current = at;
            setTrack(prev => [...prev, { x: +at.x.toFixed(2), z: +at.z.toFixed(2) }]);
            if (previous) setWalked(w => w + distance2D(previous, at));

            if (!lastShot.current || distance2D(lastShot.current, at) >= 2) {
                const shot = capture(null);
                if (shot.ok) lastShot.current = at;
            }
        }, 260);

        return () => clearInterval(tick);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [recording]);

    const startWalk = useCallback(() => {
        const api = stage.current;
        const at = api?.positionRef?.current || { x: 0, z: 0 };

        lastPoint.current = { ...at };
        lastShot.current = null;
        pending.current = [];

        setTrack([{ x: +at.x.toFixed(2), z: +at.z.toFixed(2) }]);
        setWalked(0);
        setRecording(true);
        setTool('walk');
        flash('امشِ في الممرّ — الكاميرا تسجّل الطريق');
    }, [flash]);

    /**
     * ينهي المشية فيصير ما مشيتَه ممرّات.
     *
     * المشية الواحدة تُقطَّع عند كل علامة وضعتَها أثناءها: ممرّ من
     * البداية إلى أوّل محلّ، ومنه إلى الثاني، وهكذا. وبهذا يصير
     * لكل قطعة طرفان معروفان، ويستطيع البحث أن يمرّ بها.
     */
    const stopWalk = useCallback(() => {
        setRecording(false);
        setTool('place');

        const line = simplifyPath(live.current.track, 0.35);
        const marks = pending.current;
        pending.current = [];

        if (line.length < 2 || polylineLength(line) < 1.5) {
            setTrack([]);
            flash('المشية أقصر من أن تكون ممرّاً', 'err');
            return;
        }

        const created = [];
        const madeEdges = [];

        // عقدة عند بداية المشية ونهايتها إن لم تكن هناك واحدة
        const anchorAt = (point, name) => {
            const found = nearestNode(point, SNAP);
            if (found) return found;

            const node = {
                id: nextId(), name, kind: 'junction', category: null,
                x: +point.x.toFixed(2), z: +point.z.toFixed(2), y: 0, floor: 0, note: null
            };
            created.push(node);
            return node;
        };

        // نُرتّب العلامات بموضعها على الخطّ، فتُقطَّع المشية بترتيب السير
        const stops = marks
            .map(mark => ({ mark, along: projectOnPath(line, mark).along }))
            .sort((a, b) => a.along - b.along);

        let cursor = anchorAt(line[0], 'بداية الممرّ');
        let fromAlong = 0;

        const cut = (toNode, toAlong) => {
            const piece = slicePath(line, fromAlong, toAlong);
            if (piece.length > 1 && cursor.id !== toNode.id) {
                madeEdges.push({
                    id: nextId(), from: cursor.id, to: toNode.id,
                    kind: 'walk', oneWay: false,
                    path: [{ x: cursor.x, z: cursor.z }, ...piece.slice(1, -1), { x: toNode.x, z: toNode.z }]
                });
            }
            cursor = toNode;
            fromAlong = toAlong;
        };

        for (const stop of stops) cut(stop.mark, stop.along);
        cut(anchorAt(line[line.length - 1], 'نهاية الممرّ'), polylineLength(line));

        if (created.length) setNodes(prev => [...prev, ...created]);
        if (madeEdges.length) setEdges(prev => [...prev, ...madeEdges]);

        setTrack([]);
        setDirty(true);
        flash(`سُجّل ${readableDistance(polylineLength(line))} في ${madeEdges.length} ممرّ`);
    }, [nearestNode, flash]);

    /**
     * يضع علامة وأنت تمشي.
     *
     * موضعها من التصويب التلقائي — الأرض أو الحركة — لا من رقم
     * تُدخله. وتُقطَّع المشية عندها حين تنتهي.
     */
    const markHere = useCallback(() => {
        const at = aim.current;
        if (!at || !Number.isFinite(at.x)) { flash('وجّه الكاميرا إلى ما تُعلّمه', 'err'); return; }

        setNaming({
            x: +at.x.toFixed(2),
            z: +at.z.toFixed(2),
            y: +(at.y || 0).toFixed(2),
            source: at.source,
            distance: at.distance,
            onWalk: true
        });
        setForm({ name: '', kind: 'place', category: '' });
    }, [flash]);

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
            source: at.source,
            distance: at.distance
        });
        setForm({ name: '', kind: 'place', category: '' });
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

        // عُلّمت أثناء مشية؟ تُقطَّع المشية عندها حين تنتهي
        if (naming.onWalk) pending.current.push(node);

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

        // المشية الجارية: خطّ يتبعك على الأرض فترى ما سُجّل
        if (live.current.recording && live.current.track.length > 1) {
            drawRoute(ctx, live.current.track, view, {
                tone: 'rgba(74, 222, 128, .8)',
                glow: 'rgba(74, 222, 128, .2)'
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
        if ((tool === 'place' || live.current.recording) && aiming) drawReticle(ctx, aiming, view);

        if (tool === 'draw' && dr.length === 0) {
            drawPill(ctx, view.width / 2, view.height - 118, 'اسحب إصبعك على الأرض لرسم الممرّ', {
                tone: PALETTE.draw
            });
        }
    }, [tool]);

    // القراءة تُحدَّث خمس مرّات في الثانية لا ستّين: الرقم على
    // الشاشة لا يحتاج أكثر، وإعادة الرسم بكل إطار تُتعب الهاتف
    useEffect(() => {
        if (tool !== 'place' && !recording) { setAimInfo(null); return undefined; }
        const tick = setInterval(() => setAimInfo({ ...aim.current }), 200);
        return () => clearInterval(tick);
    }, [tool, recording]);

    const spots = useMemo(() => nodes.filter(n => n.kind !== 'junction'), [nodes]);
    const selectedNode = nodes.find(n => n.id === selected);

    return (
        <div className="ai" dir="rtl">
            <ARStage
                apiRef={stage}
                eyeHeight={venue.eyeHeight}
                fov={venue.fov}
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

                {/* ── التصويب والتسجيل ── */}
                {(tool === 'place' || recording) && (
                    <div className={`ai-aim${recording ? ' is-solo' : ''}`}>
                        <div className="ai-aim-read">
                            <b>{aimInfo ? `${aimInfo.distance.toFixed(1)} م` : '—'}</b>
                            <span>
                                {aimInfo?.y > 0.25 ? `ارتفاع ${aimInfo.y.toFixed(1)} م · ` : ''}
                                {SOURCE_LABEL[aimInfo?.source] || '—'}
                            </span>
                        </div>

                        {aimInfo?.source === 'guess' && (
                            <p className="ai-aim-hint">
                                امشِ خطوتين وأنت تنظر إليه فيُقاس بُعده بالحركة،
                                أو وجّه الكاميرا إلى موضعه على الأرض فيُقاس مباشرةً.
                            </p>
                        )}

                        {recording ? (
                            <div className="ai-aim-row">
                                <button className="ai-shutter" onClick={markHere}>علّم ما أمامك</button>
                                <button className="ai-btn ai-stop" onClick={stopWalk}>أنهِ المشية</button>
                            </div>
                        ) : (
                            <button className="ai-shutter" onClick={addHere}>حدّد ما أمامك</button>
                        )}
                    </div>
                )}

                {/* ── الأدوات ── */}
                <nav className="ai-tools" hidden={recording}>
                    {!recording && (
                        <button className="is-walk" onClick={startWalk} title="امشِ في الممرّ فيُرسم من خطواتك">
                            سجّل مشياً
                        </button>
                    )}

                    {!recording && [
                        ['place', 'مكان', 'وجّه الكاميرا واضغط'],
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

                    {!recording && (
                        <>
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
                        </>
                    )}
                </nav>

                {recording && (
                    <div className="ai-walk">
                        <i />
                        <b>يسجّل مشيتك</b>
                        <span>{readableDistance(walked)} · {places.length} بصمة</span>
                    </div>
                )}

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
                            {naming.y > 0.25 ? ` · بارتفاع ${naming.y.toFixed(1)} م` : ' · على الأرض'}
                            {' · '}{SOURCE_LABEL[naming.source] || ''}
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
