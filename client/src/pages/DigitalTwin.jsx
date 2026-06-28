import React, { useState, useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import * as THREE from 'three';
import { digitalTwinService } from '../services/api';
import './DigitalTwin.css';

// ─── إحداثيات افتراضية لوسط فلسطين لبدء الرسم ──────────────────────────────
const DEFAULT_CENTER = [35.2000, 31.9500]; 

export default function DigitalTwin({ user, onClose }) {
    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);
    
    // الصلاحيات (أدمن فقط يمكنه النشر والتحرير، البقية استكشاف)
    const canEdit = user?.role === 'admin';

    // البيانات والطبقات
    const [geojsonData, setGeojsonData] = useState(null);
    const [customPoints, setCustomPoints] = useState([]);
    const [customBuildings, setCustomBuildings] = useState([]);
    const [customStreets, setCustomStreets] = useState([]);
    
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
    
    // إعدادات البيئة والطقس
    const [timeOfDay, setTimeOfDay] = useState(12); // من 0 إلى 24 ساعة
    const [weather, setWeather] = useState('clear');
    const [autoTour, setAutoTour] = useState(false);
    
    // أدوات الرسم الهندسي النشطة
    const [drawMode, setDrawMode] = useState('none'); // none, building, street, point
    const [drawnCoords, setDrawnCoords] = useState([]); // إحداثيات الشكل الجاري رسمه
    const [selectedPlacementType, setSelectedPlacementType] = useState('tree');

    // ─── Refs للقراءة الحية من داخل closures الـ Three.js وحدث النقر ─────────
    const drawModeRef = useRef('none');
    const customBuildingsRef = useRef([]);
    const customPointsRef = useRef([]);
    const customStreetsRef = useRef([]);
    const geojsonDataRef = useRef(null);
    const centerCoordsRef = useRef(DEFAULT_CENTER);
    const timeOfDayRef = useRef(12);
    const autoTourRef = useRef(false);
    const pointMappingsRef = useRef({});
    const selectedPlacementTypeRef = useRef('tree');
    const rebuildSceneRef = useRef(null); // callback لإعادة بناء المشهد
    const drawnCoordsRef = useRef([]); // للقراءة من dblclick handler
    const handleFinishDrawingRef = useRef(null); // ref لدالة إنهاء الرسم
    
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
    const [editColor, setEditColor] = useState('#3b82f6');
    const [editStreetWidth, setEditStreetWidth] = useState(8);
    const [editStreetStyle, setEditStreetStyle] = useState('asphalt');

    // تكوين تعيين النقاط إلى مجسمات (Point Object Mapping)
    const [pointMappings, setPointMappings] = useState({
        'tree': { model: 'tree', scale: 1.0, color: '#10b981' },
        'palm': { model: 'palm', scale: 1.2, color: '#047857' },
        'car': { model: 'car', scale: 1.0, color: '#f43f5e' },
        'sports_car': { model: 'sports_car', scale: 0.9, color: '#fbab15' },
        'truck': { model: 'truck', scale: 1.3, color: '#3b82f6' },
        'streetlight': { model: 'streetlight', scale: 1.0, color: '#fbab15' },
        'classic_lamp': { model: 'classic_lamp', scale: 1.0, color: '#f59e0b' },
        'wind_turbine': { model: 'wind_turbine', scale: 1.0, color: '#ffffff' },
        'traffic_light': { model: 'traffic_light', scale: 1.0, color: '#3b82f6' },
        'bench': { model: 'bench', scale: 1.0, color: '#854d0e' },
        'fountain': { model: 'fountain', scale: 1.4, color: '#60a5fa' },
        'cctv': { model: 'cctv', scale: 1.0, color: '#64748b' },
        'beacon': { model: 'beacon', scale: 1.2, color: '#10b981' }
    });

    // ─── إعدادات الشبكة المغناطيسية والمحاكاة المتقدمة (Grid Snapping & IoT) ─────
    const [gridSnapping, setGridSnapping] = useState(false);
    const [gridSize, setGridSize] = useState(0.5); // بالمتر
    const [showGridHelper, setShowGridHelper] = useState(false);
    
    const [iotSimulation, setIotSimulation] = useState(false);
    const [simulatedTelemetry, setSimulatedTelemetry] = useState({});
    const [telemetryLogs, setTelemetryLogs] = useState([]);

    const gridSnappingRef = useRef(false);
    const gridSizeRef = useRef(0.5);
    const showGridHelperRef = useRef(false);

    useEffect(() => { gridSnappingRef.current = gridSnapping; }, [gridSnapping]);
    useEffect(() => { gridSizeRef.current = gridSize; }, [gridSize]);
    useEffect(() => { showGridHelperRef.current = showGridHelper; }, [showGridHelper]);

    // مراجع الـ Three.js للتحكم المباشر في الرندر والخامات والأنيميشن
    const threeSceneRef = useRef(null);
    const threeLightsRef = useRef({});
    const meshesMapRef = useRef(new Map()); 
    const animatedRotorsRef = useRef([]);  
    const animatedBeaconsRef = useRef([]); 
    const animatedWaterJetsRef = useRef([]); // لتحديث حركة النافورة
    const texturesCacheRef = useRef(new Map()); 
    const timeRef = useRef(0);
    const [loadingProject, setLoadingProject] = useState(false);

    // ─── مزامنة Refs مع الـ State لضمان القراءة الصحيحة من Closures ──────────
    useEffect(() => { drawModeRef.current = drawMode; }, [drawMode]);
    useEffect(() => { customBuildingsRef.current = customBuildings; }, [customBuildings]);
    useEffect(() => { customPointsRef.current = customPoints; }, [customPoints]);
    useEffect(() => { customStreetsRef.current = customStreets; }, [customStreets]);
    useEffect(() => { geojsonDataRef.current = geojsonData; }, [geojsonData]);
    useEffect(() => { centerCoordsRef.current = centerCoords; }, [centerCoords]);
    useEffect(() => { timeOfDayRef.current = timeOfDay; }, [timeOfDay]);
    useEffect(() => { autoTourRef.current = autoTour; }, [autoTour]);
    useEffect(() => { pointMappingsRef.current = pointMappings; }, [pointMappings]);
    useEffect(() => { selectedPlacementTypeRef.current = selectedPlacementType; }, [selectedPlacementType]);
    useEffect(() => { drawnCoordsRef.current = drawnCoords; }, [drawnCoords]);

    // ─── دوال التحديث الحي المباشر للمعالم والطبقات ───────────────────
    const updateBuildingProperty = (index, key, value) => {
        setCustomBuildings(prev => {
            const copy = [...prev];
            if (copy[index]) {
                copy[index] = {
                    ...copy[index],
                    [key]: value
                };
            }
            return copy;
        });

        setSelectedFeature(prev => {
            if (prev && prev.type === 'custom-building' && prev.index === index) {
                return {
                    ...prev,
                    properties: {
                        ...prev.properties,
                        [key]: value
                    }
                };
            }
            return prev;
        });
    };

    const updatePointProperty = (id, isCustom, key, value) => {
        if (isCustom) {
            const idx = parseInt(id.split('-')[1]);
            setCustomPoints(prev => {
                const copy = [...prev];
                if (copy[idx]) {
                    copy[idx] = {
                        ...copy[idx],
                        properties: {
                            ...copy[idx].properties,
                            [key]: value
                        }
                    };
                }
                return copy;
            });
        } else {
            const idx = parseInt(id.split('-')[1]);
            setGeojsonData(prev => {
                if (!prev) return prev;
                const copy = { ...prev };
                if (copy.features && copy.features[idx]) {
                    copy.features[idx] = {
                        ...copy.features[idx],
                        properties: {
                            ...copy.features[idx].properties,
                            [key]: value
                        }
                    };
                }
                return copy;
            });
        }

        setSelectedFeature(prev => {
            if (prev && prev.type === 'point' && prev.id === id) {
                return {
                    ...prev,
                    properties: {
                        ...prev.properties,
                        [key]: value
                    }
                };
            }
            return prev;
        });
    };

    // ─── 1. تحميل أحدث مشروع من قاعدة البيانات عند فتح الصفحة ──────────────
    useEffect(() => {
        const fetchProject = async () => {
            setLoadingProject(true);
            try {
                const data = await digitalTwinService.getLatestProject();
                if (data && data.success && data.project) {
                    const proj = data.project;
                    
                    if (proj.geojson_data || proj.geojsondata) setGeojsonData(proj.geojson_data || proj.geojsondata);
                    if (proj.custom_points || proj.custompoints) setCustomPoints(proj.custom_points || proj.custompoints);
                    if (proj.custom_buildings || proj.custombuildings) setCustomBuildings(proj.custom_buildings || proj.custombuildings);
                    if (proj.custom_streets || proj.customstreets) setCustomStreets(proj.custom_streets || proj.customstreets);
                    if (proj.point_mappings || proj.pointmappings) setPointMappings(proj.point_mappings || proj.pointmappings);
                    if (proj.building_theme || proj.buildingtheme) setBuildingTheme(proj.building_theme || proj.buildingtheme);
                    if (proj.building_color || proj.buildingcolor) setBuildingColor(proj.building_color || proj.buildingcolor);
                    if (proj.height_prop || proj.heightprop) setHeightProp(proj.height_prop || proj.heightprop);
                    if (proj.default_height || proj.defaultheight) setDefaultHeight(proj.default_height || proj.defaultheight);
                    if (proj.active_basemap || proj.activebasemap) setActiveBasemap(proj.active_basemap || proj.activebasemap);
                    if (proj.center_coords || proj.centercoords) {
                        const coords = proj.center_coords || proj.centercoords;
                        setCenterCoords(coords);
                        mapRef.current?.flyTo({ center: coords, zoom: 17, pitch: 55, duration: 1000 });
                    }
                }
            } catch (err) {
                console.warn('Failed to load project from server, falling back to local storage.');
                loadFromLocalStorage();
            } finally {
                setLoadingProject(false);
            }
        };

        fetchProject();
    }, []);

    const loadFromLocalStorage = () => {
        try {
            const savedPoints = localStorage.getItem('agq_dt_custom_points');
            const savedBuildings = localStorage.getItem('agq_dt_custom_buildings');
            const savedStreets = localStorage.getItem('agq_dt_custom_streets');

            if (savedPoints) setCustomPoints(JSON.parse(savedPoints));
            if (savedBuildings) setCustomBuildings(JSON.parse(savedBuildings));
            if (savedStreets) setCustomStreets(JSON.parse(savedStreets));
        } catch {}
    };

    // حفظ تلقائي محلي عند التغيير
    useEffect(() => {
        if (customPoints.length > 0) localStorage.setItem('agq_dt_custom_points', JSON.stringify(customPoints));
    }, [customPoints]);

    useEffect(() => {
        if (customBuildings.length > 0) localStorage.setItem('agq_dt_custom_buildings', JSON.stringify(customBuildings));
    }, [customBuildings]);

    useEffect(() => {
        if (customStreets.length > 0) localStorage.setItem('agq_dt_custom_streets', JSON.stringify(customStreets));
    }, [customStreets]);

    // ─── 2. حفظ التوأم الرقمي ونشره على السيرفر لقاعدة البيانات ─────────────
    const publishProject = async () => {
        if (!canEdit) return;
        try {
            const payload = {
                projectName: "التوأم الرقمي المشترك - الحرم الذكي",
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
            const res = await digitalTwinService.saveProject(payload);
            if (res && res.success) {
                alert('🎉 تم حفظ ونشر التوأم الرقمي بنجاح في السيرفر! يمكن الآن لجميع الزوار استكشاف هذا التصميم بدقة.');
            }
        } catch (err) {
            alert('فشل حفظ المشروع على السيرفر. يرجى التحقق من الاتصال بالإنترنت.');
        }
    };

    // تحديث الإحصائيات عند تغيير البيانات
    useEffect(() => {
        let polyCount = customBuildings.length;
        let ptCount = customPoints.length;
        let streetCount = customStreets.length;

        if (geojsonData) {
            const features = geojsonData.type === 'FeatureCollection' ? geojsonData.features : [geojsonData];
            features.forEach(f => {
                if (f.geometry && f.geometry.type) {
                    if (f.geometry.type.includes('Polygon')) {
                        polyCount++;
                    } else if (f.geometry.type === 'Point') {
                        ptCount++;
                    } else if (f.geometry.type.includes('LineString')) {
                        streetCount++;
                    }
                }
            });
        }

        setStats({ polygons: polyCount, points: ptCount, streets: streetCount });
    }, [geojsonData, customPoints, customBuildings, customStreets]);

    // معالجة رفع ملف المشروع أو ملف GeoJSON
    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const parsed = JSON.parse(event.target.result);
                if (parsed.projectName && (parsed.customPoints || parsed.customBuildings || parsed.customStreets)) {
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
                        mapRef.current?.flyTo({ center: parsed.centerCoords, zoom: 17, pitch: 55, duration: 1000 });
                    }
                    alert('🎉 تم تحميل ملف مشروع التوأم الرقمي بنجاح!');
                } else {
                    setGeojsonData(parsed);
                    let coords = null;
                    if (parsed.type === 'FeatureCollection' && parsed.features && parsed.features.length > 0) {
                        const firstFeat = parsed.features[0];
                        if (firstFeat.geometry && firstFeat.geometry.coordinates) {
                            const geomType = firstFeat.geometry.type;
                            if (geomType === 'Point') {
                                coords = firstFeat.geometry.coordinates;
                            } else if (geomType === 'LineString') {
                                coords = firstFeat.geometry.coordinates[0];
                            } else if (geomType === 'Polygon') {
                                coords = firstFeat.geometry.coordinates[0][0];
                            }
                        }
                    } else if (parsed.type === 'Feature' && parsed.geometry && parsed.geometry.coordinates) {
                        const geomType = parsed.geometry.type;
                        if (geomType === 'Point') {
                            coords = parsed.geometry.coordinates;
                        } else if (geomType === 'LineString') {
                            coords = parsed.geometry.coordinates[0];
                        } else if (geomType === 'Polygon') {
                            coords = parsed.geometry.coordinates[0][0];
                        }
                    }
                    
                    if (coords && coords.length >= 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
                        setCenterCoords(coords);
                        mapRef.current?.flyTo({ center: coords, zoom: 17, pitch: 55, duration: 1000 });
                    }
                    alert('🎉 تم استيراد ملف الـ GeoJSON بنجاح كطبقة معالم للموقع!');
                }
            } catch (err) {
                console.error('Error parsing uploaded file:', err);
                alert('فشل في قراءة ملف المشروع. يرجى التأكد من أن الملف هو GeoJSON أو JSON صالح للمشروع.');
            }
        };
        reader.readAsText(file);
    };

    // تحميل المنطقة التجريبية لجامعة بيرزيت
    const loadSampleData = () => {
        const birzeitCenter = [35.1806, 31.9600];
        
        const buildings = [
            {
                id: 'bld-bz-admin',
                name: 'مبنى الإدارة والتسجيل الرئيسي',
                height: 22,
                skin: 'stone',
                solarRoof: true,
                color: '#eab308',
                coordinates: [
                    [35.1812, 31.9592],
                    [35.1818, 31.9593],
                    [35.1819, 31.9588],
                    [35.1813, 31.9587],
                    [35.1812, 31.9592]
                ]
            },
            {
                id: 'bld-bz-it',
                name: 'كلية تكنولوجيا المعلومات والذكاء الاصطناعي',
                height: 18,
                skin: 'glass',
                solarRoof: true,
                color: '#3b82f6',
                coordinates: [
                    [35.1798, 31.9602],
                    [35.1804, 31.9603],
                    [35.1805, 31.9598],
                    [35.1799, 31.9597],
                    [35.1798, 31.9602]
                ]
            },
            {
                id: 'bld-bz-library',
                name: 'مكتبة يوسف أحمد الغانم المركزية',
                height: 16,
                skin: 'concrete',
                solarRoof: false,
                color: '#708090',
                coordinates: [
                    [35.1811, 31.9607],
                    [35.1817, 31.9608],
                    [35.1818, 31.9603],
                    [35.1812, 31.9602],
                    [35.1811, 31.9607]
                ]
            },
            {
                id: 'bld-bz-science',
                name: 'كلية العلوم والدراسات الرياضية',
                height: 20,
                skin: 'brick',
                solarRoof: true,
                color: '#b45309',
                coordinates: [
                    [35.1788, 31.9593],
                    [35.1794, 31.9594],
                    [35.1795, 31.9589],
                    [35.1789, 31.9588],
                    [35.1788, 31.9593]
                ]
            }
        ];

        const streets = [
            {
                id: 'st-bz-main',
                name: 'شارع الحرم الجامعي الرئيسي',
                width: 12,
                style: 'asphalt',
                coordinates: [
                    [35.1780, 31.9590],
                    [35.1800, 31.9595],
                    [35.1810, 31.9598],
                    [35.1825, 31.9602]
                ]
            },
            {
                id: 'st-bz-walkway',
                name: 'ممر المشاة التراثي التوأم',
                width: 6,
                style: 'cobblestone',
                coordinates: [
                    [35.1805, 31.9598],
                    [35.1808, 31.9605],
                    [35.1812, 31.9610]
                ]
            }
        ];

        const points = [
            {
                type: "Feature",
                properties: { name: "النافورة التفاعلية المركزية", type: "fountain", scale: 1.5, rotation: 0, offsetX: 0, offsetY: 0 },
                geometry: { type: "Point", coordinates: [35.1809, 31.9600] }
            },
            {
                type: "Feature",
                properties: { name: "عنفات الرياح - طاقة نظيفة", type: "wind_turbine", scale: 1.3, rotation: 45, offsetX: 0, offsetY: 0 },
                geometry: { type: "Point", coordinates: [35.1785, 31.9585] }
            },
            {
                type: "Feature",
                properties: { name: "نخلة زينة ممر الإدارة", type: "palm", scale: 1.2, rotation: 0, offsetX: 0, offsetY: 0 },
                geometry: { type: "Point", coordinates: [35.1805, 31.9594] }
            },
            {
                type: "Feature",
                properties: { name: "نخلة زينة ممر الإدارة 2", type: "palm", scale: 1.2, rotation: 15, offsetX: 0, offsetY: 0 },
                geometry: { type: "Point", coordinates: [35.1808, 31.9595] }
            },
            {
                type: "Feature",
                properties: { name: "شجرة صنوبر مدخل تكنولوجيا المعلومات", type: "tree", scale: 1.0, rotation: 0, offsetX: 0, offsetY: 0 },
                geometry: { type: "Point", coordinates: [35.1797, 31.9598] }
            },
            {
                type: "Feature",
                properties: { name: "شجرة صنوبر مدخل تكنولوجيا المعلومات 2", type: "tree", scale: 1.1, rotation: 30, offsetX: 0, offsetY: 0 },
                geometry: { type: "Point", coordinates: [35.1796, 31.9600] }
            },
            {
                type: "Feature",
                properties: { name: "عمود إنارة حديث 1", type: "streetlight", scale: 1.0, rotation: 90, offsetX: 0, offsetY: 0 },
                geometry: { type: "Point", coordinates: [35.1790, 31.9592] }
            },
            {
                type: "Feature",
                properties: { name: "عمود إنارة حديث 2", type: "streetlight", scale: 1.0, rotation: 90, offsetX: 0, offsetY: 0 },
                geometry: { type: "Point", coordinates: [35.1800, 31.9594] }
            },
            {
                type: "Feature",
                properties: { name: "فانوس تراثي ممر المكتبة", type: "classic_lamp", scale: 1.0, rotation: 0, offsetX: 0, offsetY: 0 },
                geometry: { type: "Point", coordinates: [35.1807, 31.9603] }
            },
            {
                type: "Feature",
                properties: { name: "فانوس تراثي ممر المكتبة 2", type: "classic_lamp", scale: 1.0, rotation: 180, offsetX: 0, offsetY: 0 },
                geometry: { type: "Point", coordinates: [35.1810, 31.9608] }
            },
            {
                type: "Feature",
                properties: { name: "سيارة زائر سيدان", type: "car", scale: 1.0, rotation: 120, offsetX: 0, offsetY: 0 },
                geometry: { type: "Point", coordinates: [35.1803, 31.9605] }
            },
            {
                type: "Feature",
                properties: { name: "سيارة رئيس الجامعة الرياضية", type: "sports_car", scale: 0.95, rotation: 300, offsetX: 0, offsetY: 0 },
                geometry: { type: "Point", coordinates: [35.1804, 31.9606] }
            },
            {
                type: "Feature",
                properties: { name: "شاحنة صيانة الجامعة", type: "truck", scale: 1.1, rotation: 10, offsetX: 0, offsetY: 0 },
                geometry: { type: "Point", coordinates: [35.1787, 31.9591] }
            },
            {
                type: "Feature",
                properties: { name: "منارة هولوغرام مركزية", type: "beacon", scale: 1.2, rotation: 0, offsetX: 0, offsetY: 0 },
                geometry: { type: "Point", coordinates: [35.1806, 31.9600] }
            }
        ];

        setCenterCoords(birzeitCenter);
        setCustomBuildings(buildings);
        setCustomStreets(streets);
        setCustomPoints(points);
        setGeojsonData(null);

        if (mapRef.current) {
            mapRef.current.flyTo({
                center: birzeitCenter,
                zoom: 17.5,
                pitch: 58,
                bearing: -25,
                duration: 1500
            });
        }

        alert('🎉 تم تحميل المخطط الرقمي التفاعلي لجامعة بيرزيت بنجاح! تصفح المعالم ثلاثية الأبعاد المكسوة، والنافورة المتحركة، ومولدات طاقة الرياح.');
    };


    // ─── 3. خامات ونسيج إجرائي واقعي (Canvas Textures) ────────────────────
    const getProceduralTexture = (type, colorHex, isNight) => {
        const cacheKey = `${type}-${colorHex}-${isNight ? 'night' : 'day'}`;
        if (texturesCacheRef.current.has(cacheKey)) {
            return texturesCacheRef.current.get(cacheKey);
        }

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (type === 'glass') {
            canvas.width = 128;
            canvas.height = 128;
            ctx.fillStyle = isNight ? '#0a1128' : '#334155';
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
                        const isLit = (r + c) % 3 === 0 || (r * c) % 5 === 1;
                        ctx.fillStyle = isLit ? '#ffe082' : '#111827';
                        if (isLit) {
                            ctx.shadowColor = '#ffe082';
                            ctx.shadowBlur = 5;
                        } else {
                            ctx.shadowBlur = 0;
                        }
                    } else {
                        ctx.fillStyle = '#bae6fd'; // زجاج أزرق نهاراً
                        ctx.shadowBlur = 0;
                    }
                    ctx.fillRect(x, y, wWidth, wHeight);
                    ctx.strokeStyle = '#1e293b';
                    ctx.lineWidth = 1.5;
                    ctx.strokeRect(x, y, wWidth, wHeight);
                }
            }
        } else if (type === 'stone') {
            // نسيج الحجر التراثي الأبيض والأصفر المحلي
            canvas.width = 128;
            canvas.height = 128;
            ctx.fillStyle = '#f5f5f4'; // خلفية حجرية فاتحة
            ctx.fillRect(0, 0, 128, 128);

            // خطوط الطوب
            ctx.strokeStyle = '#d6d3d1';
            ctx.lineWidth = 1.5;

            // صفوف أفقية
            for (let y = 0; y <= 128; y += 16) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(128, y);
                ctx.stroke();
            }

            // فواصل رأسية متداخلة
            for (let row = 0; row < 8; row++) {
                const y = row * 16;
                const offset = (row % 2) * 32;
                for (let x = offset; x <= 128 + 32; x += 64) {
                    ctx.beginPath();
                    ctx.moveTo(x - 32, y);
                    ctx.lineTo(x - 32, y + 16);
                    ctx.stroke();
                }
            }

            // إضافة تفاصيل نسيج للحجر
            ctx.fillStyle = 'rgba(120, 113, 108, 0.08)';
            for (let i = 0; i < 500; i++) {
                ctx.fillRect(Math.random() * 128, Math.random() * 128, Math.random() * 4, Math.random() * 2);
            }
        } else if (type === 'brick') {
            canvas.width = 64;
            canvas.height = 64;
            ctx.fillStyle = colorHex || '#b45309'; 
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
            canvas.width = 128;
            canvas.height = 128;
            ctx.fillStyle = '#cbd5e1';
            ctx.fillRect(0, 0, 128, 128);

            ctx.fillStyle = '#94a3b8';
            for (let i = 0; i < 500; i++) {
                ctx.fillRect(Math.random() * 128, Math.random() * 128, Math.random() * 2, Math.random() * 2);
            }
        } else if (type === 'solar') {
            canvas.width = 64;
            canvas.height = 64;
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(0, 0, 64, 64);
            ctx.strokeStyle = '#64748b';
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
        
        if (type === 'brick') texture.repeat.set(6, 6);
        else if (type === 'stone') texture.repeat.set(4, 4);
        else texture.repeat.set(3, 3);

        texturesCacheRef.current.set(cacheKey, texture);
        return texture;
    };

    // ─── 4. تهيئة الخريطة وطبقاتها ──────────────────────────────────────────
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
            zoom: geojsonData || customBuildings.length > 0 ? 17 : 12, // بدء واسع إذا لم يكن هناك معالم
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

        // Double-click ينهي الرسم بدلاً من zoom الافتراضي
        map.on('dblclick', (e) => {
            if (drawModeRef.current !== 'none' && drawModeRef.current !== 'point') {
                e.preventDefault();
                // نستخدم setTimeout لأن dblclick يسبقه click مزدوج — نتحقق أن لدينا نقاط كافية
                setTimeout(() => {
                    const coords = drawnCoordsRef.current;
                    if (coords.length >= 2) {
                        handleFinishDrawingRef.current && handleFinishDrawingRef.current();
                    }
                }, 50);
            }
        });

        return () => {
            map.remove();
        };
    }, [activeBasemap]);

    // ─── 5. إعداد مصادر البيانات والطبقات ──────────────────────────────────
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

        map.addLayer({
            id: 'dt-drawing-points',
            type: 'circle',
            source: 'dt-drawing-source',
            filter: ['==', '$type', 'Point'],
            paint: {
                'circle-color': '#10b981',
                'circle-radius': 6,
                'circle-stroke-color': '#ffffff',
                'circle-stroke-width': 2
            }
        });

        // طبقة رندرة الشوارع المرسومة يدوياً
        map.addSource('dt-custom-streets-source', {
            type: 'geojson',
            data: getStreetsGeoJSON()
        });

        // الشارع الأساسي (طين/حصى/أسفلت طبقاً للستايل)
        map.addLayer({
            id: 'dt-custom-streets-base',
            type: 'line',
            source: 'dt-custom-streets-source',
            paint: {
                'line-color': [
                    'match',
                    ['get', 'style'],
                    'gravel', '#854d0e',   // طريق ترابي بني
                    'cobblestone', '#64748b', // ممر حجري رمادي
                    'neon', '#090d16',        // نيون داكن
                    '#1e293b'                 // أسفلت رمادي داكن افتراضي
                ],
                'line-width': [
                    'interpolate', ['linear'], ['zoom'],
                    14, 4,
                    17, 12,
                    20, 28
                ]
            }
        });

        // الخطوط والإضاءة المحددة للشارع
        map.addLayer({
            id: 'dt-custom-streets-stripe',
            type: 'line',
            source: 'dt-custom-streets-source',
            paint: {
                'line-color': [
                    'match',
                    ['get', 'style'],
                    'neon', '#10b981', // خطوط خضراء مضيئة
                    'cobblestone', '#475569', // فواصل داكنة للحجارة
                    'gravel', 'transparent', // لا خطوط للطريق الترابي
                    '#f59e0b' // أصفر متقطع للأسفلت
                ],
                'line-width': 1.5,
                'line-dasharray': [3, 4]
            }
        });

        // تجسيم مضلعات الـ GeoJSON ثنائية الأبعاد والمباني المرسومة يدوياً
        map.addSource('dt-buildings-source', {
            type: 'geojson',
            data: getBuildingsGeoJSON()
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

        map.on('click', 'dt-buildings-3d', (e) => {
            if (e.features && e.features.length > 0) {
                const feat = e.features[0];
                const featId = feat.properties.id || feat.id;
                
                // تحقق مما إذا كان المبنى مخصصاً مرسوماً
                const customIdx = customBuildingsRef.current.findIndex(b => b.id === featId);
                if (customIdx !== -1) {
                    const bld = customBuildingsRef.current[customIdx];
                    setSelectedFeature({
                        type: 'custom-building',
                        id: bld.id,
                        index: customIdx,
                        properties: bld,
                        coords: e.lngLat
                    });
                    setEditHeight(bld.height || 15);
                    setEditSkin(bld.skin || 'glass');
                    setEditSolarRoof(bld.solarRoof || false);
                    setEditColor(bld.color || '#3b82f6');
                    setEditScale(bld.scale || 1.0);
                    setEditRotation(bld.rotation || 0);
                    setEditOffsetX(bld.offsetX || 0);
                    setEditOffsetY(bld.offsetY || 0);
                } else {
                    setSelectedFeature({
                        type: 'building-base',
                        id: feat.id || Math.random().toString(),
                        properties: feat.properties,
                        coords: e.lngLat
                    });
                }
            }
        });

        // دمج طبقة Three.js للمباني المكسوة والنقاط المخصصة والنافورة المتحركة
        addThreeJsCustomLayer(map);
    };

    const getBuildingsGeoJSON = () => {
        const features = [];
        
        // 1. أضف المباني الأساسية من GeoJSON
        if (geojsonData) {
            const baseFeatures = geojsonData.type === 'FeatureCollection' ? geojsonData.features : [geojsonData];
            baseFeatures.forEach(f => {
                if (f.geometry && f.geometry.type.includes('Polygon')) {
                    features.push(f);
                }
            });
        }
        
        // 2. أضف المباني المرسومة يدوياً من قبل المستخدم
        customBuildings.forEach(bld => {
            features.push({
                type: 'Feature',
                properties: {
                    id: bld.id,
                    name: bld.name,
                    height: bld.height || 15,
                    color: bld.color || '#3b82f6',
                    skin: bld.skin || 'glass',
                    solarRoof: bld.solarRoof || false
                },
                geometry: {
                    type: 'Polygon',
                    coordinates: [bld.coordinates]
                }
            });
        });
        
        return {
            type: 'FeatureCollection',
            features: features
        };
    };

    const getStreetsGeoJSON = () => {
        return {
            type: 'FeatureCollection',
            features: customStreets.map(st => ({
                type: 'Feature',
                properties: { name: st.name, style: st.style, width: st.width || 8 },
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

    useEffect(() => {
        const map = mapRef.current;
        if (map && map.getSource('dt-buildings-source')) {
            map.getSource('dt-buildings-source').setData(getBuildingsGeoJSON());
        }
    }, [customBuildings, geojsonData]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map || !map.getSource('dt-drawing-source')) return;

        const features = [];

        // 1. أضف النقاط التي تم النقر عليها كدوائر مرئية لتسهيل الرسم والمتابعة
        drawnCoords.forEach((coord, index) => {
            features.push({
                type: 'Feature',
                properties: { type: 'handle', index },
                geometry: { type: 'Point', coordinates: coord }
            });
        });

        // 2. أضف الخط الرابط بين النقاط (الشارع أو أضلاع المبنى الجاري رسمه)
        if (drawnCoords.length >= 2) {
            features.push({
                type: 'Feature',
                properties: { type: 'path' },
                geometry: {
                    type: 'LineString',
                    coordinates: drawnCoords
                }
            });
        }

        // 3. أضف المضلع المغلق للمبنى في حال تحديد 3 نقاط على الأقل
        if (drawMode === 'building' && drawnCoords.length >= 3) {
            features.push({
                type: 'Feature',
                properties: { type: 'polygon' },
                geometry: {
                    type: 'Polygon',
                    coordinates: [[...drawnCoords, drawnCoords[0]]]
                }
            });
        }

        map.getSource('dt-drawing-source').setData({
            type: 'FeatureCollection',
            features: features
        });
    }, [drawnCoords, drawMode]);

    // تأثير تغيير شكل المؤشر حسب وضع الرسم
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;
        if (drawMode !== 'none') {
            map.getCanvas().style.cursor = 'crosshair';
        } else {
            map.getCanvas().style.cursor = '';
        }
    }, [drawMode]);

    // خط المعاينة اللحظي (يتتبع الماوس أثناء الرسم)
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        const onMouseMove = (e) => {
            const mode = drawModeRef.current;
            const coords = drawnCoords; // stale here is fine; refreshed on next click
            const src = map.getSource('dt-drawing-source');
            if (!src || (mode !== 'building' && mode !== 'street')) return;
            if (drawnCoords.length === 0) return;

            const mouseCoord = [e.lngLat.lng, e.lngLat.lat];
            const previewLine = {
                type: 'Feature',
                properties: { type: 'preview' },
                geometry: {
                    type: 'LineString',
                    coordinates: [...drawnCoords, mouseCoord]
                }
            };

            // إعادة رسم مجموعة المعالم مع إضافة خط المعاينة
            const features = drawnCoords.map((coord, index) => ({
                type: 'Feature',
                properties: { type: 'handle', index },
                geometry: { type: 'Point', coordinates: coord }
            }));
            features.push(previewLine);
            if (mode === 'building' && drawnCoords.length >= 3) {
                features.push({
                    type: 'Feature',
                    properties: { type: 'polygon' },
                    geometry: { type: 'Polygon', coordinates: [[...drawnCoords, mouseCoord, drawnCoords[0]]] }
                });
            }
            src.setData({ type: 'FeatureCollection', features });
        };

        if (drawMode !== 'none') {
            map.on('mousemove', onMouseMove);
        }
        return () => {
            map.off('mousemove', onMouseMove);
        };
    }, [drawMode, drawnCoords]);

    // ─── 6. معالجة الأحداث والضغط على الخريطة ─────────────────────────────
    // دالة محاذاة الإحداثيات الجغرافية لشبكة أمتار افتراضية دقيقة طبقاً لخط العرض الحالي للموقع
    const snapCoords = (lng, lat, sizeInMeters = 0.5) => {
        const latDegreePerMeter = 1 / 111132;
        const lngDegreePerMeter = 1 / (111132 * Math.cos((lat * Math.PI) / 180));
        
        const latGridSize = sizeInMeters * latDegreePerMeter;
        const lngGridSize = sizeInMeters * lngDegreePerMeter;
        
        const snappedLng = Math.round(lng / lngGridSize) * lngGridSize;
        const snappedLat = Math.round(lat / latGridSize) * latGridSize;
        return [snappedLng, snappedLat];
    };

    const handleMapClick = (e, map) => {
        if (!canEdit) {
            inspectClosestFeature(e);
            return;
        }

        const currentMode = drawModeRef.current;
        let clickLng = e.lngLat.lng;
        let clickLat = e.lngLat.lat;

        if (gridSnappingRef.current) {
            const snapped = snapCoords(clickLng, clickLat, gridSizeRef.current);
            clickLng = snapped[0];
            clickLat = snapped[1];
        }

        if (currentMode === 'building' || currentMode === 'street') {
            setDrawnCoords(prev => [...prev, [clickLng, clickLat]]);
            return;
        }

        if (currentMode === 'point') {
            const placementType = selectedPlacementTypeRef.current;
            const newPt = {
                type: "Feature",
                properties: {
                    name: `${placementType} مضاف حديثاً`,
                    type: placementType,
                    scale: 1.0,
                    rotation: 0,
                    offsetX: 0,
                    offsetY: 0
                },
                geometry: {
                    type: "Point",
                    coordinates: [clickLng, clickLat]
                }
            };
            setCustomPoints(prev => {
                const updated = [...prev, newPt];
                // auto-select the new point immediately
                setSelectedFeature({
                    type: 'point',
                    id: `custom-${prev.length}`,
                    isCustom: true,
                    index: prev.length,
                    properties: newPt.properties,
                    coords: new maplibregl.LngLat(clickLng, clickLat),
                    geometry: newPt.geometry
                });
                setEditScale(1.0);
                setEditRotation(0);
                setEditOffsetX(0);
                setEditOffsetY(0);
                return updated;
            });
            setDrawMode('none');
            return;
        }

        inspectClosestFeature(e);
    };

    const inspectClosestFeature = (e) => {
        const allPoints = [];
        if (geojsonData) {
            const features = geojsonData.type === 'FeatureCollection' ? geojsonData.features : [geojsonData];
            features.forEach((f, idx) => {
                if (f.geometry.type === 'Point') {
                    allPoints.push({ ...f, id: `base-${idx}`, isCustom: false, index: idx });
                }
            });
        }
        customPoints.forEach((p, idx) => {
            allPoints.push({ ...p, id: `custom-${idx}`, isCustom: true, index: idx });
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
                geometry: closest.geometry,
                index: closest.index
            });
            setEditScale(closest.properties.scale || 1.0);
            setEditRotation(closest.properties.rotation || 0);
            setEditOffsetX(closest.properties.offsetX || 0);
            setEditOffsetY(closest.properties.offsetY || 0);
            return;
        }

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
            setEditColor(closestBuilding.color || '#3b82f6');
            setEditScale(closestBuilding.scale || 1.0);
            setEditRotation(closestBuilding.rotation || 0);
            setEditOffsetX(closestBuilding.offsetX || 0);
            setEditOffsetY(closestBuilding.offsetY || 0);
            return;
        }
    };

    // ─── 7. طبقة الرندر ثلاثي الأبعاد المخصصة (Three.js Layer) ─────────────────
    const addThreeJsCustomLayer = (map) => {
        const customLayer = {
            id: 'threejs-digital-twin-layer',
            type: 'custom',
            renderingMode: '3d',
            onAdd: function (mapInstance, gl) {
                this.map = mapInstance;
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

                // Register rebuild callback so React state changes can trigger rebuild
                rebuildSceneRef.current = () => buildThreeJsScene();
                buildThreeJsScene();
            },
            render: function (gl, matrix) {
                if (autoTourRef.current && this.map) {
                    const currentBearing = this.map.getBearing();
                    this.map.setBearing(currentBearing + 0.08);
                }

                // Recompute anchor every frame so newly drawn features at any location render correctly
                const anchor = maplibregl.MercatorCoordinate.fromLngLat(centerCoordsRef.current, 0);
                const ms = anchor.meterInMercatorCoordinateUnits();

                const m = new THREE.Matrix4().fromArray(matrix);
                const l = new THREE.Matrix4()
                    .makeTranslation(anchor.x, anchor.y, anchor.z)
                    .scale(new THREE.Vector3(ms, -ms, ms));

                this.camera.projectionMatrix = m.multiply(l);

                timeRef.current += 0.015;
                
                animatedRotorsRef.current.forEach(rotor => {
                    rotor.rotation.z += 0.08;
                });

                animatedBeaconsRef.current.forEach(beacon => {
                    const pulse = 1.0 + Math.sin(timeRef.current * 4) * 0.15;
                    beacon.scale.set(pulse, 1.0, pulse);
                });

                animatedWaterJetsRef.current.forEach((jet, idx) => {
                    const wave = 1.0 + Math.sin(timeRef.current * 9 + idx) * 0.28;
                    jet.scale.set(wave, 1.0 + Math.sin(timeRef.current * 7 + idx) * 0.4, wave);
                });

                this.renderer.resetState();
                this.renderer.render(this.scene, this.camera);
                
                if (this.map) this.map.triggerRepaint();
            }
        };

        map.addLayer(customLayer);
    };

    // ─── 8. إنشاء وتحديث الكائنات والمباني المكسوة بالخامات ثلاثية الأبعاد ──────
    const buildThreeJsScene = () => {
        const scene = threeSceneRef.current;
        if (!scene) return;

        meshesMapRef.current.forEach(mesh => scene.remove(mesh));
        meshesMapRef.current.clear();
        animatedRotorsRef.current = [];
        animatedBeaconsRef.current = [];
        animatedWaterJetsRef.current = [];

        // إضافة شبكة هولوغرافية ثلاثية الأبعاد للمساعدة في القياس والاصطفاف الدقيق للأصول
        if (showGridHelperRef.current) {
            const gridHelper = new THREE.GridHelper(300, 60, 0x10b981, 0x1e293b);
            gridHelper.rotation.x = Math.PI / 2; // محاذاة للسطح الأفقي لـ MapLibre
            gridHelper.position.set(0, 0, 0.05); // مرتفع قليلاً عن الأرض لتجنب الـ Z-fighting مع الخريطة
            
            const applyGridMaterial = (mat) => {
                mat.transparent = true;
                mat.opacity = 0.22;
                mat.depthWrite = false;
            };
            if (Array.isArray(gridHelper.material)) {
                gridHelper.material.forEach(applyGridMaterial);
            } else if (gridHelper.material) {
                applyGridMaterial(gridHelper.material);
            }
            
            scene.add(gridHelper);
            meshesMapRef.current.set('grid-helper', gridHelper);
        }

        // Read from refs so this always gets the latest state even inside stale closures
        const currentCenter = centerCoordsRef.current;
        const currentBuildings = customBuildingsRef.current;
        const currentPoints = customPointsRef.current;
        const currentGeoJSON = geojsonDataRef.current;
        const currentMappings = pointMappingsRef.current;
        const currentTimeOfDay = timeOfDayRef.current;

        const anchorMerc = maplibregl.MercatorCoordinate.fromLngLat(currentCenter, 0);
        const meterScale = anchorMerc.meterInMercatorCoordinateUnits();
        const isNight = currentTimeOfDay < 6 || currentTimeOfDay > 18;

        // أ. رندرة المباني المخصصة والمكسوة بالخامات الواقعية
        currentBuildings.forEach((bld, idx) => {
            if (!bld.coordinates || bld.coordinates.length < 3) return;

            const localPoints = bld.coordinates.map(coord => {
                const pMerc = maplibregl.MercatorCoordinate.fromLngLat(coord, 0);
                const dx = (pMerc.x - anchorMerc.x) / meterScale;
                const dy = -(pMerc.y - anchorMerc.y) / meterScale;
                return new THREE.Vector2(dx, dy);
            });

            // حساب مركز المبنى (Centroid)
            let centerX = 0, centerY = 0;
            localPoints.forEach(p => {
                centerX += p.x;
                centerY += p.y;
            });
            centerX /= localPoints.length;
            centerY /= localPoints.length;

            const shape = new THREE.Shape();
            const centeredPoints = localPoints.map(p => new THREE.Vector2(p.x - centerX, p.y - centerY));

            shape.moveTo(centeredPoints[0].x, centeredPoints[0].y);
            for (let i = 1; i < centeredPoints.length; i++) {
                shape.lineTo(centeredPoints[i].x, centeredPoints[i].y);
            }
            shape.closePath();

            const height = bld.height || 15;
            const extrudeSettings = { depth: height, bevelEnabled: false };
            const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

            const wallTexture = getProceduralTexture(bld.skin || 'glass', bld.color || '#3b82f6', isNight);
            const wallMaterial = new THREE.MeshLambertMaterial({
                map: wallTexture,
                color: bld.color ? new THREE.Color(bld.color) : 0xffffff,
                side: THREE.DoubleSide // لضمان رؤية جدران المبنى بغض النظر عن اتجاه الرسم (مع عقارب الساعة أو عكسها) وتفادي الحذف الخلفي للوجوه
            });

            let roofMaterial;
            if (bld.solarRoof) {
                const solarTexture = getProceduralTexture('solar', '#ffffff', false);
                roofMaterial = new THREE.MeshLambertMaterial({ map: solarTexture, side: THREE.DoubleSide });
            } else {
                roofMaterial = new THREE.MeshLambertMaterial({ color: 0x27272a, side: THREE.DoubleSide });
            }

            const materials = [roofMaterial, wallMaterial];
            const mesh = new THREE.Mesh(geometry, materials);

            const scaleVal = bld.scale || 1.0;
            mesh.scale.set(scaleVal, scaleVal, 1.0);

            const rotationDeg = bld.rotation || 0;
            mesh.rotation.z = (rotationDeg * Math.PI) / 180;

            const offsetX = bld.offsetX || 0;
            const offsetY = bld.offsetY || 0;
            mesh.position.set(centerX + offsetX, centerY + offsetY, 0);

            scene.add(mesh);
            meshesMapRef.current.set(`bld-${bld.id || idx}`, mesh);
        });

        // ب. رندرة النقاط ثلاثية الأبعاد
        const allPoints = [];
        if (currentGeoJSON) {
            const features = currentGeoJSON.type === 'FeatureCollection' ? currentGeoJSON.features : [currentGeoJSON];
            features.forEach((f, idx) => {
                if (f.geometry && f.geometry.type === 'Point') {
                    allPoints.push({ ...f, id: `base-${idx}` });
                }
            });
        }
        currentPoints.forEach((p, idx) => {
            allPoints.push({ ...p, id: `custom-${idx}` });
        });

        allPoints.forEach((p) => {
            if (!p.geometry || !p.geometry.coordinates) return;
            const coords = p.geometry.coordinates;
            const pMerc = maplibregl.MercatorCoordinate.fromLngLat(coords, 0);

            let dx = (pMerc.x - anchorMerc.x) / meterScale;
            let dy = -(pMerc.y - anchorMerc.y) / meterScale;

            dx += p.properties?.offsetX || 0;
            dy += p.properties?.offsetY || 0;

            const type = p.properties?.type || 'tree';
            const mapping = (currentMappings && currentMappings[type]) || { model: 'tree', scale: 1.0, color: '#10b981' };

            const group = new THREE.Group();
            group.position.set(dx, dy, 0);
            
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

    // إعادة بناء مشهد Three.js تلقائياً عند تحديث الكائنات أو المباني أو الوقت أو البيانات
    useEffect(() => {
        // rebuildSceneRef is registered after Three.js onAdd runs, so it's always safe
        if (rebuildSceneRef.current) {
            rebuildSceneRef.current();
        }
    }, [customPoints, customBuildings, geojsonData, timeOfDay, centerCoords, showGridHelper]);

    // تأثير محاكاة مستشعرات إنترنت الأشياء (IoT Telemetry Simulation)
    useEffect(() => {
        if (!iotSimulation) return;

        const interval = setInterval(() => {
            setSimulatedTelemetry(prev => {
                const next = { ...prev };

                customPoints.forEach((p, idx) => {
                    const id = `custom-${idx}`;
                    const type = p.properties?.type || 'tree';

                    if (!next[id]) {
                        next[id] = {};
                    }

                    if (type === 'wind_turbine') {
                        const windSpeed = 4.5 + Math.random() * 11; // m/s
                        const rpm = Math.round(windSpeed * 7.2);
                        const power = ((0.5 * 1.2 * Math.PI * 16 * Math.pow(windSpeed, 3) * 0.38) / 1000).toFixed(2); // kW
                        next[id] = {
                            status: 'توليد نشط',
                            windSpeed: windSpeed.toFixed(1) + ' m/s',
                            rpm: rpm + ' RPM',
                            power: power + ' kW'
                        };
                    } else if (type === 'streetlight' || type === 'classic_lamp') {
                        const isNight = timeOfDay < 6 || timeOfDay > 18;
                        next[id] = {
                            status: isNight ? 'مضيء' : 'مطفأ (توفير طاقة)',
                            consumption: isNight ? (75 + Math.random() * 8).toFixed(1) + ' W' : '0 W',
                            efficiency: '98.4%'
                        };
                    } else if (type === 'fountain') {
                        next[id] = {
                            status: 'ضخ مستمر',
                            pressure: (2.2 + Math.sin(Date.now() / 1000) * 0.35).toFixed(2) + ' bar',
                            height: (1.2 + Math.sin(Date.now() / 600) * 0.3).toFixed(2) + ' m'
                        };
                    } else if (type === 'beacon') {
                        next[id] = {
                            status: 'بث النبضة النشطة',
                            frequency: (1.5 + Math.sin(Date.now() / 1500) * 0.15).toFixed(2) + ' Hz',
                            signal: (-60 - Math.round(Math.random() * 7)) + ' dBm'
                        };
                    } else if (type === 'cctv') {
                        const motionActive = Math.random() > 0.85;
                        next[id] = {
                            status: 'تسجيل مستمر (1080p)',
                            fps: '30 fps',
                            bandwidth: (3.8 + Math.random() * 1.4).toFixed(1) + ' Mbps',
                            motion: motionActive ? '🚨 تم رصد حركة!' : 'مستقر'
                        };
                    } else {
                        next[id] = {
                            status: 'نشط',
                            temperature: (23.2 + Math.sin(Date.now() / 4000) * 1.1).toFixed(1) + ' °C'
                        };
                    }
                });

                return next;
            });

            // إضافة سجل جديد في دفق البيانات
            const types = ['wind_turbine', 'cctv', 'beacon', 'fountain', 'streetlight'];
            const randomType = types[Math.floor(Math.random() * types.length)];
            const timestamp = new Date().toLocaleTimeString('ar-EG');
            let logText = '';

            if (randomType === 'wind_turbine') {
                logText = `[${timestamp}] 🌀 عنفة رياح: تم تحديث معدل الدوران؛ التوليد الحالي يبلغ ${(8 + Math.random() * 12).toFixed(1)} kW.`;
            } else if (randomType === 'cctv') {
                logText = `[${timestamp}] 📹 كاميرا: بث الفيديو مستمر، النطاق الترددي ${(3.5 + Math.random() * 1.5).toFixed(1)} Mbps.`;
            } else if (randomType === 'beacon') {
                logText = `[${timestamp}] 📡 منارة هولوغرام: تم إرسال نبضة مزامنة مكانية بنجاح.`;
            } else if (randomType === 'fountain') {
                logText = `[${timestamp}] ⛲ نافورة: تم ضبط تدفق ضخ المياه ديناميكياً لتأثير التموج.`;
            } else {
                logText = `[${timestamp}] 💡 إنارة الشوارع: الاستهلاك الكلي للمنطقة ${(180 + Math.random() * 20).toFixed(1)} W.`;
            }

            setTelemetryLogs(prev => [logText, ...prev.slice(0, 24)]);
        }, 2000);

        return () => clearInterval(interval);
    }, [iotSimulation, customPoints, timeOfDay]);

    // ─── 9. مولّد الكائنات ثلاثية الأبعاد الإجرائي المتقدم ───────────────────
    const buildProceduralModel = (type, group, colorHex, isNight) => {
        const matColor = new THREE.Color(colorHex);

        switch (type) {
            case 'palm': {
                // شجرة نخيل واقعية
                // جذع حجر حلقي متدرج
                const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5a3e2b });
                for (let i = 0; i < 7; i++) {
                    const segment = new THREE.Mesh(
                        new THREE.CylinderGeometry(0.12 - i * 0.008, 0.15 - i * 0.008, 0.45, 6),
                        trunkMat
                    );
                    segment.position.z = 0.22 + i * 0.45;
                    segment.rotation.x = Math.PI / 2;
                    group.add(segment);
                }

                // سعف النخيل الممتد
                const leafMat = new THREE.MeshLambertMaterial({ color: 0x064e3b });
                for (let j = 0; j < 12; j++) {
                    const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.4, 0.04), leafMat);
                    leaf.position.set(0, 0, 3.2);
                    
                    // تدوير وانحناء السعفة
                    const leafRotContainer = new THREE.Group();
                    leafRotContainer.rotation.z = (j * Math.PI * 2) / 12;
                    
                    leaf.rotation.x = Math.PI / 4 + Math.random() * 0.1; // انحناء لأسفل
                    leaf.position.y = 0.6; // إزاحة عن المركز
                    
                    leafRotContainer.add(leaf);
                    group.add(leafRotContainer);
                }
                break;
            }
            case 'fountain': {
                // نافورة مياه متحركة ومضيئة
                // حوض حجري دائري
                const baseGeo = new THREE.CylinderGeometry(1.2, 1.4, 0.35, 12);
                const stoneMat = new THREE.MeshLambertMaterial({ color: 0x78716c });
                const base = new THREE.Mesh(baseGeo, stoneMat);
                base.position.z = 0.18;
                base.rotation.x = Math.PI / 2;
                group.add(base);

                // عمود مائي مركزي
                const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.8, 8), stoneMat);
                post.position.set(0, 0, 0.4);
                post.rotation.x = Math.PI / 2;
                group.add(post);

                // نفاثات المياه المتحركة
                const waterMat = new THREE.MeshBasicMaterial({
                    color: 0x60a5fa,
                    transparent: true,
                    opacity: 0.68
                });

                const jetGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.4, 6);
                for (let k = 0; k < 6; k++) {
                    const jet = new THREE.Mesh(jetGeo, waterMat);
                    jet.rotation.x = Math.PI / 2;
                    jet.position.set(
                        Math.cos((k * Math.PI * 2) / 6) * 0.6,
                        Math.sin((k * Math.PI * 2) / 6) * 0.6,
                        0.7
                    );
                    // تدوير خفيف للخارج لتبدو كشلال متساقط
                    jet.rotation.z = (k * Math.PI * 2) / 6;
                    jet.rotation.y = 0.25;

                    group.add(jet);
                    animatedWaterJetsRef.current.push(jet);
                }
                break;
            }
            case 'classic_lamp': {
                // فانوس كلاسيكي عتيق
                const postGeo = new THREE.CylinderGeometry(0.05, 0.07, 3.2, 6);
                const postMat = new THREE.MeshLambertMaterial({ color: 0x18181b });
                const post = new THREE.Mesh(postGeo, postMat);
                post.position.z = 1.6;
                post.rotation.x = Math.PI / 2;
                group.add(post);

                // ذراع معلق
                const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.6, 0.12), postMat);
                arm.position.set(0, 0.2, 3.1);
                group.add(arm);

                // قفص المصباح الفانوس
                const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.08, 0.35, 4), postMat);
                lantern.position.set(0, 0.45, 2.9);
                lantern.rotation.x = Math.PI / 2;
                group.add(lantern);

                // لمبة الإنارة الصفراء المتوهجة
                const bulbMat = new THREE.MeshBasicMaterial({ color: isNight ? 0xffc107 : 0xeeeeee });
                const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 6), bulbMat);
                bulb.position.set(0, 0.45, 2.85);
                group.add(bulb);

                if (isNight) {
                    const cone = new THREE.Mesh(
                        new THREE.ConeGeometry(1.2, 2.8, 8, 1, true),
                        new THREE.MeshBasicMaterial({ color: 0xffeaad, transparent: true, opacity: 0.22, side: THREE.DoubleSide })
                    );
                    cone.position.set(0, 0.45, 1.4);
                    cone.rotation.x = Math.PI / 2;
                    group.add(cone);
                }
                break;
            }
            case 'sports_car': {
                // سيارة سباق رياضية منخفضة
                const body = new THREE.Mesh(
                    new THREE.BoxGeometry(1.3, 2.4, 0.45),
                    new THREE.MeshLambertMaterial({ color: matColor })
                );
                body.position.z = 0.3;
                group.add(body);

                // جناح رياضي خلفي (Spoiler)
                const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.2, 0.15), new THREE.MeshLambertMaterial({ color: 0x111111 }));
                spoiler.position.set(0, -1.0, 0.65);
                group.add(spoiler);

                // كابينة زجاجية منخفضة
                const cabin = new THREE.Mesh(
                    new THREE.BoxGeometry(0.9, 1.2, 0.35),
                    new THREE.MeshPhysicalMaterial({ color: 0x111c24, transparent: true, opacity: 0.8, transmission: 0.5 })
                );
                cabin.position.set(0, -0.1, 0.6);
                group.add(cabin);

                // إطارات سوداء عريضة
                const wheelGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.3, 8);
                const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
                const wheelPos = [[-0.65, 0.7, 0.24], [0.65, 0.7, 0.24], [-0.65, -0.7, 0.24], [0.65, -0.7, 0.24]];
                wheelPos.forEach(pos => {
                    const w = new THREE.Mesh(wheelGeo, wheelMat);
                    w.position.set(pos[0], pos[1], pos[2]);
                    w.rotation.z = Math.PI / 2;
                    group.add(w);
                });
                break;
            }
            case 'truck': {
                // شاحنة نقل بضائع كبيرة
                const chassisMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
                const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.4, 4.2, 0.3), chassisMat);
                chassis.position.z = 0.35;
                group.add(chassis);

                // مقصورة القيادة البيضاء
                const cab = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 1.4), new THREE.MeshLambertMaterial({ color: 0xffffff }));
                cab.position.set(0, 1.3, 1.2);
                group.add(cab);

                // صندوق البضائع الفولاذي الخلفي
                const box = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.8, 1.6), new THREE.MeshLambertMaterial({ color: matColor }));
                box.position.set(0, -0.6, 1.3);
                group.add(box);

                const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.32, 8);
                const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
                const wheelPos = [[-0.7, 1.2, 0.35], [0.7, 1.2, 0.35], [-0.7, -0.8, 0.35], [0.7, -0.8, 0.35], [-0.7, -1.6, 0.35], [0.7, -1.6, 0.35]];
                wheelPos.forEach(pos => {
                    const w = new THREE.Mesh(wheelGeo, wheelMat);
                    w.position.set(pos[0], pos[1], pos[2]);
                    w.rotation.z = Math.PI / 2;
                    group.add(w);
                });
                break;
            }
            case 'tree': {
                const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.22, 1.2, 5), new THREE.MeshLambertMaterial({ color: 0x5c4033 }));
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
                const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 0.6), new THREE.MeshLambertMaterial({ color: matColor }));
                body.position.z = 0.45;
                group.add(body);

                const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.1, 0.45), new THREE.MeshPhysicalMaterial({ color: 0x111e2e, transparent: true, opacity: 0.8, transmission: 0.6 }));
                cabin.position.set(0, 0.1, 0.95);
                group.add(cabin);

                const wheelGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.25, 8);
                const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
                const wheelPositions = [[-0.6, 0.7, 0.24], [0.6, 0.7, 0.24], [-0.6, -0.7, 0.24], [0.6, -0.7, 0.24]];
                wheelPositions.forEach(pos => {
                    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
                    wheel.position.set(pos[0], pos[1], pos[2]);
                    wheel.rotation.z = Math.PI / 2;
                    group.add(wheel);
                });
                break;
            }
            case 'streetlight': {
                const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 4.0, 6), new THREE.MeshLambertMaterial({ color: 0x4f5d75 }));
                pole.position.z = 2.0;
                pole.rotation.x = Math.PI / 2;
                group.add(pole);

                const head = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.6, 0.12), new THREE.MeshLambertMaterial({ color: 0x4f5d75 }));
                head.position.set(0, 0.24, 4.0);
                group.add(head);

                const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 6), new THREE.MeshBasicMaterial({ color: isNight ? 0xffeaad : 0xdddddd }));
                bulb.position.set(0, 0.45, 3.9);
                group.add(bulb);

                if (isNight) {
                    const cone = new THREE.Mesh(
                        new THREE.ConeGeometry(1.6, 4.0, 8, 1, true),
                        new THREE.MeshBasicMaterial({ color: 0xffeaad, transparent: true, opacity: 0.18, side: THREE.DoubleSide })
                    );
                    cone.position.set(0, 0.45, 1.9);
                    cone.rotation.x = Math.PI / 2;
                    group.add(cone);
                }
                break;
            }
            case 'wind_turbine': {
                const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.25, 7.0, 8), new THREE.MeshLambertMaterial({ color: 0xeeeeee }));
                tower.position.z = 3.5;
                tower.rotation.x = Math.PI / 2;
                group.add(tower);

                const generator = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.8, 0.4), new THREE.MeshLambertMaterial({ color: 0xeeeeee }));
                generator.position.set(0, 0, 7.0);
                group.add(generator);

                const rotorGroup = new THREE.Group();
                rotorGroup.position.set(0, 0.4, 7.0);
                
                const bladeGeo = new THREE.BoxGeometry(0.12, 3.2, 0.04);
                for (let i = 0; i < 3; i++) {
                    const blade = new THREE.Mesh(bladeGeo, new THREE.MeshLambertMaterial({ color: 0xeeeeee }));
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
                const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.2, 6), new THREE.MeshLambertMaterial({ color: 0x1f2937 }));
                pole.position.z = 1.6;
                pole.rotation.x = Math.PI / 2;
                group.add(pole);

                const box = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.9), new THREE.MeshLambertMaterial({ color: 0x1f2937 }));
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
                const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.0, 6), new THREE.MeshLambertMaterial({ color: 0x374151 }));
                pole.position.z = 1.5;
                pole.rotation.x = Math.PI / 2;
                group.add(pole);

                const head = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.35, 0.12), new THREE.MeshLambertMaterial({ color: 0x374151 }));
                head.position.set(0, 0.12, 3.0);
                head.rotation.x = -Math.PI / 6;
                group.add(head);
                break;
            }
            case 'beacon': {
                const base = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 0.15, 8), new THREE.MeshLambertMaterial({ color: 0x1f2937 }));
                base.position.z = 0.075;
                base.rotation.x = Math.PI / 2;
                group.add(base);

                const beam = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.24, 0.24, 3.0, 8, 1, true),
                    new THREE.MeshBasicMaterial({ color: matColor, transparent: true, opacity: 0.45, side: THREE.DoubleSide })
                );
                beam.position.z = 1.5;
                beam.rotation.x = Math.PI / 2;
                group.add(beam);

                animatedBeaconsRef.current.push(beam);
                break;
            }
            case 'bench':
            default: {
                const seat = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.5, 0.08), new THREE.MeshLambertMaterial({ color: 0x8b5a2b }));
                seat.position.set(0, 0, 0.4);
                group.add(seat);

                const legGeo = new THREE.BoxGeometry(0.1, 0.1, 0.4);
                const legMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
                const legPositions = [[-0.35, 0.6, 0.2], [0.35, 0.6, 0.2], [-0.35, -0.6, 0.2], [0.35, -0.6, 0.2]];
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

    // ─── 10. حفظ وحذف وتعديل النقاط والمباني والشوارع المرسومة يدوياً ─────────
    const handleSaveObjectEdits = () => {
        setSelectedFeature(null);
    };

    const handleSaveBuildingEdits = () => {
        setSelectedFeature(null);
    };

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

    // ─── 11. معالجة وإنهاء رسم الأشكال الهندسية ───────────────────────────
    const handleFinishDrawing = () => {
        if (drawnCoords.length < 2) {
            alert('يرجى تحديد نقطتين على الأقل للرسم.');
            return;
        }

        // حساب مركز الشكل المرسوم لتحريك الـ anchor إليه
        const avgLng = drawnCoords.reduce((s, c) => s + c[0], 0) / drawnCoords.length;
        const avgLat = drawnCoords.reduce((s, c) => s + c[1], 0) / drawnCoords.length;

        if (drawMode === 'building') {
            if (drawnCoords.length < 3) {
                alert('المبنى يتطلب 3 نقاط على الأقل.');
                return;
            }
            const closedCoords = [...drawnCoords, drawnCoords[0]];
            const newBld = {
                id: `bld-drawn-${Date.now()}`,
                name: `مبنى مرسوم #${customBuildingsRef.current.length + 1}`,
                height: 15,
                skin: 'glass',
                solarRoof: true,
                color: '#3b82f6',
                coordinates: closedCoords
            };

            // تحريك مركز الـ anchor إلى موقع المبنى الجديد
            setCenterCoords([avgLng, avgLat]);

            setCustomBuildings(prev => {
                const updated = [...prev, newBld];
                // Auto-select the new building
                setSelectedFeature({
                    type: 'custom-building',
                    id: newBld.id,
                    index: prev.length,
                    properties: newBld,
                    coords: { lng: closedCoords[0][0], lat: closedCoords[0][1] }
                });
                setEditHeight(newBld.height);
                setEditSkin(newBld.skin);
                setEditSolarRoof(newBld.solarRoof);
                setEditColor(newBld.color);
                setEditScale(1.0);
                setEditRotation(0);
                setEditOffsetX(0);
                setEditOffsetY(0);
                return updated;
            });

            // تحريك الكاميرا لعرض المبنى الجديد مباشرة
            if (mapRef.current) {
                mapRef.current.flyTo({ center: [avgLng, avgLat], zoom: 17, pitch: 55, duration: 800 });
            }
        } else if (drawMode === 'street') {
            const newStreet = {
                id: `st-drawn-${Date.now()}`,
                name: `شارع مرسوم #${customStreetsRef.current.length + 1}`,
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

    // ربط الـ ref لإتاحة الاستدعاء من الـ dblclick closure في الـ map
    handleFinishDrawingRef.current = handleFinishDrawing;

    return (
        <div className="dt-container">
            {/* واجهة إرشادية عند الرسم النشط */}
            {drawMode !== 'none' && (
                <div className="dt-placement-indicator">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.92rem' }}>
                            {drawMode === 'building' ? '📐 وضع رسم مبنى' : drawMode === 'street' ? '🛣️ وضع رسم شارع' : '📍 وضع إسقاط كائن'}
                        </span>
                        {drawMode !== 'point' && (
                            <span style={{ fontSize: '0.78rem', opacity: 0.75 }}>
                                {drawnCoords.length === 0
                                    ? 'انقر على الخريطة لتحديد أول نقطة'
                                    : drawnCoords.length === 1
                                    ? 'نقطة واحدة — استمر في النقر لإضافة نقاط'
                                    : `${drawnCoords.length} نقاط مُضافة — انقر مرتين أو اضغط "إنهاء" للحفظ`
                                }
                            </span>
                        )}
                        {drawMode === 'point' && (
                            <span style={{ fontSize: '0.78rem', opacity: 0.75 }}>انقر مباشرة على الخريطة لإسقاط الكائن</span>
                        )}
                    </div>
                    <div className="dt-placement-actions">
                        {drawMode !== 'point' && drawnCoords.length > 0 && (
                            <button className="dt-btn-hud-cancel" style={{ background: 'rgba(251,191,36,0.15)', borderColor: '#fbbf24', color: '#fbbf24' }} onClick={() => setDrawnCoords(prev => prev.slice(0, -1))}>↩ تراجع</button>
                        )}
                        {drawMode !== 'point' && drawnCoords.length >= 2 && (
                            <button className="dt-btn-hud-save" onClick={handleFinishDrawing}>✅ إنهاء وحفظ</button>
                        )}
                        <button className="dt-btn-hud-cancel" onClick={handleCancelDrawing}>✕ إلغاء</button>
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
                    <button className="dt-btn-secondary" style={{ width: 'auto', padding: '8px 16px', fontSize: '0.82rem', marginLeft: '10px', background: 'rgba(59, 130, 246, 0.15)', border: '1px solid #3b82f6', color: '#3b82f6' }} onClick={loadSampleData}>
                        ⚡ تحميل منطقة تجريبية (جامعة بيرزيت)
                    </button>
                    {canEdit && (
                        <button className="dt-btn-primary" style={{ width: 'auto', padding: '8px 22px', fontSize: '0.82rem', background: '#059669', color: '#fff' }} onClick={publishProject} disabled={loadingProject}>
                            💾 حفظ ونشر التوأم الرقمي
                        </button>
                    )}
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
                            <span className="dt-inspector-title">🔎 فاحص المعالم والطبقات</span>
                            <button className="dt-inspector-close" onClick={() => setSelectedFeature(null)}>✕</button>
                        </div>
                        <div className="dt-inspector-body">
                            {/* فحص وتعديل النقاط */}
                            {selectedFeature.type === 'point' && (
                                <>
                                    {/* عرض قراءات إنترنت الأشياء المباشرة إن وجدت وعقدت محاكاة */}
                                    {iotSimulation && simulatedTelemetry[selectedFeature.id] && (
                                        <div className="dt-section" style={{ background: 'rgba(16, 185, 129, 0.04)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '8px', padding: '10px', marginBottom: '14px' }}>
                                            <span className="dt-section-title" style={{ fontSize: '0.82rem', color: 'var(--dt-emerald)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <span className="dt-status-dot pulse" style={{ width: '7px', height: '7px', background: '#10b981', borderRadius: '50%', display: 'inline-block', boxShadow: '0 0 8px #10b981' }}></span>
                                                📡 الحساسات الذكية (IoT Telemetry)
                                            </span>
                                            <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                {Object.entries(simulatedTelemetry[selectedFeature.id]).map(([key, val]) => (
                                                    <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem' }}>
                                                        <span style={{ color: 'var(--dt-muted)' }}>
                                                            {key === 'windSpeed' ? '💨 سرعة الرياح' :
                                                             key === 'rpm' ? '🔄 معدل الدوران' :
                                                             key === 'power' ? '⚡ الطاقة المنتجة' :
                                                             key === 'status' ? '🟢 حالة النظام' :
                                                             key === 'consumption' ? '🔌 استهلاك الطاقة' :
                                                             key === 'pressure' ? '💧 ضغط المياه' :
                                                             key === 'height' ? '⛲ ارتفاع التدفق' :
                                                             key === 'frequency' ? '🌐 تردد النبضة' :
                                                             key === 'signal' ? '📶 قوة الإشارة' :
                                                             key === 'fps' ? '🎞️ إطارات الفيديو' :
                                                             key === 'bandwidth' ? '📡 معدل النقل' :
                                                             key === 'motion' ? '🚨 الحركة المكتشفة' :
                                                             key === 'temperature' ? '🌡️ درجة الحرارة' : key}
                                                        </span>
                                                        <span style={{ fontWeight: 'bold', color: '#f1f5f9' }}>{val}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="dt-section" style={{ borderBottom: 'none', paddingBottom: '0' }}>
                                        <div className="dt-inspector-prop">
                                            <span className="dt-inspector-prop-name">النوع</span>
                                            <span className="dt-inspector-prop-val" style={{ color: 'var(--dt-emerald)' }}>كائن جيو-مكاني</span>
                                        </div>
                                        <div className="dt-inspector-prop">
                                            <span className="dt-inspector-prop-name">التصنيف</span>
                                            <span className="dt-inspector-prop-val">{selectedFeature.properties?.type}</span>
                                        </div>
                                        <div className="dt-input-group">
                                            <label>اسم المعلم</label>
                                            <input 
                                                type="text" 
                                                className="dt-input" 
                                                value={selectedFeature.properties?.name || ''} 
                                                onChange={e => {
                                                    const val = e.target.value;
                                                    updatePointProperty(selectedFeature.id, selectedFeature.isCustom, 'name', val);
                                                }}
                                                placeholder="اسم المعلم..." 
                                            />
                                        </div>
                                    </div>

                                    {canEdit ? (
                                        <>
                                            <div className="dt-section" style={{ borderBottom: 'none', paddingBottom: '0' }}>
                                                <span className="dt-section-title" style={{ fontSize: '0.85rem' }}>🔧 التحكم بالدوران والحجم</span>
                                                <div className="dt-input-group">
                                                    <label>حجم الكائن: {editScale.toFixed(1)}x</label>
                                                    <div className="dt-slider-container">
                                                        <input 
                                                            type="range" 
                                                            className="dt-slider" 
                                                            min="0.3" 
                                                            max="4.0" 
                                                            step="0.1" 
                                                            value={editScale} 
                                                            onChange={e => {
                                                                const val = parseFloat(e.target.value);
                                                                setEditScale(val);
                                                                updatePointProperty(selectedFeature.id, selectedFeature.isCustom, 'scale', val);
                                                            }} 
                                                        />
                                                        <span className="dt-slider-val">{editScale.toFixed(1)}x</span>
                                                    </div>
                                                </div>
                                                <div className="dt-input-group">
                                                    <label>زاوية الدوران: {editRotation}°</label>
                                                    <div className="dt-slider-container">
                                                        <input 
                                                            type="range" 
                                                            className="dt-slider" 
                                                            min="0" 
                                                            max="360" 
                                                            value={editRotation} 
                                                            onChange={e => {
                                                                const val = parseInt(e.target.value);
                                                                setEditRotation(val);
                                                                updatePointProperty(selectedFeature.id, selectedFeature.isCustom, 'rotation', val);
                                                            }} 
                                                        />
                                                        <span className="dt-slider-val">{editRotation}°</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="dt-section" style={{ borderBottom: 'none', paddingBottom: '0' }}>
                                                <span className="dt-section-title" style={{ fontSize: '0.85rem' }}>🎯 إزاحة الموقع الجغرافي الدقيقة</span>
                                                <div className="dt-input-group">
                                                    <label>إزاحة شرقاً/غرباً (X Offset): {editOffsetX} متر</label>
                                                    <div className="dt-slider-container">
                                                        <input 
                                                            type="range" 
                                                            className="dt-slider" 
                                                            min="-15" 
                                                            max="15" 
                                                            step="0.5" 
                                                            value={editOffsetX} 
                                                            onChange={e => {
                                                                const val = parseFloat(e.target.value);
                                                                setEditOffsetX(val);
                                                                updatePointProperty(selectedFeature.id, selectedFeature.isCustom, 'offsetX', val);
                                                            }} 
                                                        />
                                                        <span className="dt-slider-val">{editOffsetX} م</span>
                                                    </div>
                                                </div>
                                                <div className="dt-input-group">
                                                    <label>إزاحة شمالاً/جنوباً (Y Offset): {editOffsetY} متر</label>
                                                    <div className="dt-slider-container">
                                                        <input 
                                                            type="range" 
                                                            className="dt-slider" 
                                                            min="-15" 
                                                            max="15" 
                                                            step="0.5" 
                                                            value={editOffsetY} 
                                                            onChange={e => {
                                                                const val = parseFloat(e.target.value);
                                                                setEditOffsetY(val);
                                                                updatePointProperty(selectedFeature.id, selectedFeature.isCustom, 'offsetY', val);
                                                            }} 
                                                        />
                                                        <span className="dt-slider-val">{editOffsetY} م</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <button className="dt-btn-primary" style={{ marginBottom: '8px' }} onClick={handleSaveObjectEdits}>تم وإغلاق</button>
                                            {selectedFeature.isCustom && (
                                                <button className="dt-btn-danger" style={{ width: '100%' }} onClick={handleDeleteObject}>🗑️ حذف هذا الكائن</button>
                                            )}
                                        </>
                                    ) : (
                                        <div style={{ fontSize: '0.8rem', color: 'var(--dt-muted)', marginTop: '10px' }}>
                                            🔒 استكشاف فقط. لا تملك صلاحية تعديل أو تدوير الكائنات.
                                        </div>
                                    )}
                                </>
                            )}

                            {/* فحص وتعديل المباني المرسومة */}
                            {selectedFeature.type === 'custom-building' && (
                                <>
                                    <div className="dt-section" style={{ borderBottom: 'none', paddingBottom: '0' }}>
                                        <div className="dt-input-group">
                                            <label>اسم المبنى</label>
                                            <input 
                                                type="text" 
                                                className="dt-input" 
                                                value={selectedFeature.properties?.name || ''} 
                                                onChange={e => {
                                                    const val = e.target.value;
                                                    updateBuildingProperty(selectedFeature.index, 'name', val);
                                                }}
                                                placeholder="أدخل اسم المبنى..." 
                                            />
                                        </div>
                                        <div className="dt-inspector-prop">
                                            <span className="dt-inspector-prop-name">النوع</span>
                                            <span className="dt-inspector-prop-val" style={{ color: 'var(--dt-emerald)' }}>مبنى مخصص ثلاثي الأبعاد</span>
                                        </div>
                                    </div>

                                    {canEdit ? (
                                        <>
                                            <div className="dt-section" style={{ borderBottom: 'none', paddingBottom: '0' }}>
                                                <span className="dt-section-title" style={{ fontSize: '0.85rem' }}>🏬 إعدادات التجسيم والارتفاع</span>
                                                <div className="dt-input-group">
                                                    <label>الارتفاع: {editHeight} متر</label>
                                                    <div className="dt-slider-container">
                                                        <input 
                                                            type="range" 
                                                            className="dt-slider" 
                                                            min="3" 
                                                            max="120" 
                                                            value={editHeight} 
                                                            onChange={e => {
                                                                const val = parseInt(e.target.value);
                                                                setEditHeight(val);
                                                                updateBuildingProperty(selectedFeature.index, 'height', val);
                                                            }} 
                                                        />
                                                        <span className="dt-slider-val">{editHeight} م</span>
                                                    </div>
                                                </div>
                                                <div className="dt-input-group" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <input 
                                                        type="checkbox" 
                                                        id="solar-chk" 
                                                        checked={editSolarRoof} 
                                                        onChange={e => {
                                                            const val = e.target.checked;
                                                            setEditSolarRoof(val);
                                                            updateBuildingProperty(selectedFeature.index, 'solarRoof', val);
                                                        }} 
                                                    />
                                                    <label htmlFor="solar-chk" style={{ marginBottom: '0', cursor: 'pointer' }}>تثبيت ألواح شمسية على السطح</label>
                                                </div>
                                            </div>

                                            <div className="dt-section" style={{ borderBottom: 'none', paddingBottom: '0' }}>
                                                <span className="dt-section-title" style={{ fontSize: '0.85rem' }}>🎨 لون المبنى والواجهة</span>
                                                <div className="dt-input-group">
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
                                                        <input 
                                                            type="color" 
                                                            value={editColor || '#3b82f6'} 
                                                            onChange={e => {
                                                                const val = e.target.value;
                                                                setEditColor(val);
                                                                updateBuildingProperty(selectedFeature.index, 'color', val);
                                                            }} 
                                                            style={{
                                                                border: 'none',
                                                                width: '38px',
                                                                height: '38px',
                                                                borderRadius: '8px',
                                                                cursor: 'pointer',
                                                                background: 'none',
                                                                padding: 0
                                                            }} 
                                                        />
                                                        <input 
                                                            type="text" 
                                                            className="dt-input" 
                                                            value={editColor || '#3b82f6'} 
                                                            onChange={e => {
                                                                const val = e.target.value;
                                                                setEditColor(val);
                                                                updateBuildingProperty(selectedFeature.index, 'color', val);
                                                            }} 
                                                            style={{ margin: 0, textTransform: 'uppercase' }} 
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="dt-section" style={{ borderBottom: 'none', paddingBottom: '0' }}>
                                                <span className="dt-section-title" style={{ fontSize: '0.85rem' }}>🧱 نسيج وإكساء الواجهة الخارجي (Skins)</span>
                                                <div className="dt-skin-grid">
                                                    <div className={`dt-skin-card ${editSkin === 'glass' ? 'active' : ''}`} onClick={() => {
                                                        setEditSkin('glass');
                                                        updateBuildingProperty(selectedFeature.index, 'skin', 'glass');
                                                    }}>
                                                        <div className="dt-skin-preview" style={{ background: 'linear-gradient(45deg, #0284c7, #38bdf8)' }} />
                                                        <span className="dt-skin-label">زجاج معزول</span>
                                                    </div>
                                                    <div className={`dt-skin-card ${editSkin === 'stone' ? 'active' : ''}`} onClick={() => {
                                                        setEditSkin('stone');
                                                        updateBuildingProperty(selectedFeature.index, 'skin', 'stone');
                                                    }}>
                                                        <div className="dt-skin-preview" style={{ background: 'linear-gradient(45deg, #f5f5f4, #d6d3d1)' }} />
                                                        <span className="dt-skin-label">حجر محلي تراثي</span>
                                                    </div>
                                                    <div className={`dt-skin-card ${editSkin === 'brick' ? 'active' : ''}`} onClick={() => {
                                                        setEditSkin('brick');
                                                        updateBuildingProperty(selectedFeature.index, 'skin', 'brick');
                                                    }}>
                                                        <div className="dt-skin-preview" style={{ background: 'linear-gradient(45deg, #b45309, #d97706)' }} />
                                                        <span className="dt-skin-label">طوب أحمر</span>
                                                    </div>
                                                    <div className={`dt-skin-card ${editSkin === 'concrete' ? 'active' : ''}`} onClick={() => {
                                                        setEditSkin('concrete');
                                                        updateBuildingProperty(selectedFeature.index, 'skin', 'concrete');
                                                    }}>
                                                        <div className="dt-skin-preview" style={{ background: 'linear-gradient(45deg, #64748b, #94a3b8)' }} />
                                                        <span className="dt-skin-label">خرسانة حديثة</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="dt-section" style={{ borderBottom: 'none', paddingBottom: '0' }}>
                                                <span className="dt-section-title" style={{ fontSize: '0.85rem' }}>📐 أبعاد ودوران وموقع المبنى</span>
                                                <div className="dt-input-group">
                                                    <label>مقياس الحجم (Scale): {editScale.toFixed(2)}x</label>
                                                    <div className="dt-slider-container">
                                                        <input 
                                                            type="range" 
                                                            className="dt-slider" 
                                                            min="0.3" 
                                                            max="3.0" 
                                                            step="0.05" 
                                                            value={editScale} 
                                                            onChange={e => {
                                                                const val = parseFloat(e.target.value);
                                                                setEditScale(val);
                                                                updateBuildingProperty(selectedFeature.index, 'scale', val);
                                                            }} 
                                                        />
                                                        <span className="dt-slider-val">{editScale.toFixed(2)}x</span>
                                                    </div>
                                                </div>
                                                <div className="dt-input-group">
                                                    <label>زاوية الدوران: {editRotation}°</label>
                                                    <div className="dt-slider-container">
                                                        <input 
                                                            type="range" 
                                                            className="dt-slider" 
                                                            min="0" 
                                                            max="360" 
                                                            value={editRotation} 
                                                            onChange={e => {
                                                                const val = parseInt(e.target.value);
                                                                setEditRotation(val);
                                                                updateBuildingProperty(selectedFeature.index, 'rotation', val);
                                                            }} 
                                                        />
                                                        <span className="dt-slider-val">{editRotation}°</span>
                                                    </div>
                                                </div>
                                                <div className="dt-input-group">
                                                    <label>إزاحة X (شرقاً/غرباً): {editOffsetX} م</label>
                                                    <div className="dt-slider-container">
                                                        <input 
                                                            type="range" 
                                                            className="dt-slider" 
                                                            min="-30" 
                                                            max="30" 
                                                            step="0.5" 
                                                            value={editOffsetX} 
                                                            onChange={e => {
                                                                const val = parseFloat(e.target.value);
                                                                setEditOffsetX(val);
                                                                updateBuildingProperty(selectedFeature.index, 'offsetX', val);
                                                            }} 
                                                        />
                                                        <span className="dt-slider-val">{editOffsetX} م</span>
                                                    </div>
                                                </div>
                                                <div className="dt-input-group">
                                                    <label>إزاحة Y (شمالاً/جنوباً): {editOffsetY} م</label>
                                                    <div className="dt-slider-container">
                                                        <input 
                                                            type="range" 
                                                            className="dt-slider" 
                                                            min="-30" 
                                                            max="30" 
                                                            step="0.5" 
                                                            value={editOffsetY} 
                                                            onChange={e => {
                                                                const val = parseFloat(e.target.value);
                                                                setEditOffsetY(val);
                                                                updateBuildingProperty(selectedFeature.index, 'offsetY', val);
                                                            }} 
                                                        />
                                                        <span className="dt-slider-val">{editOffsetY} م</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <button className="dt-btn-primary" style={{ marginBottom: '8px' }} onClick={handleSaveBuildingEdits}>تم وإغلاق</button>
                                            <button className="dt-btn-danger" style={{ width: '100%' }} onClick={handleDeleteObject}>🗑️ حذف هذا المبنى</button>
                                        </>
                                    ) : (
                                        <div style={{ fontSize: '0.8rem', color: 'var(--dt-muted)', marginTop: '10px' }}>
                                            🔒 استكشاف فقط. لا تملك صلاحية تعديل نسيج أو أبعاد المباني.
                                        </div>
                                    )}
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
                        <button className={`dt-tab-btn ${activeTab === 'data' ? 'active' : ''}`} onClick={() => setActiveTab('data')} style={{ padding: '14px 6px', fontSize: '0.78rem' }}>
                            📂 المشروع
                        </button>
                        <button className={`dt-tab-btn ${activeTab === 'mapping' ? 'active' : ''}`} onClick={() => setActiveTab('mapping')} style={{ padding: '14px 6px', fontSize: '0.78rem' }}>
                            🌲 المعالم
                        </button>
                        <button className={`dt-tab-btn ${activeTab === 'visual' ? 'active' : ''}`} onClick={() => setActiveTab('visual')} style={{ padding: '14px 6px', fontSize: '0.78rem' }}>
                            🌤️ البيئة
                        </button>
                        <button className={`dt-tab-btn ${activeTab === 'simulation' ? 'active' : ''}`} onClick={() => setActiveTab('simulation')} style={{ padding: '14px 6px', fontSize: '0.78rem' }}>
                            📡 المحاكاة
                        </button>
                    </div>

                    <div className="dt-sidebar-content">
                        {/* 1. تبويب البيانات والمشروع */}
                        {activeTab === 'data' && (
                            <div className="dt-tab-content">
                                <div className="dt-section">
                                    <span className="dt-section-title">رفع ملف المشروع المفتوح</span>
                                    {canEdit ? (
                                        <div className="dt-upload-area">
                                            <div className="dt-upload-icon">📤</div>
                                            <div className="dt-upload-text">اسحب وأفلت ملف GeoJSON أو مشروع التوأم هنا</div>
                                            <div className="dt-upload-sub">يدعم صيغ .geojson و .json</div>
                                            <input type="file" className="dt-file-input" accept=".geojson,.json" onChange={handleFileUpload} />
                                        </div>
                                    ) : (
                                        <div style={{ padding: '15px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--dt-border2)', borderRadius: '8px', fontSize: '0.8rem', color: 'var(--dt-muted)' }}>
                                            🔒 رفع الملفات متاح للمسؤولين فقط لتفادي التعديل العشوائي.
                                        </div>
                                    )}
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
                                {canEdit ? (
                                    <>
                                        <div className="dt-section">
                                            <span className="dt-section-title">أدوات رسم وإنشاء المعالم (Draw Tools)</span>
                                            <div className="dt-draw-btn-container">
                                                <button className={`dt-draw-btn ${drawMode === 'building' ? 'active' : ''}`} onClick={() => setDrawMode(drawMode === 'building' ? 'none' : 'building')}>
                                                    🏬 رسم مبنى ملموس
                                                </button>
                                                <button className={`dt-draw-btn ${drawMode === 'street' ? 'active' : ''}`} onClick={() => setDrawMode(drawMode === 'street' ? 'none' : 'street')}>
                                                    🛣️ رسم شارع / ممر
                                                </button>
                                            </div>

                                            {drawMode === 'street' && (
                                                <div style={{ marginTop: '14px' }}>
                                                    <div className="dt-input-group">
                                                        <label>نمط الشارع المراد رسمه</label>
                                                        <select className="dt-select" value={editStreetStyle} onChange={e => setEditStreetStyle(e.target.value)}>
                                                            <option value="asphalt">🛣️ طريق أسفلتي سريع</option>
                                                            <option value="cobblestone">🧱 ممشى مبلط بالأحجار التراثية</option>
                                                            <option value="gravel">🏜️ طريق حصوي/ترابي ريفي</option>
                                                            <option value="neon">🌐 شارع نيون مضيء</option>
                                                        </select>
                                                    </div>
                                                    <div className="dt-input-group">
                                                        <label>عرض الشارع: {editStreetWidth} متر</label>
                                                        <input type="range" className="dt-slider" min="4" max="18" value={editStreetWidth} onChange={e => setEditStreetWidth(parseInt(e.target.value))} />
                                                    </div>
                                                </div>
                                            )}

                                            {/* قائمة العناصر التي رسمها المستخدم */}
                                            {(customBuildings.length > 0 || customStreets.length > 0) && (
                                                <div style={{ marginTop: '16px' }}>
                                                    <label style={{ fontSize: '0.78rem', color: 'var(--dt-muted)' }}>الطبقات المرسومة ({customBuildings.length + customStreets.length})</label>
                                                    <div className="dt-layer-list">
                                                        {customBuildings.map((b, i) => (
                                                            <div className="dt-layer-row" key={b.id}>
                                                                <div className="dt-layer-row-info" style={{ cursor: 'pointer' }} onClick={() => {
                                                                    setSelectedFeature({
                                                                        type: 'custom-building',
                                                                        id: b.id,
                                                                        index: i,
                                                                        properties: b,
                                                                        coords: { lng: b.coordinates[0][0], lat: b.coordinates[0][1] }
                                                                    });
                                                                    setEditHeight(b.height || 15);
                                                                    setEditSkin(b.skin || 'glass');
                                                                    setEditSolarRoof(b.solarRoof || false);
                                                                    setEditColor(b.color || '#3b82f6');
                                                                    setEditScale(b.scale || 1.0);
                                                                    setEditRotation(b.rotation || 0);
                                                                    setEditOffsetX(b.offsetX || 0);
                                                                    setEditOffsetY(b.offsetY || 0);
                                                                    if (mapRef.current) {
                                                                        mapRef.current.flyTo({ center: [b.coordinates[0][0], b.coordinates[0][1]], zoom: 17, pitch: 55, duration: 600 });
                                                                    }
                                                                }}>
                                                                    <span className="dt-layer-row-icon">🏬</span>
                                                                    <div>
                                                                        <span className="dt-layer-row-title">{b.name}</span>
                                                                        <span className="dt-layer-row-sub">{b.height}م · {b.skin === 'glass' ? 'زجاج' : b.skin === 'stone' ? 'حجر' : b.skin === 'brick' ? 'طوب' : 'خرسانة'}</span>
                                                                    </div>
                                                                </div>
                                                                <button className="dt-layer-delete" title="حذف" onClick={() => {
                                                                    setCustomBuildings(prev => prev.filter(x => x.id !== b.id));
                                                                    if (selectedFeature?.id === b.id) setSelectedFeature(null);
                                                                }}>🗑️</button>
                                                            </div>
                                                        ))}
                                                        {customStreets.map((s, i) => (
                                                            <div className="dt-layer-row" key={s.id}>
                                                                <div className="dt-layer-row-info">
                                                                    <span className="dt-layer-row-icon">🛣️</span>
                                                                    <div>
                                                                        <span className="dt-layer-row-title">{s.name}</span>
                                                                        <span className="dt-layer-row-sub">{s.style === 'gravel' ? 'ترابي' : s.style === 'cobblestone' ? 'حجري' : s.style === 'neon' ? 'نيون' : 'أسفلت'} · {s.width}م</span>
                                                                    </div>
                                                                </div>
                                                                <button className="dt-layer-delete" title="حذف" onClick={() => {
                                                                    setCustomStreets(prev => prev.filter(x => x.id !== s.id));
                                                                }}>🗑️</button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <div className="dt-section">
                                            <span className="dt-section-title">إسقاط كائنات المسؤول (Admin Objects)</span>
                                            <div className="dt-grid-2" style={{ marginBottom: '14px' }}>
                                                <button className={`dt-draw-btn ${drawMode === 'point' && selectedPlacementType === 'tree' ? 'active' : ''}`} onClick={() => { setDrawMode('point'); setSelectedPlacementType('tree'); }}>🌲 شجرة صنوبر</button>
                                                <button className={`dt-draw-btn ${drawMode === 'point' && selectedPlacementType === 'palm' ? 'active' : ''}`} onClick={() => { setDrawMode('point'); setSelectedPlacementType('palm'); }}>🌴 شجرة نخيل</button>
                                                <button className={`dt-draw-btn ${drawMode === 'point' && selectedPlacementType === 'car' ? 'active' : ''}`} onClick={() => { setDrawMode('point'); setSelectedPlacementType('car'); }}>🚗 سيارة عادية</button>
                                                <button className={`dt-draw-btn ${drawMode === 'point' && selectedPlacementType === 'sports_car' ? 'active' : ''}`} onClick={() => { setDrawMode('point'); setSelectedPlacementType('sports_car'); }}>🏎️ سيارة سباق</button>
                                                <button className={`dt-draw-btn ${drawMode === 'point' && selectedPlacementType === 'truck' ? 'active' : ''}`} onClick={() => { setDrawMode('point'); setSelectedPlacementType('truck'); }}>🚛 شاحنة نقل</button>
                                                <button className={`dt-draw-btn ${drawMode === 'point' && selectedPlacementType === 'streetlight' ? 'active' : ''}`} onClick={() => { setDrawMode('point'); setSelectedPlacementType('streetlight'); }}>💡 إنارة حديثة</button>
                                                <button className={`dt-draw-btn ${drawMode === 'point' && selectedPlacementType === 'classic_lamp' ? 'active' : ''}`} onClick={() => { setDrawMode('point'); setSelectedPlacementType('classic_lamp'); }}>🪔 فانوس تراثي</button>
                                                <button className={`dt-draw-btn ${drawMode === 'point' && selectedPlacementType === 'fountain' ? 'active' : ''}`} onClick={() => { setDrawMode('point'); setSelectedPlacementType('fountain'); }}>⛲ نافورة مياه</button>
                                                <button className={`dt-draw-btn ${drawMode === 'point' && selectedPlacementType === 'wind_turbine' ? 'active' : ''}`} onClick={() => { setDrawMode('point'); setSelectedPlacementType('wind_turbine'); }}>🌀 توربين رياح</button>
                                                <button className={`dt-draw-btn ${drawMode === 'point' && selectedPlacementType === 'traffic_light' ? 'active' : ''}`} onClick={() => { setDrawMode('point'); setSelectedPlacementType('traffic_light'); }}>🚦 إشارة مرور</button>
                                                <button className={`dt-draw-btn ${drawMode === 'point' && selectedPlacementType === 'bench' ? 'active' : ''}`} onClick={() => { setDrawMode('point'); setSelectedPlacementType('bench'); }}>🪑 مقعد جلوس</button>
                                                <button className={`dt-draw-btn ${drawMode === 'point' && selectedPlacementType === 'cctv' ? 'active' : ''}`} onClick={() => { setDrawMode('point'); setSelectedPlacementType('cctv'); }}>📹 كاميرا مراقبة</button>
                                                <button className={`dt-draw-btn ${drawMode === 'point' && selectedPlacementType === 'beacon' ? 'active' : ''}`} onClick={() => { setDrawMode('point'); setSelectedPlacementType('beacon'); }}>📡 منارة هولوغرام</button>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div style={{ padding: '20px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--dt-border2)', borderRadius: '12px', fontSize: '0.85rem', color: 'var(--dt-muted)', textAlign: 'center' }}>
                                        <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>🕵️</div>
                                        <h3>وضع الاستكشاف نشط</h3>
                                        <p style={{ marginTop: '6px', lineHeight: '1.6' }}>أنت تقوم حالياً باستكشاف التوأم الرقمي المعتمد من قبل المسؤولين. لا تملك صلاحية الرسم أو تعديل الكائنات.</p>
                                    </div>
                                )}
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
                                        {timeOfDay < 6 || timeOfDay > 18 ? '🌃 وضع الرؤية الليلية نشط. فوانيس الممرات ومصابيح الشوارع تضيء مسارات المشاة وتتوهج النوافذ تلقائياً!' : '☀️ وضع النهار نشط. ظلال الشمس ثلاثية الأبعاد تدور تدريجياً طبقاً للتوقيت.'}
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

                        {/* 4. تبويب المحاكاة والشبكة */}
                        {activeTab === 'simulation' && (
                            <div className="dt-tab-content">
                                <div className="dt-section">
                                    <span className="dt-section-title">📏 محاذاة للشبكة المغناطيسية (Grid Snap)</span>
                                    <div className="dt-input-group" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                                        <input 
                                            type="checkbox" 
                                            id="grid-snap-chk" 
                                            checked={gridSnapping} 
                                            onChange={e => setGridSnapping(e.target.checked)} 
                                            style={{ accentColor: 'var(--dt-emerald)', width: '16px', height: '16px', cursor: 'pointer' }}
                                        />
                                        <label htmlFor="grid-snap-chk" style={{ cursor: 'pointer', fontWeight: '600', fontSize: '0.84rem' }}>تفعيل شبكة المحاذاة المغناطيسية</label>
                                    </div>
                                    
                                    {gridSnapping && (
                                        <div className="dt-input-group">
                                            <label>دقة خطوة المحاذاة الجغرافية</label>
                                            <select className="dt-select" value={gridSize} onChange={e => setGridSize(parseFloat(e.target.value))}>
                                                <option value="0.1">0.1 متر (10 سم - دقة متناهية)</option>
                                                <option value="0.5">0.5 متر (50 سم - قياسية)</option>
                                                <option value="1.0">1.0 متر (1 متر)</option>
                                                <option value="2.0">2.0 متر (مربعات متباعدة)</option>
                                            </select>
                                        </div>
                                    )}

                                    <div className="dt-input-group" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '12px' }}>
                                        <input 
                                            type="checkbox" 
                                            id="grid-helper-chk" 
                                            checked={showGridHelper} 
                                            onChange={e => setShowGridHelper(e.target.checked)} 
                                            style={{ accentColor: 'var(--dt-emerald)', width: '16px', height: '16px', cursor: 'pointer' }}
                                        />
                                        <label htmlFor="grid-helper-chk" style={{ cursor: 'pointer', fontSize: '0.84rem' }}>عرض شبكة القياس الهولوغرافية ثلاثية الأبعاد</label>
                                    </div>
                                </div>

                                <div className="dt-section">
                                    <span className="dt-section-title">📡 مستشعرات إنترنت الأشياء (IoT Sim)</span>
                                    <div className="dt-input-group" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                                        <input 
                                            type="checkbox" 
                                            id="iot-sim-chk" 
                                            checked={iotSimulation} 
                                            onChange={e => setIotSimulation(e.target.checked)} 
                                            style={{ accentColor: 'var(--dt-emerald)', width: '16px', height: '16px', cursor: 'pointer' }}
                                        />
                                        <label htmlFor="iot-sim-chk" style={{ cursor: 'pointer', fontWeight: '600', fontSize: '0.84rem', color: 'var(--dt-emerald)' }}>تفعيل محاكاة الحساسات الحية</label>
                                    </div>
                                    
                                    <p style={{ fontSize: '0.78rem', color: 'var(--dt-muted)', lineHeight: '1.5' }}>
                                        عند التفعيل، تقوم الأصول الذكية في الحرم الجامعي (عنفات الرياح، الإضاءة، النافورة، كاميرات المراقبة) بنقل وتحديث قراءات الحساسات المكانية كل ثانيتين.
                                    </p>
                                </div>

                                {iotSimulation && (
                                    <div className="dt-section">
                                        <span className="dt-section-title">📊 تدفق حزم البيانات الفورية (Live Stream)</span>
                                        <div style={{ 
                                            background: 'rgba(2, 6, 23, 0.6)', 
                                            border: '1px solid var(--dt-border2)', 
                                            borderRadius: '8px', 
                                            padding: '12px', 
                                            height: '180px', 
                                            overflowY: 'auto', 
                                            fontFamily: 'Consolas, Monaco, monospace', 
                                            fontSize: '0.72rem', 
                                            color: '#34d399',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '6px',
                                            lineHeight: '1.4',
                                            textAlign: 'left',
                                            direction: 'ltr'
                                        }}>
                                            {telemetryLogs.length === 0 ? (
                                                <span style={{ color: 'var(--dt-muted)', textAlign: 'center', display: 'block', padding: '20px' }}>Waiting for telemetry packets...</span>
                                            ) : (
                                                telemetryLogs.map((log, idx) => (
                                                    <div key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '4px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                                        {log}
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* شريط التحكم السفلي السريع لتغيير نوع الخريطة */}
                <div className="dt-bottom-bar">
                    <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--dt-muted)', marginLeft: '6px' }}>خريطة الأساس:</span>
                    <button className={`dt-bar-btn ${activeBasemap === 'dark' ? 'active' : ''}`} onClick={() => setActiveBasemap('dark')}>🌌 مظلم</button>
                    <button className={`dt-bar-btn ${activeBasemap === 'light' ? 'active' : ''}`} onClick={() => setActiveBasemap('light')}>☀️ فاتح</button>
                    <button className={`dt-bar-btn ${activeBasemap === 'osm' ? 'active' : ''}`} onClick={() => setActiveBasemap('osm')}>🗺️ OSM</button>
                    <button className={`dt-bar-btn ${activeBasemap === 'satellite' ? 'active' : ''}`} onClick={() => setActiveBasemap('satellite')}>🛰️ قمر صناعي</button>
                    <button className={`dt-bar-btn ${activeBasemap === 'grid' ? 'active' : ''}`} onClick={() => setActiveBasemap('grid')}>🔲 شبكة</button>
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
