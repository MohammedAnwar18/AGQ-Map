import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';

import arIndoorService, { arError } from '../../services/arIndoorApi';
import IndoorStudio from './IndoorStudio';
import IndoorGuide from './IndoorGuide';
import './IndoorAR.css';
import './IndoorVenues.css';

/* ============================================================
   مشاريع الخرائط الداخلية

   لوحة الأدمن: ينشئ مشروعاً لكل مكان — بيت، محلّ، مولّ، عيادة —
   ثم يفتحه على الهاتف ويبنيه وهو واقف فيه.

   ولكل مشروع رابط ورمز QR: الرابط يُرسل، والرمز يُطبع ويُلصق عند
   المدخل. من يفتح أيّهما تفتح عنده الكاميرا ويمشي.
   ============================================================ */

const Portal = ({ children }) => createPortal(children, document.body);

const shareUrl = (slug) => `${window.location.origin}/nav/${slug}`;

const arabicDate = (iso) => {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleDateString('ar', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
        return '—';
    }
};

const IndoorVenues = ({ onClose }) => {
    const [venues, setVenues] = useState([]);
    const [loading, setLoading] = useState(true);
    const [notice, setNotice] = useState(null);

    const [creating, setCreating] = useState(false);
    const [form, setForm] = useState({ title: '', description: '', eyeHeight: 1.5, fov: 65 });
    const [busy, setBusy] = useState(false);

    const [studio, setStudio] = useState(null);     // المشروع المفتوح للبناء
    const [preview, setPreview] = useState(null);   // { venue, nodes, edges, places }
    const [qr, setQr] = useState(null);             // { venue, dataUrl }

    const flash = useCallback((message, kind = 'ok') => {
        setNotice({ message, kind });
        setTimeout(() => setNotice(null), 3200);
    }, []);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await arIndoorService.list();
            setVenues(data.venues || []);
        } catch (err) {
            flash(arError(err, 'تعذّر جلب المشاريع'), 'err');
        } finally {
            setLoading(false);
        }
    }, [flash]);

    useEffect(() => { load(); }, [load]);

    const create = async () => {
        if (form.title.trim().length < 2) return flash('اكتب اسماً للمشروع', 'err');

        setBusy(true);
        try {
            const data = await arIndoorService.create({
                title: form.title.trim(),
                description: form.description.trim() || null,
                eyeHeight: form.eyeHeight,
                fov: form.fov
            });

            setVenues(prev => [data.venue, ...prev]);
            setCreating(false);
            setForm({ title: '', description: '', eyeHeight: 1.5, fov: 65 });
            flash(`أُنشئ ${data.venue.title} — افتحه من الهاتف وابدأ البناء`);
        } catch (err) {
            flash(arError(err, 'تعذّر الإنشاء'), 'err');
        } finally {
            setBusy(false);
        }
    };

    const togglePublish = async (venue) => {
        try {
            const data = await arIndoorService.update(venue.id, { isPublished: !venue.isPublished });
            setVenues(prev => prev.map(v => (v.id === venue.id ? data.venue : v)));
            flash(data.venue.isPublished ? 'نُشرت الخريطة — الرابط يعمل الآن' : 'أُخفيت الخريطة');
        } catch (err) {
            flash(arError(err, 'تعذّر التغيير'), 'err');
        }
    };

    const remove = async (venue) => {
        if (!window.confirm(`حذف «${venue.title}» بكل نقاطه ومساراته؟`)) return;

        try {
            await arIndoorService.remove(venue.id);
            setVenues(prev => prev.filter(v => v.id !== venue.id));
            flash('حُذف المشروع');
        } catch (err) {
            flash(arError(err, 'تعذّر الحذف'), 'err');
        }
    };

    const copyLink = async (venue) => {
        try {
            await navigator.clipboard.writeText(shareUrl(venue.slug));
            flash('نُسخ الرابط');
        } catch {
            flash(shareUrl(venue.slug), 'err');
        }
    };

    const showQr = async (venue) => {
        try {
            const dataUrl = await QRCode.toDataURL(shareUrl(venue.slug), {
                width: 520, margin: 2,
                color: { dark: '#0B1220', light: '#FFFFFF' }
            });
            setQr({ venue, dataUrl });
        } catch (err) {
            flash(`تعذّر توليد الرمز: ${err.message}`, 'err');
        }
    };

    const openPreview = async (venue) => {
        try {
            const data = await arIndoorService.get(venue.id);
            if (!data.nodes?.length) {
                flash('لا نقاط في هذه الخريطة بعد — ابنِها أوّلاً', 'err');
                return;
            }
            setPreview({ venue: data.venue, nodes: data.nodes, edges: data.edges, places: data.places });
        } catch (err) {
            flash(arError(err, 'تعذّر الفتح'), 'err');
        }
    };

    // ── الاستوديو والمعاينة يملآن الشاشة ──
    if (studio) {
        return (
            <Portal>
                <IndoorStudio
                    venue={studio}
                    onClose={() => { setStudio(null); load(); }}
                    onSaved={load}
                />
            </Portal>
        );
    }

    if (preview) {
        return (
            <Portal>
                <IndoorGuide
                    venue={preview.venue}
                    nodes={preview.nodes}
                    edges={preview.edges}
                    places={preview.places}
                    onClose={() => setPreview(null)}
                />
            </Portal>
        );
    }

    return (
        <div className="iv" dir="rtl">
            <header className="iv-head">
                <div>
                    <b>خريطة الواقع المعزّز الداخلية</b>
                    <span>مسارات تُرسم في المكان وتُمشى بالكاميرا</span>
                </div>

                <div className="iv-head-actions">
                    <button className="iv-btn iv-primary" onClick={() => setCreating(true)}>+ مشروع جديد</button>
                    {onClose && <button className="iv-btn" onClick={onClose}>إغلاق</button>}
                </div>
            </header>

            <p className="iv-lead">
                أنشئ مشروعاً للمكان، ثم <b>افتحه من هاتفك وأنت واقف فيه</b>: وجّه الكاميرا
                إلى ما تريد تحديده واضغط، وارسم بإصبعك الممرّ الذي يصل بينه وبين غيره،
                و<b>امسح المكان</b> وأنت تستدير ليحفظ الهاتف شكله.
                <br />
                ثم أرسل الرابط — من يفتحه <b>تتعرّف الكاميرا على المكان وحدها</b> فتعرف أين
                هو، ويبحث عن وجهته فيُرسم له الطريق على الأرض ويمشي عليه.
            </p>

            {notice && <div className={`iv-flash is-${notice.kind}`}>{notice.message}</div>}

            {loading && <p className="iv-empty">يحمّل…</p>}

            {!loading && !venues.length && (
                <div className="iv-empty-card">
                    <b>لا مشاريع بعد</b>
                    <p>ابدأ بمشروع واحد — بيتك مثلاً — لترى كيف تعمل قبل أن تبني مولّاً.</p>
                    <button className="iv-btn iv-primary" onClick={() => setCreating(true)}>أنشئ الأوّل</button>
                </div>
            )}

            <div className="iv-grid">
                {venues.map(venue => (
                    <article key={venue.id} className={`iv-card${venue.isPublished ? ' is-live' : ''}`}>
                        <header>
                            <b>{venue.title}</b>
                            <span className={`iv-dot${venue.isPublished ? ' is-live' : ''}`}>
                                {venue.isPublished ? 'منشورة' : 'مسوّدة'}
                            </span>
                        </header>

                        {venue.description && <p className="iv-desc">{venue.description}</p>}

                        <div className="iv-stats">
                            <span><b>{venue.nodeCount}</b> مكاناً</span>
                            <span><b>{venue.views}</b> زيارة</span>
                            <span>{arabicDate(venue.updatedAt)}</span>
                        </div>

                        <code className="iv-link" onClick={() => copyLink(venue)} title="انسخ الرابط">
                            /nav/{venue.slug}
                        </code>

                        <div className="iv-actions">
                            <button className="iv-btn iv-primary" onClick={() => setStudio(venue)}>
                                ابنِ بالكاميرا
                            </button>
                            <button className="iv-btn" onClick={() => openPreview(venue)}>جرّب</button>
                            <button className="iv-btn" onClick={() => showQr(venue)}>رمز QR</button>
                            <button className="iv-btn" onClick={() => copyLink(venue)}>الرابط</button>
                            <button className="iv-btn" onClick={() => togglePublish(venue)}>
                                {venue.isPublished ? 'أخفِ' : 'انشر'}
                            </button>
                            <button className="iv-btn iv-danger" onClick={() => remove(venue)}>حذف</button>
                        </div>
                    </article>
                ))}
            </div>

            {/* ── مشروع جديد ── */}
            {creating && (
                <Portal>
                    <div className="iv-modal" role="dialog">
                        <div className="iv-modal-card">
                            <b>مشروع جديد</b>

                            <label htmlFor="iv-title">اسم المكان</label>
                            <input
                                id="iv-title"
                                value={form.title}
                                onChange={(e) => setForm(f => ({ ...f, title: e.target.value.slice(0, 120) }))}
                                placeholder="بيتي · مول فلسطين · عيادة النور"
                                autoFocus
                            />

                            <label htmlFor="iv-desc">وصف قصير (اختياري)</label>
                            <input
                                id="iv-desc"
                                value={form.description}
                                onChange={(e) => setForm(f => ({ ...f, description: e.target.value.slice(0, 400) }))}
                                placeholder="الطابق الأرضي والأوّل"
                            />

                            <label>
                                ارتفاع الهاتف عن الأرض وأنت تمسكه — {form.eyeHeight.toFixed(2)} م
                            </label>
                            <input
                                type="range" min="1" max="1.9" step="0.05"
                                value={form.eyeHeight}
                                onChange={(e) => setForm(f => ({ ...f, eyeHeight: parseFloat(e.target.value) }))}
                            />
                            <p className="iv-hint">
                                هذا الرقم هو ما يحوّل نقطة على الشاشة إلى نقطة على الأرض. خطؤه
                                عشرة سنتيمترات يُزيح النقاط البعيدة نحو نصف متر — فقِسه مرّة وأرِحْ.
                            </p>

                            <label>مجال رؤية الكاميرا — {Math.round(form.fov)}°</label>
                            <input
                                type="range" min="45" max="90" step="1"
                                value={form.fov}
                                onChange={(e) => setForm(f => ({ ...f, fov: parseFloat(e.target.value) }))}
                            />
                            <p className="iv-hint">
                                المتصفّح لا يُفصح عنه، و٦٥° وسط يناسب أغلب الهواتف. إن بدت النقاط
                                تنزاح كلّما أدرتَ الهاتف يميناً ويساراً، فعايِره من هنا.
                            </p>

                            <div className="iv-modal-row">
                                <button className="iv-btn iv-primary" onClick={create} disabled={busy}>
                                    {busy ? 'ينشئ…' : 'أنشئ'}
                                </button>
                                <button className="iv-btn" onClick={() => setCreating(false)}>إلغاء</button>
                            </div>
                        </div>
                    </div>
                </Portal>
            )}

            {/* ── رمز QR ── */}
            {qr && (
                <Portal>
                    <div className="iv-modal" role="dialog" onClick={() => setQr(null)}>
                        <div className="iv-modal-card iv-qr" onClick={(e) => e.stopPropagation()}>
                            <b>{qr.venue.title}</b>
                            <img src={qr.dataUrl} alt={`رمز ${qr.venue.title}`} />
                            <code>{shareUrl(qr.venue.slug)}</code>
                            <p className="iv-hint">
                                اطبعه والصقه عند المدخل: من يمسحه تفتح عنده الكاميرا على خريطتك،
                                ويكون قد أخبرنا أين يقف — فيبدأ المسار من المدخل مباشرةً.
                            </p>

                            <div className="iv-modal-row">
                                <a className="iv-btn iv-primary" href={qr.dataUrl} download={`${qr.venue.slug}.png`}>
                                    نزّل الصورة
                                </a>
                                <button className="iv-btn" onClick={() => setQr(null)}>إغلاق</button>
                            </div>
                        </div>
                    </div>
                </Portal>
            )}
        </div>
    );
};

export default IndoorVenues;
