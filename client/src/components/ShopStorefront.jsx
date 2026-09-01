import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { shopService, getImageUrl } from '../services/api';
import { optimizeImage } from '../utils/imageOptimizer';
import { cartService } from '../services/cartService';
import CartModal from './CartModal';
import Panorama360Viewer from './Panorama360Viewer';
import './ShopStorefront.css';

/* ============================================================
   واجهة المحل — صفحة عرض المنتجات
   • شاشة دخول قصيرة (١.٥ ثانية) بشعار المحل في المنتصف
   • ترويسة: الشعار، الاسم، حالة الفتح، تصنيف المحل، ساعات العمل
   • المنتجات مقسّمة إلى أقسام يديرها صاحب المحل
   ============================================================ */

const ENTRY_DURATION = 1500; // ١.٥ ثانية كما طُلب
const ALL_KEY = '__all__';
const LOGO_PREVIEW = 260; // قطر معاينة الشعار بالبكسل، تُستخدم لتحويل الإزاحة إلى اللوحة

// ── أيقونات ──────────────────────────────────────────────────
const Icon = {
    Close: (p) => (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" {...p}>
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
    ),
    Cart: (p) => (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
            <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
        </svg>
    ),
    Globe360: (p) => (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
            <circle cx="12" cy="12" r="9" />
            <ellipse cx="12" cy="12" rx="4" ry="9" />
            <line x1="3" y1="12" x2="21" y2="12" />
        </svg>
    ),
    Plus: (p) => (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" {...p}>
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
    ),
    Edit: (p) => (
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
            <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
    ),
    Trash: (p) => (
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
    ),
    Image: (p) => (
        <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
        </svg>
    ),
    Clock: (p) => (
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
        </svg>
    ),
    Box: (p) => (
        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
    ),
    Phone: (p) => (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.09 4.18 2 2 0 0 1 4.08 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" />
        </svg>
    ),
    Mail: (p) => (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
            <rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 6-10 7L2 6" />
        </svg>
    ),
    Globe: (p) => (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
            <circle cx="12" cy="12" r="10" /><path d="M2 12h20" />
            <path d="M12 2a15.3 15.3 0 0 1 0 20 15.3 15.3 0 0 1 0-20" />
        </svg>
    ),
    Camera: (p) => (
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
        </svg>
    ),
    Chevron: (p) => (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
            <polyline points="15 18 9 12 15 6" />
        </svg>
    )
};

// ── ساعات العمل: نص «اليوم: من - إلى» لكل يوم على سطر ────────
const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

const DEFAULT_DAY = { closed: false, open: '09:00', close: '21:00' };

const two = (n) => String(n).padStart(2, '0');

// يقبل «09:00» و«9:00 صباحاً» معاً ويعيد الدقائق منذ منتصف الليل
const toMinutes = (hour, minute, period) => {
    let h = parseInt(hour, 10);
    if (period?.includes('مساء') && h !== 12) h += 12;
    if (period?.includes('صباح') && h === 12) h = 0;
    return h * 60 + parseInt(minute, 10);
};

const minutesToText = (mins) => `${two(Math.floor(mins / 60))}:${two(mins % 60)}`;

/** يحوّل نص opening_hours إلى جدول أسبوعي: { [day]: {closed, open, close} } */
const parseWeeklyHours = (openingHours) => {
    const week = {};
    if (!openingHours) return week;

    for (const day of DAYS) {
        const match = openingHours.match(new RegExp(`${day}:\\s*(.*)`));
        if (!match) continue;

        const range = match[1].trim();
        if (!range || range.includes('مغلق')) {
            week[day] = { closed: true, open: DEFAULT_DAY.open, close: DEFAULT_DAY.close };
            continue;
        }

        const times = range.match(/(\d{1,2}):(\d{2})\s*(صباحاً|مساءً)?\s*-\s*(\d{1,2}):(\d{2})\s*(صباحاً|مساءً)?/);
        if (!times) continue;

        const [, h1, m1, p1, h2, m2, p2] = times;
        week[day] = {
            closed: false,
            open: minutesToText(toMinutes(h1, m1, p1)),
            close: minutesToText(toMinutes(h2, m2, p2))
        };
    }
    return week;
};

/** يبني نص opening_hours من الجدول الأسبوعي */
const buildHoursText = (week) => DAYS
    .map(day => {
        const d = week[day];
        if (!d || d.closed) return `${day}: مغلق`;
        return `${day}: ${d.open} - ${d.close}`;
    })
    .join('\n');

/** حالة المحل الآن اعتماداً على جدول اليوم (يدعم التوقيت الممتد بعد منتصف الليل) */
const getTodayStatus = (week) => {
    const today = DAYS[new Date().getDay()];
    const d = week[today];
    if (!d) return null;
    if (d.closed) return { isOpen: false, label: 'مغلق اليوم', range: null, today };

    const now = new Date();
    const cur = now.getHours() * 60 + now.getMinutes();
    const [oh, om] = d.open.split(':').map(Number);
    const [ch, cm] = d.close.split(':').map(Number);
    const start = oh * 60 + om;
    const end = ch * 60 + cm;
    const isOpen = end > start ? (cur >= start && cur <= end) : (cur >= start || cur <= end);

    return {
        isOpen,
        label: isOpen ? 'مفتوح الآن' : 'مغلق الآن',
        range: `${d.open} - ${d.close}`,
        today
    };
};

// يضمن أن رابط الموقع يبدأ ببروتوكول حتى يُفتح خارج التطبيق
const normalizeUrl = (url) => (/^https?:\/\//i.test(url) ? url : `https://${url}`);

const formatPrice = (value) => {
    const num = parseFloat(value);
    if (Number.isNaN(num)) return null;
    return `${num % 1 === 0 ? num.toFixed(0) : num.toFixed(2)} ₪`;
};

// ── محرّر شعار المحل: سحب لضبط الموضع وشريط للتكبير ─────────
const LogoCropper = ({ form, setForm, saving, onCancel, onSave }) => {
    const dragRef = useRef(null);
    const boxRef = useRef(null);

    // القطر المعروض قد يصغر على الهواتف، فنقيسه لنطابق الاقتصاص تماماً
    useEffect(() => {
        const measure = () => {
            const size = boxRef.current?.offsetWidth;
            if (size) setForm(prev => (prev && prev.preview !== size ? { ...prev, preview: size } : prev));
        };
        measure();
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
    }, [setForm]);

    const startDrag = (e) => {
        const point = e.touches ? e.touches[0] : e;
        dragRef.current = { x: point.clientX, y: point.clientY, ox: form.x, oy: form.y };
    };

    const onDrag = (e) => {
        if (!dragRef.current) return;
        const point = e.touches ? e.touches[0] : e;
        const limit = (form.preview || LOGO_PREVIEW) * form.zoom;
        const clamp = (v) => Math.max(-limit, Math.min(limit, v));
        setForm(prev => ({
            ...prev,
            x: clamp(dragRef.current.ox + (point.clientX - dragRef.current.x)),
            y: clamp(dragRef.current.oy + (point.clientY - dragRef.current.y))
        }));
    };

    const endDrag = () => { dragRef.current = null; };

    return (
        <div className="sf-sheet-backdrop" onClick={onCancel}>
            <div className="sf-sheet" onClick={(e) => e.stopPropagation()}>
                <div className="sf-sheet-head">
                    <h3>شعار المحل</h3>
                    <button className="sf-icon-btn" onClick={onCancel}><Icon.Close /></button>
                </div>

                <div className="sf-sheet-body">
                    <div
                        className="sf-crop"
                        ref={boxRef}
                        onMouseDown={startDrag}
                        onMouseMove={onDrag}
                        onMouseUp={endDrag}
                        onMouseLeave={endDrag}
                        onTouchStart={startDrag}
                        onTouchMove={onDrag}
                        onTouchEnd={endDrag}
                    >
                        <img
                            src={form.src}
                            alt=""
                            draggable={false}
                            style={{ transform: `translate(${form.x}px, ${form.y}px) scale(${form.zoom})` }}
                        />
                    </div>

                    <div className="sf-crop-zoom">
                        <span>الحجم</span>
                        <input
                            type="range"
                            min="1"
                            max="3"
                            step="0.01"
                            value={form.zoom}
                            onChange={(e) => setForm(prev => ({ ...prev, zoom: parseFloat(e.target.value) }))}
                        />
                        <b>{form.zoom.toFixed(1)}×</b>
                    </div>

                    <p className="sf-detail-desc" style={{ fontSize: '.8rem' }}>
                        اسحب الصورة لضبط موضعها داخل الدائرة، واستخدم الشريط لتكبيرها. ما تراه هنا هو ما سيظهر تماماً.
                    </p>
                </div>

                <div className="sf-sheet-foot">
                    <button className="sf-btn sf-btn-ghost" onClick={onCancel}>إلغاء</button>
                    <button className="sf-btn sf-btn-primary" onClick={onSave} disabled={saving}>
                        {saving ? 'جاري الحفظ…' : 'حفظ الشعار'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── صورة المنتج داخل البطاقة ─────────────────────────────────
const CardMedia = ({ images, name }) => {
    if (!images.length) {
        return (
            <div className="sf-card-media">
                <div className="sf-card-placeholder"><Icon.Image /></div>
            </div>
        );
    }
    return (
        <div className="sf-card-media">
            <img src={getImageUrl(images[0])} alt={name} loading="lazy" />
            {images.length > 1 && (
                <span className="sf-card-count"><Icon.Image width="11" height="11" />{images.length}</span>
            )}
        </div>
    );
};

// ============================================================
const ShopStorefront = ({ shop, currentUser, onClose, userLocation }) => {
    const [entering, setEntering] = useState(true);
    const [leaving, setLeaving] = useState(false);

    const [shopData, setShopData] = useState(shop);
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [activeCat, setActiveCat] = useState(ALL_KEY);
    const [loadError, setLoadError] = useState(null);

    const [showCart, setShowCart] = useState(false);
    const [cartCount, setCartCount] = useState(cartService.getItemCount());

    // جولة ٣٦٠° — تُجلب مرة واحدة لنقرّر إظهار الزر
    const [panoramas, setPanoramas] = useState(null);
    const [show360, setShow360] = useState(false);
    const [cartTotal, setCartTotal] = useState(0);

    const [detailProduct, setDetailProduct] = useState(null);
    const [productForm, setProductForm] = useState(null); // null | {} = نموذج مفتوح
    const [categoryForm, setCategoryForm] = useState(false);
    const [hoursForm, setHoursForm] = useState(null);   // جدول أسبوعي قابل للتحرير
    const [showHours, setShowHours] = useState(false);  // جدول الأسبوع للزائر
    const [aboutForm, setAboutForm] = useState(null);   // تحرير بيانات التواصل
    const [showAbout, setShowAbout] = useState(false);  // قسم "حول"
    const [logoForm, setLogoForm] = useState(null);     // { src, zoom, x, y }
    const [saving, setSaving] = useState(false);

    const [showTitle, setShowTitle] = useState(false);
    const scrollRef = useRef(null);
    const fileInputRef = useRef(null);

    const isAdmin = Boolean(
        currentUser && (currentUser.role === 'admin' || shopData?.is_owner || shopData?.owner_id === currentUser.id)
    );

    // ── شاشة الدخول ────────────────────────────────────────────
    useEffect(() => {
        const leaveTimer = setTimeout(() => setLeaving(true), ENTRY_DURATION);
        const doneTimer = setTimeout(() => setEntering(false), ENTRY_DURATION + 450);
        return () => { clearTimeout(leaveTimer); clearTimeout(doneTimer); };
    }, []);

    // ── جلب بيانات المحل ───────────────────────────────────────
    const loadShop = useCallback(async () => {
        try {
            const data = await shopService.getProfile(shop.id);
            if (data?.shop) setShopData({ ...shop, ...data.shop });
            setProducts(Array.isArray(data?.products) ? data.products : []);
            setCategories(Array.isArray(data?.categories) ? data.categories : []);
            setLoadError(null);
        } catch (e) {
            console.error('Storefront load error:', e);
            setLoadError('تعذّر تحميل بيانات المحل، تحقّق من اتصالك وحاول مجدداً.');
        }
    }, [shop]);

    useEffect(() => { loadShop(); }, [loadShop]);

    // ── جولة ٣٦٠° ──────────────────────────────────────────────
    useEffect(() => {
        if (!shop?.id) return;
        shopService.getPanoramas(shop.id)
            .then(data => setPanoramas(data?.panoramas || []))
            .catch(() => setPanoramas([]));
    }, [shop?.id]);

    // ── السلة ──────────────────────────────────────────────────
    useEffect(() => {
        const sync = () => {
            setCartCount(cartService.getItemCount());
            const cart = cartService.getCart();
            const total = (cart.items || []).reduce(
                (sum, item) => sum + (parseFloat(item.price) || 0) * (item.quantity || 1), 0
            );
            setCartTotal(total);
        };
        sync();
        window.addEventListener('cart-updated', sync);
        return () => window.removeEventListener('cart-updated', sync);
    }, []);

    // ── إظهار اسم المحل في الشريط العلوي عند التمرير ───────────
    const handleScroll = (e) => setShowTitle(e.target.scrollTop > 120);

    // ── تجميع المنتجات حسب القسم ───────────────────────────────
    const grouped = useMemo(() => {
        const buckets = categories.map(cat => ({
            id: cat.id,
            name: cat.name,
            items: products.filter(p => String(p.category_id) === String(cat.id))
        }));
        const orphans = products.filter(p => !p.category_id);
        if (orphans.length) buckets.push({ id: null, name: 'منتجات أخرى', items: orphans });
        return buckets.filter(b => b.items.length > 0 || isAdmin);
    }, [products, categories, isAdmin]);

    const visibleGroups = useMemo(() => {
        if (activeCat === ALL_KEY) return grouped;
        return grouped.filter(g => String(g.id) === String(activeCat));
    }, [grouped, activeCat]);

    // ── إجراءات السلة ──────────────────────────────────────────
    const addToCart = (product, e) => {
        e?.stopPropagation();
        cartService.addItem({
            id: product.id,
            name: product.name,
            price: parseFloat(product.price) || 0,
            image_url: product.images?.[0] || product.image_url || null,
            shop_id: shopData.id,
            shop_name: shopData.name
        });
    };

    // ── ساعات العمل ────────────────────────────────────────────
    const openHoursForm = () => {
        const parsed = parseWeeklyHours(shopData?.opening_hours);
        setHoursForm(DAYS.reduce((acc, day) => {
            acc[day] = parsed[day] ? { ...parsed[day] } : { ...DEFAULT_DAY };
            return acc;
        }, {}));
        setShowHours(false);
    };

    const setDay = (day, patch) =>
        setHoursForm(prev => ({ ...prev, [day]: { ...prev[day], ...patch } }));

    // ينسخ توقيت اليوم المحدّد إلى بقية أيام الأسبوع
    const applyToAllDays = (day) => {
        const src = hoursForm[day];
        setHoursForm(DAYS.reduce((acc, d) => { acc[d] = { ...src }; return acc; }, {}));
    };

    const saveHours = async () => {
        if (!hoursForm) return;
        setSaving(true);
        try {
            const text = buildHoursText(hoursForm);
            await shopService.updateProfile(shopData.id, { opening_hours: text });
            setShopData(prev => ({ ...prev, opening_hours: text }));
            setHoursForm(null);
        } catch (e) {
            console.error(e);
            alert('تعذّر حفظ ساعات العمل، حاول مجدداً.');
        } finally {
            setSaving(false);
        }
    };

    // ── بيانات التواصل (قسم "حول") ─────────────────────────────
    const openAboutForm = () => {
        setAboutForm({
            contact_phone: shopData?.contact_phone || '',
            contact_email: shopData?.contact_email || '',
            contact_website: shopData?.contact_website || ''
        });
    };

    const saveAbout = async () => {
        if (!aboutForm) return;
        setSaving(true);
        try {
            const payload = {
                contact_phone: aboutForm.contact_phone.trim(),
                contact_email: aboutForm.contact_email.trim(),
                contact_website: aboutForm.contact_website.trim()
            };
            await shopService.updateProfile(shopData.id, payload);
            setShopData(prev => ({ ...prev, ...payload }));
            setAboutForm(null);
        } catch (e) {
            console.error(e);
            alert('تعذّر حفظ بيانات التواصل، حاول مجدداً.');
        } finally {
            setSaving(false);
        }
    };

    // ── شعار المحل: اختيار الصورة وضبط حجمها داخل الدائرة ──────
    const logoInputRef = useRef(null);

    const pickLogo = (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => setLogoForm({ src: reader.result, zoom: 1, x: 0, y: 0 });
        reader.readAsDataURL(file);
    };

    // نرسم الاقتصاص النهائي على لوحة مربّعة فتُحفظ الصورة مضبوطة أصلاً
    const saveLogo = async () => {
        if (!logoForm) return;
        setSaving(true);
        try {
            const img = new Image();
            img.src = logoForm.src;
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = () => reject(new Error('تعذّر قراءة الصورة'));
            });

            const SIZE = 512;
            const canvas = document.createElement('canvas');
            canvas.width = SIZE;
            canvas.height = SIZE;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, SIZE, SIZE);

            // نفس معادلة المعاينة: الصورة تملأ المربّع ثم تُكبَّر وتُزاح
            const base = Math.max(SIZE / img.width, SIZE / img.height);
            const scale = base * logoForm.zoom;
            const w = img.width * scale;
            const h = img.height * scale;
            const ratio = SIZE / (logoForm.preview || LOGO_PREVIEW);
            ctx.drawImage(
                img,
                (SIZE - w) / 2 + logoForm.x * ratio,
                (SIZE - h) / 2 + logoForm.y * ratio,
                w, h
            );

            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
            if (!blob) throw new Error('تعذّر تجهيز الصورة');

            const formData = new FormData();
            formData.append('profile_picture', blob, 'logo.png');
            const data = await shopService.uploadImages(shopData.id, formData);

            const url = data?.shop?.profile_picture || data?.profile_picture;
            if (url) setShopData(prev => ({ ...prev, profile_picture: url }));
            else await loadShop();

            setLogoForm(null);
        } catch (e) {
            console.error(e);
            alert('تعذّر حفظ الشعار، حاول مجدداً.');
        } finally {
            setSaving(false);
        }
    };

    // ── إدارة الأقسام ──────────────────────────────────────────
    const [newCategoryName, setNewCategoryName] = useState('');

    const saveCategory = async () => {
        const name = newCategoryName.trim();
        if (!name) return;
        setSaving(true);
        try {
            const created = await shopService.addProductCategory(shopData.id, name);
            setCategories(prev => prev.some(c => c.id === created.id) ? prev : [...prev, created]);
            setNewCategoryName('');
            setCategoryForm(false);
        } catch (e) {
            console.error(e);
            alert('تعذّر إضافة القسم، حاول مجدداً.');
        } finally {
            setSaving(false);
        }
    };

    const removeCategory = async (categoryId, name) => {
        if (!window.confirm(`حذف قسم "${name}"؟ المنتجات بداخله لن تُحذف، ستنتقل إلى "منتجات أخرى".`)) return;
        try {
            await shopService.deleteProductCategory(shopData.id, categoryId);
            setCategories(prev => prev.filter(c => c.id !== categoryId));
            setProducts(prev => prev.map(p => (
                String(p.category_id) === String(categoryId) ? { ...p, category_id: null, category_name: null } : p
            )));
            if (String(activeCat) === String(categoryId)) setActiveCat(ALL_KEY);
        } catch (e) {
            console.error(e);
            alert('تعذّر حذف القسم.');
        }
    };

    // ── إدارة المنتجات ─────────────────────────────────────────
    const openProductForm = (product = null, e) => {
        e?.stopPropagation();
        setProductForm({
            id: product?.id || null,
            name: product?.name || '',
            price: product?.price ?? '',
            old_price: product?.old_price ?? '',
            description: product?.description || '',
            category_id: product?.category_id ? String(product.category_id) : (activeCat !== ALL_KEY ? String(activeCat) : ''),
            existingImages: product?.images || (product?.image_url ? [product.image_url] : []),
            newFiles: [],
            previews: []
        });
    };

    const pickImages = (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;
        setProductForm(prev => ({
            ...prev,
            newFiles: [...prev.newFiles, ...files].slice(0, 6),
            previews: [...prev.previews, ...files.map(f => URL.createObjectURL(f))].slice(0, 6)
        }));
        e.target.value = '';
    };

    const removeExistingImage = (index) => {
        setProductForm(prev => ({
            ...prev,
            existingImages: prev.existingImages.filter((_, i) => i !== index)
        }));
    };

    const removeNewImage = (index) => {
        setProductForm(prev => {
            URL.revokeObjectURL(prev.previews[index]);
            return {
                ...prev,
                newFiles: prev.newFiles.filter((_, i) => i !== index),
                previews: prev.previews.filter((_, i) => i !== index)
            };
        });
    };

    const saveProduct = async (e) => {
        e.preventDefault();
        if (!productForm.name.trim()) return;

        setSaving(true);
        try {
            const formData = new FormData();
            formData.append('name', productForm.name.trim());
            formData.append('price', productForm.price === '' ? '' : productForm.price);
            formData.append('old_price', productForm.old_price === '' ? '' : productForm.old_price);
            formData.append('description', productForm.description || '');
            formData.append('category_id', productForm.category_id || '');
            formData.append('existing_images', JSON.stringify(productForm.existingImages));

            for (const file of productForm.newFiles) {
                const optimized = await optimizeImage(file, { maxWidth: 1000 });
                formData.append('images', optimized);
            }

            let saved;
            if (productForm.id) {
                saved = await shopService.updateProduct(shopData.id, productForm.id, formData);
                setProducts(prev => prev.map(p => (p.id === productForm.id ? { ...p, ...saved } : p)));
            } else {
                saved = await shopService.addProduct(shopData.id, formData);
                setProducts(prev => [saved, ...prev]);
            }

            productForm.previews.forEach(URL.revokeObjectURL);
            setProductForm(null);
            // نعيد المزامنة لضمان وصول اسم القسم من الخادم
            loadShop();
        } catch (err) {
            console.error(err);
            alert('تعذّر حفظ المنتج، حاول مجدداً.');
        } finally {
            setSaving(false);
        }
    };

    const removeProduct = async (product, e) => {
        e?.stopPropagation();
        if (!window.confirm(`حذف "${product.name}"؟`)) return;
        try {
            await shopService.deleteProduct(shopData.id, product.id);
            setProducts(prev => prev.filter(p => p.id !== product.id));
            setDetailProduct(null);
        } catch (err) {
            console.error(err);
            alert('تعذّر حذف المنتج.');
        }
    };

    // ── معطيات العرض ───────────────────────────────────────────
    const week = parseWeeklyHours(shopData?.opening_hours);
    const status = getTodayStatus(week);
    const hasHours = Object.keys(week).length > 0;
    const hasContact = Boolean(shopData?.contact_phone || shopData?.contact_email || shopData?.contact_website);
    const logo = shopData?.profile_picture ? getImageUrl(shopData.profile_picture) : null;
    const initial = (shopData?.name || '؟').trim().charAt(0);
    const totalProducts = products.length;

    return (
        <div className="sf-root" dir="rtl">

            {/* ── شاشة الدخول ── */}
            {entering && (
                <div className={`sf-loader ${leaving ? 'is-leaving' : ''}`}>
                    <div className="sf-loader-glow" aria-hidden="true" />
                    <div className="sf-loader-logo">
                        <span className="sf-loader-ring" aria-hidden="true" />
                        <span className="sf-loader-ring" aria-hidden="true" />
                        <span className="sf-loader-ring" aria-hidden="true" />
                        <div className="sf-loader-avatar">
                            {logo
                                ? <img src={logo} alt={shopData?.name || ''} />
                                : <span className="sf-initial">{initial}</span>}
                        </div>
                    </div>
                    <div className="sf-loader-bar"><span /></div>
                </div>
            )}

            {/* ── الشريط العلوي ── */}
            <header className="sf-topbar">
                <button className="sf-icon-btn" onClick={onClose} aria-label="إغلاق">
                    <Icon.Close />
                </button>

                <div className={`sf-topbar-title ${showTitle ? 'is-visible' : ''}`}>
                    {shopData?.name}
                </div>

                <div className="sf-topbar-actions">
                    {(isAdmin || (panoramas && panoramas.length > 0)) && (
                        <button
                            className="sf-icon-btn sf-360-btn"
                            onClick={() => setShow360(true)}
                            aria-label="جولة ٣٦٠ درجة"
                            title="جولة ٣٦٠°"
                        >
                            <Icon.Globe360 />
                        </button>
                    )}

                    {(isAdmin || hasContact) && (
                        <button
                            className="sf-icon-btn sf-about-btn"
                            onClick={() => setShowAbout(true)}
                            aria-label="حول المحل"
                            title="حول"
                        >
                            <Icon.Phone />
                        </button>
                    )}

                    <button
                        className="sf-icon-btn sf-cart-btn"
                        onClick={() => setShowCart(true)}
                        aria-label="سلة التسوق"
                    >
                        <Icon.Cart />
                        {cartCount > 0 && <span className="sf-cart-badge">{cartCount}</span>}
                    </button>
                </div>
            </header>

            {/* ── جسم الصفحة ── */}
            <div className="sf-scroll" ref={scrollRef} onScroll={handleScroll}>
                <div className="sf-inner">

                    {/* ترويسة المحل */}
                    <section className="sf-header">
                        <div className="sf-avatar-wrap">
                            <div className="sf-avatar">
                                {logo
                                    ? <img src={logo} alt={shopData?.name || ''} />
                                    : <span className="sf-initial">{initial}</span>}
                            </div>

                            {isAdmin && (
                                <>
                                    <button
                                        className="sf-avatar-edit"
                                        onClick={() => logoInputRef.current?.click()}
                                        aria-label="تغيير شعار المحل"
                                        title="تغيير الشعار"
                                    >
                                        <Icon.Camera />
                                    </button>
                                    <input
                                        ref={logoInputRef}
                                        type="file"
                                        accept="image/*"
                                        hidden
                                        onChange={pickLogo}
                                    />
                                </>
                            )}
                        </div>

                        <h1 className="sf-name">{shopData?.name}</h1>

                        {shopData?.category && (
                            <p className="sf-category">{shopData.category}</p>
                        )}

                        {status && (
                            <button
                                className={`sf-status ${status.isOpen ? 'is-open' : 'is-closed'}`}
                                onClick={() => setShowHours(true)}
                                title="عرض جدول ساعات العمل"
                            >
                                <span className="sf-status-dot" />
                                {status.label}
                                {status.range && <b className="sf-status-range">{status.range}</b>}
                                <Icon.Chevron className="sf-status-arrow" />
                            </button>
                        )}

                        <div className="sf-header-actions">
                            {hasHours && (
                                <button className="sf-linkbtn" onClick={() => setShowHours(true)}>
                                    <Icon.Clock />
                                    جدول الأسبوع
                                </button>
                            )}

                            {isAdmin && (
                                <button className="sf-linkbtn is-gold" onClick={openHoursForm}>
                                    <Icon.Clock />
                                    {hasHours ? 'تعديل ساعات العمل' : 'إضافة ساعات العمل'}
                                </button>
                            )}
                        </div>
                    </section>

                    {/* شريط الأقسام */}
                    {(categories.length > 0 || isAdmin) && (
                        <div className="sf-tabs-wrap">
                            <div className="sf-tabs">
                                <button
                                    className={`sf-tab ${activeCat === ALL_KEY ? 'is-active' : ''}`}
                                    onClick={() => setActiveCat(ALL_KEY)}
                                >
                                    الكل {totalProducts > 0 && `(${totalProducts})`}
                                </button>

                                {categories.map(cat => (
                                    <button
                                        key={cat.id}
                                        className={`sf-tab ${String(activeCat) === String(cat.id) ? 'is-active' : ''}`}
                                        onClick={() => setActiveCat(cat.id)}
                                    >
                                        {cat.name}
                                    </button>
                                ))}

                                {isAdmin && (
                                    <button className="sf-tab sf-tab-add" onClick={() => setCategoryForm(true)}>
                                        + قسم جديد
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* رسالة خطأ */}
                    {loadError && (
                        <div className="sf-empty">
                            <p>{loadError}</p>
                            <button className="sf-btn sf-btn-primary" style={{ maxWidth: 200, margin: '14px auto 0' }} onClick={loadShop}>
                                إعادة المحاولة
                            </button>
                        </div>
                    )}

                    {/* الأقسام والمنتجات */}
                    {!loadError && visibleGroups.length === 0 && (
                        <div className="sf-empty">
                            <div className="sf-empty-icon"><Icon.Box /></div>
                            <p>لا توجد منتجات بعد</p>
                            <span>{isAdmin ? 'ابدأ بإضافة قسم ثم أضف منتجاتك إليه.' : 'سيضيف المحل منتجاته قريباً.'}</span>
                        </div>
                    )}

                    {!loadError && visibleGroups.map(group => (
                        <section className="sf-section" key={group.id ?? 'orphans'}>
                            <div className="sf-section-head">
                                <h2 className="sf-section-title">{group.name}</h2>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <span className="sf-section-count">{group.items.length} منتج</span>
                                    {isAdmin && group.id && (
                                        <button className="sf-section-del" onClick={() => removeCategory(group.id, group.name)}>
                                            حذف القسم
                                        </button>
                                    )}
                                </div>
                            </div>

                            {group.items.length === 0 ? (
                                <div className="sf-empty" style={{ padding: '26px 12px' }}>
                                    <span>لا منتجات في هذا القسم بعد.</span>
                                </div>
                            ) : (
                                <div className="sf-grid">
                                    {group.items.map(product => {
                                        const images = product.images?.length
                                            ? product.images
                                            : (product.image_url ? [product.image_url] : []);
                                        const price = formatPrice(product.price);
                                        const oldPrice = formatPrice(product.old_price);

                                        return (
                                            <article
                                                className="sf-card"
                                                key={product.id}
                                                onClick={() => setDetailProduct({ ...product, images })}
                                            >
                                                {isAdmin && (
                                                    <div className="sf-card-admin">
                                                        <button
                                                            className="sf-chip-btn"
                                                            onClick={(e) => openProductForm(product, e)}
                                                            aria-label="تعديل"
                                                        >
                                                            <Icon.Edit />
                                                        </button>
                                                        <button
                                                            className="sf-chip-btn is-danger"
                                                            onClick={(e) => removeProduct(product, e)}
                                                            aria-label="حذف"
                                                        >
                                                            <Icon.Trash />
                                                        </button>
                                                    </div>
                                                )}

                                                <CardMedia images={images} name={product.name} />

                                                <div className="sf-card-body">
                                                    <h3 className="sf-card-name">{product.name}</h3>
                                                    {product.category_name && (
                                                        <span className="sf-card-cat">{product.category_name}</span>
                                                    )}
                                                    <div className="sf-card-foot">
                                                        {price ? (
                                                            <span className="sf-price">
                                                                {price}
                                                                {oldPrice && <span className="sf-price-old">{oldPrice}</span>}
                                                            </span>
                                                        ) : <span className="sf-card-cat">السعر عند الطلب</span>}

                                                        <button
                                                            className="sf-add-btn"
                                                            onClick={(e) => addToCart(product, e)}
                                                            aria-label="أضف إلى السلة"
                                                        >
                                                            <Icon.Plus />
                                                        </button>
                                                    </div>
                                                </div>
                                            </article>
                                        );
                                    })}
                                </div>
                            )}
                        </section>
                    ))}

                    <div style={{ height: cartCount > 0 ? 130 : 90 }} />
                </div>
            </div>

            {/* ── زر إضافة منتج (للأدمن) ── */}
            {isAdmin && !productForm && !detailProduct && !categoryForm
                && !hoursForm && !showHours && !showAbout && !aboutForm && !logoForm && (
                <button
                    className="sf-fab"
                    style={cartCount > 0 ? { bottom: 'calc(84px + env(safe-area-inset-bottom))' } : undefined}
                    onClick={() => openProductForm()}
                >
                    <Icon.Plus /> منتج جديد
                </button>
            )}

            {/* ── شريط السلة ── */}
            {cartCount > 0 && !productForm && !detailProduct && (
                <button className="sf-cartbar" onClick={() => setShowCart(true)}>
                    <span className="sf-cartbar-left">
                        <span className="sf-cartbar-count">{cartCount}</span>
                        عرض السلة
                    </span>
                    <span className="sf-cartbar-total">{cartTotal > 0 ? formatPrice(cartTotal) : ''}</span>
                </button>
            )}

            {/* ── نافذة قسم جديد ── */}
            {categoryForm && (
                <div className="sf-sheet-backdrop" onClick={() => setCategoryForm(false)}>
                    <div className="sf-sheet" onClick={(e) => e.stopPropagation()}>
                        <div className="sf-sheet-head">
                            <h3>قسم جديد</h3>
                            <button className="sf-icon-btn" onClick={() => setCategoryForm(false)}><Icon.Close /></button>
                        </div>
                        <div className="sf-sheet-body">
                            <div className="sf-field">
                                <label>اسم القسم</label>
                                <input
                                    className="sf-input"
                                    value={newCategoryName}
                                    onChange={(e) => setNewCategoryName(e.target.value)}
                                    placeholder="مثال: المشروبات، الحلويات، الأجهزة"
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="sf-sheet-foot">
                            <button className="sf-btn sf-btn-ghost" onClick={() => setCategoryForm(false)}>إلغاء</button>
                            <button className="sf-btn sf-btn-primary" onClick={saveCategory} disabled={saving || !newCategoryName.trim()}>
                                {saving ? 'جاري الحفظ…' : 'إضافة القسم'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── جدول ساعات الأسبوع (عرض) ── */}
            {showHours && (
                <div className="sf-sheet-backdrop" onClick={() => setShowHours(false)}>
                    <div className="sf-sheet" onClick={(e) => e.stopPropagation()}>
                        <div className="sf-sheet-head">
                            <h3>ساعات العمل</h3>
                            <button className="sf-icon-btn" onClick={() => setShowHours(false)}><Icon.Close /></button>
                        </div>

                        <div className="sf-sheet-body">
                            {status && (
                                <div className={`sf-status sf-status-block ${status.isOpen ? 'is-open' : 'is-closed'}`}>
                                    <span className="sf-status-dot" />
                                    {status.label}
                                </div>
                            )}

                            {hasHours ? (
                                <ul className="sf-week">
                                    {DAYS.map(day => {
                                        const d = week[day];
                                        const isToday = day === status?.today;
                                        return (
                                            <li key={day} className={`sf-week-row ${isToday ? 'is-today' : ''}`}>
                                                <span className="sf-week-day">
                                                    {day}
                                                    {isToday && <em>اليوم</em>}
                                                </span>
                                                <span className={`sf-week-time ${!d || d.closed ? 'is-off' : ''}`}>
                                                    {!d || d.closed ? 'مغلق' : `${d.open} - ${d.close}`}
                                                </span>
                                            </li>
                                        );
                                    })}
                                </ul>
                            ) : (
                                <p className="sf-detail-desc">لم يحدّد المحل ساعات عمله بعد.</p>
                            )}
                        </div>

                        {isAdmin && (
                            <div className="sf-sheet-foot">
                                <button className="sf-btn sf-btn-ghost" onClick={() => setShowHours(false)}>إغلاق</button>
                                <button className="sf-btn sf-btn-primary" onClick={openHoursForm}>تعديل الجدول</button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── تحرير جدول الأسبوع (للأدمن) ── */}
            {hoursForm && (
                <div className="sf-sheet-backdrop" onClick={() => setHoursForm(null)}>
                    <div className="sf-sheet" onClick={(e) => e.stopPropagation()}>
                        <div className="sf-sheet-head">
                            <h3>ساعات العمل الأسبوعية</h3>
                            <button className="sf-icon-btn" onClick={() => setHoursForm(null)}><Icon.Close /></button>
                        </div>

                        <div className="sf-sheet-body">
                            <div className="sf-editor">
                                {DAYS.map(day => {
                                    const d = hoursForm[day];
                                    return (
                                        <div key={day} className={`sf-editor-row ${d.closed ? 'is-off' : ''}`}>
                                            <div className="sf-editor-head">
                                                <label className="sf-switch">
                                                    <input
                                                        type="checkbox"
                                                        checked={!d.closed}
                                                        onChange={(e) => setDay(day, { closed: !e.target.checked })}
                                                    />
                                                    <span className="sf-switch-track"><i /></span>
                                                    <span className="sf-switch-label">{day}</span>
                                                </label>

                                                {!d.closed && (
                                                    <button
                                                        type="button"
                                                        className="sf-editor-copy"
                                                        onClick={() => applyToAllDays(day)}
                                                        title="نسخ هذا التوقيت لكل الأيام"
                                                    >
                                                        تطبيق على الكل
                                                    </button>
                                                )}
                                            </div>

                                            {d.closed ? (
                                                <span className="sf-editor-off">مغلق</span>
                                            ) : (
                                                <div className="sf-editor-times">
                                                    <input
                                                        className="sf-input sf-time"
                                                        type="time"
                                                        value={d.open}
                                                        onChange={(e) => setDay(day, { open: e.target.value })}
                                                    />
                                                    <span className="sf-editor-sep">إلى</span>
                                                    <input
                                                        className="sf-input sf-time"
                                                        type="time"
                                                        value={d.close}
                                                        onChange={(e) => setDay(day, { close: e.target.value })}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            <p className="sf-detail-desc" style={{ fontSize: '.8rem' }}>
                                تظهر حالة «مفتوح / مغلق» للزوار تلقائياً حسب توقيت اليوم، ويمكنهم فتح الجدول لرؤية بقية الأيام.
                            </p>
                        </div>

                        <div className="sf-sheet-foot">
                            <button className="sf-btn sf-btn-ghost" onClick={() => setHoursForm(null)}>إلغاء</button>
                            <button className="sf-btn sf-btn-primary" onClick={saveHours} disabled={saving}>
                                {saving ? 'جاري الحفظ…' : 'حفظ الجدول'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── حول المحل ── */}
            {showAbout && (
                <div className="sf-sheet-backdrop" onClick={() => setShowAbout(false)}>
                    <div className="sf-sheet" onClick={(e) => e.stopPropagation()}>
                        <div className="sf-sheet-head">
                            <h3>حول المحل</h3>
                            <button className="sf-icon-btn" onClick={() => setShowAbout(false)}><Icon.Close /></button>
                        </div>

                        <div className="sf-sheet-body">
                            {hasContact ? (
                                <div className="sf-contacts">
                                    {shopData?.contact_phone && (
                                        <a className="sf-contact" href={`tel:${shopData.contact_phone}`}>
                                            <span className="sf-contact-icon"><Icon.Phone width="17" height="17" /></span>
                                            <span className="sf-contact-text">
                                                <b>الهاتف</b>
                                                <em>{shopData.contact_phone}</em>
                                            </span>
                                        </a>
                                    )}

                                    {shopData?.contact_email && (
                                        <a className="sf-contact" href={`mailto:${shopData.contact_email}`}>
                                            <span className="sf-contact-icon"><Icon.Mail /></span>
                                            <span className="sf-contact-text">
                                                <b>البريد الإلكتروني</b>
                                                <em>{shopData.contact_email}</em>
                                            </span>
                                        </a>
                                    )}

                                    {shopData?.contact_website && (
                                        <a
                                            className="sf-contact"
                                            href={normalizeUrl(shopData.contact_website)}
                                            target="_blank"
                                            rel="noreferrer"
                                        >
                                            <span className="sf-contact-icon"><Icon.Globe /></span>
                                            <span className="sf-contact-text">
                                                <b>الموقع الإلكتروني</b>
                                                <em>{shopData.contact_website}</em>
                                            </span>
                                        </a>
                                    )}
                                </div>
                            ) : (
                                <p className="sf-detail-desc">لم يضِف المحل بيانات تواصل بعد.</p>
                            )}
                        </div>

                        {isAdmin && (
                            <div className="sf-sheet-foot">
                                <button className="sf-btn sf-btn-ghost" onClick={() => setShowAbout(false)}>إغلاق</button>
                                <button className="sf-btn sf-btn-primary" onClick={openAboutForm}>
                                    {hasContact ? 'تعديل البيانات' : 'إضافة بيانات'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── تحرير بيانات التواصل ── */}
            {aboutForm && (
                <div className="sf-sheet-backdrop" onClick={() => setAboutForm(null)}>
                    <div className="sf-sheet" onClick={(e) => e.stopPropagation()}>
                        <div className="sf-sheet-head">
                            <h3>بيانات التواصل</h3>
                            <button className="sf-icon-btn" onClick={() => setAboutForm(null)}><Icon.Close /></button>
                        </div>

                        <div className="sf-sheet-body">
                            <div className="sf-field">
                                <label>رقم الهاتف</label>
                                <input
                                    className="sf-input"
                                    type="tel"
                                    dir="ltr"
                                    value={aboutForm.contact_phone}
                                    onChange={(e) => setAboutForm({ ...aboutForm, contact_phone: e.target.value })}
                                    placeholder="0599 000 000"
                                />
                            </div>

                            <div className="sf-field">
                                <label>البريد الإلكتروني <span className="sf-opt">(اختياري)</span></label>
                                <input
                                    className="sf-input"
                                    type="email"
                                    dir="ltr"
                                    value={aboutForm.contact_email}
                                    onChange={(e) => setAboutForm({ ...aboutForm, contact_email: e.target.value })}
                                    placeholder="shop@example.com"
                                />
                            </div>

                            <div className="sf-field">
                                <label>الموقع الإلكتروني <span className="sf-opt">(اختياري)</span></label>
                                <input
                                    className="sf-input"
                                    type="url"
                                    dir="ltr"
                                    value={aboutForm.contact_website}
                                    onChange={(e) => setAboutForm({ ...aboutForm, contact_website: e.target.value })}
                                    placeholder="example.com"
                                />
                            </div>
                        </div>

                        <div className="sf-sheet-foot">
                            <button className="sf-btn sf-btn-ghost" onClick={() => setAboutForm(null)}>إلغاء</button>
                            <button className="sf-btn sf-btn-primary" onClick={saveAbout} disabled={saving}>
                                {saving ? 'جاري الحفظ…' : 'حفظ'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── ضبط شعار المحل داخل الدائرة ── */}
            {logoForm && (
                <LogoCropper
                    form={logoForm}
                    setForm={setLogoForm}
                    saving={saving}
                    onCancel={() => setLogoForm(null)}
                    onSave={saveLogo}
                />
            )}

            {/* ── نافذة منتج (إضافة / تعديل) ── */}
            {productForm && (
                <div className="sf-sheet-backdrop" onClick={() => setProductForm(null)}>
                    <form className="sf-sheet" onClick={(e) => e.stopPropagation()} onSubmit={saveProduct}>
                        <div className="sf-sheet-head">
                            <h3>{productForm.id ? 'تعديل المنتج' : 'منتج جديد'}</h3>
                            <button type="button" className="sf-icon-btn" onClick={() => setProductForm(null)}><Icon.Close /></button>
                        </div>

                        <div className="sf-sheet-body">
                            <div className="sf-field">
                                <label>صور المنتج <span className="sf-opt">(صورة واحدة أو أكثر)</span></label>
                                <div className="sf-uploader">
                                    {productForm.existingImages.map((img, i) => (
                                        <div className="sf-thumb" key={`old-${i}`}>
                                            <img src={getImageUrl(img)} alt="" />
                                            <button type="button" className="sf-thumb-del" onClick={() => removeExistingImage(i)}>✕</button>
                                        </div>
                                    ))}
                                    {productForm.previews.map((src, i) => (
                                        <div className="sf-thumb" key={`new-${i}`}>
                                            <img src={src} alt="" />
                                            <button type="button" className="sf-thumb-del" onClick={() => removeNewImage(i)}>✕</button>
                                        </div>
                                    ))}
                                    {(productForm.existingImages.length + productForm.previews.length) < 6 && (
                                        <div className="sf-thumb-add" onClick={() => fileInputRef.current?.click()}>+</div>
                                    )}
                                </div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    hidden
                                    onChange={pickImages}
                                />
                            </div>

                            <div className="sf-field">
                                <label>اسم المنتج</label>
                                <input
                                    className="sf-input"
                                    value={productForm.name}
                                    onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                                    placeholder="مثال: قهوة عربية"
                                    required
                                />
                            </div>

                            <div className="sf-field">
                                <label>القسم</label>
                                <select
                                    className="sf-select"
                                    value={productForm.category_id}
                                    onChange={(e) => setProductForm({ ...productForm, category_id: e.target.value })}
                                >
                                    <option value="">بدون قسم</option>
                                    {categories.map(cat => (
                                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="sf-row">
                                <div className="sf-field">
                                    <label>السعر <span className="sf-opt">(اختياري)</span></label>
                                    <input
                                        className="sf-input"
                                        type="number"
                                        step="any"
                                        min="0"
                                        value={productForm.price}
                                        onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                                        placeholder="—"
                                    />
                                </div>
                                <div className="sf-field">
                                    <label>قبل الخصم <span className="sf-opt">(اختياري)</span></label>
                                    <input
                                        className="sf-input"
                                        type="number"
                                        step="any"
                                        min="0"
                                        value={productForm.old_price}
                                        onChange={(e) => setProductForm({ ...productForm, old_price: e.target.value })}
                                        placeholder="—"
                                    />
                                </div>
                            </div>

                            <div className="sf-field">
                                <label>الوصف <span className="sf-opt">(اختياري)</span></label>
                                <textarea
                                    className="sf-textarea"
                                    value={productForm.description}
                                    onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                                    placeholder="تفاصيل قصيرة عن المنتج…"
                                />
                            </div>
                        </div>

                        <div className="sf-sheet-foot">
                            <button type="button" className="sf-btn sf-btn-ghost" onClick={() => setProductForm(null)}>إلغاء</button>
                            <button type="submit" className="sf-btn sf-btn-primary" disabled={saving || !productForm.name.trim()}>
                                {saving ? 'جاري الحفظ…' : (productForm.id ? 'حفظ التعديلات' : 'إضافة المنتج')}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* ── تفاصيل المنتج ── */}
            {detailProduct && (
                <ProductDetail
                    product={detailProduct}
                    isAdmin={isAdmin}
                    onClose={() => setDetailProduct(null)}
                    onEdit={(e) => { const p = detailProduct; setDetailProduct(null); openProductForm(p, e); }}
                    onDelete={(e) => removeProduct(detailProduct, e)}
                    onAdd={(e) => { addToCart(detailProduct, e); setDetailProduct(null); }}
                />
            )}

            {/* ── السلة ── */}
            {showCart && <CartModal onClose={() => setShowCart(false)} />}

            {show360 && (
                <Panorama360Viewer
                    shopId={shopData.id}
                    shopName={shopData.name}
                    isAdmin={isAdmin}
                    initialPanoramas={panoramas}
                    onClose={() => setShow360(false)}
                />
            )}
        </div>
    );
};

// ── نافذة تفاصيل المنتج ──────────────────────────────────────
const ProductDetail = ({ product, isAdmin, onClose, onEdit, onDelete, onAdd }) => {
    const [index, setIndex] = useState(0);
    const images = product.images?.length ? product.images : (product.image_url ? [product.image_url] : []);
    const price = formatPrice(product.price);
    const oldPrice = formatPrice(product.old_price);

    const go = (dir, e) => {
        e.stopPropagation();
        setIndex(prev => (prev + dir + images.length) % images.length);
    };

    return (
        <div className="sf-sheet-backdrop" onClick={onClose}>
            <div className="sf-sheet" onClick={(e) => e.stopPropagation()}>
                <div className="sf-sheet-head">
                    <h3>{product.name}</h3>
                    <button className="sf-icon-btn" onClick={onClose}><Icon.Close /></button>
                </div>

                <div className="sf-sheet-body">
                    <div className="sf-detail-media">
                        {images.length ? (
                            <>
                                <img src={getImageUrl(images[index])} alt={product.name} />
                                {images.length > 1 && (
                                    <>
                                        <button className="sf-detail-nav prev" onClick={(e) => go(-1, e)} aria-label="السابق">
                                            <Icon.Chevron />
                                        </button>
                                        <button className="sf-detail-nav next" onClick={(e) => go(1, e)} aria-label="التالي">
                                            <Icon.Chevron style={{ transform: 'rotate(180deg)' }} />
                                        </button>
                                        <div className="sf-detail-dots">
                                            {images.map((_, i) => <i key={i} className={i === index ? 'is-active' : ''} />)}
                                        </div>
                                    </>
                                )}
                            </>
                        ) : (
                            <div className="sf-card-placeholder"><Icon.Image /></div>
                        )}
                    </div>

                    {product.category_name && <span className="sf-card-cat">{product.category_name}</span>}

                    {price && (
                        <div>
                            <span className="sf-price" style={{ fontSize: '1.3rem' }}>{price}</span>
                            {oldPrice && <span className="sf-price-old">{oldPrice}</span>}
                        </div>
                    )}

                    {product.description && <p className="sf-detail-desc">{product.description}</p>}
                </div>

                <div className="sf-sheet-foot">
                    {isAdmin && (
                        <>
                            <button className="sf-btn sf-btn-ghost" onClick={onEdit}>تعديل</button>
                            <button className="sf-btn sf-btn-ghost" style={{ color: '#f87171' }} onClick={onDelete}>حذف</button>
                        </>
                    )}
                    <button className="sf-btn sf-btn-primary" onClick={onAdd}>أضف إلى السلة</button>
                </div>
            </div>
        </div>
    );
};

export default ShopStorefront;
