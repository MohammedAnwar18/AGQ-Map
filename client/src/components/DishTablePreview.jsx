import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { getImageUrl } from '../services/api';
import { cartService } from '../services/cartService';
import './DishTablePreview.css';

/* ============================================================
   معاينة الطبق على الطاولة — واقعية خفيفة بلا ملفات ثلاثية الأبعاد
   • كاميرا الجهاز الخلفية كخلفية حيّة
   • صورة الطبق تُسقط بمنظور (rotateX) مع ظل بيضاوي يتبع الحجم والميل
   • لمس: إصبع = تحريك | إصبعان = تكبير وتدوير
   • قائمة جانبية زجاجية لاختيار الطبق، ولوحة تفاصيل بالمكوّنات
     والسعر والأحجام والإضافات
   ============================================================ */

// حدود التحكّم — تمنع الطبق من الاختفاء أو الانقلاب
const SCALE_MIN = 0.35;
const SCALE_MAX = 2.6;
const TILT_MIN = 0;    // مواجه للكاميرا
const TILT_MAX = 78;   // شبه مسطّح على الطاولة
const TILT_DEFAULT = 58;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const formatPrice = (value) => {
    const n = parseFloat(value);
    if (Number.isNaN(n)) return null;
    return `${n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)} ₪`;
};

// ── أيقونات ──────────────────────────────────────────────────
const Icon = {
    Close: (p) => (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" {...p}>
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
    ),
    Reset: (p) => (
        <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
            <path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><polyline points="3 3 3 8 8 8" />
        </svg>
    ),
    Info: (p) => (
        <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="11" /><circle cx="12" cy="8" r=".6" fill="currentColor" />
        </svg>
    ),
    Cart: (p) => (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
            <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
        </svg>
    ),
    Camera: (p) => (
        <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}>
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
        </svg>
    ),
    Chevron: (p) => (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
            <polyline points="9 18 15 12 9 6" />
        </svg>
    )
};

/* طبق تجريبي مرسوم بالكامل كـ SVG — يعمل بلا إنترنت ولا ملفات،
   ويظهر عندما لا يملك المطعم صور أطباق مفرغة بعد. */
const SAMPLE_DISH = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
  <defs>
    <radialGradient id="plate" cx="42%" cy="34%" r="72%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="62%" stop-color="#f1f3f6"/>
      <stop offset="100%" stop-color="#cfd5de"/>
    </radialGradient>
    <radialGradient id="well" cx="44%" cy="36%" r="70%">
      <stop offset="0%" stop-color="#fbfcfd"/>
      <stop offset="100%" stop-color="#e3e8ee"/>
    </radialGradient>
    <linearGradient id="patty" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#a45b2a"/>
      <stop offset="100%" stop-color="#6d3616"/>
    </linearGradient>
    <linearGradient id="fry" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f6c453"/>
      <stop offset="100%" stop-color="#d99a24"/>
    </linearGradient>
  </defs>

  <ellipse cx="200" cy="212" rx="178" ry="168" fill="url(#plate)"/>
  <ellipse cx="200" cy="208" rx="140" ry="132" fill="url(#well)"/>
  <ellipse cx="200" cy="208" rx="140" ry="132" fill="none" stroke="#dfe4ea" stroke-width="2"/>

  <ellipse cx="176" cy="228" rx="86" ry="70" fill="#00000018"/>
  <ellipse cx="176" cy="214" rx="84" ry="66" fill="url(#patty)"/>
  <ellipse cx="176" cy="200" rx="80" ry="60" fill="#c9772f"/>
  <ellipse cx="176" cy="192" rx="76" ry="54" fill="#5f9e3a"/>
  <ellipse cx="176" cy="184" rx="70" ry="48" fill="#f3e2b8"/>
  <ellipse cx="176" cy="176" rx="72" ry="50" fill="#e0b978"/>
  <path d="M104 176a72 50 0 0 1 144 0Z" fill="#f0cf92"/>
  <circle cx="150" cy="150" r="4" fill="#d9b273"/>
  <circle cx="184" cy="141" r="4" fill="#d9b273"/>
  <circle cx="212" cy="156" r="4" fill="#d9b273"/>

  <g transform="rotate(-18 300 240)">
    <rect x="272" y="176" width="17" height="86" rx="7" fill="url(#fry)"/>
    <rect x="294" y="188" width="17" height="80" rx="7" fill="url(#fry)"/>
    <rect x="316" y="176" width="17" height="88" rx="7" fill="url(#fry)"/>
  </g>
  <ellipse cx="300" cy="268" rx="46" ry="14" fill="#00000014"/>
</svg>`)}`;

// ============================================================
const DishTablePreview = ({ shop, products = [], onClose }) => {
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const stageRef = useRef(null);
    const gestureRef = useRef(null);

    const [cameraState, setCameraState] = useState('starting'); // starting | live | denied | unsupported
    const [menuOpen, setMenuOpen] = useState(true);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [added, setAdded] = useState(false);

    // وضعية الطبق على الطاولة
    const [pose, setPose] = useState({ x: 0, y: 60, scale: 1, spin: 0, tilt: TILT_DEFAULT });

    // ── الأطباق المتاحة ────────────────────────────────────────
    const dishes = useMemo(() => {
        const withImages = products.filter(p => (p.images?.length || p.image_url));
        const list = withImages.map(p => ({
            id: p.id,
            name: p.name,
            description: p.description,
            price: p.price,
            options: p.options || { sizes: [], extras: [] },
            image: getImageUrl(p.images?.[0] || p.image_url),
            sample: false
        }));

        // نضيف طبقاً تجريبياً دائماً ليجرّب الزائر المعاينة فوراً
        list.push({
            id: '__sample__',
            name: 'طبق تجريبي',
            description: 'نموذج لمعاينة الحجم والموضع على الطاولة قبل إضافة صور الأطباق.',
            price: null,
            options: { sizes: [], extras: [] },
            image: SAMPLE_DISH,
            sample: true
        });
        return list;
    }, [products]);

    const [activeId, setActiveId] = useState(dishes[0]?.id ?? null);
    const dish = dishes.find(d => d.id === activeId) || dishes[0];

    const [sizeIndex, setSizeIndex] = useState(0);
    const [extraKeys, setExtraKeys] = useState([]);

    // إن وصلت أطباق المطعم بعد فتح المعاينة ننتقل إليها، ما لم يكن
    // الزائر قد اختار طبقاً بنفسه فنحترم اختياره
    const userPickedRef = useRef(false);

    useEffect(() => {
        if (!dishes.length) return;
        const exists = dishes.some(d => d.id === activeId);
        const stuckOnSample = !userPickedRef.current && activeId === '__sample__' && dishes.length > 1;
        if (!exists || stuckOnSample) setActiveId(dishes[0].id);
    }, [dishes, activeId]);

    // ── الكاميرا ───────────────────────────────────────────────
    useEffect(() => {
        let cancelled = false;

        const start = async () => {
            if (!navigator.mediaDevices?.getUserMedia) {
                setCameraState('unsupported');
                return;
            }
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
                    audio: false
                });
                if (cancelled) {
                    stream.getTracks().forEach(t => t.stop());
                    return;
                }
                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    await videoRef.current.play().catch(() => {});
                }
                setCameraState('live');
            } catch (e) {
                if (!cancelled) setCameraState(e?.name === 'NotAllowedError' ? 'denied' : 'unsupported');
            }
        };

        start();
        document.body.style.overflow = 'hidden';

        return () => {
            cancelled = true;
            streamRef.current?.getTracks().forEach(t => t.stop());
            streamRef.current = null;
            document.body.style.overflow = '';
        };
    }, []);

    // ── اللمس: إصبع يحرّك، إصبعان يكبّران ويُديران ─────────────
    const pointFrom = (touches) => {
        const [a, b] = touches;
        return {
            x: (a.clientX + b.clientX) / 2,
            y: (a.clientY + b.clientY) / 2,
            dist: Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY),
            angle: (Math.atan2(b.clientY - a.clientY, b.clientX - a.clientX) * 180) / Math.PI
        };
    };

    const onTouchStart = (e) => {
        if (e.touches.length === 1) {
            const t = e.touches[0];
            gestureRef.current = { mode: 'drag', x: t.clientX, y: t.clientY, start: { ...pose } };
        } else if (e.touches.length === 2) {
            gestureRef.current = { mode: 'pinch', ...pointFrom(e.touches), start: { ...pose } };
        }
    };

    const onTouchMove = (e) => {
        const g = gestureRef.current;
        if (!g) return;
        e.preventDefault();

        if (g.mode === 'drag' && e.touches.length === 1) {
            const t = e.touches[0];
            setPose(prev => ({
                ...prev,
                x: g.start.x + (t.clientX - g.x),
                y: g.start.y + (t.clientY - g.y)
            }));
            return;
        }

        if (g.mode === 'pinch' && e.touches.length === 2) {
            const now = pointFrom(e.touches);
            setPose(prev => ({
                ...prev,
                scale: clamp(g.start.scale * (now.dist / (g.dist || 1)), SCALE_MIN, SCALE_MAX),
                spin: g.start.spin + (now.angle - g.angle),
                x: g.start.x + (now.x - g.x),
                y: g.start.y + (now.y - g.y)
            }));
        }
    };

    const onTouchEnd = (e) => {
        if (e.touches.length === 0) gestureRef.current = null;
        else if (e.touches.length === 1) {
            const t = e.touches[0];
            gestureRef.current = { mode: 'drag', x: t.clientX, y: t.clientY, start: { ...pose } };
        }
    };

    // الفأرة على الحاسوب: سحب + عجلة للتكبير
    const onMouseDown = (e) => {
        gestureRef.current = { mode: 'drag', x: e.clientX, y: e.clientY, start: { ...pose } };
    };

    const onMouseMove = (e) => {
        const g = gestureRef.current;
        if (g?.mode !== 'drag') return;
        setPose(prev => ({ ...prev, x: g.start.x + (e.clientX - g.x), y: g.start.y + (e.clientY - g.y) }));
    };

    const onMouseUp = () => { gestureRef.current = null; };

    const onWheel = useCallback((e) => {
        e.preventDefault();
        setPose(prev => ({ ...prev, scale: clamp(prev.scale * (e.deltaY > 0 ? 0.94 : 1.06), SCALE_MIN, SCALE_MAX) }));
    }, []);

    useEffect(() => {
        const stage = stageRef.current;
        if (!stage) return;
        stage.addEventListener('wheel', onWheel, { passive: false });
        return () => stage.removeEventListener('wheel', onWheel);
    }, [onWheel]);

    const resetPose = () => setPose({ x: 0, y: 60, scale: 1, spin: 0, tilt: TILT_DEFAULT });

    const pickDish = (id) => {
        userPickedRef.current = true;
        setActiveId(id);
        setSizeIndex(0);
        setExtraKeys([]);
        setAdded(false);
    };

    // ── السعر بعد الحجم والإضافات ──────────────────────────────
    const sizes = dish?.options?.sizes || [];
    const extras = dish?.options?.extras || [];
    const activeSize = sizes[sizeIndex] || null;

    const totalPrice = useMemo(() => {
        const base = activeSize?.price ?? parseFloat(dish?.price);
        if (Number.isNaN(base) || base === null || base === undefined) return null;
        const extrasTotal = extraKeys.reduce((sum, label) => {
            const found = extras.find(x => x.label === label);
            return sum + (parseFloat(found?.price) || 0);
        }, 0);
        return base + extrasTotal;
    }, [dish, activeSize, extraKeys, extras]);

    const toggleExtra = (label) => {
        setExtraKeys(prev => (prev.includes(label) ? prev.filter(x => x !== label) : [...prev, label]));
        setAdded(false);
    };

    const addToCart = () => {
        if (!dish || dish.sample) return;
        const parts = [activeSize?.label, ...extraKeys].filter(Boolean);
        cartService.addItem({
            id: parts.length ? `${dish.id}::${parts.join('+')}` : dish.id,
            name: parts.length ? `${dish.name} (${parts.join('، ')})` : dish.name,
            price: totalPrice ?? 0,
            image_url: dish.image,
            shop_id: shop?.id,
            shop_name: shop?.name
        });
        setAdded(true);
        setTimeout(() => setAdded(false), 2200);
    };

    // الظل يتبع الحجم والميل: كلّما استلقى الطبق اتّسع ظلّه ونعم
    const shadowStyle = {
        transform: `translate(-50%, -50%) translate(${pose.x}px, ${pose.y + pose.scale * 74}px) scale(${pose.scale * (0.62 + (pose.tilt / TILT_MAX) * 0.7)}, ${pose.scale * (0.16 + (pose.tilt / TILT_MAX) * 0.34)})`,
        opacity: 0.28 + (pose.tilt / TILT_MAX) * 0.34
    };

    const dishStyle = {
        transform: `translate(-50%, -50%) translate(${pose.x}px, ${pose.y}px) rotateX(${pose.tilt}deg) rotate(${pose.spin}deg) scale(${pose.scale})`
    };

    return (
        <div className="dtp" dir="rtl">

            {/* ── الكاميرا ── */}
            <video ref={videoRef} className="dtp-video" playsInline muted autoPlay />

            {cameraState !== 'live' && (
                <div className="dtp-fallback">
                    <div className="dtp-fallback-inner">
                        <span className="dtp-fallback-icon"><Icon.Camera /></span>
                        <h3>
                            {cameraState === 'starting' && 'جاري تشغيل الكاميرا…'}
                            {cameraState === 'denied' && 'الكاميرا غير مسموحة'}
                            {cameraState === 'unsupported' && 'الكاميرا غير متاحة'}
                        </h3>
                        {cameraState !== 'starting' && (
                            <p>
                                {cameraState === 'denied'
                                    ? 'اسمح بالوصول إلى الكاميرا من إعدادات المتصفح لترى الطبق على طاولتك.'
                                    : 'جهازك أو متصفحك لا يدعم الكاميرا هنا.'}
                                {' '}يمكنك متابعة المعاينة على خلفية طاولة تجريبية.
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* ── مسرح الإسقاط ── */}
            <div
                className="dtp-stage"
                ref={stageRef}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseUp}
            >
                {dish && (
                    <>
                        <span className="dtp-shadow" style={shadowStyle} />
                        <img
                            className="dtp-dish"
                            src={dish.image}
                            alt={dish.name}
                            style={dishStyle}
                            draggable={false}
                        />
                    </>
                )}
            </div>

            {/* ── الشريط العلوي ── */}
            <header className="dtp-top">
                <button className="dtp-icon" onClick={onClose} aria-label="إغلاق"><Icon.Close /></button>

                <div className="dtp-title">
                    <b>معاينة على الطاولة</b>
                    <span>{shop?.name}</span>
                </div>

                <button className="dtp-icon" onClick={resetPose} title="إعادة الضبط" aria-label="إعادة الضبط">
                    <Icon.Reset />
                </button>
            </header>

            {/* ── تلميح الاستخدام ── */}
            <div className="dtp-hint">
                وجّه الكاميرا نحو الطاولة • إصبع لتحريك الطبق • إصبعان للتكبير والتدوير
            </div>

            {/* ── شريط الميل ── */}
            <div className="dtp-tilt">
                <span>المنظور</span>
                <input
                    type="range"
                    min={TILT_MIN}
                    max={TILT_MAX}
                    value={pose.tilt}
                    onChange={(e) => setPose(prev => ({ ...prev, tilt: parseInt(e.target.value, 10) }))}
                    aria-label="زاوية المنظور"
                />
            </div>

            {/* ── قائمة الأطباق الجانبية ── */}
            <aside className={`dtp-menu ${menuOpen ? 'is-open' : ''}`}>
                <button
                    className="dtp-menu-toggle"
                    onClick={() => setMenuOpen(o => !o)}
                    aria-label={menuOpen ? 'إخفاء القائمة' : 'إظهار القائمة'}
                >
                    <Icon.Chevron style={{ transform: menuOpen ? 'rotate(180deg)' : 'none' }} />
                </button>

                <div className="dtp-menu-list">
                    {dishes.map(d => (
                        <button
                            key={d.id}
                            className={`dtp-menu-item ${d.id === activeId ? 'is-active' : ''}`}
                            onClick={() => pickDish(d.id)}
                            title={d.name}
                        >
                            <img src={d.image} alt="" loading="lazy" />
                            <span>{d.name}</span>
                        </button>
                    ))}
                </div>
            </aside>

            {/* ── اللوحة الزجاجية ── */}
            {dish && (
                <section className={`dtp-glass ${detailsOpen ? 'is-open' : ''}`}>
                    <button className="dtp-glass-grip" onClick={() => setDetailsOpen(o => !o)}>
                        <span className="dtp-grip-bar" />
                    </button>

                    <div className="dtp-glass-head">
                        <div className="dtp-glass-title">
                            <h3>{dish.name}</h3>
                            {dish.sample
                                ? <span className="dtp-badge">نموذج للمعاينة</span>
                                : (totalPrice !== null && <span className="dtp-price">{formatPrice(totalPrice)}</span>)}
                        </div>

                        <button
                            className="dtp-icon dtp-icon-sm"
                            onClick={() => setDetailsOpen(o => !o)}
                            aria-label="التفاصيل"
                        >
                            <Icon.Info />
                        </button>
                    </div>

                    <div className="dtp-glass-body">
                        {dish.description && (
                            <div className="dtp-block">
                                <h4>المكوّنات</h4>
                                <p>{dish.description}</p>
                            </div>
                        )}

                        {sizes.length > 0 && (
                            <div className="dtp-block">
                                <h4>الحجم</h4>
                                <div className="dtp-chips">
                                    {sizes.map((size, i) => (
                                        <button
                                            key={size.label}
                                            className={`dtp-chip ${i === sizeIndex ? 'is-on' : ''}`}
                                            onClick={() => { setSizeIndex(i); setAdded(false); }}
                                        >
                                            {size.label}
                                            {size.price !== null && <b>{formatPrice(size.price)}</b>}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {extras.length > 0 && (
                            <div className="dtp-block">
                                <h4>الإضافات</h4>
                                <div className="dtp-chips">
                                    {extras.map(extra => (
                                        <button
                                            key={extra.label}
                                            className={`dtp-chip ${extraKeys.includes(extra.label) ? 'is-on' : ''}`}
                                            onClick={() => toggleExtra(extra.label)}
                                        >
                                            {extra.label}
                                            {extra.price !== null && <b>+{formatPrice(extra.price)}</b>}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {!dish.description && sizes.length === 0 && extras.length === 0 && !dish.sample && (
                            <p className="dtp-muted">لم يضِف المطعم تفاصيل هذا الطبق بعد.</p>
                        )}

                        {dish.sample && (
                            <p className="dtp-muted">
                                هذا طبق تجريبي مرسوم داخل التطبيق. أضف صور أطباق مفرغة الخلفية (PNG أو WebP)
                                من صفحة المحل لتظهر هنا بنفس الواقعية.
                            </p>
                        )}
                    </div>

                    {!dish.sample && (
                        <button className={`dtp-order ${added ? 'is-done' : ''}`} onClick={addToCart}>
                            <Icon.Cart />
                            {added ? 'أُضيف إلى السلة' : 'إضافة إلى السلة'}
                            {totalPrice !== null && !added && <b>{formatPrice(totalPrice)}</b>}
                        </button>
                    )}
                </section>
            )}
        </div>
    );
};

export default DishTablePreview;
