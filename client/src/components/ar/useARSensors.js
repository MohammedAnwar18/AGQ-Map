import { useState, useEffect, useRef, useCallback } from 'react';
import {
    poseFromOrientation, createHeadingFilter, createStepDetector,
    strideFor, advance, DEFAULT_POSE
} from './indoorGeo';

/* ============================================================
   مستشعرات الواقع المعزّز

   ثلاث قطع يحتاجها المشهد: الكاميرا، واتّجاه الجهاز، وخطوات
   صاحبه. وكلّها خلف أذونات تختلف بين المتصفّحات اختلافاً كبيراً،
   ولذلك تُجمع هنا: المكوّن يطلب ويعرض، وهذه الطبقة تتكفّل بالفروق.

   ── ما يجب قوله بصراحة ──

   لا تتبّع مواضع (SLAM) هنا: متصفّح الجوال لا يُتيحه إلا عبر
   WebXR، وهو غائب عن iOS تماماً. فالموضع يُقدَّر بعدّ الخطوات مع
   البوصلة — وهي طريقة الملاحة الداخلية المعروفة، تنحرف مع المسافة
   وتُصحَّح عند المرور بنقطة معروفة.

   أمّا الاتّجاه فدقيق، ومنه وحده يُبنى كل ما يُرسم على الأرض.
   ============================================================ */

// ── ١) الكاميرا ─────────────────────────────────────────────

/**
 * تيّار الكاميرا الخلفية.
 *
 * ‎facingMode: environment‎ تلميح لا أمر: بعض الأجهزة تتجاهله،
 * فنطلب بـ ‎ideal‎ لا ‎exact‎ حتى لا يُرفض الطلب كلّه على جهاز
 * بكاميرا واحدة.
 */
export const useCameraStream = () => {
    const videoRef = useRef(null);
    const streamRef = useRef(null);

    const [state, setState] = useState('idle');   // idle | asking | live | denied | missing
    const [error, setError] = useState(null);
    const [aspect, setAspect] = useState(0.5625);

    const stop = useCallback(() => {
        streamRef.current?.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        setState('idle');
    }, []);

    const start = useCallback(async () => {
        if (!navigator.mediaDevices?.getUserMedia) {
            setState('missing');
            setError('متصفّحك لا يوفّر الكاميرا. جرّب من متصفّح حديث وعبر رابط آمن (https).');
            return false;
        }

        setState('asking');
        setError(null);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { ideal: 'environment' },
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: false
            });

            streamRef.current = stream;

            const video = videoRef.current;
            if (video) {
                video.srcObject = stream;
                video.setAttribute('playsinline', 'true');   // iOS: وإلا فُتح مشغّل ملء الشاشة
                await video.play().catch(() => {});
            }

            // النسبة الحقيقية للتيّار لا للشاشة: بها يُحسب المجال
            // الرأسي، وخطؤها يُميل كل ما يُرسم على الأرض
            const track = stream.getVideoTracks()[0];
            const settings = track?.getSettings?.() || {};
            if (settings.width && settings.height) {
                setAspect(settings.width / settings.height);
            }

            setState('live');
            return true;
        } catch (err) {
            const denied = err?.name === 'NotAllowedError' || err?.name === 'SecurityError';
            setState(denied ? 'denied' : 'missing');
            setError(denied
                ? 'رُفض إذن الكاميرا. افتح إعدادات الموقع في المتصفّح واسمح بالكاميرا ثم أعد المحاولة.'
                : `تعذّر فتح الكاميرا: ${err?.message || 'سبب غير معروف'}`);
            return false;
        }
    }, []);

    useEffect(() => () => stop(), [stop]);

    return { videoRef, state, error, aspect, start, stop };
};

// ── ٢) اتّجاه الجهاز ────────────────────────────────────────

const screenAngle = () => {
    if (typeof window === 'undefined') return 0;
    const angle = window.screen?.orientation?.angle;
    return Number.isFinite(angle) ? angle : (Number(window.orientation) || 0);
};

/**
 * وضعية الجهاز، منعّمة.
 *
 * تُكتب في مرجع لا في حالة React: الحدث يصل ستّين مرّة في الثانية،
 * وإعادة رسم الواجهة مع كلّ منها هدر — الرسم يقرأ المرجع في حلقته.
 * والحالة لا تحمل إلا ما تتغيّر بالضغطة: هل وصل شيء أصلاً.
 */
export const useDeviceOrientation = () => {
    const poseRef = useRef({ ...DEFAULT_POSE });
    const filter = useRef(createHeadingFilter(0.2));

    const [granted, setGranted] = useState(null);   // null غير مطلوب | true | false
    const [alive, setAlive] = useState(false);
    const [absolute, setAbsolute] = useState(true);

    const handler = useRef(null);

    const attach = useCallback(() => {
        if (handler.current) return;

        const onEvent = (event) => {
            const raw = poseFromOrientation(event, screenAngle());
            poseRef.current = {
                heading: filter.current.push(raw.heading),
                pitch: raw.pitch,
                roll: raw.roll
            };

            if (!alive) setAlive(true);

            // البوصلة المطلقة وحدها تُشير إلى الشمال الحقيقي؛ النسبية
            // تُعطي دوراناً بلا مرجع، فنُخبر المستخدم أن عليه معايرتها
            const isAbsolute = event.absolute === true
                || Number.isFinite(event.webkitCompassHeading);
            setAbsolute(prev => (prev === isAbsolute ? prev : isAbsolute));
        };

        handler.current = onEvent;

        // المطلق أولاً حيث يوجد — أندرويد يوفّره وهو الأدقّ
        window.addEventListener('deviceorientationabsolute', onEvent, true);
        window.addEventListener('deviceorientation', onEvent, true);
    }, [alive]);

    const request = useCallback(async () => {
        const Klass = typeof DeviceOrientationEvent !== 'undefined' ? DeviceOrientationEvent : null;

        // iOS 13+ يشترط أن يأتي الطلب من لمسة مباشرة
        if (Klass && typeof Klass.requestPermission === 'function') {
            try {
                const result = await Klass.requestPermission();
                const ok = result === 'granted';
                setGranted(ok);
                if (ok) attach();
                return ok;
            } catch {
                setGranted(false);
                return false;
            }
        }

        setGranted(true);
        attach();
        return true;
    }, [attach]);

    useEffect(() => () => {
        if (!handler.current) return;
        window.removeEventListener('deviceorientationabsolute', handler.current, true);
        window.removeEventListener('deviceorientation', handler.current, true);
        handler.current = null;
    }, []);

    return { poseRef, granted, alive, absolute, request };
};

// ── ٣) الخطوات والموضع ─────────────────────────────────────

/**
 * تقدير الموضع بعدّ الخطوات.
 *
 * كل وقع قدم يُقدّم الموضع بطول خطوة في اتّجاه البوصلة. الانحراف
 * يتراكم — نحو خمسة بالمئة من المسافة — ولذلك يُصحَّح بلمسة على
 * نقطة معروفة: «أنا هنا» تُعيد الأصل إلى مكانه.
 *
 * وهذه هي طريقة الملاحة الداخلية المستعملة فعلاً حين لا GPS: لا
 * تدّعي دقّة السنتيمتر، وتكفي لأن تصل إلى محلّ في ممرّ.
 */
export const usePedestrianTracking = (poseRef, { height = 1.7, enabled = true } = {}) => {
    const positionRef = useRef({ x: 0, z: 0 });
    const detector = useRef(createStepDetector());
    const listener = useRef(null);

    const [steps, setSteps] = useState(0);
    const [motion, setMotion] = useState(null);   // null غير مطلوب | true | false

    const stride = strideFor(height);

    /** يُثبّت الموضع على نقطة معروفة ويُصفّر الانحراف المتراكم */
    const anchor = useCallback((point) => {
        positionRef.current = { x: point?.x || 0, z: point?.z || 0 };
        detector.current.reset();
        setSteps(0);
    }, []);

    const attach = useCallback(() => {
        if (listener.current || !enabled) return;

        const onMotion = (event) => {
            const a = event.accelerationIncludingGravity;
            if (!a) return;

            const magnitude = Math.hypot(a.x || 0, a.y || 0, a.z || 0);

            if (detector.current.push(magnitude, event.timeStamp || performance.now())) {
                positionRef.current = advance(positionRef.current, poseRef.current.heading, stride);
                setSteps(detector.current.count);
            }
        };

        listener.current = onMotion;
        window.addEventListener('devicemotion', onMotion);
    }, [enabled, poseRef, stride]);

    const request = useCallback(async () => {
        const Klass = typeof DeviceMotionEvent !== 'undefined' ? DeviceMotionEvent : null;

        if (Klass && typeof Klass.requestPermission === 'function') {
            try {
                const ok = (await Klass.requestPermission()) === 'granted';
                setMotion(ok);
                if (ok) attach();
                return ok;
            } catch {
                setMotion(false);
                return false;
            }
        }

        if (!Klass) { setMotion(false); return false; }

        setMotion(true);
        attach();
        return true;
    }, [attach]);

    useEffect(() => () => {
        if (listener.current) {
            window.removeEventListener('devicemotion', listener.current);
            listener.current = null;
        }
    }, []);

    return { positionRef, steps, motion, stride, anchor, request };
};

// ── ٤) حلقة الرسم ───────────────────────────────────────────

/**
 * حلقة رسم على لوحة، مقاسها يتبع عنصرها.
 *
 * منفصلة عن React تماماً: الرسم يقرأ المراجع ويرسم، ولا تُعاد شجرة
 * المكوّنات ستّين مرّة في الثانية لأجل سهم يتحرّك.
 */
export const useOverlayLoop = (draw) => {
    const canvasRef = useRef(null);
    const drawRef = useRef(draw);
    drawRef.current = draw;

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return undefined;

        let raf = 0;
        let width = 0;
        let height = 0;

        const frame = () => {
            const box = canvas.getBoundingClientRect();
            const dpr = Math.min(2, window.devicePixelRatio || 1);

            const w = Math.round(box.width * dpr);
            const h = Math.round(box.height * dpr);

            if (w && h && (w !== width || h !== height)) {
                canvas.width = w;
                canvas.height = h;
                width = w;
                height = h;
            }

            if (width && height) {
                const ctx = canvas.getContext('2d');
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                ctx.clearRect(0, 0, box.width, box.height);
                drawRef.current?.(ctx, box.width, box.height);
            }

            raf = requestAnimationFrame(frame);
        };

        raf = requestAnimationFrame(frame);
        return () => cancelAnimationFrame(raf);
    }, []);

    return canvasRef;
};
