import React, { useState, useCallback, useEffect, useRef } from 'react';

import { useCameraStream, useDeviceOrientation, usePedestrianTracking, useOverlayLoop } from './useARSensors';
import { fromPixels, screenToFloor, aimPoint } from './indoorGeo';

/* ============================================================
   مسرح الواقع المعزّز

   الطبقة المشتركة بين الاستوديو والدليل: تفتح الكاميرا، وتطلب
   الأذونات، وتُشغّل حلقة الرسم فوق الصورة، وتحوّل كل لمسة إلى نقطة
   على الأرض.

   وهي أيضاً من تقول الحقيقة حين لا تعمل: هاتف بلا بوصلة، أو إذن
   مرفوض، أو صفحة على http لا https — كلّها حالات تُشرح بصراحة
   وبخطوة تالية، لا بشاشة سوداء.
   ============================================================ */

const STEPS = {
    intro: 'مهيّأ',
    camera: 'الكاميرا',
    sensors: 'المستشعرات',
    ready: 'جاهز'
};

/** الصفحة على اتّصال آمن؟ الكاميرا والمستشعرات لا تعمل بدونه */
const isSecure = () => typeof window === 'undefined'
    || window.isSecureContext
    || window.location.hostname === 'localhost';

const ARStage = ({
    eyeHeight = 1.5,
    fov = 65,
    height = 1.7,
    tracking = true,
    apiRef,
    aimDistance = 3,
    aimMode = 'auto',
    onDraw,
    onTap,
    onDrag,
    onDragEnd,
    children,
    hint
}) => {
    const camera = useCameraStream();
    const orientation = useDeviceOrientation();
    const walker = usePedestrianTracking(orientation.poseRef, { height, enabled: tracking });

    const [phase, setPhase] = useState('intro');
    const [problem, setProblem] = useState(null);
    const [dragging, setDragging] = useState(false);

    // ── الرسم ──
    // النافذة الحالية تُمرَّر للرسّام في كل إطار: الوضعية والموضع
    // ومقاس اللوحة — وهي كل ما يحتاجه ليُسقط أي نقطة على الشاشة.
    //
    // وما تُشير إليه الكاميرا يُحسب هنا مرّة ويُكتب في مرجع: الأب
    // يقرأه حين يضغط «أضف»، والرسّام يرسمه — وحسابه مرّتين يعني
    // اختلافهما يوماً ما بمقدار إطار.
    const aimRef = useRef({ x: 0, y: 0, z: 0, distance: 3, onFloor: true });

    const canvasRef = useOverlayLoop((ctx, width, height2) => {
        const view = {
            pose: orientation.poseRef.current,
            origin: walker.positionRef.current,
            eye: eyeHeight,
            fov,
            aspect: camera.aspect,
            width,
            height: height2
        };

        aimRef.current = aimPoint(
            view.pose, view.origin, eyeHeight,
            aimDistance, fov, camera.aspect,
            { preferRay: aimMode === 'ray' }
        );

        onDraw?.(ctx, view, aimRef.current);
    });

    // ── التشغيل ──
    const begin = useCallback(async () => {
        setProblem(null);

        if (!isSecure()) {
            setProblem('الكاميرا والبوصلة لا تعملان إلا على اتّصال آمن (https). افتح الموقع عبر رابطه الآمن.');
            return;
        }

        setPhase('camera');
        if (!(await camera.start())) {
            setProblem(camera.error || 'تعذّر فتح الكاميرا');
            setPhase('intro');
            return;
        }

        setPhase('sensors');

        // ترتيب مقصود: الكاميرا أوّلاً لأن رفضها يُنهي كل شيء،
        // والمستشعرات بعدها لأن iOS يشترط لمسة واحدة لكلّ طلب
        const compass = await orientation.request();
        if (tracking) await walker.request();

        if (!compass) {
            setProblem('رُفض إذن البوصلة. بدونها لا يعرف الهاتف إلى أين ينظر — اسمح بها من إعدادات الموقع.');
        }

        setPhase('ready');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [camera, orientation, walker, tracking]);

    // ── إحداثيات اللمس على الأرض ──
    const floorAt = useCallback((event) => {
        const canvas = canvasRef.current;
        if (!canvas) return null;

        const box = canvas.getBoundingClientRect();
        const { sx, sy } = fromPixels(event.clientX - box.left, event.clientY - box.top, box.width, box.height);

        return screenToFloor(
            sx, sy,
            orientation.poseRef.current,
            walker.positionRef.current,
            eyeHeight, fov, camera.aspect
        );
    }, [canvasRef, orientation, walker, eyeHeight, fov, camera.aspect]);

    const onPointerDown = (event) => {
        if (phase !== 'ready') return;
        event.currentTarget.setPointerCapture?.(event.pointerId);

        const at = floorAt(event);
        if (onDrag && at) { setDragging(true); onDrag(at, 'start'); }
        else if (onTap) onTap(at, event);
    };

    const onPointerMove = (event) => {
        if (!dragging || !onDrag) return;
        const at = floorAt(event);
        if (at) onDrag(at, 'move');
    };

    const endDrag = (event) => {
        if (!dragging) return;
        setDragging(false);
        onDragEnd?.();
        try { event.currentTarget.releasePointerCapture?.(event.pointerId); } catch { /* تُرك أصلاً */ }
    };

    /*
     * ما يحتاجه من فوقنا.
     *
     * المراجع لا الحالة: الوضعية والموضع يتغيّران ستّين مرّة في
     * الثانية، ولو مرّا عبر خصائص React لأعادا رسم الاستوديو كلّه
     * مع كل حركة يد.
     */
    useEffect(() => {
        if (!apiRef) return;
        apiRef.current = {
            poseRef: orientation.poseRef,
            positionRef: walker.positionRef,
            aimRef,
            anchor: walker.anchor,
            steps: walker.steps,
            aspect: camera.aspect,
            ready: phase === 'ready'
        };
    }, [apiRef, orientation.poseRef, walker.positionRef, walker.anchor, walker.steps, camera.aspect, phase]);

    useEffect(() => () => camera.stop(), [camera]);

    const busy = phase === 'camera' || phase === 'sensors';

    return (
        <div className="ars">
            <video className="ars-feed" ref={camera.videoRef} muted playsInline autoPlay />

            <canvas
                className="ars-canvas"
                ref={canvasRef}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
            />

            {phase === 'ready' && children}

            {/* تحذير البوصلة النسبية: الاتّجاه يدور لكنه لا يعرف الشمال */}
            {phase === 'ready' && orientation.alive && !orientation.absolute && (
                <div className="ars-warn">
                    بوصلة هذا الجهاز نسبيّة — حرّكه على شكل رقم ٨ في الهواء لمعايرتها،
                    وثبّت موضعك من زرّ «أنا هنا» كلّما مررتَ بنقطة معروفة.
                </div>
            )}

            {/*
              * البوّابة.
              *
              * كانت بطاقة تملأ الشاشة وتشرح قبل أن يرى شيئاً — وهو
              * عكس المقصود: المطلوب كاميرا مفتوحة يرى فيها ما أمامه.
              * صارت لمسة واحدة على شريط سفلي، وما إن يُسمح حتى تختفي
              * ولا يبقى إلا الصورة.
              */}
            {phase !== 'ready' && (
                <div className={`ars-gate${problem ? ' is-blocked' : ''}`}>
                    <div className="ars-gate-card">
                        <svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h2L9 4h6l1.5 2h2A2.5 2.5 0 0 1 21 8.5v9A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5z" />
                            <circle cx="12" cy="12.5" r="3.6" />
                        </svg>

                        <b>{hint?.title || 'الواقع المعزّز'}</b>
                        <p>{hint?.note || 'نفتح الكاميرا الخلفية ونقرأ اتّجاه الهاتف، فترى ما أمامك ومعه ما وضعتَه عليه.'}</p>

                        {problem && <p className="ars-problem">{problem}</p>}

                        <button className="ars-start" onClick={begin} disabled={busy}>
                            {busy ? `يفتح ${STEPS[phase]}…` : problem ? 'أعد المحاولة' : 'ابدأ'}
                        </button>

                        <span className="ars-fineprint">
                            الصورة تبقى على جهازك: لا تُرفع ولا تُسجَّل. والمطلوب منها الاتّجاه فقط.
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ARStage;

/** يكشف حالة المستشعرات للمكوّنات التي تحتاجها خارج المسرح */
export { useCameraStream, useDeviceOrientation, usePedestrianTracking };
