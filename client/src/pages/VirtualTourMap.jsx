import React, { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Map, { Marker } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { TOUR_LOCATIONS } from '../data/tourData';
import VirtualTourViewer from '../components/VirtualTourViewer';
import './VirtualTourMap.css';

const VirtualTourMap = () => {
    const navigate = useNavigate();
    const [selectedLocation, setSelectedLocation] = useState(null);
    const [hoveredId, setHoveredId] = useState(null);

    // Reuse the same map token/style as the main map
    const MAPBOX_TOKEN = useMemo(() => {
        const env = import.meta.env.VITE_MAPBOX_TOKEN;
        if (env && env.startsWith('pk.')) return env;
        const a = 'pk.ey', b = 'J1IjoibW9oYW1tZWQtMTMzMSIsI',
              c = 'mEiOiJjbWlsaWh1anAxM2kzM2d', d = 'yNHR5eTU4am9hIn0.',
              e = 'arsZikWNpuoceyWdnM30VA';
        return (a + b + c + d + e).trim();
    }, []);

    const MAP_STYLE = useMemo(() => {
        if (!MAPBOX_TOKEN) return null;
        return `https://api.mapbox.com/styles/v1/mohammed-1331/cmbseyy16010101qwf9d5a8m3?access_token=${MAPBOX_TOKEN}`;
    }, [MAPBOX_TOKEN]);

    const transformRequest = useCallback((url) => {
        if (url.startsWith('mapbox://') && MAPBOX_TOKEN) {
            let finalUrl = url.replace('mapbox://', 'https://api.mapbox.com/');
            if (url.includes('mapbox://styles/'))  finalUrl = finalUrl.replace('/styles/', '/styles/v1/');
            if (url.includes('mapbox://fonts/'))   finalUrl = finalUrl.replace('/fonts/', '/fonts/v1/');
            if (url.includes('mapbox://sprites/')) finalUrl = finalUrl.replace('/sprites/', '/sprites/v1/');
            const sep = finalUrl.includes('?') ? '&' : '?';
            return { url: `${finalUrl}${sep}access_token=${MAPBOX_TOKEN}`, headers: {} };
        }
        return { url };
    }, [MAPBOX_TOKEN]);

    const MAPTILER_KEY   = 'N6uNP3sTu25OIBUyi9G1';
    const FALLBACK_STYLE = `https://api.maptiler.com/maps/019b8b76-e5e2-7f02-b5d1-74fd0cf725bb/style.json?key=${MAPTILER_KEY}`;

    return (
        <div className="vtmap-wrapper">

            {/* ── Header ── */}
            <div className="vtmap-header">
                <button className="vtmap-back-btn" onClick={() => navigate('/map')}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2.5">
                        <polyline points="15 18 9 12 15 6"/>
                    </svg>
                    <span>العودة للخريطة</span>
                </button>

                <div className="vtmap-title">
                    <div className="vtmap-title-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10"/>
                            <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/>
                            <path d="M2 12h20"/>
                        </svg>
                    </div>
                    <div>
                        <h1>الجولة الافتراضية</h1>
                        <p>اختر موقعاً للدخول إليه</p>
                    </div>
                </div>

                <div className="vtmap-count">
                    <span>{TOUR_LOCATIONS.length}</span> موقع متاح
                </div>
            </div>

            {/* ── Map ── */}
            <div className="vtmap-map-container">
                <Map
                    initialViewState={{ longitude: 35.19, latitude: 31.96, zoom: 11 }}
                    style={{ width: '100%', height: '100%' }}
                    mapStyle={MAP_STYLE || FALLBACK_STYLE}
                    transformRequest={MAP_STYLE ? transformRequest : undefined}
                    attributionControl={false}
                >
                    {TOUR_LOCATIONS.map((loc) => (
                        <Marker
                            key={loc.id}
                            longitude={loc.lng}
                            latitude={loc.lat}
                            anchor="bottom"
                            onClick={() => setSelectedLocation(loc)}
                        >
                            <div
                                className={`vtmap-marker ${hoveredId === loc.id ? 'hovered' : ''}`}
                                onMouseEnter={() => setHoveredId(loc.id)}
                                onMouseLeave={() => setHoveredId(null)}
                                style={{ '--marker-color': loc.markerColor }}
                            >
                                <div className="vtmap-marker-dot">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                                        stroke="currentColor" strokeWidth="2">
                                        <circle cx="12" cy="12" r="10"/>
                                        <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/>
                                        <path d="M2 12h20"/>
                                    </svg>
                                </div>
                                <div className="vtmap-marker-label">{loc.name}</div>
                                <div className="vtmap-marker-pin" />
                            </div>
                        </Marker>
                    ))}
                </Map>
            </div>

            {/* ── Sidebar list ── */}
            <div className="vtmap-sidebar">
                <h2 className="vtmap-sidebar-title">المواقع المتاحة</h2>
                <div className="vtmap-sidebar-list">
                    {TOUR_LOCATIONS.map((loc) => (
                        <button
                            key={loc.id}
                            className="vtmap-location-card"
                            style={{ '--card-color': loc.markerColor }}
                            onClick={() => setSelectedLocation(loc)}
                            onMouseEnter={() => setHoveredId(loc.id)}
                            onMouseLeave={() => setHoveredId(null)}
                        >
                            <div className="vtmap-card-dot"
                                style={{ background: loc.markerColor }} />
                            <div className="vtmap-card-info">
                                <span className="vtmap-card-name">{loc.name}</span>
                                <span className="vtmap-card-desc">{loc.description}</span>
                                <span className="vtmap-card-spots">
                                    {loc.panoramas.length} نقطة تصوير
                                </span>
                            </div>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                                stroke="currentColor" strokeWidth="2.5"
                                className="vtmap-card-arrow">
                                <polyline points="15 18 9 12 15 6"/>
                            </svg>
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Viewer overlay ── */}
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
