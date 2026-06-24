import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Map, { Marker, Source, Layer } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import VirtualTourViewer from '../components/VirtualTourViewer';
import StreetViewModal from '../components/StreetViewModal';
import { useAuth } from '../context/AuthContext';
import './VirtualTourMap.css';

const MAPILLARY_TOKEN = import.meta.env.VITE_MAPILLARY_TOKEN || '';

const VirtualTourMap = () => {
    const navigate = useNavigate();
    const mapRef   = useRef(null);
    const fileInputRef = useRef(null);
    const { user, token } = useAuth();

    const [mode,             setMode]             = useState('360');
    const [selectedLocation, setSelectedLocation] = useState(null);
    const [hoveredId,        setHoveredId]        = useState(null);
    const [svCoords,         setSvCoords]         = useState(null);
    const [svPosition,       setSvPosition]       = useState(null);

    // Dynamic Tour data from database
    const [tours,            setTours]            = useState([]);
    const [loadingTours,     setLoadingTours]     = useState(true);
    
    // Creation State
    const [isAdding,         setIsAdding]         = useState(false);
    const [name,             setName]             = useState('');
    const [description,      setDescription]      = useState('');
    const [latitude,         setLatitude]         = useState('');
    const [longitude,        setLongitude]        = useState('');
    const [imageFile,        setImageFile]        = useState(null);
    const [tempCoords,       setTempCoords]       = useState(null);
    const [isUploading,      setIsUploading]      = useState(false);
    const [isSvMaximized,    setIsSvMaximized]    = useState(false);

    // API URL
    const apiUrl = import.meta.env.VITE_API_URL || '/api';

    // Helper to proxy R2 image to bypass CORS WebGL errors
    const getProxiedImageUrl = useCallback((url) => {
        if (!url) return null;
        if (url.startsWith('http')) {
            return `${apiUrl}/tours/proxy?url=${encodeURIComponent(url)}`;
        }
        return url;
    }, [apiUrl]);

    // ── Fetch Virtual Tours from Backend ──────────────────────────────────────
    const fetchTours = async () => {
        setLoadingTours(true);
        try {
            const res = await fetch(`${apiUrl}/tours`);
            if (!res.ok) throw new Error('Failed to fetch tours');
            const data = await res.json();
            if (data.tours) {
                // Map the database tours to match the location format expected by VirtualTourViewer
                const formattedTours = data.tours.map(t => ({
                    id: t.id.toString(),
                    name: t.name,
                    description: t.description,
                    lat: parseFloat(t.latitude),
                    lng: parseFloat(t.longitude),
                    markerColor: '#10b981', // default emerald green for new tours
                    panoramas: [
                        {
                            id: `pano_${t.id}`,
                            label: t.name,
                            image: getProxiedImageUrl(t.image_url),
                            hotspots: []
                        }
                    ]
                }));
                setTours(formattedTours);
            }
        } catch (error) {
            console.error('Error fetching tours:', error);
        } finally {
            setLoadingTours(false);
        }
    };

    useEffect(() => {
        fetchTours();
    }, []);

    // ── Delete Virtual Tour ──────────────────────────────────────────────────
    const handleDeleteTour = async (e, tourId) => {
        e.stopPropagation();
        if (!window.confirm('هل أنت متأكد من رغبتك في حذف هذه الجولة الافتراضية نهائياً؟')) return;

        try {
            const res = await fetch(`${apiUrl}/tours/${tourId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || 'Failed to delete tour');
            }
            alert('تم حذف الجولة الافتراضية بنجاح');
            fetchTours();
            if (selectedLocation && selectedLocation.id === tourId.toString()) {
                setSelectedLocation(null);
            }
        } catch (error) {
            console.error('Error deleting tour:', error);
            alert(`خطأ في الحذف: ${error.message}`);
        }
    };

    // ── Submit New Tour ──────────────────────────────────────────────────────
    const handleSubmitTour = async (e) => {
        e.preventDefault();
        if (!name || !latitude || !longitude || !imageFile) {
            alert('يرجى ملء جميع الحقول المطلوبة واختيار صورة 360°');
            return;
        }

        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append('name', name);
            formData.append('description', description);
            formData.append('latitude', latitude);
            formData.append('longitude', longitude);
            formData.append('image', imageFile);

            const res = await fetch(`${apiUrl}/tours`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || 'Failed to publish virtual tour');
            }

            alert('تم نشر الجولة الافتراضية بنجاح!');
            setIsAdding(false);
            setName('');
            setDescription('');
            setLatitude('');
            setLongitude('');
            setImageFile(null);
            setTempCoords(null);
            fetchTours();
        } catch (error) {
            console.error('Error creating tour:', error);
            alert(`حدث خطأ أثناء النشر: ${error.message}`);
        } finally {
            setIsUploading(false);
        }
    };

    // ── Get Current Location ──────────────────────────────────────────────────
    const handleGetCurrentLocation = () => {
        if (!navigator.geolocation) {
            alert('خاصية تحديد الموقع غير مدعومة في متصفحك');
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                setLatitude(lat.toFixed(6));
                setLongitude(lng.toFixed(6));
                setTempCoords({ lat, lng });
                mapRef.current?.flyTo({ center: [lng, lat], zoom: 15, duration: 1500 });
            },
            (error) => {
                console.error('GPS error:', error);
                alert('فشل الحصول على موقعك الحالي. تأكد من تفعيل الـ GPS وصلاحية الوصول.');
            }
        );
    };

    // ── Map styles ───────────────────────────────────────────────────────────
    const GOOGLE_SATELLITE_STYLE = useMemo(() => ({
        version: 8,
        name: "Satellite",
        sprite: "https://demotiles.maplibre.org/styles/osm-bright-gl-style/sprite",
        glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
        sources: {
            'raster-tiles': {
                type: 'raster',
                tiles: [`https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}`],
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
        setIsSvMaximized(false);
    };

    // ── Map click ────────────────────────────────────────────────────────────
    const handleMapClick = useCallback((e) => {
        if (isAdding) {
            setLatitude(e.lngLat.lat.toFixed(6));
            setLongitude(e.lngLat.lng.toFixed(6));
            setTempCoords({ lat: e.lngLat.lat, lng: e.lngLat.lng });
            return;
        }
        if (mode !== 'street') return;
        setSvCoords({ lat: e.lngLat.lat, lng: e.lngLat.lng });
        setSvPosition(null);
    }, [mode, isAdding]);

    const svOpen = mode === 'street' && svCoords;
    const isAdmin = user?.role === 'admin';

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
                    <span className="vtmap-header-title">الجولة الافتراضية 360°</span>
                    
                    {/* Admin Add Button */}
                    {isAdmin && !isAdding && (
                        <button className="vtmap-admin-add-btn" onClick={() => setIsAdding(true)}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                                stroke="currentColor" strokeWidth="2.5">
                                <line x1="12" y1="5" x2="12" y2="19"/>
                                <line x1="5" y1="12" x2="19" y2="12"/>
                            </svg>
                            إضافة جولة جديدة
                        </button>
                    )}
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
                        جولات 360°
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
                <div className={`vtmap-map-wrap ${svOpen ? 'sv-open' : ''} ${isSvMaximized ? 'sv-maximized' : ''}`}>

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

                    {/* Adding Tour Map Banner */}
                    {isAdding && (
                        <div className="vtmap-sv-hint" style={{ background: '#fbab15', color: '#000' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                                stroke="currentColor" strokeWidth="2.5">
                                <circle cx="12" cy="12" r="10"/>
                                <path d="M12 8v8M8 12h8"/>
                            </svg>
                            انقر على الخريطة لتحديد موقع الجولة الافتراضية
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
                        cursor={isAdding ? 'crosshair' : (mode === 'street' ? 'crosshair' : 'grab')}
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
                        {mode === '360' && tours.map((loc) => (
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

                        {/* ── Temporary creation marker ── */}
                        {isAdding && tempCoords && (
                            <Marker
                                longitude={tempCoords.lng}
                                latitude={tempCoords.lat}
                                anchor="center"
                            >
                                <div className="vtmap-temp-marker" />
                            </Marker>
                        )}
                    </Map>
                </div>

                {/* ── Right panel ── */}
                <div className="vtmap-right-panel" style={{ width: svOpen ? undefined : (isAdding ? '350px' : '300px') }}>

                    {/* Admin Add Form */}
                    {isAdding ? (
                        <form className="vtmap-admin-form" onSubmit={handleSubmitTour}>
                            <h3 style={{ margin: '0 0 8px 0', color: '#fbab15', fontSize: '1.1rem' }}>إضافة جولة 360° جديدة</h3>
                            
                            <div className="vtmap-form-group">
                                <label>اسم الموقع *</label>
                                <input 
                                    type="text" 
                                    className="vtmap-form-input" 
                                    placeholder="مثال: المسجد الأقصى، ساحة المهد..."
                                    value={name} 
                                    onChange={(e) => setName(e.target.value)} 
                                    required 
                                />
                            </div>

                            <div className="vtmap-form-group">
                                <label>الوصف</label>
                                <textarea 
                                    className="vtmap-form-input" 
                                    placeholder="أدخل وصفاً بسيطاً للموقع..."
                                    rows="2"
                                    value={description} 
                                    onChange={(e) => setDescription(e.target.value)} 
                                />
                            </div>

                            <div className="vtmap-form-group">
                                <label>الموقع الجغرافي *</label>
                                <div className="vtmap-coords-row">
                                    <input 
                                        type="number" 
                                        step="any"
                                        className="vtmap-form-input" 
                                        placeholder="خط العرض (Latitude)"
                                        value={latitude} 
                                        onChange={(e) => {
                                            setLatitude(e.target.value);
                                            if (longitude) setTempCoords({ lat: parseFloat(e.target.value), lng: parseFloat(longitude) });
                                        }} 
                                        required 
                                    />
                                    <input 
                                        type="number" 
                                        step="any"
                                        className="vtmap-form-input" 
                                        placeholder="خط الطول (Longitude)"
                                        value={longitude} 
                                        onChange={(e) => {
                                            setLongitude(e.target.value);
                                            if (latitude) setTempCoords({ lat: parseFloat(latitude), lng: parseFloat(e.target.value) });
                                        }} 
                                        required 
                                    />
                                </div>
                                <button 
                                    type="button" 
                                    className="vtmap-gps-btn" 
                                    onClick={handleGetCurrentLocation}
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <circle cx="12" cy="12" r="10"/>
                                        <path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>
                                    </svg>
                                    تحديد موقعي الحالي بالـ GPS
                                </button>
                            </div>

                            <div className="vtmap-form-group">
                                <label>صورة 360 درجة بانوراما *</label>
                                <div 
                                    className={`vtmap-upload-card ${imageFile ? 'has-file' : ''}`}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                                        <circle cx="12" cy="13" r="4"/>
                                    </svg>
                                    <span style={{ fontSize: '0.8rem', textAlign: 'center' }}>
                                        {imageFile ? `تم اختيار: ${imageFile.name}` : 'التقط من كاميرا الهاتف أو اختر ملف صورة 360°'}
                                    </span>
                                    <input 
                                        type="file" 
                                        ref={fileInputRef}
                                        style={{ display: 'none' }}
                                        accept="image/*" 
                                        capture="environment" 
                                        onChange={(e) => {
                                            if (e.target.files && e.target.files[0]) {
                                                setImageFile(e.target.files[0]);
                                            }
                                        }}
                                    />
                                </div>
                            </div>

                            <div className="vtmap-submit-row">
                                <button type="submit" className="vtmap-btn-primary" disabled={isUploading}>
                                    {isUploading ? 'جاري الرفع والنشر...' : 'نشر الجولة الافتراضية'}
                                </button>
                                <button 
                                    type="button" 
                                    className="vtmap-btn-secondary" 
                                    onClick={() => {
                                        setIsAdding(false);
                                        setTempCoords(null);
                                        setImageFile(null);
                                    }}
                                    disabled={isUploading}
                                >
                                    إلغاء
                                </button>
                            </div>
                        </form>
                    ) : (
                        /* 360° sidebar list */
                        mode === '360' && (
                            <div className="vtmap-sidebar">
                                <div className="vtmap-sidebar-header">
                                    <span>{tours.length} موقع متاح</span>
                                </div>
                                <div className="vtmap-sidebar-list">
                                    {loadingTours ? (
                                        <div style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: '30px' }}>
                                            جاري تحميل المواقع...
                                        </div>
                                    ) : tours.length === 0 ? (
                                        <div style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: '30px 10px', fontSize: '0.85rem' }}>
                                            لا توجد جولات افتراضية منشورة بعد.
                                            {isAdmin && <p style={{ color: '#fbab15', cursor: 'pointer', fontWeight: 'bold', marginTop: '10px' }} onClick={() => setIsAdding(true)}>انقر هنا لإضافة أول جولة</p>}
                                        </div>
                                    ) : (
                                        tours.map((loc) => (
                                            <div 
                                                key={loc.id} 
                                                className="vtmap-card"
                                                onMouseEnter={() => setHoveredId(loc.id)}
                                                onMouseLeave={() => setHoveredId(null)}
                                                onClick={() => setSelectedLocation(loc)}
                                                style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '4px' }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '11px', width: '100%' }}>
                                                    <div className="vtmap-card-dot" style={{ background: loc.markerColor }} />
                                                    <div className="vtmap-card-text">
                                                        <span className="vtmap-card-name">{loc.name}</span>
                                                        <span className="vtmap-card-desc">{loc.description}</span>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        {isAdmin && (
                                                            <button 
                                                                className="vtmap-delete-btn"
                                                                title="حذف الجولة"
                                                                onClick={(e) => handleDeleteTour(e, loc.id)}
                                                            >
                                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                    <polyline points="3 6 5 6 21 6"/>
                                                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                                                </svg>
                                                            </button>
                                                        )}
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                                                            stroke="rgba(255,255,255,0.3)" strokeWidth="2.5">
                                                            <polyline points="15 18 9 12 15 6"/>
                                                        </svg>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )
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
                            onClose={() => { setSvCoords(null); setSvPosition(null); setIsSvMaximized(false); }}
                            onPositionChange={(lat, lng) => {
                                setSvPosition({ lat, lng });
                                mapRef.current?.easeTo({ center: [lng, lat], duration: 500 });
                            }}
                            inline
                            isMaximized={isSvMaximized}
                            onToggleMaximize={() => setIsSvMaximized(!isSvMaximized)}
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
