import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Map, { Marker, Popup, NavigationControl, FullscreenControl, Source, Layer } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { newsService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import './NewsModal.css';

import maplibregl from 'maplibre-gl';

// Helper to get color by Navy
const getNavyColor = (navy) => {
    if (navy.includes('US')) return '#005b96';
    if (navy.includes('Iran')) return '#008000';
    if (navy.includes('Israel')) return '#0038b8';
    if (navy.includes('Royal')) return '#800020';
    if (navy.includes('Saudi')) return '#006400';
    return '#888';
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

    const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

    const fetchLiveData = useCallback(async () => {
        try {
            const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
            const [alertsRes, flightsRes, shipsRes] = await Promise.allSettled([
                fetch(`${baseUrl}/radar/alerts`),
                fetch(`${baseUrl}/radar/flights`),
                fetch(`${baseUrl}/radar/ships`)
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
        } catch (err) {
            console.error("Live feed error:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchLiveData();
        const intervalId = setInterval(fetchLiveData, 15000);
        return () => clearInterval(intervalId);
    }, [fetchLiveData]);

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

    return (
        <div className="news-modal-overlay">
            <div className="news-panel glass fade-in-up">
                
                <div className="news-header">
                    <div className="location-badge">
                        <span className="live-dot"></span>
                        LIVE IRONSIGHT RADAR
                    </div>
                    <h2>رادار العمليات والأخبار المباشر</h2>
                    <button onClick={onClose} className="close-btn">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="news-dashboard-content">
                    <div className="news-map-container">
                        <Map
                            {...viewState}
                            onMove={evt => setViewState(evt.viewState)}
                            mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
                            mapLib={maplibregl}
                            attributionControl={false}
                        >
                            <FullscreenControl position="top-right" />
                            <NavigationControl position="top-right" />

                            {/* Render Ships & Subs */}
                            {ships.map((ship, idx) => (
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
                                        className="combat-vessel" 
                                        style={{ 
                                            color: getNavyColor(ship.navy),
                                            fontSize: ship.type === 'Submarine' ? '18px' : '22px',
                                            textShadow: '0 0 5px rgba(255,255,255,0.5)'
                                        }}
                                        title={ship.name}
                                    >
                                        {ship.type === 'Submarine' ? '▼' : '⛴'}
                                    </div>
                                </Marker>
                            ))}

                            {/* Render Flights with Orientation */}
                            {flights.filter(f => f.lat && f.lon).map((flight, idx) => (
                                <Marker 
                                    key={flight.icao24 || idx} 
                                    longitude={flight.lon} 
                                    latitude={flight.lat}
                                    onClick={(e) => {
                                        e.originalEvent.stopPropagation();
                                        setSelectedFeature({ type: 'flight', data: flight });
                                        // Generate fake trail for visual effect based on heading
                                        setFlightTrail({
                                            type: 'FeatureCollection',
                                            features: [{
                                                type: 'Feature',
                                                geometry: {
                                                    type: 'LineString',
                                                    coordinates: [
                                                        [flight.lon - (Math.sin(flight.heading * Math.PI / 180) * 0.5), flight.lat - (Math.cos(flight.heading * Math.PI / 180) * 0.5)],
                                                        [flight.lon, flight.lat]
                                                    ]
                                                }
                                            }]
                                        });
                                    }}
                                >
                                    <div 
                                        className="military-flight" 
                                        style={{ 
                                            transform: `rotate(${flight.heading || 0}deg)`,
                                            color: flight.type.includes('Fighter') ? '#ff3b30' : '#fbab15'
                                        }}
                                    >
                                        ✈
                                    </div>
                                </Marker>
                            ))}

                            {/* Optional Flight Trail Layer */}
                            {flightTrail && (
                                <Source id="flight-trail-source" type="geojson" data={flightTrail}>
                                    <Layer 
                                        id="flight-trail-layer"
                                        type="line"
                                        paint={{
                                            'line-color': '#fbab15',
                                            'line-width': 2,
                                            'line-dasharray': [2, 2]
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
                                >
                                    <div className="feature-popup">
                                        {selectedFeature.type === 'flight' && (
                                            <>
                                                <h4>{selectedFeature.data.type || 'طائرة'}</h4>
                                                <p>Callsign: <strong>{selectedFeature.data.callsign}</strong></p>
                                                <p>Alt: {selectedFeature.data.altitude} ft</p>
                                                <p>Speed: {selectedFeature.data.speed} kts</p>
                                            </>
                                        )}
                                        {selectedFeature.type === 'ship' && (
                                            <>
                                                <h4 style={{ color: getNavyColor(selectedFeature.data.navy) }}>{selectedFeature.data.name}</h4>
                                                <p>Navy: <strong>{selectedFeature.data.navy}</strong></p>
                                                <p>Class: {selectedFeature.data.class}</p>
                                                <p>Status: {selectedFeature.data.status}</p>
                                            </>
                                        )}
                                    </div>
                                </Popup>
                            )}
                        </Map>
                    </div>

                    <div className="news-sidebar">
                        {isAdmin && (
                            <div className="admin-actions">
                                <button className="action-toggle-btn">إضافة تقرير استخباراتي ➕</button>
                            </div>
                        )}

                        <div className="live-feed-panel">
                            <h3 className="sidebar-title">موجز الأحداث (IRONSIGHT Feed)</h3>
                            
                            {loading ? (
                                <div className="live-feed-loading">جاري تحديث الرادار...</div>
                            ) : (
                                <div className="live-feed-list">
                                    {alerts.map((alert, i) => (
                                        <div key={`alert-${i}`} className="feed-card alert-card">
                                            <span className="feed-time">{new Date(alert.time).toLocaleTimeString()}</span>
                                            <h4 className="feed-threat">{alert.threat} 🚨</h4>
                                            <p className="feed-locations">{alert.locations?.join('، ')}</p>
                                        </div>
                                    ))}

                                    {ships.map((ship, i) => (
                                        <div key={`shipf-${i}`} className="feed-card ship-card" style={{ borderLeftColor: getNavyColor(ship.navy) }}>
                                            <span className="feed-icon">{ship.type === 'Submarine' ? '▼' : '⛴'}</span>
                                            <div className="feed-info">
                                                <h4>{ship.name} ({ship.navy})</h4>
                                                <p>متواجدة في: {ship.region}</p>
                                            </div>
                                        </div>
                                    ))}

                                    {flights.slice(0, 15).map((flight, i) => (
                                        <div key={`flight-${i}`} className="feed-card flight-card">
                                            <span className="feed-icon" style={{ transform: 'rotate(-45deg)', display: 'inline-block' }}>✈️</span>
                                            <div className="feed-info">
                                                <h4>{flight.callsign || 'غير مصرح'}</h4>
                                                <p>{flight.type}</p>
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

