import React, { useState, useEffect, useRef, useMemo } from 'react';
import { cartService } from '../services/cartService';
import { getImageUrl } from '../services/api';
import './CartModal.css';

/* ============================================================
   سلة المشتريات — عرض وتعديل وطباعة الطلب
   • البند بلا سعر يُعرض «السعر عند الطلب» ولا يدخل المجموع
   • ورقة الطلب تحمل شعار المحل واسمه وبياناته
   ============================================================ */

const DAY_NAMES = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

const priceOf = (value) => {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : null;
};

const money = (value) => {
    const n = priceOf(value);
    return n === null ? null : `${n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)} ₪`;
};

const stamp = () => {
    const now = new Date();
    const two = (n) => String(n).padStart(2, '0');
    const hours = now.getHours();
    const hour12 = hours % 12 === 0 ? 12 : hours % 12;
    return {
        day: DAY_NAMES[now.getDay()],
        date: `${two(now.getDate())}/${two(now.getMonth() + 1)}/${now.getFullYear()}`,
        time: `${two(hour12)}:${two(now.getMinutes())} ${hours < 12 ? 'ص' : 'م'}`
    };
};

// ── أيقونات ──────────────────────────────────────────────────
const Icon = {
    Close: (p) => (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" {...p}>
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
    ),
    Cart: (p) => (
        <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}>
            <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
        </svg>
    ),
    Trash: (p) => (
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
    ),
    Print: (p) => (
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
            <polyline points="6 9 6 2 18 2 18 9" />
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            <rect x="6" y="14" width="12" height="8" />
        </svg>
    ),
    Pdf: (p) => (
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" /><line x1="12" y1="18" x2="12" y2="12" />
            <polyline points="9 15 12 18 15 15" />
        </svg>
    ),
    Image: (p) => (
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
        </svg>
    ),
    Box: (p) => (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}>
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
    )
};

// ============================================================
const CartModal = ({ onClose, shop = null }) => {
    const [cart, setCart] = useState(cartService.getCart());
    const [exporting, setExporting] = useState(null); // 'image' | 'pdf' | null
    const [logoData, setLogoData] = useState(null);
    const printRef = useRef(null);

    useEffect(() => {
        const refresh = () => setCart(cartService.getCart());
        refresh();
        window.addEventListener('cart-updated', refresh);
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('cart-updated', refresh);
            document.body.style.overflow = '';
        };
    }, []);

    const items = cart.items || [];

    // ── المحل صاحب الطلب ───────────────────────────────────────
    // نأخذ الممرَّر، وإلا نستنتجه من بنود السلة
    const orderShop = useMemo(() => {
        if (shop?.name) return shop;
        const named = items.find(item => item.shop_name);
        return named ? { name: named.shop_name, id: named.shop_id } : null;
    }, [shop, items]);

    const logo = orderShop?.profile_picture ? getImageUrl(orderShop.profile_picture) : null;
    const shopInitial = (orderShop?.name || 'ط').trim().charAt(0);

    // الشعار على نطاق آخر: نحوّله إلى data URL ليُطبع ويُرسم بلا عائق CORS
    useEffect(() => {
        if (!logo) { setLogoData(null); return; }
        let cancelled = false;

        (async () => {
            try {
                const response = await fetch(logo, { mode: 'cors', cache: 'force-cache' });
                if (!response.ok) throw new Error('logo fetch failed');
                const blob = await response.blob();
                const dataUrl = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
                if (!cancelled) setLogoData(dataUrl);
            } catch {
                if (!cancelled) setLogoData(null);
            }
        })();

        return () => { cancelled = true; };
    }, [logo]);

    // ── الحساب ─────────────────────────────────────────────────
    const total = useMemo(() => items.reduce((sum, item) => {
        const price = priceOf(item.price);
        return price === null ? sum : sum + price * item.quantity;
    }, 0), [items]);

    const unpricedCount = useMemo(
        () => items.filter(item => priceOf(item.price) === null).length,
        [items]
    );

    const totalUnits = useMemo(
        () => items.reduce((sum, item) => sum + (item.quantity || 0), 0),
        [items]
    );

    const at = stamp();

    // ── التصدير ────────────────────────────────────────────────
    const fileBase = `طلب-${orderShop?.name || 'بالنوفا'}-${at.date.replace(/\//g, '-')}`
        .replace(/[\\/:*?"<>|]/g, '-');

    // نلتقط الورقة مرّة واحدة ونعيد استعمال اللوحة
    const captureSheet = async () => {
        const { default: html2canvas } = await import('html2canvas');

        // ننتظر اكتمال الصور وإلا صوّرناها فارغة
        await Promise.all(
            Array.from(printRef.current.querySelectorAll('img')).map(img => (
                img.complete
                    ? Promise.resolve()
                    : new Promise(resolve => {
                        img.addEventListener('load', resolve, { once: true });
                        img.addEventListener('error', resolve, { once: true });
                        setTimeout(resolve, 3000);
                    })
            ))
        );

        return html2canvas(printRef.current, {
            scale: 2,
            backgroundColor: '#ffffff',
            useCORS: true,
            logging: false
        });
    };

    // يحفظ الملف: على الهاتف عبر ورقة المشاركة (أضمن على iOS)، وإلا تنزيل مباشر
    const deliver = async (blob, filename, mime) => {
        const file = new File([blob], filename, { type: mime });

        if (navigator.canShare?.({ files: [file] })) {
            try {
                await navigator.share({ files: [file], title: filename });
                return;
            } catch (e) {
                if (e?.name === 'AbortError') return;   // ألغى المستخدم
                // غير ذلك: نكمل إلى التنزيل المباشر
            }
        }

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    };

    // الصورة أسرع: لا نحمّل jsPDF ولا نعيد ترميز الصفحة
    const exportImage = async () => {
        if (!printRef.current || exporting) return;
        setExporting('image');
        try {
            const canvas = await captureSheet();
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
            if (!blob) throw new Error('تعذّر تجهيز الصورة');
            await deliver(blob, `${fileBase}.png`, 'image/png');
        } catch (e) {
            console.error('Image export error:', e);
            alert('تعذّر حفظ الصورة، حاول مجدداً.');
        } finally {
            setExporting(null);
        }
    };

    const exportPdf = async () => {
        if (!printRef.current || exporting) return;
        setExporting('pdf');
        try {
            const [canvas, { default: jsPDF }] = await Promise.all([
                captureSheet(),
                import('jspdf')
            ]);

            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const imgHeight = (canvas.height * pageWidth) / canvas.width;
            const image = canvas.toDataURL('image/jpeg', 0.92);

            let remaining = imgHeight;
            let position = 0;
            pdf.addImage(image, 'JPEG', 0, position, pageWidth, imgHeight);
            remaining -= pageHeight;
            while (remaining > 0) {
                position -= pageHeight;
                pdf.addPage();
                pdf.addImage(image, 'JPEG', 0, position, pageWidth, imgHeight);
                remaining -= pageHeight;
            }

            await deliver(pdf.output('blob'), `${fileBase}.pdf`, 'application/pdf');
        } catch (e) {
            console.error('PDF generation error:', e);
            alert('تعذّر إنشاء ملف PDF، حاول مجدداً.');
        } finally {
            setExporting(null);
        }
    };

    return (
        <div className="crt" dir="rtl" onClick={onClose}>
            <div className="crt-panel" onClick={(e) => e.stopPropagation()}>

                {/* ── الترويسة ── */}
                <header className="crt-head">
                    <div className="crt-head-shop">
                        {orderShop && (
                            <span className="crt-head-logo">
                                <i>{shopInitial}</i>
                                {logo && <img src={logoData || logo} alt="" />}
                            </span>
                        )}
                        <div className="crt-head-text">
                            <h2>سلة المشتريات</h2>
                            {orderShop?.name && <span>{orderShop.name}</span>}
                        </div>
                    </div>

                    <button className="crt-icon" onClick={onClose} aria-label="إغلاق"><Icon.Close /></button>
                </header>

                {/* ── البنود ── */}
                <div className="crt-body">
                    {items.length === 0 ? (
                        <div className="crt-empty">
                            <span className="crt-empty-icon"><Icon.Cart /></span>
                            <h3>سلتك فارغة</h3>
                            <p>أضف منتجاً من صفحة المحل ليظهر هنا.</p>
                        </div>
                    ) : (
                        <div className="crt-list">
                            {items.map(item => {
                                const unit = priceOf(item.price);
                                const line = unit === null ? null : unit * item.quantity;

                                return (
                                    <div className="crt-item" key={item.id}>
                                        <div className="crt-thumb">
                                            {item.image_url
                                                ? <img src={getImageUrl(item.image_url)} alt="" loading="lazy" />
                                                : <Icon.Box />}
                                        </div>

                                        <div className="crt-info">
                                            <div className="crt-info-top">
                                                <h4>{item.name}</h4>
                                                <button
                                                    className="crt-del"
                                                    onClick={() => cartService.removeItem(item.id)}
                                                    aria-label="حذف البند"
                                                >
                                                    <Icon.Trash />
                                                </button>
                                            </div>

                                            {item.note && <span className="crt-note">📝 {item.note}</span>}

                                            <div className="crt-info-foot">
                                                {unit === null
                                                    ? <span className="crt-ask">السعر عند الطلب</span>
                                                    : (
                                                        <span className="crt-price">
                                                            {money(line)}
                                                            {item.quantity > 1 && <b>{money(unit)} × {item.quantity}</b>}
                                                        </span>
                                                    )}

                                                <div className="crt-qty">
                                                    <button onClick={() => cartService.updateQuantity(item.id, -1)} aria-label="إنقاص">−</button>
                                                    <span>{item.quantity}</span>
                                                    <button onClick={() => cartService.updateQuantity(item.id, 1)} aria-label="زيادة">+</button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* ── التذييل ── */}
                {items.length > 0 && (
                    <footer className="crt-foot">
                        <div className="crt-total">
                            <span>المجموع{unpricedCount > 0 ? ' (للأصناف المسعّرة)' : ''}</span>
                            <b>{total > 0 ? money(total) : '—'}</b>
                        </div>

                        {unpricedCount > 0 && (
                            <p className="crt-hint">
                                {unpricedCount === 1 ? 'صنف واحد' : `${unpricedCount} أصناف`} بلا سعر معلن —
                                يُحدَّد سعره عند الطلب من المحل.
                            </p>
                        )}

                        <div className="crt-actions">
                            <button
                                className="crt-btn crt-btn-primary"
                                onClick={exportImage}
                                disabled={Boolean(exporting)}
                            >
                                <Icon.Image /> {exporting === 'image' ? 'جاري…' : 'حفظ صورة'}
                            </button>

                            <button className="crt-btn" onClick={() => window.print()}>
                                <Icon.Print /> طباعة
                            </button>

                            <button className="crt-btn" onClick={exportPdf} disabled={Boolean(exporting)}>
                                <Icon.Pdf /> {exporting === 'pdf' ? 'جاري…' : 'PDF'}
                            </button>

                            <button
                                className="crt-btn crt-btn-danger"
                                onClick={() => window.confirm('إفراغ السلة بالكامل؟') && cartService.clear()}
                            >
                                <Icon.Trash /> إفراغ
                            </button>
                        </div>
                    </footer>
                )}
            </div>

            {/* ── ورقة الطلب: مخفية على الشاشة، تظهر عند الطباعة و PDF ── */}
            <div className="crt-print" ref={printRef}>
                <div className="crt-print-head">
                    {orderShop && (
                        <span className="crt-print-logo">
                            <i>{shopInitial}</i>
                            {logo && <img src={logoData || logo} alt="" />}
                        </span>
                    )}

                    <div className="crt-print-shop">
                        <h1>{orderShop?.name || 'بالنوفا'}</h1>
                        {orderShop?.category && <span>{orderShop.category}</span>}
                        {orderShop?.contact_phone && <span dir="ltr">{orderShop.contact_phone}</span>}
                        {orderShop?.contact_email && <span dir="ltr">{orderShop.contact_email}</span>}
                        {orderShop?.address && <span>{orderShop.address}</span>}
                    </div>

                    <div className="crt-print-meta">
                        <b>طلب</b>
                        <span>{at.day} {at.date}</span>
                        <span>الساعة {at.time}</span>
                        <span>{totalUnits} قطعة · {items.length} صنف</span>
                    </div>
                </div>

                <table className="crt-print-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th className="crt-print-name">المنتج</th>
                            <th>الكمية</th>
                            <th>سعر الوحدة</th>
                            <th>المجموع</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item, i) => {
                            const unit = priceOf(item.price);
                            return (
                                <tr key={item.id}>
                                    <td>{i + 1}</td>
                                    <td className="crt-print-name">
                                        {item.name}
                                        {item.note && <em>ملاحظة: {item.note}</em>}
                                    </td>
                                    <td>{item.quantity}</td>
                                    <td>{unit === null ? <span className="crt-print-ask">عند الطلب</span> : money(unit)}</td>
                                    <td>{unit === null ? <span className="crt-print-ask">—</span> : money(unit * item.quantity)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colSpan={4}>المجموع{unpricedCount > 0 ? ' (للأصناف المسعّرة)' : ''}</td>
                            <td>{total > 0 ? money(total) : '—'}</td>
                        </tr>
                    </tfoot>
                </table>

                {unpricedCount > 0 && (
                    <p className="crt-print-notes">
                        الأصناف المعلّمة بـ «عند الطلب» لم يُعلن سعرها، ويُحدَّد عند التأكيد مع المحل.
                    </p>
                )}

                <div className="crt-print-foot">
                    <span>{orderShop?.name || 'بالنوفا'}</span>
                    <span>هذه قائمة طلب وليست فاتورة ضريبية</span>
                </div>
            </div>
        </div>
    );
};

export default CartModal;
