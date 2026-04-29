import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Map, { Marker, Popup, NavigationControl, FullscreenControl, Source, Layer } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { newsService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import './Modal.css';
import './NewsModal.css';

import maplibregl from 'maplibre-gl';

// Fix disconnected Arabic text on MapLibre tiles
if (maplibregl.getRTLTextPluginStatus && maplibregl.getRTLTextPluginStatus() === 'unavailable') {
    maplibregl.setRTLTextPlugin(
        'https://unpkg.com/@mapbox/mapbox-gl-rtl-text@0.2.3/mapbox-gl-rtl-text.min.js',
        null,
        true // Lazy load the plugin
    );
}

// Helper to get color by Navy
const getNavyColor = (navy) => {
    if (navy.includes('US')) return '#007fff';      // Bright Blue
    if (navy.includes('Iran')) return '#00ff00';    // Neon Green
    if (navy.includes('Israel')) return '#00d2ff';  // Cyan
    if (navy.includes('Royal')) return '#ff3333';   // Bright Red
    if (navy.includes('Saudi')) return '#32cd32';   // Lime Green
    return '#aaaaaa';
};

const getTranslation = (word) => {
    const map = {
        'Aircraft Carrier': 'حاملة طائرات',
        'Destroyer': 'مدمرة حربية',
        'Cruiser': 'طراد صواريخ',
        'Submarine': 'غواصة نووية/هجومية',
        'Frigate': 'فرقاطة',
        'Corvette': 'سفينة حربية (كورفيت)',
        'Active': 'نشطة / في الخدمة',
        'Deployed': 'منتشرة حالياً',
        'Patrol': 'دورية بحرية',
        'US Navy': 'البحرية الأمريكية',
        'Iran Navy': 'القوة البحرية الإيرانية',
        'Israeli Navy': 'البحرية الإسرائيلية',
        'Royal Navy': 'البحرية الملكية (بريطانيا)',
        'Saudi Navy': 'البحرية السعودية',
    };
    return map[word] || word;
};

const NewsModal = ({ onClose, location }) => {
    const { user } = useAuth();
    
    // UI states
    const [loading, setLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [viewState, setViewState] = useState({
        longitude: 35.1,
        latitude: 31.9,
        zoom: 8.5, // Focused on West Bank and Gaza
        pitch: 0
    });

    const [selectedFeature, setSelectedFeature] = useState(null);
    const [flightTrail, setFlightTrail] = useState(null);

    // Data states
    const [alerts, setAlerts] = useState([]);
    const [flights, setFlights] = useState([]);
    const [ships, setShips] = useState([]);
    const [intel, setIntel] = useState({ conflicts: [], strikes: [], incidents: [] });
    const [markets, setMarkets] = useState(null);
    const [telegram, setTelegram] = useState([]);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [showNewsPanel, setShowNewsPanel] = useState(false);

    const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

    const fetchLiveData = useCallback(async () => {
        try {
            const baseUrl = import.meta.env.VITE_API_URL || '/api';
            const [alertsRes, flightsRes, shipsRes, intelRes, marketsRes, telegramRes] = await Promise.allSettled([
                fetch(`${baseUrl}/radar/alerts`),
                fetch(`${baseUrl}/radar/flights`),
                fetch(`${baseUrl}/radar/ships`),
                fetch(`${baseUrl}/radar/intel`),
                fetch(`${baseUrl}/radar/markets`),
                fetch(`${baseUrl}/radar/telegram`)
            ]);

            if (alertsRes.status === 'fulfilled' && alertsRes.value.ok) {
                const data = await alertsRes.value.json();
                setAlerts(data.alerts || []);
            }
            if (flightsRes.status === 'fulfilled' && flightsRes.value.ok) {
                const data = await flightsRes.value.json();
                setFlights(data.flights || []);
            }
            if (shipsRes.status === 'fulfilled' && shipsRes.value.ok) {
                const data = await shipsRes.value.json();
                setShips(data.ships || []);
            }
            if (intelRes.status === 'fulfilled' && intelRes.value.ok) {
                const intelData = await intelRes.value.json();
                setIntel({
                    conflicts: intelData.conflicts || [],
                    strikes: intelData.strikes || [],
                    incidents: intelData.incidents || []
                });
            }
            if (marketsRes.status === 'fulfilled' && marketsRes.value.ok) {
                const data = await marketsRes.value.json();
                setMarkets(data);
            }
            if (telegramRes.status === 'fulfilled' && telegramRes.value.ok) {
                const data = await telegramRes.value.json();
                setTelegram(data.posts || []);
            }
        } catch (err) {
            console.error("Live feed error:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchLiveData();
        const intervalId = setInterval(fetchLiveData, 8000); // 8 seconds for smoother real-time feel
        return () => clearInterval(intervalId);
    }, [fetchLiveData]);

    const handleMapLoad = useCallback((e) => {
        const map = e.target;
        const style = map.getStyle();
        
        if (style && style.layers) {
            style.layers.forEach((layer) => {
                if (layer.type === 'symbol' && layer.layout && layer.layout['text-field']) {
                    map.setLayoutProperty(layer.id, 'text-field', [
                        'coalesce',
                        ['get', 'name:ar'],
                        ['get', 'name:nonlatin'],
                        ['get', 'name']
                    ]);
                }
            });
        }
    }, []);

    // Draw lines for missile arcs based on standard source vectors
    const missileArcs = useMemo(() => {
        const features = [];
        alerts.forEach((alert, i) => {
            // Fake coordinate generator for alerts if real ones absent based on city match
            // In a real scenario, this comes from geocoding.
            // Let's just generate a red pulse center for demo if we had coordinates
        });
        return {
            type: 'FeatureCollection',
            features
        };
    }, [alerts]);

    const handleManualRefresh = async () => {
        setIsRefreshing(true);
        await fetchLiveData();
        setTimeout(() => setIsRefreshing(false), 800); // Visual delay for spinner
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-container" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header" style={{ background: '#111' }}>
                    <h2 style={{ fontSize: '1.2rem', color: '#fff' }}>خريطة الاخبار المباشرة</h2>
                    <button className="btn-close" onClick={onClose} title="إغلاق">
                        ✕
                    </button>
                </div>

                <div className="modal-body news-dashboard-content" style={{ padding: 0, height: '100%', position: 'relative' }}>
                    <div className="news-map-container">
                        <Map
                            {...viewState}
                            onMove={evt => setViewState(evt.viewState)}
                            mapStyle="https://api.maptiler.com/maps/dataviz-dark/style.json?key=N6uNP3sTu25OIBUyi9G1"
                            mapLib={maplibregl}
                            attributionControl={false}
                            onLoad={handleMapLoad}
                        >
                            <FullscreenControl position="top-right" />
                            <NavigationControl position="top-right" />

                            {/* Conflicts section removed per user request */}

                            {/* Render Incidents */}
                            {intel.incidents?.map((inc, idx) => (
                                <Marker 
                                    key={`inc-${idx}`} 
                                    longitude={inc.lon} 
                                    latitude={inc.lat}
                                    onClick={(e) => {
                                        e.originalEvent.stopPropagation();
                                        setSelectedFeature({ type: 'incident', data: inc });
                                    }}
                                >
                                    <div className="incident-pin-marker" title={inc.text}>📍</div>
                                </Marker>
                            ))}

                            {/* Render Ships & Subs - Filtered for local area */}
                            {ships.filter(ship => ship.lon > 34 && ship.lon < 36 && ship.lat > 29 && ship.lat < 33.5).map((ship, idx) => {
                                const isCommercial = ship.navy === 'Commercial';
                                const color = isCommercial ? '#4fc3f7' : (getNavyColor(ship.navy) || '#888888');
                                const isSub = ship.type.toLowerCase().includes('submarine');
                                
                                return (
                                    <Marker 
                                        key={`ship-${idx}`} 
                                        longitude={ship.lon} 
                                        latitude={ship.lat}
                                        onClick={(e) => {
                                            e.originalEvent.stopPropagation();
                                            setSelectedFeature({ type: 'ship', data: ship });
                                        }}
                                    >
                                        <div 
                                            className="naval-marker" 
                                            style={{ 
                                                fontSize: isCommercial ? '20px' : (isSub ? '18px' : '15px'), 
                                                color: color, 
                                                filter: `drop-shadow(0 0 3px ${color})`,
                                                lineHeight: 1,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}
                                            title={ship.name}
                                        >
                                            {isCommercial ? '🚢' : (isSub ? '▼' : (
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                                    <path d="M2.2 16c1 .4 2.5.4 3.5 0 1.2-.5 2.5-.5 3.6 0 1 .4 2.6.4 3.6 0 1.1-.5 2.3-.5 3.5 0 1 .4 2.5.4 3.5 0 1.2-.5 2.5-.5 3.6 0v2c-1.1.5-2.6.5-3.6 0-1-.4-2.5-.4-3.5 0-1.2.5-2.5.5-3.6 0-1-.4-2.6-.4-3.6 0-1.1.5-2.3.5-3.5 0-1-.4-2.5-.4-3.5 0-1.2.5-2.5.5-3.6 0v-2c1.1.5 2.5.5 3.6 0zM12 4L4 14h16L12 4z" />
                                                </svg>
                                            ))}
                                        </div>
                                    </Marker>
                                );
                            })}

                            {/* Render Flights - Filtered for local area */}
                            {flights.filter(f => f.lat && f.lon && f.lon > 34 && f.lon < 36 && f.lat > 29 && f.lat < 33.5).map((flight, idx) => {
                                const isCiv = flight.type === 'طائرة مدنية' || !flight.type.includes('Fighter');
                                const color = isCiv ? '#ffffff' : (flight.type.includes('Fighter') ? '#ff3b30' : '#fbab15');
                                
                                return (
                                    <Marker 
                                        key={flight.icao24 || idx} 
                                        longitude={flight.lon} 
                                        latitude={flight.lat}
                                        onClick={(e) => {
                                            e.originalEvent.stopPropagation();
                                            setSelectedFeature({ type: 'flight', data: flight });
                                        }}
                                    >
                                        <div 
                                            className="mil-aircraft-marker" 
                                            style={{ 
                                                fontSize: '14px', 
                                                transform: `rotate(${flight.heading || 0}deg)`,
                                                color: color,
                                                lineHeight: 1,
                                            }}
                                        >
                                            ✈
                                        </div>
                                    </Marker>
                                );
                            })}

                            {/* Optional Flight Trail Layer */}
                            {flightTrail && (
                                <Source type="geojson" data={flightTrail}>
                                    <Layer 
                                        id="flight-path" 
                                        type="line" 
                                        paint={{
                                            'line-color': '#00d2ff',
                                            'line-width': 2,
                                            'line-dasharray': [2, 4]
                                        }} 
                                    />
                                </Source>
                            )}
                            {/* Selection Popups */}
                            {selectedFeature && (
                                <Popup
                                    longitude={selectedFeature.data.lon}
                                    latitude={selectedFeature.data.lat}
                                    anchor="bottom"
                                    onClose={() => setSelectedFeature(null)}
                                    closeOnClick={false}
                                    className="military-popup"
                                >
                                    <div className="feature-popup" dir="rtl">
                                        <button className="popup-close-btn" onClick={(e) => { e.stopPropagation(); setSelectedFeature(null); }}>×</button>
                                        
                                        {selectedFeature.type === 'flight' && (
                                            <>
                                                <h4 className="popup-title header-flight" style={{color: '#ffffff'}}>
                                                    ✈️ طائرة مدنية
                                                </h4>
                                                <div className="popup-details">
                                                    <p><span>رمز النداء:</span> <strong>{selectedFeature.data.callsign}</strong></p>
                                                    <p><span>النوع:</span> {selectedFeature.data.type}</p>
                                                    <p><span>الارتفاع:</span> {selectedFeature.data.altitude} قدم</p>
                                                    <p><span>السرعة:</span> {selectedFeature.data.speed} عقدة</p>
                                                </div>
                                            </>
                                        )}
                                        {selectedFeature.type === 'ship' && (
                                            <>
                                                <h4 className="popup-title header-navy" style={{ color: selectedFeature.data.navy === 'Commercial' ? '#4fc3f7' : getNavyColor(selectedFeature.data.navy), paddingRight: '20px' }}>
                                                    {selectedFeature.data.navy === 'Commercial' ? '🚢' : (selectedFeature.data.type === 'Submarine' ? '▼' : '⛴')} {selectedFeature.data.name}
                                                </h4>
                                                <div className="popup-details">
                                                    <p><span>الجهة/التبعية:</span> <strong>{getTranslation(selectedFeature.data.navy)}</strong></p>
                                                    <p><span>النوع والتصنيف:</span> {getTranslation(selectedFeature.data.class)}</p>
                                                    <p><span>الحالة العملياتية:</span> {getTranslation(selectedFeature.data.status)}</p>
                                                </div>
                                            </>
                                        )}
                                        {selectedFeature.type === 'incident' && (
                                            <div className="premium-incident-popup">
                                                <h4 className="popup-title header-incident">
                                                   <span className="pulse-icon">🔴</span> خبر عاجل مباشر
                                                </h4>
                                                <div className="incident-meta-details">
                                                    <div className="meta-row">
                                                        <span className="meta-label">📅 التاريخ:</span> 
                                                        <strong className="meta-value">{new Intl.DateTimeFormat('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(selectedFeature.data.time || Date.now()))}</strong>
                                                    </div>
                                                    <div className="meta-row">
                                                        <span className="meta-label">⏰ الوقت:</span> 
                                                        <strong className="meta-value">{new Intl.DateTimeFormat('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date(selectedFeature.data.time || Date.now()))}</strong>
                                                    </div>
                                                    <div className="meta-row">
                                                        <span className="meta-label">📍 الموقع:</span> 
                                                        <strong className="meta-value loc-highlight">{selectedFeature.data.city}</strong>
                                                    </div>
                                                    <div className="meta-row">
                                                        <span className="meta-label">⚠️ الحدث:</span> 
                                                        <strong className="meta-value">{selectedFeature.data.type}</strong>
                                                    </div>
                                                </div>
                                                <div className="incident-description">
                                                    {selectedFeature.data.text}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </Popup>
                            )}
                        </Map>
                        
                        {/* Map Overlay Button to Open News Page */}
                        {!showNewsPanel && (
                            <button className="toggle-news-btn" onClick={() => setShowNewsPanel(true)}>
                                تصفح قائمة الأخبار والصراعات
                            </button>
                        )}
                    </div>

                    <div className={`news-sidebar ${showNewsPanel ? 'open' : ''}`}>
                        
                        <div className="sidebar-action-header">
                            <button 
                                className="sidebar-btn back-btn" 
                                onClick={() => setShowNewsPanel(false)} 
                                title="إغلاق والعودة للخريطة"
                                style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
                            >
                                <span style={{ fontSize: '20px', color: '#fff', fontWeight: 'bold' }}>→</span>
                            </button>

                            <h3 className="sidebar-title-minimal">قائمة الأخبار والصراعات</h3>

                            <button 
                                className={`sidebar-btn refresh-btn ${isRefreshing ? 'spinning' : ''}`}
                                onClick={handleManualRefresh}
                                title="تحديث البيانات"
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 11-9-9c2.52 0 4.93 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /></svg>
                            </button>
                        </div>

                        <div className="live-feed-panel">
                            
                            {loading ? (
                                <div className="live-feed-loading">جاري المزامنة مع الرادار...</div>
                            ) : (
                                <div className="live-feed-list">

                                    {/* ---- BREAKING ALERTS ---- */}
                                    {alerts.length > 0 && (
                                        <div className="feed-section-label">🚨 تنبيهات عاجلة</div>
                                    )}
                                    {alerts.map((alert, i) => (
                                        <div key={`alert-${i}`} className="feed-card alert-card breaking-card">
                                            <div className="card-header">
                                                <span className="breaking-badge">صفارات إنذار 🚨</span>
                                                <span className="feed-time">
                                                    {new Intl.DateTimeFormat('ar-EG', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true }).format(new Date(alert.time))}
                                                </span>
                                            </div>
                                            <h4 className="feed-threat">{alert.threat}</h4>
                                            <p className="feed-locations">📍 {alert.locations?.join(' · ')}</p>
                                        </div>
                                    ))}

                                    {/* ---- MARKETS ---- */}
                                    {markets && (
                                        <>
                                            <div className="feed-section-label">📊 الأسواق المالية</div>
                                            <div className="feed-card market-card">
                                                <div className="market-row" style={{ color: '#f8d02e' }}>
                                                    <span>🥇 أونصة الذهب</span>
                                                    <strong>${markets.goldOunce}</strong>
                                                </div>
                                                <div className="market-row" style={{ color: '#66bdf5' }}>
                                                    <span>🛢️ برميل النفط</span>
                                                    <strong>${markets.crudeOil}</strong>
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {/* ---- TELEGRAM BREAKING NEWS ---- */}
                                    {telegram.length > 0 && (
                                        <div className="feed-section-label">📡 أخبار عاجلة مباشرة</div>
                                    )}
                                    {telegram.map((post, i) => (
                                        <div key={`tg-${i}`} className="feed-card telegram-card">
                                            <div className="telegram-header">
                                                <span className="telegram-source">📢 {post.channel}</span>
                                                <span className="feed-time">
                                                    {new Intl.DateTimeFormat('ar-EG', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date(post.date))}
                                                </span>
                                            </div>
                                            <p>{post.text}</p>
                                        </div>
                                    ))}

                                    {/* ---- STRIKES ---- */}
                                    {intel.strikes?.length > 0 && (
                                        <div className="feed-section-label">🔥 ضربات وعمليات</div>
                                    )}
                                    {intel.strikes?.map((strike, i) => (
                                        <div key={`strike-${i}`} className="feed-card strike-card">
                                            <span className="breaking-badge" style={{ background: '#ff6b00', width: 'fit-content' }}>ضربة صاروخية 🔥</span>
                                            <h4>{strike.target}</h4>
                                            <p>{strike.details}</p>
                                        </div>
                                    ))}

                                    {/* Conflict zones section removed per user request */}

                                    {/* ---- NAVY SHIPS ---- */}
                                    {ships.length > 0 && (
                                        <div className="feed-section-label">⛴ التحركات البحرية</div>
                                    )}
                                    {ships.map((ship, i) => (
                                        <div key={`shipf-${i}`} className="feed-card ship-card" style={{ borderColor: `${getNavyColor(ship.navy)}33` }}>
                                            <span className="feed-icon" style={{ color: getNavyColor(ship.navy) }}>
                                                {ship.type === 'Submarine' ? '▼' : '⛴'}
                                            </span>
                                            <div className="feed-info">
                                                <h4>{ship.name}</h4>
                                                <p>{getTranslation(ship.navy)} · {getTranslation(ship.region)}</p>
                                            </div>
                                        </div>
                                    ))}

                                    {/* ---- FLIGHTS ---- */}
                                    {flights.length > 0 && (
                                        <div className="feed-section-label">✈️ الحركة الجوية</div>
                                    )}
                                    {flights.slice(0, 30).map((flight, i) => (
                                        <div key={`flight-${i}`} className="feed-card flight-card">
                                            <span className="feed-icon" style={{ transform: `rotate(${flight.heading - 45}deg)`, display: 'inline-block' }}>✈️</span>
                                            <div className="feed-info">
                                                <h4>{flight.callsign || 'طائرة مدنية'}</h4>
                                                <p>الارتفاع: {flight.altitude?.toLocaleString()} قدم · {flight.speed} عقدة</p>
                                            </div>
                                        </div>
                                    ))}

                                </div>

                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NewsModal;

