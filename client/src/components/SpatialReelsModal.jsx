import React, { useState, useEffect, useRef, useCallback } from 'react';
import api, { getImageUrl } from '../services/api';
import './SpatialReelsModal.css';

// ─── Helper: Extract YouTube Video ID ─────────────────────────────────────────
const getYouTubeId = (url) => {
    if (!url) return null;
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([^&\n?#]+)/,
        /^([a-zA-Z0-9_-]{11})$/
    ];
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return null;
};

// ─── Helper: Format numbers ────────────────────────────────────────────────────
const formatCount = (n) => {
    if (!n && n !== 0) return '0';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return String(n);
};

// ─── YouTube Embed Player ─────────────────────────────────────────────────────
const YouTubePlayer = React.memo(({ videoId, isActive, isMuted, onToggleMute }) => {
    const iframeRef = useRef(null);
    const embedUrl = videoId
        ? `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=${isActive ? 1 : 0}&mute=${isMuted ? 1 : 0}&loop=1&playlist=${videoId}&controls=0&rel=0&modestbranding=1&playsinline=1&enablejsapi=1&origin=${window.location.origin}`
        : null;

    // Reload iframe when active state changes
    useEffect(() => {
        if (iframeRef.current && embedUrl) {
            iframeRef.current.src = embedUrl;
        }
    }, [isActive, isMuted]);

    if (!videoId) {
        return (
            <div className="srm-no-video">
                <div className="srm-no-video-icon">🎬</div>
                <p>لا يوجد فيديو</p>
            </div>
        );
    }

    return (
        <div className="srm-player-wrapper" onClick={onToggleMute}>
            <iframe
                ref={iframeRef}
                className="srm-iframe"
                src={embedUrl}
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                title="Reel Video"
                loading="lazy"
            />
            <div className="srm-player-overlay-click" />
            <button className="srm-mute-btn" onClick={(e) => { e.stopPropagation(); onToggleMute(); }}>
                {isMuted ? '🔇' : '🔊'}
            </button>
        </div>
    );
});

// ─── Mini Fake Map ─────────────────────────────────────────────────────────────
const MiniMap = ({ reel, allReels, activeIndex }) => {
    const current = reel || (allReels && allReels[activeIndex]);

    // Generate deterministic "road" positions based on lat/lng
    const pinLeft = current ? `${35 + (current.longitude - 35.2) * 80}%` : '45%';
    const pinTop = current ? `${45 - (current.latitude - 31.9) * 70}%` : '45%';

    return (
        <div className="srm-minimap">
            {/* Grid background */}
            <div className="srm-minimap-grid" />

            {/* SVG Roads */}
            <svg className="srm-minimap-roads">
                <line x1="0" y1="42%" x2="100%" y2="42%" stroke="rgba(0,229,255,0.3)" strokeWidth="2" />
                <line x1="0" y1="68%" x2="100%" y2="68%" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
                <line x1="32%" y1="0" x2="32%" y2="100%" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
                <line x1="68%" y1="0" x2="68%" y2="100%" stroke="rgba(0,229,255,0.3)" strokeWidth="2" />
                <path d="M 10% 10% Q 45% 55% 90% 90%" stroke="rgba(255,255,255,0.1)" strokeWidth="1" fill="none" />
            </svg>

            {/* Other pins (faded) */}
            {allReels?.map((r, i) => i !== activeIndex && (
                <div
                    key={r.id}
                    className="srm-mini-pin"
                    style={{
                        left: `${35 + (r.longitude - 35.2) * 80}%`,
                        top: `${45 - (r.latitude - 31.9) * 70}%`,
                    }}
                />
            ))}

            {/* Active pin */}
            {current && (
                <div
                    className="srm-active-pin"
                    style={{ left: pinLeft, top: pinTop }}
                >
                    <div className="srm-pin-bubble">
                        📍 {current.location_name || current.city || 'موقع'}
                    </div>
                    <div className="srm-pin-dot" />
                </div>
            )}

            {/* Location label */}
            <div className="srm-minimap-label">🎬 Reels Mode</div>
        </div>
    );
};

// ─── Comments Sheet ────────────────────────────────────────────────────────────
const CommentsSheet = ({ reel, onClose, currentUser, onCommentAdded }) => {
    const [comments, setComments] = useState([]);
    const [text, setText] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const inputRef = useRef(null);

    useEffect(() => {
        if (!reel?.id) return;
        setLoading(true);
        api.get(`/reels/${reel.id}/comments`)
            .then(r => setComments(r.data.comments || []))
            .catch(e => console.error('comments fetch error', e))
            .finally(() => setLoading(false));
    }, [reel?.id]);

    useEffect(() => {
        setTimeout(() => inputRef.current?.focus(), 300);
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!text.trim() || submitting) return;
        setSubmitting(true);
        try {
            const res = await api.post(`/reels/${reel.id}/comments`, { content: text.trim() });
            setComments(prev => [...prev, res.data.comment]);
            setText('');
            onCommentAdded?.();
        } catch (err) {
            console.error('comment submit error', err);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (commentId) => {
        try {
            await api.delete(`/reels/comments/${commentId}`);
            setComments(prev => prev.filter(c => c.id !== commentId));
        } catch (err) {
            console.error('delete comment error', err);
        }
    };

    return (
        <div className="srm-comments-sheet">
            <div className="srm-comments-header">
                <span className="srm-comments-title">
                    💬 التعليقات ({comments.length})
                </span>
                <button className="srm-comments-close" onClick={onClose}>✕</button>
            </div>

            <div className="srm-comments-list">
                {loading && (
                    <div className="srm-comments-loading">
                        <div className="srm-spinner" />
                    </div>
                )}
                {!loading && comments.length === 0 && (
                    <div className="srm-comments-empty">
                        <span>💭</span>
                        <p>كن أول من يعلق!</p>
                    </div>
                )}
                {comments.map(c => (
                    <div key={c.id} className="srm-comment-item">
                        <div className="srm-comment-avatar">
                            {c.profile_picture
                                ? <img src={getImageUrl(c.profile_picture)} alt={c.username} />
                                : <span>{(c.full_name || c.username || '?')[0].toUpperCase()}</span>
                            }
                        </div>
                        <div className="srm-comment-body">
                            <span className="srm-comment-name">{c.full_name || c.username}</span>
                            <p className="srm-comment-text">{c.content}</p>
                        </div>
                        {currentUser?.id === c.user_id && (
                            <button
                                className="srm-comment-delete"
                                onClick={() => handleDelete(c.id)}
                                title="حذف"
                            >
                                🗑️
                            </button>
                        )}
                    </div>
                ))}
            </div>

            <form className="srm-comment-form" onSubmit={handleSubmit}>
                <div className="srm-comment-avatar-sm">
                    {currentUser?.profile_picture
                        ? <img src={getImageUrl(currentUser.profile_picture)} alt="me" />
                        : <span>{(currentUser?.full_name || currentUser?.username || '?')[0]?.toUpperCase()}</span>
                    }
                </div>
                <input
                    ref={inputRef}
                    className="srm-comment-input"
                    placeholder="أضف تعليقاً..."
                    value={text}
                    onChange={e => setText(e.target.value)}
                    maxLength={500}
                />
                <button
                    type="submit"
                    className={`srm-comment-send ${text.trim() ? 'active' : ''}`}
                    disabled={!text.trim() || submitting}
                >
                    {submitting ? '...' : '↑'}
                </button>
            </form>
        </div>
    );
};

// ─── Add Reel Form ─────────────────────────────────────────────────────────────
const AddReelForm = ({ onClose, onAdded, userLocation }) => {
    const [form, setForm] = useState({
        title: '',
        description: '',
        youtube_url: '',
        latitude: userLocation?.latitude || 31.9038,
        longitude: userLocation?.longitude || 35.2034,
        location_name: '',
        city: ''
    });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [preview, setPreview] = useState(null);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));

        if (name === 'youtube_url') {
            const id = getYouTubeId(value);
            setPreview(id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!form.title.trim() || !form.youtube_url.trim()) {
            setError('العنوان ورابط يوتيوب مطلوبان');
            return;
        }
        if (!getYouTubeId(form.youtube_url)) {
            setError('رابط يوتيوب غير صالح');
            return;
        }
        setSubmitting(true);
        try {
            const res = await api.post('/reels', form);
            onAdded?.(res.data.reel);
            onClose();
        } catch (err) {
            setError(err.response?.data?.error || 'فشل في النشر');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="srm-add-form-overlay" onClick={onClose}>
            <div className="srm-add-form" onClick={e => e.stopPropagation()}>
                <div className="srm-add-form-header">
                    <h3>🎬 إضافة ريل مكاني</h3>
                    <button onClick={onClose} className="srm-add-close">✕</button>
                </div>

                {preview && (
                    <div className="srm-preview-thumb">
                        <img src={preview} alt="معاينة" />
                        <div className="srm-preview-play">▶</div>
                    </div>
                )}

                {error && <div className="srm-add-error">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="srm-field">
                        <label>🔗 رابط يوتيوب *</label>
                        <input
                            name="youtube_url"
                            value={form.youtube_url}
                            onChange={handleChange}
                            placeholder="https://youtu.be/xxxxx أو معرف الفيديو"
                            className="srm-input"
                            dir="ltr"
                        />
                    </div>
                    <div className="srm-field">
                        <label>📝 العنوان *</label>
                        <input
                            name="title"
                            value={form.title}
                            onChange={handleChange}
                            placeholder="عنوان الريل"
                            className="srm-input"
                            maxLength={100}
                        />
                    </div>
                    <div className="srm-field">
                        <label>💬 الوصف</label>
                        <textarea
                            name="description"
                            value={form.description}
                            onChange={handleChange}
                            placeholder="اكتب وصفاً..."
                            className="srm-input srm-textarea"
                            rows={2}
                        />
                    </div>
                    <div className="srm-field-row">
                        <div className="srm-field">
                            <label>📍 اسم الموقع</label>
                            <input
                                name="location_name"
                                value={form.location_name}
                                onChange={handleChange}
                                placeholder="مثل: وسط البلد"
                                className="srm-input"
                            />
                        </div>
                        <div className="srm-field">
                            <label>🏙️ المدينة</label>
                            <input
                                name="city"
                                value={form.city}
                                onChange={handleChange}
                                placeholder="مثل: رام الله"
                                className="srm-input"
                            />
                        </div>
                    </div>
                    <div className="srm-field-row">
                        <div className="srm-field">
                            <label>Lat</label>
                            <input
                                name="latitude"
                                type="number"
                                step="any"
                                value={form.latitude}
                                onChange={handleChange}
                                className="srm-input"
                                dir="ltr"
                            />
                        </div>
                        <div className="srm-field">
                            <label>Lng</label>
                            <input
                                name="longitude"
                                type="number"
                                step="any"
                                value={form.longitude}
                                onChange={handleChange}
                                className="srm-input"
                                dir="ltr"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="srm-add-submit"
                        disabled={submitting}
                    >
                        {submitting ? '⏳ جاري النشر...' : '🚀 نشر الريل'}
                    </button>
                </form>
            </div>
        </div>
    );
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
const SpatialReelsModal = ({ onClose, currentUser, userLocation }) => {
    const [reels, setReels] = useState([]);
    const [activeIndex, setActiveIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [isMuted, setIsMuted] = useState(true);
    const [showComments, setShowComments] = useState(false);
    const [showAddForm, setShowAddForm] = useState(false);
    const scrollRef = useRef(null);
    const cardRefs = useRef([]);
    const observerRef = useRef(null);

    // Fetch reels
    useEffect(() => {
        setLoading(true);
        api.get('/reels?limit=30')
            .then(res => {
                setReels(res.data.reels || []);
                setLoading(false);
            })
            .catch(err => {
                console.error('fetch reels error', err);
                setLoading(false);
            });
    }, []);

    // IntersectionObserver — update active index on scroll snap
    useEffect(() => {
        if (!reels.length) return;

        observerRef.current?.disconnect();

        observerRef.current = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const idx = parseInt(entry.target.dataset.index);
                        if (!isNaN(idx)) setActiveIndex(idx);
                    }
                });
            },
            { threshold: 0.6, root: scrollRef.current }
        );

        cardRefs.current.forEach(el => el && observerRef.current.observe(el));
        return () => observerRef.current?.disconnect();
    }, [reels]);

    // Handle like toggle
    const handleLike = useCallback(async (reelId) => {
        try {
            const res = await api.post(`/reels/${reelId}/like`);
            setReels(prev => prev.map(r =>
                r.id === reelId
                    ? { ...r, is_liked: res.data.liked, likes_count: res.data.likes_count }
                    : r
            ));
        } catch (err) {
            console.error('like error', err);
        }
    }, []);

    // Scroll to reel by index
    const scrollToReel = (idx) => {
        cardRefs.current[idx]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    // Handle reel added
    const handleReelAdded = (newReel) => {
        setReels(prev => [{ ...newReel, likes_count: 0, comments_count: 0, is_liked: false }, ...prev]);
        setActiveIndex(0);
        setTimeout(() => scrollToReel(0), 100);
    };

    // Update comment count locally
    const handleCommentAdded = () => {
        setReels(prev => prev.map((r, i) =>
            i === activeIndex ? { ...r, comments_count: (r.comments_count || 0) + 1 } : r
        ));
    };

    const activeReel = reels[activeIndex];

    return (
        <div className="srm-overlay">
            {/* ── MAP SECTION (top 36%) ─────────────────────────── */}
            <div className="srm-map-section">
                <MiniMap reel={activeReel} allReels={reels} activeIndex={activeIndex} />

                {/* Close button */}
                <button className="srm-close-btn" onClick={onClose} aria-label="إغلاق">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>

                {/* Add reel button */}
                <button className="srm-add-btn" onClick={() => setShowAddForm(true)} aria-label="إضافة ريل">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                </button>

                {/* Progress dots (vertical) */}
                <div className="srm-progress-dots">
                    {reels.slice(0, 8).map((_, i) => (
                        <button
                            key={i}
                            className={`srm-dot ${i === activeIndex ? 'active' : ''}`}
                            onClick={() => scrollToReel(i)}
                            aria-label={`ريل ${i + 1}`}
                        />
                    ))}
                </div>
            </div>

            {/* ── REELS SCROLL SECTION (bottom 64%) ────────────── */}
            <div className="srm-reels-scroll" ref={scrollRef}>
                {loading && (
                    <div className="srm-loading">
                        <div className="srm-spinner-large" />
                        <p>جاري تحميل الريلز...</p>
                    </div>
                )}

                {!loading && reels.length === 0 && (
                    <div className="srm-empty">
                        <div style={{ fontSize: 64 }}>🎬</div>
                        <h3>لا يوجد ريلز بعد</h3>
                        <p>كن أول من يضيف ريل مكاني!</p>
                        <button className="srm-empty-add" onClick={() => setShowAddForm(true)}>
                            + إضافة ريل
                        </button>
                    </div>
                )}

                {reels.map((reel, index) => {
                    const videoId = getYouTubeId(reel.youtube_url);
                    const isActive = index === activeIndex;

                    return (
                        <div
                            key={reel.id}
                            className={`srm-reel-card ${isActive ? 'active' : ''}`}
                            data-index={index}
                            ref={el => cardRefs.current[index] = el}
                        >
                            {/* Video Player */}
                            <YouTubePlayer
                                videoId={videoId}
                                isActive={isActive}
                                isMuted={isMuted}
                                onToggleMute={() => setIsMuted(p => !p)}
                            />

                            {/* Gradient overlay */}
                            <div className="srm-card-gradient" />

                            {/* Location Tag */}
                            <div className="srm-location-tag">
                                📍 {reel.city ? `${reel.location_name || ''} — ${reel.city}` : (reel.location_name || 'موقع مجهول')}
                            </div>

                            {/* Info */}
                            <div className="srm-reel-info">
                                {/* User avatar */}
                                <div className="srm-reel-user">
                                    <div className="srm-reel-avatar">
                                        {reel.profile_picture
                                            ? <img src={getImageUrl(reel.profile_picture)} alt={reel.username} />
                                            : <span>{(reel.full_name || reel.username || '?')[0]?.toUpperCase()}</span>
                                        }
                                    </div>
                                    <div>
                                        <div className="srm-reel-username">@{reel.username}</div>
                                    </div>
                                </div>

                                <h3 className="srm-reel-title">{reel.title}</h3>
                                {reel.description && (
                                    <p className="srm-reel-desc">{reel.description}</p>
                                )}
                            </div>

                            {/* Side Actions */}
                            <div className="srm-side-actions">
                                {/* Like */}
                                <button
                                    className={`srm-action-btn ${reel.is_liked ? 'liked' : ''}`}
                                    onClick={() => handleLike(reel.id)}
                                    aria-label="إعجاب"
                                >
                                    <div className="srm-action-icon">
                                        {reel.is_liked ? '❤️' : '🤍'}
                                    </div>
                                    <span className="srm-action-count">{formatCount(reel.likes_count)}</span>
                                </button>

                                {/* Comment */}
                                <button
                                    className="srm-action-btn"
                                    onClick={() => { setActiveIndex(index); setShowComments(true); }}
                                    aria-label="تعليقات"
                                >
                                    <div className="srm-action-icon">💬</div>
                                    <span className="srm-action-count">{formatCount(reel.comments_count)}</span>
                                </button>

                                {/* Mute */}
                                <button
                                    className="srm-action-btn"
                                    onClick={() => setIsMuted(p => !p)}
                                    aria-label="كتم/رفع الصوت"
                                >
                                    <div className="srm-action-icon">{isMuted ? '🔇' : '🔊'}</div>
                                </button>
                            </div>

                            {/* Scroll hint on first card */}
                            {index === 0 && reels.length > 1 && (
                                <div className="srm-scroll-hint">
                                    <span>↓</span>
                                    <span>التالي</span>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* ── COMMENTS SHEET ────────────────────────────────── */}
            {showComments && activeReel && (
                <CommentsSheet
                    reel={activeReel}
                    onClose={() => setShowComments(false)}
                    currentUser={currentUser}
                    onCommentAdded={handleCommentAdded}
                />
            )}

            {/* ── ADD REEL FORM ─────────────────────────────────── */}
            {showAddForm && (
                <AddReelForm
                    onClose={() => setShowAddForm(false)}
                    onAdded={handleReelAdded}
                    userLocation={userLocation}
                />
            )}
        </div>
    );
};

export default SpatialReelsModal;
