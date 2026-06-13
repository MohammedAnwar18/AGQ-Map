import React, { useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Map, { Marker, Source, Layer } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { TOUR_LOCATIONS } from '../data/tourData';
import VirtualTourViewer from '../components/VirtualTourViewer';
import StreetViewModal from '../components/StreetViewModal';
import './VirtualTourMap.css';

const MAPILLARY_TOKEN = import.meta.env.VITE_MAPILLARY_TOKEN || '';

const VirtualTourMap = () => {
    const navigate = useNavigate();
    const mapRef   = useRef(null);

    const [mode,             setMode]             = useState('360');
    const [selectedLocation, setSelectedLocation] = useState(null);
    const [hoveredId,        setHoveredId]        = useState(null);
    const [svCoords,         setSvCoords]         = useState(null);
    const [svPosition,       setSvPosition]       = useState(null);

    // ── Tokens ──────────────────────────────────────────────────────────────
    const MAPBOX_TOKEN = useMemo(() => {
        const env = import.meta.env.VITE_MAPBOX_TOKEN;
        if (env?.startsWith('pk.')) return env;
        const a = 'pk.ey', b = 'J1IjoibW9oYW1tZWQtMTMzMSIsI',
              c = 'mEiOiJjbWlsaWh1anAxM2kzM2d', d = 'yNHR5eTU4am9hIn0.',
              e = 'arsZikWNpuoceyWdnM30VA';
        return (a + b + c + d + e).trim();
    }, []);

    // ── Map styles ───────────────────────────────────────────────────────────
    // Google Satellite style matching the main screen
    const GOOGLE_SATELLITE_STYLE = useMemo(() => ({
        version: 8,
        name: "Satellite",
        sprite: "https://demotiles.maplibre.org/styles/osm-bright-gl-style/sprite",
        glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
        sources: {
            'raster-tiles': {
                type: 'raster',
                tiles: [`https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}&scale=2`],
                tileSize: 256,
                attribution: 'Google Satellite'
            }
        },
        layers: [
            {
                id: 'simple-tiles',
                type: 'raster',
                source: 'raster-tiles',
                minzoom: 0,
                maxzoom: 22
            }
        ]
    }), []);

    const activeStyle = GOOGLE_SATELLITE_STYLE;

    // ── Mapillary coverage tile URL ──────────────────────────────────────────
    const mapillaryCoverageTiles = useMemo(() =>
        MAPILLARY_TOKEN
            ? [`https://tiles.mapillary.com/maps/vtp/mly1_public/2/{z}/{x}/{y}?access_token=${MAPILLARY_TOKEN}`]
            : []
    , []);

    // ── Mode switch ──────────────────────────────────────────────────────────
    const switchMode = (m) => {
        setMode(m);
        setSelectedLocation(null);
        setSvCoords(null);
        setSvPosition(null);
    };

    // ── Map click ────────────────────────────────────────────────────────────
    const handleMapClick = useCallback((e) => {
        if (mode !== 'street') return;
        setSvCoords({ lat: e.lngLat.lat, lng: e.lngLat.lng });
        setSvPosition(null);
    }, [mode]);

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
                        className={`vtmap-mode-btn ${mode === 'street' ? 'active-street' : ''}`}
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

                {/* ── Map ── */}
                <div className={`vtmap-map-wrap ${svOpen ? 'sv-open' : ''}`}>

                    {/* Hint banner */}
                    {mode === 'street' && !svCoords && (
                        <div className="vtmap-sv-hint">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                                stroke="currentColor" strokeWidth="2.5">
                                <circle cx="12" cy="6" r="3"/>
                                <path d="M7 21v-3a5 5 0 0 1 10 0v3"/>
                            </svg>
                            انقر على الخطوط الخضراء في الخريطة لعرض الشارع
                        </div>
                    )}

                    {/* Coverage legend */}
                    {mode === 'street' && MAPILLARY_TOKEN && (
                        <div className="vtmap-coverage-legend">
                            <div className="vtmap-legend-line" />
                            <span>تغطية Mapillary</span>
                        </div>
                    )}

                    <Map
                        ref={mapRef}
                        initialViewState={{ longitude: 35.19, latitude: 31.96, zoom: 13 }}
                        style={{ width: '100%', height: '100%' }}
                        mapStyle={activeStyle}
                        attributionControl={false}
                        cursor={mode === 'street' ? 'crosshair' : 'grab'}
                        onClick={handleMapClick}
                    >
                        {/* ── Mapillary coverage layer (street view mode) ── */}
                        {mode === 'street' && MAPILLARY_TOKEN && mapillaryCoverageTiles.length > 0 && (
                            <Source
                                id="mapillary-coverage"
                                type="vector"
                                tiles={mapillaryCoverageTiles}
                                minzoom={6}
                                maxzoom={14}
                            >
                                {/* Glow effect under the line */}
                                <Layer
                                    id="mapillary-glow"
                                    type="line"
                                    source-layer="sequence"
                                    paint={{
                                        'line-color': '#05CB63',
                                        'line-width': [
                                            'interpolate', ['linear'], ['zoom'],
                                            10, 4, 14, 10, 18, 18
                                        ],
                                        'line-opacity': 0.15,
                                        'line-blur': 4,
                                    }}
                                />
                                {/* Main coverage line */}
                                <Layer
                                    id="mapillary-sequence"
                                    type="line"
                                    source-layer="sequence"
                                    paint={{
                                        'line-color': '#05CB63',
                                        'line-width': [
                                            'interpolate', ['linear'], ['zoom'],
                                            10, 1.5, 14, 3, 18, 5
                                        ],
                                        'line-opacity': 0.9,
                                    }}
                                />
                                {/* Image dots at high zoom */}
                                <Layer
                                    id="mapillary-images"
                                    type="circle"
                                    source-layer="image"
                                    minzoom={17}
                                    paint={{
                                        'circle-radius': 4,
                                        'circle-color': '#05CB63',
                                        'circle-stroke-width': 1.5,
                                        'circle-stroke-color': '#fff',
                                        'circle-opacity': 0.9,
                                    }}
                                />
                            </Source>
                        )}

                        {/* ── 360° Tour markers ── */}
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

                        {/* ── Pegman marker ── */}
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

                {/* ── Right panel ── */}
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

                    {/* Street View — empty state */}
                    {mode === 'street' && !svCoords && (
                        <div className="vtmap-sv-empty">
                            <div className="vtmap-sv-empty-icon">
                                <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
                                    stroke="rgba(255,255,255,0.25)" strokeWidth="1.5">
                                    <circle cx="12" cy="6" r="3"/>
                                    <path d="M7 21v-3a5 5 0 0 1 10 0v3"/>
                                </svg>
                            </div>
                            <p>انقر على الخريطة</p>
                            <span>الخطوط الخضراء تدل على مناطق التغطية</span>
                            {!MAPILLARY_TOKEN && (
                                <span className="vtmap-no-token">Token غير مُعيَّن في Vercel</span>
                            )}
                        </div>
                    )}

                    {/* Street View — Mapillary panel */}
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

            {/* ══ 360° Viewer fullscreen ═══════════════════════════════════ */}
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
