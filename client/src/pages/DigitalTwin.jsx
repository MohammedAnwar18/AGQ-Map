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
    const [customPoints, setCustomPoints] = useState([]);
    const [stats, setStats] = useState({ polygons: 0, points: 0 });
    const [centerCoords, setCenterCoords] = useState(DEFAULT_CENTER);
    
    // التبويب النشط في اللوحة الجانبية
    const [activeTab, setActiveTab] = useState('data');
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    
    // إعدادات تجسيم المباني (Polygons)
    const [heightProp, setHeightProp] = useState('height');
    const [defaultHeight, setDefaultHeight] = useState(15);
    const [buildingTheme, setBuildingTheme] = useState('glassmorphic');
    const [buildingColor, setBuildingColor] = useState('#10b981'); // Emerald default
    
    // خيارات الخرائط
    const [activeBasemap, setActiveBasemap] = useState('dark');
    
    // إعدادات البيئة
    const [timeOfDay, setTimeOfDay] = useState(12); // من 0 إلى 24 ساعة
    const [weather, setWeather] = useState('clear');
    const [autoTour, setAutoTour] = useState(false);
    
    // أداة إضافة النقاط يدوياً
    const [isAddingPoint, setIsAddingPoint] = useState(false);
    const [selectedPlacementType, setSelectedPlacementType] = useState('tree');
    
    // فاحص الكائنات (Inspector)
    const [selectedFeature, setSelectedFeature] = useState(null); // { type: 'point'|'building', id, properties, coords }

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

    // مراجع الـ Three.js للتحكم المباشر في الرندر
    const threeSceneRef = useRef(null);
    const threeLightsRef = useRef({});
    const meshesMapRef = useRef(new Map()); // لتتبع الكائنات المضافة ومسحها
    const animatedRotorsRef = useRef([]);  // لتحديث شفرات التوربينات
    const animatedBeaconsRef = useRef([]); // لتحديث نبضات الهولوغرام
    const timeRef = useRef(0);

    // ─── 1. البيانات التجريبية الغنية (Sample Smart District) ─────────────────
    const loadSampleData = () => {
        const sampleGeoJSON = {
            type: "FeatureCollection",
            features: [
                // المباني
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
                {
                    type: "Feature",
                    properties: { name: "كلية الهندسة والتكنولوجيا", type: "building", height: 24, color: "#fbab15" },
                    geometry: {
                        type: "Polygon",
                        coordinates: [[
                            [35.1790, 31.9594], [35.1800, 31.9594],
                            [35.1800, 31.9587], [35.1790, 31.9587],
                            [35.1790, 31.9594]
                        ]]
                    }
                },
                {
                    type: "Feature",
                    properties: { name: "الصالة الرياضية الكبرى", type: "building", height: 14, color: "#ec4899" },
                    geometry: {
                        type: "Polygon",
                        coordinates: [[
                            [35.1808, 31.9589], [35.1818, 31.9589],
                            [35.1818, 31.9582], [35.1808, 31.9582],
                            [35.1808, 31.9589]
                        ]]
                    }
                },
                // نقاط الأشجار
                { type: "Feature", properties: { name: "شجرة صنوبر 1", type: "tree" }, geometry: { type: "Point", coordinates: [35.1802, 31.9601] } },
                { type: "Feature", properties: { name: "شجرة صنوبر 2", type: "tree" }, geometry: { type: "Point", coordinates: [35.1803, 31.9599] } },
                { type: "Feature", properties: { name: "شجرة صنوبر 3", type: "tree" }, geometry: { type: "Point", coordinates: [35.1817, 31.9604] } },
                { type: "Feature", properties: { name: "شجرة صنوبر 4", type: "tree" }, geometry: { type: "Point", coordinates: [35.1819, 31.9600] } },
                { type: "Feature", properties: { name: "شجرة حديقة 1", type: "tree" }, geometry: { type: "Point", coordinates: [35.1822, 31.9592] } },
                { type: "Feature", properties: { name: "شجرة حديقة 2", type: "tree" }, geometry: { type: "Point", coordinates: [35.1825, 31.9593] } },
                // نقاط أعمدة الإنارة
                { type: "Feature", properties: { name: "عمود إنارة الممر A", type: "streetlight" }, geometry: { type: "Point", coordinates: [35.1806, 31.9600] } },
                { type: "Feature", properties: { name: "عمود إنارة الممر B", type: "streetlight" }, geometry: { type: "Point", coordinates: [35.1814, 31.9600] } },
                { type: "Feature", properties: { name: "عمود إنارة الممر C", type: "streetlight" }, geometry: { type: "Point", coordinates: [35.1821, 31.9597] } },
                { type: "Feature", properties: { name: "عمود إنارة الممر D", type: "streetlight" }, geometry: { type: "Point", coordinates: [35.1827, 31.9597] } },
                // سيارات على الطريق المفتوح
                { type: "Feature", properties: { name: "سيارة نقل ذكية", type: "car" }, geometry: { type: "Point", coordinates: [35.1801, 31.9592] } },
                { type: "Feature", properties: { name: "سيارة كهربائية زرقاء", type: "car" }, geometry: { type: "Point", coordinates: [35.1811, 31.9591] } },
                { type: "Feature", properties: { name: "حافلة الحرم الجامعي", type: "car" }, geometry: { type: "Point", coordinates: [35.1816, 31.9585] } },
                // توربينات رياح طاقة متجددة
                { type: "Feature", properties: { name: "توربين رياح توليد الطاقة A", type: "wind_turbine" }, geometry: { type: "Point", coordinates: [35.1788, 31.9585] } },
                { type: "Feature", properties: { name: "توربين رياح توليد الطاقة B", type: "wind_turbine" }, geometry: { type: "Point", coordinates: [35.1793, 31.9581] } },
                // كاميرات مراقبة
                { type: "Feature", properties: { name: "كاميرا مراقبة البوابة الرئيسية", type: "cctv" }, geometry: { type: "Point", coordinates: [35.1805, 31.9604] } },
                { type: "Feature", properties: { name: "إشارة مرور التقاطع الذكي", type: "traffic_light" }, geometry: { type: "Point", coordinates: [35.1804, 31.9596] } },
                // منارة مركزية
                { type: "Feature", properties: { name: "منارة البهو الهولوغرافية", type: "beacon" }, geometry: { type: "Point", coordinates: [35.1810, 31.9601] } }
            ]
        };

        setCenterCoords([35.1810, 31.9595]);
        setGeojsonData(sampleGeoJSON);
        setCustomPoints([]);
        
        // الانتقال بالخريطة للموقع
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

    // ─── 2. رفع وتحميل ملفات الـ GeoJSON أو المشاريع المصدّرة ──────────────
    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const parsed = JSON.parse(event.target.result);
                
                // التحقق مما إذا كان الملف هو مشروع تم تصديره من نظامنا (يحتوي على إعدادات الميزة)
                if (parsed.isDigitalTwinProject) {
                    if (parsed.geojsonData) setGeojsonData(parsed.geojsonData);
                    if (parsed.customPoints) setCustomPoints(parsed.customPoints);
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
                    // ملف GeoJSON خام عادي
                    setGeojsonData(parsed);
                    setCustomPoints([]);
                    
                    // حساب مركز البيانات تلقائياً
                    const coords = [];
                    const extractCoords = (geom) => {
                        if (geom.type === 'Point') coords.push(geom.coordinates);
                        else if (geom.type === 'Polygon') geom.coordinates[0].forEach(c => coords.push(c));
                        else if (geom.type === 'MultiPolygon') geom.coordinates.forEach(poly => poly[0].forEach(c => coords.push(c)));
                    };

                    if (parsed.type === 'FeatureCollection') {
                        parsed.features.forEach(f => extractCoords(f.geometry));
                    } else {
                        extractCoords(parsed.geometry);
                    }

                    if (coords.length > 0) {
                        const sum = coords.reduce((acc, val) => [acc[0] + val[0], acc[1] + val[1]], [0, 0]);
                        const center = [sum[0] / coords.length, sum[1] / coords.length];
                        setCenterCoords(center);
                        mapRef.current?.flyTo({ center, zoom: 16.5, pitch: 45, duration: 1500 });
                    }
                }
            } catch (err) {
                alert('فشل قراءة الملف. تأكد من أنه ملف GeoJSON أو مشروع توأم رقمي صالح بنسق JSON.');
            }
        };
        reader.readAsText(file);
    };

    // تصدير المشروع وحفظ الإعدادات الجغرافية ومطابقة المجسمات
    const exportProject = () => {
        if (!geojsonData) return;
        const projectData = {
            isDigitalTwinProject: true,
            projectName: "التوأم الرقمي - " + new Date().toLocaleDateString('ar-EG'),
            geojsonData,
            customPoints,
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
        a.download = `digital-twin-project-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // ─── 3. تحديث الإحصائيات عند تغيير البيانات ──────────────────────────────
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
            polygons: polyCount,
            points: ptCount + customPoints.length
        });
    }, [geojsonData, customPoints]);

    // ─── 4. تهيئة الخريطة وتحديث طبقاتها وتفاصيل الأبعاد الثلاثية ──────────
    useEffect(() => {
        if (!mapContainerRef.current) return;

        // الحصول على تكوين بلاطات الخرائط بناء على خيار المستخدم
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

        // عند تحميل الخريطة، نقوم بإضافة طبقات الـ GeoJSON وطبقة الـ Three.js
        map.on('load', () => {
            setupMapLayers(map);
        });

        // حدث الضغط على الخريطة لتسجيل الكليكات (إما إضافة مجسم يدوياً أو تفتيش كائن)
        map.on('click', (e) => {
            handleMapClick(e, map);
        });

        return () => {
            map.remove();
        };
    }, [activeBasemap]);

    // ─── 5. إعداد مصادر البيانات والطبقات في الخريطة ───────────────────────
    const setupMapLayers = (map) => {
        if (!geojsonData) return;

        // فصل المضلعات (Polygons) لطبقة التجسيم في MapLibre
        const polygonsOnly = {
            type: "FeatureCollection",
            features: (geojsonData.type === 'FeatureCollection' ? geojsonData.features : [geojsonData])
                .filter(f => f.geometry.type.includes('Polygon'))
        };

        // إضافة المصدر الجغرافي للمباني
        map.addSource('dt-buildings-source', {
            type: 'geojson',
            data: polygonsOnly
        });

        // إضافة طبقة تجسيم ثلاثية الأبعاد
        let fillColor = '#10b981';
        let fillOpacity = 0.85;

        if (buildingTheme === 'glassmorphic') {
            fillColor = '#38bdf8'; // شفافية زجاجية سمائية
            fillOpacity = 0.55;
        } else if (buildingTheme === 'neon') {
            fillColor = '#ec4899'; // فوشي نيون مضيء
            fillOpacity = 0.9;
        } else {
            fillColor = buildingColor;
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

        // حدث تفتيش المباني عند النقر عليها
        map.on('click', 'dt-buildings-3d', (e) => {
            if (e.features && e.features.length > 0) {
                const feat = e.features[0];
                setSelectedFeature({
                    type: 'building',
                    id: feat.id || Math.random().toString(),
                    properties: feat.properties,
                    coords: e.lngLat
                });
            }
        });

        // إضافة طبقة Three.js المخصصة للنقاط
        addThreeJsCustomLayer(map);
    };

    // تحديث ديناميكي للمباني عند تغيير الثيم أو الارتفاعات بدون إعادة تحميل الخريطة بالكامل
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !map.getLayer('dt-buildings-3d')) return;

        let fillColor = '#10b981';
        let fillOpacity = 0.85;

        if (buildingTheme === 'glassmorphic') {
            fillColor = '#38bdf8';
            fillOpacity = 0.55;
        } else if (buildingTheme === 'neon') {
            fillColor = '#ec4899';
            fillOpacity = 0.9;
        } else {
            fillColor = buildingColor;
        }

        map.setPaintProperty('dt-buildings-3d', 'fill-extrusion-color', [
            'coalesce',
            ['get', 'color'],
            fillColor
        ]);

        map.setPaintProperty('dt-buildings-3d', 'fill-extrusion-height', [
            'coalesce',
            ['get', heightProp],
            ['get', 'height'],
            defaultHeight
        ]);

        map.setPaintProperty('dt-buildings-3d', 'fill-extrusion-opacity', fillOpacity);
    }, [buildingTheme, buildingColor, heightProp, defaultHeight, geojsonData]);

    // ─── 6. معالجة الأحداث والضغط على الخريطة ─────────────────────────────
    const handleMapClick = (e, map) => {
        // إذا كنا في وضع إضافة النقاط يدوياً
        if (isAddingPoint) {
            const newPt = {
                type: "Feature",
                properties: {
                    name: `كائن يدوي - ${selectedPlacementType} #${customPoints.length + 1}`,
                    type: selectedPlacementType
                },
                geometry: {
                    type: "Point",
                    coordinates: [e.lngLat.lng, e.lngLat.lat]
                }
            };
            setCustomPoints(prev => [...prev, newPt]);
            setIsAddingPoint(false);
            return;
        }

        // تفتيش كائن نقطة جغرافية قريب (خلال 8 أمتار)
        const allPoints = [];
        if (geojsonData) {
            const features = geojsonData.type === 'FeatureCollection' ? geojsonData.features : [geojsonData];
            features.forEach(f => {
                if (f.geometry.type === 'Point') allPoints.push(f);
            });
        }
        customPoints.forEach(f => allPoints.push(f));

        let closest = null;
        let minDist = 0.0001; // مسافة تقريبية بالدرجات

        allPoints.forEach((p, idx) => {
            const ptCoords = p.geometry.coordinates;
            const dist = Math.sqrt(Math.pow(ptCoords[0] - e.lngLat.lng, 2) + Math.pow(ptCoords[1] - e.lngLat.lat, 2));
            if (dist < minDist) {
                minDist = dist;
                closest = { ...p, index: idx };
            }
        });

        if (closest) {
            setSelectedFeature({
                type: 'point',
                id: closest.index,
                properties: closest.properties,
                coords: e.lngLat
            });
        }
    };

    // ─── 7. طبقة الرندر ثلاثي الأبعاد المخصصة (Three.js Layer) ─────────────────
    const addThreeJsCustomLayer = (map) => {
        // مركز التمرير والحسابات المترية المحلية لتجنب الاهتزاز
        const anchorMerc = maplibregl.MercatorCoordinate.fromLngLat(centerCoords, 0);
        const meterScale = anchorMerc.meterInMercatorCoordinateUnits();

        const customLayer = {
            id: 'threejs-digital-twin-layer',
            type: 'custom',
            renderingMode: '3d',
            onAdd: function (mapInstance, gl) {
                this.camera = new THREE.Camera();
                this.scene = new THREE.Scene();

                // إعداد الإضاءة البيئية
                const ambient = new THREE.AmbientLight(0xffffff, 0.7);
                this.scene.add(ambient);
                threeLightsRef.current.ambient = ambient;

                // إعداد ضوء الشمس المسلط
                const sun = new THREE.DirectionalLight(0xffffff, 1.2);
                sun.position.set(50, 100, 50);
                this.scene.add(sun);
                threeLightsRef.current.sun = sun;

                threeSceneRef.current = this.scene;

                // رندرر Three.js مشارك لـ WebGL Context الخاص بالخريطة
                this.renderer = new THREE.WebGLRenderer({
                    canvas: mapInstance.getCanvas(),
                    context: gl,
                    antialias: true
                });
                this.renderer.autoClear = false;

                // بناء كائنات المشهد للمرة الأولى
                buildThreeJsScene();
            },
            render: function (gl, matrix) {
                // تدوير الكاميرا تلقائياً إذا كانت الجولة التلقائية مفعّلة
                if (autoTour) {
                    const currentBearing = mapInstance.getBearing();
                    mapInstance.setBearing(currentBearing + 0.08);
                }

                // حساب مصفوفة التحويل المحلية لتحديد إحداثيات المجسمات في الفضاء الجغرافي
                const m = new THREE.Matrix4().fromArray(matrix);
                const l = new THREE.Matrix4()
                    .makeTranslation(anchorMerc.x, anchorMerc.y, anchorMerc.z)
                    .scale(new THREE.Vector3(meterScale, -meterScale, meterScale));

                this.camera.projectionMatrix = m.multiply(l);

                // تحديث الحركات المستمرة (مثل تدوير شفرات توربينات الرياح ونبض الهولوغرام)
                timeRef.current += 0.015;
                
                animatedRotorsRef.current.forEach(rotor => {
                    rotor.rotation.z += 0.08; // دوران الشفرات
                });

                animatedBeaconsRef.current.forEach(beacon => {
                    const pulse = 1.0 + Math.sin(timeRef.current * 4) * 0.15;
                    beacon.scale.set(pulse, 1.0, pulse); // تأثير النبض
                });

                // رندرة المشهد داخل سياق الخريطة
                this.renderer.resetState();
                this.renderer.render(this.scene, this.camera);
                
                // تحفيز إعادة الرندرة التلقائي لاستمرارية الأنيميشن
                mapInstance.triggerRepaint();
            }
        };

        map.addLayer(customLayer);
    };

    // ─── 8. إنشاء وتحديث الكائنات ثلاثية الأبعاد تفاعلياً ─────────────────────
    const buildThreeJsScene = () => {
        const scene = threeSceneRef.current;
        if (!scene) return;

        // مسح الكائنات القديمة
        meshesMapRef.current.forEach(mesh => scene.remove(mesh));
        meshesMapRef.current.clear();
        animatedRotorsRef.current = [];
        animatedBeaconsRef.current = [];

        // جمع كافة النقاط (سواء من الملف أو التي تمت إضافتها يدوياً)
        const allPoints = [];
        if (geojsonData) {
            const features = geojsonData.type === 'FeatureCollection' ? geojsonData.features : [geojsonData];
            features.forEach(f => {
                if (f.geometry.type === 'Point') allPoints.push(f);
            });
        }
        customPoints.forEach(p => allPoints.push(p));

        const anchorMerc = maplibregl.MercatorCoordinate.fromLngLat(centerCoords, 0);
        const meterScale = anchorMerc.meterInMercatorCoordinateUnits();

        // فحص حالة الليل/النهار لتشغيل إضاءة المصابيح
        const isNight = timeOfDay < 6 || timeOfDay > 18;

        allPoints.forEach((p, index) => {
            const coords = p.geometry.coordinates;
            const pMerc = maplibregl.MercatorCoordinate.fromLngLat(coords, 0);

            // تحويل الموقع الجغرافي إلى إحداثيات مترية محلية حول نقطة الارتكاز (Anchor)
            const dx = (pMerc.x - anchorMerc.x) / meterScale;
            const dy = -(pMerc.y - anchorMerc.y) / meterScale;

            const type = p.properties?.type || 'tree';
            const mapping = pointMappings[type] || { model: 'tree', scale: 1.0, color: '#10b981' };

            // بناء كتل المجسمات ثلاثية الأبعاد طبقاً لنوع الكائن المختار
            const group = new THREE.Group();
            group.position.set(dx, dy, 0);
            
            const scaleVal = mapping.scale || 1.0;
            group.scale.set(scaleVal, scaleVal, scaleVal);

            // إنشاء الجيومتري
            buildProceduralModel(type, group, mapping.color, isNight);

            scene.add(group);
            meshesMapRef.current.set(`pt-${index}`, group);
        });

        // تحديث إضاءة الطقس واليوم
        updateEnvironmentLighting(isNight);
    };

    // مراقبة التغييرات لإعادة بناء المشهد ثلاثي الأبعاد فوراً
    useEffect(() => {
        buildThreeJsScene();
    }, [geojsonData, customPoints, pointMappings, timeOfDay]);

    // ─── 9. مولّد الكائنات ثلاثية الأبعاد الإجرائي (Procedural 3D Models) ──────
    const buildProceduralModel = (type, group, colorHex, isNight) => {
        const matColor = new THREE.Color(colorHex);

        switch (type) {
            case 'tree': {
                // شجرة low-poly
                // جذع بني
                const trunkGeo = new THREE.CylinderGeometry(0.15, 0.22, 1.2, 5);
                const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5c4033 });
                const trunk = new THREE.Mesh(trunkGeo, trunkMat);
                trunk.position.z = 0.6;
                trunk.rotation.x = Math.PI / 2;
                group.add(trunk);

                // أوراق مخروطية على مستويات
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
                // هيكل سيارة ذكية
                const bodyGeo = new THREE.BoxGeometry(1.2, 2.2, 0.6);
                const bodyMat = new THREE.MeshLambertMaterial({ color: matColor });
                const body = new THREE.Mesh(bodyGeo, bodyMat);
                body.position.z = 0.45;
                group.add(body);

                // كابينة الركاب ونوافذ زجاجية
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

                // إطارات داكنة
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
                // عمود إنارة نحيف
                const poleGeo = new THREE.CylinderGeometry(0.06, 0.08, 4.0, 6);
                const poleMat = new THREE.MeshLambertMaterial({ color: 0x4f5d75 });
                const pole = new THREE.Mesh(poleGeo, poleMat);
                pole.position.z = 2.0;
                pole.rotation.x = Math.PI / 2;
                group.add(pole);

                // رأس المصباح المنحني
                const headGeo = new THREE.BoxGeometry(0.18, 0.6, 0.12);
                const head = new THREE.Mesh(headGeo, poleMat);
                head.position.set(0, 0.24, 4.0);
                group.add(head);

                // المصباح المضيء
                const bulbGeo = new THREE.SphereGeometry(0.15, 6, 6);
                const bulbMat = new THREE.MeshBasicMaterial({
                    color: isNight ? 0xffeaad : 0xdddddd
                });
                const bulb = new THREE.Mesh(bulbGeo, bulbMat);
                bulb.position.set(0, 0.45, 3.9);
                group.add(bulb);

                // مخروط إضاءة وهمي شفاف بالليل
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
                // عمود التوربين
                const towerGeo = new THREE.CylinderGeometry(0.1, 0.25, 7.0, 8);
                const towerMat = new THREE.MeshLambertMaterial({ color: 0xeeeeee });
                const tower = new THREE.Mesh(towerGeo, towerMat);
                tower.position.z = 3.5;
                tower.rotation.x = Math.PI / 2;
                group.add(tower);

                // صندوق المحرك الدوار
                const generatorGeo = new THREE.BoxGeometry(0.4, 0.8, 0.4);
                const generator = new THREE.Mesh(generatorGeo, towerMat);
                generator.position.set(0, 0, 7.0);
                group.add(generator);

                // محور شفرات الرياح الدوارة
                const rotorGroup = new THREE.Group();
                rotorGroup.position.set(0, 0.4, 7.0);
                
                const bladeGeo = new THREE.BoxGeometry(0.12, 3.2, 0.04);
                
                // 3 شفرات موزعة بزاوية 120 درجة
                for (let i = 0; i < 3; i++) {
                    const blade = new THREE.Mesh(bladeGeo, towerMat);
                    blade.rotation.z = (i * Math.PI * 2) / 3;
                    blade.position.y = 1.2; // إزاحة شفرة
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
                // إشارة مرور
                const poleGeo = new THREE.CylinderGeometry(0.08, 0.08, 3.2, 6);
                const poleMat = new THREE.MeshLambertMaterial({ color: 0x1f2937 });
                const pole = new THREE.Mesh(poleGeo, poleMat);
                pole.position.z = 1.6;
                pole.rotation.x = Math.PI / 2;
                group.add(pole);

                // صندوق الإشارة
                const boxGeo = new THREE.BoxGeometry(0.3, 0.3, 0.9);
                const box = new THREE.Mesh(boxGeo, poleMat);
                box.position.set(0, 0, 2.8);
                group.add(box);

                // أضواء الإشارة المضيئة
                const lightGeo = new THREE.SphereGeometry(0.08, 6, 6);
                
                // أحمر
                const rLight = new THREE.Mesh(lightGeo, new THREE.MeshBasicMaterial({ color: 0xff0000 }));
                rLight.position.set(0, 0.16, 3.1);
                group.add(rLight);

                // أصفر خافت
                const yLight = new THREE.Mesh(lightGeo, new THREE.MeshBasicMaterial({ color: 0x665500 }));
                yLight.position.set(0, 0.16, 2.8);
                group.add(yLight);

                // أخضر خافت
                const gLight = new THREE.Mesh(lightGeo, new THREE.MeshBasicMaterial({ color: 0x006600 }));
                gLight.position.set(0, 0.16, 2.5);
                group.add(gLight);
                break;
            }
            case 'cctv': {
                // كاميرا
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
                // منارة هولوغرافية نابضة
                const baseGeo = new THREE.CylinderGeometry(0.4, 0.5, 0.15, 8);
                const baseMat = new THREE.MeshLambertMaterial({ color: 0x1f2937 });
                const base = new THREE.Mesh(baseGeo, baseMat);
                base.position.z = 0.075;
                base.rotation.x = Math.PI / 2;
                group.add(base);

                // أسطوانة الطاقة المضيئة
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
                // مقعد خشبي مع ميتال
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

    // ─── 10. تعديل قيم الإضاءة وتوهج البيئة ديناميكياً ──────────────────────
    const updateEnvironmentLighting = (isNight) => {
        const lights = threeLightsRef.current;
        if (!lights.ambient || !lights.sun) return;

        if (isNight) {
            // إضاءة ليلية خافتة مائلة للزرقة الداكنة
            lights.ambient.color.setHex(0x1a243d);
            lights.ambient.intensity = 0.25;

            // إضاءة قمر خفيف وهادئ
            lights.sun.color.setHex(0x90a0c7);
            lights.sun.intensity = 0.35;
            lights.sun.position.set(-30, 80, -30);
        } else {
            // النهار: ضوء ساطع ودافئ
            // حساب زاوية الشمس وقوة الإضاءة طبقاً لشريط تمرير اليوم
            // الذروة عند الساعة 12 ظهراً
            const factor = 1.0 - Math.abs(timeOfDay - 12) / 6; // نسبة السطوع
            const boundedFactor = Math.max(0.15, Math.min(1.0, factor));

            const ambientColor = new THREE.Color().lerpColors(
                new THREE.Color(0xfcac3b), // شروق/غروب برتقالي دافئ
                new THREE.Color(0xffffff), // وسط النهار أبيض ناصع
                boundedFactor
            );

            lights.ambient.color.copy(ambientColor);
            lights.ambient.intensity = 0.4 + boundedFactor * 0.45;

            lights.sun.color.copy(ambientColor);
            lights.sun.intensity = 0.3 + boundedFactor * 1.1;

            // ضبط اتجاه وظل الشمس
            const rad = ((timeOfDay - 6) * Math.PI) / 12;
            lights.sun.position.set(Math.cos(rad) * 100, Math.sin(rad) * 100, 20);
        }

        // إدماج الضباب البيئي ثلاثي الأبعاد
        const scene = threeSceneRef.current;
        if (scene) {
            if (weather === 'foggy') {
                const fogCol = isNight ? 0x0a101e : 0xd1dbe4;
                scene.fog = new THREE.FogExp2(fogCol, 0.012);
            } else if (weather === 'rain') {
                const fogCol = isNight ? 0x050a12 : 0x6e788c;
                scene.fog = new THREE.FogExp2(fogCol, 0.008);
            } else {
                scene.fog = null; // طقس صافي
            }
        }
    };

    // استدعاء تحديثات الإضاءة عند تغيير الطقس أو توقيت اليوم
    useEffect(() => {
        const isNight = timeOfDay < 6 || timeOfDay > 18;
        updateEnvironmentLighting(isNight);
    }, [timeOfDay, weather]);

    // ─── 11. تحديث وتعديل تعيين العناصر في النقاط ─────────────────────────
    const updateMapping = (type, key, val) => {
        setPointMappings(prev => ({
            ...prev,
            [type]: {
                ...prev[type],
                [key]: val
            }
        }));
    };

    // إضافة نقاط جديدة في حالة وجود كائنات
    const enterPlacementMode = (type) => {
        setSelectedPlacementType(type);
        setIsAddingPoint(true);
        setActiveTab('mapping');
    };

    return (
        <div className="dt-container">
            {/* مؤشر وضع إسقاط العناصر اليدوي */}
            {isAddingPoint && (
                <div className="dt-placement-indicator">
                    <span>اضغط على الخريطة لوضع مجسم: <strong>{pointMappings[selectedPlacementType]?.model === 'tree' ? '🌲 شجرة' : selectedPlacementType === 'car' ? '🚗 سيارة' : '💡 عمود إنارة'}</strong></span>
                    <button className="dt-placement-cancel" onClick={() => setIsAddingPoint(false)}>إلغاء</button>
                </div>
            )}

            {/* شريط العنوان */}
            <div className="dt-header">
                <div className="dt-header-title">
                    <div className="dt-header-icon">🌐</div>
                    <div>
                        <h2>محرر التوأم الرقمي 3D</h2>
                    </div>
                </div>
                <div className="dt-header-actions">
                    <button className="dt-btn-primary" style={{ width: 'auto', padding: '8px 16px', fontSize: '0.8rem' }} onClick={exportProject} disabled={!geojsonData}>
                        📥 تصدير المشروع
                    </button>
                    <button className="dt-close-btn" onClick={onClose}>✕</button>
                </div>
            </div>

            {/* فضاء العمل والخرائط */}
            <div className="dt-workspace">
                <div className="dt-map-viewport" ref={mapContainerRef} />

                {/* لوحة فحص الكائنات (Inspector Panel) */}
                {selectedFeature && (
                    <div className="dt-inspector">
                        <div className="dt-inspector-header">
                            <span className="dt-inspector-title">🔎 فاحص العناصر</span>
                            <button className="dt-inspector-close" onClick={() => setSelectedFeature(null)}>✕</button>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto' }}>
                            <div className="dt-inspector-prop">
                                <span className="dt-inspector-prop-name">النوع</span>
                                <span className="dt-inspector-prop-val" style={{ color: 'var(--dt-emerald)' }}>
                                    {selectedFeature.type === 'building' ? '🏢 مبنى مجسّم' : '📍 نقطة كائن'}
                                </span>
                            </div>
                            {selectedFeature.properties?.name && (
                                <div className="dt-inspector-prop">
                                    <span className="dt-inspector-prop-name">الاسم</span>
                                    <span className="dt-inspector-prop-val">{selectedFeature.properties.name}</span>
                                </div>
                            )}
                            {selectedFeature.properties && Object.keys(selectedFeature.properties).map(key => (
                                <div className="dt-inspector-prop" key={key}>
                                    <span className="dt-inspector-prop-name">{key}</span>
                                    <span className="dt-inspector-prop-val">{String(selectedFeature.properties[key])}</span>
                                </div>
                            ))}
                            {selectedFeature.coords && (
                                <>
                                    <div className="dt-inspector-prop">
                                        <span className="dt-inspector-prop-name">خطي الطول</span>
                                        <span className="dt-inspector-prop-val">{selectedFeature.coords.lng.toFixed(6)}</span>
                                    </div>
                                    <div className="dt-inspector-prop">
                                        <span className="dt-inspector-prop-name">دائرة العرض</span>
                                        <span className="dt-inspector-prop-val">{selectedFeature.coords.lat.toFixed(6)}</span>
                                    </div>
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
                            🌲 تعيين المجسمات
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

                                {geojsonData && (
                                    <div className="dt-section">
                                        <span className="dt-section-title">تفاصيل البيانات المحملة</span>
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
                                    <span className="dt-section-title">إعدادات تجسيم المباني (3D Extrusion)</span>
                                    <div className="dt-input-group">
                                        <label>مظهر المباني</label>
                                        <select className="dt-select" value={buildingTheme} onChange={e => setBuildingTheme(e.target.value)}>
                                            <option value="classic">معماري كلاسيكي مصمت</option>
                                            <option value="glassmorphic">زجاجي مائي شفاف (Futuristic Glass)</option>
                                            <option value="neon">نيون مضيء ووهّاج</option>
                                        </select>
                                    </div>
                                    <div className="dt-input-group">
                                        <label>حقل ارتفاع المباني (Height Property)</label>
                                        <select className="dt-select" value={heightProp} onChange={e => setHeightProp(e.target.value)}>
                                            <option value="height">height (ارتفاع بالمتر)</option>
                                            <option value="levels">levels (عدد الطوابق)</option>
                                            <option value="elevation">elevation (منسوب الارتفاع)</option>
                                        </select>
                                    </div>
                                    <div className="dt-input-group">
                                        <label>الارتفاع الافتراضي للمباني المجهولة: {defaultHeight} متر</label>
                                        <div className="dt-slider-container">
                                            <input type="range" className="dt-slider" min="4" max="80" value={defaultHeight} onChange={e => setDefaultHeight(parseInt(e.target.value))} />
                                            <span className="dt-slider-val">{defaultHeight} م</span>
                                        </div>
                                    </div>
                                    {buildingTheme === 'classic' && (
                                        <div className="dt-input-group">
                                            <label>لون المباني المعمارية</label>
                                            <div className="dt-color-picker-wrapper">
                                                {['#10b981', '#3b82f6', '#fbab15', '#ec4899', '#64748b', '#ef4444', '#a855f7'].map(c => (
                                                    <div key={c} className={`dt-color-bubble ${buildingColor === c ? 'active' : ''}`} style={{ backgroundColor: c }} onClick={() => setBuildingColor(c)} />
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* 2. تبويب تعيين المجسمات */}
                        {activeTab === 'mapping' && (
                            <div className="dt-tab-content">
                                <div className="dt-section">
                                    <span className="dt-section-title">إسقاط كائنات يدوية على الخريطة</span>
                                    <div className="dt-grid-2" style={{ marginBottom: '14px' }}>
                                        <button className="dt-btn-secondary" style={{ padding: '8px' }} onClick={() => enterPlacementMode('tree')}>🌲 شجرة</button>
                                        <button className="dt-btn-secondary" style={{ padding: '8px' }} onClick={() => enterPlacementMode('car')}>🚗 سيارة</button>
                                        <button className="dt-btn-secondary" style={{ padding: '8px' }} onClick={() => enterPlacementMode('streetlight')}>💡 إنارة</button>
                                        <button className="dt-btn-secondary" style={{ padding: '8px' }} onClick={() => enterPlacementMode('wind_turbine')}>🌀 توربين</button>
                                    </div>
                                </div>

                                <div className="dt-section">
                                    <span className="dt-section-title">تعيين وتكييف المجسمات (3D Point Mappings)</span>
                                    <div className="dt-mapping-list">
                                        {Object.keys(pointMappings).map(type => {
                                            const map = pointMappings[type];
                                            return (
                                                <div className="dt-mapping-item" key={type}>
                                                    <div className="dt-mapping-item-header">
                                                        <span className="dt-mapping-item-title">
                                                            {type === 'tree' ? '🌲 الأشجار والغطاء النباتي' :
                                                             type === 'car' ? '🚗 وسائل النقل والسيارات' :
                                                             type === 'streetlight' ? '💡 مصابيح وإنارة الشوارع' :
                                                             type === 'wind_turbine' ? '🌀 توربينات طاقة متجددة' :
                                                             type === 'traffic_light' ? '🚥 إشارات المرور والتقاطعات' :
                                                             type === 'cctv' ? '📹 كاميرات وأجهزة المراقبة' :
                                                             type === 'beacon' ? '📍 المنارات الهولوغرافية' : '🏛️ كراسي ومقاعد الجلوس'}
                                                        </span>
                                                    </div>
                                                    <div className="dt-input-group" style={{ marginBottom: '6px' }}>
                                                        <label>حجم المجسم: {map.scale.toFixed(1)}x</label>
                                                        <div className="dt-slider-container">
                                                            <input type="range" className="dt-slider" min="0.4" max="3.0" step="0.1" value={map.scale} onChange={e => updateMapping(type, 'scale', parseFloat(e.target.value))} />
                                                            <span className="dt-slider-val">{map.scale.toFixed(1)}x</span>
                                                        </div>
                                                    </div>
                                                    {['tree', 'car', 'beacon'].includes(type) && (
                                                        <div className="dt-input-group" style={{ marginBottom: '0' }}>
                                                            <label>لون المجسم ثلاثي الأبعاد</label>
                                                            <div className="dt-color-picker-wrapper">
                                                                {['#10b981', '#3b82f6', '#fbab15', '#ec4899', '#64748b', '#ef4444', '#ffffff'].map(c => (
                                                                    <div key={c} className={`dt-color-bubble ${map.color === c ? 'active' : ''}`} style={{ backgroundColor: c }} onClick={() => updateMapping(type, 'color', c)} />
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
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
                                        {timeOfDay < 6 || timeOfDay > 18 ? '🌃 وضع الرؤية الليلية نشط. أعمدة الإنارة تضيء الممرات تلقائياً!' : '☀️ وضع النهار نشط. ظلال الشمس ثلاثية الأبعاد تدور تدريجياً طبقاً للتوقيت.'}
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
    '--dt-emerald-dim': 'rgba(16, 185, 129, 0.12)'
};
const varColor = (name) => varColors[name] || '#ffffff';
