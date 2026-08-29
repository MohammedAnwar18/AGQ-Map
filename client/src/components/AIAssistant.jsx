import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { smartSearchService, getImageUrl } from '../services/api';
import './AIAssistant.css';

/* ============================================================
   المساعد الذكي — دليل المحلات والمنتجات
   • بحث ثنائي اللغة يفهم اسم المنتج بالعربي أو الإنجليزي
   • نتائج بصورة المحل/المنتج واسمه والمسافة عن المستخدم
   • اختيار سيارة أو مشي ثم توجيه على الخريطة
   ============================================================ */

const SUGGESTIONS = ['قهوة', 'مطعم', 'صيدلية', 'سوبرماركت', 'حلويات', 'ملابس', 'مخبز', 'صيانة'];

// ── أيقونات ──────────────────────────────────────────────────
const Icon = {
    Close: (p) => (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" {...p}>
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
    ),
    Search: (p) => (
        <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" {...p}>
            <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.7" y2="16.7" />
        </svg>
    ),
    Send: (p) => (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}>
            <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
    ),
    Pin: (p) => (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
        </svg>
    ),
    Store: (p) => (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
    ),
    Route: (p) => (
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}>
            <polyline points="9 18 15 12 9 6" />
        </svg>
    ),
    Car: (p) => (
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}>
            <path d="M5 17h14M5 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm18 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z" />
            <path d="M3 17v-4l2-5h14l2 5v4" /><line x1="6" y1="13" x2="18" y2="13" />
        </svg>
    ),
    Walk: (p) => (
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}>
            <circle cx="13" cy="4" r="2" /><path d="m9 21 2-6 3-2-1-5" />
            <path d="m13 8 3 2 2 4" /><path d="m11 15-2 2-3 1" />
        </svg>
    ),
    Empty: (p) => (
        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
            <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.7" y2="16.7" />
        </svg>
    )
};

// ── مسافة هافرساين بالمتر ────────────────────────────────────
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
    'صيدلية': '💊', 'سوبرماركت': '🛒', 'مخبز': '🥖', 'ملابس': '👕',
    'بنك': '🏦', 'مستشفى': '🏥', 'مدرسة': '🏫', 'جامعة': '🎓',
    'مسجد': '🕌', 'كنيسة': '⛪', 'حديقة': '🌳', 'ملعب': '⚽'
};

// ── بطاقة نتيجة ──────────────────────────────────────────────
const ResultCard = ({ image, fallbackEmoji, initial, badgeImage, badgeInitial, title, subtitle, tags, onClick }) => (
    <button className="aia-card" onClick={onClick}>
        <div className="aia-thumb">
            {image
                ? <img src={image} alt="" loading="lazy" />
                : (fallbackEmoji
                    ? <span className="aia-emoji">{fallbackEmoji}</span>
                    : <span className="aia-initial">{initial}</span>)}

            {(badgeImage || badgeInitial) && (
                <span className="aia-thumb-shop">
                    {badgeImage ? <img src={badgeImage} alt="" loading="lazy" /> : badgeInitial}
                </span>
            )}
        </div>

        <div className="aia-info">
            <h4 className="aia-title">{title}</h4>
            {subtitle && <span className="aia-sub">{subtitle}</span>}
            {tags?.length > 0 && (
                <div className="aia-meta">
                    {tags.map((tag, i) => (
                        <span key={i} className={`aia-tag ${tag.kind ? `is-${tag.kind}` : ''}`}>{tag.label}</span>
                    ))}
                </div>
            )}
        </div>

        <span className="aia-go-icon"><Icon.Route /></span>
    </button>
);

// ============================================================
const AIAssistant = ({ onClose, userLocation, onNavigate, onShopClick, onRequestLocation }) => {
    const [query, setQuery] = useState('');
    const [submitted, setSubmitted] = useState('');
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState(null); // null = لم يبحث بعد
    const [error, setError] = useState(null);
    const [target, setTarget] = useState(null); // الوجهة المختارة لورقة التنقل

    const inputRef = useRef(null);
    const requestIdRef = useRef(0);

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        const t = setTimeout(() => inputRef.current?.focus(), 260);
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

    // ── تجهيز النتائج للعرض ────────────────────────────────────
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

        const byDistance = (a, b) => {
            if (a.distance === null && b.distance === null) return 0;
            if (a.distance === null) return 1;
            if (b.distance === null) return -1;
            return a.distance - b.distance;
        };

        products.sort(byDistance);
        places.sort(byDistance);

        return { productHits: products, placeHits: places };
    }, [results, withDistance]);

    const hasResults = productHits.length > 0 || placeHits.length > 0;

    // ── اختيار وجهة ثم وسيلة التنقل ────────────────────────────
    const openTarget = (place, product = null) => {
        if (!place.latitude || !place.longitude) {
            // بلا إحداثيات: نفتح ملف المحل مباشرة
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

    const shopImage = (shop) => shop?.profile_picture ? getImageUrl(shop.profile_picture) : null;
    const shopInitial = (shop) => (shop?.name || '؟').trim().charAt(0);

    return (
        <div className="aia" dir="rtl">

            {/* ── الترويسة ── */}
            <header className="aia-head">
                <div className="aia-head-icon"><Icon.Store /></div>
                <div className="aia-head-text">
                    <h2>دليل المحلات والمنتجات</h2>
                    <p>ابحث عن أي محل أو منتج وسنوصلك إليه</p>
                </div>
                <button className="aia-icon-btn" onClick={onClose} aria-label="إغلاق">
                    <Icon.Close />
                </button>
            </header>

            {/* ── شريط البحث ── */}
            <div className="aia-searchbar">
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

            {/* ── جسم الصفحة ── */}
            <div className="aia-body">
                <div className="aia-inner">

                    {/* تنبيه الموقع */}
                    {!userLocation && (
                        <div className="aia-locbar">
                            <span className="aia-locbar-icon"><Icon.Pin /></span>
                            <div className="aia-locbar-text">
                                <strong>فعّل تحديد الموقع</strong>
                                <span>لنعرض لك المسافة إلى كل محل ونرسم لك الطريق إليه.</span>
                            </div>
                            <button onClick={() => onRequestLocation?.()}>تفعيل</button>
                        </div>
                    )}

                    {/* اقتراحات قبل أول بحث */}
                    {results === null && !loading && (
                        <>
                            <p className="aia-suggest-title">جرّب البحث عن:</p>
                            <div className="aia-chips">
                                {SUGGESTIONS.map(s => (
                                    <button key={s} className="aia-chip" onClick={() => pickSuggestion(s)}>{s}</button>
                                ))}
                            </div>
                            <div className="aia-state">
                                <div className="aia-state-icon"><Icon.Store /></div>
                                <p>ابحث عن منتج أو محل</p>
                                <span>اكتب بالعربية أو الإنجليزية — نفهم الاثنين ونبحث في كل المحلات ومنتجاتها.</span>
                            </div>
                        </>
                    )}

                    {/* تحميل */}
                    {loading && (
                        <div className="aia-list">
                            {[0, 1, 2, 3].map(i => <div key={i} className="aia-skeleton" />)}
                        </div>
                    )}

                    {/* خطأ */}
                    {!loading && error && (
                        <div className="aia-state">
                            <div className="aia-state-icon"><Icon.Empty /></div>
                            <p>{error}</p>
                            <button className="aia-chip" style={{ marginTop: 14 }} onClick={() => runSearch(submitted)}>
                                إعادة المحاولة
                            </button>
                        </div>
                    )}

                    {/* لا نتائج */}
                    {!loading && !error && results !== null && !hasResults && (
                        <div className="aia-state">
                            <div className="aia-state-icon"><Icon.Empty /></div>
                            <p>لا نتائج لـ «{submitted}»</p>
                            <span>جرّب كلمة أعم، أو اكتبها بالإنجليزية.</span>
                        </div>
                    )}

                    {/* المنتجات */}
                    {!loading && productHits.length > 0 && (
                        <>
                            <div className="aia-sec">
                                <h3>منتجات</h3>
                                <span>{productHits.length} نتيجة</span>
                            </div>
                            <div className="aia-list">
                                {productHits.map(({ product, shop, distance }) => {
                                    const tags = [];
                                    const price = formatPrice(product.price);
                                    if (price) tags.push({ label: price, kind: 'price' });
                                    const d = formatDistance(distance);
                                    if (d) tags.push({ label: `يبعد ${d}`, kind: 'dist' });
                                    if (product.category) tags.push({ label: product.category });

                                    return (
                                        <ResultCard
                                            key={`p-${shop.id}-${product.id}`}
                                            image={product.images?.[0] ? getImageUrl(product.images[0]) : (product.image_url ? getImageUrl(product.image_url) : null)}
                                            initial={(product.name || '؟').charAt(0)}
                                            badgeImage={shopImage(shop)}
                                            badgeInitial={shopInitial(shop)}
                                            title={product.name}
                                            subtitle={`في ${shop.name}`}
                                            tags={tags}
                                            onClick={() => openTarget(shop, product)}
                                        />
                                    );
                                })}
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
                            <div className="aia-list">
                                {placeHits.map(({ place, distance }) => {
                                    const tags = [];
                                    const d = formatDistance(distance);
                                    if (d) tags.push({ label: `يبعد ${d}`, kind: 'dist' });
                                    if (place.products?.length) {
                                        tags.push({ label: `${place.products.length} منتج مطابق`, kind: 'price' });
                                    }
                                    if (place.parent_shop_name) tags.push({ label: place.parent_shop_name });

                                    return (
                                        <ResultCard
                                            key={`s-${place.result_type}-${place.id}`}
                                            image={shopImage(place)}
                                            fallbackEmoji={!place.profile_picture ? (CATEGORY_EMOJI[place.category] || null) : null}
                                            initial={shopInitial(place)}
                                            title={place.name}
                                            subtitle={place.category}
                                            tags={tags}
                                            onClick={() => openTarget(place)}
                                        />
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* ── ورقة اختيار وسيلة التنقل ── */}
            {target && (
                <div className="aia-sheet-back" onClick={() => setTarget(null)}>
                    <div className="aia-sheet" onClick={(e) => e.stopPropagation()}>

                        <div className="aia-sheet-target">
                            <div className="aia-thumb" style={{ width: 54, height: 54 }}>
                                {target.product
                                    ? (target.product.images?.[0] || target.product.image_url
                                        ? <img src={getImageUrl(target.product.images?.[0] || target.product.image_url)} alt="" />
                                        : <span className="aia-initial">{(target.product.name || '؟').charAt(0)}</span>)
                                    : (shopImage(target.place)
                                        ? <img src={shopImage(target.place)} alt="" />
                                        : <span className="aia-initial">{shopInitial(target.place)}</span>)}
                            </div>
                            <div className="aia-info">
                                <h4 className="aia-title">{target.product?.name || target.place.name}</h4>
                                <span className="aia-sub">
                                    {target.product ? `في ${target.place.name}` : (target.place.category || '')}
                                </span>
                                {formatDistance(target.distance) && (
                                    <div className="aia-meta">
                                        <span className="aia-tag is-dist">يبعد {formatDistance(target.distance)}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {!userLocation && (
                            <div className="aia-locbar" style={{ marginBottom: 16 }}>
                                <span className="aia-locbar-icon"><Icon.Pin /></span>
                                <div className="aia-locbar-text">
                                    <strong>نحتاج موقعك لرسم الطريق</strong>
                                    <span>فعّل تحديد الموقع ثم اختر وسيلة التنقل.</span>
                                </div>
                                <button onClick={() => { setTarget(null); onRequestLocation?.(); }}>تفعيل</button>
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
