import React, { useState, useRef, useEffect, useCallback } from 'react';

import { getImageUrl } from '../services/api';

/* ============================================================
   نكسس — الصورة المؤجّلة وعارض المنتج

   شيئان يعملان معاً:

     ‎LazyShot‎     لا تُحمَّل صورة قبل أن تقترب من الشاشة
     ‎NexusProduct‎ نافذة بحجم الشاشة فيها تكبير بالأصابع

   و‎loading="lazy"‎ وحده لم يكن كافياً: المتصفّحات تُحمّل ما في
   شاشتين أو ثلاث حولها، وعلى شبكة بطيئة هذا كل الشبكة. فنُؤجّل
   بأنفسنا، ونمنح هامشاً معقولاً كي تسبق الصورةُ الإصبعَ.
   ============================================================ */

/* الهامش: نصف شاشة قبل الظهور. أقلّ منه يُرى الإطار فارغاً لحظةً،
   وأكثر منه يعود إلى تحميل ما لا يُرى */
const AHEAD = '55% 0px';

/**
 * صورة لا تُطلب إلّا حين تقترب.
 *
 * والمراقب واحد لكل صورة لا مراقب للشبكة كلّها: المراقبُ الواحد
 * للشبكة يحتاج قائمةً تُحدَّث مع الفلترة والبحث، وهذا أبسط وأقلّ
 * عرضةً للخطأ — والمتصفّح يُجمّع المراقبات داخلياً.
 */
export const LazyShot = ({ src, alt, fallback, className = '' }) => {
    const holder = useRef(null);
    const [near, setNear] = useState(false);
    const [ready, setReady] = useState(false);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        if (near || !holder.current) return undefined;

        /*
         * بلا ‎IntersectionObserver‎ نُحمّل فوراً.
         *
         * متصفّح قديم يرى كل الصور، وهو أهون من متصفّح لا يرى شيئاً.
         */
        if (typeof IntersectionObserver === 'undefined') { setNear(true); return undefined; }

        const watcher = new IntersectionObserver((entries) => {
            if (entries.some(entry => entry.isIntersecting)) {
                setNear(true);
                watcher.disconnect();
            }
        }, { rootMargin: AHEAD });

        watcher.observe(holder.current);
        return () => watcher.disconnect();
    }, [near]);

    /* مصدر جديد لنفس الموضع: نُعيد الحالة وإلّا بقي القديم معروضاً */
    useEffect(() => { setReady(false); setFailed(false); }, [src]);

    const show = Boolean(src) && near && !failed;

    return (
        <span ref={holder} className={`nxs-shot ${className}`}>
            {show && (
                <img
                    src={src}
                    alt={alt || ''}
                    decoding="async"
                    loading="lazy"
                    onLoad={() => setReady(true)}
                    onError={() => setFailed(true)}
                    className={ready ? 'is-in' : ''}
                />
            )}

            {/* قبل الوصول وبعد الفشل: الحرف الأوّل لا مستطيل فارغ */}
            {(!show || !ready) && <span className="nxs-shot-ph">{fallback}</span>}
        </span>
    );
};

/* ============================================================
   عارض المنتج
   ============================================================ */

const MAX_ZOOM = 4;
const MIN_ZOOM = 1;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const spanOf = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * نافذة المنتج، وفيها تكبير.
 *
 * التكبير بمستمعي ‎pointer‎ لا بـ‎touch‎: مستمع واحد يخدم الإصبع
 * والفأرة والقلم، ويعمل على الحاسوب كما على الهاتف.
 *
 * وثلاث إيماءات: قرصة بإصبعين، نقرتان متتاليتان، وعجلة الفأرة.
 * والسحب يُزيح الصورة حين تكون مكبَّرة — وحين لا تكون، يُترك
 * للمتصفّح كي تُغلق النافذة بالسحب كما يتوقّع المستخدم.
 */
const NexusProduct = ({
    product, mine, canAdopt, onAdopt, onClose, priceOf
}) => {
    const image = getImageUrl(product.image_url);

    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });

    const stage = useRef(null);
    const pointers = useRef(new Map());
    const pinch = useRef(null);
    const lastTap = useRef(0);
    const dragged = useRef(false);

    const reset = useCallback(() => { setZoom(1); setPan({ x: 0, y: 0 }); }, []);

    /* الإغلاق بالمفتاح: نافذة بحجم الشاشة بلا مخرج بلوحة المفاتيح حبسٌ */
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape') onClose();
            if (e.key === '0') reset();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose, reset]);

    /*
     * حدّ الإزاحة.
     *
     * الصورة لا تُسحب خارج إطارها: الفراغ الأسود بجانب صورة مكبَّرة
     * يبدو عطباً. فالحدّ نصفُ ما زاد من الحجم بعد التكبير.
     */
    const hold = useCallback((next, scale) => {
        const box = stage.current?.getBoundingClientRect();
        if (!box) return { x: 0, y: 0 };

        const slackX = Math.max(0, (box.width * scale - box.width) / 2);
        const slackY = Math.max(0, (box.height * scale - box.height) / 2);

        return {
            x: clamp(next.x, -slackX, slackX),
            y: clamp(next.y, -slackY, slackY)
        };
    }, []);

    /** يُكبّر حول نقطة بعينها فتبقى تلك النقطة تحت الإصبع */
    const zoomAt = useCallback((factor, at) => {
        const box = stage.current?.getBoundingClientRect();
        if (!box) return;

        setZoom(prevZoom => {
            const next = clamp(prevZoom * factor, MIN_ZOOM, MAX_ZOOM);
            const real = next / prevZoom;

            if (next <= MIN_ZOOM + 1e-3) { setPan({ x: 0, y: 0 }); return MIN_ZOOM; }

            // الإزاحة تتبع الفرق بين مركز الإطار ونقطة التكبير
            const cx = at.x - (box.left + box.width / 2);
            const cy = at.y - (box.top + box.height / 2);

            setPan(prevPan => hold({
                x: cx - (cx - prevPan.x) * real,
                y: cy - (cy - prevPan.y) * real
            }, next));

            return next;
        });
    }, [hold]);

    // ── الأصابع ──

    const onDown = (e) => {
        if (!image) return;

        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        dragged.current = false;

        if (pointers.current.size === 2) {
            const [a, b] = [...pointers.current.values()];
            pinch.current = { span: spanOf(a, b), zoom };
        }

        // السحب يُمسك فقط حين تكون الصورة مكبَّرة
        if (zoom > 1 && e.currentTarget.setPointerCapture) {
            try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* لا شيء */ }
        }
    };

    const onMove = (e) => {
        if (!pointers.current.has(e.pointerId)) return;

        const before = pointers.current.get(e.pointerId);
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

        // قرصة بإصبعين
        if (pointers.current.size === 2 && pinch.current) {
            const [a, b] = [...pointers.current.values()];
            const span = spanOf(a, b);
            if (pinch.current.span > 0) {
                const want = clamp(pinch.current.zoom * (span / pinch.current.span), MIN_ZOOM, MAX_ZOOM);
                setZoom(want);
                setPan(prev => hold(prev, want));
                dragged.current = true;
            }
            return;
        }

        // سحب بإصبع واحد — ولا يُزاح إلّا ما زاد عن الإطار
        if (pointers.current.size === 1 && zoom > 1) {
            const dx = e.clientX - before.x;
            const dy = e.clientY - before.y;
            if (Math.abs(dx) + Math.abs(dy) > 1) dragged.current = true;
            setPan(prev => hold({ x: prev.x + dx, y: prev.y + dy }, zoom));
        }
    };

    const onUp = (e) => {
        pointers.current.delete(e.pointerId);
        if (pointers.current.size < 2) pinch.current = null;

        if (!image || dragged.current) return;

        // نقرتان: تكبير إلى ٢٫٥ أو رجوع إلى الأصل
        const now = Date.now();
        if (now - lastTap.current < 300) {
            lastTap.current = 0;
            if (zoom > 1 + 1e-3) reset();
            else zoomAt(2.5, { x: e.clientX, y: e.clientY });
            return;
        }
        lastTap.current = now;
    };

    const onWheel = (e) => {
        if (!image) return;
        e.preventDefault();
        zoomAt(e.deltaY < 0 ? 1.18 : 1 / 1.18, { x: e.clientX, y: e.clientY });
    };

    const zoomed = zoom > 1 + 1e-3;
    const tag = priceOf(product.price);

    return (
        <div className="nxp" role="dialog" aria-label={product.name}>
            <header className="nxp-top">
                <button className="nxp-x" onClick={onClose} aria-label="إغلاق">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                        <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                </button>

                <b>{product.name}</b>

                {zoomed && (
                    <button className="nxp-reset" onClick={reset}>
                        {zoom.toFixed(1)}× · أعِد
                    </button>
                )}
            </header>

            {/*
              * مسرح الصورة.
              *
              * ‎touch-action‎ يتغيّر مع التكبير: ‎none‎ حين تكون مكبَّرة
              * فيملك السحبَ كودُنا، و‎pinch-zoom‎ حين لا تكون فيبقى سحب
              * الصفحة للمتصفّح.
              */}
            <div
                className={`nxp-stage${zoomed ? ' is-zoomed' : ''}`}
                ref={stage}
                onPointerDown={onDown}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerCancel={onUp}
                onWheel={onWheel}
                style={{ touchAction: zoomed ? 'none' : 'pinch-zoom' }}
            >
                {image ? (
                    <img
                        src={image}
                        alt={product.name}
                        draggable="false"
                        style={{
                            transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
                            transition: pointers.current.size ? 'none' : 'transform .18s ease-out'
                        }}
                    />
                ) : (
                    <span className="nxp-noimg">{product.name.trim().charAt(0) || '؟'}</span>
                )}
            </div>

            <div className="nxp-foot">
                <div className="nxp-facts">
                    {tag && <b className="nxp-price">{tag}</b>}
                    {product.category_name && <span className="nxp-cat">{product.category_name}</span>}
                    {mine && <span className="nxp-have">عندك ✓</span>}
                </div>

                {product.description && <p className="nxp-note">{product.description}</p>}

                {image && (
                    <span className="nxp-hint">
                        قرصة بإصبعين أو نقرتان للتكبير — وحتى {MAX_ZOOM}×.
                    </span>
                )}

                {canAdopt && (
                    <button
                        className="nxp-add"
                        onClick={() => { onClose(); onAdopt(product); }}
                    >
                        {mine ? 'أضفه مرّة أخرى لمحلّي' : 'أضفه لمحلّي'}
                    </button>
                )}
            </div>
        </div>
    );
};

export default NexusProduct;
