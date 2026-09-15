import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import { arModelService } from '../services/arModelApi';
import { saveFile } from '../utils/download';
import './AdminARModels.css';

/* ============================================================
   إدارة مجسّمات الواقع المعزّز
   • رفع المجسّم مباشرةً إلى Cloudflare R2 (لا يمرّ بالخادم)
   • نقاط شرح على المجسّم
   • توليد رمز QR مميّز وتنزيله كصورة جاهزة للطباعة في الكتاب
   ============================================================ */

// الصيغ التي يعرضها المتصفح مباشرةً
const WEB_FORMATS = ['.glb', '.gltf'];
const IOS_FORMAT = '.usdz';

const emptyForm = () => ({
    id: null,
    title: '',
    subtitle: '',
    description: '',
    model_url: '',
    ios_url: '',
    poster_url: '',
    hotspots: [],
    is_published: true
});

/**
 * النوافذ تُرسم في <body> مباشرةً.
 * بطاقة لوحة الإدارة تحمل backdrop-filter و overflow:hidden — والأولى
 * تجعلها حاوية لأي position:fixed بداخلها، والثانية تقصّ ما يتجاوزها،
 * فتظهر النافذة ملتصقة بالبطاقة ومقصوصة بدل أن تملأ الشاشة.
 */
const Portal = ({ children }) => createPortal(children, document.body);

const extOf = (name) => {
    const dot = String(name || '').lastIndexOf('.');
    return dot === -1 ? '' : name.slice(dot).toLowerCase();
};

// ============================================================
const AdminARModels = ({ onClose }) => {
    const [models, setModels] = useState([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState(null);
    const [saving, setSaving] = useState(false);
    const [upload, setUpload] = useState(null);      // { kind, percent }
    const [notice, setNotice] = useState(null);
    const [qrFor, setQrFor] = useState(null);

    const modelInput = useRef(null);
    const iosInput = useRef(null);
    const posterInput = useRef(null);

    const flash = (message, kind = 'ok') => {
        setNotice({ message, kind });
        setTimeout(() => setNotice(null), 3000);
    };

    // ── التحميل ────────────────────────────────────────────────
    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await arModelService.list();
            setModels(data.models || []);
        } catch (e) {
            console.error(e);
            flash(e?.response?.data?.error || 'تعذّر تحميل المجسّمات', 'err');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    // ── الرفع ──────────────────────────────────────────────────
    const uploadTo = async (file, kind, field) => {
        if (!file) return;

        if (kind === 'model' && !WEB_FORMATS.includes(extOf(file.name))) {
            flash('صيغة العرض على الويب هي GLB أو GLTF — حوّل ملفك إليها أولاً', 'err');
            return;
        }
        if (kind === 'ios' && extOf(file.name) !== IOS_FORMAT) {
            flash('ملف آيفون يجب أن يكون بصيغة USDZ', 'err');
            return;
        }

        setUpload({ kind, percent: 0 });
        try {
            const url = await arModelService.uploadFile(file, (percent) => setUpload({ kind, percent }));
            setForm(prev => ({ ...prev, [field]: url }));
            flash('اكتمل الرفع');
        } catch (e) {
            console.error(e);
            flash(e?.response?.data?.error || e.message || 'تعذّر رفع الملف', 'err');
        } finally {
            setUpload(null);
        }
    };

    // ── النقاط التوضيحية ───────────────────────────────────────
    const addHotspot = () => setForm(prev => ({
        ...prev,
        hotspots: [...prev.hotspots, {
            id: `spot-${Date.now()}`,
            title: '',
            body: '',
            position: '0m 0m 0m',
            normal: '0m 1m 0m'
        }]
    }));

    const setHotspot = (index, patch) => setForm(prev => ({
        ...prev,
        hotspots: prev.hotspots.map((spot, i) => (i === index ? { ...spot, ...patch } : spot))
    }));

    const removeHotspot = (index) => setForm(prev => ({
        ...prev,
        hotspots: prev.hotspots.filter((_, i) => i !== index)
    }));

    // ── الحفظ ──────────────────────────────────────────────────
    const save = async () => {
        if (!form.title.trim()) return flash('اسم المجسّم مطلوب', 'err');
        if (!form.model_url) return flash('ارفع ملف المجسّم أولاً', 'err');

        setSaving(true);
        try {
            const payload = {
                title: form.title,
                subtitle: form.subtitle,
                description: form.description,
                model_url: form.model_url,
                ios_url: form.ios_url || null,
                poster_url: form.poster_url || null,
                hotspots: form.hotspots,
                is_published: form.is_published
            };

            const saved = form.id
                ? await arModelService.update(form.id, payload)
                : await arModelService.create(payload);

            setModels(prev => (
                prev.some(m => m.id === saved.id)
                    ? prev.map(m => (m.id === saved.id ? saved : m))
                    : [saved, ...prev]
            ));
            setForm(null);
            flash(form.id ? 'حُفظت التعديلات' : `أُضيف المجسّم — رمزه ${saved.slug}`);
        } catch (e) {
            console.error(e);
            flash(e?.response?.data?.error || 'تعذّر الحفظ', 'err');
        } finally {
            setSaving(false);
        }
    };

    const remove = async (model, e) => {
        e?.stopPropagation();
        if (!window.confirm(`حذف «${model.title}»؟ سيتوقّف رمزه عن العمل.`)) return;
        try {
            await arModelService.remove(model.id);
            setModels(prev => prev.filter(m => m.id !== model.id));
            flash('حُذف المجسّم');
        } catch (err) {
            console.error(err);
            flash('تعذّر الحذف', 'err');
        }
    };

    const modelUrl = (model) => `${window.location.origin}/m/${model.slug}`;

    return (
        <div className="arm" dir="rtl">
            <header className="arm-top">
                <div>
                    <h2>مجسّمات الواقع المعزّز</h2>
                    <p>لكل مجسّم رمز QR يفتح صفحته — اطبعه في الكتاب</p>
                </div>

                <div className="arm-top-actions">
                    <button className="arm-btn arm-btn-primary" onClick={() => setForm(emptyForm())}>
                        + مجسّم جديد
                    </button>
                    {onClose && <button className="arm-btn" onClick={onClose}>إغلاق</button>}
                </div>
            </header>

            {notice && <div className={`arm-notice is-${notice.kind}`}>{notice.message}</div>}

            {/* ── القائمة ── */}
            {loading ? (
                <div className="arm-empty"><p>جاري التحميل…</p></div>
            ) : models.length === 0 ? (
                <div className="arm-empty">
                    <span className="arm-empty-icon">🧊</span>
                    <h3>لا مجسّمات بعد</h3>
                    <p>أضف أول مجسّم، وسيولَّد له رمز QR جاهز للطباعة.</p>
                </div>
            ) : (
                <div className="arm-grid">
                    {models.map(model => (
                        <article className="arm-card" key={model.id}>
                            <div className="arm-card-media">
                                {model.poster_url
                                    ? <img src={model.poster_url} alt="" loading="lazy" />
                                    : <span>🧊</span>}
                                {!model.is_published && <em className="arm-hidden">مخفي</em>}
                            </div>

                            <div className="arm-card-body">
                                <h3>{model.title}</h3>
                                {model.subtitle && <span className="arm-sub">{model.subtitle}</span>}

                                <div className="arm-meta">
                                    <code>/m/{model.slug}</code>
                                    <span>{model.views || 0} مشاهدة</span>
                                    {model.hotspots?.length > 0 && <span>{model.hotspots.length} نقطة شرح</span>}
                                </div>

                                <div className="arm-card-actions">
                                    <button className="arm-mini is-gold" onClick={() => setQrFor(model)}>رمز QR</button>
                                    <a className="arm-mini" href={modelUrl(model)} target="_blank" rel="noreferrer">معاينة</a>
                                    <button
                                        className="arm-mini"
                                        onClick={() => setForm({ ...emptyForm(), ...model, hotspots: model.hotspots || [] })}
                                    >
                                        تعديل
                                    </button>
                                    <button className="arm-mini is-danger" onClick={(e) => remove(model, e)}>حذف</button>
                                </div>
                            </div>
                        </article>
                    ))}
                </div>
            )}

            {/* ── نموذج الإضافة / التعديل ── */}
            {form && (
                <Portal>
                <div className="arm-modal-back" onClick={() => !saving && setForm(null)}>
                    <div className="arm-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="arm-modal-head">
                            <h3>{form.id ? 'تعديل المجسّم' : 'مجسّم جديد'}</h3>
                            <button className="arm-x" onClick={() => setForm(null)}>✕</button>
                        </div>

                        <div className="arm-modal-body">
                            <div className="arm-row">
                                <label className="arm-field">
                                    <span>اسم المجسّم</span>
                                    <input
                                        value={form.title}
                                        onChange={(e) => setForm({ ...form, title: e.target.value })}
                                        placeholder="مثال: الخلية النباتية"
                                        autoFocus
                                    />
                                </label>

                                <label className="arm-field">
                                    <span>سطر فرعي <em>(اختياري)</em></span>
                                    <input
                                        value={form.subtitle || ''}
                                        onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                                        placeholder="أحياء — الوحدة الثانية"
                                    />
                                </label>
                            </div>

                            <label className="arm-field">
                                <span>الشرح <em>(اختياري)</em></span>
                                <textarea
                                    value={form.description || ''}
                                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                                    placeholder="شرح يظهر تحت المجسّم في صفحته…"
                                    rows={4}
                                />
                            </label>

                            {/* ── دليل الصيغ ── */}
                            <div className="arm-guide">
                                <b>أي صيغة أرفع؟</b>
                                <p>
                                    <strong>GLB</strong> هي الصيغة الوحيدة التي تعرضها كل الهواتف والمتصفحات —
                                    ملف واحد يحوي الشكل والخامات والصور والحركة معاً. إن كان مجسّمك
                                    FBX أو OBJ أو STL أو Blender، حوّله إلى GLB أولاً
                                    (في Blender: <code dir="ltr">File ← Export ← glTF 2.0 (.glb)</code>).
                                </p>
                                <p>
                                    <strong>USDZ</strong> اختيارية، وتلزم فقط ليضع مستخدم <strong>iPhone</strong>
                                    المجسّم في غرفته. بدونها يعمل العرض ثلاثي الأبعاد على الآيفون كاملاً،
                                    لكن دون «الإسقاط في الغرفة» — وهذا قيد من Apple لا حيلة فيه.
                                </p>
                                <p className="arm-guide-tip">
                                    للسرعة: أبقِ الملف تحت ١٠ ميغابايت، والصور بحجم ٢٠٤٨ بكسل أو أقل،
                                    وفعّل ضغط Draco عند التصدير.
                                </p>
                            </div>

                            {/* ── الملفات ── */}
                            <div className="arm-files">
                                <FileSlot
                                    label="ملف المجسّم"
                                    hint="GLB أو GLTF — هو ما يُعرض على الويب"
                                    value={form.model_url}
                                    required
                                    busy={upload?.kind === 'model' ? upload.percent : null}
                                    inputRef={modelInput}
                                    accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
                                    onPick={(file) => uploadTo(file, 'model', 'model_url')}
                                    onClear={() => setForm({ ...form, model_url: '' })}
                                />

                                <FileSlot
                                    label="ملف آيفون"
                                    hint="USDZ — يلزم لوضع المجسّم في الغرفة على iPhone"
                                    value={form.ios_url}
                                    busy={upload?.kind === 'ios' ? upload.percent : null}
                                    inputRef={iosInput}
                                    accept=".usdz,model/vnd.usdz+zip"
                                    onPick={(file) => uploadTo(file, 'ios', 'ios_url')}
                                    onClear={() => setForm({ ...form, ios_url: '' })}
                                />

                                <FileSlot
                                    label="صورة الغلاف"
                                    hint="تظهر ريثما يُحمّل المجسّم"
                                    value={form.poster_url}
                                    busy={upload?.kind === 'poster' ? upload.percent : null}
                                    inputRef={posterInput}
                                    accept="image/*"
                                    onPick={(file) => uploadTo(file, 'poster', 'poster_url')}
                                    onClear={() => setForm({ ...form, poster_url: '' })}
                                />
                            </div>

                            {/* ── نقاط الشرح ── */}
                            <div className="arm-spots">
                                <div className="arm-spots-head">
                                    <h4>نقاط الشرح على المجسّم</h4>
                                    <button className="arm-mini is-gold" onClick={addHotspot}>+ نقطة</button>
                                </div>

                                <p className="arm-note">
                                    الموضع بصيغة model-viewer: ثلاثة أرقام بالأمتار مثل <code dir="ltr">0.1m 0.2m 0m</code>.
                                    افتح المعاينة وجرّب القيم حتى تستقرّ النقطة في مكانها.
                                </p>

                                {form.hotspots.map((spot, i) => (
                                    <div className="arm-spot" key={spot.id || i}>
                                        <span className="arm-spot-no">{i + 1}</span>

                                        <div className="arm-spot-fields">
                                            <input
                                                value={spot.title}
                                                onChange={(e) => setHotspot(i, { title: e.target.value })}
                                                placeholder="عنوان النقطة — مثال: النواة"
                                            />
                                            <textarea
                                                value={spot.body}
                                                onChange={(e) => setHotspot(i, { body: e.target.value })}
                                                placeholder="شرح مختصر يظهر عند الضغط على النقطة"
                                                rows={2}
                                            />
                                            <input
                                                className="arm-pos"
                                                dir="ltr"
                                                value={spot.position}
                                                onChange={(e) => setHotspot(i, { position: e.target.value })}
                                                placeholder="0m 0m 0m"
                                            />
                                        </div>

                                        <button className="arm-mini is-danger" onClick={() => removeHotspot(i)}>حذف</button>
                                    </div>
                                ))}
                            </div>

                            <label className="arm-check">
                                <input
                                    type="checkbox"
                                    checked={form.is_published}
                                    onChange={(e) => setForm({ ...form, is_published: e.target.checked })}
                                />
                                <span>منشور — الرمز يعمل ويفتح الصفحة</span>
                            </label>
                        </div>

                        <div className="arm-modal-foot">
                            <button className="arm-btn" onClick={() => setForm(null)} disabled={saving}>إلغاء</button>
                            <button
                                className="arm-btn arm-btn-primary"
                                onClick={save}
                                disabled={saving || Boolean(upload)}
                            >
                                {saving ? 'جاري الحفظ…' : (form.id ? 'حفظ التعديلات' : 'إضافة المجسّم')}
                            </button>
                        </div>
                    </div>
                </div>
                </Portal>
            )}

            {/* ── بطاقة رمز QR ── */}
            {qrFor && (
                <Portal>
                    <QrCard model={qrFor} url={modelUrl(qrFor)} onClose={() => setQrFor(null)} onFlash={flash} />
                </Portal>
            )}
        </div>
    );
};

// ── خانة ملف ─────────────────────────────────────────────────
const FileSlot = ({ label, hint, value, required, busy, inputRef, accept, onPick, onClear }) => (
    <div className={`arm-slot ${value ? 'is-set' : ''}`}>
        <div className="arm-slot-text">
            <b>{label} {required && <i>*</i>}</b>
            <span>{hint}</span>
            {value && <code dir="ltr">{value.split('/').pop()}</code>}
        </div>

        <div className="arm-slot-actions">
            {busy !== null && busy !== undefined ? (
                <div className="arm-progress"><span style={{ width: `${busy}%` }} />{busy}%</div>
            ) : (
                <>
                    <button className="arm-mini" onClick={() => inputRef.current?.click()}>
                        {value ? 'تبديل' : 'رفع'}
                    </button>
                    {value && <button className="arm-mini is-danger" onClick={onClear}>إزالة</button>}
                </>
            )}
        </div>

        <input
            ref={inputRef}
            type="file"
            accept={accept}
            hidden
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; onPick(f); }}
        />
    </div>
);

// ── بطاقة الرمز: رسم وتنزيل ──────────────────────────────────
const QrCard = ({ model, url, onClose, onFlash }) => {
    const canvasRef = useRef(null);
    const [busy, setBusy] = useState(false);

    // نرسم بطاقة كاملة: ترويسة، الرمز، الاسم، تعليمات
    const draw = useCallback(async () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const W = 900, H = 1200;
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext('2d');

        // خلفية متدرّجة داكنة
        const bg = ctx.createLinearGradient(0, 0, 0, H);
        bg.addColorStop(0, '#131c33');
        bg.addColorStop(1, '#0b1020');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);

        // إطار ذهبي
        ctx.strokeStyle = 'rgba(251,171,21,0.55)';
        ctx.lineWidth = 6;
        ctx.strokeRect(24, 24, W - 48, H - 48);

        // الرمز على لوحة بيضاء
        const qrSize = 620;
        const qrX = (W - qrSize) / 2;
        const qrY = 250;

        ctx.fillStyle = '#ffffff';
        const pad = 26;
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(qrX - pad, qrY - pad, qrSize + pad * 2, qrSize + pad * 2, 30);
        } else {
            // متصفّحات لا تدعم roundRect: مستطيل عادي يفي بالغرض
            ctx.rect(qrX - pad, qrY - pad, qrSize + pad * 2, qrSize + pad * 2);
        }
        ctx.fill();

        const qrCanvas = document.createElement('canvas');
        await QRCode.toCanvas(qrCanvas, url, {
            width: qrSize,
            margin: 0,
            errorCorrectionLevel: 'H',       // يتحمّل الطباعة والانحناء
            color: { dark: '#0b1020', light: '#ffffff' }
        });
        ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);

        ctx.textAlign = 'center';

        // الترويسة
        ctx.fillStyle = '#fbab15';
        ctx.font = 'bold 40px "IBM Plex Sans Arabic", system-ui, sans-serif';
        ctx.fillText('بالنوفا · واقع معزّز', W / 2, 120);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '26px "IBM Plex Sans Arabic", system-ui, sans-serif';
        ctx.fillText('وجّه كاميرا هاتفك نحو الرمز', W / 2, 172);

        // الاسم
        ctx.fillStyle = '#f1f5f9';
        ctx.font = 'bold 46px "IBM Plex Sans Arabic", system-ui, sans-serif';
        const title = model.title.length > 26 ? `${model.title.slice(0, 26)}…` : model.title;
        ctx.fillText(title, W / 2, qrY + qrSize + 110);

        if (model.subtitle) {
            ctx.fillStyle = '#94a3b8';
            ctx.font = '28px "IBM Plex Sans Arabic", system-ui, sans-serif';
            const sub = model.subtitle.length > 34 ? `${model.subtitle.slice(0, 34)}…` : model.subtitle;
            ctx.fillText(sub, W / 2, qrY + qrSize + 158);
        }

        // الرمز النصّي
        ctx.fillStyle = 'rgba(251,171,21,0.85)';
        ctx.font = 'bold 30px ui-monospace, Menlo, monospace';
        ctx.fillText(`/m/${model.slug}`, W / 2, H - 78);
    }, [model, url]);

    useEffect(() => {
        // ننتظر الخطوط حتى لا تُرسم العربية بخطّ بديل
        (document.fonts?.ready || Promise.resolve()).then(draw);
    }, [draw]);

    const download = async () => {
        setBusy(true);
        try {
            const blob = await new Promise(resolve => canvasRef.current.toBlob(resolve, 'image/png'));
            const safe = model.title.replace(/[\\/:*?"<>|]/g, '-').slice(0, 40);
            await saveFile(blob, `qr-${safe}-${model.slug}.png`, 'image/png');
        } catch (e) {
            console.error(e);
            onFlash('تعذّر تنزيل الصورة', 'err');
        } finally {
            setBusy(false);
        }
    };

    const copyLink = async () => {
        try {
            await navigator.clipboard.writeText(url);
            onFlash('نُسخ الرابط');
        } catch {
            onFlash('تعذّر نسخ الرابط', 'err');
        }
    };

    return (
        <div className="arm-modal-back" onClick={onClose}>
            <div className="arm-modal is-qr" onClick={(e) => e.stopPropagation()}>
                <div className="arm-modal-head">
                    <h3>رمز «{model.title}»</h3>
                    <button className="arm-x" onClick={onClose}>✕</button>
                </div>

                <div className="arm-modal-body arm-qr-body">
                    <canvas ref={canvasRef} className="arm-qr-canvas" />
                    <p className="arm-note">
                        الرمز بمستوى تصحيح خطأ عالٍ، فيُقرأ حتى لو طُبع صغيراً أو انحنى الورق.
                        الصورة بدقّة 900×1200 بكسل جاهزة للطباعة.
                    </p>
                </div>

                <div className="arm-modal-foot">
                    <button className="arm-btn" onClick={copyLink}>نسخ الرابط</button>
                    <button className="arm-btn arm-btn-primary" onClick={download} disabled={busy}>
                        {busy ? 'جاري…' : 'تنزيل الصورة'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AdminARModels;
