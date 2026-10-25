import React, { useState, useEffect, useCallback } from 'react';

import { shopService, getImageUrl } from '../services/api';
import './ShopShares.css';

/* ============================================================
   مشاركات المحل

   منشورات صوّرها الناس ووسموا المحل فيها. والوسم لا يُنشر نفسه:
   يبقى معلّقاً حتى يوافق صاحب المحل.

   وهذا هو الفرق بين قسمٍ يملكه المحل وجدارٍ يُعلّق عليه الغرباء ما
   شاؤوا: لا شيء يظهر هنا إلّا بإذن.
   ============================================================ */

const dateOf = (iso) => {
    try {
        return new Intl.DateTimeFormat('ar', {
            day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit'
        }).format(new Date(iso));
    } catch {
        return '';
    }
};

const coverOf = (share) => {
    if (share.image_url) return share.image_url;

    let media = share.media_urls;
    if (typeof media === 'string') {
        try { media = JSON.parse(media); } catch { media = null; }
    }
    return Array.isArray(media) ? media.find(Boolean) || null : null;
};

/*
 * بطاقة مشاركة.
 *
 * خارج المكوّن لا داخله: المُعرَّف داخل مكوّن يصير نوعاً جديداً في
 * كل رسم، فتُفكّ شجرته وتُركّب من جديد — وتُعاد صوره من الشبكة في
 * كل تغيير حالة.
 */
const ShareCard = ({ share, withActions, busy, onDecide, onZoom }) => {
    const cover = getImageUrl(coverOf(share));

    return (
        <article className="shr-card">
            <div className="shr-who">
                {share.profile_picture
                    ? <img src={getImageUrl(share.profile_picture)} alt="" />
                    : <i>{(share.full_name || share.username || '?').trim().charAt(0)}</i>}

                <div>
                    <b>{share.full_name || share.username}</b>
                    <span>@{share.username} · {dateOf(share.shared_at)}</span>
                </div>
            </div>

            {cover && (
                <button className="shr-shot" onClick={() => onZoom({ ...share, cover })}>
                    <img src={cover} alt={share.content || 'مشاركة'} loading="lazy" decoding="async" />
                </button>
            )}

            {share.content && <p className="shr-note">{share.content}</p>}
            {share.address && <span className="shr-addr">{share.address}</span>}

            {withActions && (
                <div className="shr-act">
                    <button
                        className="shr-yes"
                        onClick={() => onDecide(share, 'approved')}
                        disabled={busy}
                    >
                        {busy ? '…' : 'انشرها في القسم'}
                    </button>
                    <button
                        className="shr-no"
                        onClick={() => onDecide(share, 'rejected')}
                        disabled={busy}
                    >
                        ارفض
                    </button>
                </div>
            )}
        </article>
    );
};


const ShopShares = ({ shopId, canManage }) => {
    const [shares, setShares] = useState([]);
    const [manages, setManages] = useState(false);
    const [loading, setLoading] = useState(true);
    const [problem, setProblem] = useState(null);
    const [busy, setBusy] = useState(null);
    const [notice, setNotice] = useState(null);
    const [zoom, setZoom] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        setProblem(null);
        try {
            const data = await shopService.shares(shopId);
            setShares(data.shares || []);
            setManages(Boolean(data.manages));
        } catch (err) {
            setProblem(err?.response?.data?.error || 'تعذّر تحميل المشاركات');
        } finally {
            setLoading(false);
        }
    }, [shopId]);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        if (!notice) return undefined;
        const t = setTimeout(() => setNotice(null), 3200);
        return () => clearTimeout(t);
    }, [notice]);

    /*
     * القرار.
     *
     * الحالة تتغيّر محلّياً بما أعاده الخادم لا بإعادة تحميل القائمة:
     * من يوافق على عشر مشاركات لا يحتمل أن تُبنى القائمة عشر مرّات
     * وتقفز تحت إصبعه في كل مرّة.
     */
    const decide = useCallback(async (share, status) => {
        setBusy(share.id);
        try {
            const result = await shopService.decideShare(shopId, share.id, status);
            setShares(prev => prev.map(row => (
                row.id === share.id ? { ...row, status: result.status } : row
            )));
            setNotice({ kind: status === 'approved' ? 'ok' : 'warn', message: result.message });
        } catch (err) {
            setNotice({ kind: 'err', message: err?.response?.data?.error || 'تعذّر تنفيذ القرار' });
        } finally {
            setBusy(null);
        }
    }, [shopId]);

    const admin = manages || canManage;
    const pending = shares.filter(s => s.status === 'pending');
    const published = shares.filter(s => s.status === 'approved');
    const refused = shares.filter(s => s.status === 'rejected');

    return (
        <div className="shr" dir="rtl">
            {notice && <div className={`shr-flash is-${notice.kind}`}>{notice.message}</div>}

            {loading && <p className="shr-note-mid">يُحمّل…</p>}

            {problem && (
                <div className="shr-bad">
                    {problem}
                    <button onClick={load}>أعد المحاولة</button>
                </div>
            )}

            {/* ── المعلّق — لصاحب المحل وحده ── */}
            {!loading && admin && pending.length > 0 && (
                <section className="shr-group is-wait">
                    <header>
                        <b>بانتظار قرارك</b>
                        <span>{pending.length} مشاركة — لا تظهر لأحد حتى توافق</span>
                    </header>

                    <div className="shr-list">
                        {pending.map(share => (
                            <ShareCard
                                key={share.id}
                                share={share}
                                withActions
                                busy={busy === share.id}
                                onDecide={decide}
                                onZoom={setZoom}
                            />
                        ))}
                    </div>
                </section>
            )}

            {/* ── المنشور — يراه الجميع ── */}
            {!loading && !problem && (
                published.length > 0 ? (
                    <section className="shr-group">
                        {admin && (
                            <header>
                                <b>منشورة في القسم</b>
                                <span>{published.length} مشاركة يراها زوّار صفحتك</span>
                            </header>
                        )}

                        <div className="shr-list">
                            {published.map(share => (
                            <ShareCard key={share.id} share={share} onZoom={setZoom} />
                        ))}
                        </div>
                    </section>
                ) : (
                    !pending.length && (
                        <p className="shr-empty">
                            {admin
                                ? 'لا مشاركات بعد. حين يصوّر أحدهم عندك ويوسم محلك، تظهر هنا لتقرّر نشرها.'
                                : 'لا مشاركات منشورة في هذا المحل بعد.'}
                        </p>
                    )
                )
            )}

            {/* ── المرفوض — لصاحب المحل، مطوياً ── */}
            {!loading && admin && refused.length > 0 && (
                <details className="shr-refused">
                    <summary>{refused.length} مشاركة مرفوضة</summary>
                    <div className="shr-list">
                        {refused.map(share => (
                            <ShareCard key={share.id} share={share} onZoom={setZoom} />
                        ))}
                    </div>
                </details>
            )}

            {/* ── تكبير الصورة ── */}
            {zoom && (
                <div className="shr-zoom" role="dialog" aria-label="عرض الصورة">
                    <button className="shr-zoom-scrim" onClick={() => setZoom(null)} aria-label="إغلاق" />
                    <div className="shr-zoom-card">
                        <img src={zoom.cover} alt={zoom.content || ''} />
                        <button className="shr-zoom-x" onClick={() => setZoom(null)} aria-label="إغلاق">✕</button>
                        {zoom.content && <p>{zoom.content}</p>}
                        <span>بمشاركة {zoom.full_name || zoom.username}</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ShopShares;
