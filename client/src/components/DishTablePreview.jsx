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
    Dish: (p) => (
        <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
            <path d="M2.5 20h19" />
            <path d="M4 16.5h16" />
            <path d="M4.4 16.5a7.6 7.6 0 0 1 15.2 0" />
            <path d="M12 6.2V8.9" />
            <circle cx="12" cy="5" r="1.3" />
        </svg>
    ),
    Chevron: (p) => (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
            <polyline points="9 18 15 12 9 6" />
        </svg>
    )
};

// ============================================================
const DishTablePreview = ({ shop, products = [], isAdmin = false, onClose }) => {
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const stageRef = useRef(null);
    const gestureRef = useRef(null);

    const [cameraState, setCameraState] = useState('starting'); // starting | live | denied | unsupported
    const [menuOpen, setMenuOpen] = useState(true);
    const [detailsOpen, setDetailsOpen] = useState(true);
    const [added, setAdded] = useState(false);

    // وضعية الطبق على الطاولة
    const [pose, setPose] = useState({ x: 0, y: 60, scale: 1, spin: 0, tilt: TILT_DEFAULT });

    // ── الأطباق المتاحة ────────────────────────────────────────
    // تُعرض الأطباق التي رفع لها المحل صورة مفرغة الخلفية فقط،
    // فصورة المنتج العادية تظهر كمستطيل على الطاولة ويفسد الإيهام
    const dishes = useMemo(() => products
        .filter(p => p.table_image_url)
        .map(p => ({
            id: p.id,
            name: p.name,
            description: p.description,
            price: p.price,
            options: p.options || { ingredients: [], sizes: [], extras: [] },
            image: getImageUrl(p.table_image_url)
        })), [products]);

    const [activeId, setActiveId] = useState(dishes[0]?.id ?? null);
    const dish = dishes.find(d => d.id === activeId) || dishes[0];

    const [sizeIndex, setSizeIndex] = useState(0);
    const [extraKeys, setExtraKeys] = useState([]);

    // إن وصلت الأطباق بعد فتح المعاينة نختار أوّلها
    useEffect(() => {
        if (!dishes.length) return;
        if (!dishes.some(d => d.id === activeId)) setActiveId(dishes[0].id);
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
        setActiveId(id);
        setSizeIndex(0);
        setExtraKeys([]);
        setAdded(false);
    };

    // ── السعر بعد الحجم والإضافات ──────────────────────────────
    const ingredients = dish?.options?.ingredients || [];
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
        if (!dish) return;
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
            {dishes.length > 0 && (
            <div className="dtp-hint">
                وجّه الكاميرا نحو الطاولة • إصبع لتحريك الطبق • إصبعان للتكبير والتدوير
            </div>
            )}

            {/* ── شريط الميل ── */}
            {dishes.length > 0 && (
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
            )}

            {/* ── لا توجد أطباق مهيّأة بعد ── */}
            {dishes.length === 0 && (
                <div className="dtp-empty">
                    <div className="dtp-empty-card">
                        <span className="dtp-empty-icon"><Icon.Dish /></span>
                        <h3>لا توجد أطباق مهيّأة للمعاينة</h3>
                        <p>
                            {isAdmin
                                ? 'افتح أي منتج من صفحة المحل واضغط تعديل، ثم ارفع «صورة الطبق للمعاينة على الطاولة» — صورة مفرغة الخلفية (PNG أو WebP) مصوّرة بزاوية ٤٥° تقريباً.'
                                : 'لم يجهّز هذا المطعم أطباقه للمعاينة بعد.'}
                        </p>
                        <button className="dtp-empty-btn" onClick={onClose}>رجوع إلى المحل</button>
                    </div>
                </div>
            )}

            {/* ── قائمة الأطباق الجانبية ── */}
            {dishes.length > 0 && (
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
            )}

            {/* ── اللوحة الزجاجية ── */}
            {dish && (
                <section className={`dtp-glass ${detailsOpen ? 'is-open' : ''}`}>
                    <button className="dtp-glass-grip" onClick={() => setDetailsOpen(o => !o)}>
                        <span className="dtp-grip-bar" />
                    </button>

                    <div className="dtp-glass-head">
                        <div className="dtp-glass-title">
                            <h3>{dish.name}</h3>
                            {activeSize?.label && <span className="dtp-badge">{activeSize.label}</span>}
                        </div>

                        <div className="dtp-glass-side">
                            {totalPrice !== null
                                ? <span className="dtp-price">{formatPrice(totalPrice)}</span>
                                : <span className="dtp-badge">السعر عند الطلب</span>}

                            <button
                                className="dtp-icon dtp-icon-sm"
                                onClick={() => setDetailsOpen(o => !o)}
                                aria-label={detailsOpen ? 'إخفاء التفاصيل' : 'عرض التفاصيل'}
                            >
                                <Icon.Info />
                            </button>
                        </div>
                    </div>

                    <div className="dtp-glass-body">
                        {ingredients.length > 0 && (
                            <div className="dtp-block">
                                <h4>المكوّنات</h4>
                                <div className="dtp-ings">
                                    {ingredients.map(item => (
                                        <span className="dtp-ing" key={item}>{item}</span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {dish.description && (
                            <div className="dtp-block">
                                <h4>عن الطبق</h4>
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

                        {!dish.description && !ingredients.length && sizes.length === 0 && extras.length === 0 && (
                            <p className="dtp-muted">لم يضِف المطعم تفاصيل هذا الطبق بعد.</p>
                        )}
                    </div>

                    <button className={`dtp-order ${added ? 'is-done' : ''}`} onClick={addToCart}>
                        <Icon.Cart />
                        {added ? 'أُضيف إلى السلة' : 'إضافة إلى السلة'}
                        {totalPrice !== null && !added && <b>{formatPrice(totalPrice)}</b>}
                    </button>
                </section>
            )}
        </div>
    );
};

export default DishTablePreview;
