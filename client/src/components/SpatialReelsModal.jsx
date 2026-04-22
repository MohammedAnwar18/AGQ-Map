import React, { useState, useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import api, { getImageUrl } from '../services/api';
import './SpatialReelsModal.css';

// ─── Google Satellite map style (same as main map) ─────────────────────────
const SATELLITE_STYLE = {
    version: 8,
    name: 'Satellite',
    sprite: 'https://demotiles.maplibre.org/styles/osm-bright-gl-style/sprite',
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: {
        'satellite': {
            type: 'raster',
            tiles: ['https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'],
            tileSize: 256,
            attribution: '© Google'
        }
    },
    layers: [{
        id: 'satellite-layer',
        type: 'raster',
        source: 'satellite',
        minzoom: 0,
        maxzoom: 22
    }]
};

// ─── Helper: Extract YouTube Video ID ─────────────────────────────────────────
const getYouTubeId = (url) => {
    if (!url) return null;
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([^&\n?#]+)/,
        /^([a-zA-Z0-9_-]{11})$/
    ];
    for (const p of patterns) {
        const m = url.match(p);
        if (m) return m[1];
    }
    return null;
};

// ─── Format numbers ─────────────────────────────────────────────────────────
const formatCount = (n) => {
    if (!n && n !== 0) return '0';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return String(n);
};

// ─── Distance badge ─────────────────────────────────────────────────────────
const distanceBadge = (km) => {
    if (!km && km !== 0) return null;
    if (km < 1) return `${Math.round(km * 1000)} م`;
    return `${km.toFixed(1)} كم`;
};

// ═══════════════════════════════════════════════════════════════════════════════
// SATELLITE MINI MAP — Real MapLibre GL with Google tiles
// ═══════════════════════════════════════════════════════════════════════════════
const SatelliteMiniMap = ({ activeReel, allReels, onReelSelect }) => {
    const containerRef = useRef(null);
    const mapRef = useRef(null);
    const markersRef = useRef([]);
    const activeMarkerRef = useRef(null);

    // Init map once
    useEffect(() => {
        if (!containerRef.current) return;

        const map = new maplibregl.Map({
            container: containerRef.current,
            style: SATELLITE_STYLE,
            center: [35.2034, 31.9038], // default center Palestine
            zoom: 10,
            pitch: 0,
            bearing: 0,
            attributionControl: false,
            interactive: false, // Map only moves when user scrolls the reels
        });

        map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');

        mapRef.current = map;

        return () => {
            map.remove();
            mapRef.current = null;
        };
    }, []);

    // Place/update markers when reels change
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !allReels?.length) return;

        const whenReady = () => {
            // Remove old markers
            markersRef.current.forEach(m => m.remove());
            markersRef.current = [];
            if (activeMarkerRef.current) {
                activeMarkerRef.current.remove();
                activeMarkerRef.current = null;
            }

            // Add dot markers for all reels
            allReels.forEach((reel, idx) => {
                const lat = parseFloat(reel.latitude);
                const lng = parseFloat(reel.longitude);
                if (isNaN(lat) || isNaN(lng)) return;

                // Small dot element
                const el = document.createElement('div');
                el.className = 'srm-map-dot';
                el.style.cssText = `
                    width: 8px; height: 8px;
                    border-radius: 50%;
                    background: rgba(255,255,255,0.6);
                    border: 1.5px solid rgba(255,255,255,0.9);
                    cursor: pointer;
                    transition: all 0.2s;
                `;
                el.addEventListener('click', () => onReelSelect?.(idx));
                el.addEventListener('mouseenter', () => {
                    el.style.transform = 'scale(1.5)';
                });
                el.addEventListener('mouseleave', () => {
                    el.style.transform = 'scale(1)';
                });

                const marker = new maplibregl.Marker({ element: el })
                    .setLngLat([lng, lat])
                    .addTo(map);

                markersRef.current.push(marker);
            });
        };

        if (map.isStyleLoaded()) {
            whenReady();
        } else {
            map.once('load', whenReady);
        }
    }, [allReels]);

    // Fly to + update active pin when activeReel changes
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !activeReel) return;

        const lat = parseFloat(activeReel.latitude);
        const lng = parseFloat(activeReel.longitude);
        if (isNaN(lat) || isNaN(lng)) return;

        // Remove old active marker
        if (activeMarkerRef.current) {
            activeMarkerRef.current.remove();
            activeMarkerRef.current = null;
        }

        const flyAndPin = () => {
            // Fly to reel location
            map.flyTo({
                center: [lng, lat],
                zoom: 14,
                speed: 1.2,
                curve: 1,
                essential: true
            });

            // Active glowing pin — نستخدم عنصر HTML بسيط مرتبط بالإحداثيات
            const el = document.createElement('div');
            el.style.cssText = 'pointer-events: none; display: flex; flex-direction: column; align-items: center;';

            const label = document.createElement('div');
            label.style.cssText = `
                background: linear-gradient(135deg, #00e5ff, #7c4dff);
                color: #000;
                font-size: 11px;
                font-weight: 700;
                padding: 5px 11px;
                border-radius: 20px;
                white-space: nowrap;
                max-width: 160px;
                overflow: hidden;
                text-overflow: ellipsis;
                box-shadow: 0 4px 16px rgba(0,229,255,0.5);
                margin-bottom: 4px;
                font-family: 'Tajawal', sans-serif;
            `;
            label.textContent = '📍 ' + (activeReel.location_name || activeReel.city || 'موقع');

            const dot = document.createElement('div');
            dot.style.cssText = `
                width: 12px; height: 12px;
                border-radius: 50%;
                background: #00e5ff;
                box-shadow: 0 0 0 4px rgba(0,229,255,0.3), 0 0 16px rgba(0,229,255,0.6);
            `;

            el.appendChild(label);
            el.appendChild(dot);

            // anchor='bottom' يجعل نقطة التثبيت أسفل العنصر بالضبط على الإحداثيات
            const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
                .setLngLat([lng, lat])
                .addTo(map);

            activeMarkerRef.current = marker;
        };

        if (map.isStyleLoaded()) {
            flyAndPin();
        } else {
            map.once('load', flyAndPin);
        }
    }, [activeReel]);

    return (
        <div ref={containerRef} className="srm-satellite-map">
            {/* Overlay label */}
            <div className="srm-map-mode-label">🛰️ Satellite · Reels</div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// YOUTUBE PLAYER (Double-tap seek & Auto-advance)
// ═══════════════════════════════════════════════════════════════════════════════
const YouTubePlayer = React.memo(({ videoId, isActive, isMuted }) => {
    const playerRef = useRef(null);
    const containerRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [isApiReady, setIsApiReady] = useState(false);
    const lastTapRef = useRef({ time: 0, side: null });

    useEffect(() => {
        if (!window.YT) {
            const tag = document.createElement('script');
            tag.src = "https://www.youtube.com/iframe_api";
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
            window.onYouTubeIframeAPIReady = () => {
                document.dispatchEvent(new Event('youtubeApiReady'));
            };
        }
        const handleReady = () => setIsApiReady(true);
        if (window.YT && window.YT.Player) setIsApiReady(true);
        else document.addEventListener('youtubeApiReady', handleReady);
        return () => document.removeEventListener('youtubeApiReady', handleReady);
    }, []);

    useEffect(() => {
        if (!isApiReady || !videoId || !containerRef.current) return;
        const player = new window.YT.Player(containerRef.current, {
            videoId: videoId,
            playerVars: {
                autoplay: isActive ? 1 : 0,
                mute: isMuted ? 1 : 0,
                controls: 0,
                disablekb: 1,
                fs: 0,
                modestbranding: 1,
                rel: 0,
                playsinline: 1,
                enablejsapi: 1,
                // Enable loop for a continuous reel experience
                loop: 1,
                playlist: videoId
            },
            events: {
                onReady: (event) => {
                    playerRef.current = event.target;
                    if (isActive) event.target.playVideo();
                },
                onStateChange: (event) => {
                    setIsPlaying(event.data === 1);
                    // If video ends and loop didn't catch it, restart manually
                    if (event.data === 0 && playerRef.current) {
                        playerRef.current.seekTo(0, true);
                        playerRef.current.playVideo();
                    }
                }
            }
        });
        return () => {
            if (playerRef.current?.destroy) playerRef.current.destroy();
            playerRef.current = null;
        };
    }, [isApiReady, videoId]);

    useEffect(() => {
        if (!playerRef.current) return;
        if (isActive) playerRef.current.playVideo();
        else playerRef.current.pauseVideo();
    }, [isActive]);

    useEffect(() => {
        if (!playerRef.current) return;
        if (isMuted) playerRef.current.mute();
        else playerRef.current.unMute();
    }, [isMuted]);

    useEffect(() => {
        let interval;
        if (isPlaying && playerRef.current) {
            interval = setInterval(() => {
                const duration = playerRef.current.getDuration();
                const current = playerRef.current.getCurrentTime();
                if (duration > 0) setProgress((current / duration) * 100);
            }, 500);
        }
        return () => clearInterval(interval);
    }, [isPlaying]);

    const handleInteraction = (side) => {
        const now = Date.now();
        const DOUBLE_TAP_DELAY = 300;

        if (side === lastTapRef.current.side && (now - lastTapRef.current.time) < DOUBLE_TAP_DELAY) {
            // Double tap detected
            if (!playerRef.current) return;
            const currentTime = playerRef.current.getCurrentTime();
            if (side === 'left') {
                playerRef.current.seekTo(Math.max(0, currentTime - 10), true);
            } else {
                playerRef.current.seekTo(currentTime + 10, true);
            }
            lastTapRef.current = { time: 0, side: null }; // reset
        } else {
            // Single tap logic
            lastTapRef.current = { time: now, side };
            // Optional: Toggle play on single tap in center
            if (side === 'center') {
                if (isPlaying) playerRef.current?.pauseVideo();
                else playerRef.current?.playVideo();
            }
        }
    };

    const handleSeek = (e) => {
        if (!playerRef.current) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        if (clientX === undefined) return;
        const x = clientX - rect.left;
        const pct = Math.max(0, Math.min(1, x / rect.width));
        const duration = playerRef.current.getDuration();
        if (duration > 0) {
            playerRef.current.seekTo(duration * pct, true);
            setProgress(pct * 100);
        }
    };

    if (!videoId) return (
        <div className="srm-no-video"><span>🎬</span><p>لا يوجد فيديو</p></div>
    );

    return (
        <div className="srm-player-wrapper">
            <div className="srm-player-container">
                <div ref={containerRef} className="srm-yt-target" />
            </div>

            {/* Interaction Areas */}
            <div className="srm-video-overlay-system">
                <div className="srm-tap-zone left" onClick={() => handleInteraction('left')}>
                    <div className="srm-tap-hint"><span>-10s</span></div>
                </div>
                <div className="srm-tap-zone center" onClick={() => handleInteraction('center')}>
                    {!isPlaying && isActive && (
                        <div className="srm-play-icon-overlay">
                            <svg viewBox="0 0 24 24" width="44" height="44" fill="white"><path d="M8 5v14l11-7z" /></svg>
                        </div>
                    )}
                </div>
                <div className="srm-tap-zone right" onClick={() => handleInteraction('right')}>
                    <div className="srm-tap-hint"><span>+10s</span></div>
                </div>
            </div>

            <div className="srm-progress-container" onClick={handleSeek} onTouchStart={handleSeek}>
                <div className="srm-progress-bar" style={{ width: `${progress}%` }} />
            </div>
        </div>
    );
});


// ═══════════════════════════════════════════════════════════════════════════════
// ADD REEL FORM
// ═══════════════════════════════════════════════════════════════════════════════
const AddReelForm = ({ onClose, onAdded, userLocation, initialData = null }) => {
    const [form, setForm] = useState(initialData ? {
        title: initialData.title || '',
        description: initialData.description || '',
        youtube_url: initialData.youtube_url || '',
        latitude: initialData.latitude || userLocation?.latitude || 31.9038,
        longitude: initialData.longitude || userLocation?.longitude || 35.2034,
        location_name: initialData.location_name || '',
        city: initialData.city || ''
    } : {
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

    useEffect(() => {
        if (form.youtube_url) {
            const id = getYouTubeId(form.youtube_url);
            setPreview(id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null);
        }
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(p => ({ ...p, [name]: value }));
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
            if (initialData) {
                const res = await api.put(`/reels/${initialData.id}`, form);
                onAdded?.(res.data.reel || { ...form, id: initialData.id }, true);
            } else {
                const res = await api.post('/reels', form);
                onAdded?.(res.data.reel);
            }
            onClose();
        } catch (err) {
            setError(err.response?.data?.error || 'فشل في الحفظ');
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
                        <input name="youtube_url" value={form.youtube_url} onChange={handleChange}
                            placeholder="https://youtu.be/xxxxx" className="srm-input" dir="ltr" />
                    </div>
                    <div className="srm-field">
                        <label>📝 العنوان *</label>
                        <input name="title" value={form.title} onChange={handleChange}
                            placeholder="عنوان الريل" className="srm-input" maxLength={100} />
                    </div>
                    <div className="srm-field">
                        <label>💬 الوصف</label>
                        <textarea name="description" value={form.description} onChange={handleChange}
                            placeholder="اكتب وصفاً..." className="srm-input srm-textarea" rows={2} />
                    </div>
                    <div className="srm-field-row">
                        <div className="srm-field">
                            <label>📍 اسم الموقع</label>
                            <input name="location_name" value={form.location_name} onChange={handleChange}
                                placeholder="وسط البلد" className="srm-input" />
                        </div>
                        <div className="srm-field">
                            <label>🏙️ المدينة</label>
                            <input name="city" value={form.city} onChange={handleChange}
                                placeholder="رام الله" className="srm-input" />
                        </div>
                    </div>
                    <div className="srm-field-row">
                        <div className="srm-field">
                            <label>Lat</label>
                            <input name="latitude" type="number" step="any" value={form.latitude}
                                onChange={handleChange} className="srm-input" dir="ltr" />
                        </div>
                        <div className="srm-field">
                            <label>Lng</label>
                            <input name="longitude" type="number" step="any" value={form.longitude}
                                onChange={handleChange} className="srm-input" dir="ltr" />
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                        <button
                            type="button"
                            className="srm-locate-btn"
                            onClick={() => {
                                if (userLocation) {
                                    setForm(p => ({
                                        ...p,
                                        latitude: userLocation.latitude,
                                        longitude: userLocation.longitude
                                    }));
                                } else {
                                    navigator.geolocation?.getCurrentPosition(pos => {
                                        setForm(p => ({
                                            ...p,
                                            latitude: pos.coords.latitude,
                                            longitude: pos.coords.longitude
                                        }));
                                    });
                                }
                            }}
                        >
                            📡 استخدم موقعي الحالي
                        </button>
                    </div>
                    <button type="submit" className="srm-add-submit" disabled={submitting}>
                        {submitting ? '⏳ جاري النشر...' : '🚀 نشر الريل'}
                    </button>
                </form>
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
const SpatialReelsModal = ({ onClose, currentUser, userLocation }) => {
    const [reels, setReels] = useState([]);
    const [activeIndex, setActiveIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [locationBased, setLocationBased] = useState(false);
    const [isMuted, setIsMuted] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingReel, setEditingReel] = useState(null);
    
    // هل المستخدم الحالي أدمن؟
    const isAdmin = currentUser?.role === 'admin';
    const scrollRef = useRef(null);
    const cardRefs = useRef([]);
    const observerRef = useRef(null);

    // ── Fetch reels (location-aware) ──────────────────────────────────────────
    const fetchReels = useCallback(async (lat, lng, force = false) => {
        // Only show loading spinner if we have no reels or explicitly forced
        if (force || reels.length === 0) setLoading(true);
        try {
            let url = '/reels?limit=30';
            if (lat && lng) {
                url += `&lat=${lat}&lng=${lng}&radius=200`; // 200km radius = all Palestine
            }
            const res = await api.get(url);
            setReels(res.data.reels || []);
            setLocationBased(!!res.data.location_based);
        } catch (err) {
            console.error('fetch reels error', err);
        } finally {
            setLoading(false);
        }
    }, [reels.length]);

    const hasFetched = useRef(false);

    useEffect(() => {
        // Only fetch once when location becomes available or if it's already there
        if (hasFetched.current) return;
        
        const lat = userLocation?.latitude;
        const lng = userLocation?.longitude;
        
        // If we have location or if we want to fetch default reels (no location)
        // We'll fetch once we have a location OR if we've waited enough.
        // Actually, let's just fetch once on mount/initial location.
        fetchReels(lat, lng);
        hasFetched.current = true;
    }, [userLocation, fetchReels]);

    // ── IntersectionObserver for scroll-snap ──────────────────────────────────
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
            { threshold: 0.8, root: scrollRef.current }
        );

        cardRefs.current.forEach(el => el && observerRef.current.observe(el));
        return () => observerRef.current?.disconnect();
    }, [reels]);

    // ── Like toggle ───────────────────────────────────────────────────────────
    const handleLike = useCallback(async (reelId) => {
        if (!currentUser) return;
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
    }, [currentUser]);

    const scrollToReel = (idx) => {
        cardRefs.current[idx]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const handleReelAdded = (newReel, isUpdate = false) => {
        if (isUpdate) {
            setReels(prev => prev.map(r => r.id === newReel.id ? { ...r, ...newReel } : r));
            setEditingReel(null);
        } else {
            const withMeta = { ...newReel, likes_count: 0, comments_count: 0, is_liked: false };
            setReels(prev => [withMeta, ...prev]);
            setActiveIndex(0);
            setTimeout(() => scrollToReel(0), 100);
        }
    };

    const handleDeleteReel = async (id) => {
        if (!window.confirm('هل أنت متأكد من حذف هذا الفيديو؟')) return;
        try {
            await api.delete(`/reels/${id}`);
            setReels(prev => prev.filter(r => r.id !== id));
        } catch (err) {
            alert('فشل الحذف');
        }
    };



    const activeReel = reels[activeIndex];

    return (
        <div className="srm-overlay" dir="rtl">

            {/* ── SATELLITE MAP (top 38%) ──────────────────────────────────── */}
            <div className="srm-map-section">
                <SatelliteMiniMap
                    activeReel={activeReel}
                    allReels={reels}
                    onReelSelect={(idx) => {
                        setActiveIndex(idx);
                        scrollToReel(idx);
                    }}
                />

                {/* Close */}
                <button className="srm-close-btn" onClick={onClose} aria-label="إغلاق">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>

                {/* Add reel — للأدمن فقط */}
                {isAdmin && (
                    <button className="srm-add-btn" onClick={() => setShowAddForm(true)} title="إضافة ريل (أدمن)">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                    </button>
                )}

                {/* Location badge */}
                {locationBased && activeReel?.distance_km != null && (
                    <div className="srm-dist-badge">
                        📡 {distanceBadge(activeReel.distance_km)}
                    </div>
                )}

                {/* Progress dots */}
                <div className="srm-progress-dots">
                    {reels.slice(0, 10).map((_, i) => (
                        <button
                            key={i}
                            className={`srm-dot ${i === activeIndex ? 'active' : ''}`}
                            onClick={() => scrollToReel(i)}
                        />
                    ))}
                </div>
            </div>

            {/* ── REELS SCROLL (bottom 62%) ──────────────────────────────────── */}
            <div className="srm-reels-scroll" ref={scrollRef}>

                {loading && (
                    <div className="srm-loading">
                        <div className="srm-spinner-large" />
                        <p>جاري تحميل الريلز...</p>
                    </div>
                )}

                {!loading && reels.length === 0 && (
                    <div className="srm-empty">
                        <div style={{ fontSize: 60 }}>🎬</div>
                        <h3>لا يوجد ريلز {locationBased ? 'بالقرب منك' : 'بعد'}</h3>
                        <p>{locationBased ? 'جرّب توسيع نطاق البحث' : 'قريباً سيتم إضافة ريلز!'}</p>
                        {isAdmin && (
                            <button className="srm-empty-add" onClick={() => setShowAddForm(true)}>
                                + إضافة ريل
                            </button>
                        )}
                    </div>
                )}

                {reels.map((reel, index) => {
                    const videoId = getYouTubeId(reel.youtube_url);
                    const isActive = index === activeIndex;

                    return (
                        <div
                            key={reel.id}
                            className="srm-reel-card"
                            data-index={index}
                            ref={el => cardRefs.current[index] = el}
                        >
                            {/* YouTube Player */}
                            <YouTubePlayer 
                                videoId={videoId} 
                                isActive={isActive} 
                                isMuted={isMuted} 

                            />

                            {/* Gradient */}
                            <div className="srm-card-gradient" />

                            {/* Location tag */}
                            <div className="srm-location-tag">
                                📍 {reel.city
                                    ? `${reel.location_name ? reel.location_name + ' — ' : ''}${reel.city}`
                                    : reel.location_name || 'موقع مجهول'
                                }
                                {reel.distance_km != null && (
                                    <span className="srm-tag-dist"> · {distanceBadge(reel.distance_km)}</span>
                                )}
                            </div>

                            {/* Admin Controls (Edit/Delete) */}
                            {isAdmin && (
                                <div className="srm-admin-actions">
                                    <button className="srm-admin-btn edit" onClick={() => { setEditingReel(reel); setShowAddForm(true); }}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                                    </button>
                                    <button className="srm-admin-btn delete" onClick={() => handleDeleteReel(reel.id)}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                                    </button>
                                </div>
                            )}

                            {/* Mute button */}
                            <button
                                className="srm-mute-floating"
                                onClick={() => setIsMuted(p => !p)}
                                aria-label={isMuted ? 'رفع الصوت' : 'كتم'}
                            >
                                {isMuted ? '🔇' : '🔊'}
                            </button>

                            {/* Info — الناشر يظهر دائمًا باسم palnovaa */}
                            <div className="srm-reel-info">
                                <div className="srm-reel-user">
                                    <div className="srm-reel-avatar" style={{ background: 'linear-gradient(135deg, #00e5ff22, #7c4dff22)', border: '2px solid #fbab15' }}>
                                        <img
                                            src="/logo_orange.svg"
                                            alt="palnovaa"
                                            style={{ width: '70%', height: '70%', objectFit: 'contain' }}
                                            onError={e => { e.target.style.display = 'none'; e.target.parentNode.innerHTML = '<span style="color:#fbab15;font-weight:900;font-size:13px">P</span>'; }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                        <div className="srm-reel-username" style={{ color: '#fbab15', fontWeight: '800' }}>palnovaa</div>
                                        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)' }}>Official</div>
                                    </div>
                                </div>
                                <h3 className="srm-reel-title">{reel.title}</h3>
                                {reel.description && <p className="srm-reel-desc">{reel.description}</p>}
                            </div>

                            {/* Side actions */}
                            <div className="srm-side-actions">
                                {/* Like */}
                                <button
                                    className={`srm-action-btn ${reel.is_liked ? 'liked' : ''} ${!currentUser ? 'disabled' : ''}`}
                                    onClick={() => handleLike(reel.id)}
                                    aria-label="إعجاب"
                                >
                                    <div className="srm-action-icon">
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill={reel.is_liked ? '#ff3250' : 'none'} stroke={reel.is_liked ? '#ff3250' : 'currentColor'} strokeWidth="2.5">
                                            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.505 4.044 3 5.5L12 21l7-7Z"/>
                                        </svg>
                                    </div>
                                    <span className="srm-action-count">{formatCount(reel.likes_count)}</span>
                                </button>

                            </div>

                            {/* Scroll hint */}
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


            {/* Add/Edit form */}
            {showAddForm && (
                <AddReelForm
                    initialData={editingReel}
                    onClose={() => { setShowAddForm(false); setEditingReel(null); }}
                    onAdded={handleReelAdded}
                    userLocation={userLocation}
                />
            )}
        </div>
    );
};

export default SpatialReelsModal;
