import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Viewer } from 'mapillary-js';
import 'mapillary-js/dist/mapillary.css';
import './StreetViewModal.css';

const MAPILLARY_TOKEN = import.meta.env.VITE_MAPILLARY_TOKEN || '';

// Progressive search radii in degrees (~111m, ~330m, ~1km)
const SEARCH_RADII = [0.001, 0.003, 0.009];

const StreetViewModal = ({ lat, lng, locationName, onClose, onPositionChange, inline = false }) => {
    const containerRef = useRef(null);
    const viewerRef    = useRef(null);

    const [status,       setStatus]       = useState('searching');
    const [imgCount,     setImgCount]     = useState(0);
    const [searchRadius, setSearchRadius] = useState(0);
    const [currentImg,   setCurrentImg]   = useState(null);

    // ── Find nearest image with progressive radius ────────────────────────────
    const findImage = useCallback(async () => {
        if (!MAPILLARY_TOKEN) { setStatus('no_token'); return; }

        for (const delta of SEARCH_RADII) {
            setSearchRadius(Math.round(delta * 111000));
            const bbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;
            const url  = `https://graph.mapillary.com/images?access_token=${MAPILLARY_TOKEN}&bbox=${bbox}&fields=id,computed_geometry&limit=100`;

            try {
                const res  = await fetch(url);
                const data = await res.json();
                const imgs = data?.data || [];

                if (imgs.length === 0) continue;

                setImgCount(imgs.length);

                const closest = imgs.reduce((best, img) => {
                    const [iLng, iLat] = img.computed_geometry?.coordinates || [0, 0];
                    const d = Math.hypot(iLat - lat, iLng - lng);
                    return d < best.d ? { id: img.id, d, coords: [iLat, iLng] } : best;
                }, { id: imgs[0].id, d: Infinity, coords: [lat, lng] });

                initViewer(closest.id);
                return;
            } catch { continue; }
        }

        setStatus('not_found');
    }, [lat, lng]);

    // ── Init Mapillary viewer ─────────────────────────────────────────────────
    const initViewer = useCallback((imageId) => {
        if (!containerRef.current) return;

        const viewer = new Viewer({
            accessToken: MAPILLARY_TOKEN,
            container:   containerRef.current,
            imageId,
            component: {
                cover:     false,
                sequence:  { visible: false },
                direction: { maxWidth: 300 },
            },
        });

        viewerRef.current = viewer;

        viewer.on('load', () => setStatus('found'));

        // Update map pegman whenever user navigates to a new image
        viewer.on('image', async () => {
            try {
                const img = await viewer.getImage();
                if (!img) return;
                setCurrentImg(img.id);
                const lngLat = img.lngLat;
                if (lngLat && onPositionChange) {
                    onPositionChange(lngLat.lat, lngLat.lng, img.computedAltitude);
                }
            } catch {}
        });
    }, [onPositionChange]);

    useEffect(() => {
        findImage();
        return () => {
            try { viewerRef.current?.remove(); } catch {}
        };
    }, [findImage]);

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className={inline ? 'sv-panel sv-inline' : 'sv-panel'}>

            {/* ── Header ── */}
            <div className="sv-header">
                <div className="sv-header-left">
                    <div className="sv-pegman-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="12" cy="6" r="3.5"/>
                            <path d="M6.5 21v-3.5a5.5 5.5 0 0 1 11 0V21"/>
                        </svg>
                    </div>
                    <div className="sv-header-info">
                        <span className="sv-title">عرض الشارع</span>
                        {locationName && <span className="sv-subtitle">{locationName}</span>}
                    </div>
                </div>

                <div className="sv-header-right">
                    {status === 'found' && imgCount > 0 && (
                        <span className="sv-img-count">{imgCount} صورة</span>
                    )}
                    <button className="sv-close" onClick={onClose} title="إغلاق">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2.5">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>
            </div>

            {/* ── Viewer ── */}
            <div ref={containerRef} className="sv-viewer-area" />

            {/* ── State overlays ── */}
            {status === 'searching' && (
                <div className="sv-overlay-state">
                    <div className="sv-spinner" />
                    <p>جاري البحث عن صور الشارع</p>
                    <span>نطاق البحث: {searchRadius} متر</span>
                </div>
            )}

            {status === 'not_found' && (
                <div className="sv-overlay-state">
                    <svg width="44" height="44" viewBox="0 0 24 24" fill="none"
                        stroke="rgba(255,255,255,0.35)" strokeWidth="1.5">
                        <circle cx="11" cy="11" r="8"/>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    <p>لا توجد صور في هذه المنطقة</p>
                    <span>جرّب موقعاً آخر على الخريطة</span>
                </div>
            )}

            {status === 'no_token' && (
                <div className="sv-overlay-state">
                    <svg width="44" height="44" viewBox="0 0 24 24" fill="none"
                        stroke="#fbab15" strokeWidth="1.5">
                        <rect x="3" y="11" width="18" height="11" rx="2"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                    <p>Token غير مُعيَّن</p>
                    <code className="sv-token-code">VITE_MAPILLARY_TOKEN=your_token</code>
                </div>
            )}

            {/* ── Navigation hint ── */}
            {status === 'found' && (
                <div className="sv-nav-hint">
                    انقر على الأسهم للتنقل · اسحب للتدوير
                </div>
            )}
        </div>
    );
};

export default StreetViewModal;
