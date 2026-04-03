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
        longitude: 35.2,
        latitude: 31.9,
        zoom: 5.5, // Zoomed out to see sea deployments
        pitch: 40
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
                <div className="modal-header" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 25px)', paddingBottom: '1.2rem', background: '#111' }}>
                    <h2 style={{ fontSize: '1.2rem', color: '#fff' }}>خريطة الاخبار المباشرة</h2>
                    <button className="btn-close" onClick={onClose} title="إغلاق" style={{ marginTop: '5px' }}>
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

                            {/* Render Conflicts / Hot Zones (Cities/Red Circles) */}
                            {intel.conflicts?.map((zone, idx) => {
                                const size = window.innerWidth > 768 ? 16 : 12; // Radius approx mapping to div sizing
                                const color = zone.city.includes('إيران') ? '#ff6666' : zone.city.includes('غزة') || zone.city.includes('لبنان') ? '#ff3366' : '#999999';
                                
                                return (
                                    <Marker 
                                        key={`zone-${idx}`} 
                                        longitude={zone.lon} 
                                        latitude={zone.lat}
                                    >
                                        <div 
                                            className="city-flash-marker"
                                            style={{
                                                width: `${size}px`,
                                                height: `${size}px`,
                                                backgroundColor: color,
                                                borderRadius: '50%',
                                                opacity: 0.6,
                                                border: `1px solid ${color}`
                                            }}
                                        ></div>
                                        <div className="city-label">{zone.city}</div>
                                    </Marker>
                                );
                            })}

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

                            {/* Render Ships, Subs, Commercial */}
                            {ships.map((ship, idx) => {
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

                            {/* Render Flights with Orientation */}
                            {flights.filter(f => f.lat && f.lon).map((flight, idx) => {
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
                                                <h4 className="popup-title header-flight" style={{color: selectedFeature.data.type === 'طائرة مدنية' || !selectedFeature.data.type.includes('Fighter') ? '#ffffff' : '#00d2ff'}}>
                                                    {selectedFeature.data.type === 'طائرة مدنية' ? '✈️ طائرة مدنية' : '✈️ طائرة عسكرية'}
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
                        
                        <button className="close-layer-btn" onClick={() => setShowNewsPanel(false)}>
                            ← الغاء وعودة للخريطة
                        </button>

                        <div className="live-feed-panel">
                            <button 
                                className={`refresh-action-btn ${isRefreshing ? 'spinning' : ''}`}
                                onClick={handleManualRefresh}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 11-9-9c2.52 0 4.93 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /></svg>
                                تحديث آخر التطورات والأخبار
                            </button>

                            <div className="sidebar-title-container">
                                <h3 className="sidebar-title" style={{marginLeft: 0}}>قائمة الأخبار والصراعات</h3>
                            </div>
                            
                            {loading ? (
                                <div className="live-feed-loading">جاري المزامنة مع الرادار...</div>
                            ) : (
                                <div className="live-feed-list">

                                    {/* BREAKING ALERTS FIRST */}
                                    {alerts.map((alert, i) => (
                                        <div key={`alert-${i}`} className="feed-card alert-card breaking-card alert-flash">
                                            <div className="card-header">
                                                <span className="breaking-badge">صفارات إنذار 🚨</span>
                                                <span className="feed-time">{new Intl.DateTimeFormat('ar-EG', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true }).format(new Date(alert.time))}</span>
                                            </div>
                                            <h4 className="feed-threat">{alert.threat}</h4>
                                            <p className="feed-locations">📍 الموقع: {alert.locations?.join('، ')}</p>
                                        </div>
                                    ))}

                                    <div className="section-divider">الوضع الميداني والأسواق</div>

                                    {markets && (
                                        <div className="feed-card market-card">
                                            <div className="market-row" style={{color:'#f8d02e'}}>🥇 ذهب: <strong>${markets.goldOunce}</strong></div>
                                            <div className="market-row" style={{color:'#66bdf5'}}>🛢️ نفط الخام: <strong>${markets.crudeOil}</strong></div>
                                        </div>
                                    )}

                                    {/* TELEGRAM BREAKING NEWS */}
                                    {telegram.map((post, i) => (
                                        <div key={`tg-${i}`} className="feed-card telegram-card">
                                            <div className="telegram-header">
                                                <span className="telegram-source">{post.channel}</span>
                                                <span className="feed-time" style={{ fontSize: '0.85rem' }}>{new Intl.DateTimeFormat('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date(post.date))}</span>
                                            </div>
                                            <p>{post.text}</p>
                                        </div>
                                    ))}

                                    {intel.strikes?.map((strike, i) => (
                                        <div key={`strike-${i}`} className="feed-card strike-card">
                                            <span className="breaking-badge" style={{background: '#ff6b00'}}>ضربة صاروخية 🔥</span>
                                            <h4>{strike.target}</h4>
                                            <p>{strike.details}</p>
                                        </div>
                                    ))}

                                    {intel.conflicts?.map((zone, i) => (
                                        <div key={`conflict-${i}`} className="feed-card conflict-card highlight-hover">
                                            <div className="feed-info">
                                                <h4>{zone.city}</h4>
                                                <p>الحالة: {zone.status} | الحدّة: {zone.intensity}</p>
                                            </div>
                                        </div>
                                    ))}

                                    <div className="section-divider">التحركات العسكرية المباشرة</div>

                                    {/* NAVY SHIPS */}
                                    {ships.map((ship, i) => (
                                        <div key={`shipf-${i}`} className="feed-card ship-card highlight-hover" style={{ borderRightColor: getNavyColor(ship.navy) }}>
                                            <span className="feed-icon" style={{color: getNavyColor(ship.navy)}}>{ship.type === 'Submarine' ? '▼' : '⛴'}</span>
                                            <div className="feed-info">
                                                <h4>{ship.name} ({getTranslation(ship.navy)})</h4>
                                                <p>تتمركز حالياً في: {getTranslation(ship.region)}</p>
                                            </div>
                                        </div>
                                    ))}

                                    {/* FLIGHTS */}
                                    {flights.slice(0, 15).map((flight, i) => (
                                        <div key={`flight-${i}`} className="feed-card flight-card highlight-hover">
                                            <span className="feed-icon rotation-trans" style={{ transform: `rotate(${flight.heading - 45}deg)` }}>✈️</span>
                                            <div className="feed-info">
                                                <h4>رقم النداء: {flight.callsign || 'نقطة مجهولة'}</h4>
                                                <p>الارتفاع: {flight.altitude} قدم</p>
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

