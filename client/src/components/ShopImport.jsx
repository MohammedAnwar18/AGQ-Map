import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';

import { shopService } from '../services/api';
import { readGeoJson } from '../utils/geojsonShops';
import './ShopImport.css';

/* ============================================================
   استيراد محلّات من GeoJSON

   ثلاث خطوات: ملفّ، ثم مراجعة، ثم نشر.

   والمراجعة ليست زينة: الملفّ يأتي بأسماء ناقصة وتصنيفات مجهولة
   وربّما معالم لا تُراد. فنعرضها كلّها، ويُصحّح الأدمن ما يشاء،
   ويستثني ما لا يريد، ثم يُنشر الباقي دفعةً واحدة.
   ============================================================ */

/* نفس تصنيفات نموذج إضافة محلّ — ولو زيد هناك يُزاد هنا */
const CATEGORIES = [
    'General', 'محطة وقود', 'Restaurant', 'Cafe', 'Supermarket', 'صيدلية',
    'مركز طبي', 'مستشفى', 'عيادة', 'بنك', 'صراف آلي', 'بلدية', 'وزارة',
    'مركز تسوق', 'مجمع تجاري', 'Clothing', 'احذية', 'Electronics', 'Service',
    'حلويات', 'معجنات', 'صالون رجالي', 'صالون نسائي', 'مدرسة', 'University',
    'مكتبة', 'فندق', 'مركز ثقافي', 'نادي رياضي', 'حديقة', 'منتزه',
    'مسجد', 'كنيسة', 'مقبرة', 'ملعب', 'دوار'
];

const deg = (n) => Number(n).toFixed(5);

/* ============================================================
   صفّ معلم
   ============================================================ */

const Row = ({ item, onChange, onDrop, onPick }) => (
    <article className={`imp-row${item.skip ? ' is-off' : ''}`}>
        <label className="imp-shot" title="أضف صورة">
            {item.preview
                ? <img src={item.preview} alt="" />
                : <span>＋</span>}

            <input
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => onPick(item.key, e.target.files?.[0] || null)}
            />
        </label>

        <div className="imp-fields">
            <input
                className="imp-name"
                value={item.name}
                onChange={(e) => onChange(item.key, { name: e.target.value.slice(0, 200) })}
                placeholder="اسم المعلم — مطلوب"
            />

            <div className="imp-line">
                <select
                    value={item.category}
                    onChange={(e) => onChange(item.key, { category: e.target.value })}
                >
                    {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    {!CATEGORIES.includes(item.category) && (
                        <option value={item.category}>{item.category}</option>
                    )}
                </select>

                <span className="imp-at" title={item.kind}>
                    {deg(item.latitude)}, {deg(item.longitude)}
                </span>
            </div>
        </div>

        <button
            className="imp-drop"
            onClick={() => onDrop(item.key)}
            title={item.skip ? 'أعِده إلى القائمة' : 'استثنِه'}
            aria-label={item.skip ? 'أعِده' : 'استثنِه'}
        >
            {item.skip ? '↺' : '✕'}
        </button>
    </article>
);

/* ============================================================ */

const ShopImport = ({ onClose, onDone }) => {
    const [items, setItems] = useState([]);
    const [report, setReport] = useState(null);
    const [problem, setProblem] = useState(null);
    const [notice, setNotice] = useState(null);
    const [busy, setBusy] = useState(false);
    const [sent, setSent] = useState(null);

    const fileInput = useRef(null);
    const shots = useRef(new Map());     // key → File
    const urls = useRef(new Map());      // key → objectURL

    /* روابط المعاينة تُلغى عند الخروج، وإلّا تراكمت في الذاكرة */
    useEffect(() => () => {
        for (const url of urls.current.values()) URL.revokeObjectURL(url);
    }, []);

    const pickFile = async (file) => {
        if (!file) return;

        setProblem(null);
        setReport(null);
        setSent(null);

        if (!/\.(geojson|json)$/i.test(file.name)) {
            setProblem('المطلوب ملفّ ‎.geojson‎ أو ‎.json‎');
            return;
        }

        try {
            const read = readGeoJson(await file.text());

            if (read.error) { setProblem(read.error); return; }

            /*
             * مرجع غير الدرجات يُقال لا يُصلَح هنا.
             *
             * ‎GeoJSON‎ بحسب معياره بالدرجات دائماً، فملفٌّ بغيرها
             * مُصدَّر خطأً. وإعادةُ إسقاطه تخميناً قد تضع المعالم في
             * بلد آخر بلا أن ينتبه أحد — فالأصحّ أن يُصدَّر صحيحاً.
             */
            if (read.crs && !/4326|CRS84/i.test(read.crs)) {
                setProblem(`الملفّ يذكر المرجع ${read.crs} — صدّره بـ EPSG:4326 (درجات) ثم أعد المحاولة`);
                return;
            }

            if (!read.items.length) {
                setProblem('لا معلم صالحاً في الملفّ — كلّها بلا هندسة أو بإحداثيات مسقطة');
                setReport(read);
                return;
            }

            shots.current.clear();
            for (const url of urls.current.values()) URL.revokeObjectURL(url);
            urls.current.clear();

            setItems(read.items.map(item => ({ ...item, skip: false, preview: null })));
            setReport(read);
        } catch (err) {
            setProblem(err?.message || 'تعذّرت قراءة الملفّ');
        }
    };

    const change = useCallback((key, patch) => {
        setItems(prev => prev.map(item => (item.key === key ? { ...item, ...patch } : item)));
    }, []);

    const drop = useCallback((key) => {
        setItems(prev => prev.map(item => (item.key === key ? { ...item, skip: !item.skip } : item)));
    }, []);

    const pickShot = useCallback((key, file) => {
        const was = urls.current.get(key);
        if (was) { URL.revokeObjectURL(was); urls.current.delete(key); }

        if (!file) {
            shots.current.delete(key);
            change(key, { preview: null });
            return;
        }

        const url = URL.createObjectURL(file);
        shots.current.set(key, file);
        urls.current.set(key, url);
        change(key, { preview: url });
    }, [change]);

    /* الجاهز للنشر: ما لم يُستثنَ وله اسم */
    const ready = useMemo(() => items.filter(item => !item.skip && item.name.trim()), [items]);
    const nameless = useMemo(
        () => items.filter(item => !item.skip && !item.name.trim()).length,
        [items]
    );

    const setAllCategory = (category) => {
        setItems(prev => prev.map(item => (item.skip ? item : { ...item, category })));
    };

    const publish = async () => {
        if (!ready.length) return;

        setBusy(true);
        setNotice(null);

        try {
            /*
             * الصور تُرسل بأسماء حقول تحمل ترتيبها في القائمة
             * المُرسلة، لا ترتيبها في الملفّ: الخادم يقرأ ‎img_<i>‎
             * ويطابقه بعنصر ‎items[i]‎، فلا بيانٌ موازٍ يختلّ.
             */
            const payload = ready.map(item => ({
                name: item.name.trim(),
                category: item.category,
                latitude: item.latitude,
                longitude: item.longitude
            }));

            const form = new FormData();
            form.append('items', JSON.stringify(payload));

            ready.forEach((item, at) => {
                const shot = shots.current.get(item.key);
                if (shot) form.append(`img_${at}`, shot, shot.name);
            });

            const result = await shopService.bulkCreate(form);

            setSent(result);
            setNotice({ kind: result.created ? 'ok' : 'warn', message: result.message });

            // ما نُشر يُرفع من القائمة فلا يُنشر مرّتين بضغطة ثانية
            const madeKeys = new Set((result.shops || []).map(made => ready[made.index]?.key));
            setItems(prev => prev.filter(item => !madeKeys.has(item.key)));

            if (result.created) onDone?.(result);
        } catch (err) {
            setNotice({ kind: 'err', message: err?.response?.data?.error || 'تعذّر النشر' });
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="imp" dir="rtl">
            <header className="imp-top">
                <button className="imp-x" onClick={onClose} aria-label="إغلاق">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                        <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                </button>

                <div>
                    <b>استيراد معالم من GeoJSON</b>
                    <span>
                        {items.length
                            ? `${ready.length} جاهز للنشر من ${items.length}`
                            : 'اختر ملفّاً، راجع المعالم، ثم انشرها معاً'}
                    </span>
                </div>

                {items.length > 0 && (
                    <button className="imp-go" onClick={publish} disabled={busy || !ready.length}>
                        {busy ? 'يُنشر…' : `انشر ${ready.length}`}
                    </button>
                )}
            </header>

            <div className="imp-scroll">
                {/* ── الملفّ ── */}
                <label className="imp-drop-zone">
                    <input
                        ref={fileInput}
                        type="file"
                        accept=".geojson,.json,application/geo+json,application/json"
                        hidden
                        onChange={(e) => pickFile(e.target.files?.[0])}
                    />
                    <b>{items.length ? 'اختر ملفّاً آخر' : 'اختر ملفّ GeoJSON'}</b>
                    <span>
                        نقاط أو مضلّعات أو خطوط — كلّها تُحوّل إلى نقطة واحدة لكل معلم،
                        والأسماء والتصنيفات تُقترح من خصائص الملفّ.
                    </span>
                </label>

                {problem && <div className="imp-bad">{problem}</div>}

                {notice && <div className={`imp-flash is-${notice.kind}`}>{notice.message}</div>}

                {/* ── حصيلة القراءة ── */}
                {report && (
                    <div className="imp-report">
                        <span><b>{report.total}</b> معلماً في الملفّ</span>
                        <span><b>{report.items.length}</b> مقروء</span>
                        {report.problems.length > 0 && (
                            <span className="is-warn"><b>{report.problems.length}</b> متجاوَز</span>
                        )}
                        {report.projected > 0 && (
                            <span className="is-warn">{report.projected} بإحداثيات مسقطة</span>
                        )}

                        {report.problems.length > 0 && (
                            <details>
                                <summary>لماذا تُجوِّزت</summary>
                                <ul>
                                    {report.problems.slice(0, 40).map((entry, at) => (
                                        <li key={at}>المعلم رقم {entry.at + 1}: {entry.why}</li>
                                    ))}
                                    {report.problems.length > 40 && <li>…وغيرها</li>}
                                </ul>
                            </details>
                        )}
                    </div>
                )}

                {/* ── نتيجة النشر ── */}
                {sent?.skipped?.length > 0 && (
                    <details className="imp-report">
                        <summary>{sent.skipped.length} لم تُضَف</summary>
                        <ul>
                            {sent.skipped.map((entry, at) => (
                                <li key={at}>{entry.name || `رقم ${entry.index + 1}`}: {entry.why}</li>
                            ))}
                        </ul>
                    </details>
                )}

                {/* ── المراجعة ── */}
                {items.length > 0 && (
                    <>
                        <div className="imp-bulk">
                            <span>التصنيف لكل المعالم:</span>
                            <select defaultValue="" onChange={(e) => {
                                if (e.target.value) setAllCategory(e.target.value);
                                e.target.value = '';
                            }}>
                                <option value="">اختر…</option>
                                {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </select>

                            {nameless > 0 && (
                                <i className="imp-warn">{nameless} بلا اسم — لن تُنشر حتى تُسمّى</i>
                            )}
                        </div>

                        <div className="imp-list">
                            {items.map(item => (
                                <Row
                                    key={item.key}
                                    item={item}
                                    onChange={change}
                                    onDrop={drop}
                                    onPick={pickShot}
                                />
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default ShopImport;
