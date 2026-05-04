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
    const [isDesignStudioOpen, setIsDesignStudioOpen] = useState(false);
    const [activeDsCategory, setActiveDsCategory] = useState('layouts');
    const [designSelections, setDesignSelections] = useState({
        layout: 'fullmap',
        palette: 'classic',
        font: 'tajawal',
        basemap: 'dark',
        marker: 'pin',
        component: 'pill',
        effect: 'glow'
    });

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
            
            let metricText = '';
            if (geometryType === 'LineString' || drawingMode === 'measure') {
                let dist = 0;
                for (let i = 0; i < coords.length - 1; i++) dist += haversineDistance(coords[i], coords[i+1]);
                metricText = dist > 1000 ? (dist / 1000).toFixed(2) + ' كم' : dist.toFixed(1) + ' م';
            } else if (geometryType === 'Polygon') {
                let area = 0;
                const pts = coords[0];
                for (let i = 0; i < pts.length - 1; i++) {
                    let p1 = pts[i];
                    let p2 = pts[i + 1];
                    area += (p2[0] - p1[0]) * Math.PI/180 * (2 + Math.sin(p1[1]*Math.PI/180) + Math.sin(p2[1]*Math.PI/180));
                }
                area = Math.abs(area * 6378137 * 6378137 / 2.0);
                metricText = area > 1000000 ? (area / 1000000).toFixed(2) + ' كم²' : area.toFixed(1) + ' م²';
            }

            const newFeature = { type: 'Feature', geometry: { type: geometryType, coordinates: coords }, properties: { type: `drawn_${drawingMode}`, name: `رسمة (${drawingMode})`, Measurement: metricText } };
            setGeoLayers(prev => [...prev, {
                id: Date.now().toString(),
                name: `رسم (${drawingMode === 'polygon' ? 'مساحة' : drawingMode === 'measure' ? 'قياس مسافة' : 'مسار'})`,
                data: { type: 'FeatureCollection', features: [newFeature] },
                color: ['#06D6F2', '#F5A623', '#10D9A0', '#8B5CF6', '#EC4899'][prev.length % 5],
                measurement: metricText
            }]);
        }
        setDraftCoordinates([]);
        setDrawingMode(null);
    };

    const handleMapClick = (e) => {
        if (drawingMode) {
            const coord = [e.lngLat.lng, e.lngLat.lat];
            
            if (drawingMode === 'point') {
                const newFeature = { type: 'Feature', geometry: { type: 'Point', coordinates: coord }, properties: { type: 'drawn_point', name: 'نقطة محددة' } };
                setGeoLayers(prev => [...prev, {
                    id: Date.now().toString(),
                    name: 'رسم (نقطة)',
                    data: { type: 'FeatureCollection', features: [newFeature] },
                    color: ['#06D6F2', '#F5A623', '#10D9A0', '#8B5CF6', '#EC4899'][prev.length % 5]
                }]);
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

        if (file.type.startsWith('image/')) {
            const imageUrl = URL.createObjectURL(file);
            if (mapRef.current) {
                const map = mapRef.current.getMap();
                const bounds = map.getBounds();
                const sw = bounds.getSouthWest();
                const ne = bounds.getNorthEast();
                const latDiff = ne.lat - sw.lat;
                const lngDiff = ne.lng - sw.lng;
                
                // Coordinates: [top-left, top-right, bottom-right, bottom-left]
                const tl = [sw.lng + lngDiff*0.2, ne.lat - latDiff*0.2];
                const tr = [ne.lng - lngDiff*0.2, ne.lat - latDiff*0.2];
                const br = [ne.lng - lngDiff*0.2, sw.lat + latDiff*0.2];
                const bl = [sw.lng + lngDiff*0.2, sw.lat + latDiff*0.2];

                const newLayer = {
                    id: Date.now().toString(),
                    name: file.name,
                    type: 'raster',
                    url: imageUrl,
                    coordinates: [tl, tr, br, bl],
                    color: '#06D6F2',
                    data: { type: 'FeatureCollection', features: [] }
                };
                setGeoLayers(prev => [...prev, newLayer]);
            }
            return;
        }

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

    useEffect(() => {
        console.log("PalNovaa Lab Component Mounted - Version 3.0");
        alert("PalNovaa Studio v3.0 Ready 🚀"); 
    }, []);

    const launchDesignStudioFinal = () => {
        console.log("FORCE LAUNCH: Design Studio");
        setIsDesignStudioOpen(true);
    };

    const performActualExport = async () => {
        const map = mapRef.current?.getMap();
        if (!map) return;
        const center = map.getCenter();
        const zoom = map.getZoom();
        const pitch = map.getPitch();
        const bearing = map.getBearing();

        // 1. Prepare Layers
        const exportLayers = [];
        for (const layer of geoLayers) {
            let data = layer.data;
            let url = layer.url;
            if (layer.type === 'raster' && url && url.startsWith('blob:')) {
                try {
                    const res = await fetch(url);
                    const blob = await res.blob();
                    const base64 = await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result);
                        reader.readAsDataURL(blob);
                    });
                    url = base64;
                } catch (e) { console.error(e); }
            }
            exportLayers.push({
                id: layer.id, name: layer.name, type: layer.type || 'vector',
                data: data, url: url, coordinates: layer.coordinates, color: layer.color
            });
        }

        // 2. Map Selections to Themes
        const palettes = {
            classic: { primary: '#F5A623', bg: '#0A1628', accent: '#D88B0E' },
            ocean: { primary: '#06D6F2', bg: '#050B16', accent: '#1A2980' },
            heritage: { primary: '#CE1126', bg: '#000000', accent: '#007A3D' },
            forest: { primary: '#10D9A0', bg: '#064E3B', accent: '#059669' }
        };
        const theme = palettes[designSelections.palette] || palettes.classic;

        const fonts = {
            cairo: "'Cairo', sans-serif",
            tajawal: "'Tajawal', sans-serif",
            mono: "'JetBrains Mono', monospace"
        };
        const selectedFontFamily = fonts[designSelections.font] || fonts.cairo;

        // 3. Generate HTML Template
        const htmlTemplate = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PalNovaa Web Map</title>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&family=Tajawal:wght@300;500;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
    <link href="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.css" rel="stylesheet" />
    <script src="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.js"></script>
    <style>
        :root {
            --primary: ${theme.primary};
            --bg: ${theme.bg};
            --accent: ${theme.accent};
            --font: ${selectedFontFamily};
        }
        body { margin: 0; padding: 0; font-family: var(--font); background: var(--bg); color: white; overflow: hidden; }
        
        .app-container { display: flex; height: 100vh; width: 100vw; position: relative; }
        
        #map { flex: 1; position: relative; }
        
        ${designSelections.layout === 'sidebar' ? `
        .sidebar { width: 320px; background: rgba(10, 22, 40, 0.95); border-left: 1px solid rgba(255,255,255,0.1); backdrop-filter: blur(15px); padding: 20px; display: flex; flex-direction: column; z-index: 10; }
        .sidebar-header { border-bottom: 1px solid var(--primary); padding-bottom: 15px; margin-bottom: 20px; }
        .sidebar-header h2 { margin: 0; color: var(--primary); font-size: 1.4rem; }
        .layer-item { background: rgba(255,255,255,0.03); border-radius: 8px; padding: 12px; margin-bottom: 10px; border: 1px solid rgba(255,255,255,0.05); }
        ` : `
        .floating-panel { position: absolute; top: 20px; right: 20px; width: 280px; background: rgba(10, 22, 40, 0.9); backdrop-filter: blur(10px); border-radius: 12px; border: 1px solid var(--primary); padding: 15px; z-index: 100; box-shadow: 0 8px 32px rgba(0,0,0,0.5); }
        `}

        .watermark { 
            position: absolute; bottom: 25px; left: 10px; 
            background: rgba(10, 22, 40, 0.6); color: rgba(255,255,255,0.7); 
            padding: 5px 12px; border-radius: 6px; z-index: 10; 
            font-size: 11px; backdrop-filter: blur(4px); border: 1px solid rgba(255,255,255,0.1);
            pointer-events: none; letter-spacing: 0.5px;
        }
        .maplibregl-popup-content { background: rgba(10, 22, 40, 0.95); color: #fff; border: 1px solid var(--primary); border-radius: 8px; font-family: var(--font); }
        .maplibregl-popup-anchor-bottom .maplibregl-popup-tip { border-top-color: var(--primary); }
    </style>
</head>
<body>
    <div class="app-container">
        ${designSelections.layout === 'sidebar' ? `
        <aside class="sidebar">
            <div class="sidebar-header">
                <h2>خريطة PalNovaa</h2>
            </div>
            <div class="layers-list">
                \${layers.map(l => \`<div class="layer-item"><div style="display:flex;align-items:center;gap:10px;"><div style="width:12px;height:12px;border-radius:50%;background:\${l.color}"></div><span>\${l.name}</span></div></div>\`).join('')}
            </div>
        </aside>
        ` : `
        <div class="floating-panel">
            <h3 style="margin:0 0 10px 0; color:var(--primary);">الطبقات المتاحة</h3>
            <div style="font-size: 0.9rem; opacity: 0.8;">تم استيراد \${layers.length} طبقات مكانيّة.</div>
        </div>
        `}
        <div id="map"></div>
        <div class="watermark">Powered by <b>PalNovaa Lab</b></div>
    </div>

    <script>
        const layers = ${JSON.stringify(exportLayers)};
        const mapStyle = ${JSON.stringify(mapStyle)};
        const map = new maplibregl.Map({
            container: 'map',
            style: mapStyle,
            center: [${center.lng}, ${center.lat}],
            zoom: ${zoom},
            pitch: ${pitch},
            bearing: ${bearing}
        });

        map.addControl(new maplibregl.NavigationControl(), 'bottom-right');

        map.on('load', () => {
            layers.forEach(layer => {
                if (layer.type === 'raster') {
                    map.addSource('src-' + layer.id, { type: 'image', url: layer.url, coordinates: layer.coordinates });
                    map.addLayer({ id: 'raster-' + layer.id, type: 'raster', source: 'src-' + layer.id, paint: { 'raster-opacity': 0.8 } });
                } else {
                    map.addSource('src-' + layer.id, { type: 'geojson', data: layer.data });
                    map.addLayer({ id: 'poly-' + layer.id, type: 'fill', source: 'src-' + layer.id, filter: ['==', '$type', 'Polygon'], paint: { 'fill-color': layer.color, 'fill-opacity': 0.4, 'fill-outline-color': layer.color } });
                    map.addLayer({ id: 'line-' + layer.id, type: 'line', source: 'src-' + layer.id, filter: ['==', '$type', 'LineString'], paint: { 'line-color': layer.color, 'line-width': 3 } });
                    map.addLayer({ id: 'point-' + layer.id, type: 'circle', source: 'src-' + layer.id, filter: ['==', '$type', 'Point'], paint: { 'circle-radius': 6, 'circle-color': layer.color, 'circle-stroke-width': 2, 'circle-stroke-color': '#0A1628' } });

                    const layerIds = ['poly-' + layer.id, 'line-' + layer.id, 'point-' + layer.id];
                    layerIds.forEach(lId => {
                        map.on('click', lId, (e) => {
                            if (!e.features.length) return;
                            let props = e.features[0].properties;
                            let html = '<div style="direction: rtl; text-align: right; max-height: 250px; overflow-y: auto; padding-right: 5px;">';
                            html += '<h4 style="margin: 0 0 10px 0; color: var(--primary); border-bottom: 1px solid rgba(245, 166, 35, 0.3); padding-bottom: 5px;">البيانات</h4>';
                            for (let key in props) {
                                html += '<div style="margin-bottom: 8px; font-size: 0.9rem;"><strong>' + key + ':</strong> ' + props[key] + '</div>';
                            }
                            html += '</div>';
                            new maplibregl.Popup().setLngLat(e.lngLat).setHTML(html).addTo(map);
                        });
                        map.on('mouseenter', lId, () => { map.getCanvas().style.cursor = 'pointer'; });
                        map.on('mouseleave', lId, () => { map.getCanvas().style.cursor = ''; });
                    });
                }
            });
        });
    </script>
</body>
</html>`;

        const blob = new Blob([htmlTemplate], { type: 'text/html' });
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `PalNovaa_${designSelections.layout}_${Date.now()}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
        setIsDesignStudioOpen(false);
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
                        <button 
                            key="btn-design-studio-v3"
                            className="tool studio-trigger-btn" 
                            data-tip="تصدير الخريطة كتصميم ويب" 
                            onClick={launchDesignStudioFinal} 
                            style={{ color: '#10D9A0', border: '1px solid #10D9A0' }}
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        </button>
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
                            
                            {geoLayers.map(layer => {
                                if (layer.type === 'raster') {
                                    return (
                                        <Source key={layer.id} id={`src-${layer.id}`} type="image" url={layer.url} coordinates={layer.coordinates}>
                                            <Layer
                                                id={`raster-${layer.id}`}
                                                type="raster"
                                                paint={{ 'raster-opacity': 0.8 }}
                                            />
                                        </Source>
                                    );
                                }
                                return (
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
                                );
                            })}

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
                                        <span>استيراد بيانات أو صور</span>
                                    </div>
                                    <label className="upload-zone" style={{ display: 'block' }}>
                                        <input type="file" accept=".json,.geojson,image/*" onChange={handleFileUpload} style={{ display: 'none' }} />
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
                                            <span className="format-pill">.png/.jpg</span>
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
                                                        {layer.measurement && <small style={{ color: '#06D6F2', display: 'block', marginTop: '2px', fontWeight: 'bold' }}>القياس: {layer.measurement}</small>}
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
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        <span>{new Date().toLocaleTimeString()}</span>
                    </div>
                </footer>
            </div>

            <div className={`design-studio ${isDesignStudioOpen ? 'active' : ''}`} id="designStudio">
                <header className="ds-header">
                    <div className="ds-brand">
                        <div className="ds-brand-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="13.5" cy="6.5" r="2.5" fill="currentColor"/>
                                <circle cx="19" cy="11" r="1.5" fill="currentColor"/>
                                <circle cx="6.5" cy="9" r="2" fill="currentColor"/>
                                <circle cx="5" cy="15" r="1.5" fill="currentColor"/>
                                <path d="M12 22a10 10 0 0 1 0-20c5.5 0 10 4 10 9 0 3-2.5 5-5.5 5h-2a1.5 1.5 0 0 0 0 3c0 1.5-1 3-2.5 3z"/>
                            </svg>
                        </div>
                        <div className="ds-brand-text">
                            <strong>PalNovaa WebApp Design</strong>
                            <small>DESIGN STUDIO v2.0</small>
                        </div>
                    </div>
                    <div className="ds-header-actions">
                        <button className="ds-btn primary" onClick={performActualExport}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            حفظ وتصدير
                        </button>
                        <button className="ds-close" onClick={() => setIsDesignStudioOpen(false)}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>
                </header>

                <div className="ds-body">
                    <aside className="ds-categories">
                        <div className="ds-cat-title">تخصيص الهيكل</div>
                        {[
                            { id: 'layouts', name: 'التخطيط العام', icon: 'M3 3h18v18H3z M3 9h18 M9 9v12', num: 6 },
                            { id: 'palettes', name: 'باليت الألوان', icon: 'M12 22a10 10 0 1 1 0-20c5.5 0 10 4 10 9 0 3-2.5 5-5.5 5h-2a1.5 1.5 0 0 0 0 3c0 1.5-1 3-2.5 3z', num: 4 },
                            { id: 'typography', name: 'الخطوط والطباعة', icon: 'M4 7V4h16v3 M9 20h6 M12 4v16', num: 3 },
                        ].map(cat => (
                            <div key={cat.id} className={`ds-cat ${activeDsCategory === cat.id ? 'active' : ''}`} onClick={() => setActiveDsCategory(cat.id)}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d={cat.icon}/></svg>
                                <span>{cat.name}</span>
                                <span className="ds-cat-num">{cat.num}</span>
                            </div>
                        ))}

                        <div className="ds-cat-title" style={{ marginTop: '20px' }}>العناصر المرئية</div>
                        {[
                            { id: 'basemaps', name: 'خرائط الأساس', icon: 'M1 6l7-4 8 4 7-4v16l-7 4-8-4-7 4V6z M8 2v16 M16 6v16', num: 6 },
                            { id: 'markers', name: 'أنماط المؤشرات', icon: 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z', num: 5 },
                            { id: 'components', name: 'نمط العناصر', icon: 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z', num: 4 },
                            { id: 'effects', name: 'المؤثرات والظلال', icon: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5', num: 6 },
                        ].map(cat => (
                            <div key={cat.id} className={`ds-cat ${activeDsCategory === cat.id ? 'active' : ''}`} onClick={() => setActiveDsCategory(cat.id)}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d={cat.icon}/></svg>
                                <span>{cat.name}</span>
                                <span className="ds-cat-num">{cat.num}</span>
                            </div>
                        ))}
                    </aside>

                    <main className="ds-main">
                        {activeDsCategory === 'layouts' && (
                            <div className="ds-section active">
                                <div className="ds-section-head">
                                    <h2>تخطيط التطبيق <span className="ds-tag">Layout</span></h2>
                                    <p>اختر الهيكل التنظيمي لواجهة المستخدم وتوزيع العناصر الجغرافية.</p>
                                </div>
                                <div className="ds-grid">
                                    {[
                                        { id: 'fullmap', name: 'خريطة كاملة', sub: 'تركيز مطلق على البيانات', class: 'lm-fullmap' },
                                        { id: 'sidebar', name: 'لوحة جانبية', sub: 'لإدارة الطبقات والبيانات', class: 'lm-sidebar' },
                                        { id: 'split', name: 'تقسيم ثنائي', sub: 'عرض متوازي للبيانات', class: 'lm-split' },
                                        { id: 'dashboard', name: 'لوحة تحكم', sub: 'إحصائيات وخرائط معاً', class: 'lm-dashboard' }
                                    ].map(item => (
                                        <div key={item.id} className={`ds-pick ${designSelections.layout === item.id ? 'selected' : ''}`} onClick={() => setDesignSelections(s => ({...s, layout: item.id}))}>
                                            <div className={`layout-mockup ${item.class}`}>
                                                <div className="lm-block map"></div>
                                                {item.id === 'sidebar' && <div className="lm-block"></div>}
                                                {item.id === 'split' && <div className="lm-block alt"></div>}
                                                {item.id === 'dashboard' && <div className="lm-block muted"></div>}
                                            </div>
                                            <div className="ds-pick-title">{item.name}</div>
                                            <div className="ds-pick-sub">{item.sub}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeDsCategory === 'palettes' && (
                            <div className="ds-section active">
                                <div className="ds-section-head">
                                    <h2>باليت الألوان <span className="ds-tag">Themes</span></h2>
                                    <p>اختر الهوية البصرية وتناسق الألوان العام للتطبيق.</p>
                                </div>
                                <div className="ds-grid">
                                    {[
                                        { id: 'classic', name: 'كلاسيك ذهبي', sub: 'هوية بال نوفا الرسمية', colors: ['#F5A623', '#0A1628', '#142B47'] },
                                        { id: 'ocean', name: 'أوشن بلو', sub: 'لمسة تقنية باردة', colors: ['#06D6F2', '#0A1628', '#1e293b'] },
                                        { id: 'heritage', name: 'تراثي', sub: 'ألوان دافئة وعميقة', colors: ['#E4D5B7', '#1A2614', '#2C3E50'] },
                                        { id: 'forest', name: 'غابة', sub: 'طبيعي ومريح للعين', colors: ['#10D9A0', '#050B16', '#1A2614'] }
                                    ].map(item => (
                                        <div key={item.id} className={`ds-pick ${designSelections.palette === item.id ? 'selected' : ''}`} onClick={() => setDesignSelections(s => ({...s, palette: item.id}))}>
                                            <div className="palette-strip">
                                                {item.colors.map((c, i) => <span key={i} style={{background: c}}></span>)}
                                            </div>
                                            <div className="ds-pick-title">{item.name}</div>
                                            <div className="ds-pick-sub">{item.sub}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeDsCategory === 'typography' && (
                            <div className="ds-section active">
                                <div className="ds-section-head">
                                    <h2>الخطوط والطباعة <span className="ds-tag">Typography</span></h2>
                                    <p>اختر نوع الخط المستخدم في العناوين والبيانات الوصفية.</p>
                                </div>
                                <div className="ds-grid">
                                    {[
                                        { id: 'tajawal', name: 'Tajawal', sub: 'عصري وواضح جداً', family: "'Tajawal', sans-serif" },
                                        { id: 'cairo', name: 'Cairo', sub: 'خط هندسي متناسق', family: "'Cairo', sans-serif" },
                                        { id: 'mono', name: 'JetBrains Mono', sub: 'لعرض البيانات التقنية', family: "'JetBrains Mono', monospace" }
                                    ].map(item => (
                                        <div key={item.id} className={`ds-pick ${designSelections.font === item.id ? 'selected' : ''}`} onClick={() => setDesignSelections(s => ({...s, font: item.id}))}>
                                            <div className="type-preview" style={{ fontFamily: item.family }}>
                                                <div className="t-title">نظام بال نوفا</div>
                                                <div className="t-body">أبجد هوز حطي كلمن سعفص قرشت ثخذ ضظغ</div>
                                            </div>
                                            <div className="ds-pick-title">{item.name}</div>
                                            <div className="ds-pick-sub">{item.sub}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeDsCategory === 'basemaps' && (
                            <div className="ds-section active">
                                <div className="ds-section-head">
                                    <h2>خرائط الأساس <span className="ds-tag">Basemaps</span></h2>
                                    <p>اختر نمط الخريطة الجغرافية الافتراضي.</p>
                                </div>
                                <div className="ds-grid">
                                    {[
                                        { id: 'dark', name: 'الوضع الداكن', class: 'bm-dark' },
                                        { id: 'light', name: 'الوضع الفاتح', class: 'bm-light' },
                                        { id: 'satellite', name: 'قمر صناعي', class: 'bm-satellite' },
                                        { id: 'terrain', name: 'تضاريس', class: 'bm-terrain' },
                                        { id: 'cyber', name: 'سايبر بانك', class: 'bm-cyber' }
                                    ].map(item => (
                                        <div key={item.id} className={`ds-pick ${designSelections.basemap === item.id ? 'selected' : ''}`} onClick={() => setDesignSelections(s => ({...s, basemap: item.id}))}>
                                            <div className={`basemap-preview ${item.class}`}></div>
                                            <div className="ds-pick-title">{item.name}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeDsCategory === 'markers' && (
                            <div className="ds-section active">
                                <div className="ds-section-head">
                                    <h2>أنماط المؤشرات <span className="ds-tag">Markers</span></h2>
                                    <p>اختر شكل تمثيل النقاط والمعالم على الخريطة.</p>
                                </div>
                                <div className="ds-grid">
                                    {[
                                        { id: 'pin', name: 'دبوس كلاسيكي', class: 'mk-pin' },
                                        { id: 'dot', name: 'نقطة متوهجة', class: 'mk-dot' },
                                        { id: 'pulse', name: 'نبض راداري', class: 'mk-pulse' },
                                        { id: 'cluster', name: 'تجميع ذكي', class: 'mk-cluster' }
                                    ].map(item => (
                                        <div key={item.id} className={`ds-pick ${designSelections.marker === item.id ? 'selected' : ''}`} onClick={() => setDesignSelections(s => ({...s, marker: item.id}))}>
                                            <div className="marker-preview">
                                                <div className={item.class}>{item.id === 'cluster' ? '24' : ''}</div>
                                            </div>
                                            <div className="ds-pick-title">{item.name}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeDsCategory === 'effects' && (
                            <div className="ds-section active">
                                <div className="ds-section-head">
                                    <h2>المؤثرات والظلال <span className="ds-tag">Effects</span></h2>
                                    <p>أضف لمسة جمالية على عناصر الواجهة.</p>
                                </div>
                                <div className="ds-grid">
                                    {[
                                        { id: 'glow', name: 'توهج نيون', class: 'ef-glow' },
                                        { id: 'glass', name: 'زجاجي (Glass)', class: 'ef-glass' },
                                        { id: 'float', name: 'عائم (Float)', class: 'ef-anim-float' },
                                        { id: 'pulse', name: 'نبض تفاعلي', class: 'ef-anim-pulse' }
                                    ].map(item => (
                                        <div key={item.id} className={`ds-pick ${designSelections.effect === item.id ? 'selected' : ''}`} onClick={() => setDesignSelections(s => ({...s, effect: item.id}))}>
                                            <div className={`effect-preview ${item.class}`}>
                                                <div className="effect-box"></div>
                                            </div>
                                            <div className="ds-pick-title">{item.name}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </main>

                    <aside className="ds-preview">
                        <div className="ds-preview-head">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                            المعاينة المباشرة
                        </div>
                        <div className="preview-mock">
                            <div className="preview-mock-content">
                                <div className="pmc-header"></div>
                                <div className="pmc-map"></div>
                                <div className="pmc-bar"></div>
                            </div>
                        </div>
                        <div className="preview-info">
                            <div className="preview-info-row"><span className="pi-label">التخطيط المختارة</span><span className="pi-value">{designSelections.layout}</span></div>
                            <div className="preview-info-row"><span className="pi-label">باليت الألوان</span><span className="pi-value">{designSelections.palette}</span></div>
                            <div className="preview-info-row"><span className="pi-label">نوع الخط</span><span className="pi-value">{designSelections.font}</span></div>
                            <div className="preview-info-row"><span className="pi-label">خريطة الأساس</span><span className="pi-value">{designSelections.basemap}</span></div>
                            <div className="preview-info-row" style={{ border: 'none' }}><span className="pi-label">النمط العام</span><span className="pi-value">{designSelections.effect}</span></div>
                        </div>
                        <div style={{ marginTop: '20px' }}>
                            <button className="ds-btn primary" style={{ width: '100%', justifyContent: 'center' }} onClick={performActualExport}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                حفظ وتحميل التطبيق
                            </button>
                        </div>
                    </aside>
                </div>
            </div>
        </div>
    );
};

export default PalNovaaLab;
