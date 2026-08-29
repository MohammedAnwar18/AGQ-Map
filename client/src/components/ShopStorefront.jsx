import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { shopService, getImageUrl } from '../services/api';
import { optimizeImage } from '../utils/imageOptimizer';
import { cartService } from '../services/cartService';
import CartModal from './CartModal';
import './ShopStorefront.css';

/* ============================================================
   واجهة المحل — صفحة عرض المنتجات
   • شاشة دخول قصيرة (١.٥ ثانية) بشعار المحل في المنتصف
   • ترويسة: الشعار، الاسم، حالة الفتح، تصنيف المحل، ساعات العمل
   • المنتجات مقسّمة إلى أقسام يديرها صاحب المحل
   ============================================================ */

const ENTRY_DURATION = 1500; // ١.٥ ثانية كما طُلب
const ALL_KEY = '__all__';

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
    Chevron: (p) => (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
            <polyline points="15 18 9 12 15 6" />
        </svg>
    )
};

// ── حالة المحل (مفتوح / مغلق) من نص ساعات العمل ─────────────
const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

const parseTodayHours = (openingHours) => {
    if (!openingHours) return null;
    const today = DAYS[new Date().getDay()];
    const match = openingHours.match(new RegExp(`${today}:\\s*(.*)`));
    if (!match) return null;

    const range = match[1].trim();
    if (range.includes('مغلق')) return { isOpen: false, label: 'مغلق اليوم', range: null };

    const times = range.match(/(\d{1,2}):(\d{2})\s*(صباحاً|مساءً)?\s*-\s*(\d{1,2}):(\d{2})\s*(صباحاً|مساءً)?/);
    if (!times) return null;

    const [, h1, m1, p1, h2, m2, p2] = times;
    let startH = parseInt(h1, 10);
    if (p1?.includes('مساء') && startH !== 12) startH += 12;
    if (p1?.includes('صباح') && startH === 12) startH = 0;
    let endH = parseInt(h2, 10);
    if (p2?.includes('مساء') && endH !== 12) endH += 12;
    if (p2?.includes('صباح') && endH === 12) endH = 0;

    const now = new Date();
    const cur = now.getHours() * 60 + now.getMinutes();
    const start = startH * 60 + parseInt(m1, 10);
    const end = endH * 60 + parseInt(m2, 10);
    const isOpen = end > start ? (cur >= start && cur <= end) : (cur >= start || cur <= end);

    const two = (n) => String(n).padStart(2, '0');
    return {
        isOpen,
        label: isOpen ? 'مفتوح الآن' : 'مغلق الآن',
        range: `${two(startH)}:${m1} - ${two(endH)}:${m2}`
    };
};

const formatPrice = (value) => {
    const num = parseFloat(value);
    if (Number.isNaN(num)) return null;
    return `${num % 1 === 0 ? num.toFixed(0) : num.toFixed(2)} ₪`;
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
    const [cartTotal, setCartTotal] = useState(0);

    const [detailProduct, setDetailProduct] = useState(null);
    const [productForm, setProductForm] = useState(null); // null | {} = نموذج مفتوح
    const [categoryForm, setCategoryForm] = useState(false);
    const [hoursForm, setHoursForm] = useState(null); // { open, close }
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
        const parsed = parseTodayHours(shopData?.opening_hours);
        const [open, close] = (parsed?.range || '09:00 - 21:00').split(' - ');
        setHoursForm({ open: open || '09:00', close: close || '21:00' });
    };

    const saveHours = async () => {
        if (!hoursForm?.open || !hoursForm?.close) return;
        setSaving(true);
        try {
            // نطبّق نفس التوقيت على كل أيام الأسبوع
            const text = DAYS.map(day => `${day}: ${hoursForm.open} - ${hoursForm.close}`).join('\n');
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
    const status = parseTodayHours(shopData?.opening_hours);
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

                <button
                    className="sf-icon-btn sf-cart-btn"
                    onClick={() => setShowCart(true)}
                    aria-label="سلة التسوق"
                >
                    <Icon.Cart />
                    {cartCount > 0 && <span className="sf-cart-badge">{cartCount}</span>}
                </button>
            </header>

            {/* ── جسم الصفحة ── */}
            <div className="sf-scroll" ref={scrollRef} onScroll={handleScroll}>
                <div className="sf-inner">

                    {/* ترويسة المحل */}
                    <section className="sf-header">
                        <div className="sf-avatar">
                            {logo
                                ? <img src={logo} alt={shopData?.name || ''} />
                                : <span className="sf-initial">{initial}</span>}
                        </div>

                        <h1 className="sf-name">{shopData?.name}</h1>

                        {shopData?.category && (
                            <p className="sf-category">{shopData.category}</p>
                        )}

                        {status && (
                            <div className={`sf-status ${status.isOpen ? 'is-open' : 'is-closed'}`}>
                                <span className="sf-status-dot" />
                                {status.label}
                            </div>
                        )}

                        {status?.range && (
                            <div className="sf-hours">
                                <Icon.Clock />
                                ساعات اليوم <strong>{status.range}</strong>
                            </div>
                        )}

                        {isAdmin && (
                            <button className="sf-hours" style={{ cursor: 'pointer', color: 'var(--sf-gold)' }} onClick={openHoursForm}>
                                <Icon.Clock />
                                {shopData?.opening_hours ? 'تعديل ساعات العمل' : 'إضافة ساعات العمل'}
                            </button>
                        )}
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
            {isAdmin && !productForm && !detailProduct && !categoryForm && !hoursForm && (
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

            {/* ── نافذة ساعات العمل ── */}
            {hoursForm && (
                <div className="sf-sheet-backdrop" onClick={() => setHoursForm(null)}>
                    <div className="sf-sheet" onClick={(e) => e.stopPropagation()}>
                        <div className="sf-sheet-head">
                            <h3>ساعات العمل</h3>
                            <button className="sf-icon-btn" onClick={() => setHoursForm(null)}><Icon.Close /></button>
                        </div>
                        <div className="sf-sheet-body">
                            <div className="sf-row">
                                <div className="sf-field">
                                    <label>وقت الفتح</label>
                                    <input
                                        className="sf-input"
                                        type="time"
                                        value={hoursForm.open}
                                        onChange={(e) => setHoursForm({ ...hoursForm, open: e.target.value })}
                                        style={{ direction: 'ltr', textAlign: 'center' }}
                                    />
                                </div>
                                <div className="sf-field">
                                    <label>وقت الإغلاق</label>
                                    <input
                                        className="sf-input"
                                        type="time"
                                        value={hoursForm.close}
                                        onChange={(e) => setHoursForm({ ...hoursForm, close: e.target.value })}
                                        style={{ direction: 'ltr', textAlign: 'center' }}
                                    />
                                </div>
                            </div>
                            <p className="sf-detail-desc" style={{ fontSize: '.82rem' }}>
                                يُطبَّق هذا التوقيت على كل أيام الأسبوع، وتظهر حالة «مفتوح / مغلق» للزوار تلقائياً.
                            </p>
                        </div>
                        <div className="sf-sheet-foot">
                            <button className="sf-btn sf-btn-ghost" onClick={() => setHoursForm(null)}>إلغاء</button>
                            <button className="sf-btn sf-btn-primary" onClick={saveHours} disabled={saving}>
                                {saving ? 'جاري الحفظ…' : 'حفظ'}
                            </button>
                        </div>
                    </div>
                </div>
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
