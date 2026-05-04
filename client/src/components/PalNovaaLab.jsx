import React, { useState, useEffect, useRef, useMemo } from 'react';
import Map, { Source, Layer, NavigationControl, Popup } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import './PalNovaaLab.css';

const PalNovaaLab = ({ onClose }) => {
    const [showIntro, setShowIntro] = useState(true);
    const [particles, setParticles] = useState([]);
    const [activeTab, setActiveTab] = useState('layers');
    const [mapState, setMapState] = useState({
        longitude: 35.2034,
        latitude: 31.9038,
        zoom: 13,
        pitch: 0,
        bearing: 0
    });
    const mapRef = useRef(null);

    const mapStyle = useMemo(() => ({
        version: 8,
        name: "Google Satellite",
        sprite: "https://demotiles.maplibre.org/styles/osm-bright-gl-style/sprite",
        glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
        sources: {
            'raster-tiles': {
                type: 'raster',
                tiles: [`https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}`],
                tileSize: 256
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

    const [drawingMode, setDrawingMode] = useState(null); // 'point', 'line', 'polygon', 'measure'
    const [selectedFeatureInfo, setSelectedFeatureInfo] = useState(null);
    const [draftCoordinates, setDraftCoordinates] = useState([]);
    const [drawnFeatures, setDrawnFeatures] = useState({ type: 'FeatureCollection', features: [] });
    const [measurement, setMeasurement] = useState(null);
    const [showBottomTable, setShowBottomTable] = useState(false);

    const [geoLayers, setGeoLayers] = useState([]);
    const [activeTableLayerId, setActiveTableLayerId] = useState(null);

    const activeTableLayer = useMemo(() => geoLayers.find(l => l.id === activeTableLayerId) || null, [geoLayers, activeTableLayerId]);

    const attributeKeys = useMemo(() => {
        if (!activeTableLayer || !activeTableLayer.data.features) return [];
        const keys = new Set();
        for (let i = 0; i < Math.min(activeTableLayer.data.features.length, 100); i++) {
            const props = activeTableLayer.data.features[i].properties;
            if (props) {
                Object.keys(props).forEach(k => keys.add(k));
            }
        }
        return Array.from(keys);
    }, [activeTableLayer]);

    const haversineDistance = (coords1, coords2) => {
        const R = 6371e3;
        const toRad = x => x * Math.PI / 180;
        const dLat = toRad(coords2[1] - coords1[1]);
        const dLon = toRad(coords2[0] - coords1[0]);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(coords1[1])) * Math.cos(toRad(coords2[1])) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    const finishDrawing = () => {
        if (draftCoordinates.length > 1) {
            let geometryType = drawingMode === 'polygon' && draftCoordinates.length > 2 ? 'Polygon' : 'LineString';
            let coords = geometryType === 'Polygon' ? [[...draftCoordinates, draftCoordinates[0]]] : draftCoordinates;
            const newFeature = { type: 'Feature', geometry: { type: geometryType, coordinates: coords }, properties: { type: `drawn_${drawingMode}` } };
            setDrawnFeatures(prev => ({ ...prev, features: [...prev.features, newFeature] }));
        }
        setDraftCoordinates([]);
        setDrawingMode(null);
    };

    const handleMapClick = (e) => {
        if (drawingMode) {
            const coord = [e.lngLat.lng, e.lngLat.lat];
            
            if (drawingMode === 'point') {
                const newFeature = { type: 'Feature', geometry: { type: 'Point', coordinates: coord }, properties: { type: 'drawn_point' } };
                setDrawnFeatures(prev => ({ ...prev, features: [...prev.features, newFeature] }));
                setDrawingMode(null);
            } else if (drawingMode === 'line' || drawingMode === 'measure' || drawingMode === 'polygon') {
                setDraftCoordinates(prev => {
                    const newCoords = [...prev, coord];
                    if (drawingMode === 'measure' && prev.length > 0) {
                        const dist = haversineDistance(prev[prev.length - 1], coord);
                        setMeasurement(m => (m || 0) + dist);
                    }
                    return newCoords;
                });
            }
            return;
        }

        // If not drawing, check for feature clicks using a BBox for better click tolerance
        const map = mapRef.current?.getMap();
        if (map) {
            try {
                const bbox = [
                    [e.point.x - 5, e.point.y - 5],
                    [e.point.x + 5, e.point.y + 5]
                ];
                
                // Get all features in BBox without specifying layers to avoid exceptions from non-existent layers
                const features = map.queryRenderedFeatures(bbox);
                
                // Filter only our app's specific layer prefixes
                const myFeatures = features.filter(f => 
                    f.layer.id.startsWith('poly-') || 
                    f.layer.id.startsWith('line-') || 
                    f.layer.id.startsWith('point-') || 
                    f.layer.id.startsWith('drawn-')
                );

                if (myFeatures && myFeatures.length > 0) {
                    const clickedFeature = myFeatures[0];
                    setSelectedFeatureInfo({
                        properties: clickedFeature.properties || {},
                        longitude: e.lngLat.lng,
                        latitude: e.lngLat.lat
                    });

                    // Auto-open attribute table for the clicked layer
                    const layerId = clickedFeature.layer.id;
                    let originalLayerId = null;
                    if (layerId.startsWith('poly-')) originalLayerId = layerId.replace('poly-', '');
                    else if (layerId.startsWith('line-')) originalLayerId = layerId.replace('line-', '');
                    else if (layerId.startsWith('point-')) originalLayerId = layerId.replace('point-', '');

                    if (originalLayerId) {
                        setActiveTableLayerId(originalLayerId);
                        setShowBottomTable(true);
                    }
                } else {
                    setSelectedFeatureInfo(null);
                }
            } catch (err) {
                console.error("Map click query error:", err);
            }
        }
    };

const onMouseEnter = (e) => {
    if (!drawingMode) e.target.getCanvas().style.cursor = 'pointer';
};
const onMouseLeave = (e) => {
    if (!drawingMode) e.target.getCanvas().style.cursor = 'grab';
};

    const handleContextMenu = (e) => {
        if (drawingMode) {
            e.preventDefault();
            finishDrawing();
        }
    };

    const handleToolClick = (tool) => {
        if (drawingMode === tool) {
            finishDrawing();
        } else {
            finishDrawing();
            setDrawingMode(tool);
            setMeasurement(tool === 'measure' ? 0 : null);
        }
    };

    const draftGeoJson = useMemo(() => {
        if (draftCoordinates.length === 0) return null;
        if (draftCoordinates.length === 1) {
            return { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: draftCoordinates[0] } }] };
        }
        return {
            type: 'FeatureCollection',
            features: [{
                type: 'Feature',
                geometry: {
                    type: 'LineString',
                    coordinates: draftCoordinates
                }
            }]
        };
    }, [draftCoordinates]);

    useEffect(() => {
        // Generate particles
        const newParticles = [];
        for (let i = 0; i < 30; i++) {
            const angle = (Math.PI * 2 * i) / 30;
            const dist = 200 + Math.random() * 200;
            newParticles.push({
                px: Math.cos(angle) * dist + 'px',
                py: Math.sin(angle) * dist + 'px',
                delay: (Math.random() * 4) + 's'
            });
        }
        setParticles(newParticles);

        // Hide intro after 2.8s
        const timer = setTimeout(() => {
            setShowIntro(false);
        }, 2800);
        return () => clearTimeout(timer);
    }, []);

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target.result);
                if (json.type === 'FeatureCollection' || json.type === 'Feature') {
                    const newLayer = {
                        id: Date.now().toString(),
                        name: file.name,
                        data: json,
                        color: ['#06D6F2', '#F5A623', '#10D9A0', '#8B5CF6', '#EC4899'][geoLayers.length % 5]
                    };
                    setGeoLayers(prev => [...prev, newLayer]);
                    setActiveTableLayerId(newLayer.id);
                    setShowBottomTable(true); // Auto-open the bottom attribute table
                    // Fly to data
                    if (mapRef.current) {
                        try {
                            const coordinates = [];
                            const extractCoords = (obj) => {
                                if(obj.type === 'FeatureCollection') obj.features.forEach(extractCoords);
                                else if(obj.geometry) extractCoords(obj.geometry);
                                else if(obj.coordinates) {
                                    if(typeof obj.coordinates[0] === 'number') coordinates.push(obj.coordinates);
                                    else obj.coordinates.forEach(c => {
                                        if(typeof c[0] === 'number') coordinates.push(c);
                                        else c.forEach(sub => {
                                            if(typeof sub[0] === 'number') coordinates.push(sub);
                                        });
                                    });
                                }
                            };
                            extractCoords(json);
                            if(coordinates.length > 0) {
                                const lons = coordinates.map(c => c[0]);
                                const lats = coordinates.map(c => c[1]);
                                mapRef.current.fitBounds(
                                    [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]],
                                    { padding: 80, duration: 2000 }
                                );
                            }
                        } catch(e) { console.error('Fit bounds error', e); }
                    }
                } else {
                    alert('الملف المرفق ليس بصيغة GeoJSON صحيحة.');
                }
            } catch (err) {
                alert('حدث خطأ أثناء قراءة الملف. تأكد من أنه ملف JSON/GeoJSON صالح.');
            }
        };
        reader.readAsText(file);
    };

    return (
        <div className="palnovaa-lab-container">
            {/* INTRO SPLASH */}
            {showIntro && (
                <div className="lab-intro" id="intro">
                    <div className="intro-grid"></div>
                    <div className="intro-glow"></div>
                    <div className="intro-particles">
                        {particles.map((p, i) => (
                            <div key={i} className="particle" style={{ left: '50%', top: '50%', '--px': p.px, '--py': p.py, animationDelay: p.delay }}></div>
                        ))}
                    </div>

                    <div className="intro-content">
                        <div className="intro-logo">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M9 2h6"/>
                                <path d="M10 2v7.5L4.5 19a2 2 0 0 0 1.7 3h11.6a2 2 0 0 0 1.7-3L14 9.5V2"/>
                                <path d="M7 16h10"/>
                                <circle cx="11" cy="14" r="0.6" fill="currentColor"/>
                                <circle cx="13.5" cy="17" r="0.5" fill="currentColor"/>
                                <circle cx="9.5" cy="18" r="0.5" fill="currentColor"/>
                            </svg>
                        </div>
                        <h1 dir="ltr">PalNovaa <span className="lab-tag">Lab</span></h1>
                        <div className="intro-loader"></div>
                    </div>
                </div>
            )}

            {/* MAIN APP */}
            <div className="lab-app">
                <header className="topbar">
                    <div className="brand">
                        <div className="brand-logo">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M9 2h6"/>
                                <path d="M10 2v7.5L4.5 19a2 2 0 0 0 1.7 3h11.6a2 2 0 0 0 1.7-3L14 9.5V2"/>
                                <path d="M7 16h10"/>
                            </svg>
                        </div>
                        <div className="brand-text">
                            <strong>PalNovaa</strong>
                            <small>LAB · v2.0</small>
                        </div>
                    </div>

                    <div className="topbar-divider"></div>

                    <div className="topbar-spacer"></div>

                    <div className="topbar-actions">
                        <button className="top-btn" title="إغلاق المختبر" onClick={onClose}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            <span>خروج</span>
                        </button>
                        <button className="top-btn primary" title="تشغيل التحليل">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                            <span>تشغيل التحليل</span>
                        </button>
                    </div>
                </header>

                <aside className="sidebar">
                    <button className={`tool ${drawingMode === null ? 'active' : ''}`} data-tip="مؤشر التحديد" onClick={() => handleToolClick(null)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 3l3.057-3 11.943 11.943-4.057.057L13 16.943l-3 3L5 3z"/></svg>
                    </button>
                    <button className={`tool ${drawingMode === 'point' ? 'active' : ''}`} data-tip="رسم نقطة" onClick={() => handleToolClick('point')}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="9"/></svg>
                    </button>
                    <button className={`tool ${drawingMode === 'line' ? 'active' : ''}`} data-tip="رسم خط (كليك يمين للإنهاء)" onClick={() => handleToolClick('line')}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="19" x2="19" y2="5"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="5" r="2"/></svg>
                    </button>
                    <button className={`tool ${drawingMode === 'polygon' ? 'active' : ''}`} data-tip="رسم مضلع (كليك يمين للإنهاء)" onClick={() => handleToolClick('polygon')}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5"/></svg>
                    </button>

                    <div className="sidebar-divider"></div>

                    <button className={`tool ${drawingMode === 'measure' ? 'active' : ''}`} data-tip="قياس المسافة (كليك يمين للإنهاء)" onClick={() => handleToolClick('measure')}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.3 8.7L8.7 21.3a2.4 2.4 0 0 1-3.4 0L2.7 18.7a2.4 2.4 0 0 1 0-3.4L15.3 2.7a2.4 2.4 0 0 1 3.4 0l2.6 2.6a2.4 2.4 0 0 1 0 3.4z"/><path d="M7 17l-3-3M11 13l-3-3M15 9l-3-3"/></svg>
                    </button>
                    
                    <div className="sidebar-bottom">
                        <button className="tool" data-tip="الإعدادات">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                        </button>
                    </div>
                </aside>

                <section className="canvas">
                    <div className="map-container-inner">
                        <Map
                            ref={mapRef}
                            {...mapState}
                            onMove={evt => setMapState(evt.viewState)}
                            onClick={handleMapClick}
                            onContextMenu={handleContextMenu}
                            onMouseEnter={onMouseEnter}
                            onMouseLeave={onMouseLeave}
                            interactiveLayerIds={[...geoLayers.flatMap(l => [`poly-${l.id}`, `line-${l.id}`, `point-${l.id}`]), 'drawn-polygon', 'drawn-line', 'drawn-point']}
                            cursor={drawingMode ? 'crosshair' : 'auto'}
                            mapStyle={mapStyle}
                            style={{ width: '100%', height: '100%' }}
                            maxPitch={85}
                            attributionControl={false}
                        >
                            <NavigationControl position="bottom-right" />
                            
                            {geoLayers.map(layer => (
                                <Source key={layer.id} id={`src-${layer.id}`} type="geojson" data={layer.data}>
                                    <Layer
                                        id={`poly-${layer.id}`}
                                        type="fill"
                                        filter={['==', '$type', 'Polygon']}
                                        paint={{ 'fill-color': layer.color, 'fill-opacity': 0.4, 'fill-outline-color': layer.color }}
                                    />
                                    <Layer
                                        id={`line-${layer.id}`}
                                        type="line"
                                        filter={['==', '$type', 'LineString']}
                                        paint={{ 'line-color': layer.color, 'line-width': 3 }}
                                    />
                                    <Layer
                                        id={`point-${layer.id}`}
                                        type="circle"
                                        filter={['==', '$type', 'Point']}
                                        paint={{ 'circle-radius': 6, 'circle-color': layer.color, 'circle-stroke-width': 2, 'circle-stroke-color': '#0A1628' }}
                                    />
                                </Source>
                            ))}

                            {/* Draft Drawing Layer */}
                            {draftGeoJson && (
                                <Source id="draft-source" type="geojson" data={draftGeoJson}>
                                    <Layer id="draft-line" type="line" filter={['==', '$type', 'LineString']} paint={{ 'line-color': '#EF4444', 'line-width': 3, 'line-dasharray': [2, 2] }} />
                                    <Layer id="draft-point" type="circle" filter={['==', '$type', 'Point']} paint={{ 'circle-radius': 5, 'circle-color': '#EF4444' }} />
                                </Source>
                            )}

                            {/* Finished Drawings Layer */}
                            {drawnFeatures.features.length > 0 && (
                                <Source id="drawn-source" type="geojson" data={drawnFeatures}>
                                    <Layer id="drawn-polygon" type="fill" filter={['==', '$type', 'Polygon']} paint={{ 'fill-color': '#8B5CF6', 'fill-opacity': 0.3 }} />
                                    <Layer id="drawn-line" type="line" filter={['==', '$type', 'LineString']} paint={{ 'line-color': '#8B5CF6', 'line-width': 3 }} />
                                    <Layer id="drawn-point" type="circle" filter={['==', '$type', 'Point']} paint={{ 'circle-radius': 6, 'circle-color': '#8B5CF6', 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' }} />
                                </Source>
                            )}

                            {selectedFeatureInfo && (
                                <Popup
                                    longitude={selectedFeatureInfo.longitude}
                                    latitude={selectedFeatureInfo.latitude}
                                    anchor="bottom"
                                    onClose={() => setSelectedFeatureInfo(null)}
                                    closeOnClick={false}
                                    offset={10}
                                    className="lab-feature-popup"
                                >
                                    <div style={{ padding: '15px', maxWidth: '300px', maxHeight: '350px', overflowY: 'auto' }}>
                                        <h4 style={{ margin: '0 0 10px 0', borderBottom: '1px solid rgba(6, 214, 242, 0.3)', paddingBottom: '8px', color: '#06D6F2', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
                                            </svg>
                                            تفاصيل البيانات
                                        </h4>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.9rem' }}>
                                            {Object.keys(selectedFeatureInfo.properties).length === 0 ? (
                                                <span style={{ color: 'rgba(255,255,255,0.5)' }}>لا توجد بيانات وصفية</span>
                                            ) : (
                                                Object.entries(selectedFeatureInfo.properties).map(([key, val]) => (
                                                    <div key={key} style={{ background: 'rgba(255,255,255,0.05)', padding: '6px 8px', borderRadius: '4px', wordBreak: 'break-word' }}>
                                                        <strong style={{ color: '#F5A623', display: 'block', fontSize: '0.8rem', marginBottom: '2px' }}>{key}</strong>
                                                        <span style={{ fontFamily: 'var(--font-mono)' }}>{typeof val === 'object' ? JSON.stringify(val) : String(val)}</span>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </Popup>
                            )}
                        </Map>
                    </div>

                    {/* Bottom Attribute Table - Integrated below map */}
                    <div style={{
                        height: showBottomTable ? '350px' : '45px',
                        background: 'rgba(10, 22, 40, 0.95)',
                        borderTop: '2px solid var(--accent-cyan)',
                        zIndex: 10,
                        transition: 'height 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        flexShrink: 0,
                        boxShadow: '0 -4px 20px rgba(0,0,0,0.3)'
                    }}>
                        <div onClick={() => setShowBottomTable(!showBottomTable)} style={{
                            height: '45px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0 20px',
                            background: 'rgba(6, 214, 242, 0.15)',
                            cursor: 'pointer',
                            color: 'var(--accent-cyan)',
                            fontWeight: 'bold',
                            borderBottom: '1px solid rgba(6, 214, 242, 0.3)',
                            userSelect: 'none'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
                                جدول البيانات الوصفية (Attribute Table)
                                <span style={{ background: 'rgba(6,214,242,0.2)', padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem', marginLeft: '10px' }}>
                                    {activeTableLayer ? activeTableLayer.data.features?.length || 0 : 0} معلم
                                </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <span style={{ fontSize: '0.85rem', opacity: 0.8, fontWeight: 'normal' }}>{showBottomTable ? 'إخفاء' : 'إظهار'}</span>
                                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: showBottomTable ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }}><polyline points="6 9 12 15 18 9"/></svg>
                            </div>
                        </div>
                        <div className="table-scroll-area" style={{ flex: 1, overflow: 'auto', padding: '0', position: 'relative', scrollBehavior: 'smooth' }}>
                            {(!activeTableLayer || !activeTableLayer.data.features || activeTableLayer.data.features.length === 0) ? (
                                <div style={{ padding: '40px', textAlign: 'center', color: 'rgba(255,255,255,0.4)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: '50px', height: '50px', marginBottom: '15px', opacity: '0.3' }}><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
                                    <p style={{ fontSize: '1.1rem' }}>لا توجد بيانات وصفية لعرضها</p>
                                    <p style={{ fontSize: '0.9rem', opacity: 0.7 }}>يرجى استيراد ملف GeoJSON ثم النقر على زر عرض البيانات</p>
                                </div>
                            ) : (
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', textAlign: 'right' }}>
                                    <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#0a1628', boxShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
                                        <tr>
                                            <th style={{ padding: '12px 15px', borderBottom: '1px solid var(--accent-cyan)', color: '#06D6F2', width: '50px' }}>#</th>
                                            {attributeKeys.map(key => (
                                                <th key={key} style={{ padding: '12px 15px', borderBottom: '1px solid var(--accent-cyan)', color: '#06D6F2', whiteSpace: 'nowrap' }}>{key}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {activeTableLayer.data.features.map((feature, i) => (
                                            <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent', cursor: 'pointer', transition: 'background 0.2s' }} 
                                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(6, 214, 242, 0.15)'}
                                                onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent'}
                                                onClick={() => {
                                                    setSelectedFeatureInfo({
                                                        properties: feature.properties,
                                                        longitude: mapState.longitude, 
                                                        latitude: mapState.latitude
                                                    });
                                                }}>
                                                <td style={{ padding: '10px 15px', color: '#F5A623', borderLeft: '1px solid rgba(255,255,255,0.05)' }}>{i + 1}</td>
                                                {attributeKeys.map(key => {
                                                    const val = feature.properties?.[key];
                                                    return (
                                                        <td key={key} style={{ padding: '10px 15px', whiteSpace: 'nowrap', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', borderLeft: '1px solid rgba(255,255,255,0.05)' }} title={val !== undefined && val !== null ? String(val) : ''}>
                                                            {val !== undefined && val !== null ? (typeof val === 'object' ? JSON.stringify(val) : String(val)) : <span style={{ color: 'rgba(255,255,255,0.2)' }}>-</span>}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </section>

                <aside className="panel">
                    <div className="panel-tabs">
                        <button className={`panel-tab ${activeTab === 'layers' ? 'active' : ''}`} onClick={() => setActiveTab('layers')}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
                            الطبقات
                        </button>
                        <button className={`panel-tab ${activeTab === 'analysis' ? 'active' : ''}`} onClick={() => setActiveTab('analysis')}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                            التحليل
                        </button>
                        <button className={`panel-tab ${activeTab === 'inspector' ? 'active' : ''}`} onClick={() => setActiveTab('inspector')}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                            التفاصيل
                        </button>
                    </div>

                    <div className="panel-body">
                        {activeTab === 'layers' && (
                            <div className="tab-content">
                                <div className="panel-section">
                                    <div className="panel-section-title">
                                        <span>استيراد بيانات GeoJSON</span>
                                    </div>
                                    <label className="upload-zone" style={{ display: 'block' }}>
                                        <input type="file" accept=".json,.geojson" onChange={handleFileUpload} style={{ display: 'none' }} />
                                        <div className="upload-icon">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                                <polyline points="17 8 12 3 7 8"/>
                                                <line x1="12" y1="3" x2="12" y2="15"/>
                                            </svg>
                                        </div>
                                        <h4 style={{ margin: '10px 0 5px 0' }}>اضغط للاختيار من جهازك</h4>
                                        <div className="formats">
                                            <span className="format-pill">.geojson</span>
                                            <span className="format-pill">.json</span>
                                        </div>
                                    </label>
                                </div>

                                {geoLayers.length > 0 && (
                                    <div className="panel-section">
                                        <div className="panel-section-title">
                                            <span>الطبقات النشطة</span>
                                            <button onClick={() => setGeoLayers([])} style={{color: '#EF4444'}}>إزالة الكل</button>
                                        </div>
                                        {geoLayers.map(layer => (
                                            <div key={layer.id} className="layer-item active" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', padding: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                                                    <div className="layer-color" style={{ background: layer.color, minWidth: '12px', width: '12px', height: '12px', borderRadius: '50%' }}></div>
                                                    <div className="layer-info" style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        <h5 style={{ margin: 0, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>{layer.name}</h5>
                                                        <small style={{ color: 'rgba(255,255,255,0.5)' }}>{layer.data.features?.length || 0} ميزة</small>
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', gap: '5px' }}>
                                                    <button onClick={() => { setActiveTableLayerId(layer.id); setShowBottomTable(true); }} style={{ background: 'transparent', border: 'none', color: 'var(--accent-cyan)', cursor: 'pointer', padding: '4px' }} title="عرض البيانات الوصفية">
                                                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
                                                    </button>
                                                    <button onClick={() => { setGeoLayers(prev => prev.filter(l => l.id !== layer.id)); if (activeTableLayerId === layer.id) { setActiveTableLayerId(null); setShowBottomTable(false); } }} style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '4px' }} title="حذف الطبقة">
                                                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'analysis' && (
                            <div className="tab-content">
                                <div className="panel-section">
                                    <div className="panel-section-title">
                                        <span>عمليات التحليل المتاحة قريباً</span>
                                    </div>
                                    <div className="analysis-grid">
                                        <div className="analysis-card">
                                            <div className="analysis-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7" strokeDasharray="2 2"/></svg></div>
                                            <h6>Buffer</h6>
                                            <p>نطاق احتمالي</p>
                                        </div>
                                        <div className="analysis-card">
                                            <div className="analysis-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6"/></svg></div>
                                            <h6>Intersection</h6>
                                            <p>تقاطع الطبقات</p>
                                        </div>
                                        <div className="analysis-card">
                                            <div className="analysis-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12c0 5.5-4.5 10-10 10S2 17.5 2 12 6.5 2 12 2"/><path d="M22 12c0-5.5-4.5-10-10-10v10h10z"/></svg></div>
                                            <h6>Heatmap</h6>
                                            <p>خريطة حرارية</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'inspector' && (
                            <div className="tab-content">
                                {selectedFeatureInfo ? (
                                    <div className="panel-section">
                                        <div className="panel-section-title">
                                            <span style={{ color: 'var(--accent-cyan)' }}>تفاصيل المعلم المحدد</span>
                                            <button onClick={() => setSelectedFeatureInfo(null)} style={{ color: '#EF4444' }}>إغلاق</button>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.9rem' }}>
                                            {Object.keys(selectedFeatureInfo.properties).length === 0 ? (
                                                <span style={{ color: 'rgba(255,255,255,0.5)' }}>لا توجد بيانات وصفية</span>
                                            ) : (
                                                Object.entries(selectedFeatureInfo.properties).map(([key, val]) => (
                                                    <div key={key} style={{ background: 'rgba(255,255,255,0.05)', padding: '6px 8px', borderRadius: '4px', wordBreak: 'break-word', borderRight: '2px solid var(--accent-cyan)' }}>
                                                        <strong style={{ color: '#F5A623', display: 'block', fontSize: '0.8rem', marginBottom: '2px' }}>{key}</strong>
                                                        <span style={{ fontFamily: 'var(--font-mono)' }}>{typeof val === 'object' ? JSON.stringify(val) : String(val)}</span>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="panel-section">
                                        <div style={{ padding: '20px', textAlign: 'center', color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: '40px', height: '40px', marginBottom: '10px', opacity: '0.5' }}>
                                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                                            </svg>
                                            <p>اضغط على أي نقطة أو خط أو مضلع على الخريطة لعرض تفاصيله هنا.</p>
                                        </div>
                                    </div>
                                )}

                                <div className="panel-section">
                                    <div className="panel-section-title">
                                        <span>معلومات الخريطة</span>
                                    </div>
                                    <div className="info-row"><span className="label">خط العرض</span><span className="value mono">{mapState.latitude.toFixed(4)}</span></div>
                                    <div className="info-row"><span className="label">خط الطول</span><span className="value mono">{mapState.longitude.toFixed(4)}</span></div>
                                    <div className="info-row"><span className="label">مستوى التكبير</span><span className="value mono">{mapState.zoom.toFixed(1)}</span></div>
                                </div>
                            </div>
                        )}
                    </div>
                </aside>

                <footer className="statusbar">
                    <div className="status-item">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/></svg>
                        <span>{mapState.latitude.toFixed(4)}°N, {mapState.longitude.toFixed(4)}°E</span>
                    </div>
                    <div className="status-divider"></div>
                    <div className="status-item">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                        <span>EPSG:4326</span>
                    </div>
                    <div className="status-spacer"></div>
                    <div className="status-pill">المختبر متصل</div>
                </footer>
            </div>
        </div>
    );
};

export default PalNovaaLab;
