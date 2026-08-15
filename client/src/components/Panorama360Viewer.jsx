import React, { useEffect, useRef, useState, useCallback } from 'react';
import { shopService, directUploadService, getImageUrl } from '../services/api';
import './Panorama360Viewer.css';

// ── Small icons ──────────────────────────────────────────────────────────
const GlobeIcon = ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
        <path d="M2 12h20" />
    </svg>
);

const ArrowIcon = () => (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <line x1="12" y1="19" x2="12" y2="5" />
        <polyline points="5 12 12 5 19 12" />
    </svg>
);

const TagIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M20.59 13.41 11 3.83A2 2 0 0 0 9.59 3.24L4 3a1 1 0 0 0-1 1l.24 5.59a2 2 0 0 0 .59 1.41l9.58 9.59a2 2 0 0 0 2.82 0l4.36-4.36a2 2 0 0 0 0-2.82Z" />
        <circle cx="7.5" cy="7.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
);

const ChevronIcon = ({ dir = 'right' }) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
        {dir === 'right'
            ? <polyline points="9 6 15 12 9 18" />
            : <polyline points="15 6 9 12 15 18" />}
    </svg>
);

// ── Layout constants ───────────────────────────────────────────────────
const VERTICAL_OVERSCAN = 1.18; // gives a little vertical look-around room beyond the flat photo
const MIN_ZOOM = 1;
const MAX_ZOOM = 3.5;
const CLICK_MOVE_THRESHOLD = 8;
const PLACEHOLDER_ASPECT = 3; // width / height, used when a panorama has no image yet

const clampAxis = (pos, dispSize, containerSize) => {
    if (dispSize <= containerSize) return (containerSize - dispSize) / 2;
    return Math.min(0, Math.max(containerSize - dispSize, pos));
};

const Panorama360Viewer = ({ shopId, shopName, isAdmin, initialPanoramas, onClose }) => {
    const containerRef = useRef(null);
    const layerRef = useRef(null);

    const panRef = useRef({ x: 0, y: 0 });
    const baseSizeRef = useRef({ w: 0, h: 0 });
    const zoomRef = useRef(MIN_ZOOM);
    const dragRef = useRef({ active: false, startX: 0, startY: 0, startPan: { x: 0, y: 0 } });
    const pinchRef = useRef(null); // { startDist, startZoom }

    const [panoramas, setPanoramas] = useState(initialPanoramas || []);
    const [loading, setLoading] = useState(!initialPanoramas);
    const [busy, setBusy] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(null);

    const [currentId, setCurrentId] = useState(null);
    const [imgReady, setImgReady] = useState(false);
    const [bgUrl, setBgUrl] = useState(null);
    const [isTransition, setIsTransition] = useState(false);
    const [zoomTick, setZoomTick] = useState(0); // forces re-layout after zoom changes
    const [showControls, setShowControls] = useState(true);

    const [editMode, setEditMode] = useState(false);
    const [infoCard, setInfoCard] = useState(null);
    const [hotspotForm, setHotspotForm] = useState(null); // { mode: 'create'|'edit', point?, hotspot? }
    const [uploadingPano, setUploadingPano] = useState(false);
    const fileInputRef = useRef(null);

    const getPanorama = useCallback((id) => panoramas.find(p => p.id === id) || panoramas[0], [panoramas]);
    const currentIndex = panoramas.findIndex(p => p.id === currentId);

    // ── Data loading ────────────────────────────────────────────────────
    const refreshPanoramas = useCallback(async (keepId) => {
        try {
            const data = await shopService.getPanoramas(shopId);
            const list = data.panoramas || [];
            setPanoramas(list);
            if (list.length) {
                const stillExists = keepId && list.some(p => p.id === keepId);
                setCurrentId(stillExists ? keepId : list[0].id);
            }
            return list;
        } catch (e) {
            console.error('refreshPanoramas error:', e);
            return panoramas;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [shopId]);

    useEffect(() => {
        if (initialPanoramas && initialPanoramas.length) {
            setCurrentId(initialPanoramas[0].id);
            setLoading(false);
            return;
        }
        (async () => {
            setLoading(true);
            try {
                const data = await shopService.getPanoramas(shopId);
                const list = data.panoramas || [];
                setPanoramas(list);
                if (list.length) setCurrentId(list[0].id);
            } catch (e) {
                console.error('getPanoramas error:', e);
            } finally {
                setLoading(false);
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [shopId]);

    // ── Layout: size/position the pan+zoom layer to fill the viewport ────
    const applyLayout = useCallback(() => {
        const container = containerRef.current;
        const layer = layerRef.current;
        if (!container || !layer) return;
        const cw = container.clientWidth;
        const ch = container.clientHeight;
        const { w: baseW, h: baseH } = baseSizeRef.current;
        if (!baseW || !baseH) return;

        const z = zoomRef.current;
        const dispW = baseW * z;
        const dispH = baseH * z;

        panRef.current.x = clampAxis(panRef.current.x, dispW, cw);
        panRef.current.y = clampAxis(panRef.current.y, dispH, ch);

        layer.style.width = `${dispW}px`;
        layer.style.height = `${dispH}px`;
        layer.style.left = `${panRef.current.x}px`;
        layer.style.top = `${panRef.current.y}px`;
    }, []);

    const recomputeBaseSize = useCallback((naturalW, naturalH, recenter) => {
        const container = containerRef.current;
        if (!container) return;
        const ch = container.clientHeight;
        const baseH = ch * VERTICAL_OVERSCAN;
        const baseW = naturalW * (baseH / naturalH);
        baseSizeRef.current = { w: baseW, h: baseH };
        if (recenter) {
            const cw = container.clientWidth;
            panRef.current = {
                x: clampAxis((cw - baseW * zoomRef.current) / 2, baseW * zoomRef.current, cw),
                y: clampAxis((ch - baseH * zoomRef.current) / 2, baseH * zoomRef.current, ch)
            };
        }
        applyLayout();
    }, [applyLayout]);

    // Load the current panorama's image (or a placeholder aspect ratio)
    useEffect(() => {
        if (!currentId) return;
        const pano = getPanorama(currentId);
        if (!pano) return;

        setImgReady(false);
        zoomRef.current = MIN_ZOOM;
        setZoomTick(t => t + 1);

        const src = pano.equirect_url ? getImageUrl(pano.equirect_url) : null;
        if (!src) {
            recomputeBaseSize(1000, 1000 / PLACEHOLDER_ASPECT, true);
            setBgUrl(null);
            setImgReady(true);
            return;
        }

        const img = new Image();
        img.onload = () => {
            recomputeBaseSize(img.naturalWidth || 1000, img.naturalHeight || (1000 / PLACEHOLDER_ASPECT), true);
            setBgUrl(src);
            setImgReady(true);
            setIsTransition(false);
        };
        img.onerror = () => {
            recomputeBaseSize(1000, 1000 / PLACEHOLDER_ASPECT, true);
            setBgUrl(null);
            setImgReady(true);
            setIsTransition(false);
        };
        img.src = src;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentId]);

    // Re-layout on container resize / orientation change
    useEffect(() => {
        const onResize = () => {
            const pano = getPanorama(currentId);
            if (!pano) return;
            const src = pano.equirect_url ? getImageUrl(pano.equirect_url) : null;
            if (src) {
                const img = new Image();
                img.onload = () => recomputeBaseSize(img.naturalWidth, img.naturalHeight, false);
                img.src = src;
            } else {
                recomputeBaseSize(1000, 1000 / PLACEHOLDER_ASPECT, false);
            }
        };
        window.addEventListener('resize', onResize);
        window.addEventListener('orientationchange', onResize);
        return () => {
            window.removeEventListener('resize', onResize);
            window.removeEventListener('orientationchange', onResize);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentId]);

    useEffect(() => { applyLayout(); }, [zoomTick, applyLayout]);

    const navigateTo = useCallback((targetId) => {
        if (!targetId || targetId === currentId) return;
        setIsTransition(true);
        setInfoCard(null);
        setCurrentId(targetId);
    }, [currentId]);

    const goPrev = useCallback(() => {
        if (currentIndex > 0) navigateTo(panoramas[currentIndex - 1].id);
    }, [currentIndex, panoramas, navigateTo]);

    const goNext = useCallback(() => {
        if (currentIndex < panoramas.length - 1) navigateTo(panoramas[currentIndex + 1].id);
    }, [currentIndex, panoramas, navigateTo]);

    // ── Pointer / touch interaction (drag to pan, wheel/pinch to zoom) ────
    const point = (e) => ({
        x: e.clientX ?? e.touches?.[0]?.clientX,
        y: e.clientY ?? e.touches?.[0]?.clientY
    });

    const onDown = useCallback((e) => {
        if (e.touches && e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            pinchRef.current = { startDist: Math.hypot(dx, dy), startZoom: zoomRef.current };
            dragRef.current.active = false;
            return;
        }
        const { x, y } = point(e);
        dragRef.current = { active: true, startX: x, startY: y, startPan: { ...panRef.current } };
    }, []);

    const onMove = useCallback((e) => {
        if (e.touches && e.touches.length === 2 && pinchRef.current) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const dist = Math.hypot(dx, dy);
            const ratio = dist / Math.max(pinchRef.current.startDist, 1);
            zoomRef.current = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, pinchRef.current.startZoom * ratio));
            applyLayout();
            return;
        }
        if (!dragRef.current.active) return;
        const { x, y } = point(e);
        panRef.current = {
            x: dragRef.current.startPan.x + (x - dragRef.current.startX),
            y: dragRef.current.startPan.y + (y - dragRef.current.startY)
        };
        applyLayout();
    }, [applyLayout]);

    const onUp = useCallback((e) => {
        pinchRef.current = null;
        if (!dragRef.current.active) return;
        dragRef.current.active = false;

        const { x, y } = point(e) || {};
        if (x === undefined) return;
        const moved = Math.hypot(x - dragRef.current.startX, y - dragRef.current.startY);
        if (moved > CLICK_MOVE_THRESHOLD) return; // was a drag/pinch, not a tap

        if (editMode && layerRef.current) {
            const rect = layerRef.current.getBoundingClientRect();
            const px = ((x - rect.left) / rect.width) * 100;
            const py = ((y - rect.top) / rect.height) * 100;
            if (px >= 0 && px <= 100 && py >= 0 && py <= 100) {
                setHotspotForm({ mode: 'create', point: { pos_x: px, pos_y: py } });
            }
        }
    }, [editMode]);

    const onWheel = useCallback((e) => {
        e.preventDefault();
        zoomRef.current = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoomRef.current - e.deltaY * 0.0015));
        applyLayout();
    }, [applyLayout]);

    useEffect(() => {
        const t = setTimeout(() => setShowControls(false), 4000);
        return () => clearTimeout(t);
    }, [currentId]);

    // ── Admin actions ──────────────────────────────────────────────────
    const handleHotspotClick = (e, hs) => {
        e.stopPropagation();
        if (editMode) {
            setHotspotForm({ mode: 'edit', hotspot: hs });
        } else if (hs.type === 'link') {
            navigateTo(hs.target_panorama_id);
        } else {
            setInfoCard(hs);
        }
    };

    const handleDeleteHotspot = async (e, hotspotId) => {
        e.stopPropagation();
        if (!window.confirm('حذف هذه النقطة؟')) return;
        setBusy(true);
        try {
            await shopService.deletePanoramaHotspot(hotspotId);
            await refreshPanoramas(currentId);
        } catch (err) {
            console.error('deleteHotspot error:', err);
            alert('فشل حذف النقطة');
        } finally {
            setBusy(false);
        }
    };

    const submitHotspotForm = async (values) => {
        setBusy(true);
        try {
            let imageUrl = null;
            if (values.imageFile) {
                try {
                    imageUrl = await directUploadService.upload(values.imageFile, { maxSizeMB: 50 });
                } catch (uploadErr) {
                    console.warn('Direct hotspot image upload failed, falling back to server upload:', uploadErr);
                }
            }

            const payload = {
                type: values.type,
                label: values.label || '',
                value: values.value || '',
                target_panorama_id: values.type === 'link' ? (values.target_panorama_id || '') : ''
            };
            if (imageUrl) payload.image_url = imageUrl;

            if (hotspotForm.mode === 'create') {
                payload.pos_x = hotspotForm.point.pos_x;
                payload.pos_y = hotspotForm.point.pos_y;
                if (imageUrl || !values.imageFile) {
                    await shopService.addPanoramaHotspotJson(currentId, payload);
                } else {
                    const fd = new FormData();
                    Object.entries(payload).forEach(([k, v]) => fd.append(k, v));
                    fd.append('image', values.imageFile);
                    await shopService.addPanoramaHotspot(currentId, fd);
                }
            } else if (imageUrl || !values.imageFile) {
                await shopService.updatePanoramaHotspotJson(hotspotForm.hotspot.id, payload);
            } else {
                const fd = new FormData();
                Object.entries(payload).forEach(([k, v]) => fd.append(k, v));
                fd.append('image', values.imageFile);
                await shopService.updatePanoramaHotspot(hotspotForm.hotspot.id, fd);
            }

            setHotspotForm(null);
            await refreshPanoramas(currentId);
        } catch (err) {
            console.error('submitHotspotForm error:', err);
            alert('فشل حفظ النقطة');
        } finally {
            setBusy(false);
        }
    };

    const handleUploadPanorama = async (file) => {
        if (!file) return;
        setUploadingPano(true);
        setUploadProgress(0);
        try {
            let equirectUrl = null;
            try {
                equirectUrl = await directUploadService.upload(file, {
                    maxSizeMB: 50,
                    onProgress: setUploadProgress
                });
            } catch (uploadErr) {
                console.warn('Direct panorama upload failed, falling back to server upload:', uploadErr);
            }

            let created;
            if (equirectUrl) {
                created = await shopService.addPanoramaFromUrl(shopId, {
                    title: `صورة ${panoramas.length + 1}`,
                    equirect_url: equirectUrl
                });
            } else {
                const fd = new FormData();
                fd.append('title', `صورة ${panoramas.length + 1}`);
                fd.append('equirect_file', file);
                created = await shopService.addPanorama(shopId, fd);
            }

            const list = await refreshPanoramas(created.id);
            const target = list.find(p => p.id === created.id);
            if (target) navigateTo(target.id);
        } catch (err) {
            console.error('addPanorama error:', err);
            alert(err.message || 'فشل رفع الصورة');
        } finally {
            setUploadingPano(false);
            setUploadProgress(null);
        }
    };

    const handleDeletePanorama = async (panoramaId) => {
        if (panoramas.length <= 1) {
            alert('لا يمكن حذف آخر صورة');
            return;
        }
        if (!window.confirm('حذف هذه الصورة وكل النقاط عليها؟')) return;
        setBusy(true);
        try {
            await shopService.deletePanorama(panoramaId);
            await refreshPanoramas(panoramaId === currentId ? null : currentId);
        } catch (err) {
            console.error('deletePanorama error:', err);
            alert('فشل حذف الصورة');
        } finally {
            setBusy(false);
        }
    };

    const movePanorama = async (index, direction) => {
        const list = [...panoramas];
        const target = index + direction;
        if (target < 0 || target >= list.length) return;
        [list[index], list[target]] = [list[target], list[index]];
        setPanoramas(list);
        try {
            await shopService.reorderPanoramas(list.map(p => p.id));
        } catch (err) {
            console.error('reorderPanoramas error:', err);
        }
    };

    // ── Render ────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="p360-overlay" onClick={e => e.stopPropagation()}>
                <div className="p360-center-msg">
                    <div className="p360-spinner" />
                    <span>جاري تحميل الجولة...</span>
                </div>
                <button className="p360-close-btn p360-close-standalone" onClick={onClose}>✕</button>
            </div>
        );
    }

    if (!panoramas.length) {
        return (
            <div className="p360-overlay" onClick={e => e.stopPropagation()}>
                <div className="p360-center-msg">
                    <GlobeIcon size={40} />
                    <span>لا توجد صور 360° لهذا المحل بعد</span>
                    {isAdmin && (
                        <>
                            <button className="p360-btn p360-btn-primary" onClick={() => fileInputRef.current?.click()} disabled={uploadingPano}>
                                {uploadingPano ? `جاري الرفع... ${uploadProgress ?? ''}%` : '+ إضافة أول صورة 360'}
                            </button>
                            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                                onChange={e => { handleUploadPanorama(e.target.files?.[0]); e.target.value = ''; }} />
                        </>
                    )}
                </div>
                <button className="p360-close-btn p360-close-standalone" onClick={onClose}>✕</button>
            </div>
        );
    }

    const currentPano = getPanorama(currentId);
    const currentHotspots = currentPano?.hotspots || [];

    return (
        <div className="p360-overlay" onClick={e => e.stopPropagation()}>
            {/* Top bar */}
            <div className="p360-topbar">
                <div className="p360-topbar-left">
                    <div className="p360-globe-icon"><GlobeIcon /></div>
                    <div className="p360-info">
                        <span className="p360-shop-name">{shopName}</span>
                        <span className="p360-pano-title">{currentPano?.title || '360°'}</span>
                    </div>
                </div>
                <div className="p360-topbar-right">
                    {isAdmin && (
                        <button
                            className={`p360-btn p360-edit-toggle ${editMode ? 'active' : ''}`}
                            onClick={() => setEditMode(v => !v)}
                        >
                            {editMode ? 'إنهاء التعديل' : 'وضع التعديل'}
                        </button>
                    )}
                    <button className="p360-close-btn" onClick={onClose}>✕</button>
                </div>
            </div>

            {/* Viewport */}
            <div
                ref={containerRef}
                className={`p360-canvas-area ${editMode ? 'editing' : ''}`}
                onMouseDown={onDown}
                onMouseMove={onMove}
                onMouseUp={onUp}
                onMouseLeave={onUp}
                onTouchStart={onDown}
                onTouchMove={onMove}
                onTouchEnd={onUp}
                onWheel={onWheel}
            >
                <div
                    ref={layerRef}
                    className="p360-layer"
                    style={bgUrl ? { backgroundImage: `url(${bgUrl})` } : undefined}
                >
                    {!bgUrl && imgReady && (
                        <div className="p360-layer-placeholder">
                            <GlobeIcon size={36} />
                            <span>{currentPano?.title || 'صورة 360'}</span>
                        </div>
                    )}

                    {currentHotspots.map(hs => (
                        <div key={hs.id} className="p360-hotspot" style={{ left: `${hs.pos_x}%`, top: `${hs.pos_y}%` }}>
                            <button
                                className={`p360-hotspot-btn ${hs.type === 'link' ? 'link' : 'info'}`}
                                onMouseDown={e => e.stopPropagation()}
                                onTouchStart={e => e.stopPropagation()}
                                onClick={(e) => handleHotspotClick(e, hs)}
                            >
                                {hs.type === 'link' ? <ArrowIcon /> : <TagIcon />}
                            </button>
                            {hs.label && <span className="p360-hotspot-label">{hs.label}</span>}
                            {editMode && (
                                <button
                                    className="p360-hotspot-delete"
                                    onMouseDown={e => e.stopPropagation()}
                                    onTouchStart={e => e.stopPropagation()}
                                    onClick={(e) => handleDeleteHotspot(e, hs.id)}
                                >×</button>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {!imgReady && <div className="p360-busy-overlay"><div className="p360-spinner" /></div>}
            {isTransition && <div className="p360-transition-fade" />}
            {busy && <div className="p360-busy-overlay"><div className="p360-spinner" /></div>}

            {/* Desktop: bottom thumbnail strip. Mobile: side arrows (see CSS breakpoints) */}
            {panoramas.length > 1 && (
                <>
                    <button className="p360-side-nav left" onClick={goPrev} disabled={currentIndex <= 0} aria-label="الصورة السابقة">
                        <ChevronIcon dir="left" />
                    </button>
                    <button className="p360-side-nav right" onClick={goNext} disabled={currentIndex >= panoramas.length - 1} aria-label="الصورة التالية">
                        <ChevronIcon dir="right" />
                    </button>
                </>
            )}

            <div className="p360-pano-strip">
                {panoramas.map((pano, idx) => (
                    <div key={pano.id} className={`p360-pano-thumb-wrap ${pano.id === currentId ? 'active' : ''}`}>
                        <button className="p360-pano-thumb" onClick={() => navigateTo(pano.id)}>
                            <GlobeIcon size={16} />
                            <span>{pano.title || `صورة ${idx + 1}`}</span>
                        </button>
                        {editMode && (
                            <div className="p360-thumb-admin-row">
                                <button title="تحريك للأعلى" onClick={() => movePanorama(idx, -1)} disabled={idx === 0}>↑</button>
                                <button title="تحريك للأسفل" onClick={() => movePanorama(idx, 1)} disabled={idx === panoramas.length - 1}>↓</button>
                                <button title="حذف" className="danger" onClick={() => handleDeletePanorama(pano.id)}>×</button>
                            </div>
                        )}
                    </div>
                ))}
                {editMode && (
                    <>
                        <button className="p360-add-pano-btn" onClick={() => fileInputRef.current?.click()} disabled={uploadingPano}>
                            {uploadingPano ? `${uploadProgress ?? 0}%` : '+'}
                        </button>
                        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                            onChange={e => { handleUploadPanorama(e.target.files?.[0]); e.target.value = ''; }} />
                    </>
                )}
            </div>

            {showControls && !editMode && (
                <div className="p360-hint">اسحب للتنقل داخل الصورة · عجلة الفأرة أو التقريب بإصبعين للتكبير</div>
            )}
            {editMode && (
                <div className="p360-hint p360-hint-edit">اضغط بأي مكان على الصورة لإضافة نقطة جديدة</div>
            )}

            {/* Info card (viewer clicking an info hotspot) */}
            {infoCard && (
                <div className="p360-info-card-overlay" onClick={() => setInfoCard(null)}>
                    <div className="p360-info-card" onClick={e => e.stopPropagation()}>
                        <button className="p360-info-card-close" onClick={() => setInfoCard(null)}>✕</button>
                        {infoCard.image_url && (
                            <img className="p360-info-card-img" src={getImageUrl(infoCard.image_url)} alt={infoCard.label || ''} />
                        )}
                        <h3>{infoCard.label}</h3>
                        {infoCard.value && <p>{infoCard.value}</p>}
                    </div>
                </div>
            )}

            {/* Admin hotspot create/edit form */}
            {hotspotForm && (
                <HotspotForm
                    mode={hotspotForm.mode}
                    initial={hotspotForm.hotspot}
                    panoramaOptions={panoramas.filter(p => p.id !== currentId)}
                    busy={busy}
                    onCancel={() => setHotspotForm(null)}
                    onSubmit={submitHotspotForm}
                />
            )}
        </div>
    );
};

// ── Admin hotspot form (create / edit) ─────────────────────────────────
const HotspotForm = ({ mode, initial, panoramaOptions, busy, onCancel, onSubmit }) => {
    const [type, setType] = useState(initial?.type || 'info');
    const [label, setLabel] = useState(initial?.label || '');
    const [value, setValue] = useState(initial?.value || '');
    const [targetId, setTargetId] = useState(initial?.target_panorama_id || (panoramaOptions[0]?.id || ''));
    const [imageFile, setImageFile] = useState(null);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!label.trim()) { alert('الرجاء إدخال عنوان للنقطة'); return; }
        if (type === 'link' && !targetId) { alert('الرجاء اختيار الصورة الهدف'); return; }
        onSubmit({ type, label: label.trim(), value: value.trim(), target_panorama_id: targetId, imageFile });
    };

    return (
        <div className="p360-form-overlay" onClick={onCancel}>
            <form className="p360-form" onClick={e => e.stopPropagation()} onSubmit={handleSubmit}>
                <h3>{mode === 'create' ? 'إضافة نقطة جديدة' : 'تعديل النقطة'}</h3>

                <label className="p360-form-label">النوع</label>
                <div className="p360-type-toggle">
                    <button type="button" className={type === 'info' ? 'active' : ''} onClick={() => setType('info')}>معلومة / بضاعة</button>
                    <button type="button" className={type === 'link' ? 'active' : ''} onClick={() => setType('link')}>رابط تنقل لصورة أخرى</button>
                </div>

                <label className="p360-form-label">العنوان</label>
                <input className="p360-input" value={label} onChange={e => setLabel(e.target.value)} placeholder="مثال: بضاعة، مدخل القاعة..." autoFocus />

                {type === 'info' ? (
                    <>
                        <label className="p360-form-label">التفاصيل (اختياري)</label>
                        <textarea className="p360-textarea" value={value} onChange={e => setValue(e.target.value)} rows={3} placeholder="وصف، سعر، ملاحظات..." />
                        <label className="p360-form-label">صورة (اختياري)</label>
                        <input className="p360-input" type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)} />
                    </>
                ) : (
                    <>
                        <label className="p360-form-label">الانتقال إلى</label>
                        {panoramaOptions.length ? (
                            <select className="p360-input" value={targetId} onChange={e => setTargetId(e.target.value)}>
                                {panoramaOptions.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                            </select>
                        ) : (
                            <p className="p360-form-note">أضف صورة 360 أخرى أولاً لتتمكن من الربط بها.</p>
                        )}
                    </>
                )}

                <div className="p360-form-actions">
                    <button type="button" className="p360-btn" onClick={onCancel} disabled={busy}>إلغاء</button>
                    <button type="submit" className="p360-btn p360-btn-primary" disabled={busy || (type === 'link' && !panoramaOptions.length)}>
                        {busy ? 'جاري الحفظ...' : 'حفظ'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default Panorama360Viewer;
