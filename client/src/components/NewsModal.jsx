import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Map, { Marker, Popup, NavigationControl, FullscreenControl } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { newsService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import './NewsModal.css';

// We use the same maplibre instance
import maplibregl from 'maplibre-gl';

const NewsModal = ({ onClose, location }) => {
    const { user } = useAuth();
    
    // UI states
    const [loading, setLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [viewState, setViewState] = useState({
        longitude: location?.longitude || 35.0,
        latitude: location?.latitude || 31.5,
        zoom: 7,
        pitch: 45
    });

    // Form states
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [imageFile, setImageFile] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    
    // External APIs data states
    const [alerts, setAlerts] = useState([]);
    const [flights, setFlights] = useState([]);
    const [ships, setShips] = useState([]);
    const [selectedFeature, setSelectedFeature] = useState(null);

    const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

    // Fetch live data from Local Backend API
    const fetchLiveData = useCallback(async () => {
        try {
            const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
            const [alertsRes, flightsRes] = await Promise.allSettled([
                fetch(`${baseUrl}/radar/alerts`),
                fetch(`${baseUrl}/radar/flights`)
            ]);

            if (alertsRes.status === 'fulfilled' && alertsRes.value.ok) {
                const data = await alertsRes.value.json();
                setAlerts(data.alerts || []);
            }
            if (flightsRes.status === 'fulfilled' && flightsRes.value.ok) {
                const data = await flightsRes.value.json();
                setFlights(data.flights || []);
            }
        } catch (err) {
            console.error("Live feed error:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchLiveData();
        // Set an interval to refresh the live map every 10 seconds
        const intervalId = setInterval(fetchLiveData, 10000);
        return () => clearInterval(intervalId);
    }, [fetchLiveData]);

    const handleAddNews = async (e) => {
        e.preventDefault();
        if (!title || !description) return;
        try {
            setSubmitting(true);
            const formData = new FormData();
            formData.append('title', title);
            formData.append('description', description);
            formData.append('latitude', viewState.latitude);
            formData.append('longitude', viewState.longitude);
            if (imageFile) formData.append('image', imageFile);

            await newsService.createNews(formData);

            setTitle('');
            setDescription('');
            setImageFile(null);
            setShowAddForm(false);
            alert("تم إضافة الخبر بنجاح!");
        } catch (err) {
            console.error("Failed to add news", err);
            alert("حدث خطأ أثناء إضافة الخبر");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="news-modal-overlay">
            <div className="news-panel glass fade-in-up">
                
                {/* Header Section */}
                <div className="news-header">
                    <div className="location-badge">
                        <span className="live-dot"></span>
                        LIVE MAP
                    </div>
                    <h2>رادار الأخبار العاجلة</h2>
                    <button onClick={onClose} className="close-btn">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Main Content Area - Split Map & Sidebar */}
                <div className="news-dashboard-content">
                    
                    {/* Map Area */}
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

                            {/* Render Alerts */}
                            {alerts.map((alert, idx) => (
                                // Tzeva Adom doesn't always have exact coordinates, 
                                // so you might need a lookup table in the future. 
                                // Let's try displaying flights which have lat/lon clearly.
                                null
                            ))}

                            {/* Render Flights */}
                            {flights.filter(f => f.lat && f.lon).map((flight, idx) => (
                                <Marker 
                                    key={flight.icao24 || idx} 
                                    longitude={flight.lon} 
                                    latitude={flight.lat}
                                    onClick={(e) => {
                                        e.originalEvent.stopPropagation();
                                        setSelectedFeature({ type: 'flight', data: flight });
                                    }}
                                >
                                    <div className="flight-marker" style={{ transform: `rotate(${flight.heading || 0}deg)` }}>
                                        ✈️
                                    </div>
                                </Marker>
                            ))}

                            {/* Popup for Selected Feature */}
                            {selectedFeature && selectedFeature.type === 'flight' && (
                                <Popup
                                    longitude={selectedFeature.data.lon}
                                    latitude={selectedFeature.data.lat}
                                    anchor="bottom"
                                    onClose={() => setSelectedFeature(null)}
                                    closeOnClick={false}
                                >
                                    <div className="feature-popup">
                                        <h4>{selectedFeature.data.type || 'طائرة'}</h4>
                                        <p>Callsign: {selectedFeature.data.callsign}</p>
                                        <p>Alt: {selectedFeature.data.altitude} ft</p>
                                        <p>Speed: {selectedFeature.data.speed} kts</p>
                                    </div>
                                </Popup>
                            )}
                        </Map>
                    </div>

                    {/* Sidebar / Admin Area */}
                    <div className="news-sidebar">
                        {isAdmin && (
                            <div className="admin-actions">
                                <button
                                    className={`action-toggle-btn ${showAddForm ? 'active' : ''}`}
                                    onClick={() => setShowAddForm(!showAddForm)}
                                >
                                    {showAddForm ? 'إلغاء الإضافة ✖' : 'إضافة خبر جديد ➕'}
                                </button>
                            </div>
                        )}

                        {showAddForm ? (
                            <div className="news-form-container">
                                <h3 className="sidebar-title">أضف خبراً في الموقع الحالي</h3>
                                <form onSubmit={handleAddNews} className="add-news-form">
                                    <div className="form-group">
                                        <label>العنوان:</label>
                                        <input
                                            type="text"
                                            value={title}
                                            onChange={e => setTitle(e.target.value)}
                                            required
                                            placeholder="عنوان الخبر..."
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>التفاصيل:</label>
                                        <textarea
                                            value={description}
                                            onChange={e => setDescription(e.target.value)}
                                            required
                                            rows="4"
                                            placeholder="تفاصيل الخبر الهامة..."
                                        ></textarea>
                                    </div>
                                    <div className="form-group">
                                        <label>صورة (اختياري):</label>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={e => setImageFile(e.target.files[0])}
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="submit-news-btn"
                                    >
                                        {submitting ? 'جاري الإضافة...' : 'نشر الخبر في الخريطة'}
                                    </button>
                                </form>
                            </div>
                        ) : (
                            <div className="live-feed-panel">
                                <h3 className="sidebar-title">الأحداث المباشرة</h3>
                                
                                {loading ? (
                                    <div className="live-feed-loading">جاري تحديث الرادار...</div>
                                ) : (
                                    <div className="live-feed-list">
                                        {alerts.map((alert, i) => (
                                            <div key={i} className="feed-card alert-card">
                                                <span className="feed-time">{new Date(alert.time).toLocaleTimeString()}</span>
                                                <h4 className="feed-threat">{alert.threat}</h4>
                                                <p className="feed-locations">{alert.locations?.join('، ')}</p>
                                            </div>
                                        ))}

                                        {flights.slice(0, 10).map((flight, i) => (
                                            <div key={i} className="feed-card flight-card">
                                                <span className="feed-icon">✈️</span>
                                                <div className="feed-info">
                                                    <h4>{flight.callsign || 'مجهول'}</h4>
                                                    <p>{flight.type}</p>
                                                </div>
                                            </div>
                                        ))}

                                        {alerts.length === 0 && flights.length === 0 && (
                                            <p className="empty-state">لا يوجد أحداث عاجلة حالية.</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NewsModal;

