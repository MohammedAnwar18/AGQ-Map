import React, { useState, useEffect, useCallback } from 'react';

import { postService, getImageUrl } from '../services/api';
import './PostsGallery.css';

/* ============================================================
   معرض منشوراتي

   المنشور يختفي عن الخريطة بعد أربع وعشرين ساعة، ولا يختفي من
   هنا. وهذا هو الفرق الذي يجعل الاختفاء مقبولاً: الخريطة تعرض
   الحاضر، والمعرض يحفظ ما كان.

   ومن كل صورة زرٌّ إلى موضعها: تُغلق النافذة وتطير الخريطة إلى
   حيث صُوِّرت — ولو كان المنشور منتهياً ولم يعد ظاهراً عليها.
   ============================================================ */

const DAY = 24 * 60 * 60 * 1000;

/** «بعد ٣ ساعات» أو «انتهى» — لا تاريخ كامل يحتاج قراءة */
const remainOf = (post) => {
    if (!post.expires_at) return { label: 'دائم', kind: 'ever' };

    const left = new Date(post.expires_at).getTime() - Date.now();
    if (left <= 0) return { label: 'انتهى من الخريطة', kind: 'gone' };

    const hours = Math.floor(left / 3600000);
    if (hours >= 1) return { label: `يبقى ${hours} ساعة`, kind: 'live' };

    const minutes = Math.max(1, Math.floor(left / 60000));
    return { label: `يبقى ${minutes} دقيقة`, kind: 'soon' };
};

const dateOf = (iso) => {
    try {
        return new Intl.DateTimeFormat('ar', {
            day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit'
        }).format(new Date(iso));
    } catch {
        return '';
    }
};

/* صورة المنشور الأولى — بعضه عدّة وسائط */
const coverOf = (post) => {
    if (post.image_url) return post.image_url;

    let media = post.media_urls;
    if (typeof media === 'string') {
        try { media = JSON.parse(media); } catch { media = null; }
    }
    return Array.isArray(media) ? media.find(Boolean) || null : null;
};

const TAG_STATE = {
    pending: { label: 'بانتظار موافقة المحل', tone: 'wait' },
    approved: { label: 'نُشرت في صفحة المحل', tone: 'done' },
    rejected: { label: 'لم تُقبل المشاركة', tone: 'no' }
};

/* ============================================================
   العارض
   ============================================================ */

const Viewer = ({ post, onClose, onShowOnMap }) => {
    const cover = getImageUrl(coverOf(post));
    const remain = remainOf(post);
    const placed = Number.isFinite(parseFloat(post.latitude)) && Number.isFinite(parseFloat(post.longitude));
    const tag = post.shop_tag;

    return (
        <div className="pg-viewer" role="dialog" aria-label="عرض المنشور">
            <button className="pg-viewer-scrim" onClick={onClose} aria-label="إغلاق" />

            <div className="pg-viewer-card">
                {/*
                  * شريط وسم المحلّ أعلى الصورة.
                  *
                  * هنا موضعه كما في لحظة النشر: من شارك محلّاً يراه
                  * فوق صورته، ومعه هل قُبلت المشاركة أم لا تزال معلّقة.
                  */}
                {tag && (
                    <div className={`pg-tagbar is-${TAG_STATE[tag.status]?.tone || 'wait'}`}>
                        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                            <path d="M3 6h18M16 10a4 4 0 0 1-8 0" />
                        </svg>
                        <b>{tag.shop_name}</b>
                        <span>{TAG_STATE[tag.status]?.label || ''}</span>
                    </div>
                )}

                <div className="pg-viewer-shot">
                    {cover
                        ? <img src={cover} alt={post.content || 'منشور'} />
                        : <p className="pg-viewer-text">{post.content || 'منشور بلا صورة'}</p>}

                    {/* زرّ الخريطة على الصورة — أقرب ما يكون إلى ما يصفه */}
                    {placed && (
                        <button className="pg-map-btn" onClick={() => onShowOnMap(post)}>
                            <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                <circle cx="12" cy="10" r="3" />
                            </svg>
                            أرني على الخريطة
                        </button>
                    )}

                    <button className="pg-viewer-x" onClick={onClose} aria-label="إغلاق">✕</button>
                </div>

                <div className="pg-viewer-foot">
                    {post.content && <p className="pg-viewer-note">{post.content}</p>}

                    <div className="pg-viewer-meta">
                        <span className={`pg-remain is-${remain.kind}`}>{remain.label}</span>
                        <span>{dateOf(post.created_at)}</span>
                        {post.address && <span className="pg-addr">{post.address}</span>}
                    </div>

                    {!placed && (
                        <span className="pg-hint">هذا المنشور بلا موضع، فلا يُعرض على الخريطة.</span>
                    )}
                </div>
            </div>
        </div>
    );
};

/* ============================================================ */

const PostsGallery = ({ onClose, onShowOnMap }) => {
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [problem, setProblem] = useState(null);
    const [open, setOpen] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        setProblem(null);
        try {
            const data = await postService.myPosts(80);
            setPosts(data.posts || []);
        } catch (err) {
            setProblem(err?.response?.data?.error || 'تعذّر تحميل المعرض');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    /* ما زال على الخريطة وما انتهى — العدّان يُقالان بلا حساب يدويّ */
    const live = posts.filter(p => !p.is_expired && p.expires_at).length;

    return (
        <div className="pg" dir="rtl">
            <header className="pg-top">
                <button className="pg-x" onClick={onClose} aria-label="إغلاق">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                        <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                </button>

                <div>
                    <b>معرض منشوراتي</b>
                    <span>
                        {loading ? 'يُحمّل…' : `${posts.length} منشوراً · ${live} منها على الخريطة الآن`}
                    </span>
                </div>
            </header>

            <div className="pg-scroll">
                <p className="pg-explain">
                    المنشور يبقى على الخريطة أربعاً وعشرين ساعة ثم يختفي منها — ويبقى هنا.
                    اضغط صورةً لتعرضها، ومنها زرٌّ يُريك موضعها على الخريطة.
                </p>

                {problem && (
                    <div className="pg-bad">
                        {problem}
                        <button onClick={load}>أعد المحاولة</button>
                    </div>
                )}

                {loading && (
                    <div className="pg-grid">
                        {Array.from({ length: 9 }, (_, i) => <div key={i} className="pg-ghost" />)}
                    </div>
                )}

                {!loading && !problem && !posts.length && (
                    <div className="pg-empty">
                        لا منشورات بعد. اضغط أيقونة الكاميرا نقرةً واحدة لتنشر أوّل واحد.
                    </div>
                )}

                {!loading && posts.length > 0 && (
                    <div className="pg-grid">
                        {posts.map(post => {
                            const cover = getImageUrl(coverOf(post));
                            const remain = remainOf(post);

                            return (
                                <button
                                    key={post.id}
                                    className={`pg-cell${post.is_expired ? ' is-gone' : ''}`}
                                    onClick={() => setOpen(post)}
                                >
                                    {cover
                                        ? <img src={cover} alt="" loading="lazy" decoding="async" />
                                        : <span className="pg-cell-text">{post.content?.slice(0, 40) || 'منشور'}</span>}

                                    {/* المنتهي يُعرَّف بشارة لا بإخفاء: هو موجود وقابل للعرض */}
                                    <i className={`pg-dot is-${remain.kind}`} title={remain.label} />

                                    {post.shop_tag && (
                                        <span className="pg-cell-shop">{post.shop_tag.shop_name}</span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {open && (
                <Viewer
                    post={open}
                    onClose={() => setOpen(null)}
                    onShowOnMap={onShowOnMap}
                />
            )}
        </div>
    );
};

export default PostsGallery;
