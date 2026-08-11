import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './GeoportalViewer.css';

export default function GeoportalViewer() {
    const { slug } = useParams();
    const [portal, setPortal] = useState(null);
    const [layers, setLayers] = useState([]);
    // كل الطبقات مرئية بالافتراضي — المستخدم يخفيها هو إذا أراد
    const [visibleLayerIds, setVisibleLayerIds] = useState(new Set());
    const [loading, setLoading] = useState(true);
    const [layersLoading, setLayersLoading] = useState(false);
    const [showLayersDropdown, setShowLayersDropdown] = useState(false);

    // Live Coordinates & Projection System
    const [cursorCoords, setCursorCoords] = useState({ lat: 31.9038, lng: 35.2034 });
    const [mapScale, setMapScale] = useState('1 : 25,000');
    const [currentZoom, setCurrentZoom] = useState(13);
    const [selectedCrs, setSelectedCrs] = useState('28191'); // '28191' (Palestine Grid) | '2039' (Israeli Grid) | '4326' (Lat/Long)
    const [showCrsMenu, setShowCrsMenu] = useState(false);

    // Helper to calculate exact geographic centroid for fixed labels
    const getFeatureCentroid = (feature) => {
        if (!feature || !feature.geometry) return null;
        const type = feature.geometry.type;
        const coords = feature.geometry.coordinates;

        if (type === 'Point') {
            return [coords[1], coords[0]];
        }
        if (type === 'Polygon') {
            let pts = coords[0];
            let latSum = 0, lngSum = 0, count = pts.length;
            pts.forEach(pt => { lngSum += pt[0]; latSum += pt[1]; });
            return [latSum / count, lngSum / count];
        }
        if (type === 'MultiPolygon') {
            let pts = coords[0][0];
            let latSum = 0, lngSum = 0, count = pts.length;
            pts.forEach(pt => { lngSum += pt[0]; latSum += pt[1]; });
            return [latSum / count, lngSum / count];
        }
        if (type === 'LineString') {
            const mid = Math.floor(coords.length / 2);
            return [coords[mid][1], coords[mid][0]];
        }
        return null;
    };

    // Coordinate conversion utilities
    const formatCoordinates = () => {
        const { lat, lng } = cursorCoords;
        if (selectedCrs === '4326') {
            return `X: ${lng.toFixed(5)}    Y: ${lat.toFixed(5)}`;
        } else if (selectedCrs === '2039') {
            const RAD = Math.PI / 180;
            const dLat = (lat - 31.734) * 111132;
            const dLng = (lng - 35.212) * 111132 * Math.cos(lat * RAD);
            const x = Math.round(220000 + dLng);
            const y = Math.round(626869 + dLat);
            return `X: ${x}    Y: ${y}`;
        } else {
            // Default: Palestinian Grid (EPSG:28191)
            const RAD = Math.PI / 180;
            const lat0 = 31.7340969444 * RAD;
            const lng0 = 35.2120805556 * RAD;
            const phi = lat * RAD;
            const lam = lng * RAD;
            const dLat = (phi - lat0) * 6378137;
            const dLng = (lam - lng0) * 6378137 * Math.cos((phi + lat0) / 2);
            const x = Math.round(170000 + dLng);
            const y = Math.round(1126869 + dLat);
            return `X: ${x}    Y: ${y}`;
        }
    };

    // Auth modal state
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [loginCreds, setLoginCreds] = useState({ username: '', password: '' });
    const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('token'));

    // Tools state
    const [activeTool, setActiveTool] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedFeatureProps, setSelectedFeatureProps] = useState(null);

    // Map refs
    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const featureGroupsRef = useRef({});
    // كاش البيانات لتجنب إعادة الجلب
    const layerDataCache = useRef({});

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
            const layerArr = Array.isArray(data.layers) ? data.layers : [];
            setLayers(layerArr);

            // ✅ كل الطبقات تظهر تلقائياً بدون أي تفاعل من المستخدم
            const allLayerIds = new Set(layerArr.map(l => l.id));
            setVisibleLayerIds(allLayerIds);
        } catch (err) {
            console.error('Error resolving portal:', err);
            setLayers([]);
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

            // Google Maps Plain Satellite (بدون كتابات ولا أسماء — سادة ناصعة)
            L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
                attribution: '© Google Maps',
                maxZoom: 21,
                subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
            }).addTo(mapInstance.current);

            // Listen to mousemove for live coordinates
            mapInstance.current.on('mousemove', (e) => {
                setCursorCoords({ lat: e.latlng.lat, lng: e.latlng.lng });
            });

            // Listen to zoomend for live map scale & zoom threshold check
            mapInstance.current.on('zoomend', () => {
                const z = mapInstance.current.getZoom();
                setCurrentZoom(z);
                const scaleVal = Math.round(591657550.5 / Math.pow(2, z));
                setMapScale(`1 : ${scaleVal.toLocaleString()}`);
            });
        }

        // Load features for active visible layers
        renderVisibleLayers();

    }, [portal, visibleLayerIds, isLoggedIn, currentZoom]);

    // ✅ تحميل طبقة واحدة مع كاش
    const fetchLayerData = useCallback(async (layer) => {
        // إذا محملة مسبقاً — ارجعها من الكاش فوراً
        if (layerDataCache.current[layer.id]) {
            return layerDataCache.current[layer.id];
        }
        const token = localStorage.getItem('token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        try {
            const res = await axios.get(`/api/geoportals/public/layers/${layer.id}/features`, { headers });
            layerDataCache.current[layer.id] = res.data; // خزّنها في الكاش
            return res.data;
        } catch (err) {
            // إذا محمية وما في token، تجاهل الخطأ بصمت
            if (err.response?.status === 403) return null;
            console.warn(`Layer ${layer.layer_name} failed:`, err.message);
            return null;
        }
    }, []);

    // ✅ تحميل وعرض جميع الطبقات المرئية دائماً بدون تقييد زوم أو قص
    const renderVisibleLayers = useCallback(async () => {
        if (!mapInstance.current || !layers.length) return;

        // إزالة الطبقات غير المرئية
        Object.entries(featureGroupsRef.current).forEach(([id, group]) => {
            const isVisible = visibleLayerIds.has(Number(id)) || visibleLayerIds.has(id);
            if (!isVisible) {
                mapInstance.current.removeLayer(group);
            }
        });

        const visibleLayers = layers.filter(l => visibleLayerIds.has(l.id));
        setLayersLoading(true);

        let combinedBounds = L.latLngBounds([]);

        await Promise.all(visibleLayers.map(async (layer) => {
            const style = layer.style_config || {};

            // إذا مرسومة مسبقاً على الخريطة
            if (featureGroupsRef.current[layer.id]) {
                if (!mapInstance.current.hasLayer(featureGroupsRef.current[layer.id])) {
                    featureGroupsRef.current[layer.id].addTo(mapInstance.current);
                }
                const existingBounds = featureGroupsRef.current[layer.id].getBounds();
                if (existingBounds && existingBounds.isValid()) combinedBounds.extend(existingBounds);
                return;
            }

            const geojson = await fetchLayerData(layer);
            if (!geojson || !geojson.features?.length) return;

            const isTransparent = style.fill_color === 'transparent' || style.is_transparent;
            const showLabels = style.show_labels;
            const labelField = style.label_field;
            const labelColor = style.label_color || '#FFFFFF';
            const labelSize = style.label_size || 12;

            const group = L.geoJSON(geojson, {
                style: () => ({
                    color: style.stroke_color || '#1D4ED8',
                    weight: style.stroke_width !== undefined ? style.stroke_width : 2,
                    fillColor: isTransparent ? 'transparent' : (style.fill_color || '#3B82F6'),
                    fillOpacity: isTransparent ? 0 : (style.fill_opacity !== undefined ? style.fill_opacity : 0.45)
                }),
                pointToLayer: (feature, latlng) => {
                    return L.circleMarker(latlng, {
                        radius: style.point_radius || 7,
                        fillColor: isTransparent ? 'transparent' : (style.fill_color || '#F5A623'),
                        color: style.stroke_color || '#D88B0E',
                        weight: style.stroke_width || 2,
                        opacity: 1,
                        fillOpacity: isTransparent ? 0 : (style.fill_opacity !== undefined ? style.fill_opacity : 0.9)
                    });
                },
                onEachFeature: (feature, leafletLayer) => {
                    leafletLayer.on('click', () => setSelectedFeatureProps({
                        layerName: layer.layer_name,
                        properties: feature.properties
                    }));

                    // ✅ إضافة مسميات الخصائص كـ Fixed DivIcon Labels مطبوعة وثابتة على الخريطة
                    if (showLabels && labelField && feature.properties && feature.properties[labelField] !== undefined) {
                        const val = feature.properties[labelField];
                        if (val !== null && val !== '') {
                            const centroid = getFeatureCentroid(feature);
                            if (centroid) {
                                const labelIcon = L.divIcon({
                                    className: 'fixed-map-label-wrapper',
                                    html: `<div class="fixed-map-label" style="color: ${labelColor}; font-size: ${labelSize}px;">${String(val)}</div>`,
                                    iconSize: [0, 0],
                                    iconAnchor: [0, 0]
                                });
                                L.marker(centroid, { icon: labelIcon, interactive: false }).addTo(group);
                            }
                        }
                    }
                }
            });

            featureGroupsRef.current[layer.id] = group;
            group.addTo(mapInstance.current);

            const b = group.getBounds();
            if (b && b.isValid()) combinedBounds.extend(b);
        }));

        // ✅ التوجّه التلقائي المباشر لموقع المعالم الحقيقي
        if (combinedBounds && combinedBounds.isValid() && mapInstance.current) {
            mapInstance.current.fitBounds(combinedBounds, { padding: [50, 50], maxZoom: 17 });
        }

        setLayersLoading(false);
    }, [layers, visibleLayerIds, fetchLayerData]);

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
            {/* Modern Floating Top Navigation Bar (Matching exact user UI reference) */}
            <div className="geoportal-navbar-container">
                <div className="geoportal-navbar">
                    {/* Brand Section */}
                    <div className="brand-section">
                        <div className="brand-icon-box">
                            {portal.logo_url ? (
                                <img src={portal.logo_url} alt="Logo" className="brand-logo" />
                            ) : (
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                    <circle cx="12" cy="12" r="10" />
                                    <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                                </svg>
                            )}
                        </div>
                        <div className="brand-title-group">
                            <span className="brand-name">{portal.title_ar || 'GeoPulse'}</span>
                        </div>
                    </div>

                    {/* Center Search Input */}
                    <div className="navbar-center-search">
                        <div className="search-input-wrapper">
                            <svg className="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.2">
                                <circle cx="11" cy="11" r="8" />
                                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                            <input
                                type="text"
                                className="navbar-search-input"
                                placeholder="Search locations, coordinates or layers..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                            <svg className="filter-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
                                <line x1="4" y1="6" x2="20" y2="6" />
                                <line x1="8" y1="12" x2="16" y2="12" />
                                <line x1="10" y1="18" x2="14" y2="18" />
                            </svg>
                        </div>
                    </div>

                    {/* Right Actions & Layers Dropdown */}
                    <div className="navbar-actions">
                        {/* Layers Button with Dropdown Trigger */}
                        <div className="layers-dropdown-wrapper">
                            <button
                                className={`nav-action-btn layers-btn ${showLayersDropdown ? 'active' : ''}`}
                                onClick={() => setShowLayersDropdown(!showLayersDropdown)}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                                </svg>
                                <span>طبقات</span>
                                <span className="layers-badge">{layers.length}</span>
                            </button>

                            {/* Dropdown Menu */}
                            {showLayersDropdown && (
                                <div className="layers-dropdown-menu">
                                    <div className="dropdown-header">
                                        <span>الطبقات الجغرافية المكانية</span>
                                        <button className="close-dropdown-btn" onClick={() => setShowLayersDropdown(false)}>✕</button>
                                    </div>
                                    <div className="dropdown-body">
                                        {(Array.isArray(layers) ? layers : []).length === 0 ? (
                                            <div className="empty-layers-msg">لا توجد طبقات جغرافية مسجلة</div>
                                        ) : (
                                            (Array.isArray(layers) ? layers : []).map(layer => {
                                                const style = layer.style_config || {};
                                                const isVisible = visibleLayerIds.has(layer.id);
                                                return (
                                                    <div key={layer.id} className="layer-dropdown-item" onClick={() => toggleLayerVisibility(layer.id)}>
                                                        <div className="layer-item-checkbox">
                                                            <input
                                                                type="checkbox"
                                                                checked={isVisible}
                                                                onChange={() => { }}
                                                            />
                                                            <span
                                                                className="legend-swatch"
                                                                style={{ backgroundColor: style.fill_color || '#2563eb', borderColor: style.stroke_color || '#1d4ed8' }}
                                                            ></span>
                                                            <span className="layer-item-name">
                                                                {layer.layer_name}
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                        {layersLoading && (
                                            <div className="layers-loading-text">
                                                ⏳ جاري تحميل بيانات الخريطة...
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Globe Icon */}
                        <button className="icon-nav-btn" title="اللغة / Language">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="2" y1="12" x2="22" y2="12" />
                                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                            </svg>
                        </button>

                        {/* User Profile Button */}
                        {isLoggedIn ? (
                            <button className="user-profile-btn" title="تسجيل الخروج" onClick={() => {
                                localStorage.removeItem('token');
                                setIsLoggedIn(false);
                            }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                    <circle cx="12" cy="7" r="4" />
                                </svg>
                            </button>
                        ) : (
                            <button className="user-profile-btn" title="تسجيل الدخول" onClick={() => setShowAuthModal(true)}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                    <circle cx="12" cy="7" r="4" />
                                </svg>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Feature Property Inspector Card */}
            {selectedFeatureProps && (
                <div className="feature-inspector-card">
                    <div className="feature-inspector-header">
                        <div className="feature-title-group">
                            <span className="feature-icon">📍</span>
                            <div>
                                <h4>{selectedFeatureProps.layerName || 'تفاصيل المعلم'}</h4>
                                <span className="feature-sub">Spatial Attributes</span>
                            </div>
                        </div>
                        <button className="close-inspector-btn" onClick={() => setSelectedFeatureProps(null)}>✕</button>
                    </div>

                    <div className="feature-inspector-body">
                        {Object.entries(selectedFeatureProps.properties || selectedFeatureProps).map(([k, v]) => {
                            if (k === 'layerName') return null;
                            return (
                                <div key={k} className="feature-prop-row">
                                    <span className="prop-key">{k}</span>
                                    <span className="prop-val">{v !== null && v !== undefined ? String(v) : '-'}</span>
                                </div>
                            );
                        })}
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

            {/* Bottom Status & Coordinate Bar (Matching Exact User Reference Images) */}
            <div className="geoportal-bottom-bar">
                <div className="bottom-bar-left">
                    <span>Terms of Use</span>
                    <span className="divider">|</span>
                    <span>© {portal.title_ar || 'GeoPulse'} 2024</span>
                </div>

                <div className="bottom-bar-right">
                    {/* Projection System Selector Trigger */}
                    <div className="crs-selector-wrapper">
                        <button
                            className="crs-selector-btn"
                            onClick={() => setShowCrsMenu(!showCrsMenu)}
                            title="اختيار نظام الإسقاط الإحداثي"
                        >
                            <span>
                                {selectedCrs === '28191' && 'Default WKID: 28191 X/Y'}
                                {selectedCrs === '2039' && 'Israeli XY'}
                                {selectedCrs === '4326' && 'Lat/Long'}
                            </span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M6 9l6 6 6-6" />
                            </svg>
                        </button>

                        {/* Projection Selection Menu */}
                        {showCrsMenu && (
                            <div className="crs-menu">
                                <div
                                    className={`crs-option ${selectedCrs === '28191' ? 'active' : ''}`}
                                    onClick={() => { setSelectedCrs('28191'); setShowCrsMenu(false); }}
                                >
                                    Default WKID: 28191 X/Y
                                </div>
                                <div
                                    className={`crs-option ${selectedCrs === '28191_pal' ? 'active' : ''}`}
                                    onClick={() => { setSelectedCrs('28191'); setShowCrsMenu(false); }}
                                >
                                    Palestinian XY
                                </div>
                                <div
                                    className={`crs-option ${selectedCrs === '2039' ? 'active' : ''}`}
                                    onClick={() => { setSelectedCrs('2039'); setShowCrsMenu(false); }}
                                >
                                    Israeli XY
                                </div>
                                <div
                                    className={`crs-option ${selectedCrs === '4326' ? 'active' : ''}`}
                                    onClick={() => { setSelectedCrs('4326'); setShowCrsMenu(false); }}
                                >
                                    Lat/Long
                                </div>
                            </div>
                        )}
                    </div>

                    <span className="divider">|</span>

                    {/* Live Coordinates Display */}
                    <div className="coords-display">
                        {formatCoordinates()}
                    </div>

                    <span className="divider">|</span>

                    {/* Live Map Scale Display */}
                    <div className="scale-display">
                        Scale: {mapScale}
                    </div>
                </div>
            </div>

            {/* Map Canvas */}
            <div ref={mapRef} className="viewer-map"></div>
        </div>
    );
}
