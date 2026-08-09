import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react';
import axios from 'axios';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './GeoportalViewer.css';

export default function GeoportalViewer() {
    const { slug } = useParams();
    const [portal, setPortal] = useState(null);
    const [layers, setLayers] = useState([]);
    const [visibleLayerIds, setVisibleLayerIds] = useState(new Set());
    const [loading, setLoading] = useState(true);

    // Auth modal state
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [loginCreds, setLoginCreds] = useState({ username: '', password: '' });
    const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('token'));

    // Tools state
    const [activeTool, setActiveTool] = useState(null); // 'measure' | 'identify' | null
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedFeatureProps, setSelectedFeatureProps] = useState(null);

    // Map refs
    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const featureGroupsRef = useRef({});

    // 1. Resolve & Fetch Portal Data
    useEffect(() => {
        loadPortalData();
    }, [slug]);

    const loadPortalData = async () => {
        try {
            setLoading(true);
            const url = slug
                ? `/api/geoportals/public/resolve?slug=${slug}`
                : `/api/geoportals/public/resolve`;

            const res = await axios.get(url);
            const data = res.data;
            setPortal(data);
            setLayers(data.layers || []);

            const initialVisible = new Set();
            (data.layers || []).forEach(l => {
                if (l.is_visible_by_default) initialVisible.add(l.id);
            });
            setVisibleLayerIds(initialVisible);
        } catch (err) {
            console.error('Error resolving portal:', err);
        } finally {
            setLoading(false);
        }
    };

    // 2. Initialize Leaflet Map Canvas
    useEffect(() => {
        if (!mapRef.current || !portal) return;

        if (!mapInstance.current) {
            const center = portal.map_config?.center || [31.9038, 35.2034];
            const zoom = portal.map_config?.zoom || 13;

            mapInstance.current = L.map(mapRef.current, {
                center,
                zoom,
                zoomControl: false
            });

            // Add Satellite tile layer
            L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                attribution: 'Esri Satellite'
            }).addTo(mapInstance.current);

            L.control.zoom({ position: 'topleft' }).addTo(mapInstance.current);
        }

        // Load features for active visible layers
        renderVisibleLayers();

    }, [portal, visibleLayerIds, isLoggedIn]);

    const renderVisibleLayers = async () => {
        if (!mapInstance.current || !layers) return;

        // Clear existing layer feature groups
        Object.values(featureGroupsRef.current).forEach(group => {
            mapInstance.current.removeLayer(group);
        });
        featureGroupsRef.current = {};

        const token = localStorage.getItem('token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        for (const layer of layers) {
            if (!visibleLayerIds.has(layer.id)) continue;

            try {
                const res = await axios.get(`/api/geoportals/public/layers/${layer.id}/features`, { headers });
                const geojson = res.data;

                if (geojson && geojson.features && geojson.features.length > 0) {
                    const style = layer.style_config || {};
                    const group = L.geoJSON(geojson, {
                        style: () => ({
                            color: style.stroke_color || '#1D4ED8',
                            weight: style.stroke_width || 2,
                            fillColor: style.fill_color || '#3B82F6',
                            fillOpacity: style.fill_opacity || 0.45
                        }),
                        pointToLayer: (feature, latlng) => {
                            return L.circleMarker(latlng, {
                                radius: style.point_radius || 7,
                                fillColor: style.fill_color || '#F5A623',
                                color: style.stroke_color || '#D88B0E',
                                weight: 2,
                                opacity: 1,
                                fillOpacity: 0.9
                            });
                        },
                        onEachFeature: (feature, leafletLayer) => {
                            leafletLayer.on('click', () => {
                                setSelectedFeatureProps(feature.properties);
                            });
                        }
                    });

                    featureGroupsRef.current[layer.id] = group;
                    group.addTo(mapInstance.current);
                }
            } catch (err) {
                console.warn(`Layer ${layer.layer_name} access restricted or failed:`, err.response?.data?.error);
            }
        }
    };

    const toggleLayerVisibility = (layerId) => {
        setVisibleLayerIds(prev => {
            const updated = new Set(prev);
            if (updated.has(layerId)) {
                updated.delete(layerId);
            } else {
                updated.add(layerId);
            }
            return updated;
        });
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            const res = await axios.post('/api/auth/login', loginCreds);
            localStorage.setItem('token', res.data.token);
            setIsLoggedIn(true);
            setShowAuthModal(false);
            alert('✅ تم تسجيل الدخول بنجاح وتفعيل الطبقات المحمية');
            renderVisibleLayers();
        } catch (err) {
            alert('اسم المستخدم أو كلمة المرور غير صحيحة');
        }
    };

    if (loading) {
        return (
            <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#050B16', color: '#F5A623', fontFamily: 'Tajawal, sans-serif' }}>
                <h2>🚀 جاري تحميل البوابة الجغرافية المكانية...</h2>
            </div>
        );
    }

    if (!portal) {
        return (
            <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#050B16', color: '#EF4444', fontFamily: 'Tajawal, sans-serif' }}>
                <h2>❌ البوابة الجغرافية المطلوبة غير موجودة</h2>
            </div>
        );
    }

    return (
        <div className="geoportal-viewer">
            {/* Top Navigation Bar */}
            <div className="geoportal-navbar">
                <div className="brand-section">
                    {portal.logo_url ? (
                        <img src={portal.logo_url} alt="Logo" className="brand-logo" />
                    ) : (
                        <div style={{ fontSize: '1.4rem' }}>🏛️</div>
                    )}
                    <div className="brand-title-group">
                        <h1>{portal.title_ar}</h1>
                        <p>{portal.title_en || 'Geoportal Information System'}</p>
                    </div>
                </div>

                <div className="navbar-center-search">
                    <input
                        type="text"
                        className="navbar-search-input"
                        placeholder="البحث في القطع والطبقات (Search Plots)..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="navbar-actions">
                    {(portal.header_links || []).map((link, idx) => (
                        <a key={idx} href={link.url} className="nav-action-btn" target="_blank" rel="noreferrer">
                            {link.title}
                        </a>
                    ))}

                    {isLoggedIn ? (
                        <button className="nav-action-btn primary" onClick={() => {
                            localStorage.removeItem('token');
                            setIsLoggedIn(false);
                        }}>
                            تسجيل الخروج 🚪
                        </button>
                    ) : (
                        <button className="nav-action-btn primary" onClick={() => setShowAuthModal(true)}>
                            تسجيل الدخول 🔑
                        </button>
                    )}
                </div>
            </div>

            {/* Floating Layer Control Panel (Matching Dubai DDA DIS layout) */}
            <div className="floating-layers-card">
                <div className="card-header">
                    <span>MAIN MAP / الطبقات الجغرافية</span>
                    <span style={{ fontSize: '0.75rem', color: '#FFFFFF', background: 'rgba(255, 255, 255, 0.1)', padding: '2px 8px', borderRadius: 10 }}>
                        {layers.length} طبقات
                    </span>
                </div>
                <div className="card-body">
                    {layers.map(layer => {
                        const style = layer.style_config || {};
                        const isVisible = visibleLayerIds.has(layer.id);
                        return (
                            <div key={layer.id} className="layer-legend-row">
                                <div className="layer-legend-info">
                                    <input
                                        type="checkbox"
                                        checked={isVisible}
                                        onChange={() => toggleLayerVisibility(layer.id)}
                                    />
                                    <span
                                        className="legend-swatch"
                                        style={{ backgroundColor: style.fill_color || '#3B82F6', borderColor: style.stroke_color || '#1D4ED8' }}
                                    ></span>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                                        {layer.layer_name}
                                    </span>
                                </div>

                                {layer.is_private && <span style={{ fontSize: '0.7rem' }}>🔒</span>}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Floating Tools Bar */}
            <div className="floating-tools-bar">
                <button className="tool-button" title="استعلام القطع والمعالم" onClick={() => setActiveTool(activeTool === 'identify' ? null : 'identify')}>
                    🔍
                </button>
                <button className="tool-button" title="قياس المسافات والمساحات" onClick={() => alert('أداة القياس المكانية التفاعلية موجهة على الخريطة')}>
                    📏
                </button>
                <button className="tool-button" title="طباعة الخريطة" onClick={() => window.print()}>
                    🖨️
                </button>
            </div>

            {/* Feature Property Drawer Popup */}
            {selectedFeatureProps && (
                <div style={{
                    position: 'absolute',
                    bottom: 24,
                    right: 24,
                    zIndex: 1000,
                    width: 320,
                    background: 'rgba(10, 22, 40, 0.95)',
                    border: '1px solid #F5A623',
                    borderRadius: 14,
                    padding: 18,
                    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.7)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, color: '#F5A623', fontWeight: 700 }}>
                        <span>تفاصيل المعلم المحدّد</span>
                        <button onClick={() => setSelectedFeatureProps(null)} style={{ color: '#fff' }}>✕</button>
                    </div>
                    <div style={{ maxHeight: 250, overflowY: 'auto', fontSize: '0.85rem' }}>
                        {Object.entries(selectedFeatureProps).map(([k, v]) => (
                            <div key={k} style={{ padding: '4px 0', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                                <strong style={{ color: '#06D6F2' }}>{k}:</strong> {String(v)}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Auth Login Modal */}
            {showAuthModal && (
                <div className="auth-modal-overlay">
                    <div className="auth-modal-card">
                        <h3 style={{ color: '#F5A623', marginBottom: 10 }}>دخول موظفي البلدية / المؤسسة</h3>
                        <p style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.7)', marginBottom: 20 }}>
                            {portal.auth_config?.welcome_msg || 'يرجى إدخال بيانات حسابك للوصول للطبقات المكانية المحمية'}
                        </p>

                        <form onSubmit={handleLogin}>
                            <input
                                type="text"
                                className="navbar-search-input"
                                style={{ width: '100%', marginBottom: 12, paddingLeft: 14 }}
                                placeholder="اسم المستخدم أو البريد"
                                value={loginCreds.username}
                                onChange={e => setLoginCreds({ ...loginCreds, username: e.target.value })}
                            />
                            <input
                                type="password"
                                className="navbar-search-input"
                                style={{ width: '100%', marginBottom: 20, paddingLeft: 14 }}
                                placeholder="كلمة المرور"
                                value={loginCreds.password}
                                onChange={e => setLoginCreds({ ...loginCreds, password: e.target.value })}
                            />
                            <button type="submit" className="nav-action-btn primary" style={{ width: '100%', padding: '12px 0' }}>
                                تسجيل الدخول 🔑
                            </button>
                        </form>
                        <button onClick={() => setShowAuthModal(false)} style={{ marginTop: 14, fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                            إلغاء
                        </button>
                    </div>
                </div>
            )}

            {/* Map Canvas */}
            <div ref={mapRef} className="viewer-map"></div>
        </div>
    );
}
