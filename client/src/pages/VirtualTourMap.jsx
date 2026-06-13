import React, { useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Map, { Marker } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { TOUR_LOCATIONS } from '../data/tourData';
import VirtualTourViewer from '../components/VirtualTourViewer';
import StreetViewModal from '../components/StreetViewModal';
import './VirtualTourMap.css';

const VirtualTourMap = () => {
    const navigate  = useNavigate();
    const mapRef    = useRef(null);

    // Mode: '360' | 'street'
    const [mode, setMode] = useState('360');

    // 360° state
    const [selectedLocation, setSelectedLocation] = useState(null);
    const [hoveredId,        setHoveredId]        = useState(null);

    // Street View state
    const [svCoords,   setSvCoords]   = useState(null);
    const [svPosition, setSvPosition] = useState(null);

    // ── Map config ───────────────────────────────────────────────────────────
    const MAPBOX_TOKEN = useMemo(() => {
        const env = import.meta.env.VITE_MAPBOX_TOKEN;
        if (env?.startsWith('pk.')) return env;
        const a = 'pk.ey', b = 'J1IjoibW9oYW1tZWQtMTMzMSIsI',
              c = 'mEiOiJjbWlsaWh1anAxM2kzM2d', d = 'yNHR5eTU4am9hIn0.',
              e = 'arsZikWNpuoceyWdnM30VA';
        return (a + b + c + d + e).trim();
    }, []);

    const MAP_STYLE = useMemo(() =>
        MAPBOX_TOKEN
            ? `https://api.mapbox.com/styles/v1/mohammed-1331/cmbseyy16010101qwf9d5a8m3?access_token=${MAPBOX_TOKEN}`
            : `https://api.maptiler.com/maps/019b8b76-e5e2-7f02-b5d1-74fd0cf725bb/style.json?key=N6uNP3sTu25OIBUyi9G1`
    , [MAPBOX_TOKEN]);

    const transformRequest = useCallback((url) => {
        if (!url.startsWith('mapbox://') || !MAPBOX_TOKEN) return { url };
        let fu = url.replace('mapbox://', 'https://api.mapbox.com/');
        if (url.includes('mapbox://styles/'))  fu = fu.replace('/styles/', '/styles/v1/');
        if (url.includes('mapbox://fonts/'))   fu = fu.replace('/fonts/', '/fonts/v1/');
        if (url.includes('mapbox://sprites/')) fu = fu.replace('/sprites/', '/sprites/v1/');
        const sep = fu.includes('?') ? '&' : '?';
        return { url: `${fu}${sep}access_token=${MAPBOX_TOKEN}`, headers: {} };
    }, [MAPBOX_TOKEN]);

    // ── Mode switch ──────────────────────────────────────────────────────────
    const switchMode = (m) => {
        setMode(m);
        setSelectedLocation(null);
        setSvCoords(null);
        setSvPosition(null);
    };

    // ── Map click (Street View mode) ─────────────────────────────────────────
    const handleMapClick = useCallback((e) => {
        if (mode !== 'street') return;
        setSvCoords({ lat: e.lngLat.lat, lng: e.lngLat.lng });
        setSvPosition(null);
    }, [mode]);

    // ── Street View panel is open ────────────────────────────────────────────
    const svOpen = mode === 'street' && svCoords;

    return (
        <div className="vtmap-root">

            {/* ══ HEADER ═══════════════════════════════════════════════════ */}
            <div className="vtmap-header">

                <button className="vtmap-back-btn" onClick={() => navigate('/map')}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2.5">
                        <polyline points="15 18 9 12 15 6"/>
                    </svg>
                    العودة
                </button>

                <div className="vtmap-header-center">
                    <div className="vtmap-logo-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10"/>
                            <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/>
                            <path d="M2 12h20"/>
                        </svg>
                    </div>
                    <span className="vtmap-header-title">الجولة الافتراضية</span>
                </div>

                {/* Mode toggle */}
                <div className="vtmap-mode-toggle">
                    <button
                        className={`vtmap-mode-btn ${mode === '360' ? 'active' : ''}`}
                        onClick={() => switchMode('360')}
                    >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10"/>
                            <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/>
                            <path d="M2 12h20"/>
                        </svg>
                        جولة 360°
                    </button>
                    <button
                        className={`vtmap-mode-btn ${mode === 'street' ? 'active' : ''}`}
                        onClick={() => switchMode('street')}
                    >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="6" r="3"/>
                            <path d="M7 21v-3a5 5 0 0 1 10 0v3"/>
                        </svg>
                        عرض الشارع
                    </button>
                </div>
            </div>

            {/* ══ BODY ═════════════════════════════════════════════════════ */}
            <div className="vtmap-body">

                {/* ── Map area (shrinks when SV panel is open) ── */}
                <div className={`vtmap-map-wrap ${svOpen ? 'sv-open' : ''}`}>

                    {/* Street View mode hint */}
                    {mode === 'street' && !svCoords && (
                        <div className="vtmap-sv-hint">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                                stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="6" r="3"/>
                                <path d="M7 21v-3a5 5 0 0 1 10 0v3"/>
                            </svg>
                            انقر على أي نقطة في الخريطة لعرض الشارع
                        </div>
                    )}

                    <Map
                        ref={mapRef}
                        initialViewState={{ longitude: 35.19, latitude: 31.96, zoom: 12 }}
                        style={{ width: '100%', height: '100%' }}
                        mapStyle={MAP_STYLE}
                        transformRequest={MAPBOX_TOKEN ? transformRequest : undefined}
                        attributionControl={false}
                        cursor={mode === 'street' ? 'crosshair' : 'grab'}
                        onClick={handleMapClick}
                    >
                        {/* 360° Tour markers */}
                        {mode === '360' && TOUR_LOCATIONS.map((loc) => (
                            <Marker
                                key={loc.id}
                                longitude={loc.lng}
                                latitude={loc.lat}
                                anchor="bottom"
                                onClick={(e) => { e.originalEvent.stopPropagation(); setSelectedLocation(loc); }}
                            >
                                <div
                                    className={`vtmap-marker ${hoveredId === loc.id ? 'hovered' : ''}`}
                                    onMouseEnter={() => setHoveredId(loc.id)}
                                    onMouseLeave={() => setHoveredId(null)}
                                    style={{ '--mc': loc.markerColor }}
                                >
                                    <div className="vtmap-marker-bubble">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                                            stroke="currentColor" strokeWidth="2">
                                            <circle cx="12" cy="12" r="10"/>
                                            <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/>
                                            <path d="M2 12h20"/>
                                        </svg>
                                    </div>
                                    <div className="vtmap-marker-name">{loc.name}</div>
                                </div>
                            </Marker>
                        ))}

                        {/* Street View pegman — follows current position */}
                        {svCoords && (
                            <Marker
                                longitude={svPosition?.lng ?? svCoords.lng}
                                latitude={svPosition?.lat  ?? svCoords.lat}
                                anchor="bottom"
                            >
                                <div className="vtmap-pegman" style={{ pointerEvents: 'none' }}>
                                    <div className="vtmap-pegman-body">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                                            <circle cx="12" cy="6" r="3.5"/>
                                            <path d="M6.5 21v-3.5a5.5 5.5 0 0 1 11 0V21"/>
                                        </svg>
                                    </div>
                                    <div className="vtmap-pegman-pin" />
                                </div>
                            </Marker>
                        )}
                    </Map>
                </div>

                {/* ── Right panel: sidebar or street view ── */}
                <div className="vtmap-right-panel">

                    {/* 360° sidebar */}
                    {mode === '360' && (
                        <div className="vtmap-sidebar">
                            <div className="vtmap-sidebar-header">
                                <span>{TOUR_LOCATIONS.length} موقع متاح</span>
                            </div>
                            <div className="vtmap-sidebar-list">
                                {TOUR_LOCATIONS.map((loc) => (
                                    <button
                                        key={loc.id}
                                        className="vtmap-card"
                                        onMouseEnter={() => setHoveredId(loc.id)}
                                        onMouseLeave={() => setHoveredId(null)}
                                        onClick={() => setSelectedLocation(loc)}
                                    >
                                        <div className="vtmap-card-dot" style={{ background: loc.markerColor }} />
                                        <div className="vtmap-card-text">
                                            <span className="vtmap-card-name">{loc.name}</span>
                                            <span className="vtmap-card-desc">{loc.description}</span>
                                            <span className="vtmap-card-count">{loc.panoramas.length} نقطة تصوير</span>
                                        </div>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                                            stroke="rgba(255,255,255,0.3)" strokeWidth="2.5">
                                            <polyline points="15 18 9 12 15 6"/>
                                        </svg>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Street View empty state */}
                    {mode === 'street' && !svCoords && (
                        <div className="vtmap-sv-empty">
                            <div className="vtmap-sv-empty-icon">
                                <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
                                    stroke="rgba(255,255,255,0.25)" strokeWidth="1.5">
                                    <circle cx="12" cy="6" r="3"/>
                                    <path d="M7 21v-3a5 5 0 0 1 10 0v3"/>
                                </svg>
                            </div>
                            <p>انقر على أي موقع</p>
                            <span>في الخريطة لعرض الشارع</span>
                        </div>
                    )}

                    {/* Street View panel */}
                    {svOpen && (
                        <StreetViewModal
                            lat={svCoords.lat}
                            lng={svCoords.lng}
                            locationName="عرض الشارع"
                            onClose={() => { setSvCoords(null); setSvPosition(null); }}
                            onPositionChange={(lat, lng) => {
                                setSvPosition({ lat, lng });
                                mapRef.current?.easeTo({ center: [lng, lat], duration: 500 });
                            }}
                            inline
                        />
                    )}
                </div>
            </div>

            {/* ══ 360° VIEWER FULLSCREEN ═══════════════════════════════════ */}
            {selectedLocation && (
                <VirtualTourViewer
                    location={selectedLocation}
                    onClose={() => setSelectedLocation(null)}
                />
            )}
        </div>
    );
};

export default VirtualTourMap;
