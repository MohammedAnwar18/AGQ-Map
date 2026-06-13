import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Viewer } from 'mapillary-js';
import 'mapillary-js/dist/mapillary.css';
import './StreetViewModal.css';

// ─── Mapillary token ────────────────────────────────────────────────────────
// Get a free token at: https://www.mapillary.com/developer/app/new
// Then set VITE_MAPILLARY_TOKEN in your .env file
const MAPILLARY_TOKEN = import.meta.env.VITE_MAPILLARY_TOKEN || '';

const StreetViewModal = ({ lat, lng, locationName, onClose }) => {
    const containerRef = useRef(null);
    const viewerRef    = useRef(null);

    const [status,   setStatus]   = useState('searching'); // searching | found | not_found | no_token
    const [imgCount, setImgCount] = useState(0);

    // ── Find nearest Mapillary image ─────────────────────────────────────────
    const findNearestImage = useCallback(async () => {
        if (!MAPILLARY_TOKEN) { setStatus('no_token'); return; }

        const delta = 0.003; // ~330m search radius
        const bbox  = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;
        const url   = `https://graph.mapillary.com/images?access_token=${MAPILLARY_TOKEN}&bbox=${bbox}&fields=id,thumb_256_url,computed_geometry&limit=50`;

        try {
            const res  = await fetch(url);
            const data = await res.json();
            const imgs = data?.data || [];

            if (imgs.length === 0) { setStatus('not_found'); return; }

            setImgCount(imgs.length);

            // Pick image closest to clicked point
            const closest = imgs.reduce((best, img) => {
                const [iLng, iLat] = img.computed_geometry?.coordinates || [0, 0];
                const d = Math.hypot(iLat - lat, iLng - lng);
                return d < best.d ? { id: img.id, d } : best;
            }, { id: imgs[0].id, d: Infinity });

            initViewer(closest.id);
        } catch {
            setStatus('not_found');
        }
    }, [lat, lng]);

    // ── Init Mapillary viewer ────────────────────────────────────────────────
    const initViewer = useCallback((imageId) => {
        if (!containerRef.current) return;

        const viewer = new Viewer({
            accessToken: MAPILLARY_TOKEN,
            container:   containerRef.current,
            imageId,
            component: {
                cover:      false,
                sequence:   { visible: false },
                direction:  { maxWidth: 340 },
            },
        });

        viewerRef.current = viewer;

        viewer.on('load', () => setStatus('found'));
        viewer.on('navigatedto', () => setStatus('found'));
    }, []);

    useEffect(() => {
        findNearestImage();
        return () => {
            try { viewerRef.current?.remove(); } catch {}
        };
    }, [findNearestImage]);

    // ── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="sv-overlay">

            {/* Top bar */}
            <div className="sv-topbar">
                <div className="sv-topbar-left">
                    <div className="sv-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10"/>
                            <path d="M12 8v4l3 3"/>
                        </svg>
                    </div>
                    <div className="sv-info">
                        <span className="sv-location">{locationName || 'عرض الشارع'}</span>
                        {status === 'found' && imgCount > 0 && (
                            <span className="sv-badge">{imgCount} صورة متاحة في المنطقة</span>
                        )}
                    </div>
                </div>

                <div className="sv-topbar-actions">
                    <a
                        className="sv-ext-btn"
                        href={`https://www.google.com/maps?layer=c&cbll=${lat},${lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="فتح في Google Street View"
                    >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                            <polyline points="15 3 21 3 21 9"/>
                            <line x1="10" y1="14" x2="21" y2="3"/>
                        </svg>
                        Google Street View
                    </a>
                    <button className="sv-close-btn" onClick={onClose}>✕</button>
                </div>
            </div>

            {/* Mapillary container */}
            <div ref={containerRef} className="sv-viewer" />

            {/* State overlays */}
            {status === 'searching' && (
                <div className="sv-state-overlay">
                    <div className="sv-spinner" />
                    <p>جاري البحث عن صور الشارع...</p>
                    <span>{lat.toFixed(5)}, {lng.toFixed(5)}</span>
                </div>
            )}

            {status === 'not_found' && (
                <div className="sv-state-overlay sv-not-found">
                    <svg width="52" height="52" viewBox="0 0 24 24" fill="none"
                        stroke="rgba(255,255,255,0.4)" strokeWidth="1.5">
                        <circle cx="11" cy="11" r="8"/>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    <p>لا توجد صور للشارع في هذه المنطقة</p>
                    <span>جرب موقعاً آخر أو استخدم Google Street View</span>
                    <a
                        className="sv-google-fallback"
                        href={`https://www.google.com/maps?layer=c&cbll=${lat},${lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        فتح في Google Street View
                    </a>
                </div>
            )}

            {status === 'no_token' && (
                <div className="sv-state-overlay sv-no-token">
                    <svg width="52" height="52" viewBox="0 0 24 24" fill="none"
                        stroke="#fbab15" strokeWidth="1.5">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                    <p>يجب إضافة Mapillary Token</p>
                    <div className="sv-token-steps">
                        <span>1. سجّل مجاناً على <strong>mapillary.com/developer</strong></span>
                        <span>2. أنشئ تطبيقاً واحصل على Client Token</span>
                        <span>3. أضف في ملف <code>.env</code> :</span>
                        <code className="sv-code">VITE_MAPILLARY_TOKEN=your_token_here</code>
                    </div>
                    <a
                        className="sv-google-fallback"
                        href={`https://www.google.com/maps?layer=c&cbll=${lat},${lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        فتح في Google Street View الآن
                    </a>
                </div>
            )}

            {/* Bottom hint */}
            {status === 'found' && (
                <div className="sv-hint">
                    انقر على الأسهم للتنقل في الشارع · اسحب للتدوير
                </div>
            )}
        </div>
    );
};

export default StreetViewModal;
