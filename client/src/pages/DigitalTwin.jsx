import React, { useState, useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import * as THREE from 'three';
import './DigitalTwin.css';

// ─── إحداثيات افتراضية لجامعة بيرزيت (فلسطين) لبدء المعاينة ────────────────
const DEFAULT_CENTER = [35.1812, 31.9598]; 

export default function DigitalTwin({ onClose }) {
    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);
    
    // البيانات والمشاريع
    const [geojsonData, setGeojsonData] = useState(null);
    const [customPoints, setCustomPoints] = useState(() => {
        const saved = localStorage.getItem('agq_dt_custom_points');
        return saved ? JSON.parse(saved) : [];
    });
    const [customBuildings, setCustomBuildings] = useState(() => {
        const saved = localStorage.getItem('agq_dt_custom_buildings');
        return saved ? JSON.parse(saved) : [];
    });
    const [customStreets, setCustomStreets] = useState(() => {
        const saved = localStorage.getItem('agq_dt_custom_streets');
        return saved ? JSON.parse(saved) : [];
    });
    
    const [stats, setStats] = useState({ polygons: 0, points: 0, streets: 0 });
    const [centerCoords, setCenterCoords] = useState(DEFAULT_CENTER);
    
    // التبويب النشط في اللوحة الجانبية
    const [activeTab, setActiveTab] = useState('data');
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    
    // إعدادات تجسيم المباني (Polygons)
    const [heightProp, setHeightProp] = useState('height');
    const [defaultHeight, setDefaultHeight] = useState(15);
    const [buildingTheme, setBuildingTheme] = useState('realistic'); // realistic, glassmorphic, neon, classic
    const [buildingColor, setBuildingColor] = useState('#10b981'); 
    
    // خيارات الخرائط
    const [activeBasemap, setActiveBasemap] = useState('dark');
    
    // إعدادات البيئة
    const [timeOfDay, setTimeOfDay] = useState(12); // من 0 إلى 24 ساعة
    const [weather, setWeather] = useState('clear');
    const [autoTour, setAutoTour] = useState(false);
    
    // أدوات الرسم الهندسي النشطة
    const [drawMode, setDrawMode] = useState('none'); // none, building, street, point
    const [drawnCoords, setDrawnCoords] = useState([]); // إحداثيات الشكل الجاري رسمه
    const [selectedPlacementType, setSelectedPlacementType] = useState('tree');
    
    // فاحص الكائنات (Inspector)
    const [selectedFeature, setSelectedFeature] = useState(null); 
    // تفاصيل تعديل الكائن المحدد (Admin Details)
    const [editScale, setEditScale] = useState(1.0);
    const [editRotation, setEditRotation] = useState(0);
    const [editOffsetX, setEditOffsetX] = useState(0);
    const [editOffsetY, setEditOffsetY] = useState(0);
    const [editHeight, setEditHeight] = useState(15);
    const [editSkin, setEditSkin] = useState('glass');
    const [editSolarRoof, setEditSolarRoof] = useState(true);
    const [editColor, setEditColor] = useState('#10b981');
    const [editStreetWidth, setEditStreetWidth] = useState(8);
    const [editStreetStyle, setEditStreetStyle] = useState('asphalt');

    // تكوين تعيين النقاط إلى مجسمات (Point Object Mapping)
    const [pointMappings, setPointMappings] = useState({
        'tree': { model: 'tree', scale: 1.0, color: '#10b981' },
        'car': { model: 'car', scale: 1.0, color: '#f43f5e' },
        'streetlight': { model: 'streetlight', scale: 1.0, color: '#fbab15' },
        'wind_turbine': { model: 'wind_turbine', scale: 1.0, color: '#ffffff' },
        'traffic_light': { model: 'traffic_light', scale: 1.0, color: '#3b82f6' },
        'bench': { model: 'bench', scale: 1.0, color: '#854d0e' },
        'cctv': { model: 'cctv', scale: 1.0, color: '#64748b' },
        'beacon': { model: 'beacon', scale: 1.2, color: '#10b981' }
    });

    // مراجع الـ Three.js للتحكم المباشر في الرندر والخامات
    const threeSceneRef = useRef(null);
    const threeLightsRef = useRef({});
    const meshesMapRef = useRef(new Map()); 
    const animatedRotorsRef = useRef([]);  
    const animatedBeaconsRef = useRef([]); 
    const texturesCacheRef = useRef(new Map()); // لتفادي إعادة إنشاء الخامات بدون تغيير
    const timeRef = useRef(0);

    // ─── حفظ تلقائي للبيانات الجانبية في LocalStorage ──────────────────────────
    useEffect(() => {
        localStorage.setItem('agq_dt_custom_points', JSON.stringify(customPoints));
    }, [customPoints]);

    useEffect(() => {
        localStorage.setItem('agq_dt_custom_buildings', JSON.stringify(customBuildings));
    }, [customBuildings]);

    useEffect(() => {
        localStorage.setItem('agq_dt_custom_streets', JSON.stringify(customStreets));
    }, [customStreets]);

    // ─── 1. إنشاء نسيج وخامات إجرائية واقعية (Canvas-Based Textures) ─────────
    const getProceduralTexture = (type, colorHex, isNight) => {
        const cacheKey = `${type}-${colorHex}-${isNight ? 'night' : 'day'}`;
        if (texturesCacheRef.current.has(cacheKey)) {
            return texturesCacheRef.current.get(cacheKey);
        }

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (type === 'glass') {
            // نسيج واجهة زجاجية ذكية
            canvas.width = 128;
            canvas.height = 128;
            ctx.fillStyle = isNight ? '#0b132b' : '#334155';
            ctx.fillRect(0, 0, 128, 128);

            const rows = 4;
            const cols = 4;
            const wWidth = 20;
            const wHeight = 22;
            const paddingX = 9;
            const paddingY = 8;

            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const x = paddingX + c * (wWidth + paddingX);
                    const y = paddingY + r * (wHeight + paddingY);
                    
                    if (isNight) {
                        // إضاءة عشوائية للنوافذ ليلاً
                        const isLit = (r + c) % 3 === 0 || (r * c) % 5 === 1;
                        ctx.fillStyle = isLit ? '#ffe082' : '#1e293b';
                        if (isLit) {
                            ctx.shadowColor = '#ffe082';
                            ctx.shadowBlur = 4;
                        } else {
                            ctx.shadowBlur = 0;
                        }
                    } else {
                        ctx.fillStyle = '#bae6fd'; // زجاج سماوي نهاراً
                        ctx.shadowBlur = 0;
                    }
                    ctx.fillRect(x, y, wWidth, wHeight);
                    ctx.strokeStyle = '#1e293b';
                    ctx.lineWidth = 1.5;
                    ctx.strokeRect(x, y, wWidth, wHeight);
                }
            }
        } else if (type === 'brick') {
            // نسيج طوب كلاسيكي دقيق
            canvas.width = 64;
            canvas.height = 64;
            ctx.fillStyle = '#b45309'; 
            ctx.fillRect(0, 0, 64, 64);
            ctx.strokeStyle = '#cbd5e1'; 
            ctx.lineWidth = 1;

            for (let y = 0; y <= 64; y += 8) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(64, y);
                ctx.stroke();
            }

            for (let row = 0; row < 8; row++) {
                const y = row * 8;
                const offset = (row % 2) * 16;
                for (let x = offset; x <= 64 + 32; x += 32) {
                    ctx.beginPath();
                    ctx.moveTo(x - 16, y);
                    ctx.lineTo(x - 16, y + 8);
                    ctx.stroke();
                }
            }
        } else if (type === 'concrete') {
            // خرسانة صناعية دقيقة
            canvas.width = 128;
            canvas.height = 128;
            ctx.fillStyle = '#64748b';
            ctx.fillRect(0, 0, 128, 128);

            // إضافة نسيج وشوائب خرسانية عشوائية
            ctx.fillStyle = '#475569';
            for (let i = 0; i < 400; i++) {
                const size = Math.random() * 2;
                ctx.fillRect(Math.random() * 128, Math.random() * 128, size, size);
            }
            // فواصل خرسانية
            ctx.strokeStyle = '#334155';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(4, 4, 120, 120);
        } else if (type === 'solar') {
            // ألواح شمسية زرقاء ميتاليك للأسطح
            canvas.width = 64;
            canvas.height = 64;
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(0, 0, 64, 64);
            ctx.strokeStyle = '#94a3b8';
            ctx.lineWidth = 1.5;

            for (let i = 0; i <= 64; i += 16) {
                ctx.beginPath();
                ctx.moveTo(i, 0);
                ctx.lineTo(i, 64);
                ctx.stroke();
                
                ctx.beginPath();
                ctx.moveTo(0, i);
                ctx.lineTo(64, i);
                ctx.stroke();
            }
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        
        // تكرار النسيج ليتناسب مع حجم المجسم
        if (type === 'brick') {
            texture.repeat.set(5, 5);
        } else {
            texture.repeat.set(3, 3);
        }

        texturesCacheRef.current.set(cacheKey, texture);
        return texture;
    };

    // ─── 2. البيانات التجريبية الغنية (Sample Smart District) ─────────────────
    const loadSampleData = () => {
        const sampleGeoJSON = {
            type: "FeatureCollection",
            features: [
                {
                    type: "Feature",
                    properties: { name: "مبنى الإدارة الرئيسي", type: "building", height: 28, color: "#10b981" },
                    geometry: {
                        type: "Polygon",
                        coordinates: [[
                            [35.1805, 31.9605], [35.1815, 31.9605],
                            [35.1815, 31.9598], [35.1805, 31.9598],
                            [35.1805, 31.9605]
                        ]]
                    }
                },
                {
                    type: "Feature",
                    properties: { name: "مكتبة الحرم الجامعي", type: "building", height: 18, color: "#3b82f6" },
                    geometry: {
                        type: "Polygon",
                        coordinates: [[
                            [35.1820, 31.9602], [35.1828, 31.9602],
                            [35.1828, 31.9595], [35.1820, 31.9595],
                            [35.1820, 31.9602]
                        ]]
                    }
                },
                // نقاط الأشجار
                { type: "Feature", properties: { name: "شجرة صنوبر 1", type: "tree" }, geometry: { type: "Point", coordinates: [35.1802, 31.9601] } },
                { type: "Feature", properties: { name: "شجرة صنوبر 2", type: "tree" }, geometry: { type: "Point", coordinates: [35.1803, 31.9599] } },
                // نقاط أعمدة الإنارة
                { type: "Feature", properties: { name: "عمود إنارة الممر A", type: "streetlight" }, geometry: { type: "Point", coordinates: [35.1806, 31.9600] } },
                { type: "Feature", properties: { name: "عمود إنارة الممر B", type: "streetlight" }, geometry: { type: "Point", coordinates: [35.1814, 31.9600] } },
                // توربينات رياح طاقة متجددة
                { type: "Feature", properties: { name: "توربين طاقة متجددة A", type: "wind_turbine" }, geometry: { type: "Point", coordinates: [35.1788, 31.9585] } }
            ]
        };

        setCenterCoords([35.1810, 31.9595]);
        setGeojsonData(sampleGeoJSON);
        
        // تحميل شوارع تجريبية
        const sampleStreets = [
            {
                id: "st-sample-1",
                name: "شارع الحرم الرئيسي",
                width: 9,
                style: "asphalt",
                coordinates: [
                    [35.1798, 31.9596],
                    [35.1818, 31.9596],
                    [35.1830, 31.9590]
                ]
            }
        ];
        setCustomStreets(sampleStreets);

        // تحميل كائنات مخصصة تجريبية للمباني المكسوة
        const sampleBuildings = [
            {
                id: "bld-sample-1",
                name: "مجمع بالنوفا الذكي للابتكار",
                height: 32,
                skin: "glass",
                solarRoof: true,
                color: "#10b981",
                coordinates: [
                    [35.1807, 31.9592],
                    [35.1817, 31.9592],
                    [35.1817, 31.9585],
                    [35.1807, 31.9585],
                    [35.1807, 31.9592]
                ]
            }
        ];
        setCustomBuildings(sampleBuildings);

        if (mapRef.current) {
            mapRef.current.flyTo({
                center: [35.1810, 31.9595],
                zoom: 17.2,
                pitch: 58,
                bearing: -15,
                duration: 2000
            });
        }
    };

    // ─── 3. الرفع والتصدير والاستيراد للمشاريع الكاملة ─────────────────────────
    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const parsed = JSON.parse(event.target.result);
                if (parsed.isDigitalTwinProject) {
                    if (parsed.geojsonData) setGeojsonData(parsed.geojsonData);
                    if (parsed.customPoints) setCustomPoints(parsed.customPoints);
                    if (parsed.customBuildings) setCustomBuildings(parsed.customBuildings);
                    if (parsed.customStreets) setCustomStreets(parsed.customStreets);
                    if (parsed.pointMappings) setPointMappings(parsed.pointMappings);
                    if (parsed.buildingTheme) setBuildingTheme(parsed.buildingTheme);
                    if (parsed.buildingColor) setBuildingColor(parsed.buildingColor);
                    if (parsed.heightProp) setHeightProp(parsed.heightProp);
                    if (parsed.defaultHeight) setDefaultHeight(parsed.defaultHeight);
                    if (parsed.activeBasemap) setActiveBasemap(parsed.activeBasemap);
                    if (parsed.centerCoords) {
                        setCenterCoords(parsed.centerCoords);
                        mapRef.current?.flyTo({ center: parsed.centerCoords, zoom: 17, pitch: 50 });
                    }
                } else if (parsed.type === 'FeatureCollection' || parsed.type === 'Feature') {
                    setGeojsonData(parsed);
                    setCustomPoints([]);
                    setCustomBuildings([]);
                    setCustomStreets([]);
                }
            } catch (err) {
                alert('الملف غير صالح.');
            }
        };
        reader.readAsText(file);
    };

    const exportProject = () => {
        const projectData = {
            isDigitalTwinProject: true,
            projectName: "التوأم الرقمي الواقعي - " + new Date().toLocaleDateString('ar-EG'),
            geojsonData,
            customPoints,
            customBuildings,
            customStreets,
            pointMappings,
            buildingTheme,
            buildingColor,
            heightProp,
            defaultHeight,
            activeBasemap,
            centerCoords
        };

        const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `digital-twin-real-editor-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // ─── 4. تحديث الإحصائيات عند تغيير البيانات ──────────────────────────────
    useEffect(() => {
        let polyCount = 0;
        let ptCount = 0;

        if (geojsonData) {
            const features = geojsonData.type === 'FeatureCollection' ? geojsonData.features : [geojsonData];
            features.forEach(f => {
                if (f.geometry.type.includes('Polygon')) polyCount++;
                if (f.geometry.type === 'Point') ptCount++;
            });
        }

        setStats({
            polygons: polyCount + customBuildings.length,
            points: ptCount + customPoints.length,
            streets: customStreets.length
        });
    }, [geojsonData, customPoints, customBuildings, customStreets]);

    // ─── 5. تهيئة الخريطة وتحديث طبقاتها وتفاصيل الأبعاد الثلاثية ──────────
    useEffect(() => {
        if (!mapContainerRef.current) return;

        const getStyleConfig = (type) => {
            switch (type) {
                case 'light':
                    return {
                        version: 8,
                        sources: { 'carto-light': { type: 'raster', tiles: ['https://basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}{r}.png'], tileSize: 256 } },
                        layers: [{ id: 'carto-light-layer', type: 'raster', source: 'carto-light' }]
                    };
                case 'osm':
                    return {
                        version: 8,
                        sources: { 'osm-tiles': { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256 } },
                        layers: [{ id: 'osm-layer', type: 'raster', source: 'osm-tiles' }]
                    };
                case 'satellite':
                    return {
                        version: 8,
                        sources: { 'google-satellite': { type: 'raster', tiles: ['https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'], tileSize: 256 } },
                        layers: [{ id: 'satellite-layer', type: 'raster', source: 'google-satellite' }]
                    };
                case 'grid':
                    return {
                        version: 8,
                        sources: {},
                        layers: [{ id: 'background-grid', type: 'background', paint: { 'background-color': '#060910' } }]
                    };
                case 'dark':
                default:
                    return {
                        version: 8,
                        sources: { 'carto-dark': { type: 'raster', tiles: ['https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png'], tileSize: 256 } },
                        layers: [{ id: 'carto-dark-layer', type: 'raster', source: 'carto-dark' }]
                    };
            }
        };

        const map = new maplibregl.Map({
            container: mapContainerRef.current,
            style: getStyleConfig(activeBasemap),
            center: centerCoords,
            zoom: 17,
            pitch: 55,
            bearing: -10,
            antialias: true
        });

        mapRef.current = map;

        map.addControl(new maplibregl.NavigationControl(), 'bottom-right');

        map.on('load', () => {
            setupMapLayers(map);
        });

        map.on('click', (e) => {
            handleMapClick(e, map);
        });

        return () => {
            map.remove();
        };
    }, [activeBasemap]);

    // ─── 6. إعداد مصادر البيانات والطبقات في الخريطة ───────────────────────
    const setupMapLayers = (map) => {
        // طبقة الرسم الإرشادي المؤقتة
        map.addSource('dt-drawing-source', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] }
        });

        map.addLayer({
            id: 'dt-drawing-line',
            type: 'line',
            source: 'dt-drawing-source',
            paint: {
                'line-color': '#10b981',
                'line-width': 3,
                'line-dasharray': [2, 2]
            }
        });

        map.addLayer({
            id: 'dt-drawing-polygon',
            type: 'fill',
            source: 'dt-drawing-source',
            paint: {
                'fill-color': '#10b981',
                'fill-opacity': 0.3
            }
        });

        // طبقة رندرة الشوارع المرسومة يدوياً
        map.addSource('dt-custom-streets-source', {
            type: 'geojson',
            data: getStreetsGeoJSON()
        });

        // رصيف الشارع الأساسي (الأسفلت الداكن)
        map.addLayer({
            id: 'dt-custom-streets-base',
            type: 'line',
            source: 'dt-custom-streets-source',
            paint: {
                'line-color': '#1e293b',
                'line-width': [
                    'interpolate', ['linear'], ['zoom'],
                    14, 5,
                    17, 14,
                    20, 32
                ]
            }
        });

        // خط الحارة الفاصل (الإنارة المتقطعة الصفراء)
        map.addLayer({
            id: 'dt-custom-streets-stripe',
            type: 'line',
            source: 'dt-custom-streets-source',
            paint: {
                'line-color': '#f59e0b',
                'line-width': 1.5,
                'line-dasharray': [3, 4]
            }
        });

        // فحص المباني ثنائية الأبعاد وتجسيمها في MapLibre
        if (geojsonData) {
            const polygonsOnly = {
                type: "FeatureCollection",
                features: (geojsonData.type === 'FeatureCollection' ? geojsonData.features : [geojsonData])
                    .filter(f => f.geometry.type.includes('Polygon'))
            };

            map.addSource('dt-buildings-source', {
                type: 'geojson',
                data: polygonsOnly
            });

            let fillColor = '#10b981';
            let fillOpacity = 0.85;

            if (buildingTheme === 'glassmorphic') {
                fillColor = '#38bdf8';
                fillOpacity = 0.55;
            } else if (buildingTheme === 'neon') {
                fillColor = '#ec4899';
                fillOpacity = 0.9;
            }

            map.addLayer({
                id: 'dt-buildings-3d',
                type: 'fill-extrusion',
                source: 'dt-buildings-source',
                paint: {
                    'fill-extrusion-color': [
                        'coalesce',
                        ['get', 'color'],
                        fillColor
                    ],
                    'fill-extrusion-height': [
                        'coalesce',
                        ['get', heightProp],
                        ['get', 'height'],
                        defaultHeight
                    ],
                    'fill-extrusion-base': [
                        'coalesce',
                        ['get', 'min_height'],
                        ['get', 'base_height'],
                        0
                    ],
                    'fill-extrusion-opacity': fillOpacity
                }
            });

            // كليك للتفتيش عن المبنى
            map.on('click', 'dt-buildings-3d', (e) => {
                if (e.features && e.features.length > 0) {
                    const feat = e.features[0];
                    setSelectedFeature({
                        type: 'building-base',
                        id: feat.id || Math.random().toString(),
                        properties: feat.properties,
                        coords: e.lngLat
                    });
                }
            });
        }

        // دمج طبقة Three.js للمباني المكسوة والنقاط المخصصة
        addThreeJsCustomLayer(map);
    };

    // تحديث الشوارع المرسومة ديناميكياً
    const getStreetsGeoJSON = () => {
        return {
            type: 'FeatureCollection',
            features: customStreets.map(st => ({
                type: 'Feature',
                properties: { name: st.name, width: st.width || 8 },
                geometry: { type: 'LineString', coordinates: st.coordinates }
            }))
        };
    };

    useEffect(() => {
        const map = mapRef.current;
        if (map && map.getSource('dt-custom-streets-source')) {
            map.getSource('dt-custom-streets-source').setData(getStreetsGeoJSON());
        }
    }, [customStreets]);

    // تحديث خط الرسم المؤقت بالخريطة
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !map.getSource('dt-drawing-source')) return;

        let geom = null;
        if (drawnCoords.length > 0) {
            if (drawMode === 'street') {
                geom = { type: 'LineString', coordinates: drawnCoords };
            } else if (drawMode === 'building') {
                const closed = [...drawnCoords];
                if (drawnCoords.length > 2) {
                    closed.push(drawnCoords[0]);
                }
                geom = { type: 'Polygon', coordinates: [closed] };
            }
        }

        map.getSource('dt-drawing-source').setData({
            type: 'FeatureCollection',
            features: geom ? [{ type: 'Feature', geometry: geom, properties: {} }] : []
        });
    }, [drawnCoords, drawMode]);

    // ─── 7. معالجة الأحداث والضغط على الخريطة ─────────────────────────────
    const handleMapClick = (e, map) => {
        // إذا كنا في وضع رسم مضلع أو خط
        if (drawMode === 'building' || drawMode === 'street') {
            setDrawnCoords(prev => [...prev, [e.lngLat.lng, e.lngLat.lat]]);
            return;
        }

        // وضع إسقاط مجسم سريع للمسؤول (Admin placement)
        if (drawMode === 'point') {
            const newPt = {
                type: "Feature",
                properties: {
                    name: `${selectedPlacementType} مضاف حديثاً`,
                    type: selectedPlacementType,
                    scale: 1.0,
                    rotation: 0,
                    offsetX: 0,
                    offsetY: 0
                },
                geometry: {
                    type: "Point",
                    coordinates: [e.lngLat.lng, e.lngLat.lat]
                }
            };
            setCustomPoints(prev => [...prev, newPt]);
            setDrawMode('none');
            return;
        }

        // فحص كائن نقطة
        const allPoints = [];
        if (geojsonData) {
            const features = geojsonData.type === 'FeatureCollection' ? geojsonData.features : [geojsonData];
            features.forEach((f, idx) => {
                if (f.geometry.type === 'Point') {
                    allPoints.push({ ...f, id: `base-${idx}`, isCustom: false });
                }
            });
        }
        customPoints.forEach((p, idx) => {
            allPoints.push({ ...p, id: `custom-${idx}`, isCustom: true });
        });

        let closest = null;
        let minDist = 0.00018; 

        allPoints.forEach(p => {
            const ptCoords = p.geometry.coordinates;
            const dist = Math.sqrt(Math.pow(ptCoords[0] - e.lngLat.lng, 2) + Math.pow(ptCoords[1] - e.lngLat.lat, 2));
            if (dist < minDist) {
                minDist = dist;
                closest = p;
            }
        });

        if (closest) {
            setSelectedFeature({
                type: 'point',
                id: closest.id,
                isCustom: closest.isCustom,
                properties: closest.properties,
                coords: e.lngLat,
                geometry: closest.geometry
            });
            // تحميل قيم التعديل للوحة التحكم
            setEditScale(closest.properties.scale || 1.0);
            setEditRotation(closest.properties.rotation || 0);
            setEditOffsetX(closest.properties.offsetX || 0);
            setEditOffsetY(closest.properties.offsetY || 0);
            return;
        }

        // فحص مبنى مرسوم بالنقاط في الفضاء المحلي للـ ThreeJS
        let closestBuilding = null;
        let bldMinDist = 0.0002;
        customBuildings.forEach((bld, idx) => {
            const sum = bld.coordinates.reduce((acc, c) => [acc[0] + c[0], acc[1] + c[1]], [0, 0]);
            const center = [sum[0] / bld.coordinates.length, sum[1] / bld.coordinates.length];
            const dist = Math.sqrt(Math.pow(center[0] - e.lngLat.lng, 2) + Math.pow(center[1] - e.lngLat.lat, 2));
            if (dist < bldMinDist) {
                bldMinDist = dist;
                closestBuilding = { ...bld, index: idx };
            }
        });

        if (closestBuilding) {
            setSelectedFeature({
                type: 'custom-building',
                id: closestBuilding.id,
                index: closestBuilding.index,
                properties: closestBuilding,
                coords: e.lngLat
            });
            setEditHeight(closestBuilding.height);
            setEditSkin(closestBuilding.skin);
            setEditSolarRoof(closestBuilding.solarRoof);
            setEditColor(closestBuilding.color);
            return;
        }
    };

    // ─── 8. طبقة الرندر ثلاثي الأبعاد المخصصة (Three.js Layer) ─────────────────
    const addThreeJsCustomLayer = (map) => {
        const anchorMerc = maplibregl.MercatorCoordinate.fromLngLat(centerCoords, 0);
        const meterScale = anchorMerc.meterInMercatorCoordinateUnits();

        const customLayer = {
            id: 'threejs-digital-twin-layer',
            type: 'custom',
            renderingMode: '3d',
            onAdd: function (mapInstance, gl) {
                this.camera = new THREE.Camera();
                this.scene = new THREE.Scene();

                const ambient = new THREE.AmbientLight(0xffffff, 0.7);
                this.scene.add(ambient);
                threeLightsRef.current.ambient = ambient;

                const sun = new THREE.DirectionalLight(0xffffff, 1.2);
                sun.position.set(50, 100, 50);
                this.scene.add(sun);
                threeLightsRef.current.sun = sun;

                threeSceneRef.current = this.scene;

                this.renderer = new THREE.WebGLRenderer({
                    canvas: mapInstance.getCanvas(),
                    context: gl,
                    antialias: true
                });
                this.renderer.autoClear = false;

                buildThreeJsScene();
            },
            render: function (gl, matrix) {
                if (autoTour) {
                    const currentBearing = mapInstance.getBearing();
                    mapInstance.setBearing(currentBearing + 0.08);
                }

                const m = new THREE.Matrix4().fromArray(matrix);
                const l = new THREE.Matrix4()
                    .makeTranslation(anchorMerc.x, anchorMerc.y, anchorMerc.z)
                    .scale(new THREE.Vector3(meterScale, -meterScale, meterScale));

                this.camera.projectionMatrix = m.multiply(l);

                timeRef.current += 0.015;
                
                animatedRotorsRef.current.forEach(rotor => {
                    rotor.rotation.z += 0.08;
                });

                animatedBeaconsRef.current.forEach(beacon => {
                    const pulse = 1.0 + Math.sin(timeRef.current * 4) * 0.15;
                    beacon.scale.set(pulse, 1.0, pulse);
                });

                this.renderer.resetState();
                this.renderer.render(this.scene, this.camera);
                
                mapInstance.triggerRepaint();
            }
        };

        map.addLayer(customLayer);
    };

    // ─── 9. إنشاء وتحديث الكائنات والمباني المكسوة بالخامات ثلاثية الأبعاد ──────
    const buildThreeJsScene = () => {
        const scene = threeSceneRef.current;
        if (!scene) return;

        // مسح الكائنات القديمة
        meshesMapRef.current.forEach(mesh => scene.remove(mesh));
        meshesMapRef.current.clear();
        animatedRotorsRef.current = [];
        animatedBeaconsRef.current = [];

        const anchorMerc = maplibregl.MercatorCoordinate.fromLngLat(centerCoords, 0);
        const meterScale = anchorMerc.meterInMercatorCoordinateUnits();
        const isNight = timeOfDay < 6 || timeOfDay > 18;

        // أ. رندرة المباني المخصصة والمكسوة بالخامات الواقعية (Custom Extruded Buildings)
        customBuildings.forEach((bld, idx) => {
            if (bld.coordinates.length < 3) return;

            const shape = new THREE.Shape();
            
            // تحويل الإحداثيات الجغرافية المحلية إلى إحداثيات مترية حول الارتكاز
            const localPoints = bld.coordinates.map(coord => {
                const pMerc = maplibregl.MercatorCoordinate.fromLngLat(coord, 0);
                const dx = (pMerc.x - anchorMerc.x) / meterScale;
                const dy = -(pMerc.y - anchorMerc.y) / meterScale;
                return new THREE.Vector2(dx, dy);
            });

            shape.moveTo(localPoints[0].x, localPoints[0].y);
            for (let i = 1; i < localPoints.length; i++) {
                shape.lineTo(localPoints[i].x, localPoints[i].y);
            }
            shape.closePath();

            // تجسيم المبنى واقعياً
            const height = bld.height || 15;
            const extrudeSettings = {
                depth: height,
                bevelEnabled: false
            };

            const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

            // إعداد خامات الواجهة والخامات العلوية للسطح
            const wallTexture = getProceduralTexture(bld.skin || 'glass', bld.color || '#3b82f6', isNight);
            const wallMaterial = new THREE.MeshLambertMaterial({
                map: wallTexture,
                color: bld.color ? new THREE.Color(bld.color) : 0xffffff
            });

            // خامة السطح (أما إسفلت/خرسانة مظلمة أو ألواح شمسية ذكية)
            let roofMaterial;
            if (bld.solarRoof) {
                const solarTexture = getProceduralTexture('solar', '#ffffff', false);
                roofMaterial = new THREE.MeshLambertMaterial({ map: solarTexture });
            } else {
                roofMaterial = new THREE.MeshLambertMaterial({ color: 0x222d3d }); // سقف عادي داكن
            }

            // ExtrudeGeometry ينشئ مجموعتين من المواد: مجموعة 0 للأسقف والمجموعة 1 للجدران
            const materials = [roofMaterial, wallMaterial];
            const mesh = new THREE.Mesh(geometry, materials);

            scene.add(mesh);
            meshesMapRef.current.set(`bld-${bld.id || idx}`, mesh);
        });

        // ب. رندرة النقاط ثلاثية الأبعاد (Trees, Cars, Lights, etc.)
        const allPoints = [];
        if (geojsonData) {
            const features = geojsonData.type === 'FeatureCollection' ? geojsonData.features : [geojsonData];
            features.forEach((f, idx) => {
                if (f.geometry.type === 'Point') {
                    allPoints.push({ ...f, id: `base-${idx}` });
                }
            });
        }
        customPoints.forEach((p, idx) => {
            allPoints.push({ ...p, id: `custom-${idx}` });
        });

        allPoints.forEach((p) => {
            const coords = p.geometry.coordinates;
            const pMerc = maplibregl.MercatorCoordinate.fromLngLat(coords, 0);

            // الإحداثيات الجغرافية الأساسية
            let dx = (pMerc.x - anchorMerc.x) / meterScale;
            let dy = -(pMerc.y - anchorMerc.y) / meterScale;

            // تطبيق إزاحة التعديل للمسؤول (X, Y Offset in meters)
            dx += p.properties?.offsetX || 0;
            dy += p.properties?.offsetY || 0;

            const type = p.properties?.type || 'tree';
            const mapping = pointMappings[type] || { model: 'tree', scale: 1.0, color: '#10b981' };

            const group = new THREE.Group();
            group.position.set(dx, dy, 0);
            
            // تطبيق دوران وحجم التعديل
            const scaleVal = (p.properties?.scale || 1.0) * (mapping.scale || 1.0);
            group.scale.set(scaleVal, scaleVal, scaleVal);
            
            const rotationDeg = p.properties?.rotation || 0;
            group.rotation.z = (rotationDeg * Math.PI) / 180;

            buildProceduralModel(type, group, mapping.color, isNight);

            scene.add(group);
            meshesMapRef.current.set(`pt-${p.id}`, group);
        });

        updateEnvironmentLighting(isNight);
    };

    // مراقبة التغييرات لإعادة التجسيم
    useEffect(() => {
        buildThreeJsScene();
    }, [geojsonData, customPoints, customBuildings, pointMappings, timeOfDay, buildingTheme]);

    // ─── 10. بناء المجسمات ثلاثية الأبعاد تفاعلياً ───────────────────────────
    const buildProceduralModel = (type, group, colorHex, isNight) => {
        const matColor = new THREE.Color(colorHex);

        switch (type) {
            case 'tree': {
                const trunkGeo = new THREE.CylinderGeometry(0.15, 0.22, 1.2, 5);
                const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5c4033 });
                const trunk = new THREE.Mesh(trunkGeo, trunkMat);
                trunk.position.z = 0.6;
                trunk.rotation.x = Math.PI / 2;
                group.add(trunk);

                const leavesMat = new THREE.MeshLambertMaterial({ color: matColor });
                const foliage1 = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.4, 5), leavesMat);
                foliage1.position.z = 1.6;
                foliage1.rotation.x = Math.PI / 2;
                group.add(foliage1);

                const foliage2 = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.0, 5), leavesMat);
                foliage2.position.z = 2.3;
                foliage2.rotation.x = Math.PI / 2;
                group.add(foliage2);
                break;
            }
            case 'car': {
                const bodyGeo = new THREE.BoxGeometry(1.2, 2.2, 0.6);
                const bodyMat = new THREE.MeshLambertMaterial({ color: matColor });
                const body = new THREE.Mesh(bodyGeo, bodyMat);
                body.position.z = 0.45;
                group.add(body);

                const cabinGeo = new THREE.BoxGeometry(1.0, 1.1, 0.45);
                const cabinMat = new THREE.MeshPhysicalMaterial({
                    color: 0x111e2e,
                    transparent: true,
                    opacity: 0.8,
                    roughness: 0.1,
                    transmission: 0.6
                });
                const cabin = new THREE.Mesh(cabinGeo, cabinMat);
                cabin.position.set(0, 0.1, 0.95);
                group.add(cabin);

                const wheelGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.25, 8);
                const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
                const wheelPositions = [
                    [-0.6, 0.7, 0.24], [0.6, 0.7, 0.24],
                    [-0.6, -0.7, 0.24], [0.6, -0.7, 0.24]
                ];
                wheelPositions.forEach(pos => {
                    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
                    wheel.position.set(pos[0], pos[1], pos[2]);
                    wheel.rotation.z = Math.PI / 2;
                    group.add(wheel);
                });
                break;
            }
            case 'streetlight': {
                const poleGeo = new THREE.CylinderGeometry(0.06, 0.08, 4.0, 6);
                const poleMat = new THREE.MeshLambertMaterial({ color: 0x4f5d75 });
                const pole = new THREE.Mesh(poleGeo, poleMat);
                pole.position.z = 2.0;
                pole.rotation.x = Math.PI / 2;
                group.add(pole);

                const headGeo = new THREE.BoxGeometry(0.18, 0.6, 0.12);
                const head = new THREE.Mesh(headGeo, poleMat);
                head.position.set(0, 0.24, 4.0);
                group.add(head);

                const bulbGeo = new THREE.SphereGeometry(0.15, 6, 6);
                const bulbMat = new THREE.MeshBasicMaterial({ color: isNight ? 0xffeaad : 0xdddddd });
                const bulb = new THREE.Mesh(bulbGeo, bulbMat);
                bulb.position.set(0, 0.45, 3.9);
                group.add(bulb);

                if (isNight) {
                    const coneGeo = new THREE.ConeGeometry(1.6, 4.0, 8, 1, true);
                    const coneMat = new THREE.MeshBasicMaterial({
                        color: 0xffeaad,
                        transparent: true,
                        opacity: 0.18,
                        side: THREE.DoubleSide
                    });
                    const cone = new THREE.Mesh(coneGeo, coneMat);
                    cone.position.set(0, 0.45, 1.9);
                    cone.rotation.x = Math.PI / 2;
                    group.add(cone);
                }
                break;
            }
            case 'wind_turbine': {
                const towerGeo = new THREE.CylinderGeometry(0.1, 0.25, 7.0, 8);
                const towerMat = new THREE.MeshLambertMaterial({ color: 0xeeeeee });
                const tower = new THREE.Mesh(towerGeo, towerMat);
                tower.position.z = 3.5;
                tower.rotation.x = Math.PI / 2;
                group.add(tower);

                const generatorGeo = new THREE.BoxGeometry(0.4, 0.8, 0.4);
                const generator = new THREE.Mesh(generatorGeo, towerMat);
                generator.position.set(0, 0, 7.0);
                group.add(generator);

                const rotorGroup = new THREE.Group();
                rotorGroup.position.set(0, 0.4, 7.0);
                
                const bladeGeo = new THREE.BoxGeometry(0.12, 3.2, 0.04);
                for (let i = 0; i < 3; i++) {
                    const blade = new THREE.Mesh(bladeGeo, towerMat);
                    blade.rotation.z = (i * Math.PI * 2) / 3;
                    blade.position.y = 1.2;
                    const bladeContainer = new THREE.Group();
                    bladeContainer.rotation.z = (i * Math.PI * 2) / 3;
                    bladeContainer.add(blade);
                    rotorGroup.add(bladeContainer);
                }
                group.add(rotorGroup);
                animatedRotorsRef.current.push(rotorGroup);
                break;
            }
            case 'traffic_light': {
                const poleGeo = new THREE.CylinderGeometry(0.08, 0.08, 3.2, 6);
                const poleMat = new THREE.MeshLambertMaterial({ color: 0x1f2937 });
                const pole = new THREE.Mesh(poleGeo, poleMat);
                pole.position.z = 1.6;
                pole.rotation.x = Math.PI / 2;
                group.add(pole);

                const boxGeo = new THREE.BoxGeometry(0.3, 0.3, 0.9);
                const box = new THREE.Mesh(boxGeo, poleMat);
                box.position.set(0, 0, 2.8);
                group.add(box);

                const lightGeo = new THREE.SphereGeometry(0.08, 6, 6);
                const rLight = new THREE.Mesh(lightGeo, new THREE.MeshBasicMaterial({ color: 0xff0000 }));
                rLight.position.set(0, 0.16, 3.1);
                group.add(rLight);

                const yLight = new THREE.Mesh(lightGeo, new THREE.MeshBasicMaterial({ color: 0x665500 }));
                yLight.position.set(0, 0.16, 2.8);
                group.add(yLight);

                const gLight = new THREE.Mesh(lightGeo, new THREE.MeshBasicMaterial({ color: 0x006600 }));
                gLight.position.set(0, 0.16, 2.5);
                group.add(gLight);
                break;
            }
            case 'cctv': {
                const poleGeo = new THREE.CylinderGeometry(0.05, 0.05, 3.0, 6);
                const poleMat = new THREE.MeshLambertMaterial({ color: 0x374151 });
                const pole = new THREE.Mesh(poleGeo, poleMat);
                pole.position.z = 1.5;
                pole.rotation.x = Math.PI / 2;
                group.add(pole);

                const headGeo = new THREE.BoxGeometry(0.12, 0.35, 0.12);
                const head = new THREE.Mesh(headGeo, poleMat);
                head.position.set(0, 0.12, 3.0);
                head.rotation.x = -Math.PI / 6;
                group.add(head);
                break;
            }
            case 'beacon': {
                const baseGeo = new THREE.CylinderGeometry(0.4, 0.5, 0.15, 8);
                const baseMat = new THREE.MeshLambertMaterial({ color: 0x1f2937 });
                const base = new THREE.Mesh(baseGeo, baseMat);
                base.position.z = 0.075;
                base.rotation.x = Math.PI / 2;
                group.add(base);

                const beamGeo = new THREE.CylinderGeometry(0.24, 0.24, 3.0, 8, 1, true);
                const beamMat = new THREE.MeshBasicMaterial({
                    color: matColor,
                    transparent: true,
                    opacity: 0.45,
                    side: THREE.DoubleSide
                });
                const beam = new THREE.Mesh(beamGeo, beamMat);
                beam.position.z = 1.5;
                beam.rotation.x = Math.PI / 2;
                group.add(beam);

                animatedBeaconsRef.current.push(beam);
                break;
            }
            case 'bench':
            default: {
                const woodGeo = new THREE.BoxGeometry(0.8, 1.5, 0.08);
                const woodMat = new THREE.MeshLambertMaterial({ color: 0x8b5a2b });
                const seat = new THREE.Mesh(woodGeo, woodMat);
                seat.position.set(0, 0, 0.4);
                group.add(seat);

                const legGeo = new THREE.BoxGeometry(0.1, 0.1, 0.4);
                const legMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
                const legPositions = [
                    [-0.35, 0.6, 0.2], [0.35, 0.6, 0.2],
                    [-0.35, -0.6, 0.2], [0.35, -0.6, 0.2]
                ];
                legPositions.forEach(pos => {
                    const leg = new THREE.Mesh(legGeo, legMat);
                    leg.position.set(pos[0], pos[1], pos[2]);
                    group.add(leg);
                });
                break;
            }
        }
    };

    const updateEnvironmentLighting = (isNight) => {
        const lights = threeLightsRef.current;
        if (!lights.ambient || !lights.sun) return;

        if (isNight) {
            lights.ambient.color.setHex(0x1a243d);
            lights.ambient.intensity = 0.25;

            lights.sun.color.setHex(0x90a0c7);
            lights.sun.intensity = 0.35;
            lights.sun.position.set(-30, 80, -30);
        } else {
            const factor = 1.0 - Math.abs(timeOfDay - 12) / 6; 
            const boundedFactor = Math.max(0.15, Math.min(1.0, factor));

            const ambientColor = new THREE.Color().lerpColors(
                new THREE.Color(0xfcac3b), 
                new THREE.Color(0xffffff), 
                boundedFactor
            );

            lights.ambient.color.copy(ambientColor);
            lights.ambient.intensity = 0.4 + boundedFactor * 0.45;

            lights.sun.color.copy(ambientColor);
            lights.sun.intensity = 0.3 + boundedFactor * 1.1;

            const rad = ((timeOfDay - 6) * Math.PI) / 12;
            lights.sun.position.set(Math.cos(rad) * 100, Math.sin(rad) * 100, 20);
        }

        const scene = threeSceneRef.current;
        if (scene) {
            if (weather === 'foggy') {
                const fogCol = isNight ? 0x0a101e : 0xd1dbe4;
                scene.fog = new THREE.FogExp2(fogCol, 0.012);
            } else if (weather === 'rain') {
                const fogCol = isNight ? 0x050a12 : 0x6e788c;
                scene.fog = new THREE.FogExp2(fogCol, 0.008);
            } else {
                scene.fog = null;
            }
        }
    };

    // استدعاء البيئة عند التغيير
    useEffect(() => {
        const isNight = timeOfDay < 6 || timeOfDay > 18;
        updateEnvironmentLighting(isNight);
    }, [timeOfDay, weather]);

    // ─── 11. تحديث وتعديل تعيين العناصر وتأكيد حفظ التعديل الدقيق ────────
    const updateMapping = (type, key, val) => {
        setPointMappings(prev => ({
            ...prev,
            [type]: {
                ...prev[type],
                [key]: val
            }
        }));
    };

    // حفظ تعديل إزاحة أو حجم أو تدوير الكائن المحدد
    const handleSaveObjectEdits = () => {
        if (!selectedFeature || selectedFeature.type !== 'point') return;
        
        const isCustom = selectedFeature.isCustom;
        const idIdx = parseInt(selectedFeature.id.split('-')[1]);

        if (isCustom) {
            setCustomPoints(prev => {
                const copy = [...prev];
                if (copy[idIdx]) {
                    copy[idIdx].properties = {
                        ...copy[idIdx].properties,
                        scale: editScale,
                        rotation: editRotation,
                        offsetX: editOffsetX,
                        offsetY: editOffsetY
                    };
                }
                return copy;
            });
        } else {
            // كائنات أساسية من ملف الـ GeoJSON
            setGeojsonData(prev => {
                if (!prev) return prev;
                const copy = { ...prev };
                if (copy.features && copy.features[idIdx]) {
                    copy.features[idIdx].properties = {
                        ...copy.features[idIdx].properties,
                        scale: editScale,
                        rotation: editRotation,
                        offsetX: editOffsetX,
                        offsetY: editOffsetY
                    };
                }
                return copy;
            });
        }
        
        setSelectedFeature(null);
        buildThreeJsScene();
    };

    // حفظ تعديل خصائص المبنى المرسوم يدوياً
    const handleSaveBuildingEdits = () => {
        if (!selectedFeature || selectedFeature.type !== 'custom-building') return;

        const idx = selectedFeature.index;
        setCustomBuildings(prev => {
            const copy = [...prev];
            if (copy[idx]) {
                copy[idx] = {
                    ...copy[idx],
                    height: editHeight,
                    skin: editSkin,
                    solarRoof: editSolarRoof,
                    color: editColor
                };
            }
            return copy;
        });

        setSelectedFeature(null);
        buildThreeJsScene();
    };

    // حذف الكائنات المحددة
    const handleDeleteObject = () => {
        if (!selectedFeature) return;

        if (selectedFeature.type === 'point' && selectedFeature.isCustom) {
            const idx = parseInt(selectedFeature.id.split('-')[1]);
            setCustomPoints(prev => prev.filter((_, i) => i !== idx));
        } else if (selectedFeature.type === 'custom-building') {
            const idx = selectedFeature.index;
            setCustomBuildings(prev => prev.filter((_, i) => i !== idx));
        }

        setSelectedFeature(null);
        buildThreeJsScene();
    };

    // ─── 12. معالجة وإنهاء رسم الأشكال الهندسية (المباني والشوارع) ──────────
    const handleFinishDrawing = () => {
        if (drawnCoords.length < 2) {
            alert('يرجى تحديد نقطتين على الأقل للرسم.');
            return;
        }

        if (drawMode === 'building') {
            if (drawnCoords.length < 3) {
                alert('المبنى يتطلب 3 نقاط على الأقل.');
                return;
            }
            // إغلاق المضلع
            const closedCoords = [...drawnCoords, drawnCoords[0]];
            const newBld = {
                id: `bld-drawn-${Date.now()}`,
                name: `مبنى مرسوم #${customBuildings.length + 1}`,
                height: 15,
                skin: 'glass',
                solarRoof: true,
                color: '#3b82f6',
                coordinates: closedCoords
            };
            setCustomBuildings(prev => [...prev, newBld]);
        } else if (drawMode === 'street') {
            const newStreet = {
                id: `st-drawn-${Date.now()}`,
                name: `شارع مرسوم #${customStreets.length + 1}`,
                width: editStreetWidth,
                style: editStreetStyle,
                coordinates: drawnCoords
            };
            setCustomStreets(prev => [...prev, newStreet]);
        }

        setDrawMode('none');
        setDrawnCoords([]);
    };

    const handleCancelDrawing = () => {
        setDrawMode('none');
        setDrawnCoords([]);
    };

    return (
        <div className="dt-container">
            {/* واجهة إرشادية عند الرسم النشط (Drawing HUD) */}
            {drawMode !== 'none' && (
                <div className="dt-placement-indicator">
                    <span>
                        {drawMode === 'building' ? '📐 وضع رسم مبنى' : drawMode === 'street' ? '🛣️ وضع رسم شارع' : '📍 وضع إسقاط مجسم'}
                        {drawMode !== 'point' && ` — تم تحديد (${drawnCoords.length}) نقاط.`}
                    </span>
                    <div className="dt-placement-actions">
                        {drawMode !== 'point' && (
                            <button className="dt-btn-hud-save" onClick={handleFinishDrawing}>إنهاء وحفظ الطبقة</button>
                        )}
                        <button className="dt-btn-hud-cancel" onClick={handleCancelDrawing}>إلغاء</button>
                    </div>
                </div>
            )}

            {/* شريط العنوان */}
            <div className="dt-header">
                <div className="dt-header-title">
                    <div className="dt-header-icon">🌐</div>
                    <div>
                        <h2>محرر التوأم الرقمي الواقعي</h2>
                    </div>
                </div>
                <div className="dt-header-actions">
                    <button className="dt-btn-primary" style={{ width: 'auto', padding: '8px 16px', fontSize: '0.8rem' }} onClick={exportProject} disabled={!geojsonData && customBuildings.length === 0}>
                        📥 تصدير المشروع
                    </button>
                    <button className="dt-close-btn" onClick={onClose}>✕</button>
                </div>
            </div>

            {/* فضاء العمل والخرائط */}
            <div className="dt-workspace">
                <div className="dt-map-viewport" ref={mapContainerRef} />

                {/* لوحة فحص وتعديل الكائنات الدقيق (Inspector Panel) */}
                {selectedFeature && (
                    <div className="dt-inspector">
                        <div className="dt-inspector-header">
                            <span className="dt-inspector-title">🔎 فاحص العناصر والطبقات</span>
                            <button className="dt-inspector-close" onClick={() => setSelectedFeature(null)}>✕</button>
                        </div>
                        <div className="dt-inspector-body">
                            {/* فحص النقاط وتعديل الإحداثيات والدوران للمسؤول */}
                            {selectedFeature.type === 'point' && (
                                <>
                                    <div className="dt-section" style={{ borderBottom: 'none', paddingBottom: '0' }}>
                                        <div className="dt-inspector-prop">
                                            <span className="dt-inspector-prop-name">النوع</span>
                                            <span className="dt-inspector-prop-val" style={{ color: 'var(--dt-emerald)' }}>كائن جيو-مكاني</span>
                                        </div>
                                        <div className="dt-inspector-prop">
                                            <span className="dt-inspector-prop-name">التصنيف</span>
                                            <span className="dt-inspector-prop-val">{selectedFeature.properties?.type}</span>
                                        </div>
                                        {selectedFeature.properties?.name && (
                                            <div className="dt-inspector-prop">
                                                <span className="dt-inspector-prop-name">الاسم</span>
                                                <span className="dt-inspector-prop-val">{selectedFeature.properties.name}</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="dt-section" style={{ borderBottom: 'none', paddingBottom: '0' }}>
                                        <span className="dt-section-title" style={{ fontSize: '0.85rem' }}>🔧 التحكم بالدوران والحجم</span>
                                        <div className="dt-input-group">
                                            <label>حجم الكائن: {editScale.toFixed(1)}x</label>
                                            <div className="dt-slider-container">
                                                <input type="range" className="dt-slider" min="0.3" max="4.0" step="0.1" value={editScale} onChange={e => setEditScale(parseFloat(e.target.value))} />
                                                <span className="dt-slider-val">{editScale.toFixed(1)}x</span>
                                            </div>
                                        </div>
                                        <div className="dt-input-group">
                                            <label>زاوية الدوران: {editRotation}°</label>
                                            <div className="dt-slider-container">
                                                <input type="range" className="dt-slider" min="0" max="360" value={editRotation} onChange={e => setEditRotation(parseInt(e.target.value))} />
                                                <span className="dt-slider-val">{editRotation}°</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="dt-section" style={{ borderBottom: 'none', paddingBottom: '0' }}>
                                        <span className="dt-section-title" style={{ fontSize: '0.85rem' }}>🎯 إزاحة الموقع الجغرافي الدقيقة</span>
                                        <div className="dt-input-group">
                                            <label>إزاحة شرقاً/غرباً (X Offset): {editOffsetX} متر</label>
                                            <div className="dt-slider-container">
                                                <input type="range" className="dt-slider" min="-15" max="15" step="0.5" value={editOffsetX} onChange={e => setEditOffsetX(parseFloat(e.target.value))} />
                                                <span className="dt-slider-val">{editOffsetX} م</span>
                                            </div>
                                        </div>
                                        <div className="dt-input-group">
                                            <label>إزاحة شمالاً/جنوباً (Y Offset): {editOffsetY} متر</label>
                                            <div className="dt-slider-container">
                                                <input type="range" className="dt-slider" min="-15" max="15" step="0.5" value={editOffsetY} onChange={e => setEditOffsetY(parseFloat(e.target.value))} />
                                                <span className="dt-slider-val">{editOffsetY} م</span>
                                            </div>
                                        </div>
                                    </div>

                                    <button className="dt-btn-primary" style={{ marginBottom: '8px' }} onClick={handleSaveObjectEdits}>💾 حفظ التعديلات</button>
                                    {selectedFeature.isCustom && (
                                        <button className="dt-btn-danger" style={{ width: '100%' }} onClick={handleDeleteObject}>🗑️ حذف هذا الكائن</button>
                                    )}
                                </>
                            )}

                            {/* فحص وتعديل المباني المرسومة وخاماتها */}
                            {selectedFeature.type === 'custom-building' && (
                                <>
                                    <div className="dt-section" style={{ borderBottom: 'none', paddingBottom: '0' }}>
                                        <div className="dt-inspector-prop">
                                            <span className="dt-inspector-prop-name">الاسم</span>
                                            <span className="dt-inspector-prop-val">{selectedFeature.properties?.name}</span>
                                        </div>
                                        <div className="dt-inspector-prop">
                                            <span className="dt-inspector-prop-name">النوع</span>
                                            <span className="dt-inspector-prop-val" style={{ color: 'var(--dt-emerald)' }}>مبنى مخصص ثلاثي الأبعاد</span>
                                        </div>
                                    </div>

                                    <div className="dt-section" style={{ borderBottom: 'none', paddingBottom: '0' }}>
                                        <span className="dt-section-title" style={{ fontSize: '0.85rem' }}>🏬 إعدادات التجسيم والارتفاع</span>
                                        <div className="dt-input-group">
                                            <label>الارتفاع: {editHeight} متر</label>
                                            <div className="dt-slider-container">
                                                <input type="range" className="dt-slider" min="3" max="90" value={editHeight} onChange={e => setEditHeight(parseInt(e.target.value))} />
                                                <span className="dt-slider-val">{editHeight} م</span>
                                            </div>
                                        </div>
                                        <div className="dt-input-group" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <input type="checkbox" id="solar-chk" checked={editSolarRoof} onChange={e => setEditSolarRoof(e.target.checked)} />
                                            <label htmlFor="solar-chk" style={{ marginBottom: '0', cursor: 'pointer' }}>تثبيت ألواح شمسية على السطح (Solar Roof)</label>
                                        </div>
                                    </div>

                                    <div className="dt-section" style={{ borderBottom: 'none', paddingBottom: '0' }}>
                                        <span className="dt-section-title" style={{ fontSize: '0.85rem' }}>🧱 نسيج وإكساء الواجهة الخارجي (Facade Skins)</span>
                                        <div className="dt-skin-grid">
                                            <div className={`dt-skin-card ${editSkin === 'glass' ? 'active' : ''}`} onClick={() => setEditSkin('glass')}>
                                                <div className="dt-skin-preview" style={{ background: 'linear-gradient(45deg, #0284c7, #38bdf8)' }} />
                                                <span className="dt-skin-label">زجاج معزول</span>
                                            </div>
                                            <div className={`dt-skin-card ${editSkin === 'brick' ? 'active' : ''}`} onClick={() => setEditSkin('brick')}>
                                                <div className="dt-skin-preview" style={{ background: 'linear-gradient(45deg, #b45309, #d97706)' }} />
                                                <span className="dt-skin-label">طوب أحمر</span>
                                            </div>
                                            <div className={`dt-skin-card ${editSkin === 'concrete' ? 'active' : ''}`} onClick={() => setEditSkin('concrete')}>
                                                <div className="dt-skin-preview" style={{ background: 'linear-gradient(45deg, #64748b, #94a3b8)' }} />
                                                <span className="dt-skin-label">خرسانة صناعية</span>
                                            </div>
                                        </div>
                                        {editSkin === 'brick' && (
                                            <div className="dt-input-group" style={{ marginTop: '10px' }}>
                                                <label>لون الطوب الأساسي</label>
                                                <div className="dt-color-picker-wrapper">
                                                    {['#b45309', '#7f1d1d', '#78350f', '#451a03', '#9a3412'].map(c => (
                                                        <div key={c} className={`dt-color-bubble ${editColor === c ? 'active' : ''}`} style={{ backgroundColor: c }} onClick={() => setEditColor(c)} />
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <button className="dt-btn-primary" style={{ marginBottom: '8px' }} onClick={handleSaveBuildingEdits}>💾 حفظ التعديلات</button>
                                    <button className="dt-btn-danger" style={{ width: '100%' }} onClick={handleDeleteObject}>🗑️ حذف هذا المبنى</button>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* زر الطي للوحة التحكم الجانبية */}
                <button className={`dt-sidebar-toggle ${sidebarCollapsed ? 'collapsed' : ''}`} onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
                    {sidebarCollapsed ? '◀' : '▶'}
                </button>

                {/* لوحة التحكم والتحرير الجانبية */}
                <div className={`dt-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
                    <div className="dt-tabs">
                        <button className={`dt-tab-btn ${activeTab === 'data' ? 'active' : ''}`} onClick={() => setActiveTab('data')}>
                            📂 البيانات والمشروع
                        </button>
                        <button className={`dt-tab-btn ${activeTab === 'mapping' ? 'active' : ''}`} onClick={() => setActiveTab('mapping')}>
                            🌲 تعيين ورسم المعالم
                        </button>
                        <button className={`dt-tab-btn ${activeTab === 'visual' ? 'active' : ''}`} onClick={() => setActiveTab('visual')}>
                            🌤️ البيئة والطقس
                        </button>
                    </div>

                    <div className="dt-sidebar-content">
                        {/* 1. تبويب البيانات والمشروع */}
                        {activeTab === 'data' && (
                            <div className="dt-tab-content">
                                <div className="dt-section">
                                    <span className="dt-section-title">رفع ملف المشروع</span>
                                    <div className="dt-upload-area">
                                        <div className="dt-upload-icon">📤</div>
                                        <div className="dt-upload-text">اسحب وأفلت ملف GeoJSON أو مشروع التوأم هنا</div>
                                        <div className="dt-upload-sub">يدعم صيغ .geojson و .json</div>
                                        <input type="file" className="dt-file-input" accept=".geojson,.json" onChange={handleFileUpload} />
                                    </div>
                                    <button className="dt-btn-secondary" onClick={loadSampleData}>
                                        ⚡ تحميل منطقة تجريبية (جامعة بيرزيت)
                                    </button>
                                </div>

                                {(geojsonData || customBuildings.length > 0) && (
                                    <div className="dt-section">
                                        <span className="dt-section-title">تفاصيل البيانات والطبقات</span>
                                        <div className="dt-grid-2">
                                            <div className="dt-card-select">
                                                <div className="dt-card-select-icon" style={{ color: 'var(--dt-emerald)' }}>🏢</div>
                                                <div className="dt-card-select-label">مباني: {stats.polygons}</div>
                                            </div>
                                            <div className="dt-card-select">
                                                <div className="dt-card-select-icon" style={{ color: '#fbab15' }}>📍</div>
                                                <div className="dt-card-select-label">نقاط: {stats.points}</div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="dt-section">
                                    <span className="dt-section-title">المباني الأساسية (MapLibre Extrusions)</span>
                                    <div className="dt-input-group">
                                        <label>مظهر التجسيم الأساسي</label>
                                        <select className="dt-select" value={buildingTheme} onChange={e => setBuildingTheme(e.target.value)}>
                                            <option value="classic">معماري كلاسيكي مصمت</option>
                                            <option value="glassmorphic">زجاجي مائي شفاف</option>
                                            <option value="neon">نيون وهّاج</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 2. تبويب تعيين ورسم المعالم */}
                        {activeTab === 'mapping' && (
                            <div className="dt-tab-content">
                                <div className="dt-section">
                                    <span className="dt-section-title">أدوات رسم وإنشاء المعالم (Draw Tools)</span>
                                    <div className="dt-draw-btn-container">
                                        <button className={`dt-draw-btn ${drawMode === 'building' ? 'active' : ''}`} onClick={() => setDrawMode(drawMode === 'building' ? 'none' : 'building')}>
                                            🏬 رسم مبنى ملموس
                                        </button>
                                        <button className={`dt-draw-btn ${drawMode === 'street' ? 'active' : ''}`} onClick={() => setDrawMode(drawMode === 'street' ? 'none' : 'street')}>
                                            🛣️ رسم شارع أسفلت
                                        </button>
                                    </div>

                                    {drawMode === 'street' && (
                                        <div className="dt-input-group" style={{ marginTop: '12px' }}>
                                            <label>عرض الشارع المراد رسمه: {editStreetWidth} متر</label>
                                            <input type="range" className="dt-slider" min="4" max="18" value={editStreetWidth} onChange={e => setEditStreetWidth(parseInt(e.target.value))} />
                                        </div>
                                    )}

                                    {/* قائمة العناصر التي رسمها المستخدم للتحكم بها */}
                                    {(customBuildings.length > 0 || customStreets.length > 0) && (
                                        <div style={{ marginTop: '16px' }}>
                                            <label style={{ fontSize: '0.78rem', color: 'var(--dt-muted)' }}>الطبقات المرسومة الحالية</label>
                                            <div className="dt-layer-list">
                                                {customBuildings.map((b, i) => (
                                                    <div className="dt-layer-row" key={b.id}>
                                                        <div className="dt-layer-row-info">
                                                            <span className="dt-layer-row-title">{b.name}</span>
                                                            <span className="dt-layer-row-sub">مبنى - ارتفاع {b.height}م ({b.skin === 'glass' ? 'زجاج' : 'طوب'})</span>
                                                        </div>
                                                        <button className="dt-layer-delete" onClick={() => {
                                                            setCustomBuildings(prev => prev.filter(x => x.id !== b.id));
                                                        }}>🗑️</button>
                                                    </div>
                                                ))}
                                                {customStreets.map((s, i) => (
                                                    <div className="dt-layer-row" key={s.id}>
                                                        <div className="dt-layer-row-info">
                                                            <span className="dt-layer-row-title">{s.name}</span>
                                                            <span className="dt-layer-row-sub">طريق إسفلت - عرض {s.width}م</span>
                                                        </div>
                                                        <button className="dt-layer-delete" onClick={() => {
                                                            setCustomStreets(prev => prev.filter(x => x.id !== s.id));
                                                        }}>🗑️</button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="dt-section">
                                    <span className="dt-section-title">إسقاط كائنات المسؤول (Admin Objects Placement)</span>
                                    <div className="dt-grid-2" style={{ marginBottom: '14px' }}>
                                        <button className={`dt-draw-btn ${drawMode === 'point' && selectedPlacementType === 'tree' ? 'active' : ''}`} onClick={() => { setDrawMode('point'); setSelectedPlacementType('tree'); }}>🌲 شجرة</button>
                                        <button className={`dt-draw-btn ${drawMode === 'point' && selectedPlacementType === 'car' ? 'active' : ''}`} onClick={() => { setDrawMode('point'); setSelectedPlacementType('car'); }}>🚗 سيارة</button>
                                        <button className={`dt-draw-btn ${drawMode === 'point' && selectedPlacementType === 'streetlight' ? 'active' : ''}`} onClick={() => { setDrawMode('point'); setSelectedPlacementType('streetlight'); }}>💡 إنارة</button>
                                        <button className={`dt-draw-btn ${drawMode === 'point' && selectedPlacementType === 'wind_turbine' ? 'active' : ''}`} onClick={() => { setDrawMode('point'); setSelectedPlacementType('wind_turbine'); }}>🌀 توربين</button>
                                    </div>
                                </div>

                                <div className="dt-section">
                                    <span className="dt-section-title">إعدادات الكائنات (Scale & Colors)</span>
                                    <div className="dt-mapping-list">
                                        {['tree', 'car', 'streetlight', 'wind_turbine'].map(type => {
                                            const map = pointMappings[type];
                                            if (!map) return null;
                                            return (
                                                <div className="dt-mapping-item" key={type} style={{ padding: '10px' }}>
                                                    <div className="dt-mapping-item-header" style={{ marginBottom: '4px' }}>
                                                        <span className="dt-mapping-item-title" style={{ fontSize: '0.8rem' }}>
                                                            {type === 'tree' ? '🌲 الأشجار والغطاء النباتي' :
                                                             type === 'car' ? '🚗 وسائل النقل والسيارات' :
                                                             type === 'streetlight' ? '💡 مصابيح وإنارة الشوارع' : '🌀 توربينات طاقة متجددة'}
                                                        </span>
                                                    </div>
                                                    <div className="dt-input-group" style={{ marginBottom: '0' }}>
                                                        <div className="dt-slider-container">
                                                            <input type="range" className="dt-slider" min="0.4" max="3.0" step="0.1" value={map.scale} onChange={e => updateMapping(type, 'scale', parseFloat(e.target.value))} />
                                                            <span className="dt-slider-val">{map.scale.toFixed(1)}x</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 3. تبويب البيئة والطقس */}
                        {activeTab === 'visual' && (
                            <div className="dt-tab-content">
                                <div className="dt-section">
                                    <span className="dt-section-title">محاكاة زمن اليوم (Time of Day)</span>
                                    <div className="dt-input-group">
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '8px' }}>
                                            <span>🌙 ليل</span>
                                            <span>🌅 شروق</span>
                                            <span>☀️ ظهراً</span>
                                            <span>🌇 غروب</span>
                                            <span>🌙 ليل</span>
                                        </div>
                                        <div className="dt-slider-container">
                                            <input type="range" className="dt-slider" min="0" max="24" step="0.5" value={timeOfDay} onChange={e => setTimeOfDay(parseFloat(e.target.value))} />
                                            <span className="dt-slider-val">{Math.floor(timeOfDay)}:{(timeOfDay % 1 === 0.5) ? '30' : '00'}</span>
                                        </div>
                                    </div>
                                    <div style={{ fontSize: '0.78rem', color: 'var(--dt-muted)', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px', border: '1px solid var(--dt-border2)' }}>
                                        {timeOfDay < 6 || timeOfDay > 18 ? '🌃 وضع الرؤية الليلية نشط. أعمدة الإنارة تضيء الممرات وتظهر وهج نوافذ المباني الزجاجية!' : '☀️ وضع النهار نشط. ظلال الشمس ثلاثية الأبعاد تدور تدريجياً طبقاً للتوقيت.'}
                                    </div>
                                </div>

                                <div className="dt-section">
                                    <span className="dt-section-title">محاكاة المناخ والطقس</span>
                                    <div className="dt-grid-2">
                                        <button className={`dt-card-select ${weather === 'clear' ? 'active' : ''}`} onClick={() => setWeather('clear')}>
                                            <div className="dt-card-select-icon">☀️</div>
                                            <div className="dt-card-select-label">صافي</div>
                                        </button>
                                        <button className={`dt-card-select ${weather === 'foggy' ? 'active' : ''}`} onClick={() => setWeather('foggy')}>
                                            <div className="dt-card-select-icon">🌫️</div>
                                            <div className="dt-card-select-label">ضبابي</div>
                                        </button>
                                    </div>
                                </div>

                                <div className="dt-section">
                                    <span className="dt-section-title">حركة واستكشاف الكاميرا</span>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        <button className={`dt-btn-secondary ${autoTour ? 'active' : ''}`} onClick={() => setAutoTour(!autoTour)} style={{ background: autoTour ? 'var(--dt-emerald-dim)' : '', borderColor: autoTour ? 'var(--dt-emerald)' : '' }}>
                                            🔄 {autoTour ? 'إيقاف التحليق السينمائي' : 'تشغيل جولة تحليق سينمائية'}
                                        </button>
                                        <button className="dt-btn-secondary" onClick={() => {
                                            mapRef.current?.easeTo({ pitch: 60, bearing: -15, zoom: 17.5, duration: 1500 });
                                        }}>
                                            📐 إعادة زاوية الرؤية التفضيلية
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* شريط التحكم السفلي السريع لتغيير نوع الخريطة */}
                <div className="dt-bottom-bar">
                    <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--dt-muted)', marginLeft: '6px' }}>خريطة الأساس:</span>
                    <button className={`dt-bar-btn ${activeBasemap === 'dark' ? 'active' : ''}`} onClick={() => setActiveBasemap('dark')}>🌌 التوأم المظلم</button>
                    <button className={`dt-bar-btn ${activeBasemap === 'light' ? 'active' : ''}`} onClick={() => setActiveBasemap('light')}>☀️ المضيئة</button>
                    <button className={`dt-bar-btn ${activeBasemap === 'grid' ? 'active' : ''}`} onClick={() => setActiveBasemap('grid')}>🔲 شبكة الفضاء</button>
                    <button className={`dt-bar-btn ${activeBasemap === 'satellite' ? 'active' : ''}`} onClick={() => setActiveBasemap('satellite')}>🛰️ القمر الصناعي</button>
                </div>
            </div>
        </div>
    );
}

// تعريف ثوابت ألوان معبرة لتجنب تحذيرات undefined
const varColors = {
    '--dt-emerald': '#10b981',
    '--dt-emerald-dim': 'rgba(16, 185, 129, 0.12)',
    '--dt-muted': '#7e8f9f',
    '--dt-border2': 'rgba(255, 255, 255, 0.08)'
};
const varColor = (name) => varColors[name] || '#ffffff';
