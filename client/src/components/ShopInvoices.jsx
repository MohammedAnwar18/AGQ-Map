import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { shopService, getImageUrl } from '../services/api';
import './ShopInvoices.css';

/* ============================================================
   الفواتير — إصدار وحفظ وتصدير
   • جدول بنود: المنتج (من المحل أو يدوياً) + الكمية + السعر + المجموع
   • المجموع الكلي يُحسب حياً، ويُعاد حسابه على الخادم عند الحفظ
   • سجلّ بالتاريخ والوقت، قابل للفتح والتعديل والحذف
   • تصدير Excel (CSV) و PDF وطباعة بترويسة المحل وشعاره
   ============================================================ */

const DAY_NAMES = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

const money = (value) => {
    const n = parseFloat(value);
    return Number.isNaN(n) ? '0.00' : n.toFixed(2);
};

const stamp = (value) => {
    const date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) return { day: '', date: '', time: '', full: '' };

    const two = (n) => String(n).padStart(2, '0');
    const day = DAY_NAMES[date.getDay()];
    const dateText = `${two(date.getDate())}/${two(date.getMonth() + 1)}/${date.getFullYear()}`;
    const hours = date.getHours();
    const period = hours < 12 ? 'ص' : 'م';
    const hour12 = hours % 12 === 0 ? 12 : hours % 12;
    const time = `${two(hour12)}:${two(date.getMinutes())} ${period}`;

    return { day, date: dateText, time, full: `${day} ${dateText} — ${time}` };
};

const emptyRow = () => ({
    key: `row-${Math.random().toString(36).slice(2, 9)}`,
    product_id: null,
    name: '',
    image_url: null,
    quantity: 1,
    price: ''
});

// ── أيقونات ──────────────────────────────────────────────────
const Icon = {
    Close: (p) => (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" {...p}>
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
    ),
    Plus: (p) => (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" {...p}>
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
    ),
    Trash: (p) => (
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
    ),
    Save: (p) => (
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" />
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
    Excel: (p) => (
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="9" x2="9" y2="21" />
        </svg>
    ),
    Back: (p) => (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
            <polyline points="9 18 15 12 9 6" />
        </svg>
    ),
    Doc: (p) => (
        <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="13" y2="17" />
        </svg>
    )
};

// ============================================================
const ShopInvoices = ({ shop, products = [], onClose }) => {
    const [tab, setTab] = useState('new');           // new | history
    const [invoices, setInvoices] = useState([]);
    const [loadingList, setLoadingList] = useState(true);
    const [saving, setSaving] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [notice, setNotice] = useState(null);

    // الفاتورة قيد التحرير
    const [editingId, setEditingId] = useState(null);
    const [invoiceNumber, setInvoiceNumber] = useState(null);
    const [issuedAt, setIssuedAt] = useState(null);
    const [customer, setCustomer] = useState('');
    const [notes, setNotes] = useState('');
    const [rows, setRows] = useState([emptyRow()]);

    // اقتراح منتجات المحل أثناء الكتابة
    const [suggestFor, setSuggestFor] = useState(null);
    const printRef = useRef(null);

    const logo = shop?.profile_picture ? getImageUrl(shop.profile_picture) : null;
    const shopInitial = (shop?.name || '؟').trim().charAt(0);

    // الشعار مستضاف على نطاق آخر (R2). نحوّله إلى data URL فيصير
    // محلياً: يُطبع ويُرسم داخل html2canvas بلا أي عائق CORS.
    const [logoData, setLogoData] = useState(null);

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
                // لا CORS على المستضيف: نبقى على الصورة المباشرة،
                // فتُطبع طبيعياً ويظهر الحرف الأول خلفها في PDF
                if (!cancelled) setLogoData(null);
            }
        })();

        return () => { cancelled = true; };
    }, [logo]);

    const flash = (message, kind = 'ok') => {
        setNotice({ message, kind });
        setTimeout(() => setNotice(null), 2600);
    };

    // ── السجلّ ─────────────────────────────────────────────────
    const loadInvoices = useCallback(async () => {
        setLoadingList(true);
        try {
            const data = await shopService.getInvoices(shop.id, { limit: 200 });
            setInvoices(data.invoices || []);
        } catch (e) {
            console.error(e);
            flash('تعذّر تحميل السجل', 'err');
        } finally {
            setLoadingList(false);
        }
    }, [shop.id]);

    useEffect(() => {
        loadInvoices();
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, [loadInvoices]);

    // ── حسابات ─────────────────────────────────────────────────
    const lineTotal = (row) => (parseFloat(row.quantity) || 0) * (parseFloat(row.price) || 0);
    const grandTotal = useMemo(() => rows.reduce((sum, row) => sum + lineTotal(row), 0), [rows]);
    const filledRows = rows.filter(row => row.name.trim());

    // ── تحرير البنود ───────────────────────────────────────────
    const setRow = (key, patch) =>
        setRows(prev => prev.map(row => (row.key === key ? { ...row, ...patch } : row)));

    const addRow = () => setRows(prev => [...prev, emptyRow()]);

    const removeRow = (key) =>
        setRows(prev => (prev.length === 1 ? [emptyRow()] : prev.filter(row => row.key !== key)));

    // اقتراحات المنتجات حسب ما كُتب في الحقل
    const suggestionsFor = (row) => {
        const term = row.name.trim().toLowerCase();
        if (!term) return products.slice(0, 8);
        return products
            .filter(p => String(p.name || '').toLowerCase().includes(term))
            .slice(0, 8);
    };

    const pickProduct = (key, product) => {
        setRow(key, {
            product_id: product.id,
            name: product.name,
            image_url: product.images?.[0] || product.image_url || null,
            price: product.price ?? ''
        });
        setSuggestFor(null);
    };

    // ── حفظ ────────────────────────────────────────────────────
    const resetForm = () => {
        setEditingId(null);
        setInvoiceNumber(null);
        setIssuedAt(null);
        setCustomer('');
        setNotes('');
        setRows([emptyRow()]);
    };

    const saveInvoice = async () => {
        if (!filledRows.length) {
            flash('أضف بنداً واحداً على الأقل', 'err');
            return;
        }

        setSaving(true);
        try {
            const payload = {
                customer_name: customer,
                notes,
                items: filledRows.map(row => ({
                    product_id: row.product_id,
                    name: row.name.trim(),
                    image_url: row.image_url,
                    quantity: parseFloat(row.quantity) || 0,
                    price: parseFloat(row.price) || 0
                }))
            };

            const saved = editingId
                ? await shopService.updateInvoice(shop.id, editingId, payload)
                : await shopService.createInvoice(shop.id, payload);

            setEditingId(saved.id);
            setInvoiceNumber(saved.invoice_number);
            setIssuedAt(saved.created_at);
            setInvoices(prev => (
                prev.some(i => i.id === saved.id)
                    ? prev.map(i => (i.id === saved.id ? saved : i))
                    : [saved, ...prev]
            ));
            flash(editingId ? 'حُفظت التعديلات' : `صدرت الفاتورة رقم ${saved.invoice_number}`);
        } catch (e) {
            console.error(e);
            flash(e?.response?.data?.error || 'تعذّر الحفظ، حاول مجدداً', 'err');
        } finally {
            setSaving(false);
        }
    };

    const openInvoice = (invoice) => {
        setEditingId(invoice.id);
        setInvoiceNumber(invoice.invoice_number);
        setIssuedAt(invoice.created_at);
        setCustomer(invoice.customer_name || '');
        setNotes(invoice.notes || '');
        setRows((invoice.items || []).map((item, i) => ({
            key: `row-${invoice.id}-${i}`,
            product_id: item.product_id ?? null,
            name: item.name || '',
            image_url: item.image_url || null,
            quantity: item.quantity ?? 1,
            price: item.price ?? ''
        })));
        setTab('new');
    };

    const deleteInvoice = async (invoice, e) => {
        e?.stopPropagation();
        if (!window.confirm(`حذف الفاتورة رقم ${invoice.invoice_number}؟`)) return;
        try {
            await shopService.deleteInvoice(shop.id, invoice.id);
            setInvoices(prev => prev.filter(i => i.id !== invoice.id));
            if (editingId === invoice.id) resetForm();
            flash('حُذفت الفاتورة');
        } catch (err) {
            console.error(err);
            flash('تعذّر الحذف', 'err');
        }
    };

    // ── التصدير ────────────────────────────────────────────────
    const fileBase = `فاتورة-${invoiceNumber ?? 'جديدة'}-${shop?.name || ''}`.replace(/[\\/:*?"<>|]/g, '-');

    const exportExcel = () => {
        const at = stamp(issuedAt);
        const cell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

        const lines = [
            [cell(shop?.name || ''), '', '', ''],
            [cell('رقم الفاتورة'), cell(invoiceNumber ?? '—'), '', ''],
            [cell('التاريخ'), cell(`${at.day} ${at.date}`), cell('الوقت'), cell(at.time)],
            [cell('العميل'), cell(customer || '—'), '', ''],
            [],
            [cell('المنتج'), cell('الكمية'), cell('السعر'), cell('المجموع')],
            ...filledRows.map(row => [
                cell(row.name),
                cell(row.quantity),
                cell(money(row.price)),
                cell(money(lineTotal(row)))
            ]),
            [],
            ['', '', cell('المجموع الكلي'), cell(money(grandTotal))]
        ];

        // BOM ليقرأ Excel العربية بترميز UTF-8 صحيح
        const csv = '﻿' + lines.map(line => line.join(',')).join('\r\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${fileBase}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const exportPdf = async () => {
        if (!printRef.current) return;
        setExporting(true);
        try {
            const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
                import('html2canvas'),
                import('jspdf')
            ]);

            // ننتظر اكتمال تحميل الشعار وإلا صوّرناه فارغاً
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

            // نُصوّر الورقة المرسومة فتظهر العربية بخطها الصحيح بلا خطوط مضمّنة
            const canvas = await html2canvas(printRef.current, {
                scale: 2,
                backgroundColor: '#ffffff',
                useCORS: true,
                logging: false
            });

            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const imgHeight = (canvas.height * pageWidth) / canvas.width;
            const image = canvas.toDataURL('image/jpeg', 0.95);

            // نقسّم على عدّة صفحات إن طالت الفاتورة
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

            pdf.save(`${fileBase}.pdf`);
        } catch (e) {
            console.error(e);
            flash('تعذّر إنشاء ملف PDF', 'err');
        } finally {
            setExporting(false);
        }
    };

    const printInvoice = () => window.print();

    const at = stamp(issuedAt);
    const canExport = filledRows.length > 0;

    return (
        <div className="siv" dir="rtl">

            {/* ── الشريط العلوي ── */}
            <header className="siv-top">
                <button className="siv-icon" onClick={onClose} aria-label="إغلاق"><Icon.Close /></button>

                <div className="siv-tabs">
                    <button className={tab === 'new' ? 'is-on' : ''} onClick={() => setTab('new')}>
                        {editingId ? `فاتورة رقم ${invoiceNumber}` : 'فاتورة جديدة'}
                    </button>
                    <button className={tab === 'history' ? 'is-on' : ''} onClick={() => setTab('history')}>
                        السجل {invoices.length > 0 && <b>{invoices.length}</b>}
                    </button>
                </div>

                {editingId ? (
                    <button className="siv-icon" onClick={resetForm} title="فاتورة جديدة"><Icon.Plus /></button>
                ) : <span className="siv-icon is-ghost" />}
            </header>

            {notice && <div className={`siv-notice is-${notice.kind}`}>{notice.message}</div>}

            {/* ── محرّر الفاتورة ── */}
            {tab === 'new' && (
                <div className="siv-body">
                    <div className="siv-sheet">

                        <div className="siv-meta">
                            <div className="siv-field">
                                <label>اسم العميل <span>(اختياري)</span></label>
                                <input
                                    value={customer}
                                    onChange={(e) => setCustomer(e.target.value)}
                                    placeholder="اسم العميل أو الجهة"
                                />
                            </div>
                            <div className="siv-field">
                                <label>ملاحظات <span>(اختياري)</span></label>
                                <input
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="ملاحظة تظهر أسفل الفاتورة"
                                />
                            </div>
                        </div>

                        {/* جدول البنود */}
                        <div className="siv-table-wrap">
                            <table className="siv-table">
                                <thead>
                                    <tr>
                                        <th className="siv-col-idx">#</th>
                                        <th>المنتج</th>
                                        <th className="siv-col-num">الكمية</th>
                                        <th className="siv-col-num">السعر</th>
                                        <th className="siv-col-num">المجموع</th>
                                        <th className="siv-col-act" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((row, i) => (
                                        <tr key={row.key}>
                                            <td className="siv-col-idx">{i + 1}</td>

                                            <td className="siv-col-name">
                                                <div className="siv-pick">
                                                    {row.image_url
                                                        ? <img src={getImageUrl(row.image_url)} alt="" />
                                                        : <span className="siv-pick-ph">{(row.name || '؟').trim().charAt(0)}</span>}

                                                    <input
                                                        value={row.name}
                                                        onChange={(e) => setRow(row.key, {
                                                            name: e.target.value, product_id: null, image_url: null
                                                        })}
                                                        onFocus={() => setSuggestFor(row.key)}
                                                        onBlur={() => setTimeout(() => setSuggestFor(c => (c === row.key ? null : c)), 160)}
                                                        placeholder="اكتب الاسم أو اختر من منتجات المحل"
                                                    />

                                                    {suggestFor === row.key && suggestionsFor(row).length > 0 && (
                                                        <div className="siv-suggest">
                                                            {suggestionsFor(row).map(product => (
                                                                <button
                                                                    key={product.id}
                                                                    type="button"
                                                                    onMouseDown={(e) => e.preventDefault()}
                                                                    onClick={() => pickProduct(row.key, product)}
                                                                >
                                                                    {(product.images?.[0] || product.image_url)
                                                                        ? <img src={getImageUrl(product.images?.[0] || product.image_url)} alt="" />
                                                                        : <span className="siv-pick-ph">{product.name.charAt(0)}</span>}
                                                                    <span className="siv-suggest-name">{product.name}</span>
                                                                    {product.price !== null && product.price !== undefined && (
                                                                        <b>{money(product.price)} ₪</b>
                                                                    )}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>

                                            <td className="siv-col-num">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="1"
                                                    value={row.quantity}
                                                    onChange={(e) => setRow(row.key, { quantity: e.target.value })}
                                                />
                                            </td>

                                            <td className="siv-col-num">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={row.price}
                                                    onChange={(e) => setRow(row.key, { price: e.target.value })}
                                                    placeholder="0.00"
                                                />
                                            </td>

                                            <td className="siv-col-num siv-line">{money(lineTotal(row))}</td>

                                            <td className="siv-col-act">
                                                <button
                                                    className="siv-del"
                                                    onClick={() => removeRow(row.key)}
                                                    aria-label="حذف البند"
                                                >
                                                    <Icon.Trash />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <button className="siv-addrow" onClick={addRow}>
                            <Icon.Plus /> إضافة بند
                        </button>

                        <div className="siv-total">
                            <span>المجموع الكلي</span>
                            <b>{money(grandTotal)} ₪</b>
                        </div>
                    </div>

                    {/* أزرار العمل */}
                    <div className="siv-actions">
                        <button className="siv-btn siv-btn-primary" onClick={saveInvoice} disabled={saving || !filledRows.length}>
                            <Icon.Save /> {saving ? 'جاري الحفظ…' : (editingId ? 'حفظ التعديلات' : 'إصدار الفاتورة')}
                        </button>
                        <button className="siv-btn" onClick={printInvoice} disabled={!canExport}>
                            <Icon.Print /> طباعة
                        </button>
                        <button className="siv-btn" onClick={exportPdf} disabled={!canExport || exporting}>
                            <Icon.Pdf /> {exporting ? 'جاري…' : 'PDF'}
                        </button>
                        <button className="siv-btn" onClick={exportExcel} disabled={!canExport}>
                            <Icon.Excel /> Excel
                        </button>
                    </div>
                </div>
            )}

            {/* ── السجل ── */}
            {tab === 'history' && (
                <div className="siv-body">
                    {loadingList ? (
                        <div className="siv-empty"><p>جاري التحميل…</p></div>
                    ) : invoices.length === 0 ? (
                        <div className="siv-empty">
                            <span className="siv-empty-icon"><Icon.Doc /></span>
                            <h3>لا فواتير بعد</h3>
                            <p>أصدر أول فاتورة من تبويب «فاتورة جديدة» وستُحفظ هنا بتاريخها ووقتها.</p>
                        </div>
                    ) : (
                        <div className="siv-list">
                            {invoices.map(invoice => {
                                const when = stamp(invoice.created_at);
                                return (
                                    <button key={invoice.id} className="siv-row" onClick={() => openInvoice(invoice)}>
                                        <span className="siv-row-no">#{invoice.invoice_number}</span>

                                        <span className="siv-row-main">
                                            <b>{invoice.customer_name || 'بلا اسم عميل'}</b>
                                            <span>{when.day} {when.date} — {when.time} • {invoice.items.length} بند</span>
                                        </span>

                                        <span className="siv-row-total">{money(invoice.total)} ₪</span>

                                        <span
                                            className="siv-del"
                                            role="button"
                                            tabIndex={0}
                                            onClick={(e) => deleteInvoice(invoice, e)}
                                            onKeyDown={(e) => e.key === 'Enter' && deleteInvoice(invoice, e)}
                                            aria-label="حذف"
                                        >
                                            <Icon.Trash />
                                        </span>

                                        <Icon.Back className="siv-row-go" />
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ── ورقة الطباعة / PDF ── */}
            <div className="siv-print" ref={printRef}>
                <div className="siv-print-head">
                    {logo && (
                        <span className="siv-print-logo">
                            <i>{shopInitial}</i>
                            {/* بلا crossOrigin: إضافته تمنع تحميل الصورة أصلاً حين
                                لا يرسل المستضيف ترويسة CORS، فتختفي من الطباعة */}
                            <img src={logoData || logo} alt="" />
                        </span>
                    )}
                    <div className="siv-print-shop">
                        <h1>{shop?.name}</h1>
                        {shop?.category && <span>{shop.category}</span>}
                        {shop?.contact_phone && <span dir="ltr">{shop.contact_phone}</span>}
                    </div>
                    <div className="siv-print-meta">
                        <b>فاتورة</b>
                        <span>رقم: {invoiceNumber ?? '—'}</span>
                        <span>{at.day} {at.date}</span>
                        <span>الساعة {at.time}</span>
                    </div>
                </div>

                {customer && (
                    <div className="siv-print-customer"><b>العميل:</b> {customer}</div>
                )}

                <table className="siv-print-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th className="siv-print-name">المنتج</th>
                            <th>الكمية</th>
                            <th>السعر</th>
                            <th>المجموع</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filledRows.map((row, i) => (
                            <tr key={row.key}>
                                <td>{i + 1}</td>
                                <td className="siv-print-name">{row.name}</td>
                                <td>{row.quantity}</td>
                                <td>{money(row.price)}</td>
                                <td>{money(lineTotal(row))}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colSpan={4}>المجموع الكلي</td>
                            <td>{money(grandTotal)} ₪</td>
                        </tr>
                    </tfoot>
                </table>

                {notes && <p className="siv-print-notes">{notes}</p>}

                <div className="siv-print-foot">
                    <span>{shop?.name}</span>
                    <span>{at.full}</span>
                </div>
            </div>
        </div>
    );
};

export default ShopInvoices;
