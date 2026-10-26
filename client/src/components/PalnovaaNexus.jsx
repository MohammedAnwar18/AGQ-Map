import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';

import nexusService, { nexusError } from '../services/nexusApi';
import { getImageUrl } from '../services/api';
import NexusProduct, { LazyShot } from './NexusProduct';
import './PalnovaaNexus.css';

/* ============================================================
   بالنوفا نكسس

   كتالوج مركزي: الأدمن العام يبنيه، وصاحب المحلّ يأخذ منه.

   الضغطة الواحدة هي كل الميزة — «أضفه لمحلّي» ثم يختار التصنيف
   في محلّه، فيظهر المنتج في محلّه فوراً. وكل ما عدا ذلك في هذا
   الملفّ خدمةٌ لتلك الضغطة: ألّا تتكرّر، وأن تقول أين وقعت، وأن
   تعمل بإبهام واحد على هاتف وبفأرة على حاسوب.

   ولا تحميل كامل بعد كل إضافة: الحالة تُحدَّث محلّياً ممّا أعاده
   الخادم. طلبُ الكتالوج كلّه بعد كل ضغطة يجعل القسم يرتجف.
   ============================================================ */

const UNCATEGORIZED = '__none__';

/* أقصى ما يُرسل في دفعة — وهو سقف الخادم نفسه ‎(MAX_ADOPT)‎.
   واختلافهما يعني رفضاً من الخادم بعد أن وعدته الواجهة */
const MAX_PICK = 120;

const price = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const num = Number(value);
    if (!Number.isFinite(num)) return null;

    // بلا كسور حين لا تكون هناك كسور: «١٢ ₪» لا «١٢٫٠٠ ₪»
    const shown = Number.isInteger(num) ? num : num.toFixed(2);
    return `${shown} ₪`;
};

/**
 * يرصد أين وقف الشريط من طرفيه.
 *
 * يُستعمل لإظهار التلاشي عند الحافّة: من لا يرى علامةً لا يعرف أنّ
 * الشريط يُسحب. ويُقاس بالبكسلات لا بالنسبة لأنّ ‎RTL‎ يجعل
 * ‎scrollLeft‎ سالباً في بعض المتصفّحات وموجباً في غيرها — والقيمة
 * المطلقة تُنهي الفرق.
 */
const useEdges = () => {
    const rail = useRef(null);
    const [edges, setEdges] = useState({ start: false, end: false });

    const measure = useCallback(() => {
        const node = rail.current;
        if (!node) return;

        const slack = node.scrollWidth - node.clientWidth;

        // لا فيض؟ لا تلاشي من أي طرف
        if (slack <= 2) { setEdges({ start: false, end: false }); return; }

        const at = Math.abs(node.scrollLeft);
        setEdges({ start: at > 2, end: at < slack - 2 });
    }, []);

    useEffect(() => {
        const node = rail.current;
        if (!node) return undefined;

        measure();
        node.addEventListener('scroll', measure, { passive: true });

        /* تغيّر عدد الرقاقات — بإضافة تصنيف أو حذفه — يغيّر الفيض.
           و‎ResizeObserver‎ يرصده بلا أن نُراقب الحالة من الخارج */
        let watcher = null;
        if (typeof ResizeObserver !== 'undefined') {
            watcher = new ResizeObserver(measure);
            watcher.observe(node);
            for (const child of node.children) watcher.observe(child);
        }

        window.addEventListener('resize', measure);

        return () => {
            node.removeEventListener('scroll', measure);
            window.removeEventListener('resize', measure);
            watcher?.disconnect();
        };
    }, [measure]);

    /**
     * يجرّ الشريط بمقدار ثلاثة أرباع عرضه.
     *
     * لا بمقدار ثابت: شاشة عريضة تُظهر عشر رقاقات وضيقة ثلاثاً،
     * والمقدار الثابت يقفز في الأولى ويزحف في الثانية. والربع
     * الباقي يُبقي رقاقةً مشتركة بين المنظرين فلا يُفقد السياق.
     *
     * و‎dir‎ هنا منطقيّ لا بصريّ: ‎-1‎ يعني «ما قبل» في ترتيب القراءة،
     * وفي ‎RTL‎ هو إلى اليمين. و‎scrollBy‎ يحترم الاتّجاه فلا نقلبه.
     */
    const nudge = useCallback((dir) => {
        const node = rail.current;
        if (!node) return;

        const step = Math.max(140, node.clientWidth * 0.75);
        node.scrollBy({ left: dir * step, behavior: 'smooth' });
    }, []);

    return { rail, edges, measure, nudge };
};

/* ============================================================
   بطاقة منتج
   ============================================================ */

const ProductCard = ({
    product, mine, canAdopt, isAdmin, picked,
    onAdopt, onPick, onOpen, onEdit, onRemove, onToggle
}) => {
    const image = getImageUrl(product.image_url);
    const tag = price(product.price);

    return (
        <article className={`pnx-card${mine ? ' is-mine' : ''}${picked ? ' is-picked' : ''}`}>
            {/*
              * منطقة الصورة.
              *
              * فيها فعلان: الضغط يفتح المنتج، ومربّع التحديد يحدّده.
              * وهما زرّان **مجاوران** لا متداخلان: زرٌّ داخل زرّ غير
              * صالح في ‎HTML‎ ولا يصل إليه التنقّل بلوحة المفاتيح،
              * وبعض المتصفّحات تُخرجه من مكانه.
              *
              * فالفتح طبقةٌ تملأ المنطقة تحت التحديد، والتحديد فوقها.
              */}
            <div className="pnx-shot">
                <LazyShot
                    src={image}
                    alt={product.name}
                    fallback={product.name.trim().charAt(0) || '؟'}
                />

                <button
                    className="pnx-open"
                    onClick={() => onOpen(product)}
                    aria-label={`اعرض ${product.name}`}
                />

                {tag && <b className="pnx-tag">{tag}</b>}
                {isAdmin && !product.is_active && <span className="pnx-off">مخفيّ</span>}

                {/* التحديد فوق طبقة الفتح: أوسع هدف في البطاقة */}
                {canAdopt ? (
                    <>
                        <button
                            className={`pnx-pick${picked ? ' is-on' : ''}`}
                            onClick={() => onPick(product)}
                            aria-pressed={picked}
                            aria-label={picked ? `أزل ${product.name} من المحدَّد` : `حدّد ${product.name}`}
                        >
                            {picked ? '✓' : ''}
                        </button>

                        {mine && <span className="pnx-have is-corner">عندك ✓</span>}
                    </>
                ) : (
                    mine && <span className="pnx-have">عندك ✓</span>
                )}
            </div>

            <div className="pnx-body">
                <h4 title={product.name}>{product.name}</h4>
                {product.description && <p>{product.description}</p>}

                {canAdopt && (
                    <button
                        className={`pnx-add${mine ? ' is-done' : ''}`}
                        onClick={() => onAdopt(product)}
                    >
                        {mine ? 'أضفه مرّة أخرى' : 'أضفه لمحلّي'}
                    </button>
                )}

                {isAdmin && (
                    <div className="pnx-admin-row">
                        <button onClick={() => onEdit(product)}>تعديل</button>
                        <button onClick={() => onToggle(product)}>
                            {product.is_active ? 'إخفاء' : 'إظهار'}
                        </button>
                        <button className="pnx-danger" onClick={() => onRemove(product)}>حذف</button>
                    </div>
                )}
            </div>
        </article>
    );
};

/* ============================================================
   ورقة الإضافة — أين يوضع المنتج في محلّك
   ============================================================ */

const AdoptSheet = ({ items, shops, onClose, onDone, onError }) => {
    /*
     * ورقة واحدة للحالتين.
     *
     * المحلّ والتصنيف سؤالان واحدان مهما كان العدد، فلا داعي لورقة
     * ثانية تُكرّرهما ثم تنحرف عنها. والفرق الوحيد سعرٌ واحد: لا معنى
     * لحقل سعر لعشرين منتجاً مختلفاً، فيظهر للواحد ويغيب للجمع.
     */
    const many = items.length > 1;
    const product = items[0];

    const [shopId, setShopId] = useState(shops[0]?.id || null);
    const [categories, setCategories] = useState([]);
    const [pick, setPick] = useState(null);          // معرّف تصنيف موجود
    const [fresh, setFresh] = useState('');          // أو اسم تصنيف جديد
    const [cost, setCost] = useState(product.price ?? '');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    /*
     * تصنيفات المحلّ المختار.
     *
     * تُقرأ عند كل تغيير محلّ لا مرّة واحدة: صاحب محلّين لكل منهما
     * تصنيفاته، وعرضُ تصنيفات الأوّل على الثاني يضع المنتج في
     * المكان الخطأ بلا أن يلاحظ.
     */
    useEffect(() => {
        if (!shopId) return undefined;

        let alive = true;
        setLoading(true);
        setPick(null);
        setFresh('');

        nexusService.shopCategories(shopId)
            .then(data => { if (alive) setCategories(data.categories || []); })
            .catch(err => { if (alive) onError(nexusError(err, 'تعذّر تحميل تصنيفات المحلّ')); })
            .finally(() => { if (alive) setLoading(false); });

        return () => { alive = false; };
    }, [shopId, onError]);

    const submit = async () => {
        if (!shopId) { onError('اختر المحلّ أوّلاً'); return; }

        setSaving(true);
        try {
            const payload = { shop_id: shopId };

            // تصنيف موجود أو اسم جديد — والخادم يُنشئه إن لم يكن
            if (pick) payload.category_id = pick;
            else if (fresh.trim()) payload.category = fresh.trim();

            const result = many
                ? await nexusService.adoptMany({ ...payload, product_ids: items.map(i => i.id) })
                : await nexusService.adopt(product.id, { ...payload, price: cost === '' ? '' : cost });

            onDone(result, items);
        } catch (err) {
            onError(nexusError(err, 'تعذّرت الإضافة'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="pnx-sheet-wrap" role="dialog" aria-label="أضف إلى محلّك">
            <button className="pnx-scrim" onClick={onClose} aria-label="إغلاق" />

            <div className="pnx-sheet">
                <div className="pnx-sheet-grip" />

                <header className="pnx-sheet-head">
                    {many ? (
                        /* ثلاث صور مكدّسة: يرى ما حدّده قبل أن يؤكّد */
                        <span className="pnx-stack">
                            {items.slice(0, 3).map(item => (
                                getImageUrl(item.image_url)
                                    ? <img key={item.id} src={getImageUrl(item.image_url)} alt="" />
                                    : <i key={item.id}>{item.name.trim().charAt(0) || '؟'}</i>
                            ))}
                        </span>
                    ) : getImageUrl(product.image_url) && (
                        <img src={getImageUrl(product.image_url)} alt="" />
                    )}

                    <div>
                        <b>{many ? `${items.length} منتجاً محدّداً` : product.name}</b>
                        <span>
                            {many
                                ? 'كلّها تُضاف إلى محلّ واحد وتصنيف واحد'
                                : 'اختر المحلّ والتصنيف الذي يظهر فيه'}
                        </span>
                    </div>
                </header>

                <div className="pnx-sheet-body">
                    {shops.length > 1 && (
                        <section>
                            <label>المحلّ</label>
                            <div className="pnx-chips">
                                {shops.map(shop => (
                                    <button
                                        key={shop.id}
                                        className={shopId === shop.id ? 'is-on' : ''}
                                        onClick={() => setShopId(shop.id)}
                                    >
                                        {shop.name}
                                    </button>
                                ))}
                            </div>
                        </section>
                    )}

                    <section>
                        <label>
                            التصنيف في محلّك
                            {loading && <i className="pnx-mini-spin" />}
                        </label>

                        <div className="pnx-chips">
                            {categories.map(cat => (
                                <button
                                    key={cat.id}
                                    className={pick === cat.id ? 'is-on' : ''}
                                    onClick={() => { setPick(cat.id); setFresh(''); }}
                                >
                                    {cat.name}
                                </button>
                            ))}

                            {!loading && !categories.length && (
                                <span className="pnx-hint">لا تصنيفات في هذا المحلّ بعد — اكتب واحداً.</span>
                            )}
                        </div>

                        <input
                            className="pnx-field"
                            value={fresh}
                            onChange={(e) => { setFresh(e.target.value.slice(0, 60)); setPick(null); }}
                            placeholder="أو تصنيف جديد — مشروبات، حلويات…"
                        />
                        <span className="pnx-hint">اتركه فارغاً فيُضاف بلا تصنيف.</span>
                    </section>

                    {many ? (
                        <section>
                            <label>ما سيُضاف</label>
                            <ul className="pnx-picked-list">
                                {items.map(item => (
                                    <li key={item.id}>
                                        <span>{item.name}</span>
                                        <b>{price(item.price) || 'بلا سعر'}</b>
                                    </li>
                                ))}
                            </ul>
                            <span className="pnx-hint">
                                تُؤخذ أسعار الكتالوج كما هي، وتُعدّلها في محلّك بعد الإضافة.
                                وما هو عندك سلفاً يُتجاوز بلا تكرار.
                            </span>
                        </section>
                    ) : (
                        <section>
                            <label>سعرك (اختياري)</label>
                            <input
                                className="pnx-field"
                                type="number"
                                inputMode="decimal"
                                min="0"
                                step="0.5"
                                value={cost}
                                onChange={(e) => setCost(e.target.value)}
                                placeholder="بلا سعر"
                            />
                            <span className="pnx-hint">
                                {product.price !== null && product.price !== undefined
                                    ? `سعر الكتالوج ${price(product.price)} — غيّره كما يناسب محلّك.`
                                    : 'لا سعر في الكتالوج — ضع سعرك أو اتركه فارغاً.'}
                            </span>
                        </section>
                    )}
                </div>

                <footer className="pnx-sheet-foot">
                    <button className="pnx-primary" onClick={submit} disabled={saving || !shopId}>
                        {saving ? 'يُضاف…' : many ? `أضف ${items.length} منتجاً` : 'أضفه الآن'}
                    </button>
                    <button onClick={onClose} disabled={saving}>رجوع</button>
                </footer>
            </div>
        </div>
    );
};

/* ============================================================
   نموذج الأدمن — منتج أو تصنيف
   ============================================================ */

const AdminForm = ({ kind, editing, categories, onClose, onSaved, onError }) => {
    const isProduct = kind === 'product';

    const [name, setName] = useState(editing?.name || '');
    const [cost, setCost] = useState(editing?.price ?? '');
    const [note, setNote] = useState(editing?.description || '');
    const [categoryId, setCategoryId] = useState(editing?.category_id || '');
    const [files, setFiles] = useState([]);
    const [preview, setPreview] = useState(getImageUrl(editing?.image_url) || null);
    const [saving, setSaving] = useState(false);
    const fileInput = useRef(null);

    /* روابط المعاينة تُلغى عند التبديل — وإلّا تراكمت في الذاكرة */
    useEffect(() => {
        if (!files.length) return undefined;

        const url = URL.createObjectURL(files[0]);
        setPreview(url);
        return () => URL.revokeObjectURL(url);
    }, [files]);

    const submit = async () => {
        if (!name.trim()) { onError('الاسم مطلوب'); return; }

        setSaving(true);
        try {
            let saved;

            if (isProduct) {
                const fields = {
                    name: name.trim(),
                    price: cost === '' ? '' : cost,
                    description: note.trim(),
                    category_id: categoryId === '' ? '' : categoryId
                };
                saved = editing
                    ? await nexusService.updateProduct(editing.id, fields, files)
                    : await nexusService.addProduct(fields, files);
            } else {
                const fields = { name: name.trim() };
                saved = editing
                    ? await nexusService.updateCategory(editing.id, fields, files[0])
                    : await nexusService.addCategory(fields, files[0]);
            }

            onSaved(saved);
        } catch (err) {
            onError(nexusError(err, 'تعذّر الحفظ'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="pnx-sheet-wrap" role="dialog">
            <button className="pnx-scrim" onClick={onClose} aria-label="إغلاق" />

            <div className="pnx-sheet">
                <div className="pnx-sheet-grip" />

                <header className="pnx-sheet-head is-plain">
                    <div>
                        <b>
                            {editing ? 'تعديل ' : 'إضافة '}
                            {isProduct ? 'منتج' : 'تصنيف'}
                        </b>
                        <span>
                            {isProduct
                                ? 'الصورة والاسم يكفيان — والسعر اختياري'
                                : 'التصنيف الذي تُرتَّب تحته المنتجات في الكتالوج'}
                        </span>
                    </div>
                </header>

                <div className="pnx-sheet-body">
                    <section>
                        <label>{isProduct ? 'صورة المنتج' : 'صورة التصنيف (اختيارية)'}</label>

                        <button className="pnx-drop" onClick={() => fileInput.current?.click()}>
                            {preview
                                ? <img src={preview} alt="" />
                                : <span>اختر صورة</span>}
                        </button>

                        <input
                            ref={fileInput}
                            type="file"
                            accept="image/*"
                            multiple={isProduct}
                            hidden
                            onChange={(e) => setFiles(Array.from(e.target.files || []).slice(0, 5))}
                        />
                    </section>

                    <section>
                        <label>الاسم</label>
                        <input
                            className="pnx-field"
                            value={name}
                            onChange={(e) => setName(e.target.value.slice(0, 160))}
                            placeholder={isProduct ? 'قهوة مختصّة' : 'مشروبات ساخنة'}
                            autoFocus
                        />
                    </section>

                    {isProduct && (
                        <>
                            <section>
                                <label>السعر (اختياري)</label>
                                <input
                                    className="pnx-field"
                                    type="number"
                                    inputMode="decimal"
                                    min="0"
                                    step="0.5"
                                    value={cost}
                                    onChange={(e) => setCost(e.target.value)}
                                    placeholder="بلا سعر"
                                />
                                <span className="pnx-hint">
                                    اتركه فارغاً ويبقى المنتج بلا سعر — ولصاحب المحلّ أن يضع سعره.
                                </span>
                            </section>

                            <section>
                                <label>التصنيف</label>
                                <div className="pnx-chips">
                                    <button
                                        className={categoryId === '' ? 'is-on' : ''}
                                        onClick={() => setCategoryId('')}
                                    >
                                        بلا تصنيف
                                    </button>
                                    {categories.map(cat => (
                                        <button
                                            key={cat.id}
                                            className={String(categoryId) === String(cat.id) ? 'is-on' : ''}
                                            onClick={() => setCategoryId(cat.id)}
                                        >
                                            {cat.name}
                                        </button>
                                    ))}
                                </div>
                            </section>

                            <section>
                                <label>وصف قصير (اختياري)</label>
                                <textarea
                                    className="pnx-field"
                                    rows={3}
                                    value={note}
                                    onChange={(e) => setNote(e.target.value.slice(0, 600))}
                                    placeholder="ما يميّزه"
                                />
                            </section>
                        </>
                    )}
                </div>

                <footer className="pnx-sheet-foot">
                    <button className="pnx-primary" onClick={submit} disabled={saving}>
                        {saving ? 'يُحفظ…' : 'احفظ'}
                    </button>
                    <button onClick={onClose} disabled={saving}>رجوع</button>
                </footer>
            </div>
        </div>
    );
};

/* ============================================================ */

const PalnovaaNexus = ({ user, onClose }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [problem, setProblem] = useState(null);
    const [notice, setNotice] = useState(null);

    const [active, setActive] = useState('all');
    const [query, setQuery] = useState('');

    const [viewing, setViewing] = useState(null);     // منتج يُعرض مكبّراً
    const [adopting, setAdopting] = useState(null);   // مصفوفة منتجات
    const [form, setForm] = useState(null);           // { kind, editing }

    /*
     * المحدَّد — مجموعة معرّفات.
     *
     * ‎Set‎ لا مصفوفة: الإضافة والحذف والسؤال «أهو محدّد؟» كلّها
     * ثابتة الزمن، والسؤال يُطرح لكل بطاقة في كل إعادة رسم.
     */
    const [marks, setMarks] = useState(() => new Set());

    /* طرفا شريط التصنيفات — لإظهار التلاشي الذي يقول إنّه يُسحب */
    const { rail, edges, measure, nudge } = useEdges();

    const isAdmin = Boolean(data?.is_admin) || user?.role === 'admin';
    const shops = data?.shops || [];

    const flash = useCallback((message, kind = 'ok') => setNotice({ message, kind }), []);
    const fail = useCallback((message) => flash(message, 'err'), [flash]);

    useEffect(() => {
        if (!notice) return undefined;
        const t = setTimeout(() => setNotice(null), 3400);
        return () => clearTimeout(t);
    }, [notice]);

    const load = useCallback(async () => {
        setLoading(true);
        setProblem(null);
        try {
            setData(await nexusService.catalog());
        } catch (err) {
            setProblem(nexusError(err, 'تعذّر تحميل نكسس'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    /*
     * الفلترة والبحث في مرور واحد.
     *
     * يُعاد حسابها عند تغيّر التصنيف أو البحث أو الكتالوج فقط —
     * لا في كل إعادة رسم، فالكتابة في البحث تُعيد الرسم حرفاً بحرف.
     */
    const shown = useMemo(() => {
        const all = data?.products || [];
        const needle = query.trim().toLowerCase();

        return all.filter(p => {
            if (active === UNCATEGORIZED && p.category_id) return false;
            if (active !== 'all' && active !== UNCATEGORIZED && String(p.category_id) !== String(active)) return false;

            if (!needle) return true;
            return `${p.name} ${p.description || ''} ${p.category_name || ''}`.toLowerCase().includes(needle);
        });
    }, [data, active, query]);

    /*
     * ما حُدّد ثمّ خرج من العرض — بتغيير تصنيف أو بحث — يبقى محدَّداً.
     *
     * وهذا مقصود: من يحدّد من «مشروبات» ثمّ ينتقل إلى «حلويات»
     * ليحدّد منها يريد الاثنين. لكنّ ما حُذف من الكتالوج يُسقط، وإلّا
     * أُرسل معرّف لا وجود له.
     */
    /* قائمة جديدة تعني عرضاً جديداً للشريط، فيُعاد قياس طرفيه */
    useEffect(() => { measure(); }, [data?.categories, measure]);

    useEffect(() => {
        if (!data?.products || !marks.size) return;

        const alive = new Set(data.products.map(p => p.id));
        const stale = [...marks].filter(id => !alive.has(id));
        if (stale.length) setMarks(prev => new Set([...prev].filter(id => alive.has(id))));
    }, [data, marks]);

    /* المحدَّد الظاهر الآن — عليه يعمل «حدّد الكلّ» */
    const markedHere = useMemo(
        () => shown.filter(p => marks.has(p.id)).length,
        [shown, marks]
    );

    const loose = useMemo(
        () => (data?.products || []).some(p => !p.category_id),
        [data]
    );

    // ── بعد الإضافة إلى محلّ ──
    const toggleMark = useCallback((product) => {
        setMarks(prev => {
            const next = new Set(prev);
            if (next.has(product.id)) next.delete(product.id);
            else next.add(product.id);
            return next;
        });
    }, []);

    const clearMarks = useCallback(() => setMarks(new Set()), []);

    const adopted = useCallback((result, items) => {
        setAdopting(null);

        if (!result?.success) return;

        flash(result.message || 'أُضيف المنتج', result.duplicate ? 'warn' : 'ok');

        /*
         * علامة «عندك» فوراً بلا إعادة تحميل الكتالوج.
         *
         * والدفعة تُعلّم ما أُضيف وما تُجوِّز معاً: المتجاوَز موجود
         * عند صاحب المحلّ فعلاً، وإخفاء العلامة عنه يجعله يحاول ثانيةً.
         */
        const touched = result.added
            ? [
                ...result.added.map(a => a.id),
                // المتجاوَز لأنّه موجود عنده يُعلَّم، وما لم يُوجد في
                // الكتالوج لا يُعلَّم: ليس عنده ولم يُضف
                ...(result.skipped || []).filter(sk => sk.code === 'duplicate').map(sk => sk.id)
            ]
            : items.map(i => i.id);

        setData(prev => {
            if (!prev) return prev;

            const map = { ...prev.adopted };
            for (const id of touched) {
                map[id] = [...new Set([...(map[id] || []), result.shop_id])];
            }
            return { ...prev, adopted: map };
        });

        clearMarks();
    }, [flash, clearMarks]);

    // ── بعد حفظ الأدمن ──
    const savedForm = useCallback((saved) => {
        const { kind, editing } = form;
        setForm(null);
        flash(editing ? 'تم التعديل' : 'تمت الإضافة');

        setData(prev => {
            if (!prev) return prev;

            const key = kind === 'product' ? 'products' : 'categories';
            const list = prev[key] || [];

            const enrich = (item) => {
                if (kind !== 'product') return { products_count: 0, ...item };
                const cat = (prev.categories || []).find(c => String(c.id) === String(item.category_id));
                return { ...item, category_name: cat ? cat.name : null };
            };

            const next = editing
                ? list.map(item => (item.id === saved.id ? enrich({ ...item, ...saved }) : item))
                : [enrich(saved), ...list];

            return { ...prev, [key]: next };
        });
    }, [form, flash]);

    /*
     * الإخفاء بدل الحذف.
     *
     * منتج موسمي أو نفد: يُخفى فلا يراه أصحاب المحلّات، ويبقى في
     * الكتالوج ليعود بضغطة. والحذف لما لا يعود.
     */
    const toggleProduct = useCallback(async (product) => {
        const next = !product.is_active;
        try {
            const saved = await nexusService.updateProduct(product.id, { is_active: next });
            setData(prev => prev && {
                ...prev,
                products: prev.products.map(p => (
                    p.id === product.id ? { ...p, ...saved } : p
                ))
            });
            flash(next ? 'ظهر في الكتالوج' : 'أُخفي عن أصحاب المحلّات');
        } catch (err) {
            fail(nexusError(err, 'تعذّر التغيير'));
        }
    }, [flash, fail]);

    const removeProduct = useCallback(async (product) => {
        // eslint-disable-next-line no-alert
        if (!window.confirm(`حذف «${product.name}» من الكتالوج؟\nما أضافه أصحاب المحلّات يبقى عندهم.`)) return;

        try {
            await nexusService.removeProduct(product.id);
            setData(prev => prev && {
                ...prev,
                products: prev.products.filter(p => p.id !== product.id)
            });
            flash('حُذف من الكتالوج');
        } catch (err) {
            fail(nexusError(err, 'تعذّر الحذف'));
        }
    }, [flash, fail]);

    const removeCategory = useCallback(async (cat) => {
        // eslint-disable-next-line no-alert
        if (!window.confirm(`حذف تصنيف «${cat.name}»؟\nمنتجاته تبقى وتصير بلا تصنيف.`)) return;

        try {
            await nexusService.removeCategory(cat.id);
            setData(prev => prev && {
                ...prev,
                categories: prev.categories.filter(c => c.id !== cat.id),
                products: prev.products.map(p => (
                    String(p.category_id) === String(cat.id)
                        ? { ...p, category_id: null, category_name: null }
                        : p
                ))
            });
            if (String(active) === String(cat.id)) setActive('all');
            flash('حُذف التصنيف');
        } catch (err) {
            fail(nexusError(err, 'تعذّر الحذف'));
        }
    }, [active, flash, fail]);

    const startAdopt = useCallback((product) => {
        if (!shops.length) {
            flash('لا محلّ على حسابك — نكسس للعرض فقط حتى تُدار محلّاً', 'warn');
            return;
        }
        setAdopting([product]);
    }, [shops.length, flash]);

    /**
     * يفتح الورقة بما حُدّد.
     *
     * الترتيب ترتيب العرض لا ترتيب الضغط: من يرى قائمته في الورقة
     * يتوقّعها كما رآها في الشبكة.
     */
    const startAdoptMarked = useCallback(() => {
        if (!shops.length) {
            flash('لا محلّ على حسابك — نكسس للعرض فقط حتى تُدار محلّاً', 'warn');
            return;
        }

        const chosen = (data?.products || []).filter(p => marks.has(p.id));
        if (!chosen.length) return;

        /* السقف يُقال قبل فتح الورقة لا بعد الضغط على «أضف»: من حدّد
           مئتين يستحقّ أن يعرف قبل أن يختار محلّاً وتصنيفاً */
        if (chosen.length > MAX_PICK) {
            flash(`الحدّ ${MAX_PICK} منتجاً في المرّة — أزل ${chosen.length - MAX_PICK} منها`, 'warn');
            return;
        }

        setAdopting(chosen);
    }, [shops.length, flash, data, marks]);

    return (
        <div className="pnx" dir="rtl">
            {/* ── الترويسة ── */}
            <header className="pnx-top">
                <button className="pnx-x" onClick={onClose} aria-label="إغلاق">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                        <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                </button>

                <div className="pnx-brand">
                    <span className="pnx-mark">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2.6 21 7.3v9.4L12 21.4 3 16.7V7.3z" />
                            <path d="M3 7.3 12 12l9-4.7M12 12v9.4" />
                        </svg>
                    </span>
                    <div>
                        <b>Palnovaa <i>Nexus</i></b>
                        <span>كتالوج بالنوفا — اختر وأضفه لمحلّك</span>
                    </div>
                </div>

                {isAdmin && (
                    <div className="pnx-top-act">
                        <button onClick={() => setForm({ kind: 'category', editing: null })}>+ تصنيف</button>
                        <button className="pnx-primary" onClick={() => setForm({ kind: 'product', editing: null })}>
                            + منتج
                        </button>
                    </div>
                )}
            </header>

            {/* ── البحث والتصنيفات ── */}
            <div className="pnx-rail">
                <div className="pnx-search">
                    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round">
                        <circle cx="11" cy="11" r="7" />
                        <path d="m20 20-3.6-3.6" />
                    </svg>
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="ابحث في الكتالوج"
                        aria-label="ابحث في الكتالوج"
                    />
                    {query && (
                        <button onClick={() => setQuery('')} aria-label="امسح البحث">✕</button>
                    )}
                </div>

                {/* حدّد كلّ ما يُعرض الآن — بعد بحث أو تصنيف يصير مفيداً جداً */}
                {shops.length > 0 && shown.length > 1 && (
                    <button
                        className={`pnx-all${markedHere === shown.length ? ' is-on' : ''}`}
                        onClick={() => setMarks(prev => {
                            const next = new Set(prev);
                            const everyone = markedHere === shown.length;
                            for (const p of shown) {
                                if (everyone) next.delete(p.id);
                                else next.add(p.id);
                            }
                            return next;
                        })}
                    >
                        {markedHere === shown.length
                            ? `أزل تحديد ${shown.length}`
                            : `حدّد الكلّ (${shown.length})`}
                    </button>
                )}

                <div className={`pnx-catwrap${edges.start ? ' has-start' : ''}${edges.end ? ' has-end' : ''}`}>
                <button
                    className="pnx-nudge is-start"
                    onClick={() => nudge(-1)}
                    aria-label="تصنيفات قبل"
                    tabIndex={-1}
                >
                    ‹
                </button>

                <nav className="pnx-cats" aria-label="التصنيفات" ref={rail}>
                    <button
                        className={active === 'all' ? 'is-on' : ''}
                        onClick={() => setActive('all')}
                    >
                        الكل
                        <i>{data?.products?.length || 0}</i>
                    </button>

                    {(data?.categories || []).map(cat => (
                        /* الحذف زرّ مجاور لا زرّ داخل زرّ — والثاني غير صالح
                           ولا يصل إليه التنقّل بلوحة المفاتيح */
                        <span key={cat.id} className="pnx-cat-pair">
                            <button
                                className={String(active) === String(cat.id) ? 'is-on' : ''}
                                onClick={() => setActive(cat.id)}
                            >
                                {cat.name}
                                <i>{cat.products_count ?? 0}</i>
                            </button>

                            {isAdmin && (
                                <button
                                    className="pnx-cat-x"
                                    aria-label={`حذف تصنيف ${cat.name}`}
                                    onClick={() => removeCategory(cat)}
                                >
                                    ✕
                                </button>
                            )}
                        </span>
                    ))}

                    {loose && (
                        <button
                            className={active === UNCATEGORIZED ? 'is-on' : ''}
                            onClick={() => setActive(UNCATEGORIZED)}
                        >
                            بلا تصنيف
                        </button>
                    )}
                </nav>

                <button
                    className="pnx-nudge is-end"
                    onClick={() => nudge(1)}
                    aria-label="تصنيفات بعد"
                    tabIndex={-1}
                >
                    ›
                </button>
                </div>
            </div>

            {/* ── المحتوى ── */}
            <div className="pnx-scroll">
                {/* لمن لا محلّ له: القسم يُعرض ولا يُوهم بأنه معطّل */}
                {!loading && !problem && !shops.length && (
                    <div className="pnx-banner">
                        أنت تستعرض الكتالوج. زرّ «أضفه لمحلّي» يعمل لمن يُدير محلّاً على بالنوفا.
                    </div>
                )}

                {problem && (
                    <div className="pnx-state is-bad">
                        <b>{problem}</b>
                        <button className="pnx-primary" onClick={load}>أعد المحاولة</button>
                    </div>
                )}

                {loading && (
                    <div className="pnx-grid">
                        {Array.from({ length: 8 }, (_, i) => <div key={i} className="pnx-ghost" />)}
                    </div>
                )}

                {!loading && !problem && shown.length === 0 && (
                    <div className="pnx-state">
                        <b>
                            {query.trim()
                                ? 'لا نتيجة لهذا البحث'
                                : isAdmin
                                    ? 'الكتالوج فارغ — ابدأ بتصنيف ثم منتج'
                                    : 'لا منتجات في هذا التصنيف بعد'}
                        </b>
                        {query.trim() && <button onClick={() => setQuery('')}>امسح البحث</button>}
                    </div>
                )}

                {!loading && !problem && shown.length > 0 && (
                    <div className="pnx-grid">
                        {shown.map(product => (
                            <ProductCard
                                key={product.id}
                                product={product}
                                mine={Boolean(data?.adopted?.[product.id]?.length)}
                                canAdopt={shops.length > 0}
                                isAdmin={isAdmin}
                                picked={marks.has(product.id)}
                                onAdopt={startAdopt}
                                onPick={toggleMark}
                                onOpen={setViewing}
                                onEdit={(p) => setForm({ kind: 'product', editing: p })}
                                onRemove={removeProduct}
                                onToggle={toggleProduct}
                            />
                        ))}
                    </div>
                )}
            </div>

            {notice && <div className={`pnx-flash is-${notice.kind}`}>{notice.message}</div>}

            {/*
              * شريط المحدَّد.
              *
              * يظهر بظهور أوّل تحديد ويختفي بزواله، فلا يأخذ مكاناً
              * حين لا شيء محدَّد. وفوق الإشعار في الترتيب كي لا يسترا
              * بعضهما.
              */}
            {marks.size > 0 && (
                <div className="pnx-bar">
                    <button className="pnx-bar-x" onClick={clearMarks} aria-label="ألغِ التحديد">✕</button>

                    <span className="pnx-bar-count">
                        <b>{marks.size}</b> محدَّد
                    </span>

                    <button className="pnx-primary pnx-bar-go" onClick={startAdoptMarked}>
                        أضفها لمحلّي
                    </button>
                </div>
            )}

            {viewing && (
                <NexusProduct
                    product={viewing}
                    mine={Boolean(data?.adopted?.[viewing.id]?.length)}
                    canAdopt={shops.length > 0}
                    priceOf={price}
                    onAdopt={startAdopt}
                    onClose={() => setViewing(null)}
                />
            )}

            {adopting && (
                <AdoptSheet
                    items={adopting}
                    shops={shops}
                    onClose={() => setAdopting(null)}
                    onDone={adopted}
                    onError={fail}
                />
            )}

            {form && (
                <AdminForm
                    kind={form.kind}
                    editing={form.editing}
                    categories={data?.categories || []}
                    onClose={() => setForm(null)}
                    onSaved={savedForm}
                    onError={fail}
                />
            )}
        </div>
    );
};

export default PalnovaaNexus;
