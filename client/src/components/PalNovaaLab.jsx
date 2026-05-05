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
        font: 'cairo_tajawal',
        basemap: 'satellite',
        marker: 'pin',
        component: 'pill',
        effect: 'glow'
    });
    const [pageElements, setPageElements] = useState([]);
    const [selectedElId, setSelectedElId] = useState(null);

    // Palette Mapping for Live Preview
    const paletteData = {
        classic: { primary: '#F5A623', primaryDark: '#D88B0E', bg: '#0F1E33', surface: '#142B47' },
        heritage: { primary: '#CE1126', primaryDark: '#007A3D', bg: '#000000', surface: '#1A1A1A' },
        ocean: { primary: '#06D6F2', primaryDark: '#1A2980', bg: '#0A1628', surface: '#142B47' },
        sunset: { primary: '#FF6B6B', primaryDark: '#F5A623', bg: '#1A0E1F', surface: '#2D1B36' },
        forest: { primary: '#10D9A0', primaryDark: '#059669', bg: '#064E3B', surface: '#0D6E55' },
        earth: { primary: '#D4C49B', primaryDark: '#A0826D', bg: '#2C1810', surface: '#3D2B1F' },
        neon: { primary: '#EC4899', primaryDark: '#8B5CF6', bg: '#050B16', surface: '#0D1526' },
        minimal: { primary: '#1A1A2E', primaryDark: '#4B5563', bg: '#F5F4ED', surface: '#FFFFFF' }
    };

    const fontData = {
        cairo_tajawal: "'Cairo', sans-serif",
        tajawal_inter: "'Tajawal', sans-serif",
        cairo_mono: "'JetBrains Mono', monospace",
        tajawal_ed: "'Tajawal', serif",
        display: "'Cairo', sans-serif",
        compact: "'Tajawal', sans-serif"
    };

    const dynamicStyles = useMemo(() => {
        const p = paletteData[designSelections.palette] || paletteData.classic;
        const f = fontData[designSelections.font] || fontData.cairo_tajawal;
        return {
            '--primary': p.primary,
            '--primary-dark': p.primaryDark,
            '--primary-glow': `${p.primary}44`,
            '--bg-2': p.bg,
            '--bg-3': p.surface,
            '--font-main': f
        };
    }, [designSelections]);

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
        console.log("PalNovaa Lab Component Mounted - Version 3.5");
    }, []);

    const launchDesignStudioFinal = () => {
        console.log("FORCE LAUNCH: Design Studio");
        setIsDesignStudioOpen(true);
    };

    const performActualExport = async () => {
        const map = mapRef.current?.getMap();
        const center = map ? map.getCenter() : { lng: mapState.longitude, lat: mapState.latitude };
        const zoom = map ? map.getZoom() : mapState.zoom;
        const pitch = map ? map.getPitch() : mapState.pitch;
        const bearing = map ? map.getBearing() : mapState.bearing;

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
        const palettesData = {
            classic: { primary: '#F5A623', primaryDark: '#D88B0E', bg: '#0A1628', surface: 'rgba(20, 43, 71, 0.7)', surfaceSolid: '#142B47', border: 'rgba(255,255,255,0.08)', text: '#FFFFFF', primaryGlow: 'rgba(245, 166, 35, 0.3)' },
            heritage: { primary: '#CE1126', primaryDark: '#A00010', bg: '#000000', surface: 'rgba(20, 20, 20, 0.8)', surfaceSolid: '#111111', border: 'rgba(0,122,61,0.3)', text: '#FFFFFF', primaryGlow: 'rgba(206, 17, 38, 0.3)' },
            ocean: { primary: '#06D6F2', primaryDark: '#04A0B5', bg: '#050B16', surface: 'rgba(26, 41, 128, 0.4)', surfaceSolid: '#1A2980', border: 'rgba(6, 214, 242, 0.2)', text: '#F0F8FF', primaryGlow: 'rgba(6, 214, 242, 0.3)' },
            sunset: { primary: '#F5A623', primaryDark: '#FF6B6B', bg: '#1A0E1F', surface: 'rgba(139, 92, 246, 0.3)', surfaceSolid: '#3B1E4A', border: 'rgba(245, 166, 35, 0.2)', text: '#FFFFFF', primaryGlow: 'rgba(245, 166, 35, 0.3)' },
            forest: { primary: '#10D9A0', primaryDark: '#059669', bg: '#022C22', surface: 'rgba(6, 78, 59, 0.6)', surfaceSolid: '#064E3B', border: 'rgba(16, 217, 160, 0.2)', text: '#F5F4ED', primaryGlow: 'rgba(16, 217, 160, 0.3)' },
            earth: { primary: '#D4C49B', primaryDark: '#A0826D', bg: '#2C1810', surface: 'rgba(92, 64, 51, 0.6)', surfaceSolid: '#5C4033', border: 'rgba(212, 196, 155, 0.2)', text: '#F5F4ED', primaryGlow: 'rgba(212, 196, 155, 0.3)' },
            neon: { primary: '#06D6F2', primaryDark: '#EC4899', bg: '#050B16', surface: 'rgba(139, 92, 246, 0.3)', surfaceSolid: '#14002E', border: 'rgba(236, 72, 153, 0.3)', text: '#FFFFFF', primaryGlow: 'rgba(6, 214, 242, 0.4)' },
            minimal: { primary: '#F5A623', primaryDark: '#D88B0E', bg: '#FFFFFF', surface: 'rgba(245, 244, 237, 0.9)', surfaceSolid: '#F5F4ED', border: 'rgba(0,0,0,0.1)', text: '#1A1A2E', primaryGlow: 'rgba(245, 166, 35, 0.3)' }
        };
        const theme = palettesData[designSelections.palette] || palettesData.classic;

        const fontsData = {
            cairo_tajawal: { h: "'Cairo', sans-serif", b: "'Tajawal', sans-serif" },
            tajawal_inter: { h: "'Tajawal', sans-serif", b: "system-ui, sans-serif" },
            cairo_mono: { h: "'Cairo', sans-serif", b: "'JetBrains Mono', monospace" },
            tajawal_ed: { h: "'Tajawal', serif", b: "'Tajawal', sans-serif" },
            display: { h: "'Cairo', sans-serif", b: "'Tajawal', sans-serif" },
            compact: { h: "'Cairo', sans-serif", b: "'Tajawal', sans-serif" }
        };
        const selectedFont = fontsData[designSelections.font] || fontsData.cairo_tajawal;

        const bm = designSelections.basemap;
        const bmTiles = {
            dark:      'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
            light:     'https://mt1.google.com/vt/lyrs=r&x={x}&y={y}&z={z}',
            satellite: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
            terrain:   'https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
            vintage:   'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
            cyber:     'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}'
        };
        const chosenTile = bmTiles[bm] || bmTiles.satellite;
        const targetBasemapStyleObj = {
            version: 8,
            sources: { 'base-tiles': { type: 'raster', tiles: [chosenTile], tileSize: 256 } },
            layers: [{ id: 'base-layer', type: 'raster', source: 'base-tiles', minzoom: 0, maxzoom: 22 }]
        };


        let effectCSS = '';
        if(designSelections.effect === 'glow') effectCSS = '.card-panel { box-shadow: 0 0 30px var(--primary-glow) !important; border-color: var(--primary) !important; }';
        else if(designSelections.effect === 'glass') effectCSS = '.card-panel { background: rgba(0,0,0,0.2) !important; backdrop-filter: blur(24px) !important; border: 1px solid rgba(255,255,255,0.2) !important; }';
        else if(designSelections.effect === 'shadow_lg') effectCSS = '.card-panel { box-shadow: 0 20px 50px rgba(0,0,0,0.5) !important; }';

        const layersHTML = exportLayers.map(l => `<div class="layer-item"><div style="display:flex;align-items:center;gap:10px;"><div style="width:14px;height:14px;border-radius:4px;background:${l.color}"></div><span>${l.name}</span></div></div>`).join('');

        let layoutCSS = '';
        let layoutHTML = '';

        switch (designSelections.layout) {
            case 'sidebar':
                layoutCSS = `
                    .app-container { display: flex; height: 100vh; width: 100vw; }
                    .sidebar { width: 340px; background: var(--surface-solid); border-left: 1px solid var(--border); padding: 24px; display: flex; flex-direction: column; overflow-y: auto; z-index: 10; }
                    #map { flex: 1; }
                `;
                layoutHTML = `
                    <aside class="sidebar card-panel">
                        <h2 style="color:var(--primary);margin-top:0;font-family:var(--font-h);">الطبقات المتاحة</h2>
                        <div class="layers-list">${layersHTML}</div>
                    </aside>
                    <div id="map"></div>
                `;
                break;
            case 'split':
                layoutCSS = `
                    .app-container { display: flex; height: 100vh; width: 100vw; }
                    .side-content { flex: 1; background: var(--bg); padding: 40px; display: flex; flex-direction: column; justify-content: center; z-index: 10; }
                    #map { flex: 1; border-right: 1px solid var(--border); }
                `;
                layoutHTML = `
                    <div class="side-content card-panel">
                        <h1 style="color:var(--primary);font-size:3rem;margin-bottom:10px;font-family:var(--font-h);">نظرة مكانية</h1>
                        <p style="opacity:0.8;font-size:1.2rem;line-height:1.8;">استكشف البيانات الجغرافية بدقة من خلال هذه الخريطة التفاعلية المصممة خصيصاً لاحتياجاتك.</p>
                        <div style="margin-top:40px;">${layersHTML}</div>
                    </div>
                    <div id="map"></div>
                `;
                break;
            case 'dashboard':
                layoutCSS = `
                    .app-container { display: flex; flex-direction: column; height: 100vh; width: 100vw; background: var(--bg); }
                    .dash-header { height: 70px; background: var(--surface-solid); border-bottom: 1px solid var(--border); display: flex; align-items: center; padding: 0 24px; z-index: 10; }
                    .dash-body { flex: 1; display: flex; flex-direction: column; padding: 20px; gap: 20px; }
                    #map { flex: 1; border-radius: 16px; border: 1px solid var(--border); overflow: hidden; }
                    .dash-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; height: 120px; }
                    .stat-card { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 20px; display: flex; flex-direction: column; justify-content: center; align-items: center; }
                    .stat-num { font-size: 2rem; font-weight: 800; color: var(--primary); font-family:var(--font-h); }
                    .stat-label { font-size: 1rem; opacity: 0.7; }
                `;
                layoutHTML = `
                    <header class="dash-header card-panel">
                        <h2 style="margin:0;color:var(--primary);font-family:var(--font-h);">لوحة القيادة المكانية</h2>
                    </header>
                    <div class="dash-body">
                        <div id="map"></div>
                        <div class="dash-stats">
                            <div class="stat-card card-panel"><div class="stat-num">${exportLayers.length}</div><div class="stat-label">إجمالي الطبقات</div></div>
                            <div class="stat-card card-panel"><div class="stat-num">${exportLayers.reduce((sum, l) => sum + (l.data?.features?.length || 0), 0)}</div><div class="stat-label">المعالم الجغرافية</div></div>
                            <div class="stat-card card-panel"><div class="stat-num">100%</div><div class="stat-label">دقة البيانات</div></div>
                            <div class="stat-card card-panel"><div class="stat-num">نشط</div><div class="stat-label">حالة النظام</div></div>
                        </div>
                    </div>
                `;
                break;
            case 'modal':
                layoutCSS = `
                    .app-container { display: flex; height: 100vh; width: 100vw; background: var(--bg); justify-content: center; align-items: center; padding: 40px; }
                    .modal-wrapper { width: 100%; max-width: 1200px; height: 80vh; background: var(--surface-solid); border-radius: 24px; border: 1px solid var(--border); overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 30px 80px rgba(0,0,0,0.6); }
                    .modal-header { padding: 20px 30px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; background: var(--surface); }
                    #map { flex: 1; }
                `;
                layoutHTML = `
                    <div class="modal-wrapper card-panel">
                        <div class="modal-header">
                            <h2 style="margin:0;color:var(--primary);font-family:var(--font-h);">عارض الخريطة</h2>
                            <div style="display:flex;gap:10px;">${exportLayers.slice(0,3).map(l => `<span style="background:var(--bg);padding:5px 12px;border-radius:20px;font-size:0.8rem;border:1px solid ${l.color}">${l.name}</span>`).join('')}</div>
                        </div>
                        <div id="map"></div>
                    </div>
                `;
                break;
            case 'floating':
                layoutCSS = `
                    .app-container { display: flex; height: 100vh; width: 100vw; }
                    #map { flex: 1; }
                    .f-card { position: absolute; background: var(--surface); border: 1px solid var(--border); border-radius: 16px; backdrop-filter: blur(15px); padding: 24px; z-index: 10; box-shadow: 0 15px 35px rgba(0,0,0,0.3); }
                    .f-top-right { top: 30px; right: 30px; width: 340px; }
                    .f-bottom-left { bottom: 40px; left: 30px; width: 400px; }
                `;
                layoutHTML = `
                    <div id="map"></div>
                    <div class="f-card f-top-right card-panel">
                        <h2 style="margin-top:0;color:var(--primary);font-family:var(--font-h);">الطبقات النشطة</h2>
                        <div class="layers-list">${layersHTML}</div>
                    </div>
                    <div class="f-card f-bottom-left card-panel">
                        <h3 style="margin-top:0;font-family:var(--font-h);">إحصائيات الخريطة</h3>
                        <p style="opacity:0.8;font-size:1rem;line-height:1.6;">تم تحميل <b>${exportLayers.length}</b> طبقات بنجاح، تحتوي على <b>${exportLayers.reduce((sum, l) => sum + (l.data?.features?.length || 0), 0)}</b> معلم جغرافي تفاعلي.</p>
                        <button class="${designSelections.component || 'primary'}-btn" style="width:100%;padding:14px;background:var(--primary);color:#000;border:none;border-radius:10px;font-weight:bold;font-size:1rem;cursor:pointer;margin-top:16px;">عرض التفاصيل</button>
                    </div>
                `;
                break;
            default: // fullmap
                layoutCSS = `
                    .app-container { display: flex; height: 100vh; width: 100vw; }
                    #map { flex: 1; }
                    .floating-panel { position: absolute; top: 24px; right: 24px; width: 320px; background: var(--surface); border-radius: 16px; border: 1px solid var(--border); padding: 24px; z-index: 10; backdrop-filter: blur(15px); }
                `;
                layoutHTML = `
                    <div class="floating-panel card-panel">
                        <h2 style="color:var(--primary);margin-top:0;font-family:var(--font-h);">الطبقات</h2>
                        <div class="layers-list">${layersHTML}</div>
                    </div>
                    <div id="map"></div>
                `;
                break;
        }

        // 3. Build custom elements overlay
        const customElsCSS = pageElements.length > 0 ? `
        .custom-overlay { position: absolute; inset: 0; pointer-events: none; z-index: 5; }
        .custom-overlay > * { pointer-events: auto; }
        .cel { position: absolute; box-sizing: border-box; }
        .cel-heading { color: var(--primary); font-family: var(--font-h); font-weight: 900; margin: 0; }
        .cel-sub { color: var(--text-color); font-family: var(--font-h); font-weight: 700; margin: 0; }
        .cel-para { color: var(--text-color); font-family: var(--font-b); opacity: 0.85; margin: 0; line-height: 1.6; }
        .cel-btn-p { background: var(--primary); color: #000; border: none; border-radius: 10px; padding: 12px 24px; font-weight: bold; cursor: pointer; font-family: var(--font-b); width: 100%; }
        .cel-btn-o { background: transparent; color: var(--primary); border: 2px solid var(--primary); border-radius: 10px; padding: 12px 24px; font-weight: bold; cursor: pointer; font-family: var(--font-b); width: 100%; }
        .cel-search-wrap { position: relative; width: 100%; }
        .cel-search { background: var(--surface); border: 1px solid var(--border); border-radius: 999px; padding: 10px 20px 10px 40px; color: var(--text-color); font-family: var(--font-b); width: 100%; box-sizing: border-box; outline: none; }
        .cel-search:focus { border-color: var(--primary); }
        .cel-search-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); opacity: 0.5; pointer-events: none; }
        .cel-search-results { position: absolute; top: 100%; left: 0; right: 0; background: var(--surface-solid); border: 1px solid var(--border); border-radius: 10px; margin-top: 4px; overflow: hidden; display: none; z-index: 20; }
        .cel-search-item { padding: 10px 16px; cursor: pointer; font-family: var(--font-b); font-size: 0.9rem; border-bottom: 1px solid var(--border); }
        .cel-search-item:hover { background: rgba(255,255,255,0.08); color: var(--primary); }
        .cel-layers-box { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 10px; }
        .cel-layer-row { display: flex; align-items: center; gap: 8px; padding: 6px 4px; font-family: var(--font-b); font-size: 0.88rem; border-bottom: 1px solid var(--border); cursor: pointer; }
        .cel-layer-row:last-child { border-bottom: none; }
        .cel-layer-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
        .cel-layer-row:hover { color: var(--primary); }
        .cel-stat { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 16px; text-align: center; }
        .cel-stat-num { color: var(--primary); font-weight: 800; font-family: var(--font-h); }
        .cel-stat-lbl { opacity: 0.7; font-size: 0.85rem; }
        .cel-hr { border: none; border-top: 1px solid var(--border); margin: 4px 0; }
        .cel-badge { background: var(--primary); color: #000; border-radius: 999px; padding: 4px 14px; font-weight: bold; display: inline-block; font-family: var(--font-b); }
        ` : '';

        const layersListHTML = exportLayers.map(l =>
            `<div class="cel-layer-row" onclick="map.fitBounds(${JSON.stringify(
                l.data?.features?.length > 0
                    ? (() => { try { const coords = l.data.features.flatMap(f => f.geometry?.type === 'Point' ? [f.geometry.coordinates] : f.geometry?.coordinates?.flat?.(5) || []); const lngs = coords.map(c=>c[0]); const lats = coords.map(c=>c[1]); return [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]]; } catch(e){ return null; } })()
                    : null
            )}, {padding:40})"><div class="cel-layer-dot" style="background:${l.color}"></div><span>${l.name}</span></div>`
        ).join('');

        const customElsHTML = pageElements.length > 0 ? `
        <div class="custom-overlay">
            ${pageElements.map(el => {
                const fs = el.fontSize ? `font-size:${el.fontSize}rem;` : '';
                const wStyle = `left:${el.x}%;top:${el.y}%;width:${el.w}%;${fs}`;
                let inner = '';
                if(el.type==='heading') inner = `<h1 class="cel-heading" style="font-size:${el.fontSize||2}rem">${el.text}</h1>`;
                else if(el.type==='subheading') inner = `<h2 class="cel-sub" style="font-size:${el.fontSize||1.3}rem">${el.text}</h2>`;
                else if(el.type==='paragraph') inner = `<p class="cel-para" style="font-size:${el.fontSize||1}rem">${el.text}</p>`;
                else if(el.type==='btn_primary') inner = `<button class="cel-btn-p" style="font-size:${el.fontSize||1}rem">${el.text}</button>`;
                else if(el.type==='btn_outline') inner = `<button class="cel-btn-o" style="font-size:${el.fontSize||1}rem">${el.text}</button>`;
                else if(el.type==='search') inner = `<div class="cel-search-wrap"><svg class="cel-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input class="cel-search" placeholder="${el.text}" oninput="doSearch(this.value)" /><div class="cel-search-results" id="search-results"></div></div>`;
                else if(el.type==='layers') inner = `<div class="cel-layers-box">${layersListHTML || '<div style="opacity:0.5;padding:8px;font-size:0.85rem">لا توجد طبقات</div>'}</div>`;
                else if(el.type==='stat') inner = `<div class="cel-stat"><div class="cel-stat-num" style="font-size:${el.fontSize||2}rem">${exportLayers.reduce((s,l)=>s+(l.data?.features?.length||0),0)}</div><div class="cel-stat-lbl">${el.text}</div></div>`;
                else if(el.type==='divider') inner = `<hr class="cel-hr"/>`;
                else if(el.type==='badge') inner = `<span class="cel-badge" style="font-size:${el.fontSize||0.85}rem">${el.text}</span>`;
                return `<div class="cel" style="${wStyle}">${inner}</div>`;
            }).join('\n            ')}
        </div>` : '';;

        // 4. Generate HTML Template
        const htmlTemplate = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PalNovaa Web Map Design</title>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&family=Tajawal:wght@300;500;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
    <link href="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.css" rel="stylesheet" />
    <script src="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.js"></script>
    <style>
        :root {
            --primary: ${theme.primary};
            --primary-dark: ${theme.primaryDark};
            --primary-glow: ${theme.primaryGlow};
            --bg: ${theme.bg};
            --surface: ${theme.surface};
            --surface-solid: ${theme.surfaceSolid};
            --border: ${theme.border};
            --text-color: ${theme.text};
            --font-h: ${selectedFont.h};
            --font-b: ${selectedFont.b};
        }
        body { margin: 0; padding: 0; font-family: var(--font-b); background: var(--bg); color: var(--text-color); overflow: hidden; }
        * { box-sizing: border-box; }
        
        ${layoutCSS}
        ${effectCSS}

        .layer-item { background: rgba(0,0,0,0.15); border-radius: 10px; padding: 12px 14px; margin-bottom: 10px; border: 1px solid var(--border); }
        .layer-item:hover { border-color: var(--primary); }
        #map { flex: 1; min-height: 0; width: 100%; }

        .watermark {
            position: fixed; bottom: 5px; right: 8px;
            color: rgba(255,255,255,0.6);
            font-size: 11px; font-family: sans-serif; font-weight: normal;
            pointer-events: none; z-index: 1000;
            text-shadow: 0 0 3px rgba(0,0,0,0.5);
        }
        
        .maplibregl-popup-content { background: var(--surface-solid); color: var(--text-color); border: 1px solid var(--primary); border-radius: 12px; font-family: var(--font-b); box-shadow: 0 10px 30px rgba(0,0,0,0.5); padding: 16px; }
        .maplibregl-popup-anchor-bottom .maplibregl-popup-tip { border-top-color: var(--primary); }
        ${customElsCSS}
    </style>
</head>
<body>
    <div class="app-container" style="position:relative;">
        ${layoutHTML}
        ${customElsHTML}
    </div>

    <script>
        const layers = ${JSON.stringify(exportLayers)};
        const mapStyle = ${JSON.stringify(targetBasemapStyleObj)};
        const map = new maplibregl.Map({
            container: 'map',
            style: mapStyle,
            center: [${center.lng}, ${center.lat}],
            zoom: ${zoom},
            pitch: ${pitch},
            bearing: ${bearing}
        });

        map.addControl(new maplibregl.NavigationControl(), 'bottom-right');

        // Push navigation control above the browser status bar
        const style = document.createElement('style');
        style.textContent = '.maplibregl-ctrl-bottom-right { bottom: 30px !important; }';
        document.head.appendChild(style);

        // Search function for custom search element
        function doSearch(query) {
            const results = document.getElementById('search-results');
            if (!results) return;
            if (!query.trim()) { results.style.display = 'none'; return; }
            const found = [];
            layers.forEach(layer => {
                if (!layer.data?.features) return;
                layer.data.features.forEach(f => {
                    const props = f.properties || {};
                    const match = Object.values(props).some(v => String(v).toLowerCase().includes(query.toLowerCase()));
                    if (match && f.geometry) found.push({ props, geom: f.geometry });
                });
            });
            if (found.length === 0) { results.innerHTML = '<div class="cel-search-item" style="opacity:0.5">لا توجد نتائج</div>'; results.style.display = 'block'; return; }
            results.innerHTML = found.slice(0, 8).map((r, i) => {
                const label = Object.values(r.props)[0] || 'معلم ' + (i + 1);
                return `<div class="cel-search-item" onclick="flyToFeature(${i})">${label}</div>`;
            }).join('');
            results.style.display = 'block';
            window._searchResults = found;
        }
        function flyToFeature(i) {
            const f = window._searchResults?.[i];
            if (!f) return;
            const coords = f.geom.type === 'Point' ? f.geom.coordinates : f.geom.coordinates?.[0]?.[0] || f.geom.coordinates?.[0];
            if (coords) map.flyTo({ center: coords, zoom: 15 });
            document.getElementById('search-results').style.display = 'none';
        }
        document.addEventListener('click', e => { const r = document.getElementById('search-results'); if(r && !e.target.closest('.cel-search-wrap')) r.style.display = 'none'; });

        map.on('load', () => {
            layers.forEach(layer => {
                if (layer.type === 'raster') {
                    map.addSource('src-' + layer.id, { type: 'image', url: layer.url, coordinates: layer.coordinates });
                    map.addLayer({ id: 'raster-' + layer.id, type: 'raster', source: 'src-' + layer.id, paint: { 'raster-opacity': 0.9 } });
                } else {
                    map.addSource('src-' + layer.id, { type: 'geojson', data: layer.data });
                    
                    // Polygons
                    map.addLayer({ id: 'poly-' + layer.id, type: 'fill', source: 'src-' + layer.id, filter: ['==', '$type', 'Polygon'], paint: { 'fill-color': layer.color, 'fill-opacity': 0.3, 'fill-outline-color': layer.color } });
                    map.addLayer({ id: 'poly-line-' + layer.id, type: 'line', source: 'src-' + layer.id, filter: ['==', '$type', 'Polygon'], paint: { 'line-color': layer.color, 'line-width': 2 } });
                    
                    // Lines
                    map.addLayer({ id: 'line-' + layer.id, type: 'line', source: 'src-' + layer.id, filter: ['==', '$type', 'LineString'], paint: { 'line-color': layer.color, 'line-width': 4 } });
                    
                    // Points (styled based on markers selection)
                    let circleRadius = 7;
                    let circleStroke = 2;
                    let circleOpacity = 1;
                    if ('${designSelections.marker}' === 'dot') { circleRadius = 5; circleStroke = 0; }
                    if ('${designSelections.marker}' === 'pulse') { circleRadius = 10; circleOpacity = 0.8; }
                    if ('${designSelections.marker}' === 'cluster') { circleRadius = 15; }
                    
                    map.addLayer({ 
                        id: 'point-' + layer.id, 
                        type: 'circle', 
                        source: 'src-' + layer.id, 
                        filter: ['==', '$type', 'Point'], 
                        paint: { 
                            'circle-radius': circleRadius, 
                            'circle-color': layer.color, 
                            'circle-stroke-width': circleStroke, 
                            'circle-stroke-color': '${theme.bg}',
                            'circle-opacity': circleOpacity
                        } 
                    });

                    const layerIds = ['poly-' + layer.id, 'line-' + layer.id, 'point-' + layer.id];
                    layerIds.forEach(lId => {
                        map.on('click', lId, (e) => {
                            if (!e.features.length) return;
                            let props = e.features[0].properties;
                            let html = '<div style="direction: rtl; text-align: right; max-height: 250px; overflow-y: auto; padding-right: 5px;">';
                            html += '<h4 style="margin: 0 0 12px 0; color: var(--primary); font-family: var(--font-h); font-size: 1.2rem;">تفاصيل المعلم</h4>';
                            for (let key in props) {
                                html += '<div style="margin-bottom: 8px; font-size: 0.95rem; border-bottom: 1px dashed var(--border); padding-bottom: 4px;"><strong>' + key + ':</strong> <span style="color: var(--primary);">' + props[key] + '</span></div>';
                            }
                            html += '</div>';
                            new maplibregl.Popup({closeButton: false, maxWidth: '300px'}).setLngLat(e.lngLat).setHTML(html).addTo(map);
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
        a.download = `PalNovaa_Design_${designSelections.layout}_${Date.now()}.html`;
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
                            <small>LAB · v3.1 (Latest)</small>
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
                            key="btn-design-studio-v4"
                            className="tool studio-trigger-btn" 
                            data-tip="تصدير الخريطة كتصميم ويب" 
                            onClick={launchDesignStudioFinal} 
                            style={{ 
                                color: '#000', 
                                background: '#10D9A0', 
                                border: '2px solid #fff',
                                boxShadow: '0 0 15px #10D9A0',
                                fontWeight: 'bold'
                            }}
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="3"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
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

            <div className={`design-studio ${isDesignStudioOpen ? 'active' : ''}`} id="designStudio" style={dynamicStyles}>
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
                            <strong>PalNovaa WebApp Design Studio</strong>
                            <small>VERSION 3.5 (ULTRA HD)</small>
                        </div>
                    </div>
                    <div className="ds-header-actions" style={{ display: 'flex', gap: '12px' }}>
                        <button className="ds-btn primary" onClick={performActualExport}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:'18px',height:'18px'}}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            حفظ وتصدير المشروع
                        </button>
                        <button className="ds-close" onClick={() => setIsDesignStudioOpen(false)}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:'20px',height:'20px'}}><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>
                </header>

                <div className="ds-body">
                    <aside className="ds-categories">
                        <div className="ds-cat-title">الأقسام الرئيسية</div>
                        {[
                            { id: 'layouts', label: 'التخطيطات', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>, count: 8 },
                            { id: 'palettes', label: 'لوحات الألوان', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>, count: 8 },
                            { id: 'typography', label: 'الخطوط', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>, count: 6 },
                            { id: 'components', label: 'المكونات', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5"/></svg>, count: 8 },
                            { id: 'basemaps', label: 'الخرائط', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/></svg>, count: 6 },
                            { id: 'markers', label: 'المعالم', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>, count: 6 },
                            { id: 'icons', label: 'الأيقونات', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>, count: 24 },
                            { id: 'effects', label: 'التأثيرات', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>, count: 9 },
                            { id: 'builder', label: 'منشئ الصفحة', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M3 9h6M3 15h6M15 9h6M15 15h6"/></svg>, count: pageElements.length || '+' }
                        ].map(cat => (
                            <div key={cat.id} className={`ds-cat ${activeDsCategory === cat.id ? 'active' : ''}`} onClick={() => setActiveDsCategory(cat.id)}>
                                {cat.icon}
                                <span>{cat.label}</span>
                                <span className="ds-cat-num">{cat.count}</span>
                            </div>
                        ))}
                    </aside>

                    <main className="ds-main" dir="rtl" style={{ fontFamily: 'var(--font-main)' }}>
                        {activeDsCategory === 'layouts' && (
                            <div className="ds-section active">
                                <div className="ds-section-head">
                                    <h2>تخطيطات الصفحة <span className="ds-tag">LAYOUTS</span></h2>
                                    <p>اختر هيكل الصفحة الأنسب لعرض الخريطة في موقعك</p>
                                </div>
                                <div className="ds-grid">
                                    {[
                                        { id: 'fullmap', title: 'خريطة كاملة', sub: 'الخريطة تملأ الشاشة + لوحة عائمة', type: 'lm-fullmap' },
                                        { id: 'sidebar', title: 'خريطة + لوحة جانبية', sub: 'لوحة معلومات + خريطة', type: 'lm-sidebar' },
                                        { id: 'three', title: 'ثلاث لوحات', sub: 'أدوات + خريطة + تفاصيل', type: 'lm-three' },
                                        { id: 'dashboard', title: 'لوحة قيادة', sub: 'رأس + خريطة + إحصائيات', type: 'lm-dashboard' },
                                        { id: 'split', title: 'تقسيم 50/50', sub: 'خريطة + محتوى متوازي', type: 'lm-split' },
                                        { id: 'stacked', title: 'خريطة + قائمة', sub: 'الخريطة فوق وقائمة النتائج تحت', type: 'lm-stacked' },
                                        { id: 'floating', title: 'بطاقات عائمة', sub: 'خريطة + ودجتس على السطح', type: 'lm-floating' },
                                        { id: 'modal', title: 'خريطة في مودال', sub: 'نافذة خريطة وسط الصفحة', type: 'lm-modal' }
                                    ].map(l => (
                                        <div key={l.id} className={`ds-pick ${designSelections.layout === l.id ? 'selected' : ''}`} onClick={() => setDesignSelections(s => ({...s, layout: l.id}))}>
                                            <div className={`layout-mockup ${l.type}`}>
                                                {l.id === 'floating' ? (
                                                    <>
                                                        <div className="lm-block map" style={{position:'absolute', inset:0}}></div>
                                                        <div className="lm-card" style={{top:'10%', right:'8%', width:'25%', height:'30%'}}></div>
                                                        <div className="lm-card" style={{bottom:'10%', left:'8%', width:'30%', height:'25%'}}></div>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className="lm-block map"></div>
                                                        {l.id === 'dashboard' ? (
                                                            <div className="lm-bottom">
                                                                <div className="lm-block alt"></div>
                                                                <div className="lm-block alt"></div>
                                                                <div className="lm-block alt"></div>
                                                            </div>
                                                        ) : (
                                                            <div className="lm-block alt"></div>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                            <div className="ds-pick-title">{l.title}</div>
                                            <div className="ds-pick-sub">{l.sub}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeDsCategory === 'palettes' && (
                            <div className="ds-section active">
                                <div className="ds-section-head">
                                    <h2>لوحات الألوان <span className="ds-tag">PALETTES</span></h2>
                                    <p>مجموعات ألوان احترافية مدروسة لتطبيقات الخرائط</p>
                                </div>
                                <div className="ds-grid">
                                    {[
                                        { id: 'classic', title: 'PalNovaa Classic', sub: 'برتقالي دافئ + كحلي عميق', colors: ['#F5A623', '#D88B0E', '#0F1E33', '#142B47', '#FFFFFF'] },
                                        { id: 'heritage', title: 'Heritage', sub: 'ألوان فلسطينية تراثية', colors: ['#CE1126', '#000000', '#FFFFFF', '#007A3D', '#F5A623'] },
                                        { id: 'ocean', title: 'Ocean Deep', sub: 'بحر هادئ ومحيط لانهائي', colors: ['#06D6F2', '#1A2980', '#0A1628', '#26D0CE', '#F0F8FF'] },
                                        { id: 'sunset', title: 'Sunset', sub: 'غروب الصحراء الدافئ', colors: ['#FF6B6B', '#F5A623', '#8B5CF6', '#FCD34D', '#1A0E1F'] },
                                        { id: 'forest', title: 'Forest', sub: 'طبيعة خضراء منعشة', colors: ['#10D9A0', '#059669', '#064E3B', '#A7F3D0', '#F5F4ED'] },
                                        { id: 'earth', title: 'Earth Tones', sub: 'ألوان ترابية كلاسيكية', colors: ['#D4C49B', '#A0826D', '#5C4033', '#F5F4ED', '#2C1810'] },
                                        { id: 'neon', title: 'Cyber Neon', sub: 'مستقبلي وعصري', colors: ['#06D6F2', '#8B5CF6', '#EC4899', '#050B16', '#F5A623'] },
                                        { id: 'minimal', title: 'Minimal', sub: 'بساطة وأناقة', colors: ['#FFFFFF', '#F5F4ED', '#E5E5E5', '#1A1A2E', '#F5A623'] }
                                    ].map(p => (
                                        <div key={p.id} className={`ds-pick ${designSelections.palette === p.id ? 'selected' : ''}`} onClick={() => setDesignSelections(s => ({...s, palette: p.id}))}>
                                            <div className="palette-strip">
                                                {p.colors.map((c, i) => <span key={i} style={{ background: c }}></span>)}
                                            </div>
                                            <div className="ds-pick-title">{p.title}</div>
                                            <div className="ds-pick-sub">{p.sub}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeDsCategory === 'typography' && (
                            <div className="ds-section active">
                                <div className="ds-section-head">
                                    <h2>أزواج الخطوط <span className="ds-tag">TYPOGRAPHY</span></h2>
                                    <p>أزواج خطوط متناغمة للعناوين والنصوص العربية والإنجليزية</p>
                                </div>
                                <div className="ds-grid">
                                    {[
                                        { id: 'cairo_tajawal', title: 'Cairo + Tajawal', sub: 'عربي حديث · موصى به', fontH: "'Cairo', sans-serif", fontB: "'Tajawal', sans-serif" },
                                        { id: 'tajawal_inter', title: 'Tajawal + Inter', sub: 'مختلط · أنيق', fontH: "'Tajawal', sans-serif", fontB: "system-ui" },
                                        { id: 'cairo_mono', title: 'Cairo + JetBrains Mono', sub: 'تقني · للمطورين', fontH: "'Cairo', sans-serif", fontB: "'JetBrains Mono', monospace" },
                                        { id: 'tajawal_ed', title: 'Tajawal Editorial', sub: 'تحريري · رسمي', fontH: "'Tajawal', serif", fontB: "'Tajawal', sans-serif" },
                                        { id: 'display', title: 'Display Big', sub: 'عرض · بصري', fontH: "'Cairo', sans-serif", fontB: "'Tajawal', sans-serif" },
                                        { id: 'compact', title: 'Compact UI', sub: 'مدمج · واجهات', fontH: "'Cairo', sans-serif", fontB: "'Tajawal', sans-serif" }
                                    ].map(f => (
                                        <div key={f.id} className={`ds-pick ${designSelections.font === f.id ? 'selected' : ''}`} onClick={() => setDesignSelections(s => ({...s, font: f.id}))}>
                                            <div className="type-preview">
                                                <div className="t-title" style={{ fontFamily: f.fontH }}>العنوان الرئيسي</div>
                                                <div className="t-body" style={{ fontFamily: f.fontB }}>نص توضيحي للقراءة في موقعك. يدعم كل اللغات بسلاسة وأناقة.</div>
                                            </div>
                                            <div className="ds-pick-title">{f.title}</div>
                                            <div className="type-pair-name">{f.sub}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeDsCategory === 'components' && (
                            <div className="ds-section active">
                                <div className="ds-section-head">
                                    <h2>المكونات الجاهزة <span className="ds-tag">COMPONENTS</span></h2>
                                    <p>عناصر واجهة جاهزة للنسخ والاستخدام في موقعك</p>
                                </div>
                                <div className="ds-grid">
                                    {[
                                        { id: 'primary', title: 'Primary Button', sub: 'زر متدرج مع توهج', node: <button className="comp-btn">زر رئيسي</button> },
                                        { id: 'outline', title: 'Outline Button', sub: 'زر بحدود فقط', node: <button className="comp-btn outline">زر محدد</button> },
                                        { id: 'ghost', title: 'Ghost Button', sub: 'خفيف ومنخفض', node: <button className="comp-btn ghost">زر شفاف</button> },
                                        { id: 'pill', title: 'Pill Button', sub: 'شكل بيضاوي ناعم', node: <button className="comp-btn pill">زر بيضاوي</button> },
                                        { id: 'glow', title: 'Glow Button', sub: 'تأثير ضوئي قوي', node: <button className="comp-btn glow">متوهج</button> },
                                        { id: 'card', title: 'Card Default', sub: 'بطاقة معلومات قياسية', node: <div className="comp-card"><div className="c-title">عنوان البطاقة</div><div className="c-text">نص قصير يصف محتوى البطاقة</div></div> },
                                        { id: 'search', title: 'Search Bar', sub: 'شريط بحث بيضاوي', node: <div className="comp-search"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> ابحث عن مكان...</div> },
                                        { id: 'toggle', title: 'Toggle Switch', sub: 'مفتاح تبديل', node: <div style={{display:'flex',alignItems:'center',gap:'10px',fontSize:'12px'}}><div style={{width:'36px',height:'20px',background:'var(--primary)',borderRadius:'999px',position:'relative'}}><div style={{position:'absolute',top:'2px',right:'2px',width:'16px',height:'16px',background:'white',borderRadius:'50%'}}></div></div><span>مفعّل</span></div> }
                                    ].map(c => (
                                        <div key={c.id} className={`ds-pick ${designSelections.component === c.id ? 'selected' : ''}`} onClick={() => setDesignSelections(s => ({...s, component: c.id}))}>
                                            <div className="comp-preview">{c.node}</div>
                                            <div className="ds-pick-title">{c.title}</div>
                                            <div className="ds-pick-sub">{c.sub}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeDsCategory === 'basemaps' && (
                            <div className="ds-section active">
                                <div className="ds-section-head">
                                    <h2>ثيمات خلفية الخريطة <span className="ds-tag">BASEMAPS</span></h2>
                                    <p>اختر مظهر الخريطة الأنسب لتطبيقك</p>
                                </div>
                                <div className="ds-grid">
                                    {[
                                        { id: 'dark', title: 'Dark Matter', sub: 'داكن أنيق · للتطبيقات الحديثة', type: 'bm-dark' },
                                        { id: 'light', title: 'Light Streets', sub: 'فاتح ونظيف · للقراءة الواضحة', type: 'bm-light' },
                                        { id: 'satellite', title: 'Satellite', sub: 'صور أقمار صناعية', type: 'bm-satellite' },
                                        { id: 'terrain', title: 'Terrain', sub: 'تضاريس وارتفاعات', type: 'bm-terrain' },
                                        { id: 'vintage', title: 'Vintage Map', sub: 'خريطة تاريخية كلاسيكية', type: 'bm-vintage' },
                                        { id: 'cyber', title: 'Cyber Grid', sub: 'سايبر بانك مستقبلي', type: 'bm-cyber' }
                                    ].map(b => (
                                        <div key={b.id} className={`ds-pick ${designSelections.basemap === b.id ? 'selected' : ''}`} onClick={() => setDesignSelections(s => ({...s, basemap: b.id}))}>
                                            <div className={`basemap-preview ${b.type}`}></div>
                                            <div className="ds-pick-title">{b.title}</div>
                                            <div className="ds-pick-sub">{b.sub}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeDsCategory === 'markers' && (
                            <div className="ds-section active">
                                <div className="ds-section-head">
                                    <h2>المعالم والنوافذ المنبثقة <span className="ds-tag">MARKERS</span></h2>
                                    <p>أشكال مختلفة لتمييز المواقع على الخريطة</p>
                                </div>
                                <div className="ds-grid">
                                    {[
                                        { id: 'pin', title: 'Classic Pin', sub: 'دبوس تقليدي', cls: 'mk-pin' },
                                        { id: 'dot', title: 'Glow Dot', sub: 'نقطة متوهجة', cls: 'mk-dot' },
                                        { id: 'pulse', title: 'Pulse Marker', sub: 'نبض حي مع موجة', cls: 'mk-pulse' },
                                        { id: 'cluster', title: 'Cluster', sub: 'تجميع نقاط مع عدد', cls: 'mk-cluster' },
                                        { id: 'numbered', title: 'Numbered', sub: 'رقم داخل دائرة', cls: 'mk-num' },
                                        { id: 'square', title: 'Diamond', sub: 'مربع مائل عصري', cls: 'mk-square' }
                                    ].map(m => (
                                        <div key={m.id} className={`ds-pick ${designSelections.marker === m.id ? 'selected' : ''}`} onClick={() => setDesignSelections(s => ({...s, marker: m.id}))}>
                                            <div className="marker-preview">
                                                <div className={m.cls}>{m.id==='cluster'?'12':m.id==='numbered'?'5':''}</div>
                                            </div>
                                            <div className="ds-pick-title">{m.title}</div>
                                            <div className="ds-pick-sub">{m.sub}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeDsCategory === 'icons' && (
                            <div className="ds-section active">
                                <div className="ds-section-head">
                                    <h2>مكتبة الأيقونات <span className="ds-tag">ICONS</span></h2>
                                    <p>أيقونات احترافية للخرائط والواجهات بنمط Lucide</p>
                                </div>
                                <div className="icon-tabs">
                                    {['الكل', 'خرائط', 'واجهة', 'إجراءات', 'بيانات'].map((t, i) => (
                                        <span key={i} className={`icon-tab ${i === 0 ? 'active' : ''}`}>{t}</span>
                                    ))}
                                </div>
                                <div className="icons-grid">
                                    {[
                                        <><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></>,
                                        <><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></>,
                                        <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>,
                                        <><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>,
                                        <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5"/>,
                                        <><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></>,
                                        <><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></>,
                                        <rect x="3" y="3" width="18" height="18" rx="2"/>,
                                        <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
                                        <polyline points="20 6 9 17 4 12"/>,
                                        <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
                                        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z"/>,
                                        <><path d="M3 3v18h18"/><path d="M18 17V9M13 17V5M8 17v-3"/></>,
                                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>,
                                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>,
                                        <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>,
                                        <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>,
                                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>,
                                        <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
                                        <path d="M3 6h18M3 12h18M3 18h18"/>,
                                        <><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></>,
                                        <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>,
                                        <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></>
                                    ].map((icon, i) => (
                                        <div key={i} className="icon-cell">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{icon}</svg>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeDsCategory === 'effects' && (
                            <div className="ds-section active">
                                <div className="ds-section-head">
                                    <h2>التأثيرات والظلال <span className="ds-tag">EFFECTS</span></h2>
                                    <p>ظلال وتدرجات وتأثيرات بصرية لإضافة العمق</p>
                                </div>
                                <div className="ds-grid">
                                    {[
                                        { id: 'md', title: 'Shadow Medium', sub: 'ظل متوسط متوازن', cls: 'ef-shadow-md' },
                                        { id: 'lg', title: 'Shadow Large', sub: 'ظل عميق دراماتيكي', cls: 'ef-shadow-lg' },
                                        { id: 'glow', title: 'Glow Effect', sub: 'توهج برتقالي قوي', cls: 'ef-glow' },
                                        { id: 'glass', title: 'Glassmorphism', sub: 'زجاج ضبابي عصري', cls: 'ef-glass' },
                                        { id: 'sunset', title: 'Sunset Gradient', sub: 'تدرج غروب الشمس', cls: 'ef-grad-sunset' },
                                        { id: 'ocean', title: 'Ocean Gradient', sub: 'تدرج المحيط العميق', cls: 'ef-grad-ocean' },
                                        { id: 'forest', title: 'Forest Gradient', sub: 'تدرج أخضر منعش', cls: 'ef-grad-forest' },
                                        { id: 'float', title: 'Float Animation', sub: 'حركة طفو ناعمة', cls: 'ef-anim-float' },
                                        { id: 'pulse', title: 'Pulse Animation', sub: 'نبضة دائرية', cls: 'ef-anim-pulse' }
                                    ].map(e => (
                                        <div key={e.id} className={`ds-pick ${designSelections.effect === e.id ? 'selected' : ''}`} onClick={() => setDesignSelections(s => ({...s, effect: e.id}))}>
                                            <div className={`effect-preview ${e.cls}`}><div className="effect-box"></div></div>
                                            <div className="ds-pick-title">{e.title}</div>
                                            <div className="ds-pick-sub">{e.sub}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeDsCategory === 'builder' && (
                            <div className="ds-section active" style={{padding:0,height:'100%'}}>
                                <div style={{display:'flex',height:'100%',gap:0}}>
                                    {/* Element Palette */}
                                    <div style={{width:'150px',background:'rgba(0,0,0,0.3)',borderRight:'1px solid rgba(255,255,255,0.06)',padding:'16px 10px',overflowY:'auto',flexShrink:0}}>
                                        <div style={{fontSize:'0.7rem',color:'rgba(255,255,255,0.4)',letterSpacing:'2px',marginBottom:'12px',textAlign:'center'}}>العناصر</div>
                                        {[
                                            {type:'heading', label:'عنوان', preview:'H₁', text:'عنوان رئيسي'},
                                            {type:'subheading', label:'عنوان فرعي', preview:'H₂', text:'عنوان فرعي'},
                                            {type:'paragraph', label:'نص', preview:'¶', text:'أضف نصاً هنا...'},
                                            {type:'btn_primary', label:'زر رئيسي', preview:'[زر]', text:'انقر هنا'},
                                            {type:'btn_outline', label:'زر ثانوي', preview:'⎕زر', text:'مزيد'},
                                            {type:'search', label:'بحث', preview:'🔍', text:'ابحث...'},
                                            {type:'layers', label:'قائمة طبقات', preview:'⊞', text:'الطبقات'},
                                            {type:'stat', label:'بطاقة إحصاء', preview:'42↑', text:'إجمالي'},
                                            {type:'divider', label:'خط فاصل', preview:'───', text:''},
                                            {type:'badge', label:'شارة', preview:'🏷', text:'جديد'},
                                        ].map(el => (
                                            <div
                                                key={el.type}
                                                draggable
                                                onDragStart={e => { e.dataTransfer.setData('elType', el.type); e.dataTransfer.setData('elText', el.text); e.dataTransfer.setData('elLabel', el.label); }}
                                                style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'8px',padding:'8px',marginBottom:'8px',cursor:'grab',textAlign:'center',transition:'all 0.2s',userSelect:'none'}}
                                                onMouseEnter={e=>e.currentTarget.style.borderColor='var(--primary)'}
                                                onMouseLeave={e=>e.currentTarget.style.borderColor='rgba(255,255,255,0.08)'}
                                            >
                                                <div style={{fontSize:'1.1rem',marginBottom:'4px'}}>{el.preview}</div>
                                                <div style={{fontSize:'0.72rem',opacity:0.7}}>{el.label}</div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Canvas */}
                                    <div style={{flex:1,display:'flex',flexDirection:'column',padding:'16px',gap:'8px'}}>
                                        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                                            <span style={{fontSize:'0.75rem',opacity:0.5}}>اسحب العناصر وضعها على اللوحة</span>
                                            <button onClick={()=>setPageElements([])} style={{background:'rgba(239,68,68,0.15)',border:'1px solid rgba(239,68,68,0.3)',color:'#EF4444',borderRadius:'6px',padding:'4px 10px',fontSize:'0.75rem',cursor:'pointer'}}>مسح الكل</button>
                                        </div>
                                        <div
                                            style={{flex:1,position:'relative',background:'rgba(6,214,242,0.03)',border:'2px dashed rgba(6,214,242,0.15)',borderRadius:'12px',overflow:'hidden',minHeight:'350px'}}
                                            onDragOver={e=>e.preventDefault()}
                                            onDrop={e=>{
                                                e.preventDefault();
                                                const rect=e.currentTarget.getBoundingClientRect();
                                                const x=Math.max(0,Math.min(80,((e.clientX-rect.left)/rect.width)*100));
                                                const y=Math.max(0,Math.min(85,((e.clientY-rect.top)/rect.height)*100));
                                                const newEl={id:Date.now(),type:e.dataTransfer.getData('elType'),label:e.dataTransfer.getData('elLabel'),text:e.dataTransfer.getData('elText'),x,y,w:22,fontSize:1};
                                                setPageElements(prev=>[...prev,newEl]);
                                                setSelectedElId(newEl.id);
                                            }}
                                            onClick={()=>setSelectedElId(null)}
                                        >
                                            {/* Map hint */}
                                            <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:'8px',opacity:0.12,pointerEvents:'none'}}>
                                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/></svg>
                                                <span style={{fontSize:'0.85rem'}}>منطقة الخريطة</span>
                                            </div>
                                            {/* Placed Elements */}
                                            {pageElements.map(el=>(
                                                <div
                                                    key={el.id}
                                                    style={{position:'absolute',left:`${el.x}%`,top:`${el.y}%`,width:`${el.w}%`,cursor:'move',userSelect:'none',border:selectedElId===el.id?'2px solid rgba(6,214,242,0.8)':'2px solid transparent',borderRadius:'6px',padding:'4px 6px',background:selectedElId===el.id?'rgba(6,214,242,0.08)':'transparent',boxSizing:'border-box',minWidth:'60px',transition:'border-color 0.15s'}}
                                                    onClick={e=>{e.stopPropagation();setSelectedElId(el.id);}}
                                                    onMouseDown={e=>{
                                                        e.stopPropagation();
                                                        setSelectedElId(el.id);
                                                        const startX=e.clientX,startY=e.clientY,startElX=el.x,startElY=el.y;
                                                        const canvas=e.currentTarget.parentElement;
                                                        const rect=canvas.getBoundingClientRect();
                                                        const mm=me=>{
                                                            const dx=((me.clientX-startX)/rect.width)*100;
                                                            const dy=((me.clientY-startY)/rect.height)*100;
                                                            setPageElements(prev=>prev.map(item=>item.id===el.id?{...item,x:Math.max(0,Math.min(80,startElX+dx)),y:Math.max(0,Math.min(85,startElY+dy))}:item));
                                                        };
                                                        const mu=()=>{window.removeEventListener('mousemove',mm);window.removeEventListener('mouseup',mu);};
                                                        window.addEventListener('mousemove',mm);
                                                        window.addEventListener('mouseup',mu);
                                                    }}
                                                >
                                                    {el.type==='heading'&&<div style={{color:'var(--primary)',fontWeight:'900',fontSize:'1.1rem',fontFamily:"'Cairo',sans-serif",whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{el.text}</div>}
                                                    {el.type==='subheading'&&<div style={{color:'rgba(255,255,255,0.9)',fontWeight:'700',fontSize:'0.9rem',whiteSpace:'nowrap',overflow:'hidden'}}>{el.text}</div>}
                                                    {el.type==='paragraph'&&<div style={{fontSize:'0.7rem',opacity:0.75,lineHeight:'1.4'}}>{el.text}</div>}
                                                    {el.type==='btn_primary'&&<button style={{background:'var(--primary)',color:'#000',border:'none',borderRadius:'8px',padding:'5px 10px',fontSize:'0.72rem',fontWeight:'bold',width:'100%',cursor:'default',whiteSpace:'nowrap'}}>{el.text}</button>}
                                                    {el.type==='btn_outline'&&<button style={{background:'transparent',color:'var(--primary)',border:'1px solid var(--primary)',borderRadius:'8px',padding:'5px 10px',fontSize:'0.72rem',fontWeight:'bold',width:'100%',cursor:'default',whiteSpace:'nowrap'}}>{el.text}</button>}
                                                    {el.type==='search'&&<div style={{background:'rgba(0,0,0,0.3)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:'999px',padding:'4px 10px',fontSize:'0.7rem',opacity:0.85,display:'flex',alignItems:'center',gap:'5px'}}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>{el.text}</div>}
                                                    {el.type==='layers'&&<div style={{background:'rgba(0,0,0,0.2)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'6px',padding:'4px 8px',fontSize:'0.7rem',opacity:0.8}}>{el.text}</div>}
                                                    {el.type==='stat'&&<div style={{background:'rgba(0,0,0,0.3)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'8px',padding:'6px',textAlign:'center'}}><div style={{color:'var(--primary)',fontWeight:'800',fontSize:'1.1rem'}}>0</div><div style={{fontSize:'0.65rem',opacity:0.7}}>{el.text}</div></div>}
                                                    {el.type==='divider'&&<hr style={{border:'none',borderTop:'1px solid rgba(255,255,255,0.15)',margin:'4px 0'}}/>}
                                                    {el.type==='badge'&&<span style={{background:'var(--primary)',color:'#000',borderRadius:'999px',padding:'2px 10px',fontSize:'0.7rem',fontWeight:'bold',display:'inline-block'}}>{el.text}</span>}
                                                    {selectedElId===el.id&&(
                                                        <button onClick={e=>{e.stopPropagation();setPageElements(prev=>prev.filter(i=>i.id!==el.id));setSelectedElId(null);}} style={{position:'absolute',top:'-8px',right:'-8px',width:'18px',height:'18px',borderRadius:'50%',background:'#EF4444',color:'white',border:'none',cursor:'pointer',fontSize:'11px',display:'flex',alignItems:'center',justifyContent:'center',lineHeight:1}}>×</button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                        <div style={{fontSize:'0.7rem',opacity:0.4,textAlign:'center'}}>اسحب لتحريك العناصر · انقر لتحديد · × للحذف</div>
                                    </div>

                                    {/* Properties Panel */}
                                    <div style={{width:'160px',background:'rgba(0,0,0,0.3)',borderLeft:'1px solid rgba(255,255,255,0.06)',padding:'16px 12px',flexShrink:0,overflowY:'auto'}}>
                                        <div style={{fontSize:'0.7rem',color:'rgba(255,255,255,0.4)',letterSpacing:'2px',marginBottom:'12px'}}>الخصائص</div>
                                        {selectedElId && (() => {
                                            const el = pageElements.find(e=>e.id===selectedElId);
                                            if(!el) return <div style={{fontSize:'0.75rem',opacity:0.4}}>لا يوجد تحديد</div>;
                                            return (
                                                <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
                                                    <div style={{background:'rgba(6,214,242,0.1)',border:'1px solid rgba(6,214,242,0.2)',borderRadius:'6px',padding:'6px 8px',fontSize:'0.75rem',color:'var(--accent-cyan)'}}>{el.label}</div>
                                                    <div>
                                                        <label style={{fontSize:'0.7rem',opacity:0.6,display:'block',marginBottom:'4px'}}>النص</label>
                                                        <input value={el.text||''} onChange={e=>setPageElements(prev=>prev.map(i=>i.id===el.id?{...i,text:e.target.value}:i))} style={{width:'100%',background:'rgba(0,0,0,0.3)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'6px',padding:'5px 8px',color:'white',fontSize:'0.75rem',boxSizing:'border-box'}}/>
                                                    </div>
                                                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px'}}>
                                                        <div><label style={{fontSize:'0.65rem',opacity:0.5,display:'block',marginBottom:'2px'}}>X%</label><input type="number" value={Math.round(el.x)} min="0" max="80" onChange={e=>setPageElements(prev=>prev.map(i=>i.id===el.id?{...i,x:Number(e.target.value)}:i))} style={{width:'100%',background:'rgba(0,0,0,0.3)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'6px',padding:'4px 6px',color:'white',fontSize:'0.72rem',boxSizing:'border-box'}}/></div>
                                                        <div><label style={{fontSize:'0.65rem',opacity:0.5,display:'block',marginBottom:'2px'}}>Y%</label><input type="number" value={Math.round(el.y)} min="0" max="85" onChange={e=>setPageElements(prev=>prev.map(i=>i.id===el.id?{...i,y:Number(e.target.value)}:i))} style={{width:'100%',background:'rgba(0,0,0,0.3)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'6px',padding:'4px 6px',color:'white',fontSize:'0.72rem',boxSizing:'border-box'}}/></div>
                                                    </div>
                                                    <div><label style={{fontSize:'0.65rem',opacity:0.5,display:'block',marginBottom:'2px'}}>العرض %</label><input type="number" value={el.w} min="5" max="100" onChange={e=>setPageElements(prev=>prev.map(i=>i.id===el.id?{...i,w:Number(e.target.value)}:i))} style={{width:'100%',background:'rgba(0,0,0,0.3)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'6px',padding:'4px 6px',color:'white',fontSize:'0.72rem',boxSizing:'border-box'}}/></div>
                                                    <button onClick={()=>{setPageElements(prev=>prev.filter(i=>i.id!==el.id));setSelectedElId(null);}} style={{background:'rgba(239,68,68,0.15)',border:'1px solid rgba(239,68,68,0.3)',color:'#EF4444',borderRadius:'6px',padding:'6px',fontSize:'0.75rem',cursor:'pointer',width:'100%'}}>حذف العنصر</button>
                                                </div>
                                            );
                                        })()}
                                        {!selectedElId && <div style={{fontSize:'0.75rem',opacity:0.4,textAlign:'center',marginTop:'20px'}}>انقر على عنصر لتعديله</div>}
                                    </div>
                                </div>
                            </div>
                        )}
                    </main>

                    <aside className="ds-preview" dir="rtl" style={{ fontFamily: 'var(--font-main)' }}>
                        <div className="ds-preview-head">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                            <span>معاينة التصميم الحية</span>
                        </div>
                        <div className="preview-mock">
                            <div className={`preview-mock-content layout-mockup lm-${designSelections.layout}`}>
                                <div className="pmc-header lm-block muted"></div>
                                <div className="pmc-map lm-block map"></div>
                                {designSelections.layout === 'dashboard' && (
                                    <div className="lm-bottom" style={{ height: '30px', marginTop: '10px' }}>
                                        <div className="lm-block alt"></div>
                                        <div className="lm-block alt"></div>
                                    </div>
                                )}
                                {designSelections.layout === 'sidebar' && <div className="lm-block alt" style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '30%' }}></div>}
                                <div className="pmc-bar"></div>
                            </div>
                        </div>
                        <div className="preview-info">
                            <div className="preview-info-row"><span className="pi-label">التخطيط</span><span className="pi-value">{designSelections.layout}</span></div>
                            <div className="preview-info-row"><span className="pi-label">الهوية اللونية</span><span className="pi-value" style={{ color: 'var(--primary)' }}>{designSelections.palette}</span></div>
                            <div className="preview-info-row"><span className="pi-label">الخط المستخدم</span><span className="pi-value">{designSelections.font}</span></div>
                        </div>
                        <div style={{marginTop:'20px'}}>
                            <button className="ds-btn primary" onClick={performActualExport} style={{width:'100%',justifyContent:'center', fontFamily: 'inherit'}}>
                                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" style={{marginLeft:'8px'}}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                تنزيل الموقع النهائي
                            </button>
                        </div>
                    </aside>
                </div>
            </div>
        </div>
    );
};

export default PalNovaaLab;
