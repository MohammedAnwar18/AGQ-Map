import React, { useEffect, useRef, useState } from 'react';
import { input, resetInput, drive } from './worldStore';

/* ============================================================
   التحكّم في منظور الشخص الأوّل

   كل ما هنا طبقة DOM: تلتقط المفاتيح واللمس وحركة المؤشّر المُثبَّت،
   وتكتب في كائن `input` المشترك. المشهد يقرأه داخل حلقة الإطار.
   ولا حالة React تتغيّر مع كل ضغطة مفتاح أو حركة إصبع — لأن ذلك
   يعني إعادة رسم ستّين مرّة في الثانية بلا سبب.
   ============================================================ */

const LOOK_SPEED = 0.0022;          // راديان لكل بكسل من حركة المؤشّر
const TOUCH_LOOK_SPEED = 0.0042;    // اللمس أبطأ حركةً، فيحتاج حسّاسية أعلى
const STICK_RADIUS = 46;

const KEYS = {
    KeyW: ['forward', 1], ArrowUp: ['forward', 1],
    KeyS: ['forward', -1], ArrowDown: ['forward', -1],
    KeyD: ['strafe', 1], ArrowRight: ['strafe', 1],
    KeyA: ['strafe', -1], ArrowLeft: ['strafe', -1]
};

const isCoarse = () => typeof window !== 'undefined'
    && window.matchMedia?.('(pointer: coarse)').matches;

/** عصا اللمس — تُظهَر على الأجهزة اللمسية وحدها */
export const Joystick = () => {
    const padRef = useRef(null);
    const knobRef = useRef(null);
    const activeRef = useRef(null);

    useEffect(() => () => { input.forward = 0; input.strafe = 0; }, []);

    const apply = (dx, dy) => {
        const dist = Math.hypot(dx, dy);
        const clamped = Math.min(1, dist / STICK_RADIUS);
        const nx = dist ? (dx / dist) * clamped : 0;
        const ny = dist ? (dy / dist) * clamped : 0;

        input.strafe = nx;
        input.forward = -ny;          // لأعلى على الشاشة = إلى الأمام في العالم
        input.run = clamped > 0.85;   // الدفع إلى الحافّة يُسرّع

        knobRef.current.style.transform =
            `translate(${nx * STICK_RADIUS}px, ${ny * STICK_RADIUS}px)`;
    };

    const onDown = (e) => {
        e.preventDefault();
        activeRef.current = e.pointerId;
        padRef.current.setPointerCapture(e.pointerId);
        onMove(e);
    };

    const onMove = (e) => {
        if (activeRef.current !== e.pointerId) return;
        const box = padRef.current.getBoundingClientRect();
        apply(e.clientX - (box.left + box.width / 2), e.clientY - (box.top + box.height / 2));
    };

    const onUp = (e) => {
        if (activeRef.current !== e.pointerId) return;
        activeRef.current = null;
        input.forward = 0;
        input.strafe = 0;
        input.run = false;
        knobRef.current.style.transform = 'translate(0px, 0px)';
        try { padRef.current.releasePointerCapture(e.pointerId); } catch { /* تُرك أصلاً */ }
    };

    return (
        <div
            className="we-stick"
            ref={padRef}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
        >
            <i className="we-stick-knob" ref={knobRef} />
        </div>
    );
};

export const WalkControls = ({ canvasRef, onExit, onFlash, bare = false }) => {
    const [locked, setLocked] = useState(false);
    const [touch] = useState(isCoarse);
    const lookRef = useRef(null);

    // ── لوحة المفاتيح ──
    useEffect(() => {
        // مفتاحان متضادّان مضغوطان معاً يجب أن يُلغي أحدهما الآخر،
        // فنتتبّع المضغوط فعلاً بدل جمع الإشارات
        const held = new Set();

        const recompute = () => {
            let forward = 0;
            let strafe = 0;
            held.forEach(code => {
                const [axis, sign] = KEYS[code];
                if (axis === 'forward') forward += sign;
                else strafe += sign;
            });
            input.forward = Math.sign(forward);
            input.strafe = Math.sign(strafe);
        };

        const onDown = (e) => {
            if (/^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
            if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.run = true;
            if (!KEYS[e.code]) return;
            e.preventDefault();
            held.add(e.code);
            recompute();
        };

        const onUp = (e) => {
            if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.run = false;
            if (!KEYS[e.code]) return;
            held.delete(e.code);
            recompute();
        };

        // التبديل إلى نافذة أخرى يترك المفاتيح «مضغوطة» إلى الأبد
        const onBlur = () => { held.clear(); resetInput(); };

        window.addEventListener('keydown', onDown);
        window.addEventListener('keyup', onUp);
        window.addEventListener('blur', onBlur);

        return () => {
            window.removeEventListener('keydown', onDown);
            window.removeEventListener('keyup', onUp);
            window.removeEventListener('blur', onBlur);
            resetInput();
        };
    }, []);

    // ── تثبيت المؤشّر والنظر بالفأرة ──
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || touch) return undefined;

        const onMove = (e) => {
            if (document.pointerLockElement !== canvas) return;
            input.yaw += e.movementX * LOOK_SPEED;
            input.pitch += e.movementY * LOOK_SPEED;
        };

        const onLockChange = () => {
            const now = document.pointerLockElement === canvas;
            setLocked(now);
            if (!now) resetInput();
        };

        const onClick = () => {
            if (document.pointerLockElement === canvas) return;
            canvas.requestPointerLock?.();
        };

        const onLockError = () => onFlash?.('المتصفّح منع تثبيت المؤشّر — استخدم الأسهم للنظر', 'err');

        canvas.addEventListener('click', onClick);
        document.addEventListener('pointerlockchange', onLockChange);
        document.addEventListener('pointerlockerror', onLockError);
        document.addEventListener('mousemove', onMove);

        return () => {
            canvas.removeEventListener('click', onClick);
            document.removeEventListener('pointerlockchange', onLockChange);
            document.removeEventListener('pointerlockerror', onLockError);
            document.removeEventListener('mousemove', onMove);
            if (document.pointerLockElement === canvas) document.exitPointerLock?.();
        };
    }, [canvasRef, touch, onFlash]);

    // ── النظر بالسحب على اللمس ──
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !touch) return undefined;

        let id = null;
        let last = null;

        const down = (e) => {
            if (id !== null) return;
            id = e.pointerId;
            last = { x: e.clientX, y: e.clientY };
        };

        const move = (e) => {
            if (e.pointerId !== id || !last) return;
            input.yaw += (e.clientX - last.x) * TOUCH_LOOK_SPEED;
            input.pitch += (e.clientY - last.y) * TOUCH_LOOK_SPEED;
            last = { x: e.clientX, y: e.clientY };
        };

        const up = (e) => {
            if (e.pointerId !== id) return;
            id = null;
            last = null;
        };

        canvas.addEventListener('pointerdown', down);
        canvas.addEventListener('pointermove', move);
        canvas.addEventListener('pointerup', up);
        canvas.addEventListener('pointercancel', up);

        return () => {
            canvas.removeEventListener('pointerdown', down);
            canvas.removeEventListener('pointermove', move);
            canvas.removeEventListener('pointerup', up);
            canvas.removeEventListener('pointercancel', up);
        };
    }, [canvasRef, touch]);

    return (
        <>
            {/* الصليب لمنظور الشخص الأوّل: في الشخص الثالث لا تُصوّب
                إلى ما في منتصف الشاشة، فوجوده يُضلّل */}
            {!bare && (
                <div className="we-cross" aria-hidden="true" ref={lookRef}>
                    <i /><i />
                </div>
            )}

            {touch && <Joystick />}

            {!touch && !locked && (
                <div className={bare ? 'gw-lockhint' : 'we-walkhint'}>
                    <b>{bare ? 'انقر لتسير في العالم' : 'انقر المشهد للسير فيه'}</b>
                    <span>W A S D للحركة · Shift للركض · E للركوب · الفأرة للنظر</span>
                    {!bare && <button onClick={onExit}>عُد إلى التحرير</button>}
                </div>
            )}

            {touch && !bare && (
                <button className="we-walkexit" onClick={onExit}>خروج من المشي</button>
            )}
        </>
    );
};

/* ============================================================
   القيادة

   نفس المفاتيح ونفس العصا، بمعنى مختلف: W/S خانق وفرامل،
   A/D مقود، والمسافة فرملة يد. ولا تثبيت للمؤشّر هنا — الكاميرا
   تتبع السيارة، فالنظر ليس بيد اللاعب.
   ============================================================ */

/** عدّاد السرعة — يقرأ من كائن خارج React، فلا يُعاد رسم شيء */
const Speedometer = () => {
    const readRef = useRef(null);
    const gearRef = useRef(null);
    const gripRef = useRef(null);

    useEffect(() => {
        let raf = 0;
        const tick = () => {
            if (readRef.current) readRef.current.textContent = Math.round(drive.speed);
            if (gearRef.current) gearRef.current.textContent = drive.gear;
            if (gripRef.current) gripRef.current.textContent = `${drive.onGround}/4`;
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, []);

    return (
        <div className="we-speedo">
            <b ref={readRef}>0</b>
            <span>كم/س</span>
            <i ref={gearRef}>ط</i>
            <u ref={gripRef}>0/4</u>
        </div>
    );
};

export const DriveControls = ({ onExit }) => {
    const [touch] = useState(isCoarse);

    useEffect(() => {
        const held = new Set();

        const recompute = () => {
            let forward = 0;
            let strafe = 0;
            held.forEach(code => {
                const [axis, sign] = KEYS[code];
                if (axis === 'forward') forward += sign;
                else strafe += sign;
            });
            input.forward = Math.sign(forward);
            input.strafe = Math.sign(strafe);
        };

        const onDown = (e) => {
            if (/^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
            if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.run = true;
            if (e.code === 'Space') { e.preventDefault(); input.brake = true; }
            if (!KEYS[e.code]) return;
            e.preventDefault();
            held.add(e.code);
            recompute();
        };

        const onUp = (e) => {
            if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.run = false;
            if (e.code === 'Space') input.brake = false;
            if (!KEYS[e.code]) return;
            held.delete(e.code);
            recompute();
        };

        const onBlur = () => { held.clear(); resetInput(); };

        window.addEventListener('keydown', onDown);
        window.addEventListener('keyup', onUp);
        window.addEventListener('blur', onBlur);

        return () => {
            window.removeEventListener('keydown', onDown);
            window.removeEventListener('keyup', onUp);
            window.removeEventListener('blur', onBlur);
            resetInput();
        };
    }, []);

    return (
        <>
            <Speedometer />

            {touch && (
                <>
                    <Joystick />
                    <button
                        className="we-brake"
                        onPointerDown={() => { input.brake = true; }}
                        onPointerUp={() => { input.brake = false; }}
                        onPointerLeave={() => { input.brake = false; }}
                    >
                        فرملة
                    </button>
                </>
            )}

            <button className="we-walkexit" onClick={onExit}>خروج من القيادة</button>

            {!touch && (
                <p className="we-drivehint">
                    W خانق · S رجوع وفرملة · A / D مقود · Shift تسارع · مسافة فرملة يد
                </p>
            )}
        </>
    );
};

export default WalkControls;
