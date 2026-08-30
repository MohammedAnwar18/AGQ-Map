import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { smartSearchService, getImageUrl } from '../services/api';
import './AIAssistant.css';

/* ============================================================
   المساعد الذكي — دليل المحلات والمنتجات
   • البحث في وسط الشاشة، ثم يصعد للأعلى عند ظهور النتائج
   • بطاقات كبيرة بصورة واضحة للمنتج أو المحل
   • النتائج مرتّبة من الأقرب إليك إلى الأبعد
   ============================================================ */

const SUGGESTIONS = ['قهوة', 'مطعم', 'صيدلية', 'سوبرماركت', 'حلويات', 'ملابس', 'مخبز', 'صيانة'];

// المسافة التي نعتبرها "قريبة" فتُبرز بلون مختلف
const NEAR_METERS = 1000;

// ── أيقونات ──────────────────────────────────────────────────
const Icon = {
    Close: (p) => (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" {...p}>
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
    ),
    Search: (p) => (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" {...p}>
            <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.7" y2="16.7" />
        </svg>
    ),
    Send: (p) => (
        <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}>
            <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
    ),
    Pin: (p) => (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
        </svg>
    ),
    Store: (p) => (
        <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}>
            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
    ),
    Route: (p) => (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
            <polyline points="15 18 9 12 15 6" />
        </svg>
    ),
    Near: (p) => (
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}>
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="2.6" />
        </svg>
    ),
    Car: (p) => (
        <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}>
            <path d="M5 17h14M5 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm18 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z" />
            <path d="M3 17v-4l2-5h14l2 5v4" /><line x1="6" y1="13" x2="18" y2="13" />
        </svg>
    ),
    Walk: (p) => (
        <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}>
            <circle cx="13" cy="4" r="2" /><path d="m9 21 2-6 3-2-1-5" />
            <path d="m13 8 3 2 2 4" /><path d="m11 15-2 2-3 1" />
        </svg>
    ),
    Empty: (p) => (
        <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
            <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.7" y2="16.7" />
        </svg>
    )
};

// ── المسافة ──────────────────────────────────────────────────
const distanceMeters = (lat1, lon1, lat2, lon2) => {
    if ([lat1, lon1, lat2, lon2].some(v => v === null || v === undefined || Number.isNaN(Number(v)))) return null;
    const R = 6371000;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const formatDistance = (meters) => {
    if (meters === null) return null;
    if (meters < 1000) return `${Math.round(meters)} م`;
    return `${(meters / 1000).toFixed(meters < 10000 ? 1 : 0)} كم`;
};

const formatPrice = (value) => {
    const n = parseFloat(value);
    if (Number.isNaN(n)) return null;
    return `${n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)} ₪`;
};

const CATEGORY_EMOJI = {
    'مطعم': '🍽️', 'Restaurant': '🍽️', 'كافيه': '☕', 'Cafe': '☕',
    'صيدلية': '💊', 'سوبرماركت': '🛒', 'سوبر ماركت': '🛒', 'مخبز': '🥖',
    'ملابس': '👕', 'بنك': '🏦', 'مستشفى': '🏥', 'مدرسة': '🏫',
    'جامعة': '🎓', 'مسجد': '🕌', 'كنيسة': '⛪', 'حديقة': '🌳', 'ملعب': '⚽'
};

// ── بطاقة نتيجة كبيرة ────────────────────────────────────────
const ResultCard = ({
    image, emoji, initial, distance,
    shopName, shopImage, shopInitial,
    title, subtitle, price, tag, onClick
}) => {
    const distLabel = formatDistance(distance);
    const isNear = distance !== null && distance <= NEAR_METERS;

    return (
        <button className="aia-card" onClick={onClick}>
            <div className="aia-media">
                {image
                    ? <img src={image} alt="" loading="lazy" />
                    : (emoji
                        ? <span className="aia-emoji">{emoji}</span>
                        : <span className="aia-initial">{initial}</span>)}

                {distLabel && (
                    <span className={`aia-dist ${isNear ? 'is-near' : ''}`}>
                        <Icon.Near /> {distLabel}
                    </span>
                )}

                {shopName && (
                    <span className="aia-shopbadge">
                        <i>{shopImage ? <img src={shopImage} alt="" loading="lazy" /> : shopInitial}</i>
                        <b>{shopName}</b>
                    </span>
                )}
            </div>

            <div className="aia-cardbody">
                <h4 className="aia-title">{title}</h4>
                {subtitle && <span className="aia-sub">{subtitle}</span>}

                <div className="aia-cardfoot">
                    {price
                        ? <span className="aia-price">{price}</span>
                        : (tag ? <span className={`aia-tag ${tag.kind ? `is-${tag.kind}` : ''}`}>{tag.label}</span> : <span />)}
                    <span className="aia-cta"><Icon.Route /></span>
                </div>
            </div>
        </button>
    );
};

// ============================================================
const AIAssistant = ({ onClose, userLocation, onNavigate, onShopClick, onRequestLocation }) => {
    const [query, setQuery] = useState('');
    const [submitted, setSubmitted] = useState('');
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState(null); // null = لم يبحث بعد
    const [error, setError] = useState(null);
    const [target, setTarget] = useState(null);

    const inputRef = useRef(null);
    const requestIdRef = useRef(0);

    // قبل أول بحث: البحث في وسط الشاشة. بعده: يصعد للأعلى
    const isActive = loading || results !== null;

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        const t = setTimeout(() => inputRef.current?.focus(), 280);
        return () => { document.body.style.overflow = ''; clearTimeout(t); };
    }, []);

    // ── البحث ──────────────────────────────────────────────────
    const runSearch = useCallback(async (raw) => {
        const text = (raw ?? query).trim();
        if (!text) return;

        const id = ++requestIdRef.current;
        setSubmitted(text);
        setLoading(true);
        setError(null);

        try {
            const data = await smartSearchService.search({ query: text });
            if (id !== requestIdRef.current) return; // نتيجة قديمة
            setResults(Array.isArray(data?.results) ? data.results : []);
        } catch (e) {
            if (id !== requestIdRef.current) return;
            console.error('AI search error:', e);
            setError('تعذّر إتمام البحث. تحقّق من اتصالك وحاول مجدداً.');
            setResults([]);
        } finally {
            if (id === requestIdRef.current) setLoading(false);
        }
    }, [query]);

    const pickSuggestion = (text) => {
        setQuery(text);
        runSearch(text);
    };

    const resetSearch = () => {
        requestIdRef.current++;
        setResults(null);
        setError(null);
        setSubmitted('');
        setQuery('');
        setTimeout(() => inputRef.current?.focus(), 60);
    };

    // ── ترتيب النتائج: الأقرب أولاً ────────────────────────────
    const withDistance = useCallback((lat, lon) => {
        if (!userLocation) return null;
        return distanceMeters(
            parseFloat(userLocation.latitude), parseFloat(userLocation.longitude),
            parseFloat(lat), parseFloat(lon)
        );
    }, [userLocation]);

    const { productHits, placeHits } = useMemo(() => {
        if (!results) return { productHits: [], placeHits: [] };

        const products = [];
        const places = [];

        for (const item of results) {
            const dist = withDistance(item.latitude, item.longitude);

            if (item.result_type !== 'facility' && item.products?.length) {
                for (const product of item.products) {
                    products.push({ product, shop: item, distance: dist });
                }
            }
            places.push({ place: item, distance: dist });
        }

        // الأقرب أولاً؛ وما لا نعرف مسافته يأتي في النهاية (مرتّباً بالصلة)
        const nearestFirst = (a, b) => {
            const da = a.distance;
            const db = b.distance;
            if (da === null && db === null) {
                const ra = (a.place || a.shop)?.relevance || 0;
                const rb = (b.place || b.shop)?.relevance || 0;
                return rb - ra;
            }
            if (da === null) return 1;
            if (db === null) return -1;
            return da - db;
        };

        products.sort(nearestFirst);
        places.sort(nearestFirst);

        return { productHits: products, placeHits: places };
    }, [results, withDistance]);

    const hasResults = productHits.length > 0 || placeHits.length > 0;

    // ── الوجهة ووسيلة التنقل ───────────────────────────────────
    const openTarget = (place, product = null) => {
        if (!place.latitude || !place.longitude) {
            onShopClick?.(place);
            return;
        }
        setTarget({ place, product, distance: withDistance(place.latitude, place.longitude) });
    };

    const startNavigation = (mode) => {
        if (!target) return;
        if (!userLocation) {
            setTarget(null);
            onRequestLocation?.();
            return;
        }
        onNavigate?.(target.place, mode);
        setTarget(null);
    };

    const shopImageOf = (shop) => shop?.profile_picture ? getImageUrl(shop.profile_picture) : null;
    const initialOf = (shop) => (shop?.name || '؟').trim().charAt(0);

    // ── صندوق البحث (يُستخدم في الوسط وفي الأعلى) ──────────────
    const searchBox = (
        <div className="aia-searchwrap">
            <div className="aia-search">
                <Icon.Search />
                <input
                    ref={inputRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && runSearch()}
                    placeholder="اسم منتج أو محل… مثل: قهوة أو coffee"
                    enterKeyHint="search"
                    autoComplete="off"
                />
                <button
                    className="aia-go"
                    onClick={() => runSearch()}
                    disabled={!query.trim() || loading}
                    aria-label="بحث"
                >
                    <Icon.Send />
                </button>
            </div>
        </div>
    );

    const locationBanner = (
        <div className="aia-locbar">
            <span className="aia-locbar-icon"><Icon.Pin /></span>
            <div className="aia-locbar-text">
                <strong>فعّل تحديد الموقع</strong>
                <span>لنرتّب النتائج من الأقرب إليك ونرسم لك الطريق.</span>
            </div>
            <button onClick={() => onRequestLocation?.()}>تفعيل</button>
        </div>
    );

    return (
        <div className={`aia ${isActive ? 'is-active' : 'is-idle'}`} dir="rtl">

            {/* ── شريط علوي ── */}
            <header className="aia-head">
                <button
                    className="aia-head-brand"
                    onClick={resetSearch}
                    type="button"
                    tabIndex={isActive ? 0 : -1}
                >
                    <span>دليل المحلات والمنتجات</span>
                </button>
                <button className="aia-icon-btn" onClick={onClose} aria-label="إغلاق">
                    <Icon.Close />
                </button>
            </header>

            {/* ── قبل البحث: كل شيء في وسط الشاشة ── */}
            {!isActive && (
                <div className="aia-hero">
                    <div className="aia-hero-icon"><Icon.Store /></div>
                    <h1>ابحث عن منتج أو محل</h1>
                    <p>اكتب بالعربية أو الإنجليزية — نفهم الاثنين ونبحث في كل المحلات ومنتجاتها.</p>

                    {searchBox}

                    <div className="aia-chips">
                        {SUGGESTIONS.map(s => (
                            <button key={s} className="aia-chip" onClick={() => pickSuggestion(s)}>{s}</button>
                        ))}
                    </div>

                    {!userLocation && locationBanner}
                </div>
            )}

            {/* ── بعد البحث: شريط بالأعلى ثم النتائج ── */}
            {isActive && (
                <>
                    <div className="aia-searchbar">{searchBox}</div>

                    <div className="aia-body">
                        <div className="aia-inner">

                            {!userLocation && (
                                <div style={{ marginBottom: 18 }}>{locationBanner}</div>
                            )}

                            {/* تحميل */}
                            {loading && (
                                <div className="aia-grid">
                                    {[0, 1, 2, 3, 4, 5].map(i => (
                                        <div key={i} className="aia-skeleton aia-skeleton-card" />
                                    ))}
                                </div>
                            )}

                            {/* خطأ */}
                            {!loading && error && (
                                <div className="aia-state">
                                    <div className="aia-state-icon"><Icon.Empty /></div>
                                    <p>{error}</p>
                                    <button className="aia-chip" style={{ marginTop: 16 }} onClick={() => runSearch(submitted)}>
                                        إعادة المحاولة
                                    </button>
                                </div>
                            )}

                            {/* لا نتائج */}
                            {!loading && !error && !hasResults && (
                                <div className="aia-state">
                                    <div className="aia-state-icon"><Icon.Empty /></div>
                                    <p>لا نتائج لـ «{submitted}»</p>
                                    <span>جرّب كلمة أعم، أو اكتبها بالإنجليزية.</span>
                                </div>
                            )}

                            {/* ملاحظة الترتيب */}
                            {!loading && hasResults && userLocation && (
                                <div className="aia-sortnote">
                                    <Icon.Near /> مرتّبة من الأقرب إليك
                                </div>
                            )}

                            {/* المنتجات */}
                            {!loading && productHits.length > 0 && (
                                <>
                                    <div className="aia-sec">
                                        <h3>منتجات</h3>
                                        <span>{productHits.length} نتيجة</span>
                                    </div>
                                    <div className="aia-grid">
                                        {productHits.map(({ product, shop, distance }) => (
                                            <ResultCard
                                                key={`p-${shop.id}-${product.id}`}
                                                image={product.images?.[0]
                                                    ? getImageUrl(product.images[0])
                                                    : (product.image_url ? getImageUrl(product.image_url) : null)}
                                                initial={(product.name || '؟').charAt(0)}
                                                distance={distance}
                                                shopName={shop.name}
                                                shopImage={shopImageOf(shop)}
                                                shopInitial={initialOf(shop)}
                                                title={product.name}
                                                subtitle={product.category || shop.category}
                                                price={formatPrice(product.price)}
                                                tag={{ label: 'السعر عند الطلب' }}
                                                onClick={() => openTarget(shop, product)}
                                            />
                                        ))}
                                    </div>
                                </>
                            )}

                            {/* المحلات والأماكن */}
                            {!loading && placeHits.length > 0 && (
                                <>
                                    <div className="aia-sec">
                                        <h3>محلات وأماكن</h3>
                                        <span>{placeHits.length} نتيجة</span>
                                    </div>
                                    <div className="aia-grid">
                                        {placeHits.map(({ place, distance }) => (
                                            <ResultCard
                                                key={`s-${place.result_type}-${place.id}`}
                                                image={shopImageOf(place)}
                                                emoji={!place.profile_picture ? CATEGORY_EMOJI[place.category] : null}
                                                initial={initialOf(place)}
                                                distance={distance}
                                                title={place.name}
                                                subtitle={place.category || place.parent_shop_name}
                                                tag={place.products?.length
                                                    ? { label: `${place.products.length} منتج مطابق`, kind: 'count' }
                                                    : (place.parent_shop_name ? { label: place.parent_shop_name } : null)}
                                                onClick={() => openTarget(place)}
                                            />
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* ── ورقة اختيار وسيلة التنقل ── */}
            {target && (
                <div className="aia-sheet-back" onClick={() => setTarget(null)}>
                    <div className="aia-sheet" onClick={(e) => e.stopPropagation()}>

                        <div className="aia-sheet-target">
                            <div className="aia-sheet-thumb">
                                {target.product
                                    ? ((target.product.images?.[0] || target.product.image_url)
                                        ? <img src={getImageUrl(target.product.images?.[0] || target.product.image_url)} alt="" />
                                        : <span className="aia-initial">{(target.product.name || '؟').charAt(0)}</span>)
                                    : (shopImageOf(target.place)
                                        ? <img src={shopImageOf(target.place)} alt="" />
                                        : <span className="aia-initial">{initialOf(target.place)}</span>)}
                            </div>
                            <div className="aia-sheet-info">
                                <h4>{target.product?.name || target.place.name}</h4>
                                <span className="aia-sub">
                                    {target.product ? `في ${target.place.name}` : (target.place.category || '')}
                                </span>
                                {formatDistance(target.distance) && (
                                    <span className="aia-tag" style={{ alignSelf: 'flex-start', marginTop: 2 }}>
                                        يبعد {formatDistance(target.distance)}
                                    </span>
                                )}
                            </div>
                        </div>

                        {!userLocation && (
                            <div style={{ marginBottom: 18 }}>
                                <div className="aia-locbar">
                                    <span className="aia-locbar-icon"><Icon.Pin /></span>
                                    <div className="aia-locbar-text">
                                        <strong>نحتاج موقعك لرسم الطريق</strong>
                                        <span>فعّل تحديد الموقع ثم اختر وسيلة التنقل.</span>
                                    </div>
                                    <button onClick={() => { setTarget(null); onRequestLocation?.(); }}>تفعيل</button>
                                </div>
                            </div>
                        )}

                        <div className="aia-modes">
                            <button className="aia-mode" onClick={() => startNavigation('driving')}>
                                <span className="aia-mode-icon"><Icon.Car /></span>
                                <strong>بالسيارة</strong>
                                <span>أسرع طريق</span>
                            </button>
                            <button className="aia-mode" onClick={() => startNavigation('walking')}>
                                <span className="aia-mode-icon"><Icon.Walk /></span>
                                <strong>مشياً</strong>
                                <span>أقصر ممر</span>
                            </button>
                        </div>

                        <button
                            className="aia-sheet-cancel"
                            onClick={() => { const p = target.place; setTarget(null); onShopClick?.(p); }}
                        >
                            فتح صفحة المحل بدل التوجيه
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AIAssistant;
