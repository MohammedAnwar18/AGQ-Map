import React, { useEffect, useRef, useState, useCallback } from 'react';
import { aerialService, directUploadService, getImageUrl } from '../services/api';
import './Panorama360Viewer.css';

// ── Small icons (match the shop 360 viewer) ───────────────────────────────
const GlobeIcon = ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
        <path d="M2 12h20" />
    </svg>
);

const TagIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M20.59 13.41 11 3.83A2 2 0 0 0 9.59 3.24L4 3a1 1 0 0 0-1 1l.24 5.59a2 2 0 0 0 .59 1.41l9.58 9.59a2 2 0 0 0 2.82 0l4.36-4.36a2 2 0 0 0 0-2.82Z" />
        <circle cx="7.5" cy="7.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
);

// ── Layout constants ──────────────────────────────────────────────────────
const VERTICAL_OVERSCAN = 1.18;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3.5;
const CLICK_MOVE_THRESHOLD = 8;
const PLACEHOLDER_ASPECT = 3;

const clampAxis = (pos, dispSize, containerSize) => {
    if (dispSize <= containerSize) return (containerSize - dispSize) / 2;
    return Math.min(0, Math.max(containerSize - dispSize, pos));
};

/*
 * عارض الصورة الجوّية 360°.
 *  - panorama: الكائن (equirect_url, title, hotspots)
 *  - isAdmin: يفعّل وضع التعديل (إضافة عناصر صورة/نص)
 *  - onChange: يُستدعى بعد أي تعديل ليحدّث الخريطة
 *  - onClose: إغلاق العارض
 */
const AerialPanoramaViewer = ({ panorama, isAdmin, onChange, onDelete, onClose }) => {
    const containerRef = useRef(null);
    const layerRef = useRef(null);

    const panRef = useRef({ x: 0, y: 0 });
    const baseSizeRef = useRef({ w: 0, h: 0 });
    const zoomRef = useRef(MIN_ZOOM);
    const dragRef = useRef({ active: false, startX: 0, startY: 0, startPan: { x: 0, y: 0 } });
    const pinchRef = useRef(null);

    const [hotspots, setHotspots] = useState(panorama.hotspots || []);
    const [busy, setBusy] = useState(false);
    const [imgReady, setImgReady] = useState(false);
    const [bgUrl, setBgUrl] = useState(null);
    const [zoomTick, setZoomTick] = useState(0);
    const [showControls, setShowControls] = useState(true);

    const [editMode, setEditMode] = useState(false);
    const [infoCard, setInfoCard] = useState(null);
    const [hotspotForm, setHotspotForm] = useState(null); // { mode, point?, hotspot? }

    // ── Keep hotspots fresh from the server (and tell the map) ────────────
    const refresh = useCallback(async () => {
        try {
            const data = await aerialService.list();
            const fresh = (data.panoramas || []).find(p => p.id === panorama.id);
            if (fresh) setHotspots(fresh.hotspots || []);
            if (onChange) onChange(data.panoramas || []);
        } catch (e) {
            console.error('aerial refresh error:', e);
        }
    }, [panorama.id, onChange]);

    // ── Layout: size/position the pan+zoom layer to fill the viewport ─────
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

    // Load the panorama image once
    useEffect(() => {
        setImgReady(false);
        zoomRef.current = MIN_ZOOM;
        setZoomTick(t => t + 1);

        const src = panorama.equirect_url ? getImageUrl(panorama.equirect_url) : null;
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
        };
        img.onerror = () => {
            recomputeBaseSize(1000, 1000 / PLACEHOLDER_ASPECT, true);
            setBgUrl(null);
            setImgReady(true);
        };
        img.src = src;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [panorama.id]);

    // Re-layout on resize
    useEffect(() => {
        const onResize = () => {
            const src = panorama.equirect_url ? getImageUrl(panorama.equirect_url) : null;
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
    }, [panorama.id]);

    useEffect(() => { applyLayout(); }, [zoomTick, applyLayout]);

    useEffect(() => {
        const t = setTimeout(() => setShowControls(false), 4000);
        return () => clearTimeout(t);
    }, []);

    // ── Pointer / touch interaction ───────────────────────────────────────
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
        if (moved > CLICK_MOVE_THRESHOLD) return;

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

    // ── Hotspot actions ───────────────────────────────────────────────────
    const handleHotspotClick = (e, hs) => {
        e.stopPropagation();
        if (editMode) setHotspotForm({ mode: 'edit', hotspot: hs });
        else setInfoCard(hs);
    };

    const handleDeleteHotspot = async (e, hotspotId) => {
        e.stopPropagation();
        if (!window.confirm('حذف هذا العنصر؟')) return;
        setBusy(true);
        try {
            await aerialService.deleteHotspot(hotspotId);
            await refresh();
        } catch (err) {
            console.error('deleteHotspot error:', err);
            alert('فشل حذف العنصر');
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

            const payload = { type: 'info', label: values.label || '', value: values.value || '' };
            if (imageUrl) payload.image_url = imageUrl;

            if (hotspotForm.mode === 'create') {
                payload.pos_x = hotspotForm.point.pos_x;
                payload.pos_y = hotspotForm.point.pos_y;
                if (imageUrl || !values.imageFile) {
                    await aerialService.addHotspotJson(panorama.id, payload);
                } else {
                    const fd = new FormData();
                    Object.entries(payload).forEach(([k, v]) => fd.append(k, v));
                    fd.append('image', values.imageFile);
                    await aerialService.addHotspot(panorama.id, fd);
                }
            } else if (imageUrl || !values.imageFile) {
                await aerialService.updateHotspotJson(hotspotForm.hotspot.id, payload);
            } else {
                const fd = new FormData();
                Object.entries(payload).forEach(([k, v]) => fd.append(k, v));
                fd.append('image', values.imageFile);
                await aerialService.updateHotspot(hotspotForm.hotspot.id, fd);
            }

            setHotspotForm(null);
            await refresh();
        } catch (err) {
            console.error('submitHotspotForm error:', err);
            alert('فشل حفظ العنصر');
        } finally {
            setBusy(false);
        }
    };

    // ── Render ────────────────────────────────────────────────────────────
    return (
        <div className="p360-overlay" onClick={e => e.stopPropagation()}>
            {/* Top bar */}
            <div className="p360-topbar">
                <div className="p360-topbar-left">
                    <div className="p360-globe-icon"><GlobeIcon /></div>
                    <div className="p360-info">
                        <span className="p360-shop-name">رؤية جوّية</span>
                        <span className="p360-pano-title">{panorama.title || '360°'}</span>
                    </div>
                </div>
                <div className="p360-topbar-right">
                    {isAdmin && editMode && onDelete && (
                        <button
                            className="p360-btn"
                            style={{ background: 'rgba(239,68,68,.18)', color: '#f87171', borderColor: 'rgba(239,68,68,.4)' }}
                            onClick={() => onDelete(panorama.id)}
                        >
                            حذف النقطة
                        </button>
                    )}
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
                            <span>{panorama.title || 'صورة 360'}</span>
                        </div>
                    )}

                    {hotspots.map(hs => (
                        <div key={hs.id} className="p360-hotspot" style={{ left: `${hs.pos_x}%`, top: `${hs.pos_y}%` }}>
                            <button
                                className="p360-hotspot-btn info"
                                onMouseDown={e => e.stopPropagation()}
                                onTouchStart={e => e.stopPropagation()}
                                onClick={(e) => handleHotspotClick(e, hs)}
                            >
                                <TagIcon />
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
            {busy && <div className="p360-busy-overlay"><div className="p360-spinner" /></div>}

            {showControls && !editMode && (
                <div className="p360-hint">اسحب للتنقل داخل الصورة · عجلة الفأرة أو التقريب بإصبعين للتكبير</div>
            )}
            {editMode && (
                <div className="p360-hint p360-hint-edit">اضغط بأي مكان على الصورة لإضافة عنصر (صورة / نص)</div>
            )}

            {/* Info card (viewer clicking an element) */}
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

            {/* Admin element create/edit form */}
            {hotspotForm && (
                <AerialHotspotForm
                    mode={hotspotForm.mode}
                    initial={hotspotForm.hotspot}
                    busy={busy}
                    onCancel={() => setHotspotForm(null)}
                    onSubmit={submitHotspotForm}
                />
            )}
        </div>
    );
};

// ── Admin element form (create / edit) — image + text ──────────────────────
const AerialHotspotForm = ({ mode, initial, busy, onCancel, onSubmit }) => {
    const [label, setLabel] = useState(initial?.label || '');
    const [value, setValue] = useState(initial?.value || '');
    const [imageFile, setImageFile] = useState(null);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!label.trim()) { alert('الرجاء إدخال عنوان للعنصر'); return; }
        onSubmit({ label: label.trim(), value: value.trim(), imageFile });
    };

    return (
        <div className="p360-form-overlay" onClick={onCancel}>
            <form className="p360-form" onClick={e => e.stopPropagation()} onSubmit={handleSubmit}>
                <h3>{mode === 'create' ? 'إضافة عنصر جديد' : 'تعديل العنصر'}</h3>

                <label className="p360-form-label">العنوان</label>
                <input className="p360-input" value={label} onChange={e => setLabel(e.target.value)} placeholder="مثال: معلم، ملاحظة..." autoFocus />

                <label className="p360-form-label">التفاصيل (اختياري)</label>
                <textarea className="p360-textarea" value={value} onChange={e => setValue(e.target.value)} rows={3} placeholder="نص، وصف، ملاحظات..." />

                <label className="p360-form-label">صورة (اختياري)</label>
                <input className="p360-input" type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)} />

                <div className="p360-form-actions">
                    <button type="button" className="p360-btn" onClick={onCancel} disabled={busy}>إلغاء</button>
                    <button type="submit" className="p360-btn p360-btn-primary" disabled={busy}>
                        {busy ? 'جاري الحفظ...' : 'حفظ'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default AerialPanoramaViewer;
