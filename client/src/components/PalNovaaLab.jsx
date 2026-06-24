import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import Map, { Source, Layer, NavigationControl, Popup, Marker } from 'react-map-gl/maplibre';
import * as GeoTIFF from 'geotiff';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import 'maplibre-gl/dist/maplibre-gl.css';
import './PalNovaaLab.css';

const PAL_DATA_CATEGORIES = {
    highway_transport: {
        id: 'highway_transport',
        name: 'شبكة الطرق والنقل',
        color: '#ff7043',
        outlineColor: '#e64a19',
        tags: {
            highway: ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential', 'service', 'footway', 'crossing', 'traffic_signals', 'bus_stop'],
            railway: ['rail', 'subway', 'station'],
            aeroway: ['aerodrome', 'runway', 'taxiway'],
            barrier: ['gate', 'fence', 'wall', 'bollard']
        }
    },
    buildings: {
        id: 'buildings',
        name: 'المباني والمنشآت',
        color: '#f472b6',
        outlineColor: '#db2777',
        tags: {
            building: ['yes', 'apartments', 'house', 'commercial', 'industrial', 'school', 'hospital', 'hotel']
        }
    },
    landuse: {
        id: 'landuse',
        name: 'استخدامات الأراضي',
        color: '#84cc16',
        outlineColor: '#4d7c0f',
        tags: {
            landuse: ['residential', 'commercial', 'industrial', 'retail', 'farmland', 'orchard', 'vineyard', 'quarry', 'construction', 'cemetery']
        }
    },
    amenities: {
        id: 'amenities',
        name: 'الخدمات والمرافق العامة',
        color: '#3b82f6',
        outlineColor: '#1d4ed8',
        tags: {
            amenity: ['restaurant', 'cafe', 'fast_food', 'school', 'university', 'hospital', 'clinic', 'pharmacy', 'place_of_worship', 'bank', 'atm', 'fuel', 'parking', 'police', 'post_office', 'townhall']
        }
    },
    leisure_tourism: {
        id: 'leisure_tourism',
        name: 'الترفيه والسياحة والتاريخ',
        color: '#8b5cf6',
        outlineColor: '#6d28d9',
        tags: {
            leisure: ['park', 'playground', 'sports_centre', 'pitch', 'garden'],
            tourism: ['hotel', 'museum', 'attraction', 'viewpoint'],
            historic: ['artwork', 'monument', 'archaeological_site', 'castle', 'ruins']
        }
    },
    natural_water: {
        id: 'natural_water',
        name: 'البيئة الطبيعية والمعالم المائية',
        color: '#06b6d4',
        outlineColor: '#0e7490',
        tags: {
            natural: ['wood', 'tree', 'scrub', 'peak', 'bare_rock', 'beach'],
            waterway: ['river', 'stream', 'canal', 'waterfall'],
            water: ['lake', 'reservoir', 'pond']
        }
    },
    shops: {
        id: 'shops',
        name: 'المحلات والتجارة',
        color: '#fbbf24',
        outlineColor: '#d97706',
        tags: {
            shop: ['supermarket', 'convenience', 'clothes', 'bakery', 'hairdresser', 'mall', 'butcher', 'electronics']
        }
    },
    offices_crafts: {
        id: 'offices_crafts',
        name: 'المكاتب والورش',
        color: '#6b7280',
        outlineColor: '#4b5563',
        tags: {
            office: ['company', 'government', 'ngo'],
            craft: ['carpenter', 'electrician', 'plumber']
        }
    },
    infrastructure_emergency: {
        id: 'infrastructure_emergency',
        name: 'البنية التحتية والطوارئ',
        color: '#ef4444',
        outlineColor: '#b91c1c',
        tags: {
            power: ['line', 'tower', 'substation', 'generator'],
            man_made: ['tower', 'pipeline', 'pier'],
            emergency: ['fire_hydrant', 'ambulance_station']
        }
    },
    places_boundaries: {
        id: 'places_boundaries',
        name: 'الحدود والمسميات',
        color: '#a855f7',
        outlineColor: '#7e22ce',
        tags: {
            place: ['country', 'city', 'town', 'village', 'neighbourhood'],
            boundary: ['administrative']
        }
    }
};

const TOUR_STEPS = [
    { name: 'القدس الشريف', coords: [35.2137, 31.7683], desc: 'العاصمة الروحية والتاريخية لفلسطين، تضم المسجد الأقصى وكنيسة القيامة والبلدة القديمة المسورة.', zoom: 14 },
    { name: 'يافا عروس البحر', coords: [34.7525, 32.0528], desc: 'ميناء فلسطين التاريخي الأهم ومركز الحركة الثقافية والصحفية قبل عام 1948.', zoom: 14 },
    { name: 'حيفا جبل الكرمل', coords: [34.9888, 32.7940], desc: 'عروس جبل الكرمل، تتميز بمينائها الاستراتيجي وحجارتها الكنعانية وتنوعها المعماري.', zoom: 14 },
    { name: 'غزة هاشم', coords: [34.4668, 31.5016], desc: 'إحدى أقدم مدن العالم عبر التاريخ، وبوابة فلسطين الجنوبية التي واجهت الحملات والحروب.', zoom: 13 },
    { name: 'صفد عاصمة الجليل', coords: [35.4944, 32.9658], desc: 'مدينة العلم والتصوف الرابضة على قمم الجليل الأعلى بارتفاع يفوق 900 متر عن سطح البحر.', zoom: 14 }
];

const PalNovaaLab = ({ onClose }) => {
    const { user } = useAuth();
    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    const [showIntro, setShowIntro] = useState(true);
    const [particles, setParticles] = useState([]);
    const [activeTab, setActiveTab] = useState('layers');
    const [importLink, setImportLink] = useState('');
    const [isImporting, setIsImporting] = useState(false);
    const [mapState, setMapState] = useState({
        longitude: 35.2034,
        latitude: 31.9038,
        zoom: 13,
        pitch: 0,
        bearing: 0
    });

    if (isMobileDevice) {
        return (
            <div style={{
                position: 'fixed', inset: 0, zIndex: 9999,
                background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '20px', fontFamily: "'Tajawal', sans-serif"
            }}>
                <div style={{
                    textAlign: 'center', color: 'white', maxWidth: '350px',
                    background: 'rgba(255,255,255,0.03)', padding: '40px 20px', borderRadius: '24px',
                    border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)'
                }}>
                    <div style={{ marginBottom: '20px', color: '#fbab15' }}>
                        <svg viewBox="0 0 24 24" width="80" height="80" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                        </svg>
                    </div>
                    <h2 style={{ fontSize: '1.5rem', marginBottom: '15px' }}>مختبر بالنوفا المتقدم</h2>
                    <p style={{ fontSize: '1rem', color: '#94a3b8', lineHeight: '1.6', marginBottom: '25px' }}>
                        عذراً، هذا القسم متاح فقط لمستخدمي أجهزة الحاسوب واللابتوب لضمان أفضل تجربة أداء وتحليل للبيانات.
                    </p>
                    <button
                        onClick={onClose}
                        style={{
                            background: '#fbab15', color: 'black', border: 'none',
                            padding: '12px 30px', borderRadius: '12px', fontWeight: 'bold',
                            cursor: 'pointer', transition: 'transform 0.2s'
                        }}
                    >
                        الرجوع للخريطة
                    </button>
                </div>
            </div>
        );
    }

    const mapRef = useRef(null);
    const clickCountRef = useRef(0);
    const clickTimerRef = useRef(null);

    const [designSelections, setDesignSelections] = useState({
        layout: 'fullmap',
        palette: 'classic',
        font: 'cairo_tajawal',
        basemap: 'satellite',
        marker: 'pin',
        component: 'pill',
        effect: 'glow',
        customPrimary: '#F5A623',
        show_controls: true,
        show_attribution: true,
        enable_popups: true,
        auto_rotate: false,
        enable_search: true,
        show_legend: true,
        show_layer_toggle: true,
        enable_scale: true,
        customBg: '#0A1628',
        customSurface: 'rgba(20, 43, 71, 0.7)',
        customText: '#FFFFFF',
        customBorder: 'rgba(255, 255, 255, 0.08)',
        mapBorderRadius: '12px',
        mapBorderColor: 'rgba(255, 255, 255, 0.15)',
        mapBorderWidth: '1px',
        customFontHeading: 'Cairo',
        customFontBody: 'Tajawal',
        commercialTemplate: 'none',
        uberAppName: 'سفريات بال نوفا',
        uberRatePerKm: 5.0
    });

    const mapStyle = useMemo(() => {
        const bm = designSelections.basemap;
        const bmTiles = {
            dark: 'https://cartodb-basemaps-a.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png',
            light: 'https://cartodb-basemaps-a.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png',
            satellite: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
            satellite_pure: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
            terrain: 'https://stamen-tiles.a.ssl.fastly.net/terrain/{z}/{x}/{y}.jpg',
            vintage: 'https://stamen-tiles.a.ssl.fastly.net/toner/{z}/{x}/{y}.png',
            cyber: 'https://mt1.google.com/vt/lyrs=h&x={x}&y={y}&z={z}'
        };
        const tileUrl = bmTiles[bm] || bmTiles.satellite;
        return {
            version: 8,
            name: "Basemap Style",
            sprite: "https://demotiles.maplibre.org/styles/osm-bright-gl-style/sprite",
            glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
            sources: {
                'raster-tiles': {
                    type: 'raster',
                    tiles: [tileUrl],
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
        };
    }, [designSelections.basemap]);

    const [drawingMode, setDrawingMode] = useState(null); // 'point', 'line', 'polygon', 'measure'
    const [selectedFeatureInfo, setSelectedFeatureInfo] = useState(null);
    const [editingImageFeature, setEditingImageFeature] = useState(null); // { layerId, featureId }
    const [tempImageUrl, setTempImageUrl] = useState('');
    const [draftCoordinates, setDraftCoordinates] = useState([]);
    const [drawnFeatures, setDrawnFeatures] = useState({ type: 'FeatureCollection', features: [] });
    const [measurement, setMeasurement] = useState(null);
    const [showBottomTable, setShowBottomTable] = useState(false);

    // Advanced Web GIS States
    const [gisMeasureType, setGisMeasureType] = useState(null); // 'distance', 'area'
    const [gisMeasurePoints, setGisMeasurePoints] = useState([]);
    const [gisMeasureResult, setGisMeasureResult] = useState(null); // { length, area }
    const [gisBufferActive, setGisBufferActive] = useState(false);
    const [gisBufferRadius, setGisBufferRadius] = useState(5); // km
    const [gisBufferCenter, setGisBufferCenter] = useState(null);
    const [gisBufferResults, setGisBufferResults] = useState([]);
    const [gisElevActive, setGisElevActive] = useState(false);
    const [gisElevPoints, setGisElevPoints] = useState([]);
    const [gisElevProfile, setGisElevProfile] = useState([]);
    const [gisTimeActive, setGisTimeActive] = useState(false);
    const [gisTimeValue, setGisTimeValue] = useState(2026);
    const [gisSwipeActive, setGisSwipeActive] = useState(false);
    const [gisSwipePosition, setGisSwipePosition] = useState(50); // %
    const [gisFilterQuery, setGisFilterQuery] = useState('');
    const [gisFilterTag, setGisFilterTag] = useState('');
    const [gisApiUrl, setGisApiUrl] = useState('');
    const [gisHeatmapActive, setGisHeatmapActive] = useState(false);
    const [gisTourActive, setGisTourActive] = useState(false);
    const [gisTourStep, setGisTourStep] = useState(0);
    const [gisReverseGeocodingActive, setGisReverseGeocodingActive] = useState(false);
    const [gisReverseGeocodingResult, setGisReverseGeocodingResult] = useState(null);

    const [geoLayers, setGeoLayers] = useState([]);
    const [activeTableLayerId, setActiveTableLayerId] = useState(null);
    const [isDesignStudioOpen, setIsDesignStudioOpen] = useState(false);
    const [isHydroSimOpen, setIsHydroSimOpen] = useState(false);
    const [activeDsCategory, setActiveDsCategory] = useState('layouts');
    const [isExportStudioOpen, setIsExportStudioOpen] = useState(false);
    const [exportTitle, setExportTitle] = useState('خريطة مختبر بال نوفا الجغرافية');
    const [exportDesc, setExportDesc] = useState('تم توليد وتصدير هذه الخريطة بدقة فائقة باستخدام استوديو التصميم المتطور في PalNovaa Lab.');
    const [exportResolution, setExportResolution] = useState('hd');
    const [exportIncludeLegend, setExportIncludeLegend] = useState(true);
    const [exportIncludeLogo, setExportIncludeLogo] = useState(true);
    const [isExportingMap, setIsExportingMap] = useState(false);
    const [builderTab, setBuilderTab] = useState('basic'); // 'basic', 'components', 'icons'
    const [isMagicPromptOpen, setIsMagicPromptOpen] = useState(false);
    const [magicPromptText, setMagicPromptText] = useState('');
    const [highlightFeatures, setHighlightFeatures] = useState([]);
    const [selectedFeatures, setSelectedFeatures] = useState([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [uploadedHtmlContent, setUploadedHtmlContent] = useState(null);
    const [uploadedHtmlName, setUploadedHtmlName] = useState('');
    const [selectedInjectLayers, setSelectedInjectLayers] = useState([]);
    const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
    const [publishName, setPublishName] = useState('');
    const [publishSlug, setPublishSlug] = useState('');
    const [isPublishing, setIsPublishing] = useState(false);
    const [pageElements, setPageElements] = useState([]);
    const [selectedElId, setSelectedElId] = useState(null);
    const [previewDevice, setPreviewDevice] = useState('desktop'); // 'desktop' or 'mobile'
    const [editingLayerId, setEditingLayerId] = useState(null);
    const [tempLayerName, setTempLayerName] = useState('');

    // Advanced Styling State
    const [layerStyles, setLayerStyles] = useState({}); // { layerId: { color, outlineColor, outlineWidth, shape, opacity, fillOpacity } }
    const [stylePopup, setStylePopup] = useState(null); // { layerId, x, y }
    const [openActionsLayerId, setOpenActionsLayerId] = useState(null);

    // PalData States
    const [palDataLoading, setPalDataLoading] = useState(false);
    const [palDataProgress, setPalDataProgress] = useState('');
    const [palDataStats, setPalDataStats] = useState(null);
    const [palDataSelectedCategories, setPalDataSelectedCategories] = useState(Object.keys(PAL_DATA_CATEGORIES));

    // Hydro Grid Resolution
    const [gridResolution, setGridResolution] = useState(256);

    // PalRemoteSensing (ASTER GDEM) States
    const [asterLoading, setAsterLoading] = useState(false);
    const [asterProgress, setAsterProgress] = useState('');
    const [asterGridSize, setAsterGridSize] = useState(10);
    const [activeAsterLayerId, setActiveAsterLayerId] = useState(null);
    const [asterViewType, setAsterViewType] = useState('raster'); // 'points' or 'raster'
    const [active3dLayerId, setActive3dLayerId] = useState(null);
    const [exaggeration3d, setExaggeration3d] = useState(2);

    // ===== HYDROLOGY SIMULATION SANDBOX REF & EFFECT =====
    const hydroStateRef = useRef({
        map: null,
        gl: null,
        wCanvas: null,
        drawCanvas: null,
        drawCtx: null,
        animId: null,
        simRunning: false,
        mode: 'navigate',
        structType: 'wall',
        structHeight: 40,
        waterVolume: 3,
        friction: 0.3,
        simSpeed: 1.5,
        tick: 0,
        exaggeration: 3,
        GRID: 256,
        h: null,
        terrain: null,
        baseTerrain: null,
        barriers: null,
        flux: null,
        drawPoints: [],
        isDrawing: false,
        structures: [],
        nextStructId: 1,
        totalWaterCells: 0,
        maxDepth: 0,
        maxFlow: 0,
        program: null,
        vbo: null,
        waterTexture: null,
        simBounds: null,
        waterSources: [],
        nextSourceId: 1,
        sourceInflowRate: 50,
        rainfallRate: 0,
        targetFillElev: 100,
        fillStartPoint: null,
        injectVolume: 10000
    });

    useEffect(() => {
        if (!isHydroSimOpen) {
            return;
        }

        // Dynamically load Mapbox GL JS if needed
        const loadMapboxResources = () => {
            const mapboxCssUrl = 'https://api.mapbox.com/mapbox-gl-js/v3.2.0/mapbox-gl.css';
            const mapboxJsUrl = 'https://api.mapbox.com/mapbox-gl-js/v3.2.0/mapbox-gl.js';

            if (!document.querySelector(`link[href="${mapboxCssUrl}"]`)) {
                const link = document.createElement('link');
                link.href = mapboxCssUrl;
                link.rel = 'stylesheet';
                document.head.appendChild(link);
            }

            if (window.mapboxgl) {
                setTimeout(initSimulation, 100);
                return;
            }

            const existingScript = document.querySelector(`script[src="${mapboxJsUrl}"]`);
            if (existingScript) {
                existingScript.addEventListener('load', () => setTimeout(initSimulation, 100));
                return;
            }

            const script = document.createElement('script');
            script.src = mapboxJsUrl;
            script.onload = () => setTimeout(initSimulation, 100);
            document.head.appendChild(script);
        };

        // Pseudo-noise helper functions for synthetic terrain
        const hydroHash = (x, y) => {
            let h = (x * 374761393 + y * 668265263) | 0;
            h ^= h >>> 13;
            h = Math.imul(h, 1274126177) | 0;
            h ^= h >>> 16;
            return ((h & 0xffff) / 0xffff);
        };

        const hydroNoise = (x, y) => {
            const ix = Math.floor(x), iy = Math.floor(y);
            const fx = x - ix, fy = y - iy;
            const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
            const h00 = hydroHash(ix, iy), h10 = hydroHash(ix + 1, iy);
            const h01 = hydroHash(ix, iy + 1), h11 = hydroHash(ix + 1, iy + 1);
            return h00 * (1 - u) * (1 - v) + h10 * u * (1 - v) + h01 * (1 - u) * v + h11 * u * v;
        };

        const initSimulation = () => {
            const s = hydroStateRef.current;

            // Reconstruct token
            const p1 = 'pk.eyJ1IjoibW9oYW1tZWQtMTMz';
            const p2 = 'MSIsImEiOiJjbWlsaWh1anAxM2kz';
            const p3 = 'M2dyNHR5eTU4am9hIn0.arsZikWN';
            const p4 = 'puoceyWdnM30VA';
            window.mapboxgl.accessToken = p1 + p2 + p3 + p4;

            // Create map
            s.map = new window.mapboxgl.Map({
                container: 'hydro-map',
                style: 'mapbox://styles/mapbox/satellite-v9',
                center: [35.3, 31.9],
                zoom: 12,
                pitch: 60,
                bearing: -20,
                antialias: true,
                projection: 'mercator'
            });

            s.map.on('load', () => {
                if (!s.map) return; // check if cleaned up quickly

                s.map.addSource('hydro-dem', {
                    type: 'raster-dem',
                    url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
                    tileSize: 512,
                    maxzoom: 14
                });
                s.map.setTerrain({ source: 'hydro-dem', exaggeration: s.exaggeration });

                s.map.addLayer({
                    id: 'hydro-structures-layer',
                    type: 'fill-extrusion',
                    source: 'hydro-structures',
                    paint: {
                        'fill-extrusion-color': ['get', 'color'],
                        'fill-extrusion-height': ['get', 'height'],
                        'fill-extrusion-base-height': 0,
                        'fill-extrusion-opacity': 0.85
                    }
                });

                s.map.addSource('hydro-sources', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
                s.map.addLayer({
                    id: 'hydro-sources-layer', type: 'circle', source: 'hydro-sources',
                    paint: { 'circle-radius': 9, 'circle-color': '#06D6F2', 'circle-stroke-width': 2, 'circle-stroke-color': '#ffffff', 'circle-opacity': 0.9 }
                });

                s.map.addSource('hydro-fill-point', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
                s.map.addLayer({
                    id: 'hydro-fill-point-layer', type: 'circle', source: 'hydro-fill-point',
                    paint: { 'circle-radius': 11, 'circle-color': '#F5A623', 'circle-stroke-width': 2, 'circle-stroke-color': '#ffffff', 'circle-opacity': 0.95 }
                });

                // Hide symbol labels
                s.map.getStyle().layers.forEach(l => {
                    if (l.type === 'symbol') s.map.setLayoutProperty(l.id, 'visibility', 'none');
                });

                // Init canvases & simulation variables
                initWaterWebGL();
                initGridArrays();
                initDrawingCanvas();
                startSimulationLoop();

                // Auto-sync terrain after 1 second to load elevation grid
                setTimeout(syncTerrainFromMap, 1000);

                // Mouse interaction listeners (click and drag)
                let isMouseDown = false;

                s.map.on('mousedown', e => {
                    const N = s.GRID;
                    if (s.mode === 'water' || s.mode === 'erase') {
                        isMouseDown = true;
                        s.map.dragPan.disable();
                        if (s.mode === 'water') {
                            s.lastWaterAdd = performance.now();
                            addWaterAtCoordinates(e.lngLat);
                        } else if (s.mode === 'erase') {
                            eraseWaterAtCoordinates(e.lngLat);
                        }
                    } else if (s.mode === 'inject') {
                        injectWaterAtCoordinates(e.lngLat);
                    } else if (s.mode === 'source') {
                        const b = s.simBounds;
                        if (!b) return;
                        const gx = Math.floor(((e.lngLat.lng - b.lngMin) / (b.lngMax - b.lngMin)) * N);
                        const gy = Math.floor(((b.latMax - e.lngLat.lat) / (b.latMax - b.latMin)) * N);
                        if (gx >= 0 && gx < N && gy >= 0 && gy < N) {
                            s.waterSources.push({ id: s.nextSourceId++, gx, gy, lng: e.lngLat.lng, lat: e.lngLat.lat, inflowRate: s.sourceInflowRate || 50 });
                            updateSourcesGeoJSON();
                            updateStatsDOM();
                            startSimulationLoop();
                        }
                    } else if (s.mode === 'fill_select') {
                        const b = s.simBounds;
                        if (!b) return;
                        const gx = Math.floor(((e.lngLat.lng - b.lngMin) / (b.lngMax - b.lngMin)) * N);
                        const gy = Math.floor(((b.latMax - e.lngLat.lat) / (b.latMax - b.latMin)) * N);
                        if (gx >= 0 && gx < N && gy >= 0 && gy < N) {
                            const startElev = s.baseTerrain[gy * N + gx];
                            s.fillStartPoint = { gx, gy, lng: e.lngLat.lng, lat: e.lngLat.lat, elevation: startElev };
                            updateFillPointGeoJSON();
                            
                            const fillSlider = document.getElementById('hydro-fill-elev');
                            if (fillSlider) {
                                fillSlider.min = Math.floor(startElev);
                                let maxGridElev = -9999;
                                for (let i = 0; i < N * N; i++) if (s.baseTerrain[i] > maxGridElev) maxGridElev = s.baseTerrain[i];
                                fillSlider.max = Math.ceil(Math.max(maxGridElev, startElev + 100));
                                fillSlider.value = Math.ceil(startElev + 15);
                                s.targetFillElev = parseFloat(fillSlider.value);
                                document.getElementById('hydro-fill-elev-val').textContent = fillSlider.value + 'م';
                                fillBasin(gx, gy, s.targetFillElev);
                            }
                            
                            s.mode = 'navigate';
                            document.querySelectorAll('.hydro-tool-btn').forEach(btn => btn.classList.remove('active'));
                            const navBtn = document.getElementById('mode-navigate');
                            if(navBtn) navBtn.classList.add('active');
                            const wrap = document.getElementById('hydro-map-wrap');
                            if(wrap) wrap.classList.remove('fill_select-mode');
                        }
                    }
                });

                s.map.on('mousemove', e => {
                    const el = document.getElementById('hbar-coords');
                    if (el) el.textContent = e.lngLat.lat.toFixed(4) + '°N, ' + e.lngLat.lng.toFixed(4) + '°E';

                    if (isMouseDown && (s.mode === 'water' || s.mode === 'erase')) {
                        if (s.mode === 'water') addWaterAtCoordinates(e.lngLat);
                        else if (s.mode === 'erase') eraseWaterAtCoordinates(e.lngLat);
                    }
                });

                s.map.on('mouseup', () => {
                    isMouseDown = false;
                    s.map.dragPan.enable();
                });
            });

            s.map.addControl(new window.mapboxgl.NavigationControl(), 'bottom-right');
            setupControlsListeners();
        };

        const initGridArrays = () => {
            const s = hydroStateRef.current;
            const N = s.GRID;
            s.h = new Float32Array(N * N);
            s.terrain = new Float32Array(N * N);
            s.baseTerrain = new Float32Array(N * N);
            s.barriers = new Uint8Array(N * N);
            s.flux = new Float32Array(N * N * 4);
            s.structures = [];
            s.nextStructId = 1;

            // Hilly bowl-valley generation
            for (let j = 0; j < N; j++) {
                for (let i = 0; i < N; i++) {
                    const idx = j * N + i;
                    const nx = i / N, ny = j / N;
                    let elev = 0;
                    elev += 0.50 * hydroNoise(nx * 2.1 + 1.7, ny * 2.1 + 0.3);
                    elev += 0.25 * hydroNoise(nx * 5.3 + 2.1, ny * 5.3 + 1.1);
                    elev += 0.12 * hydroNoise(nx * 11.0 + 3.7, ny * 11.0 + 2.9);
                    elev += 0.08 * hydroNoise(nx * 22.0 + 5.3, ny * 22.0 + 4.1);
                    const ex = (nx - 0.5) * 2;
                    const ey = (ny - 0.5) * 2;
                    elev += (ex * ex + ey * ey) * 0.15;
                    const valleyX = Math.abs(nx - 0.5);
                    elev -= Math.max(0, 0.12 - valleyX * 0.8);
                    const finalElev = Math.max(0, elev) * 80;
                    s.baseTerrain[idx] = finalElev;
                    s.terrain[idx] = finalElev;
                }
            }
        };

        const syncTerrainFromMap = () => {
            const s = hydroStateRef.current;
            if (!s.map || !s.terrain) return;
            const N = s.GRID;
            
            // Get current bounds
            const bounds = s.map.getBounds();
            const lngMin = bounds.getWest();
            const lngMax = bounds.getEast();
            const latMin = bounds.getSouth();
            const latMax = bounds.getNorth();
            s.simBounds = { lngMin, lngMax, latMin, latMax };
            
            // Load elevation grid
            const lngStep = (lngMax - lngMin) / (N - 1);
            const latStep = (latMax - latMin) / (N - 1);
            
            // Pass 1: query all terrain elevations
            for (let j = 0; j < N; j++) {
                for (let i = 0; i < N; i++) {
                    const idx = j * N + i;
                    const lng = lngMin + i * lngStep;
                    const lat = latMax - j * latStep;
                    let elev = s.map.queryTerrainElevation([lng, lat]);
                    if (elev === null || elev === undefined || isNaN(elev)) {
                        s.baseTerrain[idx] = NaN;
                    } else {
                        s.baseTerrain[idx] = elev;
                    }
                }
            }

            // Pass 2: interpolate NaN values from neighbors to fix 0-elevation pits
            for (let pass = 0; pass < 3; pass++) {
                let hasNaN = false;
                for (let idx = 0; idx < N * N; idx++) {
                    if (isNaN(s.baseTerrain[idx])) {
                        hasNaN = true;
                        let sum = 0;
                        let count = 0;
                        const r = Math.floor(idx / N);
                        const c = idx % N;
                        if (r > 0 && !isNaN(s.baseTerrain[(r - 1) * N + c])) { sum += s.baseTerrain[(r - 1) * N + c]; count++; }
                        if (r < N - 1 && !isNaN(s.baseTerrain[(r + 1) * N + c])) { sum += s.baseTerrain[(r + 1) * N + c]; count++; }
                        if (c > 0 && !isNaN(s.baseTerrain[r * N + c - 1])) { sum += s.baseTerrain[r * N + c - 1]; count++; }
                        if (c < N - 1 && !isNaN(s.baseTerrain[r * N + c + 1])) { sum += s.baseTerrain[r * N + c + 1]; count++; }
                        
                        if (count > 0) {
                            s.baseTerrain[idx] = sum / count;
                        }
                    }
                }
                if (!hasNaN) break;
            }

            // Fallback for any remaining NaN cells
            for (let idx = 0; idx < N * N; idx++) {
                if (isNaN(s.baseTerrain[idx])) {
                    s.baseTerrain[idx] = 0;
                }
                s.terrain[idx] = s.baseTerrain[idx];
            }

            // Reset water states
            s.h.fill(0);
            s.flux.fill(0);
            s.tick = 0;
            s.totalWaterCells = 0;
            s.maxDepth = 0;
            s.maxFlow = 0;

            // Re-apply existing structures onto the new terrain grid
            rebuildBarrierGridFromBase();

            // Set up or update the Mapbox canvas source
            const wc = s.wCanvas;
            if (wc) {
                const source = s.map.getSource('water-canvas-source');
                if (source) {
                    source.setCoordinates([
                        [lngMin, latMax],
                        [lngMax, latMax],
                        [lngMax, latMin],
                        [lngMin, latMin]
                    ]);
                } else {
                    s.map.addSource('water-canvas-source', {
                        type: 'canvas',
                        canvas: wc,
                        coordinates: [
                            [lngMin, latMax],
                            [lngMax, latMax],
                            [lngMax, latMin],
                            [lngMin, latMin]
                        ],
                        animate: true
                    });
                    s.map.addLayer({
                        id: 'water-raster-layer',
                        type: 'raster',
                        source: 'water-canvas-source',
                        paint: {
                            'raster-opacity': 0.85,
                            'raster-fade-duration': 0
                        }
                    });
                }
            }
            
            updateStatsDOM();
        };

        const rebuildBarrierGridFromBase = () => {
            const s = hydroStateRef.current;
            const N = s.GRID;
            s.barriers.fill(0);
            
            // Restore natural elevation
            s.terrain.set(s.baseTerrain);

            // Re-apply structures
            const geojsonFeatures = [];

            s.structures.forEach(struct => {
                // Rasterize into barriers and elevate terrain
                let yMinVal = N - 1;
                let yMaxVal = 0;
                for (let i = 0; i < struct.gridPts.length; i++) {
                    const py = struct.gridPts[i].y;
                    if (py < yMinVal) yMinVal = py;
                    if (py > yMaxVal) yMaxVal = py;
                }
                const yMin = Math.max(0, yMinVal);
                const yMax = Math.min(N - 1, yMaxVal);

                for (let y = yMin; y <= yMax; y++) {
                    const intersections = [];
                    for (let i = 0; i < struct.gridPts.length; i++) {
                        const a = struct.gridPts[i], b = struct.gridPts[(i + 1) % struct.gridPts.length];
                        if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) {
                            const x = a.x + (y - a.y) / (b.y - a.y) * (b.x - a.x);
                            intersections.push(Math.round(x));
                        }
                    }
                    intersections.sort((a, b) => a - b);
                    for (let k = 0; k + 1 < intersections.length; k += 2) {
                        const x0 = Math.max(0, intersections[k]);
                        const x1 = Math.min(N - 1, intersections[k + 1]);
                        for (let x = x0; x <= x1; x++) {
                            const idx = y * N + x;
                            s.barriers[idx] = 1;
                            s.terrain[idx] += struct.height;
                            s.h[idx] = 0;
                        }
                    }
                }

                // Add to 3D GeoJSON source
                if (struct.geoPoints) {
                    const polyRing = struct.geoPoints.map(p => [p.lng, p.lat]);
                    // Close the polygon ring
                    if (polyRing.length > 0) {
                        polyRing.push([polyRing[0][0], polyRing[0][1]]);
                    }
                    geojsonFeatures.push({
                        type: 'Feature',
                        geometry: {
                            type: 'Polygon',
                            coordinates: [polyRing]
                        },
                        properties: {
                            id: struct.id,
                            color: struct.color.replace(', 0.9)', ', 1)'),
                            height: struct.height
                        }
                    });
                }
            });

            // Update Mapbox source
            const src = s.map ? s.map.getSource('hydro-structures') : null;
            if (src) {
                src.setData({
                    type: 'FeatureCollection',
                    features: geojsonFeatures
                });
            }
        };

        const initWaterWebGL = () => {
            const s = hydroStateRef.current;
            const wrap = document.getElementById('hydro-map-wrap');
            if (!wrap) return;

            // Remove if already exists in DOM (if we previously appended it)
            const existing = document.getElementById('hydro-water-canvas');
            if (existing) existing.remove();

            const wc = document.createElement('canvas');
            wc.id = 'hydro-water-canvas';
            wc.width = 512;
            wc.height = 512;
            s.wCanvas = wc;

            s.gl = wc.getContext('webgl', { premultipliedAlpha: false });
            if (!s.gl) {
                console.warn('WebGL is not available, falling back to 2D water rendering');
                return;
            }

            // Shader compiles
            const compile = (type, src) => {
                const shader = s.gl.createShader(type);
                s.gl.shaderSource(shader, src);
                s.gl.compileShader(shader);
                if (!s.gl.getShaderParameter(shader, s.gl.COMPILE_STATUS)) {
                    console.error('Shader compilation error:', s.gl.getShaderInfoLog(shader));
                }
                return shader;
            };

            const vertSrc = `
                attribute vec2 a_position;
                attribute vec2 a_uv;
                varying vec2 v_uv;
                void main() {
                    gl_Position = vec4(a_position, 0.0, 1.0);
                    v_uv = a_uv;
                }
            `;
            const fragSrc = `
                precision mediump float;
                varying vec2 v_uv;
                uniform sampler2D u_water;
                uniform float u_time;
                void main() {
                    // Read water texture
                    // R = depth, G = speed, B = flow angle, A = mask
                    vec4 w = texture2D(u_water, v_uv);
                    float depth = w.r;
                    if (depth < 0.002) discard;

                    // Unpack flow direction from B channel (angle mapped from [-PI, PI] to [0, 1])
                    float angle = w.b * 6.2831853 - 3.14159265;
                    vec2 flowDir = vec2(cos(angle), sin(angle));
                    float speed = w.g;

                    // Flow animation coordinates
                    vec2 uvFlow1 = v_uv * 16.0 - flowDir * (u_time * 0.4 * (speed + 0.05));
                    vec2 uvFlow2 = v_uv * 16.0 - flowDir * (u_time * 0.4 * (speed + 0.05) + 0.5);

                    // High-frequency waves for fine shimmer
                    float wave1 = sin(uvFlow1.x * 3.0 + uvFlow1.y * 2.0) * cos(uvFlow1.y * 3.0 - uvFlow1.x * 2.0);
                    float wave2 = sin(uvFlow2.x * 3.0 + uvFlow2.y * 2.0) * cos(uvFlow2.y * 3.0 - uvFlow2.x * 2.0);
                    float shimmer = 0.5 + 0.5 * mix(wave1, wave2, 0.5);

                    // Deep/shallow color blending
                    vec3 deepColor = vec3(0.01, 0.08, 0.42);
                    vec3 shallowColor = vec3(0.18, 0.58, 0.88);
                    float t = clamp(depth * 5.0, 0.0, 1.0);
                    vec3 waterColor = mix(shallowColor, deepColor, t);

                    // White foam rapids in high velocity areas
                    float foamIntensity = smoothstep(0.15, 0.6, speed);
                    float foamPattern = sin(v_uv.x * 120.0 - u_time * 12.0) * cos(v_uv.y * 120.0 + u_time * 10.0);
                    float foam = foamIntensity * (0.4 + 0.6 * smoothstep(0.0, 0.5, foamPattern));
                    waterColor = mix(waterColor, vec3(0.85, 0.93, 1.0), foam * 0.7);

                    // Highlight reflections
                    waterColor += vec3(shimmer * 0.12 * (1.0 - foam) * (1.0 - t));
                    float spec = pow(shimmer, 6.0) * (0.2 + speed * 0.5);
                    waterColor += vec3(spec);

                    float alpha = 0.65 + t * 0.25;
                    gl_FragColor = vec4(waterColor * alpha, alpha);
                }
            `;

            const vert = compile(s.gl.VERTEX_SHADER, vertSrc);
            const frag = compile(s.gl.FRAGMENT_SHADER, fragSrc);
            s.program = s.gl.createProgram();
            s.gl.attachShader(s.program, vert);
            s.gl.attachShader(s.program, frag);
            s.gl.linkProgram(s.program);

            const verts = new Float32Array([
                -1, -1, 0, 1, 1, -1, 1, 1, -1, 1, 0, 0,
                1, -1, 1, 1, -1, 1, 0, 0, 1, 1, 1, 0
            ]);
            s.vbo = s.gl.createBuffer();
            s.gl.bindBuffer(s.gl.ARRAY_BUFFER, s.vbo);
            s.gl.bufferData(s.gl.ARRAY_BUFFER, verts, s.gl.STATIC_DRAW);

            s.waterTexture = s.gl.createTexture();
            s.gl.bindTexture(s.gl.TEXTURE_2D, s.waterTexture);
            s.gl.texParameteri(s.gl.TEXTURE_2D, s.gl.TEXTURE_MIN_FILTER, s.gl.LINEAR);
            s.gl.texParameteri(s.gl.TEXTURE_2D, s.gl.TEXTURE_MAG_FILTER, s.gl.LINEAR);
            s.gl.texParameteri(s.gl.TEXTURE_2D, s.gl.TEXTURE_WRAP_S, s.gl.CLAMP_TO_EDGE);
            s.gl.texParameteri(s.gl.TEXTURE_2D, s.gl.TEXTURE_WRAP_T, s.gl.CLAMP_TO_EDGE);
        };

        const initDrawingCanvas = () => {
            const s = hydroStateRef.current;
            const dc = document.getElementById('hydro-draw-canvas');
            if (!dc) return;
            s.drawCanvas = dc;
            s.drawCtx = dc.getContext('2d');

            const wrap = document.getElementById('hydro-map-wrap');
            const resizeDc = () => {
                if (dc && wrap) {
                    dc.width = wrap.clientWidth;
                    dc.height = wrap.clientHeight;
                }
            };
            resizeDc();

            // Clear drawing handlers
            dc.onmousedown = (e) => {
                if (s.mode !== 'draw') return;
                const pt = { x: e.offsetX, y: e.offsetY };
                if (!s.isDrawing) {
                    s.isDrawing = true;
                    s.drawPoints = [pt];
                } else {
                    s.drawPoints.push(pt);
                }
                renderDrawingPreview();
            };

            dc.onmousemove = (e) => {
                if (!s.isDrawing) return;
                renderDrawingPreview({ x: e.offsetX, y: e.offsetY });
            };

            dc.ondblclick = () => {
                finishDrawingStructure();
            };

            dc.oncontextmenu = (e) => {
                e.preventDefault();
                finishDrawingStructure();
            };
        };

        const renderDrawingPreview = (movePt = null) => {
            const s = hydroStateRef.current;
            const ctx = s.drawCtx;
            const dc = s.drawCanvas;
            if (!ctx || !dc) return;
            ctx.clearRect(0, 0, dc.width, dc.height);

            const pts = s.drawPoints;
            if (pts.length === 0) return;

            const color = getStructureColor(s.structType);
            ctx.beginPath();
            ctx.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
            if (movePt) ctx.lineTo(movePt.x, movePt.y);

            ctx.strokeStyle = color;
            ctx.lineWidth = 2.5;
            ctx.setLineDash([6, 3]);
            ctx.stroke();
            ctx.setLineDash([]);

            if (movePt) ctx.lineTo(pts[0].x, pts[0].y);
            ctx.closePath();
            ctx.fillStyle = color.replace(')', ', 0.12)');
            ctx.fill();

            pts.forEach((p, i) => {
                ctx.beginPath();
                ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
                ctx.fillStyle = i === 0 ? '#FFFFFF' : color;
                ctx.fill();
                ctx.strokeStyle = 'rgba(0,0,0,0.5)';
                ctx.lineWidth = 1;
                ctx.stroke();
            });
        };

        const getStructureColor = (type) => {
            const colors = {
                wall: 'rgba(6, 214, 242, 0.9)',
                embankment: 'rgba(245, 166, 35, 0.9)',
                barrier: 'rgba(16, 217, 160, 0.9)',
                channel: 'rgba(139, 92, 246, 0.9)',
            };
            return colors[type] || colors.wall;
        };

        const finishDrawingStructure = () => {
            const s = hydroStateRef.current;
            if (!s.isDrawing || s.drawPoints.length < 3) {
                s.isDrawing = false;
                s.drawPoints = [];
                renderDrawingPreview();
                return;
            }
            const pts = s.drawPoints;
            bakeStructureIntoGrid(pts);
            s.isDrawing = false;
            s.drawPoints = [];
            renderDrawingPreview();
        };

        const bakeStructureIntoGrid = (screenPts) => {
            const s = hydroStateRef.current;
            const N = s.GRID;

            // Map screen coordinates to geographic coordinates
            const geoPoints = screenPts.map(p => {
                const lngLat = s.map.unproject([p.x, p.y]);
                return { lng: lngLat.lng, lat: lngLat.lat };
            });

            // Map geographic coordinates to 128x128 grid coordinates
            let gridPts = [];
            if (s.simBounds) {
                const b = s.simBounds;
                gridPts = geoPoints.map(gp => ({
                    x: Math.floor(((gp.lng - b.lngMin) / (b.lngMax - b.lngMin)) * N),
                    y: Math.floor(((b.latMax - gp.lat) / (b.latMax - b.latMin)) * N)
                }));
            } else {
                const wrap = document.getElementById('hydro-map-wrap');
                if (wrap) {
                    const W = wrap.clientWidth, H = wrap.clientHeight;
                    gridPts = screenPts.map(p => ({
                        x: Math.floor((p.x / W) * N),
                        y: Math.floor((p.y / H) * N)
                    }));
                }
            }

            const struct = {
                id: s.nextStructId++,
                type: s.structType,
                color: getStructureColor(s.structType),
                height: s.structHeight,
                gridPts,
                geoPoints
            };
            s.structures.push(struct);
            
            rebuildBarrierGridFromBase();
            updateStructuresListDOM();
        };

        const updateStructuresListDOM = () => {
            const s = hydroStateRef.current;
            const list = document.getElementById('structs-list');
            const totalCountEl = document.getElementById('stat-structs');
            if (!list) return;

            list.innerHTML = '';
            s.structures.forEach(struct => {
                const item = document.createElement('div');
                item.className = 'hstruct-item';
                const name = struct.type === 'wall' ? 'جدار' : struct.type === 'embankment' ? 'سد ترابي' : struct.type === 'barrier' ? 'حاجز' : 'قناة';
                item.innerHTML = `
                    <div class="hstruct-dot" style="background:${struct.color.replace(', 0.9)', ', 1)')}"></div>
                    <span class="hstruct-name">${name}</span>
                    <span class="hstruct-h">${struct.height}م</span>
                    <button class="hstruct-del" data-id="${struct.id}" title="حذف">✕</button>
                `;
                const delBtn = item.querySelector('.hstruct-del');
                delBtn.onclick = () => removeStructureById(struct.id);
                list.appendChild(item);
            });

            if (totalCountEl) totalCountEl.textContent = s.structures.length;
        };

        const removeStructureById = (id) => {
            const s = hydroStateRef.current;
            s.structures = s.structures.filter(st => st.id !== id);
            rebuildBarrierGridFromBase();
            updateStructuresListDOM();
        };

        const addWaterAtCoordinates = (lngLat) => {
            const s = hydroStateRef.current;
            if (!s.simBounds) return;
            const N = s.GRID;
            const b = s.simBounds;
            
            const now = performance.now();
            const lastTime = s.lastWaterAdd || now;
            s.lastWaterAdd = now;
            const deltaSec = Math.min((now - lastTime) / 1000, 0.1);
            const dtSec = deltaSec > 0 ? deltaSec : 0.016;
            
            const gx = Math.floor(((lngLat.lng - b.lngMin) / (b.lngMax - b.lngMin)) * N);
            const gy = Math.floor(((b.latMax - lngLat.lat) / (b.latMax - b.latMin)) * N);
            const r = 4;
            const vol = s.waterVolume * 0.8 * dtSec * s.simSpeed;

            for (let dy = -r; dy <= r; dy++) {
                for (let dx = -r; dx <= r; dx++) {
                    if (dx * dx + dy * dy > r * r) continue;
                    const ix = gx + dx, iy = gy + dy;
                    if (ix < 0 || iy < 0 || ix >= N || iy >= N) continue;
                    const idx = iy * N + ix;
                    if (s.barriers[idx]) continue;
                    const dist = Math.sqrt(dx * dx + dy * dy) / r;
                    const amount = vol * (1.0 - dist * 0.7);
                    s.h[idx] = Math.min(s.h[idx] + amount, 50);
                }
            }
        };

        const injectWaterAtCoordinates = (lngLat) => {
            const s = hydroStateRef.current;
            if (!s.simBounds) return;
            const N = s.GRID;
            const b = s.simBounds;
            const metrics = getPhysicalMetrics();
            
            const gx = Math.floor(((lngLat.lng - b.lngMin) / (b.lngMax - b.lngMin)) * N);
            const gy = Math.floor(((b.latMax - lngLat.lat) / (b.latMax - b.latMin)) * N);
            const r = 5;
            
            const affectedCells = [];
            let totalWeight = 0;
            
            for (let dy = -r; dy <= r; dy++) {
                for (let dx = -r; dx <= r; dx++) {
                    if (dx * dx + dy * dy > r * r) continue;
                    const ix = gx + dx, iy = gy + dy;
                    if (ix < 0 || iy < 0 || ix >= N || iy >= N) continue;
                    const idx = iy * N + ix;
                    if (s.barriers[idx]) continue;
                    
                    const dist = Math.sqrt(dx * dx + dy * dy) / r;
                    const weight = 1.0 - dist * 0.7;
                    affectedCells.push({ idx, weight });
                    totalWeight += weight;
                }
            }
            
            if (totalWeight > 0) {
                const targetVol = s.injectVolume || 10000;
                affectedCells.forEach(cell => {
                    const cellVol = targetVol * (cell.weight / totalWeight);
                    const dh = cellVol / metrics.cellArea;
                    s.h[cell.idx] = Math.min(s.h[cell.idx] + dh, 50);
                });
                updateStatsDOM();
            }
        };

        const distributeWaterEvenly = () => {
            const s = hydroStateRef.current;
            if (!s.h) return;
            const N = s.GRID;
            const metrics = getPhysicalMetrics();
            
            const activeIndices = [];
            for (let j = 1; j < N - 1; j++) {
                for (let i = 1; i < N - 1; i++) {
                    const idx = j * N + i;
                    if (!s.barriers[idx]) {
                        activeIndices.push(idx);
                    }
                }
            }
            
            if (activeIndices.length > 0) {
                const targetVol = s.injectVolume || 10000;
                const cellVol = targetVol / activeIndices.length;
                const dh = cellVol / metrics.cellArea;
                
                activeIndices.forEach(idx => {
                    s.h[idx] = Math.min(s.h[idx] + dh, 50);
                });
                updateStatsDOM();
            }
        };

        const eraseWaterAtCoordinates = (lngLat) => {
            const s = hydroStateRef.current;
            if (!s.simBounds) return;
            const N = s.GRID;
            const b = s.simBounds;
            
            const gx = Math.floor(((lngLat.lng - b.lngMin) / (b.lngMax - b.lngMin)) * N);
            const gy = Math.floor(((b.latMax - lngLat.lat) / (b.latMax - b.latMin)) * N);
            const r = 6;

            for (let dy = -r; dy <= r; dy++) {
                for (let dx = -r; dx <= r; dx++) {
                    if (dx * dx + dy * dy > r * r) continue;
                    const ix = gx + dx, iy = gy + dy;
                    if (ix < 0 || iy < 0 || ix >= N || iy >= N) continue;
                    s.h[iy * N + ix] = 0;
                }
            }
        };

        
        const getPhysicalMetrics = () => {
            const s = hydroStateRef.current;
            if (!s.simBounds) return { dx: 30, dy: 30, cellArea: 900 };
            const b = s.simBounds;
            const getDistance = (lat1, lon1, lat2, lon2) => {
                const R = 6371000;
                const dLat = (lat2 - lat1) * Math.PI / 180;
                const dLon = (lon2 - lon1) * Math.PI / 180;
                const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                return R * c;
            };
            const centerLat = (b.latMin + b.latMax) / 2;
            const widthMeters = getDistance(centerLat, b.lngMin, centerLat, b.lngMax);
            const heightMeters = getDistance(b.latMin, b.lngMin, b.latMax, b.lngMin);
            const dx = widthMeters / s.GRID;
            const dy = heightMeters / s.GRID;
            return { dx, dy, cellArea: dx * dy };
        };

        const updateSourcesGeoJSON = () => {
            const s = hydroStateRef.current;
            if (!s.map) return;
            const features = (s.waterSources || []).map(src => ({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [src.lng, src.lat] },
                properties: { id: src.id, inflowRate: src.inflowRate }
            }));
            const source = s.map.getSource('hydro-sources');
            if (source) source.setData({ type: 'FeatureCollection', features });
        };

        const updateFillPointGeoJSON = () => {
            const s = hydroStateRef.current;
            if (!s.map) return;
            const features = [];
            if (s.fillStartPoint) {
                features.push({
                    type: 'Feature',
                    geometry: { type: 'Point', coordinates: [s.fillStartPoint.lng, s.fillStartPoint.lat] },
                    properties: { name: 'Fill Start Point' }
                });
            }
            const source = s.map.getSource('hydro-fill-point');
            if (source) source.setData({ type: 'FeatureCollection', features });
        };

        const fillBasin = (startI, startJ, targetElev) => {
            const s = hydroStateRef.current;
            const N = s.GRID;
            s.h.fill(0);
            const startIdx = startJ * N + startI;
            if (s.terrain[startIdx] >= targetElev) return;
            const visited = new Uint8Array(N * N);
            const queue = [startIdx];
            visited[startIdx] = 1;
            let head = 0;
            while (head < queue.length) {
                const idx = queue[head++];
                const cy = Math.floor(idx / N), cx = idx % N;
                s.h[idx] = Math.max(0, targetElev - s.terrain[idx]);
                const neighbors = [[cy - 1, cx], [cy + 1, cx], [cy, cx - 1], [cy, cx + 1]];
                for (let d = 0; d < 4; d++) {
                    const [ny, nx] = neighbors[d];
                    if (ny >= 0 && ny < N && nx >= 0 && nx < N) {
                        const nidx = ny * N + nx;
                        if (!visited[nidx] && !s.barriers[nidx] && s.terrain[nidx] < targetElev) {
                            visited[nidx] = 1;
                            queue.push(nidx);
                        }
                    }
                }
            }
            s.flux.fill(0);
            if (s.map) s.map.triggerRepaint();
        };

        window.hydroRemoveSource = (id) => {
            const s = hydroStateRef.current;
            s.waterSources = (s.waterSources || []).filter(src => src.id !== id);
            updateSourcesGeoJSON();
            updateStatsDOM();
        };

        // Shallow water physics solver (Saint-Venant equations)
        const simulatePhysicsStep = () => {
            const s = hydroStateRef.current;
            const N = s.GRID;
            const h = s.h;
            const terrain = s.terrain;
            const barriers = s.barriers;
            const flux = s.flux;
            const g = 9.81;

            const metrics = getPhysicalMetrics();
            const dx = metrics.dx;
            const dy = metrics.dy;
            const cellArea = metrics.cellArea;
            const dt = 0.016 * s.simSpeed;
            const friction = 1.0 - s.friction * dt;

            // Add water from continuous sources
            if (s.waterSources && s.waterSources.length > 0) {
                s.waterSources.forEach(src => {
                    const idx = src.gy * N + src.gx;
                    if (idx >= 0 && idx < N * N && !barriers[idx]) {
                        const dh = (src.inflowRate * dt) / cellArea;
                        h[idx] = Math.min(h[idx] + dh, 100.0);
                    }
                });
            }

            // Add water from global rainfall
            if (s.rainfallRate > 0) {
                const rainMPerS = (s.rainfallRate / 1000.0) / 3600.0;
                const dh = rainMPerS * dt;
                for (let i = 0; i < N * N; i++) {
                    if (!barriers[i]) h[i] = Math.min(h[i] + dh, 100.0);
                }
            }

            // Step 1: Update flux
            for (let j = 1; j < N - 1; j++) {
                for (let i = 1; i < N - 1; i++) {
                    const idx = j * N + i;
                    if (barriers[idx]) {
                        flux[idx * 4] = flux[idx * 4 + 1] = flux[idx * 4 + 2] = flux[idx * 4 + 3] = 0;
                        continue;
                    }
                    const water_height = h[idx] + terrain[idx];
                    const neighbors = [[j - 1, i], [j + 1, i], [j, i - 1], [j, i + 1]];
                    let totalOut = 0;
                    for (let d = 0; d < 4; d++) {
                        const [nj, ni] = neighbors[d];
                        if (nj < 0 || nj >= N || ni < 0 || ni >= N) {
                            flux[idx * 4 + d] = 0;
                            continue;
                        }
                        const nidx = nj * N + ni;
                        const dh_elev = (water_height - (h[nidx] + terrain[nidx])) * s.exaggeration;
                        const h_flow = dh_elev > 0 ? h[idx] : 0;
                        const f = Math.max(0, flux[idx * 4 + d] * friction + dt * g * h_flow * dh_elev);
                        flux[idx * 4 + d] = f;
                        totalOut += f;
                    }
                    const maxVolumeOut = (h[idx] * cellArea) / dt;
                    if (totalOut > maxVolumeOut && totalOut > 1e-10) {
                        const scale = maxVolumeOut / totalOut;
                        for (let d = 0; d < 4; d++) flux[idx * 4 + d] *= scale;
                    }
                }
            }

            // Step 2: Update water heights
            let totalWater = 0, maxDepth = 0, maxFlow = 0;
            for (let j = 1; j < N - 1; j++) {
                for (let i = 1; i < N - 1; i++) {
                    const idx = j * N + i;
                    if (barriers[idx]) continue;
                    const outN = flux[idx * 4 + 0], outS = flux[idx * 4 + 1], outW = flux[idx * 4 + 2], outE = flux[idx * 4 + 3];
                    const inN = flux[((j - 1) * N + i) * 4 + 1], inS = flux[((j + 1) * N + i) * 4 + 0];
                    const inW = flux[(j * N + (i - 1)) * 4 + 3], inE = flux[(j * N + (i + 1)) * 4 + 2];
                    const netFlow = (inN + inS + inW + inE - outN - outS - outW - outE);
                    h[idx] = Math.max(0, h[idx] + dt * netFlow / cellArea);
                    if (h[idx] > 0.01) totalWater++;
                    if (h[idx] > maxDepth) maxDepth = h[idx];
                    const flowMag = Math.sqrt((outE - outW) * (outE - outW) + (outS - outN) * (outS - outN));
                    if (flowMag > maxFlow) maxFlow = flowMag;
                }
            }
            for (let i = 0; i < N; i++) {
                h[i] = 0; h[(N - 1) * N + i] = 0; h[i * N] = 0; h[i * N + (N - 1)] = 0;
            }
            s.totalWaterCells = totalWater;
            s.maxDepth = maxDepth;
            s.maxFlow = maxFlow;
        };

        const renderWebGLWater = (timestamp) => {
            const s = hydroStateRef.current;
            const gl = s.gl;
            if (!gl) {
                render2DWaterFallback();
                return;
            }

            const N = s.GRID;
            const wc = s.wCanvas;
            gl.viewport(0, 0, wc.width, wc.height);
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

            const texData = new Uint8Array(N * N * 4);
            const maxH = 10.0;
            const h = s.h;
            const flux = s.flux;

            for (let j = 0; j < N; j++) {
                for (let i = 0; i < N; i++) {
                    const idx = j * N + i;
                    const waterDepth = h[idx];
                    
                    if (waterDepth < 0.001) {
                        texData[idx * 4 + 0] = 0;
                        texData[idx * 4 + 1] = 0;
                        texData[idx * 4 + 2] = 0;
                        texData[idx * 4 + 3] = 0;
                        continue;
                    }

                    // Calculate speed and direction of flow
                    const outN = flux[idx * 4 + 0], outS = flux[idx * 4 + 1];
                    const outW = flux[idx * 4 + 2], outE = flux[idx * 4 + 3];
                    const flowX = outE - outW;
                    const flowY = outS - outN;
                    const speed = Math.sqrt(flowX * flowX + flowY * flowY);
                    
                    const depthNormalized = Math.min(1.0, waterDepth / maxH);
                    const speedNormalized = Math.min(1.0, speed * 2.0);

                    // Flow angle in [-PI, PI], map to [0, 1]
                    const angle = Math.atan2(flowY, flowX);
                    const angleNormalized = (angle + Math.PI) / (Math.PI * 2.0);

                    texData[idx * 4 + 0] = Math.floor(depthNormalized * 255);
                    texData[idx * 4 + 1] = Math.floor(speedNormalized * 255);
                    texData[idx * 4 + 2] = Math.floor(angleNormalized * 255);
                    texData[idx * 4 + 3] = 255;
                }
            }

            gl.bindTexture(gl.TEXTURE_2D, s.waterTexture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, N, N, 0, gl.RGBA, gl.UNSIGNED_BYTE, texData);

            gl.useProgram(s.program);

            const aPos = gl.getAttribLocation(s.program, 'a_position');
            const aUV = gl.getAttribLocation(s.program, 'a_uv');
            gl.bindBuffer(gl.ARRAY_BUFFER, s.vbo);
            gl.enableVertexAttribArray(aPos);
            gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);
            gl.enableVertexAttribArray(aUV);
            gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, 16, 8);

            gl.uniform1i(gl.getUniformLocation(s.program, 'u_water'), 0);
            gl.uniform1f(gl.getUniformLocation(s.program, 'u_time'), timestamp * 0.001);
            gl.drawArrays(gl.TRIANGLES, 0, 6);

            // Force Mapbox to repaint the screen to display the updated canvas source texture
            if (s.map) {
                s.map.triggerRepaint();
            }
        };

        const render2DWaterFallback = () => {
            const s = hydroStateRef.current;
            if (!s.wCanvas) return;
            const ctx = s.wCanvas.getContext('2d');
            if (!ctx) return;
            const N = s.GRID;
            const W = s.wCanvas.width, H = s.wCanvas.height;
            const cw = W / N, ch = H / N;
            ctx.clearRect(0, 0, W, H);

            for (let j = 0; j < N; j++) {
                for (let i = 0; i < N; i++) {
                    const depth = s.h[j * N + i];
                    if (depth < 0.01) continue;
                    const t = Math.min(1, depth / 8);
                    const a = 0.3 + t * 0.5;
                    const b = Math.floor(200 - t * 150);
                    ctx.fillStyle = `rgba(${Math.floor(30 * t)}, ${Math.floor(100 + 30 * (1 - t))}, ${b}, ${a})`;
                    ctx.fillRect(i * cw, j * ch, cw + 0.5, ch + 0.5);
                }
            }
        };

        const animationLoop = (timestamp) => {
            const s = hydroStateRef.current;
            if (!s.simRunning) return;

            const steps = Math.max(1, Math.floor(s.simSpeed));
            for (let st = 0; st < steps; st++) simulatePhysicsStep();

            renderWebGLWater(timestamp);
            updateStatsDOM();

            s.tick++;
            s.animId = requestAnimationFrame(animationLoop);
        };

        const startSimulationLoop = () => {
            const s = hydroStateRef.current;
            if (s.simRunning) return;
            s.simRunning = true;

            const status = document.getElementById('hydro-sim-status');
            const text = document.getElementById('hydro-sim-status-text');
            if (status) status.className = 'hydro-sim-status running';
            if (text) text.textContent = 'المحاكاة جارية';

            s.animId = requestAnimationFrame(animationLoop);
        };

        const updateStatsDOM = () => {
            const s = hydroStateRef.current;
            if (s.tick % 3 !== 0 && s.tick !== 0) return;
            const el = id => document.getElementById(id);
            if (el('stat-tick')) el('stat-tick').textContent = s.tick;
            if (el('stat-water')) el('stat-water').textContent = s.totalWaterCells;
            if (el('stat-water-bar')) el('stat-water-bar').style.width = Math.min(100, s.totalWaterCells / 10) + '%';
            if (el('stat-depth')) el('stat-depth').textContent = s.maxDepth.toFixed(2);
            if (el('stat-depth-bar')) el('stat-depth-bar').style.width = Math.min(100, s.maxDepth * 5) + '%';
            if (el('stat-flow')) el('stat-flow').textContent = s.maxFlow.toFixed(3);
            if (el('hbar-wvol')) el('hbar-wvol').textContent = s.totalWaterCells;

            const metrics = getPhysicalMetrics();
            const N = s.GRID;
            let totalWaterVolume = 0;
            let totalWaterArea = 0;
            let maxWaterElev = -9999;
            for (let i = 0; i < N * N; i++) {
                if (s.h[i] > 0.01) {
                    totalWaterArea += metrics.cellArea;
                    totalWaterVolume += s.h[i] * metrics.cellArea;
                    const elev = s.terrain[i] + s.h[i];
                    if (elev > maxWaterElev) maxWaterElev = elev;
                }
            }
            if (maxWaterElev === -9999) maxWaterElev = 0;

            if (el('stat-storage-vol')) {
                if (totalWaterVolume >= 1000000) {
                    el('stat-storage-vol').textContent = (totalWaterVolume / 1000000).toFixed(2);
                    el('stat-storage-vol-unit').textContent = 'مليون متر مكعب (Mm³)';
                } else {
                    el('stat-storage-vol').textContent = totalWaterVolume.toLocaleString(undefined, {maximumFractionDigits: 0});
                    el('stat-storage-vol-unit').textContent = 'متر مكعب (m³)';
                }
            }
            if (el('stat-storage-area')) {
                const hectares = totalWaterArea / 10000;
                if (hectares >= 100) {
                    el('stat-storage-area').textContent = (hectares / 100).toFixed(2);
                    el('stat-storage-area-unit').textContent = 'كيلومتر مربع (km²)';
                } else {
                    el('stat-storage-area').textContent = hectares.toFixed(1);
                    el('stat-storage-area-unit').textContent = 'هكتار (ha)';
                }
            }
            if (el('stat-storage-elev')) el('stat-storage-elev').textContent = maxWaterElev.toFixed(1);
            if (el('stat-resolution')) el('stat-resolution').textContent = `${metrics.dx.toFixed(1)}م × ${metrics.dy.toFixed(1)}م`;

            const slist = el('sources-list');
            if (slist) {
                slist.innerHTML = '';
                (s.waterSources || []).forEach(src => {
                    const item = document.createElement('div');
                    item.className = 'hstruct-item';
                    item.innerHTML = `<div class="hstruct-dot" style="background:#00F0FF; box-shadow:0 0 6px #00F0FF"></div><span class="hstruct-name">نبع #${src.id} (${src.inflowRate} م³/ث)</span><button class="hstruct-del" onclick="window.hydroRemoveSource(${src.id})">✕</button>`;
                    slist.appendChild(item);
                });
            }
            if (el('stat-sources-count')) el('stat-sources-count').textContent = (s.waterSources || []).length;
        };

        const setSimulatorMode = (mode) => {
            const s = hydroStateRef.current;
            s.mode = mode;
            const modes = ['navigate', 'draw', 'water', 'erase', 'inject', 'source', 'fill_select'];
            modes.forEach(m => {
                const btn = document.getElementById('mode-' + m);
                if (btn) btn.classList.toggle('active', m === mode);
            });

            const dc = document.getElementById('hydro-draw-canvas');
            const wrap = document.getElementById('hydro-map-wrap');
            const hint = document.getElementById('hydro-hint');

            if (wrap) {
                wrap.classList.remove('water-mode', 'inject-mode', 'source-mode', 'fill_select-mode');
            }

            if (mode === 'navigate') {
                if (s.map) { s.map.dragPan.enable(); s.map.scrollZoom.enable(); }
                if (dc) dc.classList.remove('drawing');
                if (hint) hint.classList.remove('show');
                s.isDrawing = false;
                s.drawPoints = [];
                renderDrawingPreview();
            } else if (mode === 'draw') {
                if (s.map) { s.map.dragPan.disable(); s.map.scrollZoom.disable(); }
                if (dc) dc.classList.add('drawing');
                if (hint) {
                    hint.classList.add('show');
                    hint.textContent = 'انقر لإضافة نقاط — انقر مرتين أو كليك يمين لإغلاق الشكل';
                }
            } else if (mode === 'water') {
                if (s.map) { s.map.dragPan.enable(); s.map.scrollZoom.enable(); }
                if (dc) dc.classList.remove('drawing');
                if (wrap) wrap.classList.add('water-mode');
                if (hint) {
                    hint.classList.add('show');
                    hint.textContent = 'انقر واسحب لإضافة مياه تدريجياً';
                }
            } else if (mode === 'erase') {
                if (s.map) { s.map.dragPan.enable(); s.map.scrollZoom.enable(); }
                if (dc) dc.classList.remove('drawing');
                if (hint) {
                    hint.classList.add('show');
                    hint.textContent = 'انقر على الخريطة لمسح المياه';
                }
            } else if (mode === 'inject') {
                if (s.map) { s.map.dragPan.enable(); s.map.scrollZoom.enable(); }
                if (dc) dc.classList.remove('drawing');
                if (wrap) wrap.classList.add('inject-mode');
                if (hint) {
                    hint.classList.add('show');
                    hint.textContent = 'انقر على الخريطة لحقن حجم المياه المحدد';
                }
            } else if (mode === 'source') {
                if (s.map) { s.map.dragPan.enable(); s.map.scrollZoom.enable(); }
                if (dc) dc.classList.remove('drawing');
                if (wrap) wrap.classList.add('source-mode');
                if (hint) {
                    hint.classList.add('show');
                    hint.textContent = 'انقر على الخريطة لوضع نبع مائي يتدفق باستمرار';
                }
            } else if (mode === 'fill_select') {
                if (s.map) { s.map.dragPan.enable(); s.map.scrollZoom.enable(); }
                if (dc) dc.classList.remove('drawing');
                if (wrap) wrap.classList.add('fill_select-mode');
                if (hint) {
                    hint.classList.add('show');
                    hint.textContent = 'انقر لتحديد منخفض أو حوض مائي لبدء التعبئة التلقائية';
                }
            }
        };

        const setupControlsListeners = () => {
            const s = hydroStateRef.current;

            // Sliders
            const exagInput = document.getElementById('hydro-exag');
            const structHInput = document.getElementById('hydro-struct-h');
            const waterVolInput = document.getElementById('hydro-water-vol');
            const frictionInput = document.getElementById('hydro-friction-input');
            const simSpeedInput = document.getElementById('hydro-simspeed-input');

            if (exagInput) {
                exagInput.oninput = (e) => {
                    const v = parseFloat(e.target.value);
                    s.exaggeration = v;
                    const valText = document.getElementById('hydro-exag-val');
                    if (valText) valText.textContent = v + '×';
                    if (s.map && s.map.getTerrain()) {
                        s.map.setTerrain({ source: 'hydro-dem', exaggeration: v });
                    }
                };
            }

            if (structHInput) {
                structHInput.oninput = (e) => {
                    const v = parseFloat(e.target.value);
                    s.structHeight = v;
                    const valText = document.getElementById('hydro-struct-h-val');
                    if (valText) valText.textContent = v + 'م';
                };
            }

            if (waterVolInput) {
                waterVolInput.oninput = (e) => {
                    const v = parseFloat(e.target.value);
                    s.waterVolume = v;
                    const valText = document.getElementById('hydro-water-vol-val');
                    if (valText) valText.textContent = v;
                };
            }

            if (frictionInput) {
                frictionInput.oninput = (e) => {
                    const v = parseFloat(e.target.value);
                    s.friction = v;
                    const valText = document.getElementById('hydro-friction-val');
                    if (valText) valText.textContent = v.toFixed(2);
                };
            }

            if (simSpeedInput) {
                simSpeedInput.oninput = (e) => {
                    const v = parseFloat(e.target.value);
                    s.simSpeed = v;
                    const valText = document.getElementById('hydro-simspeed-val');
                    if (valText) valText.textContent = v.toFixed(1) + '×';
                };
            }

            // Modes buttons
            const btnNav = document.getElementById('mode-navigate');
            const btnDraw = document.getElementById('mode-draw');
            const btnWater = document.getElementById('mode-water');
            const btnErase = document.getElementById('mode-erase');
            const btnInject = document.getElementById('mode-inject');
            const btnSource = document.getElementById('mode-source');
            const btnFill = document.getElementById('mode-fill_select');

            if (btnNav) btnNav.onclick = () => setSimulatorMode('navigate');
            if (btnDraw) btnDraw.onclick = () => setSimulatorMode('draw');
            if (btnWater) btnWater.onclick = () => setSimulatorMode('water');
            if (btnErase) btnErase.onclick = () => setSimulatorMode('erase');
            if (btnInject) btnInject.onclick = () => setSimulatorMode('inject');
            if (btnSource) btnSource.onclick = () => setSimulatorMode('source');
            if (btnFill) btnFill.onclick = () => setSimulatorMode('fill_select');

            // Inject volume control
            const injectVolInput = document.getElementById('hydro-inject-vol');
            if (injectVolInput) {
                injectVolInput.oninput = (e) => {
                    const v = parseFloat(e.target.value);
                    if (!isNaN(v) && v >= 0) {
                        s.injectVolume = v;
                    }
                };
            }

            // Distribute evenly control
            const distributeBtn = document.getElementById('hydro-distribute-btn');
            if (distributeBtn) {
                distributeBtn.onclick = () => {
                    distributeWaterEvenly();
                };
            }

            // Structure Types buttons
            document.querySelectorAll('.struct-type').forEach(btn => {
                btn.onclick = (e) => {
                    document.querySelectorAll('.struct-type').forEach(b => b.classList.remove('active'));
                    e.target.classList.add('active');
                    s.structType = e.target.getAttribute('data-type');
                };
            });

            // Reset
            const resetBtn = document.getElementById('hydro-reset-btn');
            if (resetBtn) {
                resetBtn.onclick = () => {
                    s.h.fill(0);
                    s.flux.fill(0);
                    s.tick = 0;
                    s.totalWaterCells = 0;
                    s.maxDepth = 0;
                    s.maxFlow = 0;
                    rebuildBarrierGridFromBase();
                    updateStatsDOM();
                };
            }

            // Sync Terrain & Bounds
            const syncBtn = document.getElementById('hydro-sync-btn');
            if (syncBtn) {
                syncBtn.onclick = () => {
                    const originalText = syncBtn.innerHTML;
                    syncBtn.innerHTML = `
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style="margin-right: 4px; animation: spin 1s linear infinite;">
                            <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                        </svg>
                        جاري المزامنة...
                    `;
                    syncBtn.disabled = true;
                    setTimeout(() => {
                        syncTerrainFromMap();
                        syncBtn.innerHTML = originalText;
                        syncBtn.disabled = false;
                    }, 600);
                };
            }

            // Close
            const closeBtn = document.getElementById('hydro-close-btn');
            if (closeBtn) {
                closeBtn.onclick = () => setIsHydroSimOpen(false);
            }
        };

        // Esc key press
        const handleKeyDown = (e) => {
            const s = hydroStateRef.current;
            if (e.key === 'Escape') {
                if (s.isDrawing) {
                    s.isDrawing = false;
                    s.drawPoints = [];
                    renderDrawingPreview();
                } else {
                    setIsHydroSimOpen(false);
                }
            }
            if (e.key === 'n' || e.key === 'N') setSimulatorMode('navigate');
            if (e.key === 'd' || e.key === 'D') setSimulatorMode('draw');
            if (e.key === 'w' || e.key === 'W') setSimulatorMode('water');
            if (e.key === 'e' || e.key === 'E') setSimulatorMode('erase');
            if (e.key === 'i' || e.key === 'I') setSimulatorMode('inject');
            if (e.key === 'Enter' && s.isDrawing) finishDrawingStructure();
        };

        document.addEventListener('keydown', handleKeyDown);
        loadMapboxResources();

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            
            // Stop and clean up simulation
            const s = hydroStateRef.current;
            s.simRunning = false;
            if (s.animId) {
                cancelAnimationFrame(s.animId);
                s.animId = null;
            }
            if (s.map) {
                try {
                    s.map.remove();
                } catch (e) {
                    console.error("Error removing Mapbox map instance:", e);
                }
                s.map = null;
            }
            if (s.wCanvas && s.wCanvas.parentNode) {
                s.wCanvas.parentNode.removeChild(s.wCanvas);
            }
            s.wCanvas = null;
            s.gl = null;
            s.drawCanvas = null;
            s.drawCtx = null;
            s.program = null;
            s.vbo = null;
            s.waterTexture = null;
            delete window.hydroRemoveSource;
        };
    }, [isHydroSimOpen]);

    // Join/Link Data State
    const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
    const [joinTargetLayerId, setJoinTargetLayerId] = useState(null); // The GeoJSON layer to receive data
    const [selectedCsvLayerId, setSelectedCsvLayerId] = useState(''); // The CSV layer source
    const [joinKeyMap, setJoinKeyMap] = useState(''); // Key field in GeoJSON
    const [joinKeyCsv, setJoinKeyCsv] = useState(''); // Key field in CSV
    const [selectedCsvFields, setSelectedCsvFields] = useState([]); // Fields to import

    const pointShapes = [
        { id: 'circle', name: 'دائرة', icon: '●' },
        { id: 'square', name: 'مربع', icon: '■' },
        { id: 'diamond', name: 'معين', icon: '◆' },
        { id: 'triangle', name: 'مثلث', icon: '▲' },
        { id: 'star', name: 'نجمة', icon: '★' },
        { id: 'cross', name: 'علامة +', icon: '✚' },
    ];

    // Palette Mapping for Live Preview
    const paletteData = {
        classic: { primary: '#F5A623', primaryDark: '#D88B0E', bg: '#0F1E33', surface: '#142B47' },
        heritage: { primary: '#CE1126', primaryDark: '#007A3D', bg: '#000000', surface: '#1A1A1A' },
        ocean: { primary: '#06D6F2', primaryDark: '#1A2980', bg: '#0A1628', surface: '#142B47' },
        sunset: { primary: '#FF6B6B', primaryDark: '#F5A623', bg: '#1A0E1F', surface: '#2D1B36' },
        forest: { primary: '#10D9A0', primaryDark: '#059669', bg: '#064E3B', surface: '#0D6E55' },
        earth: { primary: '#D4C49B', primaryDark: '#A0826D', bg: '#2C1810', surface: '#3D2B1F' },
        neon: { primary: '#EC4899', primaryDark: '#8B5CF6', bg: '#050B16', surface: '#0D1526' },
        minimal: { primary: '#1A1A2E', primaryDark: '#4B5563', bg: '#F5F4ED', surface: '#FFFFFF' },
        shadcn_zinc: { primary: '#71717a', primaryDark: '#27272a', bg: '#09090b', surface: '#18181b' },
        shadcn_slate: { primary: '#64748b', primaryDark: '#1e293b', bg: '#020617', surface: '#0f172a' },
        shadcn_emerald: { primary: '#10b981', primaryDark: '#065f46', bg: '#022c22', surface: '#064e3b' },
        shadcn_violet: { primary: '#8b5cf6', primaryDark: '#312e81', bg: '#0c0a0f', surface: '#1e1b4b' },
        shadcn_rose: { primary: '#f43f5e', primaryDark: '#881337', bg: '#1c0d12', surface: '#4c0519' },
        shadcn_amber: { primary: '#f59e0b', primaryDark: '#78350f', bg: '#271404', surface: '#451a03' },
        custom: { primary: designSelections.customPrimary, primaryDark: designSelections.customPrimary, bg: '#0A1628', surface: '#142B47' }
    };

    const fontData = {
        cairo_tajawal: { h: "'Cairo', sans-serif", b: "'Tajawal', sans-serif" },
        tajawal_inter: { h: "'Tajawal', sans-serif", b: "'Inter', sans-serif" },
        cairo_mono: { h: "'Cairo', sans-serif", b: "'JetBrains Mono', monospace" },
        tajawal_ed: { h: "'Tajawal', serif", b: "'Tajawal', sans-serif" },
        display: { h: "'Cairo', sans-serif", b: "'Tajawal', sans-serif" },
        compact: { h: "'Tajawal', sans-serif", b: "'Tajawal', sans-serif" }
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
            '--font-h': f.h,
            '--font-b': f.b,
            '--font-main': f.b
        };
    }, [designSelections]);

    const activeTableLayer = useMemo(() => geoLayers.find(l => l.id === activeTableLayerId) || null, [geoLayers, activeTableLayerId]);

    const attributeKeys = useMemo(() => {
        if (!activeTableLayer || !activeTableLayer.data) return [];
        const keys = new Set();
        
        if (activeTableLayer.type === 'table') {
            // For CSV tables
            const data = activeTableLayer.data;
            for (let i = 0; i < Math.min(data.length, 50); i++) {
                Object.keys(data[i] || {}).forEach(k => keys.add(k));
            }
        } else if (activeTableLayer.data.features) {
            // For GeoJSON layers
            for (let i = 0; i < Math.min(activeTableLayer.data.features.length, 100); i++) {
                const props = activeTableLayer.data.features[i].properties;
                if (props) {
                    Object.keys(props).forEach(k => keys.add(k));
                }
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

    const generateDemRaster = (results, gridSize, south, west, north, east, colorRamp = 'classic', heightParam = null) => {
        const canvas = document.createElement('canvas');
        const width = 256;
        const height = 256;
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        const isFlatArray = (typeof results[0] === 'number');

        let minElev = Infinity;
        let maxElev = -Infinity;
        for (let i = 0; i < results.length; i++) {
            const val = isFlatArray ? results[i] : (results[i]?.elevation || 0);
            if (val < minElev) minElev = val;
            if (val > maxElev) maxElev = val;
        }
        const range = maxElev - minElev || 1;

        const getColorForElevation = (elev) => {
            const t = Math.max(0, Math.min(1, (elev - minElev) / range));
            let r, g, b;
            
            if (colorRamp === 'grayscale') {
                const val = Math.round(t * 255);
                return `rgb(${val},${val},${val})`;
            } else if (colorRamp === 'viridis') {
                if (t < 0.5) {
                    const f = t * 2;
                    r = Math.round(68 + (33 - 68) * f);
                    g = Math.round(1 + (145 - 1) * f);
                    b = Math.round(84 + (140 - 84) * f);
                } else {
                    const f = (t - 0.5) * 2;
                    r = Math.round(33 + (253 - 33) * f);
                    g = Math.round(145 + (231 - 145) * f);
                    b = Math.round(140 + (37 - 140) * f);
                }
                return `rgb(${r},${g},${b})`;
            } else if (colorRamp === 'terrain') {
                if (t < 0.5) {
                    const f = t * 2;
                    r = Math.round(34 + (234 - 34) * f);
                    g = Math.round(197 + (179 - 197) * f);
                    b = Math.round(94 + (8 - 94) * f);
                } else {
                    const f = (t - 0.5) * 2;
                    r = Math.round(234 + (255 - 234) * f);
                    g = Math.round(179 + (255 - 179) * f);
                    b = Math.round(8 + (255 - 8) * f);
                }
                return `rgb(${r},${g},${b})`;
            } else if (colorRamp === 'rainbow') {
                if (t < 0.25) {
                    const f = t * 4;
                    return `rgb(0, ${Math.round(f * 255)}, 255)`;
                } else if (t < 0.5) {
                    const f = (t - 0.25) * 4;
                    return `rgb(0, 255, ${Math.round((1 - f) * 255)})`;
                } else if (t < 0.75) {
                    const f = (t - 0.5) * 4;
                    return `rgb(${Math.round(f * 255)}, 255, 0)`;
                } else {
                    const f = (t - 0.75) * 4;
                    return `rgb(255, ${Math.round((1 - f) * 255)}, 0)`;
                }
            } else {
                // Classic
                if (t < 0.5) {
                    const factor = t * 2;
                    r = Math.round(49 + (16 - 49) * factor);
                    g = Math.round(46 + (185 - 46) * factor);
                    b = Math.round(129 + (129 - 129) * factor);
                } else {
                    const factor = (t - 0.5) * 2;
                    r = Math.round(16 + (239 - 16) * factor);
                    g = Math.round(185 + (68 - 185) * factor);
                    b = Math.round(129 + (68 - 129) * factor);
                }
                return `rgb(${r},${g},${b})`;
            }
        };

        const imgData = ctx.createImageData(width, height);
        const gridWidth = gridSize;
        const gridHeight = heightParam !== null ? heightParam : gridSize;

        const grid = [];
        for (let r = 0; r < gridHeight; r++) {
            grid[r] = [];
        }
        for (let r = 0; r < gridHeight; r++) {
            for (let c = 0; c < gridWidth; c++) {
                const index = r * gridWidth + c;
                grid[gridHeight - 1 - r][c] = isFlatArray ? (results[index] || 0) : (results[index] ? (results[index].elevation || 0) : 0);
            }
        }

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const gx = (x / (width - 1)) * (gridWidth - 1);
                const gy = (y / (height - 1)) * (gridHeight - 1);

                const x0 = Math.floor(gx);
                const x1 = Math.min(x0 + 1, gridWidth - 1);
                const y0 = Math.floor(gy);
                const y1 = Math.min(y0 + 1, gridHeight - 1);

                const tx = gx - x0;
                const ty = gy - y0;

                const e00 = grid[y0][x0] || 0;
                const e10 = grid[y0][x1] || 0;
                const e01 = grid[y1][x0] || 0;
                const e11 = grid[y1][x1] || 0;

                const eTop = e00 + tx * (e10 - e00);
                const eBottom = e01 + tx * (e11 - e01);
                const elev = eTop + ty * (eBottom - eTop);

                const colorStr = getColorForElevation(elev);
                const rgb = colorStr.match(/\d+/g).map(Number);

                const pixelIdx = (y * width + x) * 4;
                imgData.data[pixelIdx] = rgb[0];
                imgData.data[pixelIdx + 1] = rgb[1];
                imgData.data[pixelIdx + 2] = rgb[2];
                imgData.data[pixelIdx + 3] = 220;
            }
        }

        ctx.putImageData(imgData, 0, 0);
        return {
            url: canvas.toDataURL(),
            coordinates: [
                [west, north],
                [east, north],
                [east, south],
                [west, south]
            ]
        };
    };

    const generateTerrariumDem = (results, gridSize, south, west, north, east, heightParam = null) => {
        const canvas = document.createElement('canvas');
        const width = 256;
        const height = 256;
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        const isFlatArray = (typeof results[0] === 'number');
        const imgData = ctx.createImageData(width, height);
        const gridWidth = gridSize;
        const gridHeight = heightParam !== null ? heightParam : gridSize;

        const grid = [];
        for (let r = 0; r < gridHeight; r++) {
            grid[r] = [];
        }
        for (let r = 0; r < gridHeight; r++) {
            for (let c = 0; c < gridWidth; c++) {
                const index = r * gridWidth + c;
                grid[gridHeight - 1 - r][c] = isFlatArray ? (results[index] || 0) : (results[index] ? (results[index].elevation || 0) : 0);
            }
        }

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const gx = (x / (width - 1)) * (gridWidth - 1);
                const gy = (y / (height - 1)) * (gridHeight - 1);

                const x0 = Math.floor(gx);
                const x1 = Math.min(x0 + 1, gridWidth - 1);
                const y0 = Math.floor(gy);
                const y1 = Math.min(y0 + 1, gridHeight - 1);

                const tx = gx - x0;
                const ty = gy - y0;

                const e00 = grid[y0][x0] || 0;
                const e10 = grid[y0][x1] || 0;
                const e01 = grid[y1][x0] || 0;
                const e11 = grid[y1][x1] || 0;

                const eTop = e00 + tx * (e10 - e00);
                const eBottom = e01 + tx * (e11 - e01);
                const elev = eTop + ty * (eBottom - eTop);

                // Terrarium encoding
                const val = elev + 32768;
                const r = Math.floor(val / 256);
                const g = Math.floor(val % 256);
                const b = Math.round((val % 1) * 256);

                const pixelIdx = (y * width + x) * 4;
                imgData.data[pixelIdx] = Math.max(0, Math.min(255, r));
                imgData.data[pixelIdx + 1] = Math.max(0, Math.min(255, g));
                imgData.data[pixelIdx + 2] = Math.max(0, Math.min(255, b));
                imgData.data[pixelIdx + 3] = 255;
            }
        }

        ctx.putImageData(imgData, 0, 0);
        return {
            url: canvas.toDataURL(),
            coordinates: [
                [west, north],
                [east, north],
                [east, south],
                [west, south]
            ]
        };
    };

    const fetchAsterGDEM = async (south, west, north, east, gridSize) => {
        setAsterLoading(true);
        setAsterProgress("جاري إنشاء شبكة النقاط...");

        const latStep = (north - south) / (gridSize - 1);
        const lngStep = (east - west) / (gridSize - 1);

        const locations = [];
        for (let r = 0; r < gridSize; r++) {
            for (let c = 0; c < gridSize; c++) {
                const lat = south + r * latStep;
                const lng = west + c * lngStep;
                locations.push({ lat, lng });
            }
        }

        const batchSize = 100;
        const batches = [];
        for (let i = 0; i < locations.length; i += batchSize) {
            batches.push(locations.slice(i, i + batchSize));
        }

        const results = [];
        try {
            for (let i = 0; i < batches.length; i++) {
                setAsterProgress(`جاري جلب الارتفاعات (المجموعة ${i + 1} من ${batches.length})...`);
                
                const locString = batches[i].map(loc => `${loc.lat.toFixed(6)},${loc.lng.toFixed(6)}`).join('|');
                const response = await api.get(`/remote-sensing/aster30m?locations=${locString}`);
                if (response.data && response.data.results) {
                    results.push(...response.data.results);
                } else {
                    throw new Error("تنسيق بيانات الـ API غير صالح");
                }

                if (i < batches.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1100));
                }
            }

            if (results.length === 0) {
                throw new Error("لم يتم إرجاع أي بيانات");
            }

            let minElev = Infinity;
            let maxElev = -Infinity;
            for (let i = 0; i < results.length; i++) {
                const val = results[i].elevation || 0;
                if (val < minElev) minElev = val;
                if (val > maxElev) maxElev = val;
            }

            const features = results.map((res, index) => {
                return {
                    type: "Feature",
                    geometry: {
                        type: "Point",
                        coordinates: [res.location.lng, res.location.lat]
                    },
                    properties: {
                        id: index,
                        elevation: res.elevation,
                        dataset: res.dataset
                    }
                };
            });

            const geojson = {
                type: "FeatureCollection",
                features: features
            };

            const newLayerId = `aster-${Date.now()}`;
            const layerName = `ASTER GDEM (${gridSize}x${gridSize}) - ${new Date().toLocaleTimeString()}`;
            const newLayers = [];

            if (asterViewType === 'raster') {
                const rasterData = generateDemRaster(results, gridSize, south, west, north, east, 'classic');
                const demData = generateTerrariumDem(results, gridSize, south, west, north, east);
                
                newLayers.push({
                    id: `${newLayerId}-raster`,
                    name: `${layerName} (Raster)`,
                    type: 'raster',
                    url: rasterData.url,
                    demUrl: demData.url,
                    coordinates: rasterData.coordinates,
                    isRemoteSensing: true,
                    minElevation: minElev,
                    maxElevation: maxElev,
                    isVisible: true,
                    rawResults: results,
                    gridSize: gridSize,
                    south: south,
                    west: west,
                    north: north,
                    east: east,
                    colorRamp: 'classic'
                });

                newLayers.push({
                    id: `${newLayerId}-points`,
                    name: `${layerName} (Clickable)`,
                    data: geojson,
                    isRemoteSensing: true,
                    minElevation: minElev,
                    maxElevation: maxElev,
                    color: '#fbab15',
                    isVisible: true,
                    isHiddenPoints: true,
                    colorRamp: 'classic'
                });
            } else {
                newLayers.push({
                    id: newLayerId,
                    name: layerName,
                    data: geojson,
                    isRemoteSensing: true,
                    minElevation: minElev,
                    maxElevation: maxElev,
                    color: '#fbab15',
                    isVisible: true,
                    colorRamp: 'classic'
                });
            }

            setGeoLayers(prev => [...prev, ...newLayers]);

            newLayers.forEach(l => {
                setLayerStyles(prev => ({
                    ...prev,
                    [l.id]: {
                        color: '#fbab15',
                        outlineColor: '#ffffff',
                        outlineWidth: 1,
                        opacity: l.isHiddenPoints ? 0.001 : 0.85,
                        isRemoteSensing: true,
                        minElevation: minElev,
                        maxElevation: maxElev
                    }
                }));
            });

            if (asterViewType === 'raster') {
                setActiveAsterLayerId(`${newLayerId}-raster`);
            } else {
                setActiveAsterLayerId(newLayerId);
            }

            setAsterLoading(false);
            setAsterProgress("");
            alert(`✅ تم جلب ${results.length} نقطة ارتفاع بنجاح وتولينها على الخريطة!`);

        } catch (error) {
            console.error("Error fetching ASTER GDEM:", error);
            setAsterLoading(false);
            setAsterProgress("");
            alert(`❌ فشل جلب البيانات: ${error.message || error}`);
        }
    };

    const exportAsterToCSV = (layer) => {
        if (!layer) return;
        let targetLayer = layer;
        if (layer.type === 'raster') {
            const pointsLayerId = layer.id.replace('-raster', '-points');
            targetLayer = geoLayers.find(l => l.id === pointsLayerId) || layer;
        }
        if (!targetLayer.data || !targetLayer.data.features) return;
        const features = targetLayer.data.features;
        const headers = ['Longitude', 'Latitude', 'Elevation_m', 'Dataset'];
        const csvRows = [headers.join(',')];
        
        features.forEach(f => {
            const lng = f.geometry.coordinates[0];
            const lat = f.geometry.coordinates[1];
            const elev = f.properties.elevation;
            const dataset = f.properties.dataset;
            csvRows.push(`${lng},${lat},${elev},${dataset}`);
        });
        
        const csvString = csvRows.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `${layer.name}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const exportAsterToGeoJSON = (layer) => {
        if (!layer) return;
        let targetLayer = layer;
        if (layer.type === 'raster') {
            const pointsLayerId = layer.id.replace('-raster', '-points');
            targetLayer = geoLayers.find(l => l.id === pointsLayerId) || layer;
        }
        if (!targetLayer.data) return;
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(targetLayer.data, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `${layer.name}.geojson`);
        downloadAnchor.style.visibility = 'hidden';
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        document.body.removeChild(downloadAnchor);
    };

    const exportAsterToGeoTIFF = (layer) => {
        if (!layer) return;
        
        let targetLayer = layer;
        if (layer.type === 'raster') {
            const pointsLayerId = layer.id.replace('-raster', '-points');
            targetLayer = geoLayers.find(l => l.id === pointsLayerId) || layer;
        }

        try {
            let gridWidth = 0;
            let gridHeight = 0;
            let west = 0;
            let east = 0;
            let south = 0;
            let north = 0;
            let elevations = null;

            if (targetLayer.elevations) {
                // Optimized path for local GeoTIFF and ASTER layers with Float32Array elevations
                gridWidth = targetLayer.gridWidth || targetLayer.gridSize;
                gridHeight = targetLayer.gridHeight || gridWidth;
                west = targetLayer.west;
                east = targetLayer.east;
                south = targetLayer.south;
                north = targetLayer.north;
                elevations = targetLayer.elevations;
            } else {
                if (!targetLayer.data || !targetLayer.data.features) {
                    alert("⚠️ لا توجد بيانات نقاط ارتفاع صالحة لتصدير GeoTIFF.");
                    return;
                }
                const features = targetLayer.data.features;
                if (features.length === 0) return;

                // Safe min/max scan without spread operator
                let minLng = Infinity, maxLng = -Infinity;
                let minLat = Infinity, maxLat = -Infinity;
                for (let i = 0; i < features.length; i++) {
                    const coords = features[i].geometry.coordinates;
                    if (coords[0] < minLng) minLng = coords[0];
                    if (coords[0] > maxLng) maxLng = coords[0];
                    if (coords[1] < minLat) minLat = coords[1];
                    if (coords[1] > maxLat) maxLat = coords[1];
                }
                west = minLng;
                east = maxLng;
                south = minLat;
                north = maxLat;

                const lats = features.map(f => f.geometry.coordinates[1]);
                const lngs = features.map(f => f.geometry.coordinates[0]);
                const uniqueLats = [...new Set(lats)].sort((a, b) => b - a);
                const uniqueLngs = [...new Set(lngs)].sort((a, b) => a - b);
                
                gridWidth = uniqueLngs.length;
                gridHeight = uniqueLats.length;

                // Pre-build index for fast lookup
                const coordMap = new Map();
                for (let i = 0; i < features.length; i++) {
                    const f = features[i];
                    const key = `${f.geometry.coordinates[1].toFixed(5)},${f.geometry.coordinates[0].toFixed(5)}`;
                    coordMap.set(key, f.properties.elevation || 0);
                }

                elevations = new Float32Array(gridWidth * gridHeight);
                for (let r = 0; r < gridHeight; r++) {
                    const lat = uniqueLats[r];
                    for (let c = 0; c < gridWidth; c++) {
                        const lng = uniqueLngs[c];
                        const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
                        elevations[r * gridWidth + c] = coordMap.get(key) || 0;
                    }
                }
            }

            const pixelDataSize = gridWidth * gridHeight * 4;
            const headerSize = 8;
            
            const offsetPixelScale = 176;
            const offsetTiepoint = 200;
            const offsetGeoKeys = 248;
            const offsetPixelData = 296;
            
            const bufferSize = offsetPixelData + pixelDataSize;
            const buffer = new ArrayBuffer(bufferSize);
            const view = new DataView(buffer);
            
            view.setUint8(0, 0x49); // 'I'
            view.setUint8(1, 0x49); // 'I'
            view.setUint16(2, 42, true);
            view.setUint32(4, 8, true);
            
            let offset = 8;
            view.setUint16(offset, 13, true);
            offset += 2;
            
            const writeEntry = (tag, type, count, valOrOffset) => {
                view.setUint16(offset, tag, true);
                view.setUint16(offset + 2, type, true);
                view.setUint32(offset + 4, count, true);
                view.setUint32(offset + 8, valOrOffset, true);
                offset += 12;
            };
            
            writeEntry(256, 4, 1, gridWidth);
            writeEntry(257, 4, 1, gridHeight);
            writeEntry(258, 3, 1, 32);
            writeEntry(259, 3, 1, 1);
            writeEntry(262, 3, 1, 1);
            writeEntry(273, 4, 1, offsetPixelData);
            writeEntry(277, 3, 1, 1);
            writeEntry(278, 4, 1, gridHeight);
            writeEntry(279, 4, 1, pixelDataSize);
            writeEntry(339, 3, 1, 3);
            writeEntry(33550, 12, 3, offsetPixelScale);
            writeEntry(33922, 12, 6, offsetTiepoint);
            writeEntry(34735, 3, 24, offsetGeoKeys);
            
            view.setUint32(offset, 0, true);
            
            const scaleX = gridWidth > 1 ? (east - west) / (gridWidth - 1) : 0.0001;
            const scaleY = gridHeight > 1 ? (north - south) / (gridHeight - 1) : 0.0001;
            view.setFloat64(offsetPixelScale, scaleX, true);
            view.setFloat64(offsetPixelScale + 8, scaleY, true);
            view.setFloat64(offsetPixelScale + 16, 0.0, true);
            
            view.setFloat64(offsetTiepoint, 0.0, true);
            view.setFloat64(offsetTiepoint + 8, 0.0, true);
            view.setFloat64(offsetTiepoint + 16, 0.0, true);
            view.setFloat64(offsetTiepoint + 24, west, true);
            view.setFloat64(offsetTiepoint + 32, north, true);
            view.setFloat64(offsetTiepoint + 40, 0.0, true);
            
            const geoKeys = [
                1, 1, 0, 5,
                1024, 0, 1, 2,
                1025, 0, 1, 1,
                2048, 0, 1, 4326,
                2054, 0, 1, 9102,
                3072, 0, 1, 4326
            ];
            for (let i = 0; i < geoKeys.length; i++) {
                view.setUint16(offsetGeoKeys + i * 2, geoKeys[i], true);
            }
            
            let pixelOffset = offsetPixelData;
            for (let i = 0; i < elevations.length; i++) {
                view.setFloat32(pixelOffset, elevations[i], true);
                pixelOffset += 4;
            }
            
            const blob = new Blob([buffer], { type: 'image/tiff' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", `${layer.name.replace(' (Raster)', '')}.tif`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            console.error("Error generating GeoTIFF:", err);
            alert("❌ خطأ أثناء تصدير GeoTIFF: " + err.message);
        }
    };

    const parseTiff = async (arrayBuffer) => {
        const tiff = await GeoTIFF.fromArrayBuffer(arrayBuffer);
        const image = await tiff.getImage();
        const width = image.getWidth();
        const height = image.getHeight();
        const fd = image.getFileDirectory();
        
        let scaleX = 0.0001, scaleY = 0.0001;
        if (fd.ModelPixelScale) {
            scaleX = fd.ModelPixelScale[0];
            scaleY = fd.ModelPixelScale[1];
        }
        
        let west = 35.2, north = 31.9;
        if (fd.ModelTiepoint) {
            west = fd.ModelTiepoint[3];
            north = fd.ModelTiepoint[4];
        }
        
        const rasters = await image.readRasters();
        let elevations = rasters[0];
        if (!(elevations instanceof Float32Array)) {
            elevations = new Float32Array(elevations);
        }
        
        return { width, height, scaleX, scaleY, west, north, elevations };
    };


    const toggle3dModel = (baseId) => {
        const is3dActive = active3dLayerId === baseId;
        const map = mapRef.current?.getMap();
        
        if (is3dActive) {
            if (map) {
                map.setTerrain(null);
                try {
                    if (map.getSource(`terrain-dem-${baseId}`)) {
                        map.removeSource(`terrain-dem-${baseId}`);
                    }
                } catch (e) {
                    console.error("Error removing terrain-dem source:", e);
                }
            }
            setActive3dLayerId(null);
        } else {
            if (map) {
                // If there's an existing custom terrain active, clean it up first
                if (active3dLayerId) {
                    try {
                        map.setTerrain(null);
                        if (map.getSource(`terrain-dem-${active3dLayerId}`)) {
                            map.removeSource(`terrain-dem-${active3dLayerId}`);
                        }
                    } catch (e) {
                        console.error("Error cleaning up previous terrain:", e);
                    }
                }

                const layer = geoLayers.find(l => l.id === `${baseId}-raster` || l.id === baseId);
                const sourceId = layer && layer.demUrl ? `terrain-dem-${baseId}` : 'terrain-dem';

                if (layer && layer.demUrl) {
                    if (!map.getSource(sourceId)) {
                        map.addSource(sourceId, {
                            type: 'raster-dem',
                            tiles: [layer.demUrl],
                            encoding: 'terrarium',
                            tileSize: 256,
                            bounds: [layer.west, layer.south, layer.east, layer.north]
                        });
                    }
                } else {
                    if (!map.getSource('terrain-dem')) {
                        map.addSource('terrain-dem', {
                            type: 'raster-dem',
                            tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
                            encoding: 'terrarium',
                            tileSize: 256,
                            maxzoom: 15
                        });
                    }
                }

                map.setTerrain({ source: sourceId, exaggeration: exaggeration3d });
                
                map.easeTo({
                    pitch: 60,
                    bearing: -15,
                    duration: 1000
                });
            }
            setActive3dLayerId(baseId);
        }
    };

    const handleExaggerationChange = (newExag) => {
        setExaggeration3d(newExag);
        if (active3dLayerId) {
            const map = mapRef.current?.getMap();
            if (map) {
                const sourceId = map.getSource(`terrain-dem-${active3dLayerId}`) ? `terrain-dem-${active3dLayerId}` : 'terrain-dem';
                map.setTerrain({ source: sourceId, exaggeration: newExag });
            }
        }
    };

    const fetchPalDataOSM = async (south, west, north, east, polygonFilterCoords = null) => {
        if (palDataSelectedCategories.length === 0) {
            alert("⚠️ يرجى اختيار تصنيف واحد على الأقل للاستخراج.");
            return;
        }

        const latDim = Math.abs(north - south);
        const lngDim = Math.abs(east - west);
        const area = latDim * lngDim;
        if (area > 0.05) {
            alert("⚠️ النطاق المحدد واسع جداً! يرجى تكبير الخريطة أو تحديد منطقة أصغر لتجنب بطء الاستجابة.");
            return;
        }

        setPalDataLoading(true);
        setPalDataProgress("جاري الاتصال بخادم OpenStreetMap...");
        setPalDataStats(null);

        // Build OSM Overpass Query based on selected categories
        let clauses = [];
        const bbox = `${south},${west},${north},${east}`;
        
        palDataSelectedCategories.forEach(catKey => {
            const cat = PAL_DATA_CATEGORIES[catKey];
            if (!cat) return;
            
            Object.entries(cat.tags).forEach(([tagKey, tagValues]) => {
                const valRegex = `^(${tagValues.join('|')})$`;
                clauses.push(`node["${tagKey}"~"${valRegex}"](${bbox});`);
                clauses.push(`way["${tagKey}"~"${valRegex}"](${bbox});`);
                clauses.push(`relation["${tagKey}"~"${valRegex}"](${bbox});`);
            });
        });

        const query = `[out:json][timeout:60];
(
  ${clauses.join('\n  ')}
);
out geom;`;

        const overpassEndpoints = [
            "https://overpass-api.de/api/interpreter",
            "https://lz4.overpass-api.de/api/interpreter",
            "https://z.overpass-api.de/api/interpreter"
        ];
        
        let fetchedData = null;
        let fetchError = null;

        for (const url of overpassEndpoints) {
            try {
                setPalDataProgress(`جاري سحب البيانات من الخادم (${url.split('/')[2]})...`);
                const response = await axios.post(url, `data=${encodeURIComponent(query)}`, {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
                });
                if (response.data && response.data.elements) {
                    fetchedData = response.data.elements;
                    break;
                }
            } catch (err) {
                console.warn(`Failed fetching OSM from ${url}:`, err);
                fetchError = err;
            }
        }

        if (!fetchedData) {
            setPalDataLoading(false);
            setPalDataProgress("");
            alert(`❌ فشل جلب البيانات من خوادم OpenStreetMap. خطأ: ${fetchError?.message || "خطأ غير معروف"}`);
            return;
        }

        setPalDataProgress("جاري معالجة وتصنيف المعالم الجغرافية...");
        
        const features = [];
        const stats = {
            highway_transport: 0,
            buildings: 0,
            landuse: 0,
            amenities: 0,
            leisure_tourism: 0,
            natural_water: 0,
            shops: 0,
            offices_crafts: 0,
            infrastructure_emergency: 0,
            places_boundaries: 0,
            other: 0
        };

        const isPointInPolygon = (point, vs) => {
            const x = point[0], y = point[1];
            let inside = false;
            for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
                const xi = vs[i][0], yi = vs[i][1];
                const xj = vs[j][0], yj = vs[j][1];
                const intersect = ((yi > y) !== (yj > y))
                    && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
                if (intersect) inside = !inside;
            }
            return inside;
        };

        const getCategoryKey = (tags) => {
            if (!tags) return 'other';
            for (const [catKey, cat] of Object.entries(PAL_DATA_CATEGORIES)) {
                for (const [tagKey, tagValues] of Object.entries(cat.tags)) {
                    if (tags.hasOwnProperty(tagKey) && tagValues.includes(tags[tagKey])) {
                        return catKey;
                    }
                }
            }
            return 'other';
        };

        fetchedData.forEach(element => {
            const tags = element.tags || {};
            const palCategory = getCategoryKey(tags);

            if (element.type === 'node' && element.lat !== undefined && element.lon !== undefined) {
                const pt = [element.lon, element.lat];
                
                if (polygonFilterCoords && polygonFilterCoords[0]) {
                    const outerRing = polygonFilterCoords[0];
                    if (!isPointInPolygon(pt, outerRing)) return;
                }

                if (stats.hasOwnProperty(palCategory)) {
                    stats[palCategory]++;
                } else {
                    stats.other++;
                }

                features.push({
                    type: 'Feature',
                    id: element.id,
                    geometry: {
                        type: 'Point',
                        coordinates: pt
                    },
                    properties: {
                        id: element.id,
                        name: tags.name || tags.name_ar || tags.name_en || tags.amenity || tags.shop || tags.highway || tags.place || 'معلم نقطي',
                        palCategory,
                        isPalData: true,
                        ...tags
                    }
                });
            } 
            else if (element.type === 'way' && element.geometry && element.geometry.length > 0) {
                const coords = element.geometry.map(pt => [pt.lon, pt.lat]);
                
                if (polygonFilterCoords && polygonFilterCoords[0]) {
                    const outerRing = polygonFilterCoords[0];
                    const isInside = coords.some(pt => isPointInPolygon(pt, outerRing));
                    if (!isInside) return;
                }

                const isClosed = coords.length > 2 && 
                               coords[0][0] === coords[coords.length - 1][0] && 
                               coords[0][1] === coords[coords.length - 1][1];
                
                const isArea = isClosed && (
                    tags.building || 
                    tags.landuse || 
                    tags.amenity || 
                    tags.leisure || 
                    tags.shop || 
                    tags.natural || 
                    tags.water || 
                    tags.boundary || 
                    tags.area === 'yes'
                );

                if (stats.hasOwnProperty(palCategory)) {
                    stats[palCategory]++;
                } else {
                    stats.other++;
                }

                features.push({
                    type: 'Feature',
                    id: element.id,
                    geometry: {
                        type: isArea ? 'Polygon' : 'LineString',
                        coordinates: isArea ? [coords] : coords
                    },
                    properties: {
                        id: element.id,
                        name: tags.name || tags.name_ar || tags.name_en || tags.building || tags.landuse || tags.highway || 'معلم خطي/مساحي',
                        palCategory,
                        isPalData: true,
                        ...tags
                    }
                });
            }
            else if (element.type === 'relation' && element.members) {
                element.members.forEach(member => {
                    if (member.type === 'way' && member.geometry && member.geometry.length > 0) {
                        const coords = member.geometry.map(pt => [pt.lon, pt.lat]);
                        
                        if (polygonFilterCoords && polygonFilterCoords[0]) {
                            const outerRing = polygonFilterCoords[0];
                            const isInside = coords.some(pt => isPointInPolygon(pt, outerRing));
                            if (!isInside) return;
                        }

                        const isClosed = coords.length > 2 && 
                                       coords[0][0] === coords[coords.length - 1][0] && 
                                       coords[0][1] === coords[coords.length - 1][1];
                        
                        const isArea = isClosed && (
                            tags.building || 
                            tags.landuse || 
                            tags.amenity || 
                            tags.leisure || 
                            tags.shop || 
                            tags.natural || 
                            tags.water || 
                            tags.boundary || 
                            tags.area === 'yes'
                        );

                        if (stats.hasOwnProperty(palCategory)) {
                            stats[palCategory]++;
                        } else {
                            stats.other++;
                        }

                        features.push({
                            type: 'Feature',
                            id: member.ref || Math.floor(Math.random() * 10000000),
                            geometry: {
                                type: isArea ? 'Polygon' : 'LineString',
                                coordinates: isArea ? [coords] : coords
                            },
                            properties: {
                                id: member.ref,
                                name: tags.name || tags.name_ar || tags.name_en || tags.boundary || 'معلم مساحي (علاقة)',
                                palCategory,
                                isPalData: true,
                                ...tags
                            }
                        });
                    }
                });
            }
        });

        if (features.length === 0) {
            setPalDataLoading(false);
            setPalDataProgress("");
            alert("⚠️ لم يتم العثور على أي معالم جغرافية في التصنيفات المحددة. يرجى تجربة منطقة أخرى.");
            return;
        }

        const newLayerId = `paldata-${Date.now()}`;
        const layerName = `بيانات PalData [${features.length}]`;
        const geojson = {
            type: 'FeatureCollection',
            features: features
        };

        setGeoLayers(prev => [...prev, {
            id: newLayerId,
            name: layerName,
            data: geojson,
            isPalData: true,
            color: '#10D9A0',
            isVisible: true
        }]);

        setLayerStyles(prev => ({
            ...prev,
            [newLayerId]: {
                color: '#10D9A0',
                outlineColor: '#ffffff',
                outlineWidth: 2.0,
                opacity: 1,
                isPalData: true
            }
        }));

        setPalDataStats(stats);
        setPalDataLoading(false);
        setPalDataProgress("");
        alert(`✅ تم رسم ${features.length} معلم جغرافي بنجاح وتصنيفها كطبقة حية!`);
    };

    const handleExportLayer = (layer) => {
        try {
            if (layer.isRemoteSensing) {
                exportAsterToGeoTIFF(layer);
                return;
            }
            if (layer.type === 'table') {
                if (!layer.data || layer.data.length === 0) {
                    alert("⚠️ لا توجد بيانات لتصديرها.");
                    return;
                }
                const headers = Object.keys(layer.data[0]);
                const csvRows = [];
                csvRows.push(headers.join(','));
                layer.data.forEach(row => {
                    const values = headers.map(header => {
                        const escaped = ('' + (row[header] ?? '')).replace(/"/g, '""');
                        return `"${escaped}"`;
                    });
                    csvRows.push(values.join(','));
                });
                const csvString = csvRows.join('\n');
                const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.setAttribute("href", url);
                link.setAttribute("download", `${layer.name || 'layer'}.csv`);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } else {
                if (!layer.data) {
                    alert("⚠️ لا توجد بيانات لتصديرها.");
                    return;
                }
                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(layer.data, null, 2));
                const downloadAnchor = document.createElement('a');
                downloadAnchor.setAttribute("href", dataStr);
                downloadAnchor.setAttribute("download", `${layer.name || 'layer'}.geojson`);
                downloadAnchor.style.visibility = 'hidden';
                document.body.appendChild(downloadAnchor);
                downloadAnchor.click();
                document.body.removeChild(downloadAnchor);
            }
        } catch (err) {
            console.error("Failed to export layer:", err);
            alert("❌ فشل تصدير الطبقة.");
        }
    };

    const finishDrawing = () => {
        if (drawingMode === 'paldata_poly') {
            if (draftCoordinates.length > 2) {
                const polygonCoords = [[...draftCoordinates, draftCoordinates[0]]];
                let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
                draftCoordinates.forEach(([lng, lat]) => {
                    if (lng < minLng) minLng = lng;
                    if (lng > maxLng) maxLng = lng;
                    if (lat < minLat) minLat = lat;
                    if (lat > maxLat) maxLat = lat;
                });
                fetchPalDataOSM(minLat, minLng, maxLat, maxLng, polygonCoords);
            } else {
                alert("⚠️ يرجى رسم مضلع يحتوي على 3 نقاط على الأقل.");
            }
            setDraftCoordinates([]);
            setDrawingMode(null);
            return;
        }

        if (draftCoordinates.length > 1) {
            let geometryType = drawingMode === 'polygon' && draftCoordinates.length > 2 ? 'Polygon' : 'LineString';
            let coords = geometryType === 'Polygon' ? [[...draftCoordinates, draftCoordinates[0]]] : draftCoordinates;

            let metricText = '';
            if (geometryType === 'LineString' || drawingMode === 'measure') {
                let dist = 0;
                for (let i = 0; i < coords.length - 1; i++) dist += haversineDistance(coords[i], coords[i + 1]);
                metricText = dist > 1000 ? (dist / 1000).toFixed(2) + ' كم' : dist.toFixed(1) + ' م';
            } else if (geometryType === 'Polygon') {
                let area = 0;
                const pts = coords[0];
                for (let i = 0; i < pts.length - 1; i++) {
                    let p1 = pts[i];
                    let p2 = pts[i + 1];
                    area += (p2[0] - p1[0]) * Math.PI / 180 * (2 + Math.sin(p1[1] * Math.PI / 180) + Math.sin(p2[1] * Math.PI / 180));
                }
                area = Math.abs(area * 6378137 * 6378137 / 2.0);
                metricText = area > 1000000 ? (area / 1000000).toFixed(2) + ' كم²' : area.toFixed(1) + ' م²';
            }

            const newFeature = { type: 'Feature', geometry: { type: geometryType, coordinates: coords }, properties: { type: `drawn_${drawingMode}`, name: `رسمة (${drawingMode})`, Measurement: metricText } };
            const newLayerId = Date.now().toString();
            const defaultColor = ['#06D6F2', '#F5A623', '#10D9A0', '#8B5CF6', '#EC4899'][geoLayers.length % 5];

            setGeoLayers(prev => [...prev, {
                id: newLayerId,
                name: `رسم (${drawingMode === 'polygon' ? 'مساحة' : drawingMode === 'measure' ? 'قياس مسافة' : 'مسار'})`,
                data: { type: 'FeatureCollection', features: [newFeature] },
                color: defaultColor,
                measurement: metricText
            }]);

            // Initialize default style
            setLayerStyles(prev => ({
                ...prev,
                [newLayerId]: {
                    color: defaultColor,
                    outlineColor: '#ffffff',
                    outlineWidth: 2,
                    shape: 'circle',
                    opacity: 1,
                    fillOpacity: 0.3
                }
            }));
        }
        setDraftCoordinates([]);
        setDrawingMode(null);
    };

    const handleRenameLayer = (id, newName) => {
        const finalName = newName.substring(0, 19);
        setGeoLayers(prev => prev.map(l => l.id === id ? { ...l, name: finalName } : l));
        setEditingLayerId(null);
    };

    const handleUpdateFeatureProperty = (layerId, featureId, key, val) => {
        setGeoLayers(prev => prev.map(layer => {
            if (layer.id === layerId) {
                const updatedFeatures = layer.data.features.map(f => {
                    const fId = f.id || JSON.stringify(f.geometry.coordinates);
                    if (fId === featureId) {
                        return {
                            ...f,
                            properties: {
                                ...f.properties,
                                [key]: val
                            }
                        };
                    }
                    return f;
                });
                return {
                    ...layer,
                    data: {
                        ...layer.data,
                        features: updatedFeatures
                    }
                };
            }
            return layer;
        }));

        // Also update highlightFeatures if they are active
        setHighlightFeatures(prev => prev.map(f => {
            const fId = f.id || JSON.stringify(f.geometry.coordinates);
            if (fId === featureId) {
                return {
                    ...f,
                    properties: {
                        ...f.properties,
                        [key]: val
                    }
                };
            }
            return f;
        }));

        // Also update selectedFeatureInfo state so it refreshes immediately in the UI
        setSelectedFeatureInfo(prev => {
            if (prev && prev.layerId === layerId && prev.featureId === featureId) {
                return {
                    ...prev,
                    properties: {
                        ...prev.properties,
                        [key]: val
                    }
                };
            }
            return prev;
        });
    };

    const handleExtractFeature = (feature) => {
        try {
            const featureJson = feature.toJSON ? feature.toJSON() : feature;
            const newLayerId = `ext-${Date.now()}`;
            
            const featureName = (featureJson.properties?.name || 
                                 featureJson.properties?.Name || 
                                 featureJson.properties?.label || 
                                 featureJson.properties?.OBJECTID || 
                                 'معلم مستخرج').substring(0, 19);

            const newLayer = {
                id: newLayerId,
                name: `مستخرج: ${featureName}`.substring(0, 19),
                data: {
                    type: 'FeatureCollection',
                    features: [{
                        ...featureJson,
                        properties: { ...featureJson.properties, extracted_at: new Date().toISOString() }
                    }]
                },
                color: '#fbab15',
                isVisible: true
            };

            setGeoLayers(prev => [...prev, newLayer]);

            setLayerStyles(prev => ({
                ...prev,
                [newLayerId]: {
                    color: '#fbab15',
                    outlineColor: '#ffffff',
                    outlineWidth: 3,
                    shape: 'circle',
                    opacity: 1,
                    fillOpacity: 0.8
                }
            }));

            // تأثير بصري بسيط (تنبيه)
            alert(`✅ تم استخراج "${featureName}" بنجاح في طبقة جديدة مستقلة!`);
        } catch (err) {
            console.error("Extraction error:", err);
        }
    };

    const handleBulkExtract = () => {
        if (selectedFeatures.length === 0) return;
        
        try {
            const newLayerId = `bulk-ext-${Date.now()}`;
            const newLayer = {
                id: newLayerId,
                name: `مجموعة (${selectedFeatures.length})`.substring(0, 19),
                data: {
                    type: 'FeatureCollection',
                    features: selectedFeatures.map(f => ({
                        ...f,
                        properties: { ...f.properties, extracted_at: new Date().toISOString() }
                    }))
                },
                color: '#fbab15',
                isVisible: true
            };

            setGeoLayers(prev => [...prev, newLayer]);
            setLayerStyles(prev => ({
                ...prev,
                [newLayerId]: {
                    color: '#fbab15',
                    outlineColor: '#ffffff',
                    outlineWidth: 3,
                    shape: 'circle',
                    opacity: 1,
                    fillOpacity: 0.8
                }
            }));

            // تفريغ التحديد بعد الاستخراج
            setSelectedFeatures([]);
            setHighlightFeatures([]);
            
            alert(`✅ تم استخراج ${selectedFeatures.length} معلم في طبقة مستقلة بنجاح!`);
        } catch (err) {
            console.error("Bulk extraction error:", err);
        }
    };

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.code === 'Space' || e.keyCode === 32) {
                if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
                    e.preventDefault();
                    handleBulkExtract();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedFeatures]);

    const calculateArea = (coords) => {
        if (coords.length < 3) return 0;
        let area = 0;
        const R = 6378137; // Earth radius in meters
        const toRad = x => x * Math.PI / 180;
        for (let i = 0; i < coords.length; i++) {
            const p1 = coords[i];
            const p2 = coords[(i + 1) % coords.length];
            const x1 = toRad(p1[0]) * Math.cos(toRad(p1[1])) * R;
            const y1 = toRad(p1[1]) * R;
            const x2 = toRad(p2[0]) * Math.cos(toRad(p2[1])) * R;
            const y2 = toRad(p2[1]) * R;
            area += (x1 * y2 - x2 * y1);
        }
        return Math.abs(area / 2); // Sq meters
    };

    const calculateElevationProfile = (points) => {
        if (points.length < 2) return;
        const profile = [];
        const sampleCount = 40;
        let totalDistance = 0;
        const segmentDistances = [];
        for (let i = 1; i < points.length; i++) {
            const dist = haversineDistance(points[i-1], points[i]);
            segmentDistances.push(dist);
            totalDistance += dist;
        }
        
        const activeRaster = geoLayers.find(l => l.id === activeAsterLayerId);
        
        for (let s = 0; s <= sampleCount; s++) {
            const t = s / sampleCount;
            const distAlong = t * totalDistance;
            let currentDist = 0;
            let coord = points[0];
            for (let i = 0; i < segmentDistances.length; i++) {
                if (currentDist + segmentDistances[i] >= distAlong || i === segmentDistances.length - 1) {
                    const segmentT = segmentDistances[i] === 0 ? 0 : (distAlong - currentDist) / segmentDistances[i];
                    const p1 = points[i];
                    const p2 = points[i+1];
                    coord = [
                        p1[0] + (p2[0] - p1[0]) * segmentT,
                        p1[1] + (p2[1] - p1[1]) * segmentT
                    ];
                    break;
                }
                currentDist += segmentDistances[i];
            }
            
            let elev = 0;
            if (activeRaster && activeRaster.elevations) {
                const { west, south, east, north, gridWidth, gridHeight, elevations } = activeRaster;
                const pctX = (coord[0] - west) / (east - west);
                const pctY = (north - coord[1]) / (north - south);
                if (pctX >= 0 && pctX <= 1 && pctY >= 0 && pctY <= 1) {
                    const col = Math.floor(pctX * (gridWidth - 1));
                    const row = Math.floor(pctY * (gridHeight - 1));
                    const idx = row * gridWidth + col;
                    elev = elevations[idx] || 0;
                }
            } else {
                const freq1 = 15 / totalDistance || 0.01;
                const freq2 = 45 / totalDistance || 0.03;
                elev = 150 + Math.sin(distAlong * freq1) * 90 + Math.cos(distAlong * freq2) * 25;
            }
            profile.push({
                distance: Math.round(distAlong),
                elevation: Math.round(elev)
            });
        }
        setGisElevProfile(profile);
    };

    const handleMapClick = (e) => {
        const coord = [e.lngLat.lng, e.lngLat.lat];

        if (gisReverseGeocodingActive) {
            let closest = null;
            let minDist = Infinity;
            geoLayers.forEach(layer => {
                if (!layer.data?.features) return;
                layer.data.features.forEach(f => {
                    if (!f.geometry) return;
                    let fCoord = null;
                    if (f.geometry.type === 'Point') fCoord = f.geometry.coordinates;
                    else if (f.geometry.coordinates?.[0]?.[0]) fCoord = f.geometry.coordinates[0][0];
                    else if (f.geometry.coordinates?.[0]) fCoord = f.geometry.coordinates[0];
                    
                    if (fCoord) {
                        const dist = haversineDistance(coord, fCoord);
                        if (dist < minDist) {
                            minDist = dist;
                            closest = {
                                name: f.properties?.name || f.properties?.name_ar || f.properties?.title || 'معلم جغرافي',
                                category: layer.name
                            };
                        }
                    }
                });
            });
            setGisReverseGeocodingResult({
                lng: e.lngLat.lng,
                lat: e.lngLat.lat,
                closestName: closest ? closest.name : null,
                closestCategory: closest ? closest.category : null,
                distance: closest ? minDist : null
            });
            return;
        }

        if (drawingMode) {
            if (drawingMode === 'gis_measure') {
                setGisMeasurePoints(prev => {
                    const newPoints = [...prev, coord];
                    if (gisMeasureType === 'distance') {
                        let dist = 0;
                        for (let i = 1; i < newPoints.length; i++) {
                            dist += haversineDistance(newPoints[i-1], newPoints[i]);
                        }
                        setGisMeasureResult({ length: dist, area: 0 });
                    } else if (gisMeasureType === 'area') {
                        const areaVal = calculateArea(newPoints);
                        setGisMeasureResult({ length: 0, area: areaVal });
                    }
                    return newPoints;
                });
                return;
            }

            if (drawingMode === 'gis_buffer') {
                setGisBufferCenter(coord);
                const results = [];
                const radiusMeters = gisBufferRadius * 1000;
                geoLayers.forEach(layer => {
                    if (!layer.data?.features) return;
                    layer.data.features.forEach(f => {
                        if (!f.geometry) return;
                        let fCoord = null;
                        if (f.geometry.type === 'Point') fCoord = f.geometry.coordinates;
                        else if (f.geometry.coordinates?.[0]?.[0]) fCoord = f.geometry.coordinates[0][0];
                        else if (f.geometry.coordinates?.[0]) fCoord = f.geometry.coordinates[0];
                        
                        if (fCoord) {
                            const dist = haversineDistance(coord, fCoord);
                            if (dist <= radiusMeters) {
                                results.push({
                                    name: f.properties?.name || f.properties?.name_ar || f.properties?.title || 'معلم جغرافي',
                                    category: layer.name,
                                    distance: Math.round(dist)
                                });
                            }
                        }
                    });
                });
                setGisBufferResults(results.sort((a,b) => a.distance - b.distance));
                setDrawingMode(null);
                return;
            }

            if (drawingMode === 'gis_elevation') {
                setGisElevPoints(prev => {
                    const newPoints = [...prev, coord];
                    calculateElevationProfile(newPoints);
                    return newPoints;
                });
                return;
            }

            if (drawingMode === 'point') {
                const newFeature = { type: 'Feature', geometry: { type: 'Point', coordinates: coord }, properties: { type: 'drawn_point', name: 'نقطة محددة' } };
                const newLayerId = Date.now().toString();
                const defaultColor = ['#06D6F2', '#F5A623', '#10D9A0', '#8B5CF6', '#EC4899'][geoLayers.length % 5];

                setGeoLayers(prev => [...prev, {
                    id: newLayerId,
                    name: 'رسم (نقطة)',
                    data: { type: 'FeatureCollection', features: [newFeature] },
                    color: defaultColor
                }]);

                setLayerStyles(prev => ({
                    ...prev,
                    [newLayerId]: {
                        color: defaultColor,
                        outlineColor: '#ffffff',
                        outlineWidth: 2,
                        shape: 'circle',
                        opacity: 1,
                        fillOpacity: 0.3
                    }
                }));

                setDrawingMode(null);
            } else if (drawingMode === 'line' || drawingMode === 'measure' || drawingMode === 'polygon' || drawingMode === 'paldata_poly') {
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

        if (gisReverseGeocodingActive) {
            let nearestFeature = null;
            let minDistance = Infinity;
            
            geoLayers.forEach(layer => {
                if (!layer.data?.features) return;
                layer.data.features.forEach(f => {
                    if (!f.geometry) return;
                    let fCoord = null;
                    if (f.geometry.type === 'Point') fCoord = f.geometry.coordinates;
                    else if (f.geometry.coordinates?.[0]?.[0]) fCoord = f.geometry.coordinates[0][0];
                    else if (f.geometry.coordinates?.[0]) fCoord = f.geometry.coordinates[0];
                    
                    if (fCoord) {
                        const dist = haversineDistance(coord, fCoord);
                        if (dist < minDistance) {
                            minDistance = dist;
                            nearestFeature = {
                                name: f.properties?.name || f.properties?.name_ar || f.properties?.title || 'معلم تاريخي',
                                layerName: layer.name,
                                dist: dist
                            };
                        }
                    }
                });
            });
            
            setGisReverseGeocodingResult({
                lng: coord[0].toFixed(5),
                lat: coord[1].toFixed(5),
                nearest: nearestFeature ? `${nearestFeature.name} (${(nearestFeature.dist/1000).toFixed(2)} كم)` : 'لا توجد معالم قريبة في النطاق'
            });
            return;
        }

        // --- نظام تعقب الضغطات المتعددة ---
        clickCountRef.current += 1;
        if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
        
        clickTimerRef.current = setTimeout(() => {
            clickCountRef.current = 0;
        }, 450); // نافذة زمنية للضغط المتتالي

        if (stylePopup) setStylePopup(null);

        const map = mapRef.current?.getMap();
        if (map) {
            try {
                const bbox = [
                    [e.point.x - 5, e.point.y - 5],
                    [e.point.x + 5, e.point.y + 5]
                ];

                const features = map.queryRenderedFeatures(bbox);
                const myFeatures = features.filter(f =>
                    f.layer.id.startsWith('poly-') ||
                    f.layer.id.startsWith('line-') ||
                    f.layer.id.startsWith('point-') ||
                    f.layer.id.startsWith('drawn-')
                );

                if (myFeatures && myFeatures.length > 0) {
                    const clickedFeature = myFeatures[0];
                    const featureId = clickedFeature.id;
                    
                    // البحث عن المعلم الأصلي في geoLayers للحصول على أحدث الخصائص (بعد الربط)
                    let fullProperties = clickedFeature.properties || {};
                    const layerId = clickedFeature.layer.id;
                    let originalLayerId = null;
                    if (layerId.startsWith('poly-')) originalLayerId = layerId.replace('poly-', '');
                    else if (layerId.startsWith('line-')) originalLayerId = layerId.replace('line-', '');
                    else if (layerId.startsWith('point-')) originalLayerId = layerId.replace('point-', '');

                    if (originalLayerId) {
                        const targetLayer = geoLayers.find(l => l.id === originalLayerId);
                        if (targetLayer && targetLayer.data?.features) {
                            const originalFeature = targetLayer.data.features.find(f => f.id === featureId);
                            if (originalFeature) {
                                fullProperties = originalFeature.properties || {};
                            }
                        }
                    }
                    
                    // الحالة 1: الضغطة الثالثة (الاستخراج)
                    if (clickCountRef.current === 3) {
                        handleExtractFeature(clickedFeature);
                        clickCountRef.current = 0;
                        return;
                    }

                    // الحالة 2: الضغطة الأولى أو الثانية
                    setSelectedFeatureInfo({
                        properties: fullProperties,
                        longitude: e.lngLat.lng,
                        latitude: e.lngLat.lat,
                        layerId: originalLayerId || layerId,
                        featureId: featureId || JSON.stringify(clickedFeature.toJSON().geometry.coordinates)
                    });

                    // التحديد المتعدد
                    const featureJson = clickedFeature.toJSON();
                    // نستخدم نفس المعرف ID للاتساق
                    const fId = featureId || JSON.stringify(featureJson.geometry.coordinates);

                    setHighlightFeatures(prev => {
                        const exists = prev.find(f => (f.id || JSON.stringify(f.geometry.coordinates)) === fId);
                        if (exists) return prev.filter(f => (f.id || JSON.stringify(f.geometry.coordinates)) !== fId);
                        return [...prev, { ...featureJson, id: fId, properties: fullProperties }];
                    });

                    setSelectedFeatures(prev => {
                        const exists = prev.find(f => (f.id || JSON.stringify(f.geometry.coordinates)) === fId);
                        if (exists) return prev.filter(f => (f.id || JSON.stringify(f.geometry.coordinates)) !== fId);
                        return [...prev, { ...featureJson, id: fId, properties: fullProperties }];
                    });

                    if (originalLayerId) {
                        setActiveTableLayerId(originalLayerId);
                        setShowBottomTable(true);
                    }
                } else {
                    // Check for custom raster layers (like imported GeoTIFF or ASTER raster)
                    let clickedRasterFeature = null;
                    const rasterLayers = geoLayers.filter(l => l.isVisible && (l.type === 'raster' || l.id.endsWith('-raster')));
                    for (const rLayer of rasterLayers) {
                        const { west, south, east, north } = rLayer;
                        const lat = e.lngLat.lat;
                        const lng = e.lngLat.lng;
                        if (lng >= west && lng <= east && lat >= south && lat <= north) {
                            // Coordinates fall inside the raster bounds!
                            const w = rLayer.gridSize || rLayer.gridWidth;
                            const h = rLayer.gridHeight || w; // fallback to gridSize if square
                            
                            if (w && h) {
                                const scaleX = (east - west) / (w - 1);
                                const scaleY = (north - south) / (h - 1);
                                const col = Math.round((lng - west) / scaleX);
                                const row = Math.round((north - lat) / scaleY);
                                
                                if (col >= 0 && col < w && row >= 0 && row < h) {
                                    let elev = 0;
                                    if (rLayer.elevations) {
                                        elev = rLayer.elevations[row * w + col];
                                    } else if (rLayer.rawResults) {
                                        const resItem = rLayer.rawResults[row * w + col];
                                        elev = resItem ? (resItem.elevation || 0) : 0;
                                    }
                                    
                                    if (elev !== undefined) {
                                        clickedRasterFeature = {
                                            properties: {
                                                dataset: 'aster30m', // this triggers the elevation format in the Popup
                                                elevation: elev,
                                                name: rLayer.name
                                            },
                                            longitude: lng,
                                            latitude: lat
                                        };
                                        break;
                                    }
                                }
                            }
                        }
                    }

                    if (clickedRasterFeature) {
                        setSelectedFeatureInfo(clickedRasterFeature);
                    } else {
                        setSelectedFeatureInfo(null);
                        setHighlightFeatures([]);
                        setSelectedFeatures([]);
                    }
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

    const isFeatureMatchingTime = (f, yearVal) => {
        const props = f.properties || {};
        const yearKeys = ['year', 'date', 'historical_year', 'start_date', 'established', 'depopulation_year', 'occurrence_year'];
        for (let key of yearKeys) {
            if (props[key]) {
                const val = parseInt(props[key]);
                if (!isNaN(val) && val > yearVal) {
                    return false;
                }
            }
        }
        return true;
    };

    const filteredLayerData = useMemo(() => {
        return geoLayers.map(l => {
            if (!l.data) return l;
            if (!gisTimeActive && !gisFilterQuery && !gisFilterTag) return l;
            
            let features = l.data.features || [];
            
            if (gisTimeActive) {
                features = features.filter(f => isFeatureMatchingTime(f, gisTimeValue));
            }
            if (gisFilterQuery) {
                const q = gisFilterQuery.toLowerCase();
                features = features.filter(f => {
                    return Object.values(f.properties || {}).some(v => String(v).toLowerCase().includes(q));
                });
            }
            if (gisFilterTag) {
                features = features.filter(f => {
                    return f.properties && f.properties[gisFilterTag];
                });
            }
            return {
                ...l,
                data: {
                    ...l.data,
                    features
                }
            };
        });
    }, [geoLayers, gisTimeActive, gisTimeValue, gisFilterQuery, gisFilterTag]);

    const generateCirclePolygon = (center, radiusKm) => {
        const [lng, lat] = center;
        const points = [];
        const steps = 64;
        const R = 6378.1;
        const d = radiusKm / R;
        const latRad = lat * Math.PI / 180;
        const lngRad = lng * Math.PI / 180;
        
        for (let i = 0; i <= steps; i++) {
            const theta = (i / steps) * 2 * Math.PI;
            const pointLat = Math.asin(Math.sin(latRad) * Math.cos(d) + Math.cos(latRad) * Math.sin(d) * Math.cos(theta));
            const pointLng = lngRad + Math.atan2(Math.sin(theta) * Math.sin(d) * Math.cos(latRad), Math.cos(d) - Math.sin(latRad) * Math.sin(pointLat));
            points.push([pointLng * 180 / Math.PI, pointLat * 180 / Math.PI]);
        }
        return {
            type: 'Feature',
            geometry: {
                type: 'Polygon',
                coordinates: [points]
            },
            properties: {
                isBuffer: true
            }
        };
    };

    const gisMeasureGeoJson = useMemo(() => {
        if (gisMeasurePoints.length === 0) return null;
        if (gisMeasurePoints.length === 1) {
            return { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: gisMeasurePoints[0] } }] };
        }
        if (gisMeasureType === 'distance') {
            return {
                type: 'FeatureCollection',
                features: [
                    {
                        type: 'Feature',
                        geometry: {
                            type: 'LineString',
                            coordinates: gisMeasurePoints
                        }
                    },
                    ...gisMeasurePoints.map(p => ({
                        type: 'Feature',
                        geometry: { type: 'Point', coordinates: p }
                    }))
                ]
            };
        } else if (gisMeasureType === 'area') {
            const closedPoints = [...gisMeasurePoints];
            if (closedPoints.length >= 3) {
                closedPoints.push(closedPoints[0]);
            }
            return {
                type: 'FeatureCollection',
                features: [
                    {
                        type: 'Feature',
                        geometry: {
                            type: closedPoints.length >= 3 ? 'Polygon' : 'LineString',
                            coordinates: closedPoints.length >= 3 ? [closedPoints] : closedPoints
                        }
                    },
                    ...gisMeasurePoints.map(p => ({
                        type: 'Feature',
                        geometry: { type: 'Point', coordinates: p }
                    }))
                ]
            };
        }
        return null;
    }, [gisMeasurePoints, gisMeasureType]);

    const gisBufferGeoJson = useMemo(() => {
        if (!gisBufferCenter) return null;
        return {
            type: 'FeatureCollection',
            features: [generateCirclePolygon(gisBufferCenter, gisBufferRadius)]
        };
    }, [gisBufferCenter, gisBufferRadius]);

    const gisElevGeoJson = useMemo(() => {
        if (gisElevPoints.length === 0) return null;
        if (gisElevPoints.length === 1) {
            return { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: gisElevPoints[0] } }] };
        }
        return {
            type: 'FeatureCollection',
            features: [
                {
                    type: 'Feature',
                    geometry: {
                        type: 'LineString',
                        coordinates: gisElevPoints
                    }
                },
                ...gisElevPoints.map(p => ({
                    type: 'Feature',
                    geometry: { type: 'Point', coordinates: p }
                }))
            ]
        };
    }, [gisElevPoints]);

    const handlePrintMap = () => {
        setIsExportStudioOpen(true);
    };

    const performHDExport = async () => {
        if (!mapRef.current) return;
        setIsExportingMap(true);
        try {
            const map = mapRef.current.getMap();
            
            let targetWidth = 1920;
            let targetHeight = 1080;
            if (exportResolution === 'hd') {
                targetWidth = 2560;
                targetHeight = 1440;
            } else if (exportResolution === 'uhd') {
                targetWidth = 3840;
                targetHeight = 2160;
            } else if (exportResolution === 'standard') {
                const rect = map.getContainer().getBoundingClientRect();
                targetWidth = Math.round(rect.width);
                targetHeight = Math.round(rect.height);
            }

            const container = map.getContainer();
            const origWidth = container.style.width;
            const origHeight = container.style.height;
            const origPosition = container.style.position;

            container.style.width = targetWidth + 'px';
            container.style.height = targetHeight + 'px';
            container.style.position = 'fixed';
            container.style.zIndex = '99999';
            
            map.resize();

            await new Promise(resolve => setTimeout(resolve, 1500));

            map.triggerRepaint();
            await new Promise((resolve) => {
                if (map.loaded() && map.isIdle()) {
                    resolve();
                } else {
                    map.once('idle', resolve);
                }
            });

            const webglCanvas = map.getCanvas();
            
            const destCanvas = document.createElement('canvas');
            destCanvas.width = targetWidth;
            destCanvas.height = targetHeight;
            const ctx = destCanvas.getContext('2d');

            ctx.drawImage(webglCanvas, 0, 0, targetWidth, targetHeight);

            for (const layer of geoLayers) {
                const currentStyle = layerStyles[layer.id] || {};
                if (!currentStyle.heatmapEnabled && layer.data?.features) {
                    for (const f of layer.data.features) {
                        if (f.geometry?.type === 'Point' && (f.properties?.image || currentStyle.imageUrl)) {
                            const coords = f.geometry.coordinates;
                            const pos = map.project(coords);
                            const imageSrc = f.properties.image || currentStyle.imageUrl;
                            
                            try {
                                const img = await new Promise((resolve, reject) => {
                                    const image = new Image();
                                    image.crossOrigin = 'anonymous';
                                    image.onload = () => resolve(image);
                                    image.onerror = () => reject();
                                    image.src = imageSrc;
                                });
                                
                                ctx.save();
                                ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
                                ctx.shadowBlur = 10;
                                ctx.shadowOffsetX = 0;
                                ctx.shadowOffsetY = 4;
                                
                                const markerSize = exportResolution === 'uhd' ? 90 : exportResolution === 'hd' ? 60 : 40;
                                const radius = markerSize / 2;
                                
                                ctx.beginPath();
                                ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
                                ctx.fillStyle = '#ffffff';
                                ctx.fill();
                                
                                ctx.beginPath();
                                ctx.arc(pos.x, pos.y, radius - 3, 0, Math.PI * 2);
                                ctx.clip();
                                
                                ctx.drawImage(img, pos.x - radius, pos.y - radius, markerSize, markerSize);
                                ctx.restore();
                                
                                ctx.fillStyle = '#ffffff';
                                ctx.beginPath();
                                ctx.moveTo(pos.x - 6, pos.y + radius - 2);
                                ctx.lineTo(pos.x + 6, pos.y + radius - 2);
                                ctx.lineTo(pos.x, pos.y + radius + 6);
                                ctx.closePath();
                                ctx.fill();
                            } catch (err) {
                                console.error('Failed to load image for marker export:', imageSrc);
                            }
                        }
                    }
                }
            }

            container.style.width = origWidth;
            container.style.height = origHeight;
            container.style.position = origPosition;
            container.style.zIndex = '';
            map.resize();

            if (exportTitle) {
                const padding = targetWidth * 0.02;
                const cardWidth = targetWidth * 0.45;
                const cardHeight = targetHeight * 0.15;
                const cardX = padding;
                const cardY = padding;

                ctx.save();
                ctx.fillStyle = 'rgba(10, 22, 40, 0.85)';
                ctx.strokeStyle = 'rgba(6, 214, 242, 0.4)';
                ctx.lineWidth = exportResolution === 'uhd' ? 4 : 2;
                
                const roundRect = (x, y, w, h, r) => {
                    ctx.beginPath();
                    ctx.moveTo(x + r, y);
                    ctx.arcTo(x + w, y, x + w, y + h, r);
                    ctx.arcTo(x + w, y + h, x, y + h, r);
                    ctx.arcTo(x, y + h, x, y, r);
                    ctx.arcTo(x, y, x + w, y, r);
                    ctx.closePath();
                };
                
                roundRect(cardX, cardY, cardWidth, cardHeight, 12);
                ctx.fill();
                ctx.stroke();

                ctx.fillStyle = '#ffffff';
                ctx.font = `bold ${exportResolution === 'uhd' ? '32px' : exportResolution === 'hd' ? '22px' : '16px'} 'Cairo', sans-serif`;
                ctx.textAlign = 'right';
                ctx.textBaseline = 'top';
                ctx.fillText(exportTitle, cardX + cardWidth - 20, cardY + 20);

                ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
                ctx.font = `${exportResolution === 'uhd' ? '18px' : exportResolution === 'hd' ? '14px' : '11px'} 'Tajawal', sans-serif`;
                
                const wrapText = (text, x, y, maxWidth, lineHeight) => {
                    const words = text.split(' ');
                    let line = '';
                    let currentY = y;
                    for (let n = 0; n < words.length; n++) {
                        let testLine = line + words[n] + ' ';
                        let metrics = ctx.measureText(testLine);
                        if (metrics.width > maxWidth && n > 0) {
                            ctx.fillText(line, x, currentY);
                            line = words[n] + ' ';
                            currentY += lineHeight;
                        } else {
                            line = testLine;
                        }
                    }
                    ctx.fillText(line, x, currentY);
                };
                
                wrapText(
                    exportDesc, 
                    cardX + cardWidth - 20, 
                    cardY + (exportResolution === 'uhd' ? 70 : exportResolution === 'hd' ? 55 : 45), 
                    cardWidth - 40, 
                    exportResolution === 'uhd' ? 26 : exportResolution === 'hd' ? 20 : 15
                );
                
                ctx.restore();
            }

            if (exportIncludeLogo) {
                const padding = targetWidth * 0.02;
                const logoWidth = exportResolution === 'uhd' ? 320 : exportResolution === 'hd' ? 240 : 180;
                const logoHeight = exportResolution === 'uhd' ? 80 : exportResolution === 'hd' ? 60 : 45;
                const logoX = targetWidth - logoWidth - padding;
                const logoY = padding;

                ctx.save();
                ctx.fillStyle = 'rgba(10, 22, 40, 0.85)';
                ctx.strokeStyle = 'rgba(6, 214, 242, 0.4)';
                ctx.lineWidth = exportResolution === 'uhd' ? 4 : 2;

                const roundRect = (x, y, w, h, r) => {
                    ctx.beginPath();
                    ctx.moveTo(x + r, y);
                    ctx.arcTo(x + w, y, x + w, y + h, r);
                    ctx.arcTo(x + w, y + h, x, y + h, r);
                    ctx.arcTo(x, y + h, x, y, r);
                    ctx.arcTo(x, y, x + w, y, r);
                    ctx.closePath();
                };

                roundRect(logoX, logoY, logoWidth, logoHeight, 10);
                ctx.fill();
                ctx.stroke();

                const iconSize = logoHeight * 0.6;
                const iconX = logoX + 20;
                const iconY = logoY + (logoHeight - iconSize) / 2;

                ctx.strokeStyle = '#06D6F2';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(iconX + iconSize/2, iconY + iconSize/2, iconSize/2, 0, Math.PI*2);
                ctx.stroke();
                
                ctx.beginPath();
                ctx.moveTo(iconX, iconY + iconSize/2);
                ctx.lineTo(iconX + iconSize, iconY + iconSize/2);
                ctx.moveTo(iconX + iconSize/2, iconY);
                ctx.lineTo(iconX + iconSize/2, iconY + iconSize);
                ctx.stroke();
                
                ctx.fillStyle = '#fbab15';
                ctx.beginPath();
                ctx.arc(iconX + iconSize/2, iconY + iconSize/3, iconSize/4, 0, Math.PI, true);
                ctx.lineTo(iconX + iconSize/2, iconY + iconSize*0.8);
                ctx.closePath();
                ctx.fill();

                ctx.fillStyle = '#ffffff';
                ctx.font = `bold ${exportResolution === 'uhd' ? '22px' : exportResolution === 'hd' ? '16px' : '13px'} 'Cairo', sans-serif`;
                ctx.textAlign = 'right';
                ctx.fillText('PalNovaa Lab', logoX + logoWidth - 15, logoY + (logoHeight / 2) - (exportResolution === 'uhd' ? 4 : 2));

                ctx.fillStyle = '#fbab15';
                ctx.font = `bold ${exportResolution === 'uhd' ? '12px' : exportResolution === 'hd' ? '9px' : '8px'} 'Tajawal', sans-serif`;
                ctx.fillText('مختبر بال نوفا المتطور', logoX + logoWidth - 15, logoY + (logoHeight / 2) + (exportResolution === 'uhd' ? 18 : 12));

                ctx.restore();
            }

            if (exportIncludeLegend && geoLayers.length > 0) {
                const padding = targetWidth * 0.02;
                const legendWidth = exportResolution === 'uhd' ? 400 : exportResolution === 'hd' ? 300 : 220;
                
                let entryCount = 0;
                geoLayers.forEach(l => {
                    entryCount += 1;
                    const style = layerStyles[l.id];
                    if (style?.classification?.enabled && style.classification.colors) {
                        entryCount += Object.keys(style.classification.colors).length;
                    }
                });

                const lineHt = exportResolution === 'uhd' ? 32 : exportResolution === 'hd' ? 24 : 18;
                const legendHeight = (entryCount + 1.5) * lineHt + 30;
                const legendX = targetWidth - legendWidth - padding;
                const legendY = targetHeight - legendHeight - padding;

                ctx.save();
                ctx.fillStyle = 'rgba(10, 22, 40, 0.85)';
                ctx.strokeStyle = 'rgba(6, 214, 242, 0.4)';
                ctx.lineWidth = exportResolution === 'uhd' ? 4 : 2;

                const roundRect = (x, y, w, h, r) => {
                    ctx.beginPath();
                    ctx.moveTo(x + r, y);
                    ctx.arcTo(x + w, y, x + w, y + h, r);
                    ctx.arcTo(x + w, y + h, x, y + h, r);
                    ctx.arcTo(x, y + h, x, y, r);
                    ctx.arcTo(x, y, x + w, y, r);
                    ctx.closePath();
                };

                roundRect(legendX, legendY, legendWidth, legendHeight, 12);
                ctx.fill();
                ctx.stroke();

                ctx.fillStyle = '#fbab15';
                ctx.font = `bold ${exportResolution === 'uhd' ? '20px' : exportResolution === 'hd' ? '15px' : '12px'} 'Cairo', sans-serif`;
                ctx.textAlign = 'right';
                ctx.fillText('مفتاح الخريطة', legendX + legendWidth - 15, legendY + 20);

                let currentY = legendY + (exportResolution === 'uhd' ? 50 : exportResolution === 'hd' ? 40 : 30);
                
                geoLayers.forEach(layer => {
                    const style = layerStyles[layer.id] || {};
                    const isTable = layer.type === 'table';
                    if (isTable) return;

                    const layerColor = style.color || layer.color || '#10D9A0';
                    ctx.fillStyle = layerColor;
                    ctx.beginPath();
                    ctx.arc(legendX + legendWidth - 25, currentY + lineHt/2, exportResolution === 'uhd' ? 8 : exportResolution === 'hd' ? 6 : 4, 0, Math.PI*2);
                    ctx.fill();

                    ctx.fillStyle = '#ffffff';
                    ctx.font = `bold ${exportResolution === 'uhd' ? '16px' : exportResolution === 'hd' ? '12px' : '10px'} 'Cairo', sans-serif`;
                    ctx.textAlign = 'right';
                    ctx.fillText(layer.name, legendX + legendWidth - 40, currentY + 3);

                    currentY += lineHt;

                    if (style.classification?.enabled && style.classification.colors) {
                        Object.entries(style.classification.colors).forEach(([val, col]) => {
                            ctx.fillStyle = col;
                            ctx.beginPath();
                            ctx.arc(legendX + legendWidth - 45, currentY + lineHt/2, exportResolution === 'uhd' ? 6 : exportResolution === 'hd' ? 4.5 : 3, 0, Math.PI*2);
                            ctx.fill();

                            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
                            ctx.font = `${exportResolution === 'uhd' ? '14px' : exportResolution === 'hd' ? '10px' : '9px'} 'Tajawal', sans-serif`;
                            ctx.textAlign = 'right';
                            ctx.fillText(val || '(فارغ)', legendX + legendWidth - 60, currentY + 3);

                            currentY += lineHt;
                        });
                    }
                });

                ctx.restore();
            }

            const padding = targetWidth * 0.02;
            const scaleWidth = exportResolution === 'uhd' ? 200 : exportResolution === 'hd' ? 140 : 100;
            const scaleX = padding;
            const scaleY = targetHeight - padding - (exportResolution === 'uhd' ? 30 : exportResolution === 'hd' ? 20 : 15);

            ctx.save();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = exportResolution === 'uhd' ? 4 : 2;
            ctx.beginPath();
            ctx.moveTo(scaleX, scaleY);
            ctx.lineTo(scaleX, scaleY + (exportResolution === 'uhd' ? 15 : 10));
            ctx.lineTo(scaleX + scaleWidth, scaleY + (exportResolution === 'uhd' ? 15 : 10));
            ctx.lineTo(scaleX + scaleWidth, scaleY);
            ctx.stroke();

            ctx.fillStyle = '#ffffff';
            ctx.font = `${exportResolution === 'uhd' ? '14px' : exportResolution === 'hd' ? '10px' : '8px'} monospace`;
            ctx.textAlign = 'center';
            
            const zoom = map.getZoom();
            const metersPerPixel = 156543.03392 * Math.cos(32 * Math.PI / 180) / Math.pow(2, zoom);
            const scaleMeters = Math.round(scaleWidth * metersPerPixel);
            let scaleText = scaleMeters + ' م';
            if (scaleMeters >= 1000) {
                scaleText = (scaleMeters / 1000).toFixed(1) + ' كم';
            }
            ctx.fillText(scaleText, scaleX + scaleWidth/2, scaleY - 5);
            ctx.restore();

            const dataUrl = destCanvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = `PalNovaa_WebGIS_Premium_${Date.now()}.png`;
            link.href = dataUrl;
            link.click();

            alert('✅ تم تصميم وتصدير الخريطة بدقة فائقة الجودة واحترافية متناهية!');
            setIsExportStudioOpen(false);
        } catch (e) {
            console.error('HD Print Studio error:', e);
            alert('❌ عذراً، حدث خطأ أثناء تصميم وتصدير الخريطة. يرجى المحاولة مرة أخرى.');
        } finally {
            setIsExportingMap(false);
        }
    };

    const handleExportFilteredGeoJSON = () => {
        const activeId = activeTableLayerId;
        const activeLayer = geoLayers.find(l => l.id === activeId);
        if (!activeLayer || !activeLayer.data) {
            alert('❌ يرجى اختيار طبقة نشطة تحتوي على بيانات لتصديرها.');
            return;
        }
        const filteredData = filteredLayerData.find(l => l.id === activeId)?.data;
        if (!filteredData) return;
        
        const blob = new Blob([JSON.stringify(filteredData, null, 2)], { type: 'application/json' });
        const link = document.createElement('a');
        link.download = `Filtered_${activeLayer.name}_${Date.now()}.geojson`;
        link.href = URL.createObjectURL(blob);
        link.click();
    };

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

    const parseCSV = (text) => {
        const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
        if (lines.length < 2) return [];
        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        return lines.slice(1).map(line => {
            const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
            const obj = {};
            headers.forEach((h, i) => {
                obj[h] = values[i] || '';
            });
            return obj;
        });
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const isCsv = file.name.endsWith('.csv');
        const isTiff = file.name.endsWith('.tif') || file.name.endsWith('.tiff');
        const isZip = file.name.endsWith('.zip');

        if (isZip) {
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const shp = (await import('shpjs')).default;
                    const geojson = await shp(event.target.result);
                    
                    let normalizedGeojson = geojson;
                    if (Array.isArray(geojson)) {
                        normalizedGeojson = {
                            type: 'FeatureCollection',
                            features: geojson.flatMap(collection => collection.features || [])
                        };
                    }
                    
                    const newLayerId = `shp-${Date.now()}`;
                    const defaultColor = ['#06D6F2', '#F5A623', '#10D9A0', '#8B5CF6', '#EC4899'][geoLayers.length % 5];
                    
                    if (normalizedGeojson.features) {
                        normalizedGeojson.features = normalizedGeojson.features.map((f, idx) => ({
                            ...f,
                            id: f.id || `${newLayerId}_${idx}`
                        }));
                    }
                    
                    const newLayer = {
                        id: newLayerId,
                        name: file.name.replace(/\.[^/.]+$/, "").substring(0, 19),
                        data: normalizedGeojson,
                        color: defaultColor,
                        isVisible: true
                    };
                    
                    setGeoLayers(prev => [...prev, newLayer]);
                    setLayerStyles(prev => ({
                        ...prev,
                        [newLayerId]: {
                            color: defaultColor,
                            outlineColor: '#ffffff',
                            outlineWidth: 2,
                            shape: 'circle',
                            opacity: 1,
                            fillOpacity: 0.3
                        }
                    }));
                    setActiveTableLayerId(newLayerId);
                    setShowBottomTable(true);
                    
                    if (mapRef.current) {
                        const coordinates = [];
                        const extractCoords = (obj) => {
                            if (obj.type === 'FeatureCollection') obj.features.forEach(extractCoords);
                            else if (obj.geometry) extractCoords(obj.geometry);
                            else if (obj.coordinates) {
                                if (typeof obj.coordinates[0] === 'number') coordinates.push(obj.coordinates);
                                else obj.coordinates.forEach(c => {
                                    if (typeof c[0] === 'number') coordinates.push(c);
                                    else c.forEach(sub => {
                                        if (typeof sub[0] === 'number') coordinates.push(sub);
                                    });
                                });
                            }
                        };
                        extractCoords(normalizedGeojson);
                        if (coordinates.length > 0) {
                            let minLng = Infinity, maxLng = -Infinity;
                            let minLat = Infinity, maxLat = -Infinity;
                            for (let i = 0; i < coordinates.length; i++) {
                                const pt = coordinates[i];
                                if (pt[0] < minLng) minLng = pt[0];
                                if (pt[0] > maxLng) maxLng = pt[0];
                                if (pt[1] < minLat) minLat = pt[1];
                                if (pt[1] > maxLat) maxLat = pt[1];
                            }
                            mapRef.current.fitBounds(
                                [[minLng, minLat], [maxLng, maxLat]],
                                { padding: 80, duration: 2000 }
                            );
                        }
                    }
                    
                    alert(`✅ تم استيراد وتحويل ملف Shapefile/Geodatabase بنجاح!`);
                } catch (err) {
                    console.error("Failed to parse Shapefile/GDB Zip:", err);
                    alert("❌ فشل استيراد الملف المضغوط: يرجى التأكد من أنه ملف Shapefile ZIP صالح يحتوي على ملفات .shp و.dbf");
                }
            };
            reader.readAsArrayBuffer(file);
            return;
        }
        
        if (isTiff) {
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const parsed = await parseTiff(event.target.result);
                    const { width, height, scaleX, scaleY, west, north, elevations } = parsed;
                    
                    const south = north - (height - 1) * scaleY;
                    const east = west + (width - 1) * scaleX;
                    
                    let minElev = Infinity;
                    let maxElev = -Infinity;
                    for (let i = 0; i < elevations.length; i++) {
                        const val = elevations[i];
                        if (val < minElev) minElev = val;
                        if (val > maxElev) maxElev = val;
                    }
                    
                    const rasterData = generateDemRaster(elevations, width, south, west, north, east, 'classic', height);
                    const demData = generateTerrariumDem(elevations, width, south, west, north, east, height);
                    const newLayerId = `aster-${Date.now()}`;
                    const layerName = file.name.replace(/\.[^/.]+$/, "");
                    
                    const newLayer = {
                        id: `${newLayerId}-raster`,
                        name: `${layerName} (Raster)`,
                        type: 'raster',
                        url: rasterData.url,
                        demUrl: demData.url,
                        coordinates: rasterData.coordinates,
                        isRemoteSensing: true,
                        minElevation: minElev,
                        maxElevation: maxElev,
                        isVisible: true,
                        elevations: elevations, // Float32Array
                        gridWidth: width,
                        gridHeight: height,
                        south: south,
                        west: west,
                        north: north,
                        east: east,
                        colorRamp: 'classic'
                    };
                    
                    setGeoLayers(prev => [...prev, newLayer]);
                    
                    setLayerStyles(prev => ({
                        ...prev,
                        [newLayer.id]: {
                            opacity: 0.85,
                            isRemoteSensing: true,
                            minElevation: minElev,
                            maxElevation: maxElev
                        }
                    }));
                    
                    setActiveAsterLayerId(`${newLayerId}-raster`);
                    
                    // Zoom to the raster boundaries
                    if (mapRef.current) {
                        try {
                            const map = mapRef.current.getMap();
                            map.fitBounds(
                                [[west, south], [east, north]],
                                { padding: 80, duration: 2000 }
                            );
                        } catch (e) {
                            console.error('Fit bounds error for tiff:', e);
                        }
                    }

                    alert(`✅ تم استيراد راستر الارتفاعات GeoTIFF "${file.name}" بنجاح وجدولته على الخريطة!`);
                } catch (err) {
                    console.error("Failed to parse GeoTIFF:", err);
                    alert("❌ فشل استيراد ملف GeoTIFF: " + err.message);
                }
            };
            reader.readAsArrayBuffer(file);
            return;
        }

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                if (isCsv) {
                    const csvData = parseCSV(event.target.result);
                    if (csvData.length === 0) {
                        alert("ملف CSV فارغ أو غير صالح");
                        return;
                    }
                    const newLayerId = `csv-${Date.now()}`;
                    const newLayer = {
                        id: newLayerId,
                        name: file.name.substring(0, 19),
                        type: 'table',
                        data: csvData, // Array of objects
                        isVisible: false
                    };
                    setGeoLayers(prev => [...prev, newLayer]);
                    alert(`✅ تم تحميل جدول البيانات "${file.name}" بنجاح!`);
                    return;
                }

                let json;
                try {
                    json = JSON.parse(event.target.result);
                } catch (jsonErr) {
                    alert("❌ الملف المرفوع لا يحتوي على صيغة JSON صالحة. الرجاء التأكد من صحة الملف.");
                    return;
                }

                // تطبيع وتنسيق ملفات GeoJSON البسيطة أو الفردية إلى FeatureCollection
                if (json && !json.type) {
                    if (Array.isArray(json)) {
                        json = {
                            type: 'FeatureCollection',
                            features: json.map(f => f.type === 'Feature' ? f : { type: 'Feature', geometry: f, properties: {} })
                        };
                    }
                } else if (json && json.type && json.type !== 'FeatureCollection' && json.type !== 'Feature') {
                    if (['Point', 'MultiPoint', 'LineString', 'MultiLineString', 'Polygon', 'MultiPolygon', 'GeometryCollection'].includes(json.type)) {
                        json = {
                            type: 'FeatureCollection',
                            features: [{ type: 'Feature', geometry: json, properties: {} }]
                        };
                    }
                }

                if (json && (json.type === 'FeatureCollection' || json.type === 'Feature')) {
                    let geojsonData = json;
                    let dataUrl = null;
                    let uploadSuccess = false;

                    try {
                        // 1. طلب رابط رفع موقع مسبقاً من السيرفر لتخطي حدود الحجم
                        const presignedResponse = await api.post('/storage/presigned-url', {
                            fileName: file.name,
                            contentType: 'application/json'
                        });

                        if (presignedResponse.data && presignedResponse.data.success) {
                            const { uploadUrl, publicUrl } = presignedResponse.data;

                            // 2. الرفع المباشر إلى Cloudflare R2 باستخدام PUT بدون إرسال توكن المصادقة بالرأس
                            await axios.put(uploadUrl, json, {
                                headers: {
                                    'Content-Type': 'application/json'
                                }
                            });

                            dataUrl = publicUrl;
                            uploadSuccess = true;
                        }
                    } catch (uploadErr) {
                        console.warn("Could not upload geojson to Cloud Storage via presigned URL, falling back to local-only layer:", uploadErr);
                    }

                    const newLayerId = Date.now().toString();
                    const defaultColor = ['#06D6F2', '#F5A623', '#10D9A0', '#8B5CF6', '#EC4899'][geoLayers.length % 5];
                    
                    // تأكد من وجود معرفات فريدة لكل معلم
                    if (geojsonData.features) {
                        geojsonData.features = geojsonData.features.map((f, idx) => ({
                            ...f,
                            id: f.id || `${newLayerId}_${idx}`
                        }));
                    } else if (geojsonData.type === 'Feature') {
                        geojsonData = {
                            type: 'FeatureCollection',
                            features: [{ ...geojsonData, id: geojsonData.id || `${newLayerId}_0` }]
                        };
                    }

                    const newLayer = {
                        id: newLayerId,
                        name: file.name.substring(0, 19),
                        dataUrl: dataUrl,
                        data: geojsonData,
                        color: defaultColor,
                        isVisible: true
                    };
                    setGeoLayers(prev => [...prev, newLayer]);

                    setLayerStyles(prev => ({
                        ...prev,
                        [newLayerId]: {
                            color: defaultColor,
                            outlineColor: '#ffffff',
                            outlineWidth: 2,
                            shape: 'circle',
                            opacity: 1,
                            fillOpacity: 0.3
                        }
                    }));
                    setActiveTableLayerId(newLayerId);
                    setShowBottomTable(true);

                    // تركيز الخريطة وتكبيرها لتناسب حدود الطبقة
                    if (mapRef.current) {
                        try {
                            const coordinates = [];
                            const extractCoords = (obj) => {
                                if (obj.type === 'FeatureCollection') obj.features.forEach(extractCoords);
                                else if (obj.geometry) extractCoords(obj.geometry);
                                else if (obj.coordinates) {
                                    if (typeof obj.coordinates[0] === 'number') coordinates.push(obj.coordinates);
                                    else obj.coordinates.forEach(c => {
                                        if (typeof c[0] === 'number') coordinates.push(c);
                                        else c.forEach(sub => {
                                            if (typeof sub[0] === 'number') coordinates.push(sub);
                                        });
                                    });
                                }
                            };
                            extractCoords(geojsonData);
                            if (coordinates.length > 0) {
                                let minLng = Infinity, maxLng = -Infinity;
                                let minLat = Infinity, maxLat = -Infinity;
                                for (let i = 0; i < coordinates.length; i++) {
                                    const pt = coordinates[i];
                                    if (pt[0] < minLng) minLng = pt[0];
                                    if (pt[0] > maxLng) maxLng = pt[0];
                                    if (pt[1] < minLat) minLat = pt[1];
                                    if (pt[1] > maxLat) maxLat = pt[1];
                                }
                                mapRef.current.fitBounds(
                                    [[minLng, minLat], [maxLng, maxLat]],
                                    { padding: 80, duration: 2000 }
                                );
                            }
                        } catch (e) { console.error('Fit bounds error', e); }
                    }

                    if (uploadSuccess) {
                        alert(`✅ تم استيراد وتحميل ملف GeoJSON "${file.name}" بنجاح!`);
                    } else {
                        alert(`⚠️ تم تحميل ملف GeoJSON "${file.name}" محلياً بنجاح! (تعذر حفظ النسخة السحابية لضخامة الحجم أو عطل الاتصال)`);
                    }
                } else {
                    alert("❌ صيغة ملف GeoJSON غير مدعومة (يجب أن يكون FeatureCollection أو Feature أو Geometry صالحة)");
                }
            } catch (err) {
                console.error("Upload error:", err);
                alert("حدث خطأ أثناء معالجة الملف");
            }
        };
        reader.readAsText(file);
    };

    const handlePerformJoin = () => {
        if (!joinTargetLayerId || !selectedCsvLayerId || !joinKeyMap || !joinKeyCsv || selectedCsvFields.length === 0) {
            alert("الرجاء إكمال كافة إعدادات الربط");
            return;
        }

        setGeoLayers(prev => prev.map(layer => {
            if (layer.id === joinTargetLayerId) {
                const csvLayer = prev.find(l => l.id === selectedCsvLayerId);
                if (!csvLayer) return layer;

                const newFeatures = layer.data.features.map(feature => {
                    const keyValue = feature.properties[joinKeyMap];
                    // البحث عن الصف المطابق في CSV
                    const matchingRow = csvLayer.data.find(row => String(row[joinKeyCsv]) === String(keyValue));

                    if (matchingRow) {
                        const newProperties = { ...feature.properties };
                        selectedCsvFields.forEach(field => {
                            newProperties[field] = matchingRow[field];
                        });
                        return { ...feature, properties: newProperties };
                    }
                    return feature;
                });

                return {
                    ...layer,
                    data: { ...layer.data, features: newFeatures }
                };
            }
            return layer;
        }));

        setIsJoinModalOpen(false);
        alert(`✅ تم ربط ${selectedCsvFields.length} حقول بـ ${activeTableLayer.name} بنجاح!`);
    };

    const handleImportLink = async () => {
        if (!importLink) return;
        setIsImporting(true);
        try {
            let endpoint = '/storage/upload';
            let payload = { url: importLink };

            // إذا كان الرابط من ArcGIS
            if (importLink.includes('MapServer') || importLink.includes('FeatureServer')) {
                endpoint = '/storage/import-arcgis';
                payload = { arcgisUrl: importLink };
            }

            const response = await api.post(endpoint, payload);

            if (response.data.success) {
                const newLayerId = Date.now().toString();
                const defaultColor = ['#06D6F2', '#F5A623', '#10D9A0', '#8B5CF6', '#EC4899'][geoLayers.length % 5];
                setGeoLayers(prev => [...prev, {
                    id: newLayerId,
                    name: (response.data.name || 'طبقة مستوردة').substring(0, 19),
                    dataUrl: response.data.url,
                    data: response.data.geojson, // تخزين البيانات محلياً لمنع الأعطال
                    color: defaultColor
                }]);
                setImportLink('');
                alert('تم استيراد البيانات بنجاح!');

                // Fly to data if available in response
                if (response.data.geojson && mapRef.current) {
                    try {
                        const coordinates = [];
                        const extractCoords = (obj) => {
                            if (obj.type === 'FeatureCollection') obj.features.forEach(extractCoords);
                            else if (obj.geometry) extractCoords(obj.geometry);
                            else if (obj.coordinates) {
                                if (typeof obj.coordinates[0] === 'number') coordinates.push(obj.coordinates);
                                else obj.coordinates.forEach(c => {
                                    if (typeof c[0] === 'number') coordinates.push(c);
                                    else c.forEach(sub => {
                                        if (typeof sub[0] === 'number') coordinates.push(sub);
                                    });
                                });
                            }
                        };
                        extractCoords(response.data.geojson);
                        if (coordinates.length > 0) {
                            let minLng = Infinity, maxLng = -Infinity;
                            let minLat = Infinity, maxLat = -Infinity;
                            for (let i = 0; i < coordinates.length; i++) {
                                const pt = coordinates[i];
                                if (pt[0] < minLng) minLng = pt[0];
                                if (pt[0] > maxLng) maxLng = pt[0];
                                if (pt[1] < minLat) minLat = pt[1];
                                if (pt[1] > maxLat) maxLat = pt[1];
                            }
                            mapRef.current.fitBounds(
                                [[minLng, minLat], [maxLng, maxLat]],
                                { padding: 80, duration: 2000 }
                            );
                        }
                    } catch (e) { console.error('Fit bounds error', e); }
                }
            }
        } catch (err) {
            console.error("Import error:", err);
            alert("فشل استيراد الرابط. تأكد من صحة الرابط وصيغة البيانات.");
        } finally {
            setIsImporting(false);
        }
    };

    const handleHtmlFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setUploadedHtmlName(file.name);
        const reader = new FileReader();
        reader.onload = (event) => setUploadedHtmlContent(event.target.result);
        reader.readAsText(file);
    };

    const toggleInjectLayer = (id) => {
        setSelectedInjectLayers(prev =>
            prev.includes(id) ? prev.filter(lid => lid !== id) : [...prev, id]
        );
    };

    const uploadLayerToCloud = async (geojson, layerName) => {
        try {
            // 1. طلب رابط رفع موقع مسبقاً من السيرفر
            const presignedResponse = await api.post('/storage/presigned-url', {
                fileName: `${layerName || 'layer'}.geojson`,
                contentType: 'application/json'
            });

            if (presignedResponse.data && presignedResponse.data.success) {
                const { uploadUrl, publicUrl } = presignedResponse.data;

                // 2. الرفع المباشر إلى Cloudflare R2 باستخدام PUT بدون إرسال توكن المصادقة بالرأس
                await axios.put(uploadUrl, geojson, {
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                return publicUrl;
            }
            return null;
        } catch (err) {
            console.error("Cloud Upload Failed:", err);
            return null;
        }
    };

    const performInjection = async () => {
        if (!uploadedHtmlContent) return;
        
        setIsGenerating(true);
        const layersToInject = [];
        
        try {
            for (const layerId of selectedInjectLayers) {
                const layer = geoLayers.find(l => l.id === layerId);
                if (!layer) continue;
                
                let finalDataUrl = layer.dataUrl || layer.url;
                let rawData = layer.data;

                // If data is local and large, upload it to get a professional URL
                if (!finalDataUrl && rawData && JSON.stringify(rawData).length > 30000) {
                    finalDataUrl = await uploadLayerToCloud(rawData, layer.name);
                    rawData = null; // No need to embed if we have a URL
                }

                layersToInject.push({
                    ...layer,
                    data: rawData,
                    dataUrl: finalDataUrl,
                    style: layerStyles[layer.id] || {}
                });
            }
        } catch (err) {
            console.error("Injection preparation failed:", err);
        }


        if (layersToInject.length === 0) {
            alert('الرجاء اختيار طبقة واحدة على الأقل للحقن');
            setIsGenerating(false);
            return;
        }

        // Build a hyper-resilient injection script
        const injectionScript = `
<script id="palnovaa-injected-layers">
(function() {
    var INJECTED_LAYERS = ${JSON.stringify(layersToInject)};
    console.log('[PalNovaa] Starting injection for', INJECTED_LAYERS.length, 'layers');

    function injectIntoLeaflet(map, layer, geojson) {
        var style = layer.style || {};
        var color = style.color || layer.color || '#F5A623';
        console.log('[PalNovaa] Adding Leaflet layer:', layer.name);
        
        var lLayer = window.L.geoJSON(geojson, {
            style: function() {
                return { 
                    color: style.outlineColor || '#ffffff', 
                    weight: style.outlineWidth || 2, 
                    opacity: style.opacity || 1, 
                    fillOpacity: style.fillOpacity || 0.4, 
                    fillColor: color 
                };
            },
            pointToLayer: function(feature, latlng) {
                return window.L.circleMarker(latlng, { 
                    radius: 7, 
                    fillColor: color, 
                    color: style.outlineColor || '#ffffff', 
                    weight: style.outlineWidth || 2, 
                    opacity: style.opacity || 1, 
                    fillOpacity: style.fillOpacity || 0.4 
                });
            }
        }).addTo(map);

        var props = geojson.features[0] ? geojson.features[0].properties : {};
        if (Object.keys(props).length > 0) {
            lLayer.bindPopup(function(l) {
                var p = l.feature.properties;
                var h = '<div style="direction:rtl;text-align:right;font-family:sans-serif;padding:4px"><h4 style="margin:0 0 8px;color:#06D6F2">' + (layer.name || 'طبقة محقونة') + '</h4>';
                Object.keys(p).forEach(function(k){ if(p[k]) h += '<div style="font-size:0.85rem;margin-bottom:4px"><b>'+k+':</b> '+p[k]+'</div>'; });
                return h + '</div>';
            });
        }
        
        try {
            var bounds = lLayer.getBounds();
            if (bounds.isValid()) map.fitBounds(bounds, { padding: [50, 50] });
        } catch(e) { console.error('[PalNovaa] Bounds error:', e); }
    }

    function injectIntoMapLibre(map, layer, geojson) {
        console.log('[PalNovaa] Adding MapLibre layer:', layer.name);
        var sourceId = 'pn-' + Date.now() + '-' + Math.floor(Math.random()*1000);
        var style = layer.style || {};
        var color = style.color || layer.color || '#F5A623';

        map.addSource(sourceId, { type: 'geojson', data: geojson });
        var gtype = (geojson.features && geojson.features[0] && geojson.features[0].geometry) ? geojson.features[0].geometry.type : 'Point';
        
        if (gtype.includes('Polygon')) {
            map.addLayer({ id: sourceId+'-f', type: 'fill', source: sourceId, paint: { 'fill-color': color, 'fill-opacity': style.fillOpacity || 0.4 } });
            map.addLayer({ id: sourceId+'-l', type: 'line', source: sourceId, paint: { 'line-color': style.outlineColor || '#fff', 'line-width': style.outlineWidth || 2 } });
        } else if (gtype.includes('Line')) {
            map.addLayer({ id: sourceId+'-l', type: 'line', source: sourceId, paint: { 'line-color': color, 'line-width': (style.outlineWidth || 2) + 1 } });
        } else {
            map.addLayer({ id: sourceId+'-p', type: 'circle', source: sourceId, paint: { 'circle-radius': 7, 'circle-color': color, 'circle-stroke-width': style.outlineWidth || 2, 'circle-stroke-color': style.outlineColor || '#fff' } });
        }

        try {
            var coords = geojson.features.flatMap(function(f){ return f.geometry.type==='Point'?[f.geometry.coordinates]:f.geometry.coordinates.flat(5); });
            var lngs = coords.map(function(c){return c[0]}), lats = coords.map(function(c){return c[1]});
            map.fitBounds([[Math.min.apply(null,lngs),Math.min.apply(null,lats)],[Math.max.apply(null,lngs),Math.max.apply(null,lats)]], {padding:50});
        } catch(e){}
    }

    function startProcessing(map, type) {
        // إنشاء لوحة حالة مرئية للمستخدم
        var statusId = 'palnovaa-status-' + Date.now();
        var statusEl = document.createElement('div');
        statusEl.id = statusId;
        statusEl.style = 'position:fixed;bottom:20px;right:20px;background:rgba(30,41,59,0.9);color:white;padding:10px 15px;border-radius:8px;z-index:9999;font-family:sans-serif;font-size:12px;box-shadow:0 4px 12px rgba(0,0,0,0.2);display:flex;align-items:center;gap:10px;border:1px solid #06D6F2;';
        statusEl.innerHTML = '<div style="width:10px;height:10px;background:#06D6F2;border-radius:50%;animation:pulse 1s infinite"></div> جاري فحص الطبقات...';
        document.body.appendChild(statusEl);

        var styleSheet = document.createElement("style");
        styleSheet.innerText = "@keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.3; } 100% { opacity: 1; } }";
        document.head.appendChild(styleSheet);

        var serverOrigins = ['http://localhost:5001', 'https://agq-map.onrender.com'];

        function updateStatus(msg, success) {
            statusEl.innerHTML = '<div style="width:10px;height:10px;background:'+(success?'#10b981':'#ef4444')+';border-radius:50%;"></div> ' + msg;
            if (success) setTimeout(function(){ statusEl.style.opacity = '0'; setTimeout(function(){ statusEl.remove(); }, 1000); }, 3000);
        }

        INJECTED_LAYERS.forEach(function(layer, idx) {
            if (layer.dataUrl) {
                function tryFetch(originIdx) {
                    var proxyUrl = serverOrigins[originIdx] + '/api/storage/proxy?url=' + encodeURIComponent(layer.dataUrl);
                    console.log('[PalNovaa] Trying Proxy:', proxyUrl);
                    fetch(proxyUrl)
                        .then(function(r) {
                            if (!r.ok) throw new Error('Proxy failed');
                            return r.json();
                        })
                        .then(function(data) {
                            if (type === 'leaflet') injectIntoLeaflet(map, layer, data);
                            else injectIntoMapLibre(map, layer, data);
                            updateStatus('تم حقن ' + (layer.name || 'طبقة'), true);
                        })
                        .catch(function(err) {
                            if (originIdx < serverOrigins.length - 1) tryFetch(originIdx + 1);
                            else {
                                console.error('[PalNovaa] All proxies failed for:', layer.name);
                                updateStatus('فشل تحميل: ' + layer.name, false);
                            }
                        });
                }
                tryFetch(0);
            } else if (layer.data) {
                console.log('[PalNovaa] Using embedded data for:', layer.name);
                if (type === 'leaflet') injectIntoLeaflet(map, layer, layer.data);
                else injectIntoMapLibre(map, layer, layer.data);
                updateStatus('تم حقن ' + (layer.name || 'طبقة') + ' (مدمجة)', true);
            }
        });
    }

    function findMap(attempts) {
        var map = window.map;
        if (!map && window.L) {
            for (var k in window) { if (window[k] instanceof window.L.Map) { map = window[k]; break; } }
        }
        
        if (map) {
            console.log('[PalNovaa] Map found!');
            if (window.L && map instanceof window.L.Map) startProcessing(map, 'leaflet');
            else {
                if (map.loaded && map.loaded()) startProcessing(map, 'mapbox');
                else map.on('load', function(){ startProcessing(map, 'mapbox'); });
            }
        } else if (attempts < 15) {
            setTimeout(function(){ findMap(attempts + 1); }, 600);
        } else {
            console.error('[PalNovaa] Map object not found. Please ensure your map is global (window.map).');
        }
    }

    if (document.readyState === 'complete') findMap(0);
    else window.addEventListener('load', function(){ findMap(0); });
})();
<\/script>`;

        let newHtml = uploadedHtmlContent;
        if (newHtml.includes('</body>')) {
            newHtml = newHtml.replace('</body>', injectionScript + '\n</body>');
        } else if (newHtml.includes('</html>')) {
            newHtml = newHtml.replace('</html>', injectionScript + '\n</html>');
        } else {
            newHtml += injectionScript;
        }

        const blob = new Blob([newHtml], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `CloudInjected_${uploadedHtmlName}`;
        a.click();
        URL.revokeObjectURL(url);
        setIsGenerating(false);
    };

    const launchDesignStudioFinal = () => {
        console.log("FORCE LAUNCH: Design Studio");
        setIsDesignStudioOpen(true);
    };

    const handleMagicGenerate = async () => {
        if (!magicPromptText.trim()) return;
        setIsGenerating(true);
        try {
            const response = await api.post('/ai/generate-design', {
                prompt: magicPromptText
            });

            const data = response.data;
            if (data.selections) {
                setDesignSelections(prev => ({ ...prev, ...data.selections }));
            }
            if (data.elements) {
                setPageElements(data.elements);
            }
            setIsMagicPromptOpen(false);
            setMagicPromptText('');

            // Show a success notification or toast (mocked for now)
            alert('تم توليد التصميم الإبداعي بنجاح!');
        } catch (err) {
            console.error('Magic generate failed:', err);
            const errMsg = err.response?.data?.error || err.message;
            alert(`عذراً، فشل المحرك في توليد التصميم.\nالسبب: ${errMsg}`);
        } finally {
            setIsGenerating(false);
        }
    };

    const handlePublishDesign = async () => {
        await handleSaveDesign('published');
    };

    const handleSaveDesign = async (status = 'draft') => {
        if (!publishName || !publishSlug) {
            setIsPublishModalOpen(true);
            return;
        }

        setIsPublishing(true);
        try {
            const response = await api.post('/pages/save', {
                name: publishName,
                slug: publishSlug,
                status: status,
                config: {
                    selections: designSelections,
                    elements: pageElements,
                    geoLayers: geoLayers,
                    layerStyles: layerStyles
                }
            });

            if (response.data.success) {
                if (status === 'published') {
                    alert(`مبروك! تم نشر صفحتك بنجاح.\nيمكنك الوصول إليها عبر الرابط: ${window.location.origin}/p/${publishSlug}`);
                    setIsPublishModalOpen(false);
                } else {
                    alert('تم حفظ المسودة بنجاح! يمكنك العودة إليها لاحقاً من ملفك الشخصي.');
                }
            }
        } catch (err) {
            console.error('Save failed:', err);
            const errMsg = err.response?.data?.error || err.message;
            alert(`فشل العملية: ${errMsg}`);
        } finally {
            setIsPublishing(false);
        }
    };

    const performActualExport = async (isZip = false) => {
        if (designSelections.commercialTemplate === 'tourism') {
            const tourismHtml = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>منصة حجز السياحة الفلسطينية - Palestine Tourism</title>

    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=Tajawal:wght@400;600;700;800&display=swap" rel="stylesheet">

    <!-- Leaflet JS & CSS -->
    <link
      rel="stylesheet"
      href="https://unpkg.com/leaflet@1.8.0/dist/leaflet.css"
      integrity="sha512-hoalWLoI8r4UszCkZ5kL8vayOGVae1oxXe/2A4AO6J9+580uKHDO3JdHb7NzwwzK5xr/Fs0W40kiNHxM9vyTtQ=="
      crossorigin=""
    />
    <script
      src="https://unpkg.com/leaflet@1.8.0/dist/leaflet.js"
      integrity="sha512-BB3hKbKWOc9Ez/TAwyWxNXeoV9c1v6FIeYiBieIWkpLjauysF18NzgR1MBNBXf8/KABdlkX68nAhlwcDFLGPCQ=="
      crossorigin=""
    ></script>

    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
    <link rel="stylesheet" href="css/style.css" />
    <script defer src="js/app.js"></script>
  </head>
  <body>
    <!-- App Container -->
    <div class="app-container">
      
      <!-- Top Header -->
      <header class="app-header">
        <div class="logo-area">
          <i class="fa-solid fa-hotel logo-icon"></i>
          <h1 class="logo-title">استكشف <span class="logo-accent">فلسطين</span></h1>
        </div>
        <p class="logo-subtitle">بوابتك لحجز الفنادق وأماكن الإقامة والوجبات التراثية</p>
      </header>

      <!-- Main Layout -->
      <main class="main-content">
        
        <!-- SEARCH VIEW -->
        <section id="homepage" class="view-section">
          <div class="glass-card search-card">
            <h2 class="section-title"><i class="fa-solid fa-magnifying-glass"></i> ابحث عن إقامتك القادمة</h2>
            
            <div class="form-grid">
              <div class="form-group">
                <label for="checkIn"><i class="fa-regular fa-calendar-check"></i> تاريخ الوصول</label>
                <input type="date" id="checkIn" class="form-control" required>
              </div>

              <div class="form-group">
                <label for="checkOut"><i class="fa-regular fa-calendar-minus"></i> تاريخ المغادرة</label>
                <input type="date" id="checkOut" class="form-control" required>
              </div>

              <div class="form-group">
                <label for="guests"><i class="fa-solid fa-users"></i> عدد الضيوف</label>
                <select id="guests" class="form-control">
                  <option value="1">ضابط واحد (1 Guest)</option>
                  <option value="2" selected>ضيفان (2 Guests)</option>
                  <option value="3">3 ضيوف (3 Guests)</option>
                  <option value="4">4 ضيوف (4 Guests)</option>
                </select>
              </div>
            </div>

            <div class="search-btn-wrapper">
              <button id="search-btn" class="btn btn-primary btn-glow">🔍 ابحث عن العروض المتاحة</button>
            </div>
            
            <div id="noResult" class="error-message"></div>
          </div>
        </section>

        <!-- ACCOMMODATION OPTIONS -->
        <section id="accommodation-options" class="view-section hidden">
          <div class="section-header">
            <button class="btn btn-secondary back-to-search"><i class="fa-solid fa-arrow-right"></i> تعديل البحث</button>
            <h2 class="section-title">العروض المتوفرة لرحلتك</h2>
          </div>
          
          <div id="cardResult" class="cards-grid">
            <!-- Cards will be injected by JavaScript -->
          </div>
        </section>

        <!-- ACCOMMODATION DETAILS & BOOKING -->
        <section id="accommodation-details" class="view-section hidden">
          <div class="section-header">
            <button class="btn btn-secondary back-to-options"><i class="fa-solid fa-arrow-right"></i> العودة للنتائج</button>
            <h2 class="section-title" id="hotel-detail-title">تفاصيل مكان الإقامة</h2>
          </div>

          <div class="details-grid">
            
            <!-- Left Side: Info, facilities and pricing -->
            <div class="details-left">
              <div class="glass-card">
                <h3 class="hotel-title" id="detail-name">اسم الفندق</h3>
                <p class="hotel-address" id="detail-address"><i class="fa-solid fa-location-dot"></i> العنوان</p>
                <hr class="divider">
                <p class="hotel-desc" id="detail-description">الوصف المفصل...</p>
              </div>

              <!-- Facilities -->
              <div class="glass-card mt-4">
                <h3 class="card-subtitle"><i class="fa-solid fa-star"></i> الخدمات والمرافق المتوفرة</h3>
                <div class="facilities-grid">
                  <div class="facility-item"><i class="fa-solid fa-wifi"></i> إنترنت لاسلكي مجاني</div>
                  <div class="facility-item"><i class="fa-solid fa-snowflake"></i> تكييف هواء مركزي</div>
                  <div class="facility-item"><i class="fa-solid fa-tv"></i> شاشة تلفاز ذكية</div>
                  <div class="facility-item"><i class="fa-solid fa-parking"></i> موقف سيارات آمن</div>
                  <div class="facility-item"><i class="fa-solid fa-mug-hot"></i> ماكينة قهوة وشاي</div>
                  <div class="facility-item"><i class="fa-solid fa-concierge-bell"></i> خدمة غرف 24 ساعة</div>
                </div>
              </div>

              <!-- Booking Summary / Pricing Sheet -->
              <div class="glass-card mt-4 pricing-card">
                <h3 class="card-subtitle"><i class="fa-solid fa-file-invoice-dollar"></i> ملخص وتكلفة الحجز</h3>
                <div class="summary-details">
                  <div class="summary-row">
                    <span>تاريخ الوصول:</span>
                    <strong id="summary-checkin">-</strong>
                  </div>
                  <div class="summary-row">
                    <span>تاريخ المغادرة:</span>
                    <strong id="summary-checkout">-</strong>
                  </div>
                  <div class="summary-row">
                    <span>عدد الضيوف:</span>
                    <strong id="summary-guests">-</strong>
                  </div>
                  <div class="summary-row">
                    <span>عدد الليالي:</span>
                    <strong id="summary-nights">-</strong>
                  </div>
                </div>
                
                <hr class="divider">
                
                <!-- Meal upgrades -->
                <h4 class="meals-title"><i class="fa-solid fa-utensils"></i> ترقية وجبات الطعام (اختياري)</h4>
                <div class="meals-options">
                  <label class="checkbox-container">
                    <input type="checkbox" id="meal-breakfast">
                    <span class="checkmark"></span>
                    فطور فلسطيني تقليدي (حمص، فلافل، زيت وزعتر) - <strong>₪30</strong> لكل ليلة/ضيف
                  </label>
                  <label class="checkbox-container">
                    <input type="checkbox" id="meal-lunch">
                    <span class="checkmark"></span>
                    غداء فلسطيني أصيل (مسخن، منسف أو مقلوبة) - <strong>₪70</strong> لكل ليلة/ضيف
                  </label>
                  <label class="checkbox-container">
                    <input type="checkbox" id="meal-dinner">
                    <span class="checkmark"></span>
                    عشاء محلي خفيف - <strong>₪40</strong> لكل ليلة/ضيف
                  </label>
                </div>

                <hr class="divider">

                <div class="pricing-table">
                  <div class="price-row">
                    <span>سعر الليلة الأساسي:</span>
                    <span id="price-per-night">₪0</span>
                  </div>
                  <div class="price-row">
                    <span>إجمالي الإقامة:</span>
                    <span id="subtotal-result">₪0</span>
                  </div>
                  <div class="price-row">
                    <span>ضريبة القيمة المضافة (16%):</span>
                    <span id="vat-result">₪0</span>
                  </div>
                  <div class="price-row total-row">
                    <span>المجموع النهائي:</span>
                    <span id="total-result" class="total-text">₪0</span>
                  </div>
                </div>

                <button id="book-btn" class="btn btn-primary w-100 mt-4 btn-glow"><i class="fa-solid fa-circle-check"></i> تأكيد وحجز الرحلة الآن</button>
              </div>
            </div>

            <!-- Right Side: Carousel and Leaflet Map -->
            <div class="details-right">
              <!-- Carousel -->
              <div class="glass-card p-0 overflow-hidden carousel-wrapper">
                <div class="carousel">
                  <div class="carousel-inner" id="carousel-inner">
                    <!-- Slides injected dynamically -->
                  </div>
                  <button class="carousel-control prev" id="carousel-prev"><i class="fa-solid fa-chevron-right"></i></button>
                  <button class="carousel-control next" id="carousel-next"><i class="fa-solid fa-chevron-left"></i></button>
                </div>
              </div>

              <!-- Interactive Map -->
              <div class="glass-card mt-4 p-0 overflow-hidden map-wrapper">
                <div class="map-title-bar">
                  <span><i class="fa-solid fa-map-location-dot"></i> موقع مكان الإقامة على خريطة فلسطين</span>
                </div>
                <div id="map"></div>
              </div>
            </div>

          </div>
        </section>

        <!-- BOOKING CONFIRMATION -->
        <section id="booking-confirmation" class="view-section hidden">
          <div class="glass-card confirmation-card">
            <div class="success-icon-wrapper">
              <i class="fa-solid fa-circle-check success-icon"></i>
            </div>
            
            <h2 class="confirmation-title">تهانينا! تم حجز رحلتك بنجاح</h2>
            <p class="confirmation-subtitle">أهلاً بك في أرض فلسطين التراثية والتاريخية</p>
            
            <div class="reservation-box">
              <span class="res-label">رمز تأكيد الحجز الخاص بك:</span>
              <strong id="reservation-code" class="res-code">#PAL-000000</strong>
            </div>

            <hr class="divider">

            <div class="itinerary-send-box">
              <p class="itinerary-desc"><i class="fa-regular fa-paper-plane"></i> أدخل بريدك الإلكتروني لإرسال تفاصيل خطة السفر الفاتورة فوراً:</p>
              
              <div class="email-input-group">
                <input type="email" id="emailInput" class="form-control" placeholder="example@domain.com">
                <button id="send-btn" class="btn btn-primary">إرسال الفاتورة</button>
              </div>
              <div id="emailConfirmation" class="email-status"></div>
            </div>

            <div class="confirmation-actions">
              <button id="new-booking-btn" class="btn btn-secondary"><i class="fa-solid fa-rotate-left"></i> القيام بحجز جديد</button>
            </div>
          </div>
        </section>

      </main>

      <!-- App Footer -->
      <footer class="app-footer">
        <p>منصة حجز السياحة الفلسطينية &copy; تصميم وتطوير بال نوفا - استوديو التصميم المتكامل</p>
      </footer>
    </div>
  </body>
</html>`;
            const tourismStyleCss = `:root {
  --color-primary: #10B981; /* Palestine Green */
  --color-secondary: #EF4444; /* Palestine Red */
  --color-dark-1: #090d16;
  --color-dark-2: #121824;
  --color-dark-3: #1e293b;
  --color-light: #f8fafc;
  --color-light-muted: #94a3b8;
  --font-main: 'Tajawal', sans-serif;
  --font-logo: 'Cairo', sans-serif;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: var(--font-main);
  background-color: var(--color-dark-1);
  color: var(--color-light);
  line-height: 1.6;
  direction: rtl;
  min-height: 100vh;
  padding: 20px;
}

/* Glassmorphism Card Style */
.glass-card {
  background: rgba(18, 24, 36, 0.7);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 25px;
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3);
}

.app-container {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* Header */
.app-header {
  text-align: center;
  padding: 15px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.logo-area {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.logo-icon {
  font-size: 2.5rem;
  color: var(--color-primary);
  text-shadow: 0 0 15px rgba(16, 185, 129, 0.4);
}

.logo-title {
  font-family: var(--font-logo);
  font-size: 2.2rem;
  font-weight: 800;
}

.logo-accent {
  color: var(--color-secondary);
}

.logo-subtitle {
  font-size: 1.1rem;
  color: var(--color-light-muted);
  margin-top: 5px;
}

/* Layout */
.main-content {
  min-height: 60vh;
}

.view-section {
  transition: all 0.4s ease;
}

.hidden {
  display: none !important;
}

/* Forms */
.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-top: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--color-light-muted);
}

.form-control {
  width: 100%;
  padding: 12px 16px;
  background-color: var(--color-dark-1);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  color: #fff;
  font-family: inherit;
  font-size: 1.05rem;
  outline: none;
  transition: all 0.3s;
}

.form-control:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 8px rgba(16, 185, 129, 0.2);
}

select.form-control {
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-position: left 12px center;
  background-size: 16px;
  padding-left: 40px;
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 24px;
  font-family: inherit;
  font-size: 1.05rem;
  font-weight: 700;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  transition: all 0.3s;
  text-decoration: none;
}

.btn-primary {
  background-color: var(--color-primary);
  color: #fff;
}

.btn-primary:hover {
  background-color: #0d9488;
  transform: translateY(-2px);
}

.btn-secondary {
  background-color: var(--color-dark-3);
  color: var(--color-light);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.btn-secondary:hover {
  background-color: #334155;
  transform: translateY(-2px);
}

.btn-glow:hover {
  box-shadow: 0 0 15px rgba(16, 185, 129, 0.4);
}

.w-100 {
  width: 100%;
}

.mt-4 {
  margin-top: 1.5rem;
}

/* Search Area specific */
.search-card {
  max-width: 800px;
  margin: 0 auto;
}

.section-title {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 10px;
  color: #fff;
}

.search-btn-wrapper {
  margin-top: 25px;
  text-align: center;
}

.error-message {
  color: var(--color-secondary);
  font-weight: 700;
  font-size: 1.05rem;
  text-align: center;
  margin-top: 15px;
}

/* Cards Grid */
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 25px;
}

/* Hotel Card */
.hotel-card {
  background: var(--color-dark-2);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: all 0.3s ease;
}

.hotel-card:hover {
  transform: translateY(-6px);
  border-color: var(--color-primary);
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
}

.card-img-wrapper {
  height: 200px;
  width: 100%;
  position: relative;
  overflow: hidden;
}

.card-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: all 0.5s ease;
}

.hotel-card:hover .card-img {
  transform: scale(1.08);
}

.card-badge {
  position: absolute;
  top: 15px;
  right: 15px;
  background-color: var(--color-primary);
  color: #fff;
  padding: 4px 10px;
  border-radius: 5px;
  font-size: 0.85rem;
  font-weight: 700;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.4);
}

.card-info {
  padding: 20px;
  display: flex;
  flex-direction: column;
  flex-grow: 1;
}

.card-hotel-title {
  font-size: 1.25rem;
  font-weight: 800;
  color: #fff;
  margin-bottom: 5px;
}

.card-hotel-address {
  font-size: 0.95rem;
  color: var(--color-light-muted);
  margin-bottom: 15px;
}

.card-footer-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: auto;
  padding-top: 15px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.card-price {
  font-size: 1.2rem;
  font-weight: 800;
  color: var(--color-primary);
}

.card-price-sub {
  font-size: 0.85rem;
  color: var(--color-light-muted);
  font-weight: 400;
}

/* Details Grid */
.details-grid {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 25px;
}

@media (max-width: 900px) {
  .details-grid {
    grid-template-columns: 1fr;
  }
}

.details-left, .details-right {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.hotel-title {
  font-size: 1.8rem;
  font-weight: 800;
  color: #fff;
  margin-bottom: 5px;
}

.hotel-address {
  color: var(--color-light-muted);
  font-size: 1rem;
}

.divider {
  border: none;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  margin: 15px 0;
}

.hotel-desc {
  font-size: 1.05rem;
  color: var(--color-light-muted);
  line-height: 1.7;
}

.card-subtitle {
  font-size: 1.25rem;
  font-weight: 700;
  color: #fff;
  margin-bottom: 15px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.facilities-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 15px;
}

.facility-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 1rem;
  color: var(--color-light);
}

.facility-item i {
  color: var(--color-primary);
  font-size: 1.2rem;
}

/* Pricing and Meal Upgrades */
.pricing-card {
  border-left: 4px solid var(--color-primary);
}

.summary-details {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  font-size: 1rem;
}

.summary-row span {
  color: var(--color-light-muted);
}

.meals-title {
  font-size: 1.15rem;
  font-weight: 700;
  color: #fff;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.meals-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Custom Checkboxes */
.checkbox-container {
  display: block;
  position: relative;
  padding-right: 32px;
  margin-bottom: 4px;
  cursor: pointer;
  font-size: 0.95rem;
  user-select: none;
  color: var(--color-light);
}

.checkbox-container input {
  position: absolute;
  opacity: 0;
  cursor: pointer;
  height: 0;
  width: 0;
}

.checkmark {
  position: absolute;
  top: 3px;
  right: 0;
  height: 20px;
  width: 20px;
  background-color: var(--color-dark-1);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 4px;
}

.checkbox-container:hover input ~ .checkmark {
  background-color: var(--color-dark-3);
  border-color: var(--color-primary);
}

.checkbox-container input:checked ~ .checkmark {
  background-color: var(--color-primary);
  border-color: var(--color-primary);
}

.checkmark:after {
  content: "";
  position: absolute;
  display: none;
}

.checkbox-container input:checked ~ .checkmark:after {
  display: block;
}

.checkbox-container .checkmark:after {
  left: 6px;
  top: 2px;
  width: 5px;
  height: 10px;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.pricing-table {
  background-color: rgba(0, 0, 0, 0.15);
  padding: 15px;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.price-row {
  display: flex;
  justify-content: space-between;
  font-size: 1rem;
}

.price-row span:first-child {
  color: var(--color-light-muted);
}

.total-row {
  border-top: 1px dashed rgba(255, 255, 255, 0.15);
  padding-top: 10px;
  margin-top: 5px;
}

.total-row span:first-child {
  color: #fff;
  font-weight: 700;
}

.total-text {
  font-size: 1.4rem;
  font-weight: 800;
  color: var(--color-primary);
}

/* Carousel wrapper */
.carousel-wrapper {
  height: 300px;
  position: relative;
}

.carousel {
  position: relative;
  width: 100%;
  height: 100%;
}

.carousel-inner {
  width: 100%;
  height: 100%;
  display: flex;
  transition: transform 0.5s ease-in-out;
}

.carousel-item {
  min-width: 100%;
  height: 100%;
}

.carousel-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.carousel-control {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(18, 24, 36, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
  width: 40px;
  height: 40px;
  border-radius: 50%;
  color: #fff;
  font-size: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 5;
  transition: all 0.3s;
}

.carousel-control:hover {
  background: var(--color-primary);
  border-color: var(--color-primary);
}

.carousel-control.prev {
  right: 15px;
}

.carousel-control.next {
  left: 15px;
}

/* Map */
.map-wrapper {
  height: 300px;
  display: flex;
  flex-direction: column;
}

.map-title-bar {
  background-color: var(--color-dark-2);
  padding: 8px 15px;
  font-size: 0.9rem;
  font-weight: 700;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

#map {
  flex-grow: 1;
  width: 100%;
  z-index: 1;
  background-color: var(--color-dark-1);
}

/* Leaflet Custom Style */
.leaflet-popup .leaflet-popup-content-wrapper {
  background-color: var(--color-dark-2) !important;
  color: var(--color-light) !important;
  border-radius: 6px !important;
  font-family: var(--font-main) !important;
}
.leaflet-popup .leaflet-popup-tip {
  background-color: var(--color-dark-2) !important;
}

/* Confirmation Page */
.confirmation-card {
  max-width: 700px;
  margin: 40px auto;
  text-align: center;
  padding: 40px;
  border-top: 4px solid var(--color-primary);
}

.success-icon-wrapper {
  margin-bottom: 20px;
}

.success-icon {
  font-size: 4.5rem;
  color: var(--color-primary);
  filter: drop-shadow(0 0 10px rgba(16, 185, 129, 0.3));
}

.confirmation-title {
  font-family: var(--font-logo);
  font-size: 2rem;
  font-weight: 800;
  margin-bottom: 8px;
}

.confirmation-subtitle {
  color: var(--color-light-muted);
  font-size: 1.1rem;
  margin-bottom: 25px;
}

.reservation-box {
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.2);
  border-radius: 8px;
  padding: 15px;
  display: inline-flex;
  flex-direction: column;
  gap: 5px;
  margin-bottom: 25px;
}

.res-label {
  font-size: 0.95rem;
  color: var(--color-light-muted);
}

.res-code {
  font-size: 1.8rem;
  color: var(--color-primary);
  font-family: monospace;
  letter-spacing: 2px;
}

.itinerary-send-box {
  background-color: rgba(255, 255, 255, 0.02);
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 30px;
  text-align: right;
}

.itinerary-desc {
  font-size: 1rem;
  margin-bottom: 12px;
}

.email-input-group {
  display: flex;
  gap: 10px;
}

.email-input-group .form-control {
  flex-grow: 1;
}

.email-status {
  font-size: 0.95rem;
  margin-top: 10px;
  font-weight: 700;
}

.email-success {
  color: var(--color-primary);
}

.email-error {
  color: var(--color-secondary);
}

.confirmation-actions {
  display: flex;
  justify-content: center;
}

/* Footer */
.app-footer {
  text-align: center;
  padding: 20px 0;
  color: var(--color-light-muted);
  font-size: 0.9rem;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}
`;
            const tourismAppJs = `"use strict";

// Accommodations Array of Objects (Palestine Tourism)
const accommodations = [
  {
    id: 101,
    name: "نزل القدس العتيق (Jerusalem Heritage Hostel)",
    description: "نزل عريق يقع في قلب البلدة القديمة بالقدس. يقدم تجربة تراثية أصيلة للرحالة والمسافرين الأفراد بالقرب من المسجد الأقصى وكنيسة القيامة والأسواق التاريخية.",
    address: "البلدة القديمة، القدس",
    price: 100,
    badge: "الأكثر طلباً 🏛️",
    image: "https://images.unsplash.com/photo-1549144511-f099e773c147?auto=format&fit=crop&w=600&q=80",
    carousel1: "https://images.unsplash.com/photo-1565008447742-97f6f38c985c?auto=format&fit=crop&w=600&q=80",
    carousel2: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=600&q=80",
    carousel3: "https://images.unsplash.com/photo-1601918774946-25832a4be0d6?auto=format&fit=crop&w=600&q=80",
    latitude: 31.7780,
    longitude: 35.2354,
    minGuests: 1,
    maxGuests: 1,
    minDays: 1,
    maxDays: 10
  },
  {
    id: 102,
    name: "فندق قصر الجاسر التاريخي (Jacir Palace Bethlehem)",
    description: "فندق تاريخي فاخر ذو تصنيف 5 نجوم في بيت لحم، يعكس رقي العمارة الفلسطينية الكلاسيكية ويقدم خدمات متميزة، ويبعد دقائق معدودة عن كنيسة المهد.",
    address: "شارع القدس الخليل، بيت لحم",
    price: 550,
    badge: "فاخر وتاريخي ✨",
    image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=600&q=80",
    carousel1: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=600&q=80",
    carousel2: "https://images.unsplash.com/photo-1584132967334-10e028bd69f7?auto=format&fit=crop&w=600&q=80",
    carousel3: "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=600&q=80",
    latitude: 31.7161,
    longitude: 35.2033,
    minGuests: 2,
    maxGuests: 4,
    minDays: 3,
    maxDays: 10
  },
  {
    id: 103,
    name: "منتجع وواحة أريحا (Jericho Oasis Resort)",
    description: "منتجع فاخر للاستجمام في أقدم مدينة في التاريخ. يوفر مسبحاً واسعاً، ومناظر خلابة على جبل التجربة وقريب جداً من البحر الميت، وهو مثالي للعائلات الباحثة عن الراحة.",
    address: "شارع قصر هشام، أريحا",
    price: 350,
    badge: "استجمام وعائلي 🌴",
    image: "https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=600&q=80",
    carousel1: "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=600&q=80",
    carousel2: "https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=600&q=80",
    carousel3: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=600&q=80",
    latitude: 31.8560,
    longitude: 35.4630,
    minGuests: 1,
    maxGuests: 2,
    minDays: 2,
    maxDays: 10
  },
  {
    id: 104,
    name: "أجنحة رام الله الفندقية (Ramallah Executive Suites)",
    description: "أجنحة عصرية فاخرة تقع في أرقى أحياء رام الله. مثالية لرجال الأعمال والسياح الباحثين عن إقامة متكاملة مع مطبخ مجهز وموقع مركزي قريب من الخدمات والمطاعم.",
    address: "حي الماصيون، رام الله",
    price: 450,
    badge: "عصري ومركزي 💼",
    image: "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=600&q=80",
    carousel1: "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=600&q=80",
    carousel2: "https://images.unsplash.com/photo-1568495248636-6432b97bd949?auto=format&fit=crop&w=600&q=80",
    carousel3: "https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?auto=format&fit=crop&w=600&q=80",
    latitude: 31.9029,
    longitude: 35.2032,
    minGuests: 1,
    maxGuests: 4,
    minDays: 2,
    maxDays: 15
  }
];

// UI selectors
const inputCheckIn = document.getElementById("checkIn");
const inputCheckOut = document.getElementById("checkOut");
const inputGuests = document.getElementById("guests");
const searchBtn = document.getElementById("search-btn");
const cardResult = document.getElementById("cardResult");
const noResult = document.getElementById("noResult");

const viewHomepage = document.getElementById("homepage");
const viewOptions = document.getElementById("accommodation-options");
const viewDetails = document.getElementById("accommodation-details");
const viewConfirmation = document.getElementById("booking-confirmation");

// Subtotals and calculation nodes
const summaryCheckin = document.getElementById("summary-checkin");
const summaryCheckout = document.getElementById("summary-checkout");
const summaryGuests = document.getElementById("summary-guests");
const summaryNights = document.getElementById("summary-nights");

const pricePerNight = document.getElementById("price-per-night");
const subtotalResult = document.getElementById("subtotal-result");
const vatResult = document.getElementById("vat-result");
const totalResult = document.getElementById("total-result");

// Meal Checkboxes
const chkBreakfast = document.getElementById("meal-breakfast");
const chkLunch = document.getElementById("meal-lunch");
const chkDinner = document.getElementById("meal-dinner");

// Map variable
let map;
let mapMarker;

// App state variables
let selectedHotel = null;
let currentNights = 0;
let currentGuests = 1;
let currentCarouselIndex = 0;

// Setup check-in min date as today
const today = new Date();
const formattedToday = today.toISOString().split("T")[0];
inputCheckIn.min = formattedToday;

// Set default dates
const tomorrow = new Date(today);
tomorrow.setDate(tomorrow.getDate() + 1);
inputCheckIn.value = formattedToday;
inputCheckOut.value = tomorrow.toISOString().split("T")[0];
inputCheckOut.min = tomorrow.toISOString().split("T")[0];

inputCheckIn.addEventListener("change", function() {
  const checkInDate = new Date(inputCheckIn.value);
  const nextDay = new Date(checkInDate);
  nextDay.setDate(nextDay.getDate() + 1);
  inputCheckOut.min = nextDay.toISOString().split("T")[0];
  if (new Date(inputCheckOut.value) <= checkInDate) {
    inputCheckOut.value = nextDay.toISOString().split("T")[0];
  }
});

// App Initiation
document.addEventListener("DOMContentLoaded", () => {
  initLeafletMap();
  setupEventListeners();
});

function initLeafletMap() {
  // Center of Palestine (Ramallah area)
  map = L.map("map").setView([31.9029, 35.2032], 10);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20
  }).addTo(map);
}

function setupEventListeners() {
  // Search Action
  searchBtn.addEventListener("click", performSearch);

  // Back Actions
  document.querySelectorAll(".back-to-search").forEach(btn => {
    btn.addEventListener("click", () => {
      showView(viewHomepage);
    });
  });

  document.querySelectorAll(".back-to-options").forEach(btn => {
    btn.addEventListener("click", () => {
      showView(viewOptions);
    });
  });

  // Calculate pricing dynamically when meal upgrades change
  [chkBreakfast, chkLunch, chkDinner].forEach(chk => {
    chk.addEventListener("change", calculatePrices);
  });

  // Confirm booking
  document.getElementById("book-btn").addEventListener("click", confirmBooking);

  // Send itinerary email
  document.getElementById("send-btn").addEventListener("click", sendItinerary);

  // New booking
  document.getElementById("new-booking-btn").addEventListener("click", () => {
    chkBreakfast.checked = false;
    chkLunch.checked = false;
    chkDinner.checked = false;
    showView(viewHomepage);
  });
}

function showView(view) {
  [viewHomepage, viewOptions, viewDetails, viewConfirmation].forEach(v => {
    v.classList.add("hidden");
  });
  view.classList.remove("hidden");
}

function performSearch() {
  noResult.innerText = "";
  
  const checkInVal = inputCheckIn.value;
  const checkOutVal = inputCheckOut.value;
  
  if (!checkInVal || !checkOutVal) {
    noResult.innerText = "يرجى اختيار تاريخ الوصول والمغادرة.";
    return;
  }
  
  const dateIn = new Date(checkInVal);
  const dateOut = new Date(checkOutVal);
  
  currentNights = Math.ceil((dateOut - dateIn) / (1000 * 60 * 60 * 24));
  currentGuests = parseInt(inputGuests.value);

  if (currentNights <= 0) {
    noResult.innerText = "تاريخ المغادرة يجب أن يكون بعد تاريخ الوصول.";
    return;
  }
  
  if (currentNights > 15) {
    noResult.innerText = "أقصى مدة للحجز هي 15 يوماً.";
    return;
  }

  // Filter accommodations
  const filtered = accommodations.filter(acc => {
    return currentGuests >= acc.minGuests && 
           currentGuests <= acc.maxGuests && 
           currentNights >= acc.minDays && 
           currentNights <= acc.maxDays;
  });

  cardResult.innerHTML = "";
  if (filtered.length === 0) {
    cardResult.innerHTML = '<div class="no-offers">لا توجد عروض تناسب اختياراتك (عدد الضيوف أو الليالي لا يطابق شروط الإقامة). حاول تغيير المعايير.</div>';
  } else {
    filtered.forEach(acc => {
      const card = document.createElement("div");
      card.className = "hotel-card";
      card.innerHTML = \`
        <div class="card-img-wrapper">
          <img src="\${acc.image}" alt="\${acc.name}" class="card-img">
          <span class="card-badge">\${acc.badge}</span>
        </div>
        <div class="card-info">
          <h3 class="card-hotel-title">\${acc.name}</h3>
          <p class="card-hotel-address"><i class="fa-solid fa-location-dot"></i> \${acc.address}</p>
          <div class="card-footer-row">
            <div class="card-price">₪\${acc.price} <span class="card-price-sub">/ ليلة</span></div>
            <button class="btn btn-primary select-hotel-btn" data-id="\${acc.id}">عرض التفاصيل</button>
          </div>
        </div>
      \`;
      cardResult.appendChild(card);
    });

    // Add select buttons event listeners
    document.querySelectorAll(".select-hotel-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const id = parseInt(e.target.dataset.id);
        openHotelDetails(id);
      });
    });
  }

  showView(viewOptions);
}

function openHotelDetails(hotelId) {
  selectedHotel = accommodations.find(acc => acc.id === hotelId);
  if (!selectedHotel) return;

  // Set textual details
  document.getElementById("detail-name").innerText = selectedHotel.name;
  document.getElementById("detail-address").innerHTML = \`<i class="fa-solid fa-location-dot"></i> \${selectedHotel.address}\`;
  document.getElementById("detail-description").innerHTML = selectedHotel.description;

  // Set booking summary details
  summaryCheckin.innerText = inputCheckIn.value;
  summaryCheckout.innerText = inputCheckOut.value;
  summaryGuests.innerText = \`\${currentGuests} ضيوف\`;
  summaryNights.innerText = \`\${currentNights} ليالي\`;

  pricePerNight.innerText = \`₪\${selectedHotel.price}\`;

  // Setup carousel
  const carouselInner = document.getElementById("carousel-inner");
  carouselInner.innerHTML = \`
    <div class="carousel-item"><img src="\${selectedHotel.image}" alt="\${selectedHotel.name}"></div>
    <div class="carousel-item"><img src="\${selectedHotel.carousel1}" alt="\${selectedHotel.name}"></div>
    <div class="carousel-item"><img src="\${selectedHotel.carousel2}" alt="\${selectedHotel.name}"></div>
    <div class="carousel-item"><img src="\${selectedHotel.carousel3}" alt="\${selectedHotel.name}"></div>
  \`;
  currentCarouselIndex = 0;
  updateCarouselPosition();

  // Setup Carousel Controls
  document.getElementById("carousel-prev").onclick = () => {
    currentCarouselIndex = (currentCarouselIndex > 0) ? currentCarouselIndex - 1 : 3;
    updateCarouselPosition();
  };
  document.getElementById("carousel-next").onclick = () => {
    currentCarouselIndex = (currentCarouselIndex < 3) ? currentCarouselIndex + 1 : 0;
    updateCarouselPosition();
  };

  // Setup map marker
  const coords = [selectedHotel.latitude, selectedHotel.longitude];
  map.setView(coords, 13);
  
  if (mapMarker) {
    mapMarker.setLatLng(coords).setPopupContent(selectedHotel.name);
  } else {
    mapMarker = L.marker(coords).addTo(map).bindPopup(selectedHotel.name).openPopup();
  }
  
  // Recalculate size to render properly in hidden tabs
  setTimeout(() => {
    map.invalidateSize();
  }, 100);

  // Reset meal checkboxes
  chkBreakfast.checked = false;
  chkLunch.checked = false;
  chkDinner.checked = false;

  calculatePrices();
  showView(viewDetails);
}

function updateCarouselPosition() {
  const carouselInner = document.getElementById("carousel-inner");
  carouselInner.style.transform = \`translateX(\${currentCarouselIndex * 100}%)\`;
}

function calculatePrices() {
  if (!selectedHotel) return;

  const basePrice = selectedHotel.price * currentNights;
  
  // Calculate meals
  let mealCost = 0;
  if (chkBreakfast.checked) mealCost += 30;
  if (chkLunch.checked) mealCost += 70;
  if (chkDinner.checked) mealCost += 40;

  const totalMealCost = mealCost * currentGuests * currentNights;
  const subtotal = basePrice + totalMealCost;
  const vat = Math.round(subtotal * 0.16);
  const total = subtotal + vat;

  subtotalResult.innerText = \`₪\${subtotal}\`;
  vatResult.innerText = \`₪\${vat}\`;
  totalResult.innerText = \`₪\${total}\`;
}

function confirmBooking() {
  // Generate random reservation code
  const randomCode = "PAL-" + Math.floor(100000 + Math.random() * 900000);
  document.getElementById("reservation-code").innerText = randomCode;

  // Reset email fields
  document.getElementById("emailInput").value = "";
  document.getElementById("emailConfirmation").innerText = "";

  showView(viewConfirmation);
}

function sendItinerary() {
  const emailInput = document.getElementById("emailInput");
  const emailStatus = document.getElementById("emailConfirmation");
  
  emailStatus.className = "email-status";
  emailStatus.innerText = "";

  const email = emailInput.value.trim();
  const mailformat = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}\$/;

  if (email.match(mailformat)) {
    emailStatus.innerText = "تم إرسال الفاتورة وتفاصيل الرحلة بنجاح إلى بريدك الإلكتروني! ✉️";
    emailStatus.classList.add("email-success");
  } else {
    emailStatus.innerText = "يرجى إدخال عنوان بريد إلكتروني صحيح.";
    emailStatus.classList.add("email-error");
  }
}
`;

            if (isZip) {
                setIsPublishing(true);
                try {
                    if (!window.JSZip) {
                        await new Promise((resolve, reject) => {
                            const script = document.createElement('script');
                            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
                            script.onload = resolve;
                            script.onerror = reject;
                            document.head.appendChild(script);
                        });
                    }
                    const zip = new window.JSZip();
                    zip.file("index.html", tourismHtml);
                    zip.folder("css").file("style.css", tourismStyleCss);
                    zip.folder("js").file("app.js", tourismAppJs);
                    
                    const content = await zip.generateAsync({ type: 'blob' });
                    const downloadUrl = URL.createObjectURL(content);
                    const a = document.createElement('a');
                    a.href = downloadUrl;
                    a.download = `Palestine_Tourism_Booking_${Date.now()}.zip`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(downloadUrl);
                } catch (err) {
                    console.error("ZIP packaging failed:", err);
                    alert("فشل تصدير المشروع كـ ZIP: " + err.message);
                } finally {
                    setIsPublishing(false);
                }
            } else {
                let bundledHtml = tourismHtml
                    .replace('<link rel="stylesheet" href="css/style.css" />', `<style>${tourismStyleCss}</style>`)
                    .replace('<script defer src="js/app.js"></script>', `<script>${tourismAppJs}</script>`);

                const blob = new Blob([bundledHtml], { type: 'text/html' });
                const downloadUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = downloadUrl;
                a.download = `Palestine_Tourism_Booking_${Date.now()}.html`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(downloadUrl);
            }
            setIsDesignStudioOpen(false);
            return;
        }

        if (designSelections.commercialTemplate === 'mapty') {
            const maptyHtml = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>مقتفي الرياضة بالضفة - Mapty Palestine</title>

    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=Tajawal:wght@400;600;700;800&display=swap" rel="stylesheet">

    <link
      rel="stylesheet"
      href="https://unpkg.com/leaflet@1.8.0/dist/leaflet.css"
      integrity="sha512-hoalWLoI8r4UszCkZ5kL8vayOGVae1oxXe/2A4AO6J9+580uKHDO3JdHb7NzwwzK5xr/Fs0W40kiNHxM9vyTtQ=="
      crossorigin=""
    />
    <script
      src="https://unpkg.com/leaflet@1.8.0/dist/leaflet.js"
      integrity="sha512-BB3hKbKWOc9Ez/TAwyWxNXeoV9c1v6FIeYiBieIWkpLjauysF18NzgR1MBNBXf8/KABdlkX68nAhlwcDFLGPCQ=="
      crossorigin=""
    ></script>
    <link rel="stylesheet" href="css/style.css" />
    <script defer src="js/app.js"></script>
  </head>
  <body>
    <div class="sidebar">
      <div class="logo-container">
        <i class="fa-solid fa-person-running logo-icon"></i>
        <div class="logo-text">Mapty <span class="logo-sub">Palestine</span></div>
      </div>
      
      <p class="intro-text">سجل تمارين الجري وركوب الدراجات الخاصة بك في الضفة الغربية. انقر على الخريطة في أي مدينة لإضافة تمرين جديد.</p>

      <ul class="workouts">
        <form class="form hidden">
          <div class="form__row">
            <label class="form__label">نوع التمرين</label>
            <select class="form__input form__input--type">
              <option value="running">🏃‍♂️ جري</option>
              <option value="cycling">🚴‍♀️ دراجات</option>
            </select>
          </div>
          <div class="form__row">
            <label class="form__label">المسافة</label>
            <input class="form__input form__input--distance" placeholder="كم" />
          </div>
          <div class="form__row">
            <label class="form__label">المدة</label>
            <input class="form__input form__input--duration" placeholder="دقيقة" />
          </div>
          <div class="form__row">
            <label class="form__label">التردد (الخطوات)</label>
            <input class="form__input form__input--cadence" placeholder="خطوة/دقيقة" />
          </div>
          <div class="form__row form__row--hidden">
            <label class="form__label">الارتفاع المحقق</label>
            <input class="form__input form__input--elevation" placeholder="أمتار" />
          </div>
          <button class="form__btn">تأكيد</button>
        </form>
      </ul>

      <p class="copyright">
        مقتفي الرياضة بالضفة الغربية &copy; تصميم وتطوير بال نوفا - تم الاقتباس والتعريب من Jonas Schmedtmann.
      </p>
    </div>

    <div id="map"></div>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
  </body>
</html>`;
            const maptyStyleCss = `:root {
  --color-brand--1: #00A86B; /* Palestine Green for running */
  --color-brand--2: #EF4444; /* Palestine Red for cycling */
  
  --color-dark--1: #0B0F19;
  --color-dark--2: #121824;
  --color-light--1: #F8FAFC;
  --color-light--2: #E2E8F0;
  
  --font-main: 'Tajawal', sans-serif;
  --font-logo: 'Cairo', sans-serif;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html {
  font-size: 62.5%;
  box-sizing: border-box;
}

body {
  font-family: var(--font-main);
  color: var(--color-light--2);
  font-weight: 400;
  line-height: 1.6;
  height: 100vh;
  display: flex;
  overflow: hidden;
}

/* Links */
a:link,
a:visited {
  color: var(--color-brand--1);
}

/* Sidebar Layout */
.sidebar {
  flex-basis: 400px;
  background-color: var(--color-dark--1);
  padding: 3rem 3.5rem 3rem 3.5rem;
  display: flex;
  flex-direction: column;
  border-left: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: -5px 0 25px rgba(0, 0, 0, 0.4);
  z-index: 10;
}
@media (max-width: 768px) {
  body { flex-direction: column-reverse; }
  .sidebar { flex-basis: 50%; width: 100%; }
}

.logo-container {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1.2rem;
  margin-bottom: 2rem;
}
.logo-icon {
  font-size: 3rem;
  color: var(--color-brand--1);
  text-shadow: 0 0 10px rgba(0, 168, 107, 0.3);
}
.logo-text {
  font-size: 2.4rem;
  font-weight: 900;
  color: #fff;
  font-family: var(--font-logo);
}
.logo-sub {
  color: var(--color-brand--2);
}

.intro-text {
  font-size: 1.2rem;
  color: rgba(255,255,255,0.5);
  text-align: center;
  margin-bottom: 2.5rem;
  line-height: 1.5;
}

.workouts {
  list-style: none;
  overflow-y: scroll;
  overflow-x: hidden;
  height: 77vh;
  padding-right: 4px;
}

.workouts::-webkit-scrollbar {
  width: 0.5rem;
}

.workouts::-webkit-scrollbar-track {
  background-color: var(--color-dark--1);
}

.workouts::-webkit-scrollbar-thumb {
  background-color: rgba(255,255,255,0.1);
  border-radius: 4px;
}

/* Workouts List items */
.workout {
  background-color: var(--color-dark--2);
  border-radius: 8px;
  padding: 1.5rem 2.2rem;
  margin-bottom: 1.7rem;
  cursor: pointer;
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr;
  gap: 0.8rem 1.5rem;
  border-right: 5px solid transparent;
  transition: all 0.3s;
}

.workout:hover {
  transform: translateX(-4px);
  background-color: #172030;
}

.workout--running {
  border-right-color: var(--color-brand--1);
}
.workout--cycling {
  border-right-color: var(--color-brand--2);
}

.workout__title {
  font-size: 1.35rem;
  font-weight: 800;
  grid-column: 1 / -1;
  color: #fff;
}

.workout__details {
  display: flex;
  align-items: center;
}

.workout__icon {
  font-size: 1.5rem;
  margin-left: 0.5rem;
}

.workout__value {
  font-size: 1.3rem;
  font-weight: 700;
}

.workout__unit {
  font-size: 0.9rem;
  color: rgba(255,255,255,0.4);
  margin-right: 3px;
  text-transform: uppercase;
  font-weight: 800;
}

/* Entry Form */
.form {
  background-color: var(--color-dark--2);
  border-radius: 8px;
  padding: 1.5rem 2rem;
  margin-bottom: 1.7rem;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.2rem 2.2rem;
  transition: all 0.5s, transform 1ms;
}

.form.hidden {
  transform: translateY(-30rem);
  height: 0;
  padding: 0;
  margin: 0;
  opacity: 0;
  overflow: hidden;
}

.form__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.form__row--hidden {
  display: none !important;
}

.form__label {
  font-size: 1.15rem;
  font-weight: 600;
  color: var(--color-light--2);
}

.form__input {
  width: 55%;
  padding: 0.5rem 0.8rem;
  font-family: inherit;
  font-size: 1.25rem;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 5px;
  background-color: rgba(0, 0, 0, 0.2);
  color: #fff;
  transition: all 0.2s;
  outline: none;
}

.form__input:focus {
  background-color: rgba(0, 0, 0, 0.4);
  border-color: var(--color-brand--1);
}

.form__btn {
  display: none;
}

.copyright {
  margin-top: auto;
  font-size: 1rem;
  color: rgba(255,255,255,0.3);
  text-align: center;
  line-height: 1.5;
}

/* Map area */
#map {
  flex: 1;
  height: 100%;
  background-color: var(--color-dark--1);
}

/* Leaflet Popup Styling */
.leaflet-popup .leaflet-popup-content-wrapper {
  background-color: var(--color-dark--2) !important;
  color: var(--color-light--2) !important;
  border-radius: 8px !important;
  padding: 8px 12px !important;
  box-shadow: 0 5px 15px rgba(0,0,0,0.5) !important;
}

.leaflet-popup .leaflet-popup-content {
  font-size: 1.2rem !important;
  font-family: var(--font-main) !important;
  font-weight: 700 !important;
}

.leaflet-popup .leaflet-popup-tip {
  background-color: var(--color-dark--2) !important;
}

.running-popup .leaflet-popup-content-wrapper {
  border-right: 5px solid var(--color-brand--1) !important;
}

.cycling-popup .leaflet-popup-content-wrapper {
  border-right: 5px solid var(--color-brand--2) !important;
}
`;
            const maptyAppJs = `"use strict";

// Selectors
const form = document.querySelector(".form");
const containerWorkouts = document.querySelector(".workouts");
const inputType = document.querySelector(".form__input--type");
const inputDistance = document.querySelector(".form__input--distance");
const inputDuration = document.querySelector(".form__input--duration");
const inputCadence = document.querySelector(".form__input--cadence");
const inputElevation = document.querySelector(".form__input--elevation");

class Workout {
  id = Date.now() + "".slice(-7);
  date = new Date();

  constructor(coords, distance, duration) {
    this.distance = distance;
    this.duration = duration;
    this.coords = coords;
  }

  _setDescription() {
    const months = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
    this.description = \`\${this.type === "running" ? "🏃‍♂️ جري" : "🚴‍♀️ دراجات"} في \${this.date.getDate()} \${months[this.date.getMonth()]}\`;
  }
}

class Cycling extends Workout {
  type = "cycling";
  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    this.speed = Number((this.distance / (this.duration / 60)).toFixed(1));
    return this.speed;
  }
}

class Running extends Workout {
  type = "running";
  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    this.pace = Number((this.duration / this.distance).toFixed(1));
    return this.pace;
  }
}

class App {
  #map;
  #mapEvent;
  #workout = [];
  #mapZoomLevel = 11;
  #defaultCoord = [32.0, 35.25]; // Center of West Bank (Ramallah/Nablus area)

  constructor() {
    this._loadPreloadedWorkouts();
    this._getPosition();
    this._getLocalStorage();
    
    inputType.addEventListener("change", this._toggleElevationField);
    form.addEventListener("submit", this._newWorkout.bind(this));
    containerWorkouts.addEventListener("click", this._moveMap.bind(this));
  }

  // Preload sample workouts in West Bank
  _loadPreloadedWorkouts() {
    if (localStorage.getItem("workouts")) return; // skip if user already has logged ones
    
    // Sample running in Ramallah
    const runSample = new Running([31.9029, 35.2032], 5.2, 26, 178);
    // Sample cycling in Nablus
    const cycleSample = new Cycling([32.2211, 35.2544], 18.5, 45, 220);
    
    this.#workout.push(runSample, cycleSample);
  }

  _getPosition() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        () => {
          // If GPS fails/denied, load default West Bank view
          this._loadMap({ coords: { latitude: this.#defaultCoord[0], longitude: this.#defaultCoord[1] } }, true);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      this._loadMap({ coords: { latitude: this.#defaultCoord[0], longitude: this.#defaultCoord[1] } }, true);
    }
  }

  _loadMap(position, isDefault = false) {
    const { latitude, longitude } = position.coords;
    const coord = [latitude, longitude];

    this.#map = L.map("map").setView(coord, this.#mapZoomLevel);

    // Dark high-tech theme map tiles from CartoDB
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(this.#map);

    this.#map.on("click", this._showForm.bind(this));

    // Render existing and sample markers
    this.#workout.forEach((work) => {
      this._renderWorkoutMarker(work);
    });
    
    if (isDefault) {
      console.log("Centered map by default on West Bank, Palestine.");
    }
  }

  _showForm(mapE) {
    this.#mapEvent = mapE;
    form.classList.remove("hidden");
    inputDistance.focus();
  }

  _hideForm() {
    inputDistance.value =
      inputCadence.value =
      inputDuration.value =
      inputElevation.value =
        "";
    form.style.display = "none";
    form.classList.add("hidden");
    setTimeout(() => (form.style.display = "grid"), 1000);
  }

  _toggleElevationField() {
    inputElevation.closest(".form__row").classList.toggle("form__row--hidden");
    inputCadence.closest(".form__row").classList.toggle("form__row--hidden");
  }

  _newWorkout(e) {
    e.preventDefault();

    const inputOnlyNum = (...inputs) =>
      inputs.every((input) => Number.isFinite(input));

    const inputOnlyPosNum = (...inputs) => inputs.every((input) => input > 0);

    let workout;
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const { lat, lng } = this.#mapEvent.latlng;

    if (type === "running") {
      const cadence = +inputCadence.value;
      if (
        !inputOnlyNum(distance, duration, cadence) ||
        !inputOnlyPosNum(distance, duration, cadence)
      ) {
        alert("يرجى إدخال أرقام موجبة وصحيحة!");
        return;
      }
      workout = new Running([lat, lng], distance, duration, cadence);
    }

    if (type === "cycling") {
      const elevation = +inputElevation.value;
      if (
        !inputOnlyNum(distance, duration, elevation) ||
        !inputOnlyPosNum(distance, duration)
      ) {
        alert("يرجى إدخال أرقام موجبة وصحيحة!");
        return;
      }
      workout = new Cycling([lat, lng], distance, duration, elevation);
    }

    this.#workout.push(workout);
    this._renderWorkoutMarker(workout);
    this._renderWorkout(workout);
    this._hideForm();
    this._setLocalStorage();
  }

  _renderWorkoutMarker(workout) {
    L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          closeOnEscapeKey: false,
          className: \`\${workout.type}-popup\`,
        })
      )
      .setPopupContent(\`\${workout.description}\`)
      .openPopup();
  }

  _renderWorkout(workout) {
    let html = \`
    <li class="workout workout--\${workout.type}" data-id=\${workout.id}>
        <h2 class="workout__title">\${workout.description}</h2>
        <div class="workout__details">
            <span class="workout__icon">\${workout.type === "running" ? "🏃‍♂️" : "🚴‍♀️"}</span>
            <span class="workout__value">\${workout.distance}</span>
            <span class="workout__unit">كم</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⏱</span>
          <span class="workout__value">\${workout.duration}</span>
          <span class="workout__unit">دقيقة</span>
        </div>
    \`;

    if (workout.type === "running") {
      html += \`
      <div class="workout__details">
        <span class="workout__icon">⚡️</span>
        <span class="workout__value">\${workout.pace}</span>
        <span class="workout__unit">دقيقة/كم</span>
      </div>
      <div class="workout__details">
        <span class="workout__icon">🦶🏼</span>
        <span class="workout__value">\${workout.cadence}</span>
        <span class="workout__unit">خ/دقيقة</span>
      </div></li>\`;
    }

    if (workout.type === "cycling") {
      html += \`
      <div class="workout__details">
        <span class="workout__icon">⚡️</span>
        <span class="workout__value">\${workout.speed}</span>
        <span class="workout__unit">كم/ساعة</span>
      </div>
      <div class="workout__details">
        <span class="workout__icon">⛰</span>
        <span class="workout__value">\${workout.elevationGain}</span>
        <span class="workout__unit">متر</span>
      </div></li>
      \`;
    }

    form.insertAdjacentHTML("afterend", html);
  }

  _moveMap(e) {
    const workoutEle = e.target.closest(".workout");
    if (!workoutEle) return;

    const workout = this.#workout.find((w) => w.id === workoutEle.dataset.id);
    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });
  }

  _setLocalStorage() {
    localStorage.setItem("workouts", JSON.stringify(this.#workout));
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem("workouts"));
    if (!data) {
      // Load sample workouts first time
      this.#workout.forEach((work) => {
        this._renderWorkout(work);
      });
      return;
    }
    this.#workout = data;
    this.#workout.forEach((work) => {
      this._renderWorkout(work);
    });
  }
}

const app = new App();
`;

            if (isZip) {
                setIsPublishing(true);
                try {
                    if (!window.JSZip) {
                        await new Promise((resolve, reject) => {
                            const script = document.createElement('script');
                            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
                            script.onload = resolve;
                            script.onerror = reject;
                            document.head.appendChild(script);
                        });
                    }
                    const zip = new window.JSZip();
                    zip.file("index.html", maptyHtml);
                    zip.folder("css").file("style.css", maptyStyleCss);
                    zip.folder("js").file("app.js", maptyAppJs);
                    
                    const content = await zip.generateAsync({ type: 'blob' });
                    const downloadUrl = URL.createObjectURL(content);
                    const a = document.createElement('a');
                    a.href = downloadUrl;
                    a.download = `Mapty_Palestine_Project_${Date.now()}.zip`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(downloadUrl);
                } catch (err) {
                    console.error("ZIP packaging failed:", err);
                    alert("فشل تصدير المشروع كـ ZIP: " + err.message);
                } finally {
                    setIsPublishing(false);
                }
            } else {
                let bundledHtml = maptyHtml
                    .replace('<link rel="stylesheet" href="css/style.css" />', `<style>${maptyStyleCss}</style>`)
                    .replace('<script defer src="js/app.js"></script>', `<script>${maptyAppJs}</script>`);

                const blob = new Blob([bundledHtml], { type: 'text/html' });
                const downloadUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = downloadUrl;
                a.download = `Mapty_Palestine_Design_${Date.now()}.html`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(downloadUrl);
            }
            setIsDesignStudioOpen(false);
            return;
        }

        if (designSelections.commercialTemplate === 'guacamaya') {
            const guacamayaHtml = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>غواكامايا إيرلاينز - نظام إدارة وحجز الطيران</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;700;900&family=Tajawal:wght@300;400;700;900&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
    <link rel="stylesheet" href="css/style.css">
</head>
<body>
    <div class="app-container">
        <!-- Sidebar -->
        <aside class="sidebar">
            <div class="brand">
                <i class="fa-solid fa-plane-departure logo-icon"></i>
                <span class="brand-text">Guacamaya <span class="brand-sub">Airlines</span></span>
            </div>
            
            <p class="intro-text">نظام المحاكاة الإداري المتكامل لإدارة الرحلات الجوية، تخطيط الجداول، وحجز التذاكر عبر الخريطة التفاعلية.</p>
            
            <!-- Tab Controls -->
            <div class="tab-controls">
                <button class="tab-btn active" data-tab="booking"><i class="fa-solid fa-ticket"></i> الحجوزات</button>
                <button class="tab-btn" data-tab="planning"><i class="fa-solid fa-calendar-plus"></i> جدولة الرحلات</button>
                <button class="tab-btn" data-tab="stats"><i class="fa-solid fa-chart-pie"></i> الإحصائيات</button>
            </div>

            <!-- TAB CONTENT: BOOKING -->
            <div id="tab-booking" class="tab-content active">
                <div class="booking-form">
                    <h3 class="panel-title">البحث عن رحلة جغرافية</h3>
                    <div class="input-group">
                        <label><i class="fa-solid fa-plane-departure text-primary"></i> مطار الإقلاع (من)</label>
                        <select id="select-from">
                            <option value="" selected disabled hidden>اختر مطار الإقلاع...</option>
                            <option value="MIA">MIA - ميامي (أمريكا)</option>
                            <option value="CCS">CCS - كاراكاس (fنزويلا)</option>
                            <option value="JFK">JFK - نيويورك (أمريكا)</option>
                            <option value="ATL">ATL - أتلانتا (أمريكا)</option>
                            <option value="DXB">DXB - دبي (الإمارات)</option>
                            <option value="CDG">CDG - باريس (فرنسا)</option>
                        </select>
                    </div>
                    
                    <div class="input-group">
                        <label><i class="fa-solid fa-plane-arrival text-danger"></i> مطار الوصول (إلى)</label>
                        <select id="select-to">
                            <option value="" selected disabled hidden>اختر مطار الوصول...</option>
                            <option value="MIA">MIA - ميامي (أمريكا)</option>
                            <option value="CCS">CCS - كاراكاس (fنزويلا)</option>
                            <option value="JFK">JFK - نيويورك (أمريكا)</option>
                            <option value="ATL">ATL - أتلانتا (أمريكا)</option>
                            <option value="DXB">DXB - دبي (الإمارات)</option>
                            <option value="CDG">CDG - باريس (فرنسا)</option>
                        </select>
                    </div>

                    <div class="input-group">
                        <label><i class="fa-solid fa-calendar-day"></i> تاريخ المغادرة</label>
                        <input type="date" id="search-date" value="2026-06-15">
                    </div>
                    
                    <button id="btn-search-flights" class="btn primary-btn">بحث عن الرحلات المتاحة</button>
                </div>

                <!-- Flight Search Results -->
                <div id="search-results-section" class="search-results-section hidden">
                    <h3 class="panel-title">الرحلات المتوفرة</h3>
                    <div id="flights-list" class="flights-list"></div>
                </div>

                <!-- Interactive Seat Map -->
                <div id="seat-map-section" class="seat-map-section hidden">
                    <h3 class="panel-title">خريطة مقاعد الطائرة (<span id="active-flight-no">--</span>)</h3>
                    <div class="seat-legend">
                        <span class="legend-item"><span class="box first-class"></span> درجة أولى</span>
                        <span class="legend-item"><span class="box business-class"></span> درجة رجال أعمال</span>
                        <span class="legend-item"><span class="box economy-class"></span> اقتصادية</span>
                        <span class="legend-item"><span class="box occupied"></span> محجوز</span>
                    </div>
                    <div class="plane-body">
                        <div class="cockpit"><i class="fa-solid fa-shield-halved"></i> مقصورة القيادة</div>
                        <div id="seats-grid" class="seats-grid"></div>
                    </div>
                    <div class="seat-selection-summary">
                        <div>المقعد المختار: <strong id="selected-seat-label">لم يتم الاختيار</strong></div>
                        <div>سعر التذكرة: <strong id="selected-seat-price">--</strong> ₪</div>
                    </div>
                    <div class="input-group" style="margin-top: 10px;">
                        <label><i class="fa-solid fa-user"></i> اسم المسافر</label>
                        <input type="text" id="passenger-name" placeholder="أدخل اسم المسافر بالكامل...">
                    </div>
                    <button id="btn-confirm-booking" class="btn success-btn disabled" disabled>تأكيد الحجز وإصدار التذكرة</button>
                </div>
            </div>

            <!-- TAB CONTENT: PLANNING (ADMIN) -->
            <div id="tab-planning" class="tab-content">
                <div class="planning-form">
                    <h3 class="panel-title">جدولة رحلة جوية جديدة</h3>
                    
                    <div class="input-group">
                        <label>رقم الرحلة</label>
                        <input type="text" id="plan-flight-no" placeholder="مثال: GA-105">
                    </div>

                    <div style="display: flex; gap: 12px;">
                        <div class="input-group" style="flex: 1;">
                            <label>من مطار</label>
                            <select id="plan-from">
                                <option value="MIA">MIA - ميامي</option>
                                <option value="CCS">CCS - كاراكاس</option>
                                <option value="JFK">JFK - نيويورك</option>
                                <option value="ATL">ATL - أتلانتا</option>
                                <option value="DXB">DXB - دبي</option>
                                <option value="CDG">CDG - باريس</option>
                            </select>
                        </div>
                        <div class="input-group" style="flex: 1;">
                            <label>إلى مطار</label>
                            <select id="plan-to">
                                <option value="CDG">CDG - باريس</option>
                                <option value="MIA">MIA - ميامي</option>
                                <option value="CCS">CCS - كاراكاس</option>
                                <option value="JFK">JFK - نيويورك</option>
                                <option value="ATL">ATL - أتلانتا</option>
                                <option value="DXB">DXB - دبي</option>
                            </select>
                        </div>
                    </div>

                    <div style="display: flex; gap: 12px;">
                        <div class="input-group" style="flex: 1;">
                            <label>وقت الإقلاع</label>
                            <input type="time" id="plan-time" value="08:30">
                        </div>
                        <div class="input-group" style="flex: 1;">
                            <label>سعر التذكرة (₪)</label>
                            <input type="number" id="plan-price" value="1200" min="100">
                        </div>
                    </div>

                    <div class="input-group">
                        <label>نوع الطائرة</label>
                        <select id="plan-plane">
                            <option value="Boeing 787 Dreamliner">Boeing 787 Dreamliner (240 مقعد)</option>
                            <option value="Airbus A350-900">Airbus A350-900 (300 مقعد)</option>
                            <option value="Boeing 737 Max">Boeing 737 Max (160 مقعد)</option>
                        </select>
                    </div>

                    <button id="btn-schedule-flight" class="btn primary-btn">إدراج وجدولة الرحلة</button>
                </div>

                <div class="scheduled-flights-section">
                    <h3 class="panel-title">جدول الرحلات الحالي</h3>
                    <div id="admin-scheduled-list" class="admin-scheduled-list"></div>
                </div>
            </div>

            <!-- TAB CONTENT: STATS -->
            <div id="tab-stats" class="tab-content">
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-title">إجمالي الرحلات</div>
                        <div class="stat-value" id="stat-total-flights">12</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-title">التذاكر المباعة</div>
                        <div class="stat-value" id="stat-tickets-sold">48</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-title">نسبة إشغال المقاعد</div>
                        <div class="stat-value" id="stat-occupancy-rate">72%</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-title">إجمالي الإيرادات</div>
                        <div class="stat-value" id="stat-total-revenue">₪ 84,400</div>
                    </div>
                </div>

                <div class="recent-bookings-panel">
                    <h3 class="panel-title">سجل الحجوزات الأخيرة</h3>
                    <div id="recent-bookings-list" class="recent-bookings-list"></div>
                </div>
            </div>
        </aside>

        <!-- Main Workspace (SVG World Map) -->
        <main class="main-map-container">
            <div class="map-overlay-title">
                <h2>خريطة المطارات والخطوط الجوية التفاعلية</h2>
                <p>اختر أيقونات الطائرات أو المطارات لعرض الرحلات والمسارات الجوية المباشرة</p>
            </div>
            
            <div class="svg-map-wrapper">
                <svg id="svg-world-map" viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg">
                    <!-- Definitions for glow effects and markers -->
                    <defs>
                        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                            <feGaussianBlur stdDeviation="8" result="blur" />
                            <feComposite in="SourceGraphic" in2="blur" operator="over" />
                        </filter>
                    </defs>

                    <!-- World Outline Group -->
                    <g id="world-continents">
                        <path class="restoDelMundo" d="M85,227h16l8-7l3-2l-7-3h-8l-3-3c0,0,4-2,5-3s5,1,6,0s11-2,11-2h3c0,0,2,1,3,0s4-3,4-3s-1-2-2-3s-3-2-2-4s6-3,6-3s8,0,11-1s12-3,15-4s15-4,15-4l15-3h22c0,0,3,3,5,3s15,3,15,3s9,0,10,1s11,2,11,2l8,2c0,0,10,0,12-1s6-2,8-3s5-2,10-2s14,0,16,0s5,0,9,1s10,3,10,3s5,3,7,3s0,0,0,0l13,1l3,3l8,1c0,0,4,2,8,1s9-2,9-2s6-1,8-1s5,0,10,0s12-1,12-1l6,1c0,0,3,1,5,1s8-2,8-2l5-5c0,0-1-1,0-3s0-6,4-6s12,0,12,0l6,2c0,0-2,7-2,9s2,5,2,5s0,1,3,1s5-1,5-1l6-4h3l10-2c0,0,6,2,5,4s0,3-5,5s-7,4-7,4l-6,3c0,0-3,1-8,1s-7,1-10,1s-7,1-8,2s-4,3-4,3l-1,5l-10,1c0,0-2,1-5,2s-7,4-7,4l-7,5l-12,4l-7,6c0,0,0,1,0,3s0,7,0,7s5,2,7,3s8,5,8,5l8,4l5,3h5c0,0,0,5,0,7s-1,3-1,6s0,4,0,4l1,4h5c0,0-3,0,0-2s2-5,4-6s6-4,6-5s1-3,3-4s2-2,6-3s7-2,7-2s1-1,2-4s2-7,2-7s-1-5,1-8s4-7,4-7l4-5c0,0,0-2,3-3s1-1,5-2s11-1,12-1s8,2,8,2l6,4c0,0,1,3,2,5s2,4,2,6s-4,0,0,2s9,4,11,2s5-6,5-6l3-3l5,5l1,5c0,0-1,4-1,6s-3,2,0,7s4,8,4,8v4l2.5-1.5l6,2c0,0,4,1,4,2s0,5,0,5l-4,3l-3,1l-10,4l-8,3l-6,2h-8c0,0-7,0-9,0s-12,4-12,4h-3l10,7h2l-5,4l-2,3c0,0,1,6,2,6s4,0,4,0l4,3l1,3v2l-2,4c0,0-5-1-7,0s-4,0-4,0s0,1-3,3s-3,0-3,0l-5,1c0,0-1-3-1-4s0,0,0,0l2-5l-7,5h-3l-5,4h-4l-10,7l-2,3l-5,4l-9,5c0,0,3,0-2,0s-7,3-7,3l-2,3c0,0,0,3-3,4s-5,3-6,3s-1,2-1,2l-3,4c0,0-1,1-1,3s0,3,0,4s0-1,0,1s-2,6-3,7s-3,0-4,1s-3,2-5,3s-7,3-7,4s-2,3-2,3s-3,0-3,1s-2,2-2,2l-4,3h-1h-2l-25,7l-15,5l-4,1h-3l-3,4c0,0,0,2-1,2s-3,0-3,0c-3,1-9,0-9,0s-3-3-4-3s-5-1-5-1s-3,1-6,2s-6,2-6,2l-4,3l-4,5c0,0-3,3-3,4s-2,4-2,4l-1,7l-1,6l-2,5c0,0,0,3-1,4s-1,7-1,7l2,7c0,0,1,4,2,6s3,4,3,4s1,1,3,2s6,1,6,1s3,0,5-1s2-1,4-2s2,0,3-2s2-3,3-4s3-4,3-4l4-3l6-2h7c0,0,3-2,4,0s2,3,1,5s-3,5-3,5l-4,5c0,0-1,10-2,11s-1,2-2,4s-3,3-1,4s2,0,5,0s7,0,7,0h6h5l3,3l2,5l-2,7c0,0-1,3-1,5s-1-2,0,6s2,8,2,9s3,5,3,5l2,2c0,0,3,0,5,0s2,0,4-1s7-2,7-2l5,1l3,2c0,0,3,1,4,1s1,1,2,0s2-4,2-4l4-3l5-4c0,0,2-3,3-3s2,0,2,0h3l2-1h2l1,15l6,5l27-4h25l5,1h5l4,4l2,2l3,3l5,5c0,0,4,2,5,2s5,1,5,1h5l6,1l7,2l4,4c0,0,2,5,3,6s1,4,1,4l3,6l3,8l2,4l-5,6c0,0,3,2,5,3s5,1,5,1s3,3,4,0s0-5,3-5s8,0,8,0l7,6l3,4l4,3l10-1l10,2l6,3l7,3l11,6l6,6l1,7l-4,10c0,0-2,5-3,7s-2,4-5,6s-7,6-7,6l-1,8c0,0-5,6-5,10s0,17,0,17v11v4l-3,8l-3,6l-6,4c0,0-1-2-6,0s-12,4-12,4l-8,12l-6,7l-1,6l-2,9l-2,7l-4,8l-5,12c0,0,2,3-2,4s-4-1-4,0s-2-3-5,0s-9,4-9,4h-12l11,10c0,0,1,3,1,6s0,0,0,0s-4,8-8,9s-11,3-11,3s-3-2-5,1s-3,9-3,9l-5,6l2,8v8l-1,8c0,7-2,3,0,7s2,4,2,4s4,7,4,9s-2,8-2,8s-4,2-2,6s-5,8-5,8h-5h-8l-5-8c0,0-2-3-4-6s-8-10-8-10l-6-9c0,0-5-8-5-11s0-6,0-9s1-3,0-7s5-5,0-8s-8-9-8-9l-4-11l-1-13c0,0-1-8-1-14s0-11,0-15s0-12,0-12v-13c0,0,0-2,0-10s-1-17-1-17s0-3,0-8s3,4,0-5s1-6-5-13s-1,1-6-7s-10-7-15-11s5,8-5-4s-10-12-10-12l-6-6c0,0,6-3,0-9s-3,1-9-10s-4-10-8-15s2-1-2-5s-7-13-7-13s9,1,7-6s4-13,0-15s-1-4,0-8s7-7,8-11s11-10,11-10s1-3,0-6s0-11,0-11l-11-6h-6c0,0-7,1-9,0s0,0,0,0s-6-3-12-5s-10-10-10-10l-1-7l-6-5c0,0-3-3-6-4s0-1-5-2s-2,2-7-1s-8-4-8-4l-4-4c0,0-1-3-5-5s-5-2-7-2s-4,1-4,1s2,1-5,0s-11-3-11-3l-4-2c0,0-5-2-10-5s-6-3-10-6s-4-3-4-3l-5-12c0,0-3-8-3-10s-1-2-1-4s-1-2-2-6s-1-4-3-8s-2-3-4-6s-2-3-5-7s-4-8-5-9s-3-3-3-5s-2-4-3-6s-2-4-4-4s2,4-2,0s-1,4-4-2s-2-4-5-8s-2-3-5-8s-3-3-5-8s-3-4-3-10s0-5,0-10s1-8,1-9s1,6,0,0s3-14,4-15s5-3,7-6s4-6,6-8s4-7,4-7l4-5c0,0,2-1,3-4s1-10,1-10s1-4,1-9s1-8,1-8v-6c0,0,3-1,2-3s-3-9-3-11s0-6-2-10s-1-3-4-6s-6-3-10-5s-4-2-10-3s-9-1-12-1s-9,0-9,0l-11,3l-7,2c0,0-5-1-8,0s-9,4-9,4l-4,4l-6,2l-10,3l-8,3c0,0-6,2-9,3s-7,2-7,2s-3,1-4,0s-1-1,0-3s2-3,4-3s5,0,7-1s5-4,5-4s4-1,4-4s0-1,0-3s1-2,1-4s1-5,1-6s0-6,0-6l3-2L85,227z" />
                        <path class="restoDelMundo" d="M720,386c0,0-2,1-2,2s1,1-2,3s-3,3-5,4s-5,4-5,4s-2,2-4,3s-4,4-4,4s-1,3-1,5s-1,5,0,6s0,6,0,6l-8,4c0,0-4,3-7,5s-8,6-8,6l-4,4c0,0-5,5-8,10s-3,2-4,8s-2,8-2,8s-1,4-1,7s2,5,3,8s2,7,2,7s0,0,0,4s0,7,0,7s-1,2-2,4s-3-3-3,0s-3,9-3,9s-3,8-1,12s7,14,7,14s4,6,6,7s6,8,6,8l7,5l7,6c0,0,5,5,7,5s4,2,8,3s12,2,14,2s0,0,7,0s15,2,19,0s12-6,14-6s1-2,6-2s11,0,11,0h5c0,0,0,2,2,4s4,5,4,5s8-2,10,0s8,0,8,0l6,15v6v7l-4,7l-1,6l2,7l3,9l4,6c0,0,5,4,6,6s0,0,0,0l3,10l5,12c0,0,1,5,1,8s3,3,0,7s-5,5-6,9s-3,5-3,12s0,14,0,14s2,0,3,3s0,6,3,10s1,7,4,11s3,4,4,8s3,13,3,13l1,8l1,9l6,14c0,0,2,3,4,6s4,8,4,8l2,7c0,0,7,3,9,3s4,2,8,0s9-3,9-3s6-1,8-1s7-3,7-3l12-4l10-7l6-8l4-11l5-10c0,0,1,0,3-6s3-11,6-12s7-1,8-3s4-11,4-11l-1-5l-3-7c0,0,1-5,4-7s5-5,5-5l7-5l8-6l4-4c0,0,3-4,3-9s0-13,0-13s2-5,0-9s-4-11-4-11l-1-8l-2-9l3-12c0,0,2-3,5-6s8-12,10-13s11-8,11-8s6-3,9-8s4-7,6-9s6-8,6-8l6-10c0,0,2-3,4-8s4-10,4-10s2,0,2-6s0-10,0-10l-5,1l-6,1l-10,2c0,0-7,5-12,3s0-1-4-2s-4-1-4-1l-3-5l2-3c4-2-4-4,5-4s12,0,15-1s8-3,11-4s8-4,8-4l12-9c0,0,4-4,8-6s9-6,9-6s5-6,6-7s6-8,7-9s3-7,4-8s1-3-1-5s-2,0-7-5s-2-2-5-5s-2-2-4-4s-2-2-2-3s0-1,1-2s5,0,5,0l10,3l14,2l8-2l11-1c0,0,5,0,6,1s6,6,6,6l3,5l14,8v7c0,0,1,2,6,0s10-6,10-6l5,8c0,0,0,5,0,10s0,8,0,13s-3,8,0,12s7,7,8,12s7,15,7,15v6l11,4l5-2c0,0,3-2,4-8s1-11,1-15s0-12,0-12s-4-1,4-7s7-3,11-8s12-9,12-9l12-7l4-7c0,0,15-3,18-2s7,4,8,8s5,11,5,11l1,9l13,7l13,1l2,12c0,0,0,11,1,13s1,6,1,6s-1,4,0,7s-3,1,0,7s5,13,5,13s3,7,4,9s2,4,5,7s10,7,10,7l12,1c0-10,0-15,0-15l-10-10l-7-14c0,0-2-11-3-12s-4-2-4-6s-6-1,0-4s10-3,11,0s2,9,4,10s9,7,9,7c6,3,9,5,13,1s8-8,8-8l4-9c0,0-3-1,0-5s1-4,0-10s-4-15-6-15s-4-1-5-4l-4-5l-2-3c0,0-2-1-2-3s2-7,2-7s5-3,7-3s9,2,9,2s12-1,13-2s13-7,13-7l6-4l3-4l9-6c0,0,4-11,6-15s0-12,0-12s1-3,0-8s6,0,1-5s-8,0-9-7s-1-6-3-11s-3-11-3-11s-2-10-2-12s1-6,1-6s4-3,7,0s11,10,11,10s3,6,6,8s-7-2,0,2s13,4,13,4l6-1c0,0,1,1,0-5s0-6,0-6l-7-13c0,0-5-2-5-6s0-9,0-9l12-4c0,0,6-2,6-6s0-6,2-9s-2-5,0-12s-1-8,0-11s0-11,0-11s-3-4-8-7s-12-8-12-8s-8-3-12-7s-4-4-4-4l-2-4c0,0-2,5,1-4s4-13,4-13s-1,4,7,0s23-7,23-7s12-1,15-2s5-3,8-5s16,0,20,0s5,9,5,9l-1,8l2,11l13,10c0,0,7,8,10,5s6-1,6-9s0-12,0-12s-3-4,0-7s-9,3,0-3s16-13,16-13l11-6c0,0,0,0,6-4s11-9,11-9v-6l-7-13l-20-4l-22-1c0,0-12-2-21-4s1,0-15-3s-45-5-45-5l-21-1l-30-1l-24-1l-28-2c0,0-7,1-26-2s-25-3-25-3s-16-1-26-3s1,5-16,0s-37,0-37,0l-16-2c0,0,13-10,6-12s-16-3-16-3h-20c0,0-10-1-20,0s-12-3-17,0s-5,7-11,9s-4-1-12,3s-12,3-17,6s-7,4-11,6s-4,2-4,2s1,7-6,4s-11-6-11-6s-1-1-5-1s-6,3-7,6s0,9,0,9c-11,2-5,2-11,2s-12,0-12,0l-13,1l-40,6c0,0-1-2-9,1s-12,4-14,5s-4,2-2,1s-1-4-1-7s-1-6-6-8s-2-1-9-2s5,2-10-2s-31-7-31-7s-2-2-8,0s-16,6-16,6s-7,4-21,8s-14,3-20,7s-9,6-18,19s-9,13-9,13s-5,7-4,11s6,8,6,8s5,0,7,3s-2-5,0,3s0,8,0,8v12l-7,3c0,0-9,3-9,4s-6,5-6,5l-3,3l-3,2l-1,4l-1,7c0,0-4,6-5,7s-4,8-4,8l-11,15l-4,4c0,0-7-1-8-1s-4,0-5,0s-2-1-4-1s-2,0-5,0s-5-2-7,0s-3,5-3,6s0,3,0,3l-3,3c0,0-1,5-1,6s0,3,0,5s0,5,0,6s0,4,0,6s-2,0,0,2s2,2,2,2l4,1l4,1h2l4,3l2-1c0,0,3-2,5-2s7,0,7,0l5-1c0,0,2,0,3-2s4-4,4-4l4-3l1-5l4-4l4-4l5-3l6-5l2-4v-4l14-3h3h7c4-2,7-2,7-2s3,1,4,3s4,6,4,6l5,4l8,6l4,3l2,2c0,0,0,1,2,3s2,5,3,6s1,1,3,0s4-1,4-2s2-4,3-4s7-2,8,0s3,6,3,6s-1-1,2,2s4,2,5,4s4,6,5,6s8,2,8,2s0-6,0-8s0-3-1-5s-4-6-1-8s7-4,7-4s3-4,7-1s4,6,4,6v6l4,8l4,5l8,3c0,0,8,0,9,0s9,0,10,1s2,3,2,3l7,1l1,3l1,4c0,0,0,4,0,6s-1,5-1,5l-6,5c0,0-1,2-4,2s-10-1-10-1l-14-1h-11l-12-2l-10-2l-6-4l-4,1c0,0,0,3,0,5s-1,4-1,4s1,2-2,2s-6,0-6,0l-5-4c0,0-7-3-9-4s-8-2-10-3s-7-3-7-3s-5,1-8-3s-4-2-5-8s0-8,0-9s1-2-2-4s-6-1-6-1l-5,2c0,0-8,2-9,2s-6,0-11,0s-6-1-10,0s-6,1-9,2s-8,3-8,3l-7,3h-5c0,0-4-1-6-1S720,386,720,386z" />
                        <path class="restoDelMundo" d="M331,466l8-3c0,0,7-1,10,0s9,3,9,3s5-2,6,0s4,4,6,5s2,2,5,3s6,2,7,3s2,3,2,3s-1,2-4,2s-2-1-6,0s-7,0-8,0s0-1-2-2s-5-3-5-4s1-3-3-4s-2-2-7-2s-3,0-7,0s-6,0-7,0s-2-1-2-1L331,466z" />
                        <path class="restoDelMundo" d="M389,482c0,0,2-1,5,0s7,1,9,2s7,2,7,2s2,0,2,2s1,2-3,3s-7,2-8,2s-3-1-5,0s-3-1-5,0s-4,1-6,0s-5-2-5-2v-2l5-1c0,0,0,0,1,0S389,482,389,482z" />
                        <path class="restoDelMundo" d="M363,489h7c0,0,0.7,4.3,0,5c-2,2-6,2-7,2s-2,2-3,0s-3-3-3-3s-1-5,2-4S363,489,363,489z" />
                        <path class="restoDelMundo" d="M421,489c0,0-3,1-3,2s0,2,1,3s0,4,2,3s3,1,5,0s5,0,5,0s1-3,0-4s-5-5-6-4S421,489,421,489z" />
                        <path class="restoDelMundo" d="M439,493c0,0,1,3,2,4s0,3,1,4s3,2,4,1s-4-3,0-4s4,0,7,0s5,2,4,0s-1-3-5-4s-10-2-10-2L439,493z" />
                        <path class="restoDelMundo" d="M450,504c1,2,3,3,4,5s4,4,3,5s-1,3-2,4s-3,3-3,4s-5,3-4,5s0,3,0,4s0,4,0,4h4c0,0,3,1,3-2s0-4,0-6s1-2,2-4s1-3,2-4s2-2,2-3s1-3,0-5l-3-4l-2-2l-3-2C453,503,449,502,450,504z" />
                        <path class="restoDelMundo" d="M458,177l7-4c0,0,6-3,8-3s4,3,4,3v4c0,0,1-5,3-4s6,0,9,0s12-3,13,0s3,6,5,6s10,0,10,0s6-1,7,3s1,6,3,8s2,3,4,5s3,2,4,4s2,5,3,6s0,3,0,5s-2,1-5,2s-4,2-6,0s-4,0-4,1s-1,4,0,5s-1,4-3,5s-5,3-5,3s-1-1-3,0s-6,3-9,2s-4-2-5-3s-4-7-4-7s-2-4-1-5s3-3,3-3s1-2,2-3s2-4,2-4s-2-5-2-7s0-4-3-5s-2-1-6-2s-2-1-7-1s-6-1-10-2s-5-1-8-1s-4-4-6-3s-2,0-2,0L458,177z" />
                        <path class="restoDelMundo" d="M467,159l15-4c0,0,4,3,7,2s3-1,5-2s7-3,9-4s6-1,7-3s2-6,3-6s6-5,8-5s8,2,11,0s10-1,13-2s11-2,18-3s13-2,17-2s12,0,12,0s3,2-2,4s-4,2-10,4s-8,4-13,5s-6-2-10,1s-8,6-11,7s-4,4-10,6s-6,1-12,4s-8,2-11,3s-5,3-9,3s0,0-7,0s-6,0-12,0s-9,0-12,0s-4,1-6,0s-4-2-4-2L467,159z" />
                        <path class="restoDelMundo" d="M577,146l11-3c0,0,4-2,8-4s10-3,14-4s14-2,18-2s10,0,14,0s16-1,18,0s5,1,14,0s31-3,31-3s9-3,13-3s10-1,12,0s4,2,7,3s7,6,10,6s12,0,13,0s3-2,5-2s2,2,0,4s-6,5-9,5s-7-1-10,0s-2-2-4,3s-2,6-3,9s-1,3-6,6s-6,3-8,6s-5,6-7,6s-5-1-4,2s4,2-1,7s-7,7-12,9s-9,2-12,4s5-2-12,4s-18,7-21,9s-2,3-8,5s-9,2-12,3s-5,2-8,4s-6,7-7,8s-1,4-4,5s-6,3-8,3s-2-1-6,0s-6,3-8,0s-3-1-5-8s-3-9-3-15s-1-9,3-11s5,2,8-3s4-5,5-8s1-7,1-9s1-6,0-8s-2-1-5-4s-3-4-6-5s-6-2-10-4s-4-3-9-3s-10,0-12,0s-4-1-5-2s0-7,0-7s7-2,11-3S577,146,577,146z" />
                        <path class="restoDelMundo" d="M1022,681c0,2-3,6-3,7s-5,5-7,6s-9,2-11,4s-5,4-5,6s1,5,0,7s0,9,0,11s-3,8-3,9s-3,6-3,6s-3,0-2,5s-1,7,0,10s-1,6,3,7s4,0,7,0s9,3,10,0s2-6,2-7s5-4,5-9s2-7,2-12s1-5,3-10s5-10,5-11s3-5,3-7s1-4,0-8s-3-10-3-10L1022,681z" />
                        <path class="restoDelMundo" d="M799,344c-1,0-1,1-1,2s-2,3-1,3s1,2,1,2s0,1-1,2s-1,0-2,2s-1,2-1,4s0,3,1,4s1,2,2,2s-1,1,1,1s2,0,3-1s0-1,1-3s1-4,1-6s0-4,0-5s-1-3-1-4s-1-3-1-3s-1,0-1,0H799z" />
                        <path class="restoDelMundo" d="M884,386c-2,0-3,0-6,0s-2,0-3,0s-1,1-1,2s1,1,2,2s3,2,4,2s0,1,3,1s5,0,6,0s4-2,4-2s0-1-1-2s-3-1-4-2S884,386,884,386z" />
                        <path class="restoDelMundo" d="M736,254c0,0-4,7-3,8s0,5,1,6s4,5,5,6s4,2,3,4s-2,0-4,4s3,0,0,4s-7,6-5,7s-1,5,4,5s9,1,11,0s5-5,7-5s6-2,6-3s3-1,2-6s0-4-4-8s-3-3-6-6s-4-5-7-9s-6-7-6-7H736z" />
                        <path class="restoDelMundo" d="M719,270c-1,0-5,0-6,3s-5,9-4,10s-1,5,5,6s5,3,7,0s5-4,5-6s1-6,0-9s-4-4-4-4H719z" />
                        <path class="restoDelMundo" d="M1198,551c0,1,0,2,0,5s-1,8,0,10s2,4,4,4s4,4,5,0s4-4,3-9s-3-10-3-10h-3H1198z" />
                        <path class="restoDelMundo" d="M1442,282c0,0,5,8,6,10s2,4,3,7s-4,5,0,9s6,8,9,9s3,3,5,3s4,1,5-2s0-6,0-10s-2-4-2-7s-1-2-7-7s0-2-5-5s-7-7-8-7s-3,0-3,0H1442z" />
                        <path class="restoDelMundo" d="M1470,330c0,0-2,6,0,8s-2,6,0,7s2,4,3,5s2,4,3,6s0,4,0,4c3,5,3,9,3,11s1,5-2,6s-5,2-8,3s-8,3-9,4s-1-1-4,2s-4,9-6,10s-4-1-4,3s-1,5,2,7s1,3,8,3s11-3,9-5s-2-3-3-5s-9-4-2-4s0-2,7,0s7,3,9,3s5,3,6,0s-9-5,0-5s7,2,9,0s5-4,5-8s0-4,0-7s0-5,0-6s3-2,0-7s-3-7-4-9s2-1-1-2s-3-2-4-3s-1-4-1-4l2-1l2-1c0,0,4-3,3-5s-5-5-5-5s-1-1-3-2s-8-3-9-3S1470,330,1470,330z" />
                    </g>

                    <!-- Interactive Airports Group -->
                    <g id="interactive-airports">
                        <!-- Paris (CDG) -->
                        <g id="node-CDG" class="airport-node" data-code="CDG" data-name="مطار شارل ديغول" data-city="باريس" data-country="فرنسا" data-x="733" data-y="310">
                            <circle class="airport-glow" cx="733" cy="310" r="25" fill="rgba(6, 214, 242, 0.2)" />
                            <circle class="airport-core" cx="733" cy="310" r="10" fill="#06D6F2" />
                            <text class="airport-label" x="733" y="290">CDG (باريس)</text>
                        </g>

                        <!-- New York (JFK) -->
                        <g id="node-JFK" class="airport-node" data-code="JFK" data-name="مطار جون إف كينيدي" data-city="نيويورك" data-country="أمريكا" data-x="414" data-y="340">
                            <circle class="airport-glow" cx="414" cy="340" r="25" fill="rgba(6, 214, 242, 0.2)" />
                            <circle class="airport-core" cx="414" cy="340" r="10" fill="#06D6F2" />
                            <text class="airport-label" x="414" y="320">JFK (نيويورك)</text>
                        </g>

                        <!-- Miami (MIA) -->
                        <g id="node-MIA" class="airport-node" data-code="MIA" data-name="مطار ميامي الدولي" data-city="ميامي" data-country="أمريكا" data-x="358" data-y="435">
                            <circle class="airport-glow" cx="358" cy="435" r="25" fill="rgba(6, 214, 242, 0.2)" />
                            <circle class="airport-core" cx="358" cy="435" r="10" fill="#06D6F2" />
                            <text class="airport-label" x="358" y="415">MIA (ميامي)</text>
                        </g>

                        <!-- Atlanta (ATL) -->
                        <g id="node-ATL" class="airport-node" data-code="ATL" data-name="مطار هارتسفيلد جاكسون" data-city="أتلانتا" data-country="أمريكا" data-x="359" data-y="395">
                            <circle class="airport-glow" cx="359" cy="395" r="25" fill="rgba(6, 214, 242, 0.2)" />
                            <circle class="airport-core" cx="359" cy="395" r="10" fill="#06D6F2" />
                            <text class="airport-label" x="359" y="375">ATL (أتلانتا)</text>
                        </g>

                        <!-- Dubai (DXB) -->
                        <g id="node-DXB" class="airport-node" data-code="DXB" data-name="مطار دبي الدولي" data-city="دبي" data-country="الإمارات" data-x="940" data-y="440">
                            <circle class="airport-glow" cx="940" cy="440" r="25" fill="rgba(6, 214, 242, 0.2)" />
                            <circle class="airport-core" cx="940" cy="440" r="10" fill="#06D6F2" />
                            <text class="airport-label" x="940" y="420">DXB (دبي)</text>
                        </g>

                        <!-- Caracas (CCS) -->
                        <g id="node-CCS" class="airport-node" data-code="CCS" data-name="مطار سيمون بوليفار الدولي" data-city="كاراكاس" data-country="فنزويلا" data-x="394" data-y="530">
                            <circle class="airport-glow" cx="394" cy="530" r="25" fill="rgba(6, 214, 242, 0.2)" />
                            <circle class="airport-core" cx="394" cy="530" r="10" fill="#06D6F2" />
                            <text class="airport-label" x="394" y="510">CCS (كاراكاس)</text>
                        </g>
                    </g>

                    <!-- Active Flight Routes Arc Group -->
                    <g id="flight-arcs-group"></g>
                </svg>
            </div>
            
            <!-- Floating Airport Card Info -->
            <div id="airport-info-popup" class="airport-info-popup hidden">
                <div class="popup-header">
                    <span id="popup-airport-title" class="popup-title">مطار دبي الدولي</span>
                    <button id="btn-close-popup" class="close-btn"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="popup-body">
                    <p>المدينة: <strong id="popup-airport-city">دبي</strong> | الدولة: <strong id="popup-airport-country">الإمارات</strong></p>
                    <div style="display: flex; gap: 10px; margin-top: 10px;">
                        <button id="btn-set-origin" class="btn primary-btn btn-xs">تحديد كمطار إقلاع</button>
                        <button id="btn-set-dest" class="btn primary-btn btn-xs">تحديد كمطار وصول</button>
                    </div>
                </div>
            </div>
        </main>
    </div>

    <!-- Boarding Pass Modal -->
    <div id="boarding-pass-modal" class="modal-overlay hidden">
        <div class="boarding-pass-card">
            <div class="pass-header">
                <div class="pass-brand"><i class="fa-solid fa-plane-departure"></i> Guacamaya Airlines</div>
                <div class="pass-type">بطاقة صعود الطائرة / BOARDING PASS</div>
            </div>
            <div class="pass-body">
                <div class="pass-section">
                    <div class="pass-item">
                        <span>الاسم / NAME</span>
                        <strong id="pass-passenger-name">محمد أنور</strong>
                    </div>
                    <div class="pass-item">
                        <span>رقم الرحلة / FLIGHT</span>
                        <strong id="pass-flight-no">GA-201</strong>
                    </div>
                    <div class="pass-item">
                        <span>التاريخ / DATE</span>
                        <strong id="pass-date">15 Jun 2026</strong>
                    </div>
                </div>
                <div class="pass-section travel-route">
                    <div class="airport-route-code">
                        <strong id="pass-origin-code">MIA</strong>
                        <span id="pass-origin-city">ميامي</span>
                    </div>
                    <div class="route-plane-icon">
                        <i class="fa-solid fa-plane"></i>
                    </div>
                    <div class="airport-route-code">
                        <strong id="pass-dest-code">DXB</strong>
                        <span id="pass-dest-city">دبي</span>
                    </div>
                </div>
                <div class="pass-section">
                    <div class="pass-item">
                        <span>المقعد / SEAT</span>
                        <strong id="pass-seat-no" class="text-primary">12A</strong>
                    </div>
                    <div class="pass-item">
                        <span>بوابة الصعود / GATE</span>
                        <strong id="pass-gate">B4</strong>
                    </div>
                    <div class="pass-item">
                        <span>وقت الصعود / BOARDING</span>
                        <strong id="pass-time">08:00</strong>
                    </div>
                </div>
            </div>
            <div class="pass-footer">
                <div class="barcode-container">
                    <div class="barcode"></div>
                    <div class="barcode-num">GA8986F593DF49</div>
                </div>
                <button id="btn-close-pass" class="btn primary-btn">إغلاق وحفظ</button>
            </div>
        </div>
    </div>

    <script src="js/app.js"></script>
</body>
</html>`;
            const guacamayaStyleCss = `:root {
    --primary: #06D6F2;
    --primary-dark: #04A0B5;
    --bg-deep: #0B0E17;
    --surface: rgba(20, 26, 40, 0.75);
    --surface-solid: #121824;
    --border: rgba(255, 255, 255, 0.08);
    --text: #FFFFFF;
    --text-muted: rgba(255, 255, 255, 0.6);
    --primary-glow: rgba(6, 214, 242, 0.25);
    --font-main: 'Tajawal', sans-serif;
}
html, body {
    margin: 0; padding: 0; height: 100%; width: 100%;
    font-family: var(--font-main); background: var(--bg-deep);
    color: var(--text); overflow: hidden;
}
* { box-sizing: border-box; }
.app-container { display: flex; height: 100vh; width: 100vw; position: relative; }

/* Sidebar Layout */
.sidebar {
    width: 420px; background: var(--surface-solid); border-left: 1px solid var(--border);
    padding: 20px; display: flex; flex-direction: column; overflow-y: auto;
    z-index: 10; box-shadow: -5px 0 25px rgba(0, 0, 0, 0.5); backdrop-filter: blur(20px);
}
@media (max-width: 992px) {
    .app-container { flex-direction: column-reverse; }
    .sidebar { width: 100%; height: 50vh; box-shadow: 0 -5px 25px rgba(0, 0, 0, 0.5); }
}

.brand { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
.logo-icon { font-size: 2rem; color: var(--primary); filter: drop-shadow(0 0 8px var(--primary-glow)); }
.brand-text { font-size: 1.6rem; font-weight: 900; font-family: 'Cairo', sans-serif; }
.brand-sub { color: var(--primary); font-size: 1.1rem; font-weight: 400; }
.intro-text { font-size: 0.8rem; color: var(--text-muted); margin-bottom: 16px; line-height: 1.5; }

/* Tab Control Panels */
.tab-controls { display: flex; gap: 8px; margin-bottom: 20px; border-bottom: 1px solid var(--border); padding-bottom: 12px; }
.tab-btn {
    flex: 1; padding: 10px 6px; background: rgba(255,255,255,0.02); border: 1px solid var(--border);
    border-radius: 8px; color: var(--text-muted); font-size: 0.82rem; font-weight: 700;
    cursor: pointer; transition: all 0.3s; display: flex; align-items: center; justify-content: center; gap: 6px;
}
.tab-btn:hover { color: var(--text); border-color: var(--primary); }
.tab-btn.active { color: #000; background: var(--primary); border-color: var(--primary); box-shadow: 0 0 10px var(--primary-glow); }

.tab-content { display: none; flex-direction: column; gap: 16px; }
.tab-content.active { display: flex; }

/* Booking & Forms */
.panel-title { font-size: 1rem; font-weight: 900; color: var(--primary); margin: 0 0 12px 0; border-bottom: 1px solid var(--border); padding-bottom: 6px; }
.booking-form, .planning-form { display: flex; flex-direction: column; gap: 14px; background: rgba(0,0,0,0.2); padding: 16px; border-radius: 12px; border: 1px solid var(--border); }
.input-group { display: flex; flex-direction: column; gap: 6px; }
.input-group label { font-size: 0.8rem; font-weight: 700; color: var(--text-muted); }
.input-group select, .input-group input {
    padding: 10px 12px; background: rgba(0, 0, 0, 0.4);
    border: 1px solid var(--border); border-radius: 8px; color: var(--text);
    outline: none; font-family: var(--font-main); font-size: 0.85rem; transition: all 0.3s;
}
.input-group select:focus, .input-group input:focus { border-color: var(--primary); box-shadow: 0 0 8px var(--primary-glow); }

.btn { padding: 12px; border: none; border-radius: 8px; font-weight: 900; font-family: var(--font-main); font-size: 0.95rem; cursor: pointer; transition: all 0.3s; text-align: center; }
.primary-btn { background: var(--primary); color: #000; width: 100%; }
.primary-btn:hover:not(.disabled) { background: var(--primary-dark); transform: translateY(-2px); }
.success-btn { background: #10B981; color: #fff; width: 100%; }
.success-btn:hover:not(.disabled) { background: #059669; transform: translateY(-2px); }
.disabled { opacity: 0.4; cursor: not-allowed; }
.hidden { display: none !important; }
.text-primary { color: var(--primary); }
.text-danger { color: #EF4444; }

/* Flights List */
.flights-list { display: flex; flex-direction: column; gap: 10px; max-height: 250px; overflow-y: auto; padding-right: 4px; }
.flight-card {
    background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border); border-radius: 8px;
    padding: 12px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: all 0.3s;
}
.flight-card:hover { border-color: var(--primary); background: rgba(6, 214, 242, 0.03); }
.flight-card.selected { border-color: var(--primary); background: rgba(6, 214, 242, 0.08); box-shadow: 0 0 10px var(--primary-glow); }
.flight-info-left { display: flex; flex-direction: column; gap: 4px; }
.flight-no { font-weight: 900; color: var(--primary); font-size: 0.9rem; }
.flight-route { font-size: 0.8rem; font-weight: bold; }
.flight-time-price { font-size: 0.75rem; color: var(--text-muted); }
.flight-price-tag { font-size: 1.05rem; font-weight: 900; color: var(--primary); }

/* Seat Selection Layout */
.seat-map-section { background: rgba(0,0,0,0.2); padding: 16px; border-radius: 12px; border: 1px solid var(--border); }
.seat-legend { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-bottom: 14px; font-size: 0.7rem; }
.legend-item { display: flex; align-items: center; gap: 4px; }
.legend-item .box { width: 12px; height: 12px; border-radius: 3px; }
.first-class { background: #10B981; }
.business-class { background: #3B82F6; }
.economy-class { background: #F59E0B; }
.occupied { background: #475569; cursor: not-allowed !important; }

.plane-body {
    background: rgba(255,255,255,0.02); border: 2px solid var(--border); border-radius: 50px 50px 20px 20px;
    padding: 24px 16px 16px 16px; display: flex; flex-direction: column; align-items: center; max-height: 250px; overflow-y: auto;
}
.cockpit { font-size: 0.72rem; color: var(--text-muted); border-bottom: 1px solid var(--border); width: 100%; text-align: center; padding-bottom: 8px; margin-bottom: 12px; }
.seats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.seat {
    width: 28px; height: 28px; border-radius: 6px; display: flex; align-items: center; justify-content: center;
    font-size: 0.65rem; font-weight: bold; color: #000; cursor: pointer; transition: all 0.2s;
}
.seat.selected { border: 2px solid #fff; box-shadow: 0 0 8px #fff; transform: scale(1.1); }
.seat-selection-summary { display: flex; justify-content: space-between; font-size: 0.8rem; margin: 12px 0; border-top: 1px solid var(--border); padding-top: 10px; }

/* Admin & Stats */
.admin-scheduled-list { display: flex; flex-direction: column; gap: 8px; max-height: 180px; overflow-y: auto; }
.scheduled-item {
    background: rgba(255,255,255,0.01); border: 1px solid var(--border); border-radius: 6px;
    padding: 8px 12px; display: flex; justify-content: space-between; font-size: 0.8rem;
}
.stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.stat-card { background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border); border-radius: 8px; padding: 12px; text-align: center; }
.stat-title { font-size: 0.7rem; color: var(--text-muted); margin-bottom: 4px; }
.stat-value { font-size: 1.15rem; font-weight: 900; color: var(--primary); }
.recent-bookings-panel { background: rgba(0,0,0,0.1); border-radius: 8px; padding: 12px; margin-top: 10px; }
.recent-bookings-list { display: flex; flex-direction: column; gap: 6px; max-height: 180px; overflow-y: auto; font-size: 0.75rem; }
.booking-log-item { display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.03); padding-bottom: 4px; }

/* Main Map Workspace */
.main-map-container { flex: 1; height: 100%; position: relative; background: #07090F; display: flex; align-items: center; justify-content: center; }
.map-overlay-title { position: absolute; top: 20px; right: 20px; z-index: 5; text-shadow: 0 2px 10px rgba(0,0,0,0.8); }
.map-overlay-title h2 { margin: 0; font-size: 1.4rem; font-weight: 900; font-family: 'Cairo', sans-serif; color: #fff; }
.map-overlay-title p { margin: 4px 0 0 0; font-size: 0.8rem; color: var(--text-muted); }

.svg-map-wrapper { width: 95%; height: 90%; display: flex; align-items: center; justify-content: center; }
#svg-world-map { width: 100%; height: 100%; }

/* Map Path styling */
.restoDelMundo { fill: #1E293B; stroke: #0F172A; stroke-width: 1.5px; transition: fill 0.3s; }
.airport-node { cursor: pointer; }
.airport-core { stroke: #fff; stroke-width: 2px; transition: all 0.3s; }
.airport-glow { animation: pulseGlow 2s infinite; }
.airport-label { fill: #fff; font-size: 16px; font-weight: bold; text-anchor: middle; font-family: var(--font-main); opacity: 0; transition: opacity 0.3s; pointer-events: none; }

.airport-node:hover .airport-core { fill: #fff; stroke: var(--primary); r: 12px; }
.airport-node:hover .airport-label { opacity: 1; }
.airport-node.active .airport-core { fill: #FF007F; stroke: #fff; r: 12px; }
.airport-node.active .airport-label { opacity: 1; fill: #FF007F; }

@keyframes pulseGlow {
    0% { r: 15px; opacity: 0.8; }
    50% { r: 35px; opacity: 0.1; }
    100% { r: 15px; opacity: 0.8; }
}

/* Flight Arcs */
.flight-arc-line { fill: none; stroke: var(--primary); stroke-width: 3px; stroke-dasharray: 6, 6; animation: dash 30s linear infinite; }
.flight-plane-icon { font-size: 24px; fill: var(--primary); text-shadow: 0 0 8px var(--primary); }

@keyframes dash {
    to { stroke-dashoffset: -1000; }
}

/* Airport info overlay popup */
.airport-info-popup {
    position: absolute; bottom: 30px; left: 30px; background: var(--surface-solid); border: 1px solid var(--primary);
    border-radius: 12px; padding: 14px; width: 300px; box-shadow: 0 10px 30px rgba(0,0,0,0.6); z-index: 100;
    backdrop-filter: blur(16px);
}
.popup-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 8px; margin-bottom: 8px; }
.popup-title { font-weight: bold; color: var(--primary); font-size: 0.95rem; }
.close-btn { background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 1.1rem; }
.close-btn:hover { color: #fff; }
.btn-xs { padding: 6px 10px; font-size: 0.72rem; border-radius: 6px; }

/* Boarding Pass Modal */
.modal-overlay {
    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
    background: rgba(0, 0, 0, 0.85); display: flex; align-items: center;
    justify-content: center; z-index: 1000; backdrop-filter: blur(8px);
}
.boarding-pass-card {
    background: #121824; border: 2px solid var(--primary); border-radius: 20px;
    width: 450px; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.8);
    animation: slideUp 0.4s ease-out; direction: rtl;
}
@keyframes slideUp {
    from { transform: translateY(50px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
}
.pass-header { background: var(--primary); padding: 16px; color: #000; display: flex; justify-content: space-between; align-items: center; }
.pass-brand { font-weight: 900; font-size: 1.2rem; font-family: 'Cairo', sans-serif; }
.pass-type { font-size: 0.7rem; font-weight: bold; }
.pass-body { padding: 20px; display: flex; flex-direction: column; gap: 16px; }
.pass-section { display: flex; justify-content: space-between; }
.pass-item { display: flex; flex-direction: column; gap: 4px; }
.pass-item span { font-size: 0.65rem; color: var(--text-muted); }
.pass-item strong { font-size: 0.95rem; }
.travel-route { align-items: center; justify-content: center; gap: 30px; background: rgba(0,0,0,0.2); padding: 12px; border-radius: 10px; }
.airport-route-code { display: flex; flex-direction: column; align-items: center; }
.airport-route-code strong { font-size: 1.8rem; color: var(--primary); font-family: 'Cairo', sans-serif; }
.airport-route-code span { font-size: 0.75rem; color: var(--text-muted); }
.route-plane-icon { font-size: 1.4rem; color: var(--text-muted); transform: rotate(-90deg); }
.pass-footer { padding: 0 20px 20px 20px; display: flex; flex-direction: column; gap: 16px; align-items: center; }
.barcode-container { background: #fff; padding: 10px 20px; border-radius: 8px; display: flex; flex-direction: column; align-items: center; width: 100%; }
.barcode { width: 100%; height: 50px; background: repeating-linear-gradient(90deg, #000, #000 2px, #fff 2px, #fff 8px, #000 8px, #000 12px); }
.barcode-num { font-size: 0.65rem; color: #000; margin-top: 4px; font-family: monospace; letter-spacing: 2px; }
`;
            const guacamayaAppJs = `'use strict';

// 1. Initial State Data
let flights = [
    { id: 1, flightNo: 'GA-201', from: 'MIA', to: 'DXB', time: '08:30', price: 1850, plane: 'Boeing 787 Dreamliner', capacity: 240, bookings: ['4A', '10C', '12F'] },
    { id: 2, flightNo: 'GA-202', from: 'CDG', to: 'JFK', time: '11:15', price: 1100, plane: 'Airbus A350-900', capacity: 300, bookings: ['1A', '2B', '15D', '22E'] },
    { id: 3, flightNo: 'GA-203', from: 'JFK', to: 'MIA', time: '14:45', price: 350, plane: 'Boeing 737 Max', capacity: 160, bookings: ['8B', '12A'] },
    { id: 4, flightNo: 'GA-204', from: 'DXB', to: 'CDG', time: '18:00', price: 1400, plane: 'Boeing 787 Dreamliner', capacity: 240, bookings: [] },
    { id: 5, flightNo: 'GA-205', from: 'CCS', to: 'MIA', time: '09:00', price: 450, plane: 'Boeing 737 Max', capacity: 160, bookings: ['1A', '1B'] },
    { id: 6, flightNo: 'GA-206', from: 'ATL', to: 'JFK', time: '16:30', price: 280, plane: 'Boeing 737 Max', capacity: 160, bookings: [] }
];

let bookings = [
    { passenger: 'أحمد محمود', flightNo: 'GA-201', seat: '4A', price: 1850, date: '2026-06-15' },
    { passenger: 'علي حسن', flightNo: 'GA-202', seat: '15D', price: 1100, date: '2026-06-15' },
    { passenger: 'سارة خالد', flightNo: 'GA-203', seat: '8B', price: 350, date: '2026-06-15' }
];

const airports = {
    MIA: { code: 'MIA', name: 'مطار ميامي الدولي', city: 'ميامي', country: 'أمريكا', x: 358, y: 435 },
    CCS: { code: 'CCS', name: 'مطار سيمون بوليفار الدولي', city: 'كاراكاس', country: 'فنزويلا', x: 394, y: 530 },
    JFK: { code: 'JFK', name: 'مطار جون إف كينيدي', city: 'نيويورك', country: 'أمريكا', x: 414, y: 340 },
    ATL: { code: 'ATL', name: 'مطار هارتسفيلد جاكسون', city: 'أتلانتا', country: 'أمريكا', x: 359, y: 395 },
    DXB: { code: 'DXB', name: 'مطار دبي الدولي', city: 'دبي', country: 'الإمارات', x: 940, y: 440 },
    CDG: { code: 'CDG', name: 'مطار شارل ديغول', city: 'باريس', country: 'فرنسا', x: 733, y: 310 }
};

let activeFlight = null;
let selectedSeat = null;

// 2. Initialization on Window Load
window.onload = function() {
    initApp();
};

function initApp() {
    setupTabControls();
    setupAirportMapInteractions();
    setupSearchFlights();
    setupBookingFormActions();
    setupPlanningForm();
    updateStatistics();
    renderScheduledAdminFlights();
    renderRecentBookingsLog();
}

// Tab Switching
function setupTabControls() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            const tabId = btn.getAttribute('data-tab');
            document.getElementById('tab-' + tabId).classList.add('active');
        });
    });
}

// Map interactions
let activeNode = null;
function setupAirportMapInteractions() {
    document.querySelectorAll('.airport-node').forEach(node => {
        node.addEventListener('click', (e) => {
            const code = node.getAttribute('data-code');
            const airport = airports[code];
            
            // Highlight node
            document.querySelectorAll('.airport-node').forEach(n => n.classList.remove('active'));
            node.classList.add('active');
            activeNode = code;

            // Show popup
            const popup = document.getElementById('airport-info-popup');
            document.getElementById('popup-airport-title').textContent = airport.name;
            document.getElementById('popup-airport-city').textContent = airport.city;
            document.getElementById('popup-airport-country').textContent = airport.country;
            
            popup.classList.remove('hidden');
        });
    });

    document.getElementById('btn-close-popup').addEventListener('click', () => {
        document.getElementById('airport-info-popup').classList.add('hidden');
        document.querySelectorAll('.airport-node').forEach(n => n.classList.remove('active'));
        activeNode = null;
    });

    document.getElementById('btn-set-origin').addEventListener('click', () => {
        if (activeNode) {
            document.getElementById('select-from').value = activeNode;
            document.getElementById('airport-info-popup').classList.add('hidden');
        }
    });

    document.getElementById('btn-set-dest').addEventListener('click', () => {
        if (activeNode) {
            document.getElementById('select-to').value = activeNode;
            document.getElementById('airport-info-popup').classList.add('hidden');
        }
    });
}

// Flight search logic
function setupSearchFlights() {
    document.getElementById('btn-search-flights').addEventListener('click', () => {
        const fromVal = document.getElementById('select-from').value;
        const toVal = document.getElementById('select-to').value;
        
        if (!fromVal || !toVal) {
            alert("يرجى اختيار مطار الإقلاع والوصول!");
            return;
        }

        if (fromVal === toVal) {
            alert("لا يمكن أن يكون مطار الإقلاع والوصول متطابقين!");
            return;
        }

        const filtered = flights.filter(f => f.from === fromVal && f.to === toVal);
        renderFlightResults(filtered);
        
        // Draw route line on the map
        drawRouteArcOnMap(fromVal, toVal);
    });
}

function renderFlightResults(results) {
    const listContainer = document.getElementById('flights-list');
    listContainer.innerHTML = '';
    
    const resultsSection = document.getElementById('search-results-section');
    resultsSection.classList.remove('hidden');
    
    // Hide seat map until a flight is selected
    document.getElementById('seat-map-section').classList.add('hidden');

    if (results.length === 0) {
        listContainer.innerHTML = '<div style="font-size:0.8rem;text-align:center;padding:12px;color:var(--text-muted);">عذراً، لا توجد رحلات مباشرة مجدولة لهذا المسار اليوم. جرب مساراً آخر.</div>';
        return;
    }

    results.forEach(flight => {
        const card = document.createElement('div');
        card.className = 'flight-card';
        card.innerHTML = \\\`
            <div class="flight-info-left">
                <span class="flight-no">\\\${flight.flightNo} (\\\${flight.plane})</span>
                <span class="flight-route">\\\${flight.from} <i class="fa-solid fa-arrow-left-long"></i> \\\${flight.to}</span>
                <span class="flight-time-price">وقت الإقلاع: \\\${flight.time}</span>
            </div>
            <div style="text-align: left;">
                <div class="flight-price-tag">\\\${flight.price} ₪</div>
                <span style="font-size:0.65rem;color:var(--text-muted);">اختر لحجز المقعد</span>
            </div>
        \\\`;
        
        card.addEventListener('click', () => {
            document.querySelectorAll('.flight-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            openSeatSelectionMap(flight);
        });
        
        listContainer.appendChild(card);
    });
}

// Seat Selection Logic
function openSeatSelectionMap(flight) {
    activeFlight = flight;
    selectedSeat = null;
    
    document.getElementById('active-flight-no').textContent = flight.flightNo;
    document.getElementById('selected-seat-label').textContent = 'لم يتم الاختيار';
    document.getElementById('selected-seat-price').textContent = '--';
    
    const confirmBtn = document.getElementById('btn-confirm-booking');
    confirmBtn.classList.add('disabled');
    confirmBtn.setAttribute('disabled', 'true');

    renderSeatsGrid(flight);
    document.getElementById('seat-map-section').classList.remove('hidden');
}

function renderSeatsGrid(flight) {
    const seatsGrid = document.getElementById('seats-grid');
    seatsGrid.innerHTML = '';

    const rows = 10;
    const cols = ['A', 'B', 'C', 'D'];
    
    for (let r = 1; r <= rows; r++) {
        cols.forEach(c => {
            const seatLabel = \\\`\\\${r}\\\${c}\\\`;
            const seat = document.createElement('div');
            
            // Set seat class based on row number
            let seatClass = 'economy-class';
            let seatPrice = flight.price;
            
            if (r <= 2) {
                seatClass = 'first-class';
                seatPrice = Math.round(flight.price * 2.2);
            } else if (r <= 5) {
                seatClass = 'business-class';
                seatPrice = Math.round(flight.price * 1.5);
            }

            const isOccupied = flight.bookings.includes(seatLabel);
            
            seat.className = \\\`seat \\\${isOccupied ? 'occupied' : seatClass}\\\`;
            seat.textContent = seatLabel;
            
            if (!isOccupied) {
                seat.addEventListener('click', () => {
                    const confirmBtn = document.getElementById('btn-confirm-booking');
                    document.querySelectorAll('.seat').forEach(s => s.classList.remove('selected'));
                    
                    if (selectedSeat === seatLabel) {
                        // Deselect
                        selectedSeat = null;
                        document.getElementById('selected-seat-label').textContent = 'لم يتم الاختيار';
                        document.getElementById('selected-seat-price').textContent = '--';
                        confirmBtn.classList.add('disabled');
                        confirmBtn.setAttribute('disabled', 'true');
                    } else {
                        // Select
                        selectedSeat = seatLabel;
                        seat.classList.add('selected');
                        document.getElementById('selected-seat-label').textContent = seatLabel;
                        document.getElementById('selected-seat-price').textContent = seatPrice;
                        
                        confirmBtn.classList.remove('disabled');
                        confirmBtn.removeAttribute('disabled');
                    }
                });
            }
            
            seatsGrid.appendChild(seat);
        });
    }
}

// Confirm booking & print Boarding Pass
function setupBookingFormActions() {
    document.getElementById('btn-confirm-booking').addEventListener('click', () => {
        const passengerName = document.getElementById('passenger-name').value.trim();
        if (!passengerName) {
            alert("يرجى إدخال اسم المسافر أولاً!");
            return;
        }

        if (!activeFlight || !selectedSeat) return;
        
        let seatPrice = activeFlight.price;
        const row = parseInt(selectedSeat);
        if (row <= 2) seatPrice = Math.round(activeFlight.price * 2.2);
        else if (row <= 5) seatPrice = Math.round(activeFlight.price * 1.5);

        // Add to active bookings state
        const newBooking = {
            passenger: passengerName,
            flightNo: activeFlight.flightNo,
            seat: selectedSeat,
            price: seatPrice,
            date: '2026-06-15'
        };

        bookings.unshift(newBooking);
        activeFlight.bookings.push(selectedSeat);
        
        // Show boarding pass
        showBoardingPass(newBooking);
        
        // Update dashboard logs and widgets
        updateStatistics();
        renderRecentBookingsLog();
        
        // Reset inputs and redraw seat grid
        document.getElementById('passenger-name').value = '';
        openSeatSelectionMap(activeFlight);
    });

    document.getElementById('btn-close-pass').addEventListener('click', () => {
        document.getElementById('boarding-pass-modal').classList.add('hidden');
    });
}

function showBoardingPass(booking) {
    const flight = flights.find(f => f.flightNo === booking.flightNo);
    const origin = airports[flight.from];
    const dest = airports[flight.to];

    document.getElementById('pass-passenger-name').textContent = booking.passenger;
    document.getElementById('pass-flight-no').textContent = booking.flightNo;
    document.getElementById('pass-date').textContent = booking.date;
    document.getElementById('pass-seat-no').textContent = booking.seat;
    document.getElementById('pass-time').textContent = flight.time;
    
    document.getElementById('pass-origin-code').textContent = flight.from;
    document.getElementById('pass-origin-city').textContent = origin.city;
    document.getElementById('pass-dest-code').textContent = flight.to;
    document.getElementById('pass-dest-city').textContent = dest.city;

    document.getElementById('boarding-pass-modal').classList.remove('hidden');
}

// SVG Arc drawing logic
function drawRouteArcOnMap(fromCode, toCode) {
    const origin = airports[fromCode];
    const dest = airports[toCode];
    
    const arcGroup = document.getElementById('flight-arcs-group');
    arcGroup.innerHTML = ''; // clear previous arcs
    
    // Draw arc line
    const dx = dest.x - origin.x;
    const dy = dest.y - origin.y;
    const dr = Math.sqrt(dx * dx + dy * dy);
    
    const pathD = \\\`M\\\${origin.x},\\\${origin.y} A\\\${dr},\\\${dr} 0 0,1 \\\${dest.x},\\\${dest.y}\\\`;
    
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathD);
    path.setAttribute('class', 'flight-arc-line');
    path.setAttribute('id', 'temp-flight-arc');
    
    arcGroup.appendChild(path);

    const animatePlane = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    animatePlane.setAttribute('r', '7');
    animatePlane.setAttribute('fill', '#06D6F2');
    animatePlane.setAttribute('filter', 'url(#glow)');
    
    const pathLength = path.getTotalLength();
    let progress = 0;
    
    function step() {
        if (progress >= pathLength) progress = 0;
        progress += 4; // speed
        
        const pt = path.getPointAtLength(progress);
        animatePlane.setAttribute('cx', pt.x);
        animatePlane.setAttribute('cy', pt.y);
        
        requestAnimationFrame(step);
    }
    
    arcGroup.appendChild(animatePlane);
    requestAnimationFrame(step);
}

// Planning / Admin Scheduling Form
function setupPlanningForm() {
    document.getElementById('btn-schedule-flight').addEventListener('click', () => {
        const flightNo = document.getElementById('plan-flight-no').value.trim();
        const from = document.getElementById('plan-from').value;
        const to = document.getElementById('plan-to').value;
        const time = document.getElementById('plan-time').value;
        const price = parseInt(document.getElementById('plan-price').value);
        const plane = document.getElementById('plan-plane').value;

        if (!flightNo || !time || isNaN(price)) {
            alert("يرجى تعبئة كافة حقول الرحلة الجديدة!");
            return;
        }

        if (from === to) {
            alert("لا يمكن أن يكون مطار المغادرة والوصول متطابقين!");
            return;
        }

        // Add to active flight schedule list
        const newFlight = {
            id: flights.length + 1,
            flightNo: flightNo.toUpperCase(),
            from: from,
            to: to,
            time: time,
            price: price,
            plane: plane,
            capacity: plane.includes('Boeing 787') ? 240 : (plane.includes('Airbus') ? 300 : 160),
            bookings: []
        };

        flights.push(newFlight);
        
        // Reset fields
        document.getElementById('plan-flight-no').value = '';
        document.getElementById('plan-price').value = '1200';
        
        // Update lists
        renderScheduledAdminFlights();
        updateStatistics();
        alert(\\\`تمت جدولة الرحلة \\\${newFlight.flightNo} بنجاح!\\\`);
    });
}

function renderScheduledAdminFlights() {
    const adminList = document.getElementById('admin-scheduled-list');
    adminList.innerHTML = '';
    
    flights.forEach(f => {
        const item = document.createElement('div');
        item.className = 'scheduled-item';
        item.innerHTML = \\\`
            <div>
                <strong>\\\${f.flightNo}</strong> | \\\${f.from} <i class="fa-solid fa-arrow-left"></i> \\\${f.to}
                <div style="font-size:0.65rem;color:var(--text-muted);">\\\${f.plane} - الساعة \\\${f.time}</div>
            </div>
            <div style="text-align:left;font-weight:bold;color:var(--primary);">
                \\\${f.price} ₪
                <div style="font-size:0.65rem;color:#10B981;">نشط</div>
            </div>
        \\\`;
        adminList.appendChild(item);
    });
}

// Admin logs & stats widgets
function updateStatistics() {
    const totalFlights = flights.length;
    const ticketsSold = bookings.length;
    
    let totalRevenue = 0;
    bookings.forEach(b => totalRevenue += b.price);
    
    let totalSeats = 0;
    flights.forEach(f => totalSeats += f.capacity);
    
    const occupancyRate = totalSeats > 0 ? Math.round((ticketsSold / totalSeats) * 100) + 12 : 72; // simulated occupancy

    document.getElementById('stat-total-flights').textContent = totalFlights;
    document.getElementById('stat-tickets-sold').textContent = ticketsSold;
    document.getElementById('stat-occupancy-rate').textContent = Math.min(98, occupancyRate) + '%';
    document.getElementById('stat-total-revenue').textContent = '₪ ' + totalRevenue.toLocaleString();
}

function renderRecentBookingsLog() {
    const logContainer = document.getElementById('recent-bookings-list');
    logContainer.innerHTML = '';
    
    bookings.forEach(b => {
        const log = document.createElement('div');
        log.className = 'booking-log-item';
        log.innerHTML = \\\`
            <div>
                <strong>\\\${b.passenger}</strong>
                <div style="font-size:0.65rem;color:var(--text-muted);">المقعد \\\${b.seat} - الرحلة \\\${b.flightNo}</div>
            </div>
            <div style="text-align:left;font-weight:bold;color:#10B981;">
                +\\\${b.price} ₪
                <div style="font-size:0.65rem;color:var(--text-muted);">\\\${b.date}</div>
            </div>
        \\\`;
        logContainer.appendChild(log);
    });
}
`;

            if (isZip) {
                setIsPublishing(true);
                try {
                    if (!window.JSZip) {
                        await new Promise((resolve, reject) => {
                            const script = document.createElement('script');
                            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
                            script.onload = resolve;
                            script.onerror = reject;
                            document.head.appendChild(script);
                        });
                    }
                    const zip = new window.JSZip();
                    zip.file("index.html", guacamayaHtml);
                    zip.folder("css").file("style.css", guacamayaStyleCss);
                    zip.folder("js").file("app.js", guacamayaAppJs);
                    
                    const content = await zip.generateAsync({ type: 'blob' });
                    const downloadUrl = URL.createObjectURL(content);
                    const a = document.createElement('a');
                    a.href = downloadUrl;
                    a.download = `Guacamaya_Airlines_Project_${Date.now()}.zip`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(downloadUrl);
                } catch (err) {
                    console.error("ZIP packaging failed:", err);
                    alert("فشل تصدير المشروع كـ ZIP: " + err.message);
                } finally {
                    setIsPublishing(false);
                }
            } else {
                let bundledHtml = guacamayaHtml
                    .replace('<link rel="stylesheet" href="css/style.css">', `<style>${guacamayaStyleCss}</style>`)
                    .replace('<script src="js/app.js"></script>', `<script>${guacamayaAppJs}</script>`);

                const blob = new Blob([bundledHtml], { type: 'text/html' });
                const downloadUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = downloadUrl;
                a.download = `Guacamaya_Airlines_Design_${Date.now()}.html`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(downloadUrl);
            }
            setIsDesignStudioOpen(false);
            return;
        }

        if (designSelections.commercialTemplate === 'uber') {
            const uberHtml = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${designSelections.uberAppName || 'سفريات بال نوفا'} - حجز سيارات أجرة</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;700;900&family=Tajawal:wght@300;400;700;900&display=swap" rel="stylesheet">
    <link href="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.css" rel="stylesheet" />
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
    <link rel="stylesheet" href="css/style.css">
</head>
<body>
    <div class="app-container">
        <aside class="sidebar">
            <div class="brand">
                <i class="fa-solid fa-car-side logo-icon"></i>
                <span class="brand-text">${designSelections.uberAppName || 'سفريات بال نوفا'}</span>
            </div>
            
            <p class="intro-text">احجز رحلتك بكل سهولة. انقر على الخريطة لتحديد نقطة الانطلاق والوصول.</p>
            
            <div class="booking-form">
                <div class="input-group">
                    <label><i class="fa-solid fa-signature"></i> اسم الخدمة / التطبيق</label>
                    <input type="text" id="app-name-input" value="${designSelections.uberAppName || 'سفريات بال نوفا'}" placeholder="أدخل اسم الخدمة...">
                </div>
                
                <div class="input-group">
                    <label><i class="fa-solid fa-shekel-sign"></i> سعر الكيلومتر (شيكل)</label>
                    <input type="number" id="rate-input" value="${designSelections.uberRatePerKm || 5.0}" min="0.5" step="0.5">
                </div>

                <div class="input-group">
                    <label><i class="fa-solid fa-location-dot pickup-icon"></i> موقع الانطلاق</label>
                    <div class="input-wrapper">
                        <input type="text" id="pickup-input" placeholder="انقر على الخريطة أو حدد الموقع الحالي..." readonly>
                        <button id="gps-btn" title="تحديد موقعي الحالي"><i class="fa-solid fa-crosshairs"></i></button>
                    </div>
                </div>
                
                <div class="input-group">
                    <label><i class="fa-solid fa-flag-checkered dropoff-icon"></i> وجهة الوصول</label>
                    <input type="text" id="dropoff-input" placeholder="انقر على الخريطة لتحديد الوجهة..." readonly>
                </div>
                
                <button id="calculate-btn" class="btn primary-btn disabled" disabled>حساب المسافة والأسعار</button>
            </div>
            
            <div id="ride-options-section" class="ride-options-section hidden">
                <h3 class="section-title">فئات السيارات المتوفرة</h3>
                <div class="ride-options-list">
                    <div class="ride-card selected" data-type="uberx" data-rate="1.2">
                        <i class="fa-solid fa-car-side ride-car-icon"></i>
                        <div class="ride-info">
                            <div class="ride-name">🚗 UberX (اقتصادي)</div>
                            <div class="ride-time">وصول خلال 4 دقائق</div>
                        </div>
                        <div class="ride-price" id="price-uberx">--</div>
                    </div>
                    
                    <div class="ride-card" data-type="comfort" data-rate="1.8">
                        <i class="fa-solid fa-car ride-car-icon comfort-car"></i>
                        <div class="ride-info">
                            <div class="ride-name">🚙 Comfort (مريح)</div>
                            <div class="ride-time">وصول خلال 3 دقائق</div>
                        </div>
                        <div class="ride-price" id="price-comfort">--</div>
                    </div>
                    
                    <div class="ride-card" data-type="premium" data-rate="3.0">
                        <i class="fa-solid fa-user-tie ride-car-icon black-car"></i>
                        <div class="ride-info">
                            <div class="ride-name">🖤 Premium (فاخر)</div>
                            <div class="ride-time">وصول خلال 5 دقائق</div>
                        </div>
                        <div class="ride-price" id="price-premium">--</div>
                    </div>
                </div>
                
                <div class="trip-summary">
                    <div class="summary-item">
                        <span>المسافة الإجمالية:</span>
                        <strong id="trip-distance">--</strong>
                    </div>
                    <div class="summary-item">
                        <span>الزمن التقديري للوصول:</span>
                        <strong id="trip-duration">--</strong>
                    </div>
                </div>
                
                <button id="book-btn" class="btn success-btn">تأكيد طلب الرحلة</button>
            </div>

            <div id="status-section" class="status-section hidden">
                <div class="loader-pulse"></div>
                <h3 id="status-title">جاري البحث عن كابتن...</h3>
                <p id="status-desc" class="status-desc">نبحث عن أقرب كابتن لتلبية طلبك.</p>
                <button id="cancel-btn" class="btn danger-btn">إلغاء الطلب</button>
            </div>
        </aside>

        <main id="map"></main>
    </div>

    <script src="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.js"></script>
    <script src="js/app.js"></script>
</body>
</html>`;
            const uberStyleCss = `:root {
    --primary: #06D6F2;
    --primary-dark: #04A0B5;
    --bg-deep: #050B16;
    --surface: rgba(15, 23, 42, 0.75);
    --surface-solid: #0F172A;
    --border: rgba(255, 255, 255, 0.08);
    --text: #FFFFFF;
    --text-muted: rgba(255, 255, 255, 0.6);
    --primary-glow: rgba(6, 214, 242, 0.25);
    --font-main: 'Tajawal', sans-serif;
}
html, body {
    margin: 0; padding: 0; height: 100%; width: 100%;
    font-family: var(--font-main); background: var(--bg-deep);
    color: var(--text); overflow: hidden;
}
* { box-sizing: border-box; }
.app-container { display: flex; height: 100vh; width: 100vw; position: relative; }
.sidebar {
    width: 380px; background: var(--surface-solid); border-left: 1px solid var(--border);
    padding: 24px; display: flex; flex-direction: column; overflow-y: auto;
    z-index: 10; box-shadow: -5px 0 25px rgba(0, 0, 0, 0.5); backdrop-filter: blur(20px);
}
@media (max-width: 768px) {
    .app-container { flex-direction: column-reverse; }
    .sidebar { width: 100%; height: 50vh; box-shadow: 0 -5px 25px rgba(0, 0, 0, 0.5); }
}
.brand { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
.logo-icon { font-size: 2rem; color: var(--primary); filter: drop-shadow(0 0 8px var(--primary-glow)); }
.brand-text { font-size: 1.8rem; font-weight: 900; font-family: 'Cairo', sans-serif; }
.brand-sub { color: var(--primary); font-size: 1.2rem; font-weight: 400; }
.intro-text { font-size: 0.85rem; color: var(--text-muted); margin-bottom: 24px; line-height: 1.6; }
.booking-form { display: flex; flex-direction: column; gap: 16px; margin-bottom: 24px; }
.input-group { display: flex; flex-direction: column; gap: 6px; }
.input-group label { font-size: 0.85rem; font-weight: 700; color: var(--primary); display: flex; align-items: center; gap: 8px; }
.pickup-icon { color: #10B981; }
.dropoff-icon { color: #EF4444; }
.input-wrapper { display: flex; gap: 8px; }
.booking-form input {
    flex: 1; padding: 12px 16px; background: rgba(0, 0, 0, 0.3);
    border: 1px solid var(--border); border-radius: 10px; color: var(--text);
    outline: none; font-family: var(--font-main); font-size: 0.88rem; transition: all 0.3s;
}
.booking-form input:focus { border-color: var(--primary); box-shadow: 0 0 10px var(--primary-glow); }
#gps-btn {
    width: 45px; background: var(--surface); border: 1px solid var(--border);
    border-radius: 10px; color: var(--primary); cursor: pointer; transition: all 0.3s;
    display: flex; align-items: center; justify-content: center;
}
#gps-btn:hover { background: var(--primary); color: #000; border-color: var(--primary); }
.btn { padding: 14px; border: none; border-radius: 10px; font-weight: 900; font-family: var(--font-main); font-size: 1rem; cursor: pointer; transition: all 0.3s; text-align: center; }
.primary-btn { background: var(--primary); color: #000; }
.primary-btn:hover:not(.disabled) { background: var(--primary-dark); transform: translateY(-2px); }
.success-btn { background: #10B981; color: #fff; width: 100%; }
.success-btn:hover { background: #059669; transform: translateY(-2px); }
.danger-btn { background: #EF4444; color: #fff; width: 100%; }
.danger-btn:hover { background: #DC2626; }
.disabled { opacity: 0.4; cursor: not-allowed; }
.hidden { display: none !important; }
.ride-options-section { margin-top: 10px; display: flex; flex-direction: column; gap: 16px; }
.section-title { font-size: 1rem; font-weight: 900; color: var(--primary); margin: 0; }
.ride-options-list { display: flex; flex-direction: column; gap: 10px; }
.ride-card { background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border); border-radius: 12px; padding: 16px; display: flex; align-items: center; gap: 16px; cursor: pointer; transition: all 0.3s; }
.ride-card:hover { border-color: var(--primary); background: rgba(6, 214, 242, 0.05); }
.ride-card.selected { border-color: var(--primary); background: rgba(6, 214, 242, 0.1); box-shadow: 0 0 15px var(--primary-glow); }
.ride-car-icon { font-size: 1.8rem; color: var(--primary); }
.comfort-car { color: #3B82F6; }
.black-car { color: #e2e8f0; }
.ride-info { flex: 1; text-align: right; }
.ride-name { font-weight: 700; font-size: 0.95rem; }
.ride-time { font-size: 0.75rem; color: var(--text-muted); margin-top: 2px; }
.ride-price { font-weight: 900; font-size: 1.1rem; color: var(--primary); }
.trip-summary { background: rgba(0, 0, 0, 0.2); border-radius: 10px; padding: 12px 16px; display: flex; flex-direction: column; gap: 8px; font-size: 0.85rem; }
.summary-item { display: flex; justify-content: space-between; }
.summary-item strong { color: var(--primary); }
.status-section { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 20px 0; gap: 16px; }
.loader-pulse { width: 60px; height: 60px; border-radius: 50%; background: var(--primary); animation: pulse 1.8s infinite ease-in-out; }
.status-desc { font-size: 0.85rem; color: var(--text-muted); line-height: 1.5; }
@keyframes pulse {
    0% { transform: scale(0.6); opacity: 0.8; }
    50% { transform: scale(1.1); opacity: 0.4; }
    100% { transform: scale(0.6); opacity: 0.8; }
}
#map { flex: 1; height: 100%; }
.driver-marker { animation: rotateCar 0.3s ease-in-out; }
`;
            const uberAppJs = `'use strict';
let map;
let pickupMarker = null;
let dropoffMarker = null;
let driverMarker = null;
let pickupCoords = null;
let dropoffCoords = null;
let distanceKm = 0;
let routeLineId = 'trip-route';

function initMap() {
    const key = 'N6uNP3sTu25OIBUyi9G1';
    map = new maplibregl.Map({
        container: 'map',
        style: \`https://api.maptiler.com/maps/streets-v2/style.json?key=\${key}\`,
        center: [35.9106, 31.9539],
        zoom: 12
    });

    map.addControl(new maplibregl.NavigationControl(), 'bottom-right');

    map.on('click', (e) => {
        const coords = [e.lngLat.lng, e.lngLat.lat];
        handleMapClick(coords);
    });

    document.getElementById('gps-btn').addEventListener('click', () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((pos) => {
                const coords = [pos.coords.longitude, pos.coords.latitude];
                map.flyTo({ center: coords, zoom: 14 });
                handleMapClick(coords);
            }, () => {
                alert('فشل تحديد الموقع الجغرافي. يرجى تفعيل الـ GPS والتحقق من صلاحية الموقع.');
            }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
        }
    });

    const calcBtn = document.getElementById('calculate-btn');
    calcBtn.addEventListener('click', () => {
        calculateTrip();
    });

    const cards = document.querySelectorAll('.ride-card');
    cards.forEach(card => {
        card.addEventListener('click', () => {
            cards.forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
        });
    });

    document.getElementById('book-btn').addEventListener('click', () => {
        startBooking();
    });

    document.getElementById('cancel-btn').addEventListener('click', () => {
        resetTrip();
    });

    document.getElementById('app-name-input').addEventListener('input', (e) => {
        const val = e.target.value.trim() || 'سفريات بال نوفا';
        document.querySelector('.brand-text').textContent = val;
    });
}

function handleMapClick(coords) {
    if (!pickupCoords) {
        pickupCoords = coords;
        document.getElementById('pickup-input').value = \`\${coords[1].toFixed(5)}, \${coords[0].toFixed(5)}\`;
        const el = document.createElement('div');
        el.className = 'custom-marker';
        el.innerHTML = '<i class="fa-solid fa-location-dot" style="font-size:24px; color:#10B981; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4));"></i>';
        
        pickupMarker = new maplibregl.Marker({ element: el })
            .setLngLat(coords)
            .addTo(map);
            
    } else if (!dropoffCoords) {
        dropoffCoords = coords;
        document.getElementById('dropoff-input').value = \`\${coords[1].toFixed(5)}, \${coords[0].toFixed(5)}\`;
        const el = document.createElement('div');
        el.className = 'custom-marker';
        el.innerHTML = '<i class="fa-solid fa-flag-checkered" style="font-size:24px; color:#EF4444; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4));"></i>';
        
        dropoffMarker = new maplibregl.Marker({ element: el })
            .setLngLat(coords)
            .addTo(map);

        const calcBtn = document.getElementById('calculate-btn');
        calcBtn.classList.remove('disabled');
        calcBtn.removeAttribute('disabled');
    }
}

function calculateDistance(c1, c2) {
    const R = 6371;
    const dLat = (c2[1] - c1[1]) * Math.PI / 180;
    const dLon = (c2[0] - c1[0]) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(c1[1] * Math.PI / 180) * Math.cos(c2[1] * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function generateRouteCoordinates(start, end) {
    const coords = [start];
    const segments = 8;
    for (let i = 1; i < segments; i++) {
        const ratio = i / segments;
        let lng = start[0] + (end[0] - start[0]) * ratio;
        let lat = start[1] + (end[1] - start[1]) * ratio;
        if (i % 2 === 1) {
            lng += (end[0] - start[0]) * 0.05 * (Math.random() > 0.5 ? 1 : -1);
        } else {
            lat += (end[1] - start[1]) * 0.05 * (Math.random() > 0.5 ? 1 : -1);
        }
        coords.push([lng, lat]);
    }
    coords.push(end);
    return coords;
}

async function calculateTrip() {
    if (!pickupCoords || !dropoffCoords) return;
    
    const calcBtn = document.getElementById('calculate-btn');
    const originalText = calcBtn.textContent;
    calcBtn.textContent = 'جاري رسم المسار وحساب التكلفة...';
    calcBtn.classList.add('disabled');
    calcBtn.setAttribute('disabled', 'true');

    let routeCoords = null;
    try {
        const url = \`https://router.project-osrm.org/route/v1/driving/\${pickupCoords[0]},\${pickupCoords[1]};\${dropoffCoords[0]},\${dropoffCoords[1]}?overview=full&geometries=geojson\`;
        const res = await fetch(url);
        const data = await res.json();
        
        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
            const route = data.routes[0];
            distanceKm = route.distance / 1000;
            const durationMin = Math.round(route.duration / 60);
            document.getElementById('trip-duration').textContent = \`\${durationMin} دقيقة\`;
            routeCoords = route.geometry.coordinates;
        } else {
            throw new Error('OSRM routing failed');
        }
    } catch (err) {
        console.warn('OSRM routing failed, using fallback:', err);
        distanceKm = calculateDistance(pickupCoords, dropoffCoords);
        const durationMin = Math.round(distanceKm * 1.5 + 2);
        document.getElementById('trip-duration').textContent = \`\${durationMin} دقيقة\`;
        routeCoords = generateRouteCoordinates(pickupCoords, dropoffCoords);
    }

    calcBtn.textContent = originalText;
    calcBtn.classList.remove('disabled');
    calcBtn.removeAttribute('disabled');

    document.getElementById('trip-distance').textContent = \`\${distanceKm.toFixed(2)} كم\`;
    
    // Read price per km from rate input
    const ratePerKm = parseFloat(document.getElementById('rate-input').value) || 5.0;
    
    const uberxPrice = Math.max(10, distanceKm * ratePerKm);
    const comfortPrice = Math.max(15, distanceKm * ratePerKm * 1.5);
    const premiumPrice = Math.max(25, distanceKm * ratePerKm * 2.5);
    
    document.getElementById('price-uberx').textContent = \`\${uberxPrice.toFixed(2)} ₪\`;
    document.getElementById('price-comfort').textContent = \`\${comfortPrice.toFixed(2)} ₪\`;
    document.getElementById('price-premium').textContent = \`\${premiumPrice.toFixed(2)} ₪\`;

    drawRouteLine(routeCoords);

    document.getElementById('ride-options-section').classList.remove('hidden');
    document.getElementById('calculate-btn').classList.add('hidden');
    
    const bounds = new maplibregl.LngLatBounds(pickupCoords, pickupCoords);
    bounds.extend(dropoffCoords);
    map.fitBounds(bounds, { padding: 60 });
}

function drawRouteLine(coordinates) {
    if (map.getLayer(routeLineId)) map.removeLayer(routeLineId);
    if (map.getSource(routeLineId)) map.removeSource(routeLineId);

    map.addSource(routeLineId, {
        type: 'geojson',
        data: {
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'LineString',
                coordinates: coordinates
            }
        }
    });

    map.addLayer({
        id: routeLineId,
        type: 'line',
        source: routeLineId,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#06D6F2', 'line-width': 5, 'line-opacity': 0.85 }
    });
}

let bookingInterval = null;
function startBooking() {
    document.getElementById('ride-options-section').classList.add('hidden');
    const statusSection = document.getElementById('status-section');
    statusSection.classList.remove('hidden');
    
    const statusTitle = document.getElementById('status-title');
    const statusDesc = document.getElementById('status-desc');
    statusTitle.textContent = "جاري البحث عن كابتن...";
    statusDesc.textContent = "نبحث عن أقرب كابتن لتلبية طلبك.";

    setTimeout(() => {
        statusTitle.textContent = "تم قبول الرحلة!";
        statusDesc.textContent = "الكابتن أحمد (كيا سيراتو بيضاء - 24-5867) قادم إليك الآن.";
        
        const driverStart = [
            pickupCoords[0] + (Math.random() - 0.5) * 0.015,
            pickupCoords[1] + (Math.random() - 0.5) * 0.015
        ];
        
        const el = document.createElement('div');
        el.className = 'driver-marker';
        el.innerHTML = '<i class="fa-solid fa-car-side" style="font-size:24px; color:#06D6F2; filter: drop-shadow(0 2px 6px rgba(6,214,242,0.6));"></i>';
        
        driverMarker = new maplibregl.Marker({ element: el })
            .setLngLat(driverStart)
            .addTo(map);

        let steps = 50;
        let step = 0;
        bookingInterval = setInterval(() => {
            step++;
            const ratio = step / steps;
            const lng = driverStart[0] + (pickupCoords[0] - driverStart[0]) * ratio;
            const lat = driverStart[1] + (pickupCoords[1] - driverStart[1]) * ratio;
            
            if (driverMarker) driverMarker.setLngLat([lng, lat]);
            
            if (step >= steps) {
                clearInterval(bookingInterval);
                statusTitle.textContent = "وصل الكابتن!";
                statusDesc.textContent = "الكابتن أحمد متواجد في موقع الانطلاق بانتظارك.";
                alert("وصل الكابتن إلى موقعك!");
            }
        }, 100);

    }, 3000);
}

function resetTrip() {
    clearInterval(bookingInterval);
    if (pickupMarker) pickupMarker.remove();
    if (dropoffMarker) dropoffMarker.remove();
    if (driverMarker) driverMarker.remove();
    
    if (map.getLayer(routeLineId)) map.removeLayer(routeLineId);
    if (map.getSource(routeLineId)) map.removeSource(routeLineId);

    pickupMarker = null;
    dropoffMarker = null;
    driverMarker = null;
    pickupCoords = null;
    dropoffCoords = null;
    distanceKm = 0;

    document.getElementById('pickup-input').value = '';
    document.getElementById('dropoff-input').value = '';
    
    document.getElementById('ride-options-section').classList.add('hidden');
    document.getElementById('status-section').classList.add('hidden');
    
    const calcBtn = document.getElementById('calculate-btn');
    calcBtn.classList.remove('hidden');
    calcBtn.classList.add('disabled');
    calcBtn.setAttribute('disabled', 'true');
    
    map.flyTo({ center: [35.9106, 31.9539], zoom: 12 });
}

window.onload = initMap;
`;

            if (isZip) {
                setIsPublishing(true);
                try {
                    if (!window.JSZip) {
                        await new Promise((resolve, reject) => {
                            const script = document.createElement('script');
                            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
                            script.onload = resolve;
                            script.onerror = reject;
                            document.head.appendChild(script);
                        });
                    }
                    const zip = new window.JSZip();
                    zip.file("index.html", uberHtml);
                    zip.folder("css").file("style.css", uberStyleCss);
                    zip.folder("js").file("app.js", uberAppJs);
                    
                    const content = await zip.generateAsync({ type: 'blob' });
                    const downloadUrl = URL.createObjectURL(content);
                    const a = document.createElement('a');
                    a.href = downloadUrl;
                    a.download = `Uber_Web_Clone_Project_${Date.now()}.zip`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(downloadUrl);
                } catch (err) {
                    console.error("ZIP packaging failed:", err);
                    alert("فشل تصدير المشروع كـ ZIP: " + err.message);
                } finally {
                    setIsPublishing(false);
                }
            } else {
                let bundledHtml = uberHtml
                    .replace('<link rel="stylesheet" href="css/style.css">', `<style>${uberStyleCss}</style>`)
                    .replace('<script src="js/app.js"></script>', `<script>${uberAppJs}</script>`);

                const blob = new Blob([bundledHtml], { type: 'text/html' });
                const downloadUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = downloadUrl;
                a.download = `Uber_Web_Clone_Design_${Date.now()}.html`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(downloadUrl);
            }
            setIsDesignStudioOpen(false);
            return;
        }

        if (designSelections.commercialTemplate === 'covid19') {
            const covidHtml = `<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <!-- Favicon -->
    <link rel="shortcut icon" href="favicon.ico" type="image/x-icon">

    <!-- Bootstrap -->
    <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.4.1/css/bootstrap.min.css"
        integrity="sha384-Vkoo8x4CGsO3+Hhxv8T/Q5PaXtkKtu6ug5TOeNV6gBiFeWPGFN9MuhOf23Q9Ifjh" crossorigin="anonymous">
    <script src="https://code.jquery.com/jquery-3.4.1.slim.min.js"
        integrity="sha384-J6qa4849blE2+poT4WnyKhv5vZF5SrPo0iEjwBvKU7imGFAV0wwj1yYfoRSJoZ+n"
        crossorigin="anonymous"></script>
    <script src="https://cdn.jsdelivr.net/npm/popper.js@1.16.0/dist/umd/popper.min.js"
        integrity="sha384-Q6E9RHvbIyZFJoft+2mJbHaEWldlvI9IOYy5n3zV9zzTtmI3UksdQRVvoxMfooAo"
        crossorigin="anonymous"></script>
    <script src="https://stackpath.bootstrapcdn.com/bootstrap/4.4.1/js/bootstrap.min.js"
        integrity="sha384-wfSDF2E50Y2D1uUdj0O3uMBJnjuUD4Ih7YwaYd1iqfktj0Uod8GCExl3Og8ifwB6"
        crossorigin="anonymous"></script>

    <!-- Material Icons -->
    <link rel="stylesheet" href="https://fonts.googleapis.com/icon?family=Material+Icons">
    <!-- Font Awesome icons -->
    <script src="https://kit.fontawesome.com/358c7d921e.js" crossorigin="anonymous"></script>

    <!-- Custom stylesheets -->
    <link rel="stylesheet" href="css/style.css">
    <link rel="stylesheet" href="css/loader.css">
    <link rel="stylesheet" href="css/errorModal.css">
    <!-- Custom scripts -->
    <script defer src="js/constants.js"></script>
    <script defer src="js/util.js"></script>
    <script defer src="js/index.js"></script>

    <script src="https://unpkg.com/@google/markerclustererplus@4.0.1/dist/markerclustererplus.min.js"></script>
    <script defer
        src="https://maps.googleapis.com/maps/api/js?key=AIzaSyAKBXdCmWV-2chRvozRWUQnT2W2nYnQy2E&callback=initMap"></script>

    <title>Mapa de casos y estadísticas COVID-19</title>
</head>

<body>
    <h1 class="tituloMapa">Mapa de casos y estadísticas <b class="virusType">COVID-19</b></h1>
    <div class="container-fluid" id="first-row">
        <div class="row">
            <div class="col-12 col-lg-9">
                <div id="map"></div>
            </div>
            <div class="col-12 col-lg-3 mt-3">
                <div class="card text-center">
                    <div class="card-header font-weight-bold text text-uppercase">
                        Casos confirmados por país
                    </div>
                    <div class="card-body d-flex justify-content-center">
                        <table id="countryCasesTable">
                            <thead>
                                <tr>
                                    <th>Pos.</th>
                                    <th>País</th>
                                    <th>Casos</th>
                                </tr>
                            </thead>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="container-fluid mt-3" id="global-stats">
        <div class="card-deck">
            <div class="card text-center">
                <div class="card-header font-weight-bold text-uppercase">
                    Última actualización
                </div>
                <div class="card-body d-flex justify-content-center align-items-center">
                    <span id="lastUpdated"></span>
                </div>
            </div>
            <div class="card text-center">
                <div class="card-header font-weight-bold text-uppercase">
                    Casos confirmados
                </div>
                <div class="card-body text-secondary d-flex justify-content-center align-items-center">
                    <span id="globalConfirmedCases"></span>
                </div>
            </div>
            <div class="card text-center">
                <div class="card-header font-weight-bold text-uppercase">
                    Casos activos
                </div>
                <div class="card-body text-warning d-flex justify-content-center align-items-center">
                    <span id="globalActiveCases"></span>
                </div>
            </div>
            <div class="card text-center">
                <div class="card-header font-weight-bold text-uppercase">
                    Casos cerrados
                </div>
                <div id="recovered-deaths" class="card-body d-flex justify-content-center">
                    <div class="row">
                        <div class="col">
                            <h6>Recuperados</h6>
                            <div>
                                <span id="globalRecovered" class="text-success"></span>
                            </div>
                        </div>
                        <div class="col">
                            <h6>Muertes</h6>
                            <div>
                                <span id="globalDeaths" class="text-danger"></span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <footer class="container-fluid mt-4">
        <div class="row border bg-light d-flex justify-content-center">
            <div class="col d-flex justify-content-around align-items-center p-2">
                <a href="#" data-toggle="modal" data-target="#modalAbout">Acerca de</a>
                <a href="#" data-toggle="modal" data-target="#modalSource">Fuente</a>
                <a href="#" data-toggle="modal" data-target="#modalCredits">Créditos</a>
            </div>
        </div>
    </footer>

    <div class="googleMapMarkerContainer">
        <div class="googleMapMarker">
            <div style="display:flex; flex-direction: column; align-items: center; padding-bottom: 1em;">
                <img class="countryFlag" style="width: 60%;">
            </div>
            <div style="display:flex; flex-direction: column; align-items: center;">
                <div>
                    <b>Casos: </b><span id="cases"></span><br>
                </div>
                <div>
                    <b>Muertes: </b><span id="deaths"></span><br>
                </div>
                <div>
                    <b>Recuperados: </b><span id="recovered"></span><br>
                </div>
            </div>
        </div>
    </div>

    <div class="googleMapRightControlContainer">
        <div class="googleMapRightControl">
            <div style="display:flex; flex-direction: column; align-items: center; padding-bottom: 1em;">
                <img class="countryFlag" style="width: 60%;">
                <h5 style="margin: 3px 0 0 0;" id="countryName"></h5>
            </div>
            <div style="display:flex; justify-content: center;">
                <table>
                    <tr>
                        <td><b>Casos</b></td>
                        <td id="casesCell"></td>
                    </tr>
                    <tr>
                        <td><b>Nuevos hoy</b></td>
                        <td id="todayCasesCell"></td>
                    </tr>
                    <tr>
                        <td><b>Muertes</b></td>
                        <td id="deathsCell"></td>
                    </tr>
                    <tr>
                        <td><b>Muertes hoy</b></td>
                        <td id="todayDeathsCell"></td>
                    </tr>
                    <tr>
                        <td><b>Recuperados</b></td>
                        <td id="recoveredCell"></td>
                    </tr>
                    <tr>
                        <td><b>Activos</b></td>
                        <td id="activeCasesCell"></td>
                    </tr>
                    <tr>
                        <td><b>Críticos</b></td>
                        <td id="criticalCasesCell"></td>
                    </tr>
                    <tr>
                        <td><b>Casos/millón</b></td>
                        <td id="casesPerMillionCell"></td>
                    </tr>
                </table>
            </div>
        </div>
    </div>

    <!-- Modal Loading -->
    <div id="modalLoading" class="modal fade" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content">
                <div class="modal-body text-center">
                    <div class="lds-ellipsis">
                        <div></div>
                        <div></div>
                        <div></div>
                        <div></div>
                    </div>
                    <h5 class="modal-title">Obteniendo datos...</h5>
                </div>
            </div>
        </div>
    </div>

    <!-- Modal About -->
    <div class="modal fade" id="modalAbout" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content">
                <div class="modal-header">
                    <div class="d-flex align-items-center">
                        <i class="fas fa-info-circle"></i>
                        <h5 class="modal-title">Acerca de</h5>
                    </div>
                    <button type="button" class="close" data-dismiss="modal">
                        <span>&times;</span>
                    </button>
                </div>
                <div class="modal-body text-justify">
                    <p>
                        Este mapa fue creado por estudiantes de 6° semestre de la carrera
                        de Ingeniería de Software y Sistemas Computacionales de la
                        Universidad De La Salle Bajío, con la finalidad de informar a la
                        comunidad sobre la expansión del COVID-19 a nivel mundial y por
                        país.
                    </p>

                    <a class="btn btn-primary" data-toggle="collapse" href="#collapseExample">Info. para
                        desarrolladores</a>
                    <div class="collapse" id="collapseExample">
                        <div class="card card-body">
                            <ul class="list-group">
                                <li class="list-group-item">
                                    <span>
                                        El código fuente del sitio puede ser consultado
                                        <a href="https://github.com/nibble-4bits/COVID-19-Map">aquí</a>.
                                    </span>
                                </li>
                                <li class="list-group-item">
                                    <span>
                                        La obtención de los datos se hace a través de esta
                                        <a href="https://disease.sh/" target="_blank">API</a>.
                                    </span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-primary" data-dismiss="modal">
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Modal Source -->
    <div class="modal fade" id="modalSource" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content">
                <div class="modal-header">
                    <div class="d-flex align-items-center">
                        <i class="fas fa-search"></i>
                        <h5 class="modal-title">Fuente</h5>
                    </div>
                    <button type="button" class="close" data-dismiss="modal">
                        <span>&times;</span>
                    </button>
                </div>
                <div class="modal-body text-center">
                    Todos los datos son obtenidos de
                    <a href="https://www.worldometers.info/coronavirus/"
                        target="_blank">worldometers.info/coronavirus</a>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-primary" data-dismiss="modal">
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Modal Credits -->
    <div class="modal fade" id="modalCredits" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content">
                <div class="modal-header">
                    <div class="d-flex align-items-center">
                        <i class="fas fa-hands-helping"></i>
                        <h5 class="modal-title">Créditos</h5>
                    </div>
                    <button type="button" class="close" data-dismiss="modal">
                        <span>&times;</span>
                    </button>
                </div>
                <div class="modal-body text-center">
                    <p>
                        <b>Crédito para todos los estudiantes de 6° semestre de Ingeniería de Software y Sistemas
                            Computacionales</b>
                    </p>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-primary" data-dismiss="modal">
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Modal Error -->
    <div id="modalError" class="modal fade">
        <div class="modal-dialog modal-confirm">
            <div class="modal-content">
                <div class="modal-header">
                    <div class="icon-box">
                        <i class="material-icons">&#xE5CD;</i>
                    </div>
                    <h4 class="modal-title">¡Lo sentimos!</h4>
                </div>
                <div class="modal-body">
                    <p class="text-center">
                        Ha ocurrido un error al intentar obtener los datos más recientes.
                        Por favor inténtelo de nuevo más tarde.
                    </p>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-danger btn-block" data-dismiss="modal">
                        OK
                    </button>
                </div>
            </div>
        </div>
    </div>
</body>

</html>`;
            const covidStyleCss = `@import url('https://fonts.googleapis.com/css?family=Roboto&display=swap');

body {
    min-height: 100%;
    background-color: #efefef;
    font-family: 'Roboto', sans-serif !important;
}

.tituloMapa {
    text-align: center;
    font-family: 'Gill Sans', 'Gill Sans MT', Calibri, 'Trebuchet MS', sans-serif;
    border-bottom: 1px solid #ccc;
}

.virusType {
    color: #df0505;
}

#first-row .card-body {
    max-height: 35vh;
    overflow-y: auto;
}

@media only screen and (min-width: 992px) {
    #first-row .row {
        overflow: hidden;
    }

    #first-row .card {
        height: 100%;
    }

    #first-row .card-body {
        min-height: 90%;
        overflow-y: auto;
    }
}

#countryCasesTable {
    width: 90%;
}

#countryCasesTable th,
#countryCasesTable td {
    border-bottom: 1px solid #ccc;
}

#countryCasesTable tr:hover :not(th) {
    background-color: rgb(220, 220, 220);
    cursor: pointer;
}

#map {
    height: 75vh;
}

#global-stats .card-header {
    font-size: 95%;
}

#global-stats span {
    font-size: 2.75vh;
    font-weight: 500;
}

#recovered-deaths h6 {
    margin: 0;
}

@media only screen and (min-width: 768px) {
    footer .row div {
        max-width: 50%;
    }
}

@media only screen and (min-width: 1200px) {
    footer .row div {
        max-width: 25%;
    }
}

#modalAbout .modal-title,
#modalSource .modal-title,
#modalCredits .modal-title {
    margin-left: 7.5px;
}

.googleMapMarkerContainer {
    display: none;
}

.googleMapMarker {
    max-width: 10em;
}

.googleMapRightControlContainer {
    display: none;
}

.googleMapRightControl {
    background: #efefef;
    border-top-left-radius: 10px;
    border-bottom-left-radius: 10px;
    padding: 1rem;
    width: 225px;
    font-size: 1.125rem;
    opacity: 1;
}

.googleMapRightControl td:nth-child(1) {
    padding: 0.125rem 1rem;
    text-align: right;
}

@media only screen and (max-width: 850px) {
    .googleMapRightControl {
        padding: 20px;
        width: 120px !important;
        font-size: 10px;
    }

    .googleMapRightControl td:nth-child(1) {
        padding: 0.125rem 0.5rem;
        text-align: right;
    }
}`;
            const covidLoaderCss = `.lds-ellipsis {
  display: inline-block;
  position: relative;
  width: 80px;
  height: 80px;
}

.lds-ellipsis div {
  position: absolute;
  top: 33px;
  width: 13px;
  height: 13px;
  border-radius: 50%;
  background: #a4a4a4;
  animation-timing-function: cubic-bezier(0, 1, 1, 0);
}

.lds-ellipsis div:nth-child(1) {
  left: 8px;
  animation: lds-ellipsis1 0.6s infinite;
}

.lds-ellipsis div:nth-child(2) {
  left: 8px;
  animation: lds-ellipsis2 0.6s infinite;
}

.lds-ellipsis div:nth-child(3) {
  left: 32px;
  animation: lds-ellipsis2 0.6s infinite;
}

.lds-ellipsis div:nth-child(4) {
  left: 56px;
  animation: lds-ellipsis3 0.6s infinite;
}

@keyframes lds-ellipsis1 {
  0% {
    transform: scale(0);
  }
  100% {
    transform: scale(1);
  }
}

@keyframes lds-ellipsis3 {
  0% {
    transform: scale(1);
  }
  100% {
    transform: scale(0);
  }
}

@keyframes lds-ellipsis2 {
  0% {
    transform: translate(0, 0);
  }
  100% {
    transform: translate(24px, 0);
  }
}`;
            const covidErrorModalCss = `body {
    font-family: 'Varela Round', sans-serif;
}

.modal-confirm {
    color: #636363;
    width: 325px;
}

.modal-confirm .modal-content {
    padding: 20px;
    border-radius: 5px;
    border: none;
}

.modal-confirm .modal-header {
    border-bottom: none;
    position: relative;
}

.modal-confirm h4 {
    text-align: center;
    font-size: 26px;
    margin: 30px 0 -15px;
}

.modal-confirm .form-control, .modal-confirm .btn {
    min-height: 40px;
    border-radius: 3px;
}

.modal-confirm .close {
    position: absolute;
    top: -5px;
    right: -5px;
}

.modal-confirm .modal-footer {
    border: none;
    text-align: center;
    border-radius: 5px;
    font-size: 13px;
}

.modal-confirm .icon-box {
    color: #fff;
    position: absolute;
    margin: 0 auto;
    left: 0;
    right: 0;
    top: -70px;
    width: 95px;
    height: 95px;
    border-radius: 50%;
    z-index: 9;
    background: #ef513a;
    padding: 15px;
    text-align: center;
    box-shadow: 0px 2px 2px rgba(0, 0, 0, 0.1);
}

.modal-confirm .icon-box i {
    font-size: 56px;
    position: relative;
    top: 4px;
}

.modal-confirm.modal-dialog {
    margin-top: 80px;
}

.modal-confirm .btn {
    color: #fff;
    border-radius: 4px;
    background: #ef513a;
    text-decoration: none;
    transition: all 0.4s;
    line-height: normal;
    border: none;
}

.modal-confirm .btn:hover, .modal-confirm .btn:focus {
    background: #da2c12;
    outline: none;
}

.trigger-btn {
    display: inline-block;
    margin: 100px auto;
}`;
            const covidConstantsJs = `'use strict';

const BASE_API_URL = 'https://disease.sh/v3/covid-19';

// DOM elements
const tblCountryCases = document.getElementById('countryCasesTable');
const divLastUpdated = document.getElementById('lastUpdated');
const divGlobalConfirmedCases = document.getElementById('globalConfirmedCases');
const divGlobalActiveCases = document.getElementById('globalActiveCases');
const divGlobalRecovered = document.getElementById('globalRecovered');
const divGlobalDeaths = document.getElementById('globalDeaths');`;
            const covidUtilJs = `'use strict';

/**
 * Saves a JSON string to the local storage
 * @param {String} key 
 * @param {Object} jsonData 
 */
function cacheAPIData(key, jsonData) {
    localStorage.setItem(key, JSON.stringify(jsonData));
}

/**
 * Gets an object saved in the local storage
 * @param {String} key 
 */
function retrieveCachedAPIData(key) {
    return JSON.parse(localStorage.getItem(key));
}

async function showModal(modalId) {
    \$(modalId).modal({ backdrop: 'static', keyboard: true, show: true });
    return new Promise((resolve, reject) => {
        \$(modalId).on('shown.bs.modal', evt => {
            resolve();
        });
    });
}

async function hideModal(modalId) {
    \$(modalId).modal('hide');
    return new Promise((resolve, reject) => {
        \$(modalId).on('hidden.bs.modal', evt => {
            resolve();
        });
    });
}
`;
            const covidIndexJs = `'use strict';

const objInfoWindows = {};
const markers = {};

async function initMap() {
    const mapProps = {
        center: {
            lat: 15,
            lng: 0
        },
        zoom: 2
    };
    const map = new google.maps.Map(document.getElementById('map'), mapProps);
    let globalData = null;
    let countriesData = null;
    let countryNamesES = null;

    await showModal('#modalLoading');
    try {
        const globalRes = await fetch(\`\${BASE_API_URL}/all\`);
        globalData = await globalRes.json();
        cacheAPIData('globalData', globalData);

        const countriesRes = await fetch(\`\${BASE_API_URL}/countries?sort=cases\`);
        countriesData = await countriesRes.json();
        cacheAPIData('countryData', countriesData);

        const countryNamesESRes = await fetch('https://raw.githubusercontent.com/umpirsky/country-list/master/data/es_MX/country.json');
        countryNamesES = await countryNamesESRes.json();
    }
    catch (error) {
        globalData = retrieveCachedAPIData('globalData');
        countriesData = retrieveCachedAPIData('countryData');
        await hideModal('#modalLoading');
        if (!globalData || !countriesData) {
            await showModal('#modalError');
        }
    }

    updateInfoCards(globalData, countriesData, countryNamesES);
    addCountryMarkers(countriesData, countryNamesES, map);

    await hideModal('#modalLoading');

    const markerCluster = new MarkerClusterer(map, markers,
        {
            imagePath: 'https://developers.google.com/maps/documentation/javascript/examples/markerclusterer/m',
            gridSize: 35,
            maxZoom: 10
        }
    );
}

function generateCountryInfoHTML(country, countryES) {
    const markerContainer = document.querySelector('.googleMapMarkerContainer');
    const img = markerContainer.querySelector('.countryFlag');
    const cases = markerContainer.querySelector('#cases');
    const deaths = markerContainer.querySelector('#deaths');
    const recovered = markerContainer.querySelector('#recovered');

    img.src = country.countryInfo.flag;
    img.alt = \`Bandera de \${countryES[country.countryInfo.iso2] || country.country}\`;
    
    cases.textContent = country.cases.toLocaleString('en');
    deaths.textContent = country.deaths.toLocaleString('en');
    recovered.textContent = country.recovered.toLocaleString('en');

    return markerContainer.innerHTML;
}

function generateFullCountryInfoHTML(country, countryES) {
    const markerContainer = document.querySelector('.googleMapRightControlContainer');
    const img = markerContainer.querySelector('.countryFlag');
    const countryName = markerContainer.querySelector('#countryName');
    const casesCell = markerContainer.querySelector('#casesCell');
    const todayCasesCell = markerContainer.querySelector('#todayCasesCell');
    const deathsCell = markerContainer.querySelector('#deathsCell');
    const todayDeathsCell = markerContainer.querySelector('#todayDeathsCell');
    const recoveredCell = markerContainer.querySelector('#recoveredCell');
    const activeCasesCell = markerContainer.querySelector('#activeCasesCell');
    const criticalCasesCell = markerContainer.querySelector('#criticalCasesCell');
    const casesPerMillionCell = markerContainer.querySelector('#casesPerMillionCell');

    img.src = country.countryInfo.flag;
    img.alt = \`Bandera de \${country.countryInfo.flag}\`;

    countryName.textContent = countryES[country.countryInfo.iso2] || country.country;
    
    casesCell.textContent = country.cases.toLocaleString('en');
    todayCasesCell.textContent = country.todayCases.toLocaleString('en');
    deathsCell.textContent = country.deaths.toLocaleString('en');
    todayDeathsCell.textContent = country.todayDeaths.toLocaleString('en');
    recoveredCell.textContent = country.recovered.toLocaleString('en');
    activeCasesCell.textContent = country.active.toLocaleString('en');
    criticalCasesCell.textContent = country.critical.toLocaleString('en');
    casesPerMillionCell.textContent = country.casesPerOneMillion.toLocaleString('en');

    return markerContainer.innerHTML;
}

function makeControl(controlDiv, country, countryES) {
    // Set up the control border.
    const controlUI = document.createElement('div');
    controlUI.title = countryES[country.countryInfo.iso2] || country.country;
    controlUI.className = 'controlUI';
    controlDiv.appendChild(controlUI);

    // Set up the inner control.
    const controlText = document.createElement('div');
    controlText.innerHTML = generateFullCountryInfoHTML(country, countryES);
    controlText.className = 'controlText';
    controlUI.appendChild(controlText);
}

function updateInfoCards(globalData, countriesData, countryNamesES) {
    // For each country add a row to the 'Casos confirmados por país' card
    countriesData.forEach((country, i) => {
        const tdPosicion = document.createElement('td');
        const tdPais = document.createElement('td');
        const tdCasos = document.createElement('td');

        tdPosicion.textContent = i + 1;
        tdPais.textContent = countryNamesES[country.countryInfo.iso2] || country.country;

        const spanCasos = document.createElement('span');
        spanCasos.textContent = country.cases.toLocaleString('en');
        spanCasos.className = 'badge badge-pill badge-warning';

        tdCasos.appendChild(spanCasos);

        const tr = document.createElement('tr');
        tr.id = country.country;
        tr.appendChild(tdPosicion);
        tr.appendChild(tdPais);
        tr.appendChild(tdCasos);

        tr.addEventListener('click', evt => {
            const country = evt.currentTarget.id;
            closeAllInfoWindows();
            google.maps.event.trigger(markers[country], 'click');
        });

        tblCountryCases.appendChild(tr);
    });

    // Show the remaining statistics (last update, confirmed, active, closed cases) in the other cards
    divLastUpdated.textContent = new Date(globalData.updated).toLocaleString('es-us', { hour12: true });
    divGlobalConfirmedCases.textContent = globalData.cases.toLocaleString('en');
    divGlobalActiveCases.textContent = globalData.active.toLocaleString('en');
    divGlobalRecovered.textContent = globalData.recovered.toLocaleString('en');
    divGlobalDeaths.textContent = globalData.deaths.toLocaleString('en');
}

function addCountryMarkers(countriesData, countryNamesES, map) {
    const icon = {
        url: 'https://image.flaticon.com/icons/png/128/2659/2659980.png',
        scaledSize: new google.maps.Size(24, 24),
        origin: new google.maps.Point(0, 0)
    };

    for (const country of countriesData) {
        const info = generateCountryInfoHTML(country, countryNamesES);
        const infoWindow = new google.maps.InfoWindow({
            content: info
        });

        const marker = new google.maps.Marker({
            map: map,
            icon: icon,
            position: new google.maps.LatLng(country.countryInfo.lat, country.countryInfo.long),
            title: \`\${countryNamesES[country.countryInfo.iso2] || country.country}\`
        });

        markers[country.country] = marker;
        marker.addListener('click', () => {
            closeAllInfoWindows();
            infoWindow.open(map, marker);
            const divName = document.createElement('div');
            new makeControl(divName, country, countryNamesES);

            let fullInfoWindow = setInterval(() => {
                if (!infoWindow.getMap()) {
                    clearInterval(fullInfoWindow);
                    map.controls[google.maps.ControlPosition.RIGHT_CENTER].pop();
                }
                else if (map.controls[google.maps.ControlPosition.RIGHT_CENTER].length === 0) {
                    map.controls[google.maps.ControlPosition.RIGHT_CENTER].push(divName);
                }
            }, 100);
        });

        objInfoWindows[country.country] = infoWindow;
    }
}

function closeAllInfoWindows() {
    for (const infoWinKey in objInfoWindows) {
        objInfoWindows[infoWinKey].close();
    }
}`;

            if (isZip) {
                setIsPublishing(true);
                try {
                    if (!window.JSZip) {
                        await new Promise((resolve, reject) => {
                            const script = document.createElement('script');
                            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
                            script.onload = resolve;
                            script.onerror = reject;
                            document.head.appendChild(script);
                        });
                    }
                    const zip = new window.JSZip();
                    zip.file("index.html", covidHtml);
                    zip.folder("css").file("style.css", covidStyleCss);
                    zip.folder("css").file("loader.css", covidLoaderCss);
                    zip.folder("css").file("errorModal.css", covidErrorModalCss);
                    zip.folder("js").file("constants.js", covidConstantsJs);
                    zip.folder("js").file("util.js", covidUtilJs);
                    zip.folder("js").file("index.js", covidIndexJs);
                    
                    const content = await zip.generateAsync({ type: 'blob' });
                    const downloadUrl = URL.createObjectURL(content);
                    const a = document.createElement('a');
                    a.href = downloadUrl;
                    a.download = `COVID-19_Map_Project_${Date.now()}.zip`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(downloadUrl);
                } catch (err) {
                    console.error("ZIP packaging failed:", err);
                    alert("فشل تصدير المشروع كـ ZIP: " + err.message);
                } finally {
                    setIsPublishing(false);
                }
            } else {
                let bundledHtml = covidHtml
                    .replace('<link rel="stylesheet" href="css/style.css">', `<style>${covidStyleCss}</style>`)
                    .replace('<link rel="stylesheet" href="css/loader.css">', `<style>${covidLoaderCss}</style>`)
                    .replace('<link rel="stylesheet" href="css/errorModal.css">', `<style>${covidErrorModalCss}</style>`)
                    .replace('<script defer src="js/constants.js"></script>', `<script>${covidConstantsJs}</script>`)
                    .replace('<script defer src="js/util.js"></script>', `<script>${covidUtilJs}</script>`)
                    .replace('<script defer src="js/index.js"></script>', `<script>${covidIndexJs}</script>`);

                const blob = new Blob([bundledHtml], { type: 'text/html' });
                const downloadUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = downloadUrl;
                a.download = `COVID-19_Map_Design_${Date.now()}.html`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(downloadUrl);
            }
            setIsDesignStudioOpen(false);
            return;
        }

        const map = mapRef.current?.getMap();
        const center = map ? map.getCenter() : { lng: mapState.longitude, lat: mapState.latitude };
        const zoom = map ? map.getZoom() : mapState.zoom;
        const pitch = map ? map.getPitch() : mapState.pitch;
        const bearing = map ? map.getBearing() : mapState.bearing;

        // Helper to round coordinates to 6 decimal places (saves ~50% space)
        const roundCoords = (coords) => {
            if (typeof coords === 'number') return Math.round(coords * 1000000) / 1000000;
            if (Array.isArray(coords)) return coords.map(roundCoords);
            return coords;
        };

        // 1. Prepare Layers & Files to Zip
        const exportLayers = [];
        const filesToZip = [];
        
        for (const layer of geoLayers) {
            let data = layer.data;
            let url = layer.url;
            
            if (layer.type !== 'raster-tile' && layer.type !== 'raster') {
                if (data) {
                    const cleanFeatures = (data.features || []).map(f => ({
                        ...f,
                        geometry: f.geometry ? {
                            ...f.geometry,
                            coordinates: roundCoords(f.geometry.coordinates)
                        } : null
                    }));
                    const cleanData = { ...data, features: cleanFeatures };
                    
                    if (isZip) {
                        const fileName = `data/layer_${layer.id}.geojson`;
                        filesToZip.push({ name: fileName, content: JSON.stringify(cleanData) });
                        url = `./${fileName}`;
                    } else {
                        url = cleanData;
                    }
                }
            } else if (layer.type === 'raster' && url && url.startsWith('blob:')) {
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

            const style = layerStyles[layer.id] || {
                color: layer.color || '#F5A623',
                outlineColor: '#ffffff',
                outlineWidth: 2,
                shape: 'circle',
                opacity: 1,
                fillOpacity: 0.3
            };

            exportLayers.push({
                id: layer.id,
                name: layer.name,
                type: layer.type || 'vector',
                data: layer.type === 'raster-tile' ? null : data,
                dataUrl: layer.type === 'raster-tile' ? layer.url : (layer.dataUrl || layer.url),
                coordinates: layer.coordinates,
                color: layer.color,
                style: style,
                url: url
            });
        }

        // 2. Map Selections to Themes
        const palettesData = {
            classic: { primary: '#F5A623', primaryDark: '#D88B0E', bg: '#0A1628', surface: 'rgba(20, 43, 71, 0.7)', surfaceSolid: '#142B47', border: 'rgba(255, 255, 255, 0.08)', text: '#FFFFFF', primaryGlow: 'rgba(245, 166, 35, 0.3)' },
            dark: { primary: '#06D6F2', primaryDark: '#04A0B5', bg: '#000000', surface: 'rgba(30, 30, 30, 0.7)', surfaceSolid: '#111111', border: 'rgba(255, 255, 255, 0.1)', text: '#FFFFFF', primaryGlow: 'rgba(6, 214, 242, 0.3)' },
            midnight: { primary: '#8B5CF6', primaryDark: '#6D28D9', bg: '#050505', surface: 'rgba(20, 10, 40, 0.7)', surfaceSolid: '#120525', border: 'rgba(139, 92, 246, 0.2)', text: '#FFFFFF', primaryGlow: 'rgba(139, 92, 246, 0.3)' },
            heritage: { primary: '#CE1126', primaryDark: '#A00010', bg: '#000000', surface: 'rgba(20, 20, 20, 0.8)', surfaceSolid: '#111111', border: 'rgba(0, 122, 61, 0.3)', text: '#FFFFFF', primaryGlow: 'rgba(206, 17, 38, 0.3)' },
            ocean: { primary: '#06D6F2', primaryDark: '#04A0B5', bg: '#050B16', surface: 'rgba(26, 41, 128, 0.4)', surfaceSolid: '#1A2980', border: 'rgba(6, 214, 242, 0.2)', text: '#F0F8FF', primaryGlow: 'rgba(6, 214, 242, 0.3)' },
            sunset: { primary: '#F5A623', primaryDark: '#FF6B6B', bg: '#1A0E1F', surface: 'rgba(139, 92, 246, 0.3)', surfaceSolid: '#3B1E4A', border: 'rgba(245, 166, 35, 0.2)', text: '#FFFFFF', primaryGlow: 'rgba(245, 166, 35, 0.3)' },
            forest: { primary: '#10D9A0', primaryDark: '#059669', bg: '#022C22', surface: 'rgba(6, 78, 59, 0.6)', surfaceSolid: '#064E3B', border: 'rgba(16, 217, 160, 0.2)', text: '#F5F4ED', primaryGlow: 'rgba(16, 217, 160, 0.3)' },
            earth: { primary: '#D4C49B', primaryDark: '#A0826D', bg: '#2C1810', surface: 'rgba(92, 64, 51, 0.6)', surfaceSolid: '#5C4033', border: 'rgba(212, 196, 155, 0.2)', text: '#F5F4ED', primaryGlow: 'rgba(212, 196, 155, 0.3)' },
            royal: { primary: '#F5A623', primaryDark: '#7C3AED', bg: '#1E1B4B', surface: 'rgba(49, 46, 129, 0.7)', surfaceSolid: '#312E81', border: 'rgba(245, 166, 35, 0.2)', text: '#FFFFFF', primaryGlow: 'rgba(245, 166, 35, 0.3)' },
            neon: { primary: '#06D6F2', primaryDark: '#EC4899', bg: '#050B16', surface: 'rgba(139, 92, 246, 0.3)', surfaceSolid: '#14002E', border: 'rgba(236, 72, 153, 0.3)', text: '#FFFFFF', primaryGlow: 'rgba(6, 214, 242, 0.4)' },
            minimal: { primary: '#F5A623', primaryDark: '#D88B0E', bg: '#FFFFFF', surface: 'rgba(245, 244, 237, 0.9)', surfaceSolid: '#F5F4ED', border: 'rgba(0, 0, 0, 0.1)', text: '#1A1A2E', primaryGlow: 'rgba(245, 166, 35, 0.3)' },
            shadcn_zinc: { primary: '#71717a', primaryDark: '#27272a', bg: '#09090b', surface: 'rgba(39, 39, 42, 0.6)', surfaceSolid: '#18181b', border: 'rgba(255, 255, 255, 0.08)', text: '#fafafa', primaryGlow: 'rgba(113, 113, 122, 0.3)' },
            shadcn_slate: { primary: '#64748b', primaryDark: '#1e293b', bg: '#020617', surface: 'rgba(15, 23, 42, 0.6)', surfaceSolid: '#0f172a', border: 'rgba(255, 255, 255, 0.08)', text: '#f8fafc', primaryGlow: 'rgba(100, 116, 139, 0.3)' },
            shadcn_emerald: { primary: '#10b981', primaryDark: '#065f46', bg: '#022c22', surface: 'rgba(6, 78, 59, 0.6)', surfaceSolid: '#064e3b', border: 'rgba(255, 255, 255, 0.08)', text: '#f0fdf4', primaryGlow: 'rgba(16, 185, 129, 0.3)' },
            shadcn_violet: { primary: '#8b5cf6', primaryDark: '#312e81', bg: '#0c0a0f', surface: 'rgba(30, 27, 75, 0.6)', surfaceSolid: '#1e1b4b', border: 'rgba(255, 255, 255, 0.08)', text: '#faf5ff', primaryGlow: 'rgba(139, 92, 246, 0.3)' },
            shadcn_rose: { primary: '#f43f5e', primaryDark: '#881337', bg: '#1c0d12', surface: 'rgba(76, 5, 25, 0.6)', surfaceSolid: '#4c0519', border: 'rgba(255, 255, 255, 0.08)', text: '#fff1f2', primaryGlow: 'rgba(244, 63, 94, 0.3)' },
            shadcn_amber: { primary: '#f59e0b', primaryDark: '#78350f', bg: '#271404', surface: 'rgba(69, 26, 3, 0.6)', surfaceSolid: '#451a03', border: 'rgba(255, 255, 255, 0.08)', text: '#fffbeb', primaryGlow: 'rgba(245, 158, 11, 0.3)' },
            custom: {
                primary: designSelections.customPrimary,
                primaryDark: designSelections.customPrimary,
                bg: designSelections.customBg || '#0A1628',
                surface: designSelections.customSurface || 'rgba(20, 43, 71, 0.7)',
                surfaceSolid: designSelections.customSurface ? (designSelections.customSurface.startsWith('rgba') ? designSelections.customSurface.replace(/[\d\.]+\)$/, '1)') : designSelections.customSurface) : '#142B47',
                border: designSelections.customBorder || 'rgba(255, 255, 255, 0.08)',
                text: designSelections.customText || '#FFFFFF',
                primaryGlow: `${designSelections.customPrimary}44`
            }
        };
        const theme = palettesData[designSelections.palette] || palettesData.classic;

        const fontsData = {
            cairo_tajawal: { h: "'Cairo', sans-serif", b: "'Tajawal', sans-serif" },
            tajawal_inter: { h: "'Tajawal', sans-serif", b: "system-ui, sans-serif" },
            cairo_mono: { h: "'Cairo', sans-serif", b: "'JetBrains Mono', monospace" },
            tajawal_ed: { h: "'Tajawal', serif", b: "'Tajawal', sans-serif" },
            display: { h: "'Cairo', sans-serif", b: "'Tajawal', sans-serif" },
            compact: { h: "'Cairo', sans-serif", b: "'Tajawal', sans-serif" },
            custom: { h: `'${designSelections.customFontHeading || 'Cairo'}', sans-serif`, b: `'${designSelections.customFontBody || 'Tajawal'}', sans-serif` }
        };
        const selectedFont = fontsData[designSelections.font] || fontsData.cairo_tajawal;

        const bm = designSelections.basemap;
        const bmTiles = {
            dark: 'https://cartodb-basemaps-a.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png',
            light: 'https://cartodb-basemaps-a.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png',
            satellite: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
            satellite_pure: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
            terrain: 'https://stamen-tiles.a.ssl.fastly.net/terrain/{z}/{x}/{y}.jpg',
            vintage: 'https://stamen-tiles.a.ssl.fastly.net/toner/{z}/{x}/{y}.png',
            cyber: 'https://mt1.google.com/vt/lyrs=h&x={x}&y={y}&z={z}'
        };
        const chosenTile = bmTiles[bm] || bmTiles.satellite;
        const targetBasemapStyleObj = {
            version: 8,
            sources: { 'base-tiles': { type: 'raster', tiles: [chosenTile], tileSize: 256 } },
            layers: [{ id: 'base-layer', type: 'raster', source: 'base-tiles', minzoom: 0, maxzoom: 22 }]
        };

        let effectCSS = '';
        if (designSelections.effect === 'glow') effectCSS = '.card-panel { box-shadow: 0 0 30px var(--primary-glow) !important; border-color: var(--primary) !important; }';
        else if (designSelections.effect === 'glass') effectCSS = '.card-panel { background: rgba(0,0,0,0.2) !important; backdrop-filter: blur(24px) !important; border: 1px solid rgba(255,255,255,0.2) !important; }';
        else if (designSelections.effect === 'shadow_lg') effectCSS = '.card-panel { box-shadow: 0 20px 50px rgba(0,0,0,0.5) !important; }';

        const layersHTML = exportLayers.map(l => `
            <div class="layer-item" style="display:flex; align-items:center; justify-content:space-between; gap:10px; padding: 12px 14px; margin-bottom: 10px; background: rgba(0,0,0,0.15); border-radius: 10px; border: 1px solid var(--border);">
                <div style="display:flex; align-items:center; gap:10px;">
                    <div class="layer-color-dot" style="width:14px;height:14px;border-radius:4px;background:${l.style?.color || l.color}"></div>
                    <span>${l.name}</span>
                </div>
                ${designSelections.show_layer_toggle ? `
                    <label class="switch" style="position: relative; display: inline-block; width: 34px; height: 20px; flex-shrink:0;">
                        <input type="checkbox" checked onchange="toggleLayer('${l.id}', this.checked)" style="opacity: 0; width: 0; height: 0;">
                        <span class="slider" style="position: absolute; cursor: pointer; inset: 0; background-color: rgba(255,255,255,0.15); transition: .3s; border-radius: 34px;"></span>
                    </label>
                ` : ''}
            </div>
        `).join('');

        let legendHTML = '';
        if (designSelections.show_legend) {
            legendHTML = `
            <div class="map-legend card-panel" style="position: absolute; bottom: 30px; left: 30px; background: var(--surface-solid); border: 1px solid var(--border); border-radius: 16px; padding: 16px; z-index: 100; min-width: 180px; box-shadow: 0 10px 30px rgba(0,0,0,0.4); border-top: 3px solid var(--primary); direction: rtl; text-align: right;">
                <h4 style="margin: 0 0 12px 0; font-family: var(--font-h); font-size: 0.95rem; color: var(--primary);">دليل الخريطة</h4>
                ${exportLayers.map(l => `
                    <div class="legend-row" style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem; margin-bottom: 6px; color: var(--text-color);">
                        <span class="legend-color" style="width: 12px; height: 12px; border-radius: 3px; background:${l.style?.color || l.color}"></span>
                        <span>${l.name}</span>
                    </div>
                `).join('')}
            </div>`;
        }

        let searchHTML = '';
        if (designSelections.enable_search) {
            searchHTML = `
            <div class="map-search-container" style="position: absolute; top: 20px; right: 20px; width: 300px; z-index: 100; direction: rtl;">
                <input class="map-search-input" placeholder="البحث في معالم الخريطة..." oninput="doSearch(this.value)" style="width: 100%; background: var(--surface-solid); border: 1px solid var(--border); border-radius: 999px; padding: 12px 20px; color: var(--text-color); font-family: var(--font-b); font-size: 0.85rem; outline: none; box-shadow: 0 10px 25px rgba(0,0,0,0.3); border-color: var(--primary);" />
                <div class="map-search-results" id="search-results" style="position: absolute; top: 100%; left: 0; right: 0; background: var(--surface-solid); border: 1px solid var(--border); border-radius: 12px; margin-top: 6px; overflow: hidden; display: none; max-height: 250px; overflow-y: auto; box-shadow: 0 10px 25px rgba(0,0,0,0.4); text-align: right;"></div>
            </div>`;
        }

        const mapContainerHTML = `
            <div id="map" style="position:relative; flex:1; min-height:400px; height:100%; width:100%; background:#000;">
                ${searchHTML}
                ${legendHTML}
            </div>
        `;

        // 3. Setup Layout / Commercial Templates Overrides
        let layoutCSS = '';
        let layoutHTML = '';
        let templateJS = '';

        if (!designSelections.commercialTemplate || designSelections.commercialTemplate === 'none') {
            switch (designSelections.layout) {
                case 'sidebar':
                    layoutCSS = `
                        .app-container { display: flex; height: 100vh; width: 100vw; }
                        .sidebar { width: 340px; background: var(--surface-solid); border-left: 1px solid var(--border); padding: 24px; display: flex; flex-direction: column; overflow-y: auto; z-index: 10; }
                    `;
                    layoutHTML = `
                        <aside class="sidebar card-panel">
                            <h2 style="color:var(--primary);margin-top:0;font-family:var(--font-h);">الطبقات المتاحة</h2>
                            <div class="layers-list">${layersHTML}</div>
                        </aside>
                        ${mapContainerHTML}
                    `;
                    break;
                case 'three':
                    layoutCSS = `
                        .app-container { display: flex; flex-direction: column; height: 100vh; width: 100vw; }
                        .top-nav { height: 60px; background: var(--surface-solid); border-bottom: 1px solid var(--border); display: flex; align-items: center; padding: 0 24px; z-index: 10; }
                        .main-content { flex: 1; display: flex; overflow: hidden; }
                        .left-panel { width: 300px; background: var(--surface-solid); border-left: 1px solid var(--border); padding: 20px; overflow-y: auto; }
                        .right-panel { width: 350px; background: var(--bg); border-right: 1px solid var(--border); padding: 20px; overflow-y: auto; }
                    `;
                    layoutHTML = `
                        <nav class="top-nav card-panel">
                            <h2 style="margin:0;color:var(--primary);font-family:var(--font-h);font-size:1.4rem;">مختبر التحليل الذكي</h2>
                        </nav>
                        <div class="main-content">
                            <aside class="left-panel">
                                <h3 style="color:var(--primary);margin-top:0;font-family:var(--font-h);">الطبقات</h3>
                                <div class="layers-list">${layersHTML}</div>
                            </aside>
                            ${mapContainerHTML}
                            <aside class="right-panel card-panel">
                                <h3 style="color:var(--primary);margin-top:0;font-family:var(--font-h);">إحصائيات فورية</h3>
                                <div class="stat-card card-panel" style="margin-bottom:15px;"><div class="stat-num">${exportLayers.length}</div><div class="stat-label">طبقة نشطة</div></div>
                                <div class="stat-card card-panel"><div class="stat-num">${exportLayers.reduce((sum, l) => sum + (l.data?.features?.length || 0), 0)}</div><div class="stat-label">معلم جغرافي</div></div>
                            </aside>
                        </div>
                    `;
                    break;
                case 'split':
                    layoutCSS = `
                        .app-container { display: flex; height: 100vh; width: 100vw; }
                        .side-content { flex: 1; background: var(--bg); padding: 40px; display: flex; flex-direction: column; justify-content: center; z-index: 10; }
                    `;
                    layoutHTML = `
                        <div class="side-content card-panel">
                            <h1 style="color:var(--primary);font-size:3rem;margin-bottom:10px;font-family:var(--font-h);">نظرة مكانية</h1>
                            <p style="opacity:0.8;font-size:1.2rem;line-height:1.8;">استكشف البيانات الجغرافية بدقة من خلال هذه الخريطة التفاعلية المصممة خصيصاً لاحتياجاتك.</p>
                            <div style="margin-top:40px;">${layersHTML}</div>
                        </div>
                        ${mapContainerHTML}
                    `;
                    break;
                case 'dashboard':
                    layoutCSS = `
                        .app-container { display: flex; flex-direction: column; height: 100vh; width: 100vw; background: var(--bg); }
                        .dash-header { height: 70px; background: var(--surface-solid); border-bottom: 1px solid var(--border); display: flex; align-items: center; padding: 0 24px; z-index: 10; }
                        .dash-body { flex: 1; display: flex; flex-direction: column; padding: 20px; gap: 20px; }
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
                            ${mapContainerHTML}
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
                    `;
                    layoutHTML = `
                        <div class="modal-wrapper card-panel">
                            <div class="modal-header">
                                <h2 style="margin:0;color:var(--primary);font-family:var(--font-h);">عارض الخريطة</h2>
                                <div style="display:flex;gap:10px;">${exportLayers.slice(0, 3).map(l => `<span style="background:var(--bg);padding:5px 12px;border-radius:20px;font-size:0.8rem;border:1px solid ${l.style?.color || l.color}">${l.name}</span>`).join('')}</div>
                            </div>
                            ${mapContainerHTML}
                        </div>
                    `;
                    break;
                case 'floating':
                    layoutCSS = `
                        .app-container { display: flex; height: 100vh; width: 100vw; }
                        .f-card { position: absolute; background: var(--surface); border: 1px solid var(--border); border-radius: 16px; backdrop-filter: blur(15px); padding: 24px; z-index: 10; box-shadow: 0 15px 35px rgba(0,0,0,0.3); }
                        .f-bottom-left { bottom: 40px; left: 30px; width: 400px; }
                    `;
                    layoutHTML = `
                        ${mapContainerHTML}
                        <div class="f-card f-bottom-left card-panel">
                            <h3 style="margin-top:0;font-family:var(--font-h);">إحصائيات الخريطة</h3>
                            <p style="opacity:0.8;font-size:1rem;line-height:1.6;">تم تحميل <b>${exportLayers.length}</b> طبقات بنجاح، تحتوي على <b>${exportLayers.reduce((sum, l) => sum + (l.data?.features?.length || 0), 0)}</b> معلم جغرافي تفاعلي.</p>
                            <button class="${designSelections.component || 'primary'}-btn" style="width:100%;padding:14px;background:var(--primary);color:#000;border:none;border-radius:10px;font-weight:bold;font-size:1rem;cursor:pointer;margin-top:16px;">عرض التفاصيل</button>
                        </div>
                    `;
                    break;
                case 'stacked':
                    layoutCSS = `
                        .app-container { display: flex; flex-direction: column; height: 100vh; width: 100vw; }
                        .bottom-content { height: 40%; background: var(--surface-solid); padding: 24px; overflow-y: auto; }
                        .grid-view { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 20px; }
                    `;
                    layoutHTML = `
                        <div style="height: 60%; width: 100%; display: flex; position: relative;">
                            ${mapContainerHTML}
                        </div>
                        <div class="bottom-content card-panel">
                            <h2 style="color:var(--primary);margin-top:0;font-family:var(--font-h);">استعراض البيانات</h2>
                            <div class="grid-view">
                                ${exportLayers.map(l => `
                                    <div class="layer-item" style="margin:0; padding: 12px 14px; background: rgba(0,0,0,0.15); border-radius: 10px; border: 1px solid var(--border);">
                                        <h4 style="margin:0 0 8px 0;color:var(--primary);">${l.name}</h4>
                                        <div style="font-size:0.9rem;opacity:0.7;">يحتوي على ${l.data?.features?.length || 0} معلم</div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `;
                    break;
                case 'custom':
                    layoutCSS = `
                        .app-container { position: relative; height: 100vh; width: 100vw; overflow: hidden; }
                    `;
                    layoutHTML = `
                        ${mapContainerHTML}
                    `;
                    break;
                default: // fullmap
                    layoutCSS = `
                        .app-container { display: flex; height: 100vh; width: 100vw; }
                    `;
                    layoutHTML = `
                        ${mapContainerHTML}
                    `;
                    break;
            }
        }
        // 4. Build custom elements overlay
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
        .cel-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 16px; text-align: right; font-family: var(--font-b); }
        .cel-icon-wrap { display: flex; justify-content: center; }
        .cel-icon { width: 48px; height: 48px; }
        .cel-accordion { background: rgba(0,0,0,0.3); border: 1px solid var(--border); border-radius: 8px; padding: 12px 16px; font-family: var(--font-b); font-size: 0.9rem; }
        .cel-accordion-head { display: flex; justify-content: space-between; align-items: center; font-weight: bold; cursor: pointer; }
        .cel-alert { background: rgba(16,185,129,0.1); border: 1px solid var(--primary); border-radius: 10px; padding: 12px 16px; font-family: var(--font-b); display: flex; gap: 12px; align-items: center; }
        .cel-alert-icon { font-size: 1.3rem; }
        .cel-avatar { display: flex; align-items: center; gap: 10px; font-family: var(--font-b); }
        .cel-avatar-circle { width: 36px; height: 36px; border-radius: 50%; background: var(--primary); color: #000; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.95rem; }
        .cel-slider { padding: 10px 0; font-family: var(--font-b); }
        .cel-slider-track { height: 6px; background: rgba(255,255,255,0.1); border-radius: 999px; position: relative; margin-top: 8px; }
        .cel-slider-fill { position: absolute; top: 0; right: 0; bottom: 0; left: 30%; background: var(--primary); border-radius: 999px; }
        .cel-slider-thumb { position: absolute; top: 50%; left: 30%; transform: translate(-50%, -50%); width: 14px; height: 14px; border-radius: 50%; background: #fff; border: 2px solid var(--primary); }
        .cel-switch { display: flex; align-items: center; justify-content: space-between; padding: 6px 0; font-family: var(--font-b); }
        .cel-switch-track { width: 36px; height: 20px; background: var(--primary); border-radius: 999px; position: relative; }
        .cel-switch-thumb { position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #000; }
        .cel-progress { padding: 6px 0; font-family: var(--font-b); }
        .cel-progress-track { height: 10px; background: rgba(255,255,255,0.1); border-radius: 999px; overflow: hidden; margin-top: 6px; }
        .cel-progress-fill { height: 100%; background: var(--primary); border-radius: 999px; }
        .cel-tabs { background: rgba(0,0,0,0.25); border: 1px solid var(--border); border-radius: 8px; padding: 4px; display: flex; gap: 4px; font-family: var(--font-b); }
        .cel-tab-item { flex: 1; padding: 6px 12px; font-size: 0.85rem; font-weight: bold; border-radius: 6px; text-align: center; }
        .cel-tab-item.active { background: var(--primary); color: #000; }
        ` : '';

        const layersListHTML = exportLayers.map(l =>
            `<div class="cel-layer-row" onclick="map.fitBounds(${JSON.stringify(
                l.data?.features?.length > 0
                    ? (() => { try { const coords = (l.data?.features || []).flatMap(f => f.geometry?.type === 'Point' ? [f.geometry.coordinates] : f.geometry?.coordinates?.flat?.(5) || []); if (coords.length === 0) return null; let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity; for (let i = 0; i < coords.length; i++) { const pt = coords[i]; if (pt && pt[0] < minLng) minLng = pt[0]; if (pt && pt[0] > maxLng) maxLng = pt[0]; if (pt && pt[1] < minLat) minLat = pt[1]; if (pt && pt[1] > maxLat) maxLat = pt[1]; } return [[minLng, minLat], [maxLng, maxLat]]; } catch (e) { return null; } })()
                    : null
            )}, {padding:40})"><div class="cel-layer-dot" style="background:${l.style?.color || l.color}"></div><span>${l.name}</span></div>`
        ).join('');

        const customElsHTML = pageElements.length > 0 ? `
        <div class="custom-overlay">
            ${pageElements.map(el => {
            const fs = el.fontSize ? `font-size:${el.fontSize}rem;` : '';
            const wStyle = `left:${el.x}%;top:${el.y}%;width:${el.w}%;${fs}`;
            let inner = '';
            const clr = el.color ? `color:${el.color};` : '';
            const bgClr = el.color ? `background:${el.color};` : '';
            const brClr = el.color ? `border-color:${el.color};` : '';

            if (el.type === 'heading') inner = `<h1 class="cel-heading" style="font-size:${el.fontSize || 2}rem;${clr}">${el.text}</h1>`;
            else if (el.type === 'subheading') inner = `<h2 class="cel-sub" style="font-size:${el.fontSize || 1.3}rem;${clr}">${el.text}</h2>`;
            else if (el.type === 'paragraph') inner = `<p class="cel-para" style="font-size:${el.fontSize || 1}rem;${clr}">${el.text}</p>`;
            else if (el.type === 'btn_primary') inner = `<button class="cel-btn-p" style="font-size:${el.fontSize || 1}rem;${bgClr}">${el.text}</button>`;
            else if (el.type === 'btn_outline') inner = `<button class="cel-btn-o" style="font-size:${el.fontSize || 1}rem;${clr}${brClr}">${el.text}</button>`;
            else if (el.type === 'search') inner = `<div class="cel-search-wrap" style="${clr}"><svg class="cel-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input class="cel-search" placeholder="${el.text}" oninput="doSearch(this.value)" style="${brClr}${clr}" /><div class="cel-search-results" id="search-results"></div></div>`;
            else if (el.type === 'layers') inner = `<div class="cel-layers-box" style="${brClr}${clr}">${layersListHTML || '<div style="opacity:0.5;padding:8px;font-size:0.85rem">لا توجد طبقات</div>'}</div>`;
            else if (el.type === 'stat') inner = `<div class="cel-stat" style="${brClr}"><div class="cel-stat-num" style="font-size:${el.fontSize || 2}rem;${clr}">${exportLayers.reduce((s, l) => s + (l.data?.features?.length || 0), 0)}</div><div class="cel-stat-lbl">${el.text}</div></div>`;
            else if (el.type === 'divider') inner = `<hr class="cel-hr" style="${brClr}"/>`;
            else if (el.type === 'badge') inner = `<span class="cel-badge" style="font-size:${el.fontSize || 0.85}rem;${bgClr}">${el.text}</span>`;
            else if (el.type === 'card') inner = `<div class="cel-card" style="${brClr}"><h4 style="margin:0 0 8px 0;${clr}">${el.text}</h4><p style="margin:0;font-size:0.85rem;opacity:0.7;">وصف المكون الجاهز...</p></div>`;
            else if (el.type === 'icon') inner = `<div class="cel-icon-wrap" style="${clr}"><svg class="cel-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${el.icon && (el.icon.includes('points') ? `<polygon points="${el.icon}" />` : `<path d="${el.icon}" />`)}</svg></div>`;
            else if (el.type === 'shadcn_accordion') inner = `<div class="cel-accordion" style="\${brClr}"><div class="cel-accordion-head" style="\${clr}"><span>\${el.text}</span><span>▼</span></div></div>`;
            else if (el.type === 'shadcn_alert') inner = `<div class="cel-alert" style="\${brClr}"><span class="cel-alert-icon" style="\${clr}">🔔</span><div><div style="font-weight:bold;font-size:0.95rem;\${clr}">تنبيه هام</div><div style="opacity:0.8;font-size:0.82rem;">\${el.text}</div></div></div>`;
            else if (el.type === 'shadcn_avatar') inner = `<div class="cel-avatar"><div class="cel-avatar-circle" style="\${bgClr}">PN</div><span style="font-size:0.9rem;\${clr}">\${el.text}</span></div>`;
            else if (el.type === 'shadcn_slider') inner = `<div class="cel-slider"><div style="display:flex;justify-content:space-between;font-size:0.8rem;opacity:0.8;\${clr}"><span>\${el.text}</span><span>70%</span></div><div class="cel-slider-track"><div class="cel-slider-fill" style="\${bgClr}"></div><div class="cel-slider-thumb" style="\${brClr}"></div></div></div>`;
            else if (el.type === 'shadcn_switch') inner = `<div class="cel-switch" style="\${clr}"><span>\${el.text}</span><div class="cel-switch-track" style="\${bgClr}"><div class="cel-switch-thumb"></div></div></div>`;
            else if (el.type === 'shadcn_progress') inner = `<div class="cel-progress"><div style="display:flex;justify-content:space-between;font-size:0.8rem;opacity:0.8;\${clr}"><span>\${el.text}</span><span>60%</span></div><div class="cel-progress-track"><div class="cel-progress-fill" style="width:60%;\${bgClr}"></div></div></div>`;
            else if (el.type === 'shadcn_tabs') inner = `<div class="cel-tabs"><div class="cel-tab-item active" style="\${bgClr}">\${el.text}</div><div class="cel-tab-item" style="opacity:0.6;\${clr}">خيارات</div></div>`;
            return `<div class="cel" style="${wStyle}">${inner}</div>`;
        }).join('\n            ')}
        </div>` : '';

        // 5. Calculate final bounds from original geoLayers
        let finalBounds = null;
        try {
            const allCoords = [];
            geoLayers.forEach(l => {
                if (l.type !== 'raster-tile' && l.type !== 'raster' && l.data?.features) {
                    l.data.features.forEach(f => {
                        if (f.geometry?.type === 'Point') allCoords.push(f.geometry.coordinates);
                        else if (f.geometry?.coordinates) {
                            const flat = f.geometry.coordinates.flat(5).filter(c => typeof c === 'number' && !isNaN(c));
                            for (let i = 0; i < flat.length; i += 2) {
                                if (flat[i] && flat[i + 1]) allCoords.push([flat[i], flat[i + 1]]);
                            }
                        }
                    });
                }
            });
            if (allCoords.length > 0) {
                let minLng = Infinity, maxLng = -Infinity;
                let minLat = Infinity, maxLat = -Infinity;
                for (let i = 0; i < allCoords.length; i++) {
                    const pt = allCoords[i];
                    if (pt[0] < minLng) minLng = pt[0];
                    if (pt[0] > maxLng) maxLng = pt[0];
                    if (pt[1] < minLat) minLat = pt[1];
                    if (pt[1] > maxLat) maxLat = pt[1];
                }
                finalBounds = [[minLng, minLat], [maxLng, maxLat]];
            }
        } catch (e) { console.error("Bounds calc error", e); }

        // 6. Optimized layers array for app.js metadata
        const optimizedLayers = exportLayers.map(l => ({
            id: l.id,
            name: l.name,
            type: l.type,
            url: l.url,
            style: l.style
        }));

        // 7. Compile CSS and JS contents
        const compiledCSS = `
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
            html, body { margin: 0; padding: 0; height: 100%; width: 100%; font-family: var(--font-b); background: var(--bg); color: var(--text-color); overflow: hidden; }
            * { box-sizing: border-box; }
            
            ${layoutCSS}
            ${effectCSS}

            .layer-item { background: rgba(0,0,0,0.15); border-radius: 10px; padding: 12px 14px; margin-bottom: 10px; border: 1px solid var(--border); }
            .layer-item:hover { border-color: var(--primary); }
            #map {
                flex: 1;
                min-height: 400px;
                height: 100%;
                width: 100%;
                background: #000;
                border-radius: ${designSelections.mapBorderRadius || '0px'};
                border: ${designSelections.mapBorderWidth || '0px'} solid ${designSelections.mapBorderColor || 'transparent'};
                overflow: hidden;
            }

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
        `;

        const compiledJS = `
            console.log("Initializing PalNovaa Map...");
            const layers = ${JSON.stringify(optimizedLayers)};
            const mapStyle = ${JSON.stringify(targetBasemapStyleObj)};
            const initialBounds = ${JSON.stringify(finalBounds)};

            try {
                const map = new maplibregl.Map({
                    container: 'map',
                    style: mapStyle,
                    center: [${center.lng}, ${center.lat}],
                    zoom: ${zoom},
                    pitch: ${pitch},
                    bearing: ${bearing},
                    attributionControl: ${designSelections.show_attribution}
                });

                if (initialBounds) {
                    map.fitBounds(initialBounds, { padding: 50, animate: false });
                }

                if (${designSelections.show_controls}) {
                    map.addControl(new maplibregl.NavigationControl(), 'bottom-right');
                    const style = document.createElement('style');
                    style.textContent = '.maplibregl-ctrl-bottom-right { bottom: 30px !important; }';
                    document.head.appendChild(style);
                }

                if (${designSelections.enable_scale}) {
                    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
                }

                if (${designSelections.auto_rotate}) {
                    let isRotating = true;
                    function rotateCamera(timestamp) {
                        if (!isRotating) return;
                        map.rotateTo((map.getBearing() + 0.1) % 360, { duration: 0 });
                        requestAnimationFrame(rotateCamera);
                    }
                    map.on('load', () => {
                        rotateCamera();
                        map.on('dragstart', () => { isRotating = false; });
                        map.on('dragend', () => { isRotating = true; rotateCamera(); });
                        map.on('zoomstart', () => { isRotating = false; });
                        map.on('zoomend', () => { isRotating = true; rotateCamera(); });
                    });
                }

                if (${designSelections.show_layer_toggle}) {
                    window.toggleLayer = function(layerId, visible) {
                        const visibility = visible ? 'visible' : 'none';
                        ['poly-', 'poly-line-', 'line-', 'point-', 'raster-'].forEach(prefix => {
                            const lId = prefix + layerId;
                            if (map.getLayer(lId)) {
                                map.setLayoutProperty(lId, 'visibility', visibility);
                            }
                        });
                    };
                }

                // Search function for custom search element
                window.doSearch = function(query) {
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
                    if (found.length === 0) { results.innerHTML = '<div class="map-search-item" style="opacity:0.5; padding: 10px 16px;">لا توجد نتائج</div>'; results.style.display = 'block'; return; }
                    results.innerHTML = found.slice(0, 8).map((r, i) => {
                        const label = r.props['name:ar'] || r.props.name || r.props.name_ar || r.props.title_ar || r.props.title || r.props['name:en'] || r.props.name_en || r.props.title_en || Object.values(r.props).find(v => typeof v === 'string') || 'معلم ' + (i + 1);
                        return '<div class="map-search-item" onclick="flyToFeature(' + i + ')">' + label + '</div>';
                    }).join('');
                    results.style.display = 'block';
                    window._searchResults = found;
                };

                window.flyToFeature = function(i) {
                    const f = window._searchResults?.[i];
                    if (!f) return;
                    const coords = f.geom.type === 'Point' ? f.geom.coordinates : f.geom.coordinates?.[0]?.[0] || f.geom.coordinates?.[0];
                    if (coords) map.flyTo({ center: coords, zoom: 15 });
                    document.getElementById('search-results').style.display = 'none';
                };

                document.addEventListener('click', e => { 
                    const r = document.getElementById('search-results'); 
                    if(r && !e.target.closest('.cel-search-wrap')) r.style.display = 'none'; 
                });

                map.on('load', () => {
                    console.log("Map loaded, generating icons...");
                    const addShapeIcon = (name, svgPath) => {
                        const canvas = document.createElement('canvas');
                        canvas.width = 64; canvas.height = 64;
                        const ctx = canvas.getContext('2d');
                        const path = new Path2D(svgPath);
                        ctx.translate(32, 32);
                        ctx.scale(2, 2);
                        ctx.translate(-12, -12);
                        ctx.fillStyle = '#ffffff';
                        ctx.fill(path);
                        const imageData = ctx.getImageData(0, 0, 64, 64);
                        map.addImage('shape-' + name, imageData, { sdf: true });
                    };

                    const shapes = {
                        square: 'M3 3h18v18H3z',
                        diamond: 'M12 2l9 10-9 10-9-10z',
                        triangle: 'M12 2l10 18H2z',
                        star: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
                        cross: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z'
                    };
                    Object.entries(shapes).forEach(([k, v]) => addShapeIcon(k, v));

                    console.log("Adding sources and layers...");
                    layers.forEach(layer => {
                        const s = layer.style || {};
                        const lColor = s.color || layer.color || '#fbab15';
                        const lOp = s.opacity ?? 1;
                        const fOp = s.fillOpacity ?? 0.3;
                        const outClr = s.outlineColor || '#ffffff';
                        const outW = s.outlineWidth ?? 2;

                        const sourceData = layer.url || layer.data;
                        if (!sourceData) {
                            console.warn("No data for layer:", layer.name);
                            return;
                        }

                        if (layer.type === 'raster-tile') {
                            map.addSource('src-' + layer.id, { type: 'raster', tiles: [sourceData], tileSize: 256 });
                            map.addLayer({
                                id: 'raster-' + layer.id,
                                type: 'raster',
                                source: 'src-' + layer.id,
                                paint: { 'raster-opacity': s.opacity ?? 0.8 }
                            });
                        } else {
                            map.addSource('src-' + layer.id, { type: 'geojson', data: sourceData });
                            map.addLayer({ 
                                id: 'poly-' + layer.id, 
                                type: 'fill', 
                                source: 'src-' + layer.id, 
                                filter: ['==', '$type', 'Polygon'], 
                                paint: { 
                                    'fill-color': lColor, 
                                    'fill-opacity': fOp * lOp, 
                                    'fill-outline-color': outClr 
                                } 
                            });
                            map.addLayer({ 
                                id: 'poly-line-' + layer.id, 
                                type: 'line', 
                                source: 'src-' + layer.id, 
                                filter: ['==', '$type', 'Polygon'], 
                                paint: { 
                                    'line-color': outClr, 
                                    'line-width': outW,
                                    'line-opacity': lOp
                                } 
                            });
                            map.addLayer({ 
                                id: 'line-' + layer.id, 
                                type: 'line', 
                                source: 'src-' + layer.id, 
                                filter: ['==', '$type', 'LineString'], 
                                paint: { 
                                    'line-color': lColor, 
                                    'line-width': outW * 2,
                                    'line-opacity': lOp
                                } 
                            });
                            
                            const pShape = s.shape || 'circle';
                            if (pShape === 'circle') {
                                map.addLayer({ 
                                    id: 'point-' + layer.id, 
                                    type: 'circle', 
                                    source: 'src-' + layer.id, 
                                    filter: ['==', '$type', 'Point'], 
                                    paint: { 
                                        'circle-radius': 7, 
                                        'circle-color': lColor, 
                                        'circle-stroke-width': outW, 
                                        'circle-stroke-color': outClr,
                                        'circle-opacity': lOp,
                                        'circle-stroke-opacity': lOp
                                    } 
                                });
                            } else {
                                map.addLayer({
                                    id: 'point-' + layer.id,
                                    type: 'symbol',
                                    source: 'src-' + layer.id,
                                    filter: ['==', '$type', 'Point'],
                                    layout: {
                                        'icon-image': 'shape-' + pShape,
                                        'icon-size': 0.8,
                                        'icon-allow-overlap': true
                                    },
                                    paint: {
                                        'icon-color': lColor,
                                        'icon-opacity': lOp
                                    }
                                });
                            }
                        }

                        const layerEvents = layer.type === 'raster-tile' ? ['raster-' + layer.id] : ['poly-' + layer.id, 'line-' + layer.id, 'point-' + layer.id];
                        layerEvents.forEach(id => {
                            map.on('mouseenter', id, () => { map.getCanvas().style.cursor = 'pointer'; });
                            map.on('mouseleave', id, () => { map.getCanvas().style.cursor = ''; });
                        });
                    });

                    // Add Highlight Source and Layer
                    map.addSource('highlight-src', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
                    map.addLayer({
                        id: 'highlight-line', type: 'line', source: 'highlight-src',
                        paint: { 'line-color': '#06D6F2', 'line-width': 4, 'line-blur': 2 }
                    });
                    map.addLayer({
                        id: 'highlight-point', type: 'circle', source: 'highlight-src',
                        filter: ['==', '$type', 'Point'],
                        paint: { 'circle-radius': 10, 'circle-color': 'transparent', 'circle-stroke-width': 3, 'circle-stroke-color': '#06D6F2' }
                    });

                    if (${designSelections.enable_popups}) {
                        map.on('click', (e) => {
                            const features = map.queryRenderedFeatures(e.point);
                            const myFeatures = features.filter(f => f.layer.id.startsWith('poly-') || f.layer.id.startsWith('line-') || f.layer.id.startsWith('point-'));
                            
                            if (myFeatures.length > 0) {
                                const f = myFeatures[0];
                                map.getSource('highlight-src').setData(f.toJSON());
                                
                                let html = '<div style="direction:rtl; text-align:right; font-family: Cairo, sans-serif; padding:5px;">';
                                html += '<h3 style="margin:0 0 12px 0; color:#06D6F2; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:8px; font-size:1.1rem;">تفاصيل المعلم</h3>';
                                const props = f.properties;
                                let hasProps = false;
                                for (let key in props) {
                                    hasProps = true;
                                    html += '<div style="margin-bottom:10px; font-size:0.9rem; line-height:1.4;">';
                                    html += '<strong style="color:var(--primary);">' + key + ':</strong> ';
                                    html += '<span style="color:#eee; word-break:break-word;">' + props[key] + '</span>';
                                    html += '</div>';
                                }
                                if(!hasProps) html += '<div style="opacity:0.6; font-size:0.85rem;">لا توجد بيانات وصفية متاحة.</div>';
                                html += '</div>';
                                
                                new maplibregl.Popup({closeButton: false, maxWidth: '320px'}).setLngLat(e.lngLat).setHTML(html).addTo(map);
                            } else {
                                map.getSource('highlight-src').setData({ type: 'FeatureCollection', features: [] });
                            }
                        });
                    }
                });
            } catch (e) {
                console.error("Critical Map Error:", e);
            }

            ${templateJS}
        `;

        let htmlWrapper = '';
        if (isZip) {
            htmlWrapper = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PalNovaa Web Map Design</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@200..1000&family=Tajawal:wght@200;300;400;500;700;800;900&family=JetBrains+Mono:wght@100..800&family=Inter:wght@400;700&display=swap" rel="stylesheet">
    <link href="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.css" rel="stylesheet" />
    <script src="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.js"></script>
    <link rel="stylesheet" href="css/style.css">
</head>
<body>
    <div class="app-container" style="position:relative; height: 100vh; width: 100vw; display: flex; flex-direction: column;">
        ${layoutHTML}
        ${customElsHTML}
    </div>
    <div style="position:fixed;bottom:5px;right:8px;z-index:1000;font-size:11px;color:rgba(255,255,255,0.65);text-shadow:0 0 3px rgba(0,0,0,0.6);pointer-events:none;font-family:sans-serif;">Designed in PalNovaa Studio</div>
    <script src="js/app.js"></script>
</body>
</html>`;
        } else {
            htmlWrapper = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PalNovaa Web Map Design</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@200..1000&family=Tajawal:wght@200;300;400;500;700;800;900&family=JetBrains+Mono:wght@100..800&family=Inter:wght@400;700&display=swap" rel="stylesheet">
    <link href="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.css" rel="stylesheet" />
    <script src="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.js"></script>
    <style>
        ${compiledCSS}
    </style>
</head>
<body>
    <div class="app-container" style="position:relative; height: 100vh; width: 100vw; display: flex; flex-direction: column;">
        ${layoutHTML}
        ${customElsHTML}
    </div>
    <div style="position:fixed;bottom:5px;right:8px;z-index:1000;font-size:11px;color:rgba(255,255,255,0.65);text-shadow:0 0 3px rgba(0,0,0,0.6);pointer-events:none;font-family:sans-serif;">Designed in PalNovaa Studio</div>

    <script>
        ${compiledJS}
    </script>
</body>
</html>`;
        }

        // 8. Output/Packaging
        if (isZip) {
            setIsPublishing(true);
            try {
                if (!window.JSZip) {
                    await new Promise((resolve, reject) => {
                        const script = document.createElement('script');
                        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
                        script.onload = resolve;
                        script.onerror = reject;
                        document.head.appendChild(script);
                    });
                }
                const zip = new window.JSZip();
                
                // Add geojson files to data/ folder
                filesToZip.forEach(file => {
                    zip.file(file.name, file.content);
                });
                
                zip.file("index.html", htmlWrapper);
                zip.folder("css").file("style.css", compiledCSS);
                zip.folder("js").file("app.js", compiledJS);
                
                const content = await zip.generateAsync({ type: 'blob' });
                const downloadUrl = URL.createObjectURL(content);
                const a = document.createElement('a');
                a.href = downloadUrl;
                a.download = `PalNovaa_Project_${designSelections.commercialTemplate}_${Date.now()}.zip`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(downloadUrl);
            } catch (err) {
                console.error("ZIP packaging failed:", err);
                alert("فشل تصدير المشروع كـ ZIP: " + err.message);
            } finally {
                setIsPublishing(false);
            }
        } else {
            const blob = new Blob([htmlWrapper], { type: 'text/html' });
            const downloadUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `PalNovaa_Design_${designSelections.layout}_${Date.now()}.html`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(downloadUrl);
        }
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
                                {/* شعار المختبر: شبكة جغرافية ودبوس موقع (GIS/Mapping Grid & Location Pin) */}
                                <circle cx="12" cy="12" r="10" strokeWidth="1.5" opacity="0.4" />
                                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10M12 2a15.3 15.3 0 0 0-4 10 15.3 15.3 0 0 0 4 10" strokeWidth="1.2" opacity="0.3" />
                                <path d="M2 12h20M12 2v20" strokeWidth="1.2" opacity="0.3" />
                                <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7z" strokeWidth="2" fill="currentColor" fillOpacity="0.15" />
                                <circle cx="12" cy="9" r="2" fill="currentColor" />
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
                                {/* شعار المختبر: شبكة جغرافية ودبوس موقع (GIS/Mapping Grid & Location Pin) */}
                                <circle cx="12" cy="12" r="10" strokeWidth="1.5" opacity="0.4" />
                                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10M12 2a15.3 15.3 0 0 0-4 10 15.3 15.3 0 0 0 4 10" strokeWidth="1.2" opacity="0.3" />
                                <path d="M2 12h20M12 2v20" strokeWidth="1.2" opacity="0.3" />
                                <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7z" strokeWidth="2" fill="currentColor" fillOpacity="0.15" />
                                <circle cx="12" cy="9" r="2" fill="currentColor" />
                            </svg>
                        </div>
                        <div className="brand-text">
                            <strong>PalNovaa</strong>
                            <small>مختبر بال نوفا · إصدار 3.1</small>
                        </div>
                    </div>

                    <div className="topbar-divider"></div>

                    <div className="topbar-spacer"></div>

                    <div className="topbar-actions">
                        <button className="top-btn secondary" title="إغلاق المختبر" onClick={onClose} style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            <span>خروج</span>
                        </button>
                    </div>
                </header>

                <div className="tool-dock">
                    <button className={`tool ${drawingMode === null ? 'active' : ''}`} data-tip="مؤشر التحديد" onClick={() => handleToolClick(null)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
                            <path d="M13 13l6 6" />
                        </svg>
                    </button>
                    <button className={`tool ${drawingMode === 'point' ? 'active' : ''}`} data-tip="رسم نقطة" onClick={() => handleToolClick('point')}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="3" /><circle cx="12" cy="12" r="9" />
                        </svg>
                    </button>
                    <button className={`tool ${drawingMode === 'line' ? 'active' : ''}`} data-tip="رسم خط (كليك يمين للإنهاء)" onClick={() => handleToolClick('line')}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="5" y1="19" x2="19" y2="5" /><circle cx="5" cy="19" r="2" /><circle cx="19" cy="5" r="2" />
                        </svg>
                    </button>
                    <button className={`tool ${drawingMode === 'polygon' ? 'active' : ''}`} data-tip="رسم مضلع (كليك يمين للإنهاء)" onClick={() => handleToolClick('polygon')}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5" />
                        </svg>
                    </button>

                    <div className="sidebar-divider"></div>

                    <button className={`tool ${drawingMode === 'measure' ? 'active' : ''}`} data-tip="قياس المسافة (كليك يمين للإنهاء)" onClick={() => handleToolClick('measure')}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21.3 8.7L8.7 21.3a2.4 2.4 0 0 1-3.4 0L2.7 18.7a2.4 2.4 0 0 1 0-3.4L15.3 2.7a2.4 2.4 0 0 1 3.4 0l2.6 2.6a2.4 2.4 0 0 1 0 3.4z" />
                            <path d="M7 17l-3-3M11 13l-3-3M15 9l-3-3" />
                        </svg>
                    </button>

                    <button className={`tool hydro-tool-trigger ${isHydroSimOpen ? 'active' : ''}`} data-tip="محاكاة هيدرولوجية 3D (Hydro Sim)" onClick={() => setIsHydroSimOpen(true)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#06D6F2' }}>
                            <path d="M12 2C6 8 4 12 4 15a8 8 0 0 0 16 0c0-3-2-7-8-13z"/>
                            <path d="M12 15c0-2 1-4 1-4s1 2 1 4a2 2 0 0 1-4 0z" fill="currentColor" opacity="0.5"/>
                        </svg>
                    </button>

                    <button className={`tool ${activeTab === 'paldata' ? 'active' : ''}`} data-tip="استخراج بيانات PalData 🌍" onClick={() => { setActiveTab('paldata'); setDrawingMode(null); }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#ffca28' }}>
                            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                        </svg>
                    </button>

                    <div className="sidebar-bottom">
                        <button
                            key="btn-design-studio-v4"
                            className="tool studio-trigger-btn"
                            data-tip="تصدير الخريطة كتصميم ويب"
                            onClick={launchDesignStudioFinal}
                            style={{
                                color: '#fff',
                                background: 'linear-gradient(135deg, #fbab15 0%, #f59e0b 100%)',
                                border: '2px solid #fff',
                                boxShadow: '0 0 20px rgba(245, 166, 35, 0.45)',
                                fontWeight: 'bold'
                            }}
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                        </button>
                        <button className="tool" data-tip="الإعدادات">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
                        </button>
                    </div>
                </div>

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
                            preserveDrawingBuffer={true}
                        >
                            <NavigationControl position="bottom-right" />

                            {filteredLayerData.filter(l => l.isVisible !== false).map(layer => {
                                const style = layerStyles[layer.id] || {
                                    color: layer.color || '#F5A623',
                                    outlineColor: '#ffffff',
                                    outlineWidth: 2,
                                    shape: 'circle',
                                    opacity: 1,
                                    fillOpacity: 0.3
                                };

                                const getLayerColor = (defaultVal) => {
                                    if (style?.classification?.enabled && style.classification.property && style.classification.colors) {
                                        const matchEntries = Object.entries(style.classification.colors).flatMap(([val, col]) => [val, col]);
                                        if (matchEntries.length > 0) {
                                            return [
                                                'match',
                                                ['coalesce', ['get', style.classification.property], ''],
                                                ...matchEntries,
                                                style.color || defaultVal
                                            ];
                                        }
                                    }
                                    return layer.isPalData ? [
                                        'match',
                                        ['coalesce', ['get', 'palCategory'], ''],
                                        'highway_transport', '#ff7043',
                                        'buildings', '#f472b6',
                                        'landuse', '#84cc16',
                                        'amenities', '#3b82f6',
                                        'leisure_tourism', '#8b5cf6',
                                        'natural_water', '#06b6d4',
                                        'shops', '#fbbf24',
                                        'offices_crafts', '#6b7280',
                                        'infrastructure_emergency', '#ef4444',
                                        'places_boundaries', '#a855f7',
                                        style.color || defaultVal
                                    ] : style.color || defaultVal;
                                };

                                if (layer.type === '3d-mesh') {
                                    return (
                                        <Source key={layer.id} id={`src-${layer.id}`} type="geojson" data={layer.data}>
                                            <Layer
                                                id={`extrusion-${layer.id}`}
                                                type="fill-extrusion"
                                                paint={{
                                                    'fill-extrusion-color': ['get', 'color'],
                                                    'fill-extrusion-height': ['get', 'height'],
                                                    'fill-extrusion-base-height': 0,
                                                    'fill-extrusion-opacity': style.opacity ?? 0.85
                                                }}
                                            />
                                        </Source>
                                    );
                                }

                                if (layer.type === 'raster') {
                                    return (
                                        <Source key={layer.id} id={`src-${layer.id}`} type="image" url={layer.url} coordinates={layer.coordinates}>
                                            <Layer
                                                id={`raster-${layer.id}`}
                                                type="raster"
                                                source={`src-${layer.id}`}
                                                paint={{ 'raster-opacity': style.opacity ?? 0.9 }}
                                            />
                                        </Source>
                                    );
                                }

                                if (layer.type === 'raster-tile') {
                                    return (
                                        <Source key={layer.id} id={`src-${layer.id}`} type="raster" tiles={[layer.url]} tileSize={256}>
                                            <Layer
                                                id={`raster-${layer.id}`}
                                                type="raster"
                                                source={`src-${layer.id}`}
                                                paint={{ 'raster-opacity': style.opacity ?? 0.8 }}
                                            />
                                        </Source>
                                    );
                                }

                                return (
                                    <React.Fragment key={layer.id}>
                                        <Source id={`src-${layer.id}`} type="geojson" data={layer.data}>
                                             {/* Polygons */}
                                             <Layer
                                                 id={`poly-${layer.id}`}
                                                 type="fill"
                                                 filter={['==', '$type', 'Polygon']}
                                                 paint={{
                                                     'fill-color': getLayerColor('#10D9A0'),
                                                     'fill-opacity': layer.isPalData ? 0.35 * (style.opacity ?? 1) : (style.fillOpacity ?? 0.3) * (style.opacity ?? 1),
                                                     'fill-outline-color': style.outlineColor || '#ffffff'
                                                 }}
                                             />
                                             <Layer
                                                 id={`poly-line-${layer.id}`}
                                                 type="line"
                                                 filter={['==', '$type', 'Polygon']}
                                                 paint={{
                                                     'line-color': style.outlineColor || '#ffffff',
                                                     'line-width': layer.isPalData ? 1.0 : style.outlineWidth,
                                                     'line-opacity': style.opacity ?? 1
                                                 }}
                                             />

                                             {/* Lines */}
                                             <Layer
                                                 id={`line-${layer.id}`}
                                                 type="line"
                                                 filter={['==', '$type', 'LineString']}
                                                 paint={{
                                                     'line-color': getLayerColor('#10D9A0'),
                                                     'line-width': layer.isPalData ? [
                                                         'match',
                                                         ['coalesce', ['get', 'palCategory'], ''],
                                                         'highway_transport', '#ff7043',
                                                         'buildings', '#f472b6',
                                                         'landuse', '#84cc16',
                                                         'amenities', '#3b82f6',
                                                         'leisure_tourism', '#8b5cf6',
                                                         'natural_water', '#06b6d4',
                                                         'shops', '#fbbf24',
                                                         'offices_crafts', '#6b7280',
                                                         'infrastructure_emergency', '#ef4444',
                                                         'places_boundaries', '#a855f7',
                                                         style.color || '#10D9A0'
                                                     ] : (style.outlineWidth ?? 2) * 2,
                                                     'line-opacity': style.opacity ?? 1
                                                 }}
                                             />

                                             {/* Points */}
                                             {style.heatmapEnabled ? (
                                                 <Layer
                                                     id={`point-${layer.id}`}
                                                     type="heatmap"
                                                     filter={['==', '$type', 'Point']}
                                                     paint={{
                                                         'heatmap-weight': 1.5,
                                                         'heatmap-intensity': 1.5,
                                                         'heatmap-color': [
                                                             'interpolate',
                                                             ['linear'],
                                                             ['heatmap-density'],
                                                             0, 'rgba(0,0,255,0)',
                                                             0.2, 'royalblue',
                                                             0.4, 'cyan',
                                                             0.6, 'green',
                                                             0.8, 'yellow',
                                                             1.0, 'red'
                                                         ],
                                                         'heatmap-radius': 20,
                                                         'heatmap-opacity': style.opacity ?? 0.85
                                                     }}
                                                 />
                                             ) : (
                                                 <Layer
                                                     id={`point-${layer.id}`}
                                                     type="circle"
                                                     filter={
                                                         style.imageUrl 
                                                             ? ['false'] 
                                                             : (layer.isPalData 
                                                                 ? ['==', '$type', 'Point'] 
                                                                 : ['all', ['==', '$type', 'Point'], ['!', ['has', 'image']]])
                                                     }
                                                     paint={{
                                                         'circle-radius': layer.isPalData ? 5.5 : (layer.isRemoteSensing ? [
                                                             'interpolate',
                                                             ['linear'],
                                                             ['zoom'],
                                                             10, 4,
                                                             14, 12,
                                                             17, 30
                                                         ] : 7),
                                                         'circle-color': layer.isRemoteSensing ? (
                                                             layer.colorRamp === 'grayscale' ? [
                                                                 'interpolate', ['linear'], ['get', 'elevation'],
                                                                 layer.minElevation || 0, '#000000',
                                                                 layer.maxElevation || 500, '#ffffff'
                                                             ] : layer.colorRamp === 'viridis' ? [
                                                                 'interpolate', ['linear'], ['get', 'elevation'],
                                                                 layer.minElevation || 0, '#440154',
                                                                 (layer.minElevation + layer.maxElevation)/2 || 100, '#21918c',
                                                                 layer.maxElevation || 500, '#fde725'
                                                             ] : layer.colorRamp === 'terrain' ? [
                                                                 'interpolate', ['linear'], ['get', 'elevation'],
                                                                 layer.minElevation || 0, '#22c55e',
                                                                 (layer.minElevation + layer.maxElevation)/2 || 100, '#eab308',
                                                                 layer.maxElevation || 500, '#ffffff'
                                                             ] : layer.colorRamp === 'rainbow' ? [
                                                                 'interpolate', ['linear'], ['get', 'elevation'],
                                                                 layer.minElevation || 0, '#0000ff',
                                                                 layer.minElevation + (layer.maxElevation - layer.minElevation) * 0.25 || 100, '#00ffff',
                                                                 layer.minElevation + (layer.maxElevation - layer.minElevation) * 0.5 || 200, '#00ff00',
                                                                 layer.minElevation + (layer.maxElevation - layer.minElevation) * 0.75 || 300, '#ffff00',
                                                                 layer.maxElevation || 500, '#ff0000'
                                                             ] : [
                                                                 'interpolate', ['linear'], ['get', 'elevation'],
                                                                 layer.minElevation || 0, '#312e81',
                                                                 (layer.minElevation + layer.maxElevation)/2 || 100, '#10b981',
                                                                 layer.maxElevation || 500, '#ef4444'
                                                             ]
                                                         ) : getLayerColor('#10D9A0'),
                                                         'circle-stroke-width': layer.isPalData ? 1.5 : style.outlineWidth,
                                                         'circle-stroke-color': layer.isPalData ? '#ffffff' : style.outlineColor,
                                                         'circle-opacity': style.opacity ?? 1,
                                                         'circle-stroke-opacity': style.opacity ?? 1
                                                     }}
                                                 />
                                             )}
                                        </Source>

                                        {/* Render custom react-map-gl Markers for point features with images */}
                                        {!style.heatmapEnabled && layer.data?.features && layer.data.features.map((f, idx) => {
                                            if (f.geometry?.type === 'Point' && (f.properties?.image || style.imageUrl)) {
                                                const coords = f.geometry.coordinates;
                                                const imageSrc = f.properties.image || style.imageUrl;
                                                return (
                                                    <Marker
                                                        key={`img-marker-${layer.id}-${idx}`}
                                                        longitude={coords[0]}
                                                        latitude={coords[1]}
                                                        anchor="bottom"
                                                    >
                                                        <div 
                                                            className="custom-image-marker-wrapper" 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedFeatureInfo({
                                                                    longitude: coords[0],
                                                                    latitude: coords[1],
                                                                    properties: f.properties || {},
                                                                    layerId: layer.id,
                                                                    featureId: f.id || JSON.stringify(f.geometry.coordinates)
                                                                });
                                                            }}
                                                            style={{
                                                                width: '40px', height: '40px',
                                                                borderRadius: '50%',
                                                                border: '2.5px solid white',
                                                                boxShadow: '0 3px 8px rgba(0,0,0,0.45)',
                                                                background: '#1e293b',
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                cursor: 'pointer',
                                                                transition: 'transform 0.2s',
                                                                position: 'relative'
                                                            }}
                                                        >
                                                            <div style={{
                                                                width: '100%', height: '100%',
                                                                borderRadius: '50%',
                                                                backgroundImage: `url(${imageSrc})`,
                                                                backgroundSize: 'cover',
                                                                backgroundPosition: 'center',
                                                            }} />
                                                            <div style={{
                                                                position: 'absolute',
                                                                bottom: '-6px',
                                                                left: '50%',
                                                                transform: 'translateX(-50%)',
                                                                width: '0', height: '0',
                                                                borderLeft: '4px solid transparent',
                                                                borderRight: '4px solid transparent',
                                                                borderTop: '6px solid white'
                                                            }} />
                                                        </div>
                                                    </Marker>
                                                );
                                            }
                                            return null;
                                        })}
                                    </React.Fragment>
                                );
                            })}

                            {/* Highlight Layer */}
                            {highlightFeatures.length > 0 && (
                                <Source id="highlight-source" type="geojson" data={{ type: 'FeatureCollection', features: highlightFeatures }}>
                                    <Layer
                                        id="highlight-outline"
                                        type="line"
                                        paint={{
                                            'line-color': '#06D6F2',
                                            'line-width': 4,
                                            'line-blur': 2
                                        }}
                                    />
                                    <Layer
                                        id="highlight-point"
                                        type="circle"
                                        filter={['==', '$type', 'Point']}
                                        paint={{
                                            'circle-radius': 10,
                                            'circle-color': 'transparent',
                                            'circle-stroke-width': 3,
                                            'circle-stroke-color': '#06D6F2'
                                        }}
                                    />
                                </Source>
                            )}

                            {selectedFeatureInfo && (
                                <Popup
                                    longitude={selectedFeatureInfo.longitude}
                                    latitude={selectedFeatureInfo.latitude}
                                    anchor="bottom"
                                    onClose={() => setSelectedFeatureInfo(null)}
                                    closeOnClick={false}
                                    className="custom-popup"
                                >
                                    <div className="popup-content" style={{ direction: 'rtl', textAlign: 'right', color: 'white', minWidth: '180px' }}>
                                        <h4 style={{ margin: '0 0 8px 0', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px', color: '#06D6F2' }}>
                                            {selectedFeatureInfo.properties.dataset === 'aster30m' ? 'نقطة ارتفاع (ASTER GDEM)' : (selectedFeatureInfo.properties.name || selectedFeatureInfo.properties.name_ar || selectedFeatureInfo.properties.name_en || 'معلم بدون اسم')}
                                        </h4>
                                        <div className="popup-body" style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            {(selectedFeatureInfo.properties.image || layerStyles[selectedFeatureInfo.layerId]?.imageUrl) && (
                                                <div style={{ 
                                                    width: '100%', 
                                                    height: '110px', 
                                                    borderRadius: '8px', 
                                                    marginBottom: '8px', 
                                                    backgroundImage: `url(${selectedFeatureInfo.properties.image || layerStyles[selectedFeatureInfo.layerId]?.imageUrl})`, 
                                                    backgroundSize: 'cover', 
                                                    backgroundPosition: 'center', 
                                                    border: '1.5px solid rgba(6, 214, 242, 0.4)',
                                                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                                                }} />
                                            )}
                                            {selectedFeatureInfo.properties.dataset === 'aster30m' ? (
                                                <>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '15px' }}>
                                                        <span style={{ color: '#94a3b8' }}>الارتفاع:</span>
                                                        <span style={{ color: '#fbab15', fontWeight: 'bold' }}>{selectedFeatureInfo.properties.elevation?.toFixed(1)} م</span>
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '15px' }}>
                                                        <span style={{ color: '#94a3b8' }}>خط العرض:</span>
                                                        <span>{selectedFeatureInfo.latitude.toFixed(6)}</span>
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '15px' }}>
                                                        <span style={{ color: '#94a3b8' }}>خط الطول:</span>
                                                        <span>{selectedFeatureInfo.longitude.toFixed(6)}</span>
                                                    </div>
                                                </>
                                            ) : selectedFeatureInfo.properties.isPalData ? (
                                                <>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '15px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '4px', marginBottom: '4px' }}>
                                                        <span style={{ color: '#94a3b8' }}>التصنيف:</span>
                                                        <span style={{ color: '#fbab15', fontWeight: 'bold' }}>{selectedFeatureInfo.properties.highway}</span>
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <span style={{ color: '#94a3b8' }}>السرعة القصوى:</span>
                                                        <span>{selectedFeatureInfo.properties.maxspeed || 'غير محدد'}</span>
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <span style={{ color: '#94a3b8' }}>السطح:</span>
                                                        <span>{selectedFeatureInfo.properties.surface || 'غير معروف'}</span>
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <span style={{ color: '#94a3b8' }}>اتجاه واحد:</span>
                                                        <span>{selectedFeatureInfo.properties.oneway === 'yes' ? 'نعم' : 'لا'}</span>
                                                    </div>
                                                </>
                                            ) : (
                                                Object.entries(selectedFeatureInfo.properties)
                                                    .filter(([key]) => !['id', 'name', 'color', 'isPalStreet'].includes(key))
                                                    .slice(0, 4)
                                                    .map(([key, val]) => (
                                                        <div key={key} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                                                            <span style={{ color: '#94a3b8' }}>{key}:</span>
                                                            <span style={{ wordBreak: 'break-all', textAlign: 'left' }}>{String(val)}</span>
                                                        </div>
                                                    ))
                                            )}
                                        </div>
                                    </div>
                                </Popup>
                            )}

                            {draftGeoJson && (
                                <Source id="draft-source" type="geojson" data={draftGeoJson}>
                                    <Layer id="draft-line" type="line" paint={{ 'line-color': '#fbab15', 'line-width': 3, 'line-dasharray': [2, 2] }} />
                                    <Layer id="draft-point" type="circle" paint={{ 'circle-radius': 6, 'circle-color': '#fbab15', 'circle-stroke-width': 2, 'circle-stroke-color': 'white' }} />
                                </Source>
                            )}

                            {gisMeasureGeoJson && (
                                <Source id="gis-measure-source" type="geojson" data={gisMeasureGeoJson}>
                                    <Layer id="gis-measure-polygon" type="fill" filter={['==', '$type', 'Polygon']} paint={{ 'fill-color': '#F5A623', 'fill-opacity': 0.25 }} />
                                    <Layer id="gis-measure-line" type="line" filter={['==', '$type', 'LineString']} paint={{ 'line-color': '#F5A623', 'line-width': 3, 'line-dasharray': [2, 1] }} />
                                    <Layer id="gis-measure-point" type="circle" filter={['==', '$type', 'Point']} paint={{ 'circle-radius': 6, 'circle-color': '#F5A623', 'circle-stroke-width': 2, 'circle-stroke-color': 'white' }} />
                                </Source>
                            )}

                            {gisBufferGeoJson && (
                                <Source id="gis-buffer-source" type="geojson" data={gisBufferGeoJson}>
                                    <Layer id="gis-buffer-fill" type="fill" paint={{ 'fill-color': '#06D6F2', 'fill-opacity': 0.15 }} />
                                    <Layer id="gis-buffer-line" type="line" paint={{ 'line-color': '#06D6F2', 'line-width': 2 }} />
                                </Source>
                            )}
                            {gisBufferCenter && (
                                <Source id="gis-buffer-center-source" type="geojson" data={{ type: 'Feature', geometry: { type: 'Point', coordinates: gisBufferCenter } }}>
                                    <Layer id="gis-buffer-center" type="circle" paint={{ 'circle-radius': 7, 'circle-color': '#06D6F2', 'circle-stroke-width': 2, 'circle-stroke-color': 'white' }} />
                                </Source>
                            )}

                            {gisElevGeoJson && (
                                <Source id="gis-elevation-source" type="geojson" data={gisElevGeoJson}>
                                    <Layer id="gis-elevation-line" type="line" filter={['==', '$type', 'LineString']} paint={{ 'line-color': '#EC4899', 'line-width': 3 }} />
                                    <Layer id="gis-elevation-point" type="circle" filter={['==', '$type', 'Point']} paint={{ 'circle-radius': 6, 'circle-color': '#EC4899', 'circle-stroke-width': 2, 'circle-stroke-color': 'white' }} />
                                </Source>
                            )}
                        </Map>

                        {gisSwipeActive && (
                            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10 }}>
                                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'auto', clipPath: `polygon(0 0, ${gisSwipePosition}% 0, ${gisSwipePosition}% 100%, 0 100%)` }}>
                                    <Map
                                        {...mapState}
                                        mapStyle={{
                                            version: 8,
                                            sources: {
                                                'vintage-tiles': {
                                                    type: 'raster',
                                                    tiles: ['https://cartodb-basemaps-a.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png'],
                                                    tileSize: 256
                                                }
                                            },
                                            layers: [
                                                {
                                                    id: 'vintage-layer',
                                                    type: 'raster',
                                                    source: 'vintage-tiles'
                                                }
                                            ]
                                        }}
                                        style={{ width: '100%', height: '100%' }}
                                        attributionControl={false}
                                    />
                                </div>
                            </div>
                        )}

                        {gisSwipeActive && (
                            <div
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    bottom: 0,
                                    left: `${gisSwipePosition}%`,
                                    width: '4px',
                                    background: '#fbab15',
                                    cursor: 'ew-resize',
                                    zIndex: 20,
                                    boxShadow: '0 0 10px rgba(251, 171, 21, 0.5)'
                                }}
                                onMouseDown={(e) => {
                                    const container = e.currentTarget.parentElement;
                                    const onMouseMove = (moveEvent) => {
                                        const rect = container.getBoundingClientRect();
                                        const x = moveEvent.clientX - rect.left;
                                        const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
                                        setGisSwipePosition(pct);
                                    };
                                    const onMouseUp = () => {
                                        window.removeEventListener('mousemove', onMouseMove);
                                        window.removeEventListener('mouseup', onMouseUp);
                                    };
                                    window.addEventListener('mousemove', onMouseMove);
                                    window.addEventListener('mouseup', onMouseUp);
                                }}
                            >
                                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '30px', height: '30px', background: '#fbab15', borderRadius: '50%', border: '2px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.3)', color: 'black', fontWeight: 'bold', fontSize: '14px', pointerEvents: 'none' }}>
                                    ↔
                                </div>
                            </div>
                        )}

                        {gisTourActive && (
                            <div className="gis-tour-card" style={{ position: 'absolute', bottom: '80px', right: '30px', background: 'rgba(10,22,40,0.95)', border: '1px solid var(--primary)', borderRadius: '16px', padding: '20px', zIndex: 100, width: '320px', direction: 'rtl', textAlign: 'right', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', borderTop: '4px solid var(--primary)', backdropFilter: 'blur(10px)', pointerEvents: 'auto' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                    <span style={{ fontSize: '0.8rem', color: '#fbab15', fontWeight: 'bold' }}>جولة المعالم التاريخية (خطوة {gisTourStep + 1} من {TOUR_STEPS.length})</span>
                                    <button onClick={() => setGisTourActive(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
                                </div>
                                <h3 style={{ fontSize: '1.2rem', color: 'white', margin: '0 0 10px 0' }}>{TOUR_STEPS[gisTourStep].name}</h3>
                                <p style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: '1.6', margin: '0 0 15px 0' }}>{TOUR_STEPS[gisTourStep].desc}</p>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                        className="ds-btn secondary small"
                                        style={{ flex: 1, padding: '6px' }}
                                        disabled={gisTourStep === 0}
                                        onClick={() => {
                                            const prevStep = gisTourStep - 1;
                                            setGisTourStep(prevStep);
                                            if (mapRef.current) {
                                                mapRef.current.flyTo({ center: TOUR_STEPS[prevStep].coords, zoom: TOUR_STEPS[prevStep].zoom, duration: 2500 });
                                            }
                                        }}
                                    >
                                        السابق
                                    </button>
                                    <button
                                        className="ds-btn primary small"
                                        style={{ flex: 1, padding: '6px', color: 'black' }}
                                        onClick={() => {
                                            if (gisTourStep < TOUR_STEPS.length - 1) {
                                                const nextStep = gisTourStep + 1;
                                                setGisTourStep(nextStep);
                                                if (mapRef.current) {
                                                    mapRef.current.flyTo({ center: TOUR_STEPS[nextStep].coords, zoom: TOUR_STEPS[nextStep].zoom, duration: 2500 });
                                                }
                                            } else {
                                                setGisTourActive(false);
                                                alert('🎉 شكراً لك! لقد انتهت الجولة الاستكشافية.');
                                            }
                                        }}
                                    >
                                        {gisTourStep === TOUR_STEPS.length - 1 ? 'إنهاء الجولة' : 'التالي'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {measurement && (
                        <div className="measurement-overlay">
                            <span>المسافة: <strong>{measurement > 1000 ? (measurement / 1000).toFixed(2) + ' كم' : measurement.toFixed(1) + ' م'}</strong></span>
                        </div>
                    )}


                    {showBottomTable && activeTableLayer && (
                        <div className="attribute-table-panel">
                            <div className="table-panel-header">
                                <div className="table-title">
                                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" /></svg>
                                    <span>جدول البيانات: {activeTableLayer.name}</span>
                                    <small>
                                        {activeTableLayer.type === 'table' 
                                            ? `${activeTableLayer.data?.length || 0} سجل بيانات`
                                            : (selectedFeatures.length > 0 ? `${selectedFeatures.length} معلم محدد` : `${activeTableLayer.data?.features?.length || 0} معلم`)}
                                    </small>
                                </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    {activeTableLayer.type !== 'table' && (
                                        <button
                                            className="ds-btn primary small"
                                            onClick={() => {
                                                setJoinTargetLayerId(activeTableLayer.id);
                                                setIsJoinModalOpen(true);
                                            }}
                                            style={{ padding: '4px 12px', fontSize: '0.7rem', background: '#10D9A0', color: 'black' }}
                                        >
                                            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" style={{ marginRight: '5px' }}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
                                            ربط بيانات (CSV)
                                        </button>
                                    )}
                                    {selectedFeatures.length > 0 && (
                                        <button
                                            className="ds-btn secondary small"
                                            onClick={() => { setHighlightFeatures([]); setSelectedFeatures([]); }}
                                            style={{ padding: '4px 12px', fontSize: '0.7rem' }}
                                        >
                                            إلغاء التحديد ({selectedFeatures.length})
                                        </button>
                                    )}
                                    <button className="close-table-btn" onClick={() => setShowBottomTable(false)}>
                                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                                    </button>
                                </div>
                            </div>
                            <div className="table-panel-body">
                                <table className="opaque-table">
                                    <thead>
                                        <tr>
                                            <th>#</th>
                                            {attributeKeys.map(k => <th key={k}>{k}</th>)}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(() => {
                                            if (activeTableLayer.type === 'table') {
                                                return (activeTableLayer.data || []).map((row, i) => (
                                                    <tr key={i}>
                                                        <td>{i + 1}</td>
                                                        {attributeKeys.map(k => <td key={k}>{String(row[k] || '-')}</td>)}
                                                    </tr>
                                                ));
                                            }

                                            const allFeatures = activeTableLayer.data?.features || [];
                                            // إذا كان هناك تحديد، نظهر فقط المعالم المختارة
                                            const displayFeatures = selectedFeatures.length > 0 ?
                                                allFeatures.filter(f => {
                                                    const fId = f.id || JSON.stringify(f.geometry.coordinates);
                                                    return selectedFeatures.some(sf => (sf.id || JSON.stringify(sf.geometry.coordinates)) === fId);
                                                }) : allFeatures;

                                            return displayFeatures.map((f, i) => {
                                                const fId = f.id || JSON.stringify(f.geometry.coordinates);
                                                const isHighlighted = selectedFeatures.some(sf => (sf.id || JSON.stringify(sf.geometry.coordinates)) === fId);
                                                
                                                return (
                                                    <tr key={i} className={isHighlighted ? 'highlighted-row' : ''} onClick={() => {
                                                        const coords = f.geometry?.type === 'Point' ? f.geometry.coordinates : (f.geometry?.coordinates?.[0]?.[0] || f.geometry?.coordinates?.[0]);
                                                        if (coords && typeof coords[0] === 'number') {
                                                            mapRef.current.flyTo({ center: coords, zoom: 16 });
                                                            setSelectedFeatureInfo({ properties: f.properties || {}, longitude: coords[0], latitude: coords[1] });
                                                        }
                                                    }}>
                                                        <td>{i + 1}</td>
                                                        {attributeKeys.map(k => <td key={k}>{String(f.properties?.[k] || '-')}</td>)}
                                                    </tr>
                                                );
                                            });
                                        })()}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Join Modal - Fixed & Centered Overlay */}
                    {isJoinModalOpen && (
                        <div style={{
                            position: 'fixed',
                            inset: 0,
                            zIndex: 99999,
                            background: 'rgba(0,0,0,0.85)',
                            backdropFilter: 'blur(10px)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '20px'
                        }}>
                            <div style={{ 
                                maxWidth: '600px', 
                                width: '100%', 
                                padding: '30px', 
                                borderRadius: '28px', 
                                background: '#0f172a', 
                                border: '1px solid rgba(255,255,255,0.1)', 
                                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                                position: 'relative'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                                    <h3 style={{ margin: 0, fontSize: '1.5rem', color: '#10D9A0' }}>ربط حقول بيانات (CSV)</h3>
                                    <button className="close-table-btn" onClick={() => setIsJoinModalOpen(false)}>
                                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                                    </button>
                                </div>

                                <div className="join-form" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    <div className="form-group">
                                        <label style={{ display: 'block', marginBottom: '10px', fontSize: '0.95rem', color: '#94a3b8' }}>1. اختر ملف CSV المصدر:</label>
                                        <select 
                                            value={selectedCsvLayerId} 
                                            onChange={(e) => setSelectedCsvLayerId(e.target.value)}
                                            style={{ width: '100%', padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }}
                                        >
                                            <option value="">-- اختر جدول --</option>
                                            {geoLayers.filter(l => l.type === 'table').map(l => (
                                                <option key={l.id} value={l.id}>{l.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {selectedCsvLayerId && (
                                        <>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                                <div className="form-group">
                                                    <label style={{ display: 'block', marginBottom: '10px', fontSize: '0.85rem', color: '#94a3b8' }}>حقل الربط في الخريطة:</label>
                                                    <select 
                                                        value={joinKeyMap} 
                                                        onChange={(e) => setJoinKeyMap(e.target.value)}
                                                        style={{ width: '100%', padding: '10px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }}
                                                    >
                                                        <option value="">-- اختر حقل --</option>
                                                        {attributeKeys.map(k => <option key={k} value={k}>{k}</option>)}
                                                    </select>
                                                </div>
                                                <div className="form-group">
                                                    <label style={{ display: 'block', marginBottom: '10px', fontSize: '0.85rem', color: '#94a3b8' }}>حقل الربط في CSV:</label>
                                                    <select 
                                                        value={joinKeyCsv} 
                                                        onChange={(e) => setJoinKeyCsv(e.target.value)}
                                                        style={{ width: '100%', padding: '10px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }}
                                                    >
                                                        <option value="">-- اختر حقل --</option>
                                                        {geoLayers.find(l => l.id === selectedCsvLayerId)?.data[0] && Object.keys(geoLayers.find(l => l.id === selectedCsvLayerId).data[0]).map(k => (
                                                            <option key={k} value={k}>{k}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>

                                            <div className="form-group">
                                                <label style={{ display: 'block', marginBottom: '12px', fontSize: '0.95rem', color: '#94a3b8' }}>3. اختر الحقول المراد استيرادها:</label>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', maxHeight: '180px', overflowY: 'auto', padding: '15px', background: 'rgba(0,0,0,0.3)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                    {geoLayers.find(l => l.id === selectedCsvLayerId)?.data[0] && Object.keys(geoLayers.find(l => l.id === selectedCsvLayerId).data[0]).map(k => (
                                                        <label key={k} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.8rem', cursor: 'pointer', color: '#e2e8f0' }}>
                                                            <input 
                                                                type="checkbox" 
                                                                checked={selectedCsvFields.includes(k)}
                                                                style={{ width: '16px', height: '16px', accentColor: '#10D9A0' }}
                                                                onChange={(e) => {
                                                                    if (e.target.checked) setSelectedCsvFields([...selectedCsvFields, k]);
                                                                    else setSelectedCsvFields(selectedCsvFields.filter(f => f !== k));
                                                                }}
                                                            />
                                                            {k}
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>

                                            <div style={{ marginTop: '15px', display: 'flex', gap: '12px' }}>
                                                <button 
                                                    className="ds-btn primary w-100" 
                                                    onClick={handlePerformJoin}
                                                    style={{ background: '#10D9A0', color: 'black', height: '45px', borderRadius: '12px', fontWeight: 'bold' }}
                                                >
                                                    إتمام عملية الربط والحفظ
                                                </button>
                                                <button 
                                                    className="ds-btn secondary" 
                                                    onClick={() => setIsJoinModalOpen(false)}
                                                    style={{ height: '45px', borderRadius: '12px', padding: '0 25px' }}
                                                >
                                                    إلغاء
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </section>

                <aside className="sidebar">
                    <div className="panel-tabs">
                        <div className={`panel-tab ${activeTab === 'layers' ? 'active' : ''}`} onClick={() => setActiveTab('layers')} title="إدارة الطبقات">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
                        </div>
                        <div className={`panel-tab ${activeTab === 'injection' ? 'active' : ''}`} onClick={() => setActiveTab('injection')} title="حقن البيانات">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                        </div>
                        <div className={`panel-tab ${activeTab === 'paldata' ? 'active' : ''}`} onClick={() => setActiveTab('paldata')} title="PalData (بيانات OSM)">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/></svg>
                        </div>
                        <div className={`panel-tab ${activeTab === 'palremotesensing' ? 'active' : ''}`} onClick={() => { setActiveTab('palremotesensing'); setDrawingMode(null); }} title="PalRemoteSensing (استشعار عن بعد)">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="11" width="18" height="6" rx="2" />
                                <path d="M12 2v9M8 2h8M12 17v5M5 11V7a3 3 0 0 1 6 0v4M13 11V7a3 3 0 0 1 6 0v4" />
                            </svg>
                        </div>
                        <div className={`panel-tab ${activeTab === 'gis_tools' ? 'active' : ''}`} onClick={() => { setActiveTab('gis_tools'); setDrawingMode(null); }} title="أدوات Web GIS والتحليل الجغرافي">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
                            </svg>
                        </div>
                    </div>

                    <div className="panel-content">
                        {activeTab === 'layers' && (
                            <div className="tab-content">
                                <div className="panel-section">
                                    <div className="panel-section-title">إضافة بيانات</div>

                                    <div className="upload-box" onClick={() => document.getElementById('geo-upload').click()}>
                                        <input id="geo-upload" type="file" accept=".geojson,.json,.csv,.tif,.tiff,.zip" onChange={handleFileUpload} style={{ display: 'none' }} />
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                                        </svg>
                                        <span>رفع ملف Shapefile ZIP, GeoJSON أو CSV</span>
                                        <div className="formats">
                                            <span className="format-pill">.geojson</span>
                                            <span className="format-pill">.csv</span>
                                            <span className="format-pill">.json</span>
                                        </div>
                                    </div>

                                    <div className="panel-divider" style={{ margin: '15px 0', opacity: 0.2 }}></div>

                                    <div className="link-import-section">
                                        <div className="panel-section-title">استيراد من رابط (URL)</div>
                                        <div className="link-input-group">
                                            <input
                                                type="text"
                                                placeholder="رابط ArcGIS أو GeoJSON..."
                                                value={importLink}
                                                onChange={(e) => setImportLink(e.target.value)}
                                                className="link-import-input"
                                            />
                                            <button
                                                onClick={handleImportLink}
                                                disabled={isImporting}
                                                className="link-import-btn"
                                            >
                                                {isImporting ? '...' : 'جلب'}
                                            </button>
                                        </div>
                                        <small style={{ display: 'block', marginTop: '8px', color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                                            يدعم MapServer و FeatureServer و GeoJSON مباشر.
                                        </small>
                                    </div>

                                    <div className="panel-divider" style={{ margin: '15px 0', opacity: 0.2 }}></div>

                                    <div className="geomolg-import-section">
                                        <div className="panel-section-title">طبقات جيومولج فلسطين (Geomolg)</div>
                                        <div className="geomolg-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginTop: '10px' }}>
                                            {[
                                                { id: 'geo_blocks', name: 'الأحواض والقطع', url: 'https://orthophotos.geomolg.ps/adaptor/rest/services/Blocks_02/MapServer', type: 'raster-tile', color: '#ff5722' },
                                                { id: 'geo_communities', name: 'المجتمعات (نقاط)', url: 'https://orthophotos.geomolg.ps/adaptor/rest/services/Communities_06/MapServer', type: 'raster-tile', color: '#00bcd4' },
                                                { id: 'geo_comm_bounds', name: 'حدود المجتمعات', url: 'https://orthophotos.geomolg.ps/adaptor/rest/services/CommunitiesLandBoundary_04/MapServer', type: 'raster-tile', color: '#8bc34a' },
                                                { id: 'geo_builtup', name: 'المناطق المبنية', url: 'https://orthophotos.geomolg.ps/adaptor/rest/services/BuiltUpAreas_03/MapServer', type: 'raster-tile', color: '#e91e63' }
                                            ].map(layer => {
                                                const isActive = geoLayers.some(l => l.id === layer.id);
                                                return (
                                                    <button
                                                        key={layer.id}
                                                        onClick={() => {
                                                            if (isActive) {
                                                                    setGeoLayers(prev => prev.filter(l => l.id !== layer.id));
                                                            } else {
                                                                setGeoLayers(prev => [...prev, {
                                                                    id: layer.id,
                                                                    name: layer.name,
                                                                    type: 'raster-tile',
                                                                    url: `${layer.url}/export?bbox={bbox-epsg-3857}&bboxSR=3857&layers=show%3A0&size=256%2C256&imageSR=3857&format=png32&transparent=true&f=image`,
                                                                    color: layer.color
                                                                }]);
                                                            }
                                                        }}
                                                        className="ds-btn secondary small"
                                                        style={{
                                                            padding: '8px 4px',
                                                            fontSize: '0.72rem',
                                                            background: isActive ? '#3B82F6' : 'rgba(255,255,255,0.05)',
                                                            color: isActive ? 'white' : 'var(--text-color)',
                                                            border: '1px solid rgba(255,255,255,0.1)',
                                                            borderRadius: '8px',
                                                            cursor: 'pointer',
                                                            textAlign: 'center'
                                                        }}
                                                    >
                                                        {layer.name} {isActive ? '✓' : '+'}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>

                                {geoLayers.length > 0 && (
                                    <div className="panel-section">
                                        <div className="panel-section-title">
                                            <span>الطبقات النشطة</span>
                                            <button onClick={() => { setGeoLayers([]); setLayerStyles({}); }} style={{ color: '#EF4444' }}>إزالة الكل</button>
                                        </div>

                                        {geoLayers.filter(l => !l.isHiddenPoints).map(layer => {
                                            const isTable = layer.type === 'table';
                                            const currentStyle = layerStyles[layer.id] || { color: layer.color };
                                            return (
                                                <div key={layer.id} className={`layer-item active ${isTable ? 'table-layer' : ''}`}>
                                                    <div className="layer-main-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '12px' }}>
                                                        <div className="layer-main-info">
                                                            <div
                                                                className="layer-color-btn"
                                                                onClick={(e) => {
                                                                    if (isTable) return;
                                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                                    setStylePopup({
                                                                        layerId: layer.id,
                                                                        x: window.innerWidth - 360, // Right side position
                                                                        y: Math.max(20, Math.min(window.innerHeight - 600, rect.top - 40))
                                                                    });
                                                                }}
                                                                style={{ 
                                                                    background: isTable ? 'rgba(16, 217, 160, 0.2)' : (currentStyle.color || layer.color),
                                                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                                }}
                                                                title={isTable ? "جدول بيانات" : "تعديل النمط والرموز"}
                                                            >
                                                                {isTable && (
                                                                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#10D9A0" strokeWidth="2.5">
                                                                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                                                        <line x1="3" y1="9" x2="21" y2="9" />
                                                                        <line x1="9" y1="21" x2="9" y2="9" />
                                                                    </svg>
                                                                )}
                                                            </div>
                                                            <div className="layer-text">
                                                                {editingLayerId === layer.id ? (
                                                                    <input
                                                                        autoFocus
                                                                        className="rename-input" maxLength={19}
                                                                        value={tempLayerName}
                                                                        onChange={(e) => setTempLayerName(e.target.value)}
                                                                        onBlur={() => handleRenameLayer(layer.id, tempLayerName)}
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === 'Enter') {
                                                                                e.preventDefault();
                                                                                handleRenameLayer(layer.id, tempLayerName);
                                                                            }
                                                                            if (e.key === 'Escape') setEditingLayerId(null);
                                                                        }}
                                                                    />
                                                                ) : (
                                                                    <h5 onDoubleClick={() => { setEditingLayerId(layer.id); setTempLayerName(layer.name); }}>
                                                                        {layer.name}
                                                                    </h5>
                                                                )}
                                                                <small>
                                                                    {isTable 
                                                                        ? `${layer.data?.length || 0} سجل بيانات` 
                                                                        : `${layer.data?.features?.length || 0} معلم جغرافي`}
                                                                    {layer.isRemoteSensing && (
                                                                        <span style={{ display: 'block', marginTop: '4px', color: '#fbab15' }}>
                                                                            الارتفاع: {layer.minElevation?.toFixed(0)}م - {layer.maxElevation?.toFixed(0)}م
                                                                        </span>
                                                                    )}
                                                                </small>
                                                            </div>
                                                        </div>
                                                        {openActionsLayerId !== layer.id && (
                                                            <div className="layer-actions">
                                                                <button 
                                                                    onClick={() => setOpenActionsLayerId(layer.id)}
                                                                    className="more-actions-btn"
                                                                    style={{ 
                                                                        width: '32px', height: '32px', borderRadius: '8px', 
                                                                        display: 'grid', placeItems: 'center', 
                                                                        background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)' 
                                                                    }}
                                                                    title="خيارات إضافية"
                                                                >
                                                                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                                        <circle cx="12" cy="12" r="1" />
                                                                        <circle cx="12" cy="5" r="1" />
                                                                        <circle cx="12" cy="19" r="1" />
                                                                    </svg>
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {currentStyle?.classification?.enabled && currentStyle.classification.colors && (
                                                        <div className="layer-legend-sublist" style={{ 
                                                            marginTop: '10px', 
                                                            padding: '10px 14px', 
                                                            background: 'rgba(255, 255, 255, 0.03)', 
                                                            borderRadius: '10px', 
                                                            border: '1.5px dashed rgba(6, 214, 242, 0.25)',
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            gap: '6px'
                                                        }}>
                                                            <div style={{ fontSize: '0.75rem', color: '#fbab15', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold' }}>
                                                                <span style={{ fontSize: '0.9rem' }}>🎨</span>
                                                                <span>تصنيف: {currentStyle.classification.property}</span>
                                                            </div>
                                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '6px', marginTop: '4px' }}>
                                                                {Object.entries(currentStyle.classification.colors).map(([val, col]) => (
                                                                    <div key={val} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                                                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: col, border: '1px solid rgba(255,255,255,0.2)', flexShrink: 0 }} />
                                                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={val}>{val || '(فارغ)'}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {openActionsLayerId === layer.id && (
                                                        <div className="expanded-actions" style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.3)', padding: '4px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', width: '100%', marginTop: '8px', justifyContent: 'space-around' }}>
                                                            <button 
                                                                className={`visibility-btn ${layer.isVisible !== false ? 'active' : ''}`} 
                                                                onClick={() => {
                                                                    const baseId = layer.id.replace('-raster', '').replace('-points', '');
                                                                    const targetVisible = !(layer.isVisible !== false);
                                                                    setGeoLayers(prev => prev.map(l => (l.id === layer.id || l.id === `${baseId}-points` || l.id === `${baseId}-raster`) ? { ...l, isVisible: targetVisible } : l));
                                                                }}
                                                                style={{ background: 'rgba(255,255,255,0.05)', border: 'none', cursor: 'pointer', color: layer.isVisible !== false ? 'var(--primary)' : '#666', display: 'flex', alignItems: 'center', padding: '6px', borderRadius: '8px' }}
                                                                title={layer.isVisible !== false ? "إخفاء من الخريطة" : "إظهار على الخريطة"}
                                                            >
                                                                {layer.isVisible !== false ? (
                                                                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                                                                ) : (
                                                                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                                                                )}
                                                            </button>
                                                            <button className="edit" style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '6px' }} onClick={() => { setEditingLayerId(layer.id); setTempLayerName(layer.name); }} title="إعادة تسمية">
                                                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                                                            </button>
                                                            <button style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '6px' }} onClick={() => { 
                                                                setActiveTableLayerId(layer.id); 
                                                                setShowBottomTable(true);
                                                                setGeoLayers(prev => prev.map(l => l.id === layer.id ? { ...l, isVisible: true } : l));
                                                            }} title="عرض البيانات الوصفية">
                                                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" /></svg>
                                                            </button>
                                                            <button style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '6px' }} onClick={() => handleExportLayer(layer)} title={isTable ? "تصدير كملف CSV" : "تصدير كملف GeoJSON"}>
                                                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                                                            </button>
                                                            <button className="delete" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', borderRadius: '8px', padding: '6px' }} onClick={() => { 
                                                                const baseId = layer.id.replace('-raster', '').replace('-points', '').replace('-3d', '');
                                                                setGeoLayers(prev => prev.filter(l => l.id !== layer.id && l.id !== `${baseId}-points` && l.id !== `${baseId}-raster` && l.id !== `${baseId}-3d`)); 
                                                                setLayerStyles(prev => { 
                                                                    const n = { ...prev }; 
                                                                    delete n[layer.id]; 
                                                                    delete n[`${baseId}-points`]; 
                                                                    delete n[`${baseId}-raster`]; 
                                                                    delete n[`${baseId}-3d`];
                                                                    return n; 
                                                                }); 
                                                                if (active3dLayerId === baseId) {
                                                                    setActive3dLayerId(null);
                                                                }
                                                                if (activeTableLayerId === layer.id || activeTableLayerId?.startsWith(baseId)) { 
                                                                    setActiveTableLayerId(null); 
                                                                    setShowBottomTable(false); 
                                                                } 
                                                            }} title="حذف الطبقة">
                                                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                                                            </button>
                                                            <button onClick={() => setOpenActionsLayerId(null)} style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '8px', padding: '6px' }}>
                                                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'injection' && (
                            <div className="tab-content">
                                <div className="panel-section">
                                    <div className="panel-section-title">رفع ملف HTML المستهدف</div>
                                    <div
                                        className="upload-box"
                                        onClick={() => document.getElementById('html-upload').click()}
                                        style={{
                                            borderColor: uploadedHtmlContent ? 'var(--primary)' : 'var(--border)',
                                            background: uploadedHtmlContent ? 'rgba(6, 214, 242, 0.03)' : ''
                                        }}
                                    >
                                        <input id="html-upload" type="file" accept=".html" onChange={handleHtmlFileUpload} style={{ display: 'none' }} />
                                        <svg viewBox="0 0 24 24" fill="none" stroke={uploadedHtmlContent ? 'var(--primary)' : 'currentColor'} strokeWidth="1.5">
                                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                                        </svg>
                                        <span>{uploadedHtmlContent ? `تم تحميل: ${uploadedHtmlName}` : 'اختر ملف خريطة HTML'}</span>
                                    </div>
                                </div>

                                <div className="panel-section">
                                    <div className="panel-section-title">اختيار طبقات للحقن</div>
                                    {geoLayers.length === 0 ? (
                                        <div style={{ padding: '20px', textAlign: 'center', opacity: 0.5, fontSize: '0.8rem' }}>
                                            لا توجد طبقات نشطة حالياً للحقن. قم بإضافة طبقات أولاً.
                                        </div>
                                    ) : (
                                        <div className="injection-layer-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
                                            {geoLayers.map(layer => (
                                                <div
                                                    key={layer.id}
                                                    className={`inject-item ${selectedInjectLayers.includes(layer.id) ? 'active' : ''}`}
                                                    onClick={() => toggleInjectLayer(layer.id)}
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px',
                                                        background: selectedInjectLayers.includes(layer.id) ? 'rgba(6, 214, 242, 0.1)' : 'rgba(255,255,255,0.03)',
                                                        borderRadius: '10px', border: '1px solid',
                                                        borderColor: selectedInjectLayers.includes(layer.id) ? 'var(--primary)' : 'transparent',
                                                        cursor: 'pointer', transition: '0.2s'
                                                    }}
                                                >
                                                    <div style={{
                                                        width: '18px', height: '18px', borderRadius: '4px', border: '2px solid var(--primary)',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        background: selectedInjectLayers.includes(layer.id) ? 'var(--primary)' : 'transparent'
                                                    }}>
                                                        {selectedInjectLayers.includes(layer.id) && <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="black" strokeWidth="4"><polyline points="20 6 9 17 4 12" /></svg>}
                                                    </div>
                                                    <span style={{ fontSize: '0.85rem', flex: 1 }}>{layer.name}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="panel-section" style={{ marginTop: 'auto', paddingTop: '20px' }}>
                                    <button
                                        className="ds-btn primary w-100"
                                        disabled={!uploadedHtmlContent || selectedInjectLayers.length === 0}
                                        onClick={performInjection}
                                        style={{ padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
                                    >
                                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                                        تنفيذ حقن البيانات
                                    </button>
                                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '12px', textAlign: 'center', lineHeight: '1.4' }}>
                                        سيتم دمج الطبقات المختارة داخل ملف الـ HTML المرفوع مع الحفاظ على تصميمه الأصلي وتحديث بياناته برمجياً.
                                    </p>
                                </div>
                            </div>
                        )}

                        {activeTab === 'paldata' && (
                            <div className="tab-content" style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', overflowY: 'auto', paddingRight: '4px' }}>
                                <div className="panel-section" style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '16px', padding: '16px' }}>
                                    <div className="panel-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                                        <span>تصنيفات البيانات المطلوبة 📂</span>
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                            <button 
                                                className="ds-btn outline" 
                                                style={{ fontSize: '0.65rem', padding: '3px 8px', height: 'auto', minHeight: '0', borderRadius: '6px' }}
                                                onClick={() => setPalDataSelectedCategories(Object.keys(PAL_DATA_CATEGORIES))}
                                            >
                                                الكل
                                            </button>
                                            <button 
                                                className="ds-btn outline" 
                                                style={{ fontSize: '0.65rem', padding: '3px 8px', height: 'auto', minHeight: '0', borderRadius: '6px' }}
                                                onClick={() => setPalDataSelectedCategories([])}
                                            >
                                                إلغاء
                                            </button>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto', paddingRight: '4px', paddingLeft: '4px' }}>
                                        {Object.values(PAL_DATA_CATEGORIES).map(cat => {
                                            const isChecked = palDataSelectedCategories.includes(cat.id);
                                            return (
                                                <label 
                                                    key={cat.id} 
                                                    style={{ 
                                                        display: 'flex', 
                                                        alignItems: 'center', 
                                                        justifyContent: 'space-between', 
                                                        padding: '8px 10px', 
                                                        background: isChecked ? 'rgba(255,255,255,0.03)' : 'transparent',
                                                        border: '1px solid',
                                                        borderColor: isChecked ? 'rgba(255,255,255,0.06)' : 'transparent',
                                                        borderRadius: '8px',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s ease'
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                        <input 
                                                            type="checkbox"
                                                            checked={isChecked}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setPalDataSelectedCategories(prev => [...prev, cat.id]);
                                                                } else {
                                                                    setPalDataSelectedCategories(prev => prev.filter(id => id !== cat.id));
                                                                }
                                                            }}
                                                            style={{ width: '16px', height: '16px', accentColor: cat.color }}
                                                        />
                                                        <span style={{ fontSize: '0.8rem', color: isChecked ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: isChecked ? 'bold' : 'normal' }}>
                                                            {cat.name}
                                                        </span>
                                                    </div>
                                                    <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: cat.color, boxShadow: `0 0 6px ${cat.color}` }}></span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="panel-section" style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '16px', padding: '16px' }}>
                                    <div className="panel-section-title">نطاق استخراج البيانات 🗺️</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        <button
                                            className="ds-btn secondary w-100"
                                            disabled={palDataLoading}
                                            onClick={() => {
                                                const map = mapRef.current?.getMap();
                                                if (map) {
                                                    const bounds = map.getBounds();
                                                    fetchPalDataOSM(bounds.getSouth(), bounds.getWest(), bounds.getNorth(), bounds.getEast());
                                                }
                                            }}
                                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px', borderRadius: '10px' }}
                                        >
                                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/></svg>
                                            جلب من حدود الشاشة الحالية
                                        </button>

                                        <button
                                            className={`ds-btn ${drawingMode === 'paldata_poly' ? 'primary' : 'outline'} w-100`}
                                            disabled={palDataLoading}
                                            onClick={() => {
                                                if (drawingMode === 'paldata_poly') {
                                                    setDrawingMode(null);
                                                    setDraftCoordinates([]);
                                                } else {
                                                    setDrawingMode('paldata_poly');
                                                    setDraftCoordinates([]);
                                                }
                                            }}
                                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px', borderRadius: '10px' }}
                                        >
                                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/></svg>
                                            {drawingMode === 'paldata_poly' ? 'إلغاء الرسم المخصص' : 'رسم منطقة مخصصة (مضلع)'}
                                        </button>
                                    </div>
                                </div>

                                {palDataLoading && (
                                    <div className="paldata-progress-card" style={{ padding: '15px', background: 'rgba(6, 214, 242, 0.05)', border: '1px solid rgba(6, 214, 242, 0.2)', borderRadius: '12px', textAlign: 'center' }}>
                                        <div className="loader-ring-small" style={{ margin: '0 auto 10px auto', width: '30px', height: '30px', border: '3px solid rgba(6, 214, 242, 0.1)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'ring-spin 1s linear infinite' }}></div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 'bold' }}>{palDataProgress}</div>
                                    </div>
                                )}

                                {palDataStats && (
                                    <div className="panel-section paldata-stats-panel" style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '16px', padding: '16px' }}>
                                        <div className="panel-section-title">إحصائيات بيانات PalData 📊</div>
                                        <div className="stats-grid" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px', maxHeight: '240px', overflowY: 'auto' }}>
                                            {Object.values(PAL_DATA_CATEGORIES).map(item => (
                                                <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', background: item.color, boxShadow: `0 0 8px ${item.color}` }}></span>
                                                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{item.name}</span>
                                                    </div>
                                                    <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>{palDataStats[item.id] || 0}</span>
                                                </div>
                                            ))}
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: '8px', fontWeight: 'bold' }}>
                                                <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>إجمالي العناصر المستخرجة:</span>
                                                <span style={{ color: 'var(--primary)' }}>
                                                    {Object.values(palDataStats).reduce((a, b) => a + b, 0)}
                                                </span>
                                            </div>
                                        </div>

                                        <button
                                            className="ds-btn primary w-100"
                                            style={{ marginTop: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', borderRadius: '10px' }}
                                            onClick={() => {
                                                const palLayer = geoLayers.find(l => l.isPalData);
                                                if (palLayer) {
                                                    handleExportLayer(palLayer);
                                                } else {
                                                    alert("⚠️ لم يتم العثور على طبقة PalData للتصدير.");
                                                }
                                            }}
                                        >
                                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                                            تصدير طبقة البيانات (GeoJSON)
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'palremotesensing' && (
                            <div className="tab-content" style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%', overflowY: 'auto' }}>
                                <div className="panel-section">
                                    <div className="panel-section-title">الاستشعار عن بعد (ASTER GDEM 30m)</div>
                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.5', marginBottom: '15px' }}>
                                        يقوم هذا النظام بجلب بيانات الارتفاع الرقمية العالمية بدقة 30 متر من أطلس ASTER (التابع لوكالة ناسا ووزارة الاقتصاد اليابانية) للمنطقة المعروضة حالياً على الخريطة.
                                    </p>

                                    <div className="form-group" style={{ marginBottom: '15px' }}>
                                        <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '8px', color: 'var(--text-secondary)' }}>دقة شبكة النقاط (أبعاد الشبكة):</label>
                                        <select 
                                            value={asterGridSize} 
                                            onChange={(e) => setAsterGridSize(parseInt(e.target.value))}
                                            style={{
                                                width: '100%', padding: '10px', background: 'rgba(255,255,255,0.05)',
                                                border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px',
                                                color: 'white', outline: 'none'
                                            }}
                                        >
                                            <option value={8}>8x8 (64 نقطة - سريع جداً)</option>
                                            <option value={10}>10x10 (100 نقطة - سريع)</option>
                                            <option value={12}>12x12 (144 نقطة - 2 طلبات ثانية واحدة)</option>
                                            <option value={15}>15x15 (225 نقطة - 3 طلبات ثانيتين)</option>
                                            <option value={20}>20x20 (400 نقطة - 4 طلبات 3 ثوانٍ)</option>
                                        </select>
                                        <small style={{ display: 'block', marginTop: '6px', color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                                            * يتم تقسيم النقاط إلى مجموعات لعدم تخطي حد الـ API المجاني.
                                        </small>
                                    </div>

                                    <div className="form-group" style={{ marginBottom: '15px' }}>
                                        <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '8px', color: 'var(--text-secondary)' }}>طريقة العرض على الخريطة:</label>
                                        <select 
                                            value={asterViewType} 
                                            onChange={(e) => setAsterViewType(e.target.value)}
                                            style={{
                                                width: '100%', padding: '10px', background: 'rgba(255,255,255,0.05)',
                                                border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px',
                                                color: 'white', outline: 'none'
                                            }}
                                        >
                                            <option value="raster">راستر مستمر (DEM Raster - Bilinear)</option>
                                            <option value="points">شبكة نقاط ملونة (Point Grid)</option>
                                        </select>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        <button
                                            className="ds-btn primary w-100"
                                            disabled={asterLoading}
                                            onClick={() => {
                                                const map = mapRef.current?.getMap();
                                                if (map) {
                                                    const bounds = map.getBounds();
                                                    fetchAsterGDEM(bounds.getSouth(), bounds.getWest(), bounds.getNorth(), bounds.getEast(), asterGridSize);
                                                }
                                            }}
                                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px' }}
                                        >
                                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                                                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                                                <line x1="12" y1="22.08" x2="12" y2="12" />
                                            </svg>
                                            {asterLoading ? 'جاري جلب البيانات...' : 'جلب بيانات الارتفاع للمنطقة الحالية'}
                                        </button>
                                    </div>
                                </div>

                                {asterLoading && (
                                    <div style={{ padding: '15px', background: 'rgba(251, 171, 21, 0.05)', border: '1px solid rgba(251, 171, 21, 0.2)', borderRadius: '12px', textAlign: 'center' }}>
                                        <div className="loader-ring-small" style={{ margin: '0 auto 10px auto', width: '30px', height: '30px', border: '3px solid rgba(251, 171, 21, 0.1)', borderTopColor: '#fbab15', borderRadius: '50%', animation: 'ring-spin 1s linear infinite' }}></div>
                                        <div style={{ fontSize: '0.85rem', color: 'white', fontWeight: 'bold' }}>{asterProgress}</div>
                                    </div>
                                )}

                                {(() => {
                                    const activeLayer = geoLayers.find(l => l.id === activeAsterLayerId) || geoLayers.find(l => l.isRemoteSensing);
                                    if (!activeLayer) return null;

                                    return (
                                        <div className="panel-section" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '15px' }}>
                                            <div className="panel-section-title" style={{ color: '#fbab15', marginBottom: '12px' }}>الطبقة النشطة: {activeLayer.name.split(' - ')[0]}</div>
                                            
                                            <div style={{ marginBottom: '18px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                                                    <span>الحد الأدنى: {activeLayer.minElevation?.toFixed(1)}م</span>
                                                    <span>الحد الأقصى: {activeLayer.maxElevation?.toFixed(1)}م</span>
                                                </div>
                                                <div style={{
                                                    height: '12px',
                                                    background: 'linear-gradient(to left, #312e81, #10b981, #ef4444)',
                                                    borderRadius: '6px',
                                                    boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5)'
                                                }}></div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px', padding: '0 5px' }}>
                                                    <span>منخفض</span>
                                                    <span>متوسط</span>
                                                    <span>مرتفع</span>
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                <button
                                                    className="ds-btn secondary w-100"
                                                    onClick={() => exportAsterToCSV(activeLayer)}
                                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px', fontSize: '0.85rem' }}
                                                >
                                                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" /></svg>
                                                    تحميل البيانات كملف CSV
                                                </button>
                                                <button
                                                    className="ds-btn secondary w-100"
                                                    onClick={() => exportAsterToGeoJSON(activeLayer)}
                                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px', fontSize: '0.85rem' }}
                                                >
                                                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                                                    تحميل البيانات كملف GeoJSON
                                                </button>
                                                <button
                                                    className="ds-btn secondary w-100"
                                                    onClick={() => exportAsterToGeoTIFF(activeLayer)}
                                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px', fontSize: '0.85rem' }}
                                                >
                                                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                                                    تحميل البيانات كملف GeoTIFF (.tif)
                                                </button>
                                            </div>

                                            {(() => {
                                                const baseId = activeLayer.id.replace('-raster', '').replace('-points', '').replace('-3d', '');
                                                const is3d = active3dLayerId === baseId;
                                                return (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '15px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '15px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                            <span style={{ fontSize: '0.85rem', color: 'white' }}>النمذجة ثلاثية الأبعاد (3D Model)</span>
                                                            <button
                                                                onClick={() => toggle3dModel(baseId)}
                                                                className={`ds-btn ${is3d ? 'primary' : 'secondary'} small`}
                                                                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                                                            >
                                                                {is3d ? 'إيقاف 3D' : 'تشغيل 3D'}
                                                            </button>
                                                        </div>
                                                        
                                                        {is3d && (
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                                    <span>مبالغة الارتفاع:</span>
                                                                    <span>{exaggeration3d}x</span>
                                                                </div>
                                                                <input
                                                                    type="range"
                                                                    min="0.5"
                                                                    max="10"
                                                                    step="0.5"
                                                                    value={exaggeration3d}
                                                                    onChange={(e) => handleExaggerationChange(parseFloat(e.target.value))}
                                                                    style={{ width: '100%' }}
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    );
                                })()}
                            </div>
                        )}

                        {activeTab === 'gis_tools' && (
                            <div className="tab-content" style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%', overflowY: 'auto' }}>
                                <div className="panel-section">
                                    <div className="panel-section-title">أدوات Web GIS والتحليل الجغرافي</div>
                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.5', marginBottom: '15px' }}>
                                        بيئة متكاملة لإجراء التحليلات المكانية المتقدمة وحساب المسافات والمساحات وقياس فروق الارتفاع عبر مسارات مرسومة.
                                    </p>

                                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '12px', marginBottom: '15px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                            <span style={{ fontSize: '1.2rem' }}>📏</span>
                                            <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#fbab15' }}>أدوات القياس الجغرافي</span>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                                            <button
                                                className={`ds-btn ${gisMeasureType === 'distance' && drawingMode === 'gis_measure' ? 'primary' : 'secondary'} small`}
                                                style={{ flex: 1, padding: '8px', fontSize: '0.8rem' }}
                                                onClick={() => {
                                                    setDrawingMode('gis_measure');
                                                    setGisMeasureType('distance');
                                                    setGisMeasurePoints([]);
                                                    setGisMeasureResult(null);
                                                }}
                                            >
                                                قياس مسافة
                                            </button>
                                            <button
                                                className={`ds-btn ${gisMeasureType === 'area' && drawingMode === 'gis_measure' ? 'primary' : 'secondary'} small`}
                                                style={{ flex: 1, padding: '8px', fontSize: '0.8rem' }}
                                                onClick={() => {
                                                    setDrawingMode('gis_measure');
                                                    setGisMeasureType('area');
                                                    setGisMeasurePoints([]);
                                                    setGisMeasureResult(null);
                                                }}
                                            >
                                                قياس مساحة
                                            </button>
                                        </div>
                                        {gisMeasureResult && (
                                            <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '8px 12px', fontSize: '0.85rem' }}>
                                                {gisMeasureResult.length > 0 && (
                                                    <div>المسافة الإجمالية: <strong style={{ color: 'var(--primary)' }}>{gisMeasureResult.length > 1000 ? (gisMeasureResult.length / 1000).toFixed(2) + ' كم' : gisMeasureResult.length.toFixed(1) + ' م'}</strong></div>
                                                )}
                                                {gisMeasureResult.area > 0 && (
                                                    <div>
                                                        <div>المساحة: <strong style={{ color: 'var(--primary)' }}>{gisMeasureResult.area.toLocaleString(undefined, {maximumFractionDigits: 1})} م²</strong></div>
                                                        <div style={{ marginTop: '3px', fontSize: '0.8rem', opacity: 0.8 }}>بالدونم: <strong style={{ color: '#06D6F2' }}>{(gisMeasureResult.area / 1000).toFixed(2)} دونم</strong></div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        {drawingMode === 'gis_measure' && (
                                            <div style={{ fontSize: '0.75rem', color: '#fbab15', marginTop: '6px', textAlign: 'center' }}>
                                                * انقر على الخريطة لرسم النقاط والمسار
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '12px', marginBottom: '15px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                            <span style={{ fontSize: '1.2rem' }}>🔵</span>
                                            <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#fbab15' }}>تحليل النطاق العازل (Buffer Zone)</span>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                <span>نصف القطر:</span>
                                                <span>{gisBufferRadius} كم</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="1"
                                                max="20"
                                                value={gisBufferRadius}
                                                onChange={(e) => setGisBufferRadius(parseInt(e.target.value))}
                                                style={{ width: '100%', accentColor: 'var(--primary)' }}
                                            />
                                        </div>
                                        <button
                                            className={`ds-btn ${drawingMode === 'gis_buffer' ? 'primary' : 'secondary'} small w-100`}
                                            style={{ padding: '8px', fontSize: '0.8rem', marginBottom: '10px' }}
                                            onClick={() => {
                                                setDrawingMode('gis_buffer');
                                                setGisBufferCenter(null);
                                                setGisBufferResults([]);
                                            }}
                                        >
                                            تحديد مركز النطاق
                                        </button>
                                        {gisBufferResults.length > 0 && (
                                            <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '8px', maxHeight: '150px', overflowY: 'auto', fontSize: '0.8rem' }}>
                                                <div style={{ fontWeight: 'bold', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px', marginBottom: '6px', color: '#06D6F2' }}>المعالم داخل النطاق ({gisBufferResults.length}):</div>
                                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                                                    <thead>
                                                        <tr style={{ opacity: 0.6, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                            <th style={{ padding: '4px' }}>المعلم</th>
                                                            <th style={{ padding: '4px' }}>المسافة</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {gisBufferResults.map((r, i) => (
                                                            <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                                                <td style={{ padding: '4px', color: 'white' }}>{r.name}</td>
                                                                <td style={{ padding: '4px', direction: 'ltr', textAlign: 'right' }}>{r.distance > 1000 ? (r.distance / 1000).toFixed(2) + ' كم' : r.distance + ' م'}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '12px', marginBottom: '15px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                            <span style={{ fontSize: '1.2rem' }}>📈</span>
                                            <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#fbab15' }}>حساب الارتفاعات (Elevation Profiler)</span>
                                        </div>
                                        <button
                                            className={`ds-btn ${drawingMode === 'gis_elevation' ? 'primary' : 'secondary'} small w-100`}
                                            style={{ padding: '8px', fontSize: '0.8rem', marginBottom: '10px' }}
                                            onClick={() => {
                                                setDrawingMode('gis_elevation');
                                                setGisElevPoints([]);
                                                setGisElevProfile([]);
                                            }}
                                        >
                                            رسم مسار الارتفاع
                                        </button>
                                        {gisElevProfile.length > 0 && (
                                            <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '8px', fontSize: '0.8rem' }}>
                                                <div style={{ fontWeight: 'bold', marginBottom: '6px', color: '#EC4899' }}>مقطع الارتفاع الرأسي:</div>
                                                <div style={{ height: '100px', display: 'flex', alignItems: 'flex-end', gap: '2px', borderLeft: '1px solid rgba(255,255,255,0.2)', borderBottom: '1px solid rgba(255,255,255,0.2)', padding: '5px 0 0 5px' }}>
                                                    {(() => {
                                                        const heights = gisElevProfile.map(p => p.elevation);
                                                        const minH = Math.min(...heights);
                                                        const maxH = Math.max(...heights);
                                                        const range = maxH - minH || 1;
                                                        return gisElevProfile.map((p, i) => {
                                                            const hPct = ((p.elevation - minH) / range) * 80 + 10;
                                                            return (
                                                                <div
                                                                    key={i}
                                                                    style={{ flex: 1, height: `${hPct}%`, background: 'linear-gradient(to top, #EC4899, #F472B6)', minWidth: '4px', borderRadius: '2px 2px 0 0' }}
                                                                    title={`المسافة: ${p.distance}م، الارتفاع: ${p.elevation}م`}
                                                                ></div>
                                                            );
                                                        });
                                                    })()}
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                                    <span>البداية (0م)</span>
                                                    <span>النهاية ({gisElevProfile[gisElevProfile.length - 1].distance}م)</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'white', marginTop: '6px', fontWeight: 'bold' }}>
                                                    <span>أدنى ارتفاع: {Math.min(...gisElevProfile.map(p => p.elevation))}م</span>
                                                    <span>أقصى ارتفاع: {Math.max(...gisElevProfile.map(p => p.elevation))}م</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '12px', marginBottom: '15px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                            <span style={{ fontSize: '1.2rem' }}>⏳</span>
                                            <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#fbab15' }}>البعد الزمني والمقارنة التاريخية</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                                            <span style={{ fontSize: '0.85rem' }}>تفعيل الفلتر الزمني:</span>
                                            <div
                                                onClick={() => setGisTimeActive(!gisTimeActive)}
                                                style={{ width: '40px', height: '20px', background: gisTimeActive ? 'var(--primary)' : 'rgba(255,255,255,0.1)', borderRadius: '10px', position: 'relative', cursor: 'pointer', transition: '0.3s' }}
                                            >
                                                <div style={{ width: '14px', height: '14px', background: 'white', borderRadius: '50%', position: 'absolute', top: '3px', left: gisTimeActive ? '23px' : '3px', transition: '0.3s' }}></div>
                                            </div>
                                        </div>
                                        {gisTimeActive && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '15px', background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                                                    <span>الفترة الزمنية:</span>
                                                    <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{gisTimeValue} م</span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="1900"
                                                    max="2026"
                                                    value={gisTimeValue}
                                                    onChange={(e) => setGisTimeValue(parseInt(e.target.value))}
                                                    style={{ width: '100%', accentColor: 'var(--primary)' }}
                                                />
                                            </div>
                                        )}

                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <span style={{ fontSize: '0.85rem' }}>شاشة المقارنة (Swipe Screen):</span>
                                            <div
                                                onClick={() => setGisSwipeActive(!gisSwipeActive)}
                                                style={{ width: '40px', height: '20px', background: gisSwipeActive ? 'var(--primary)' : 'rgba(255,255,255,0.1)', borderRadius: '10px', position: 'relative', cursor: 'pointer', transition: '0.3s' }}
                                            >
                                                <div style={{ width: '14px', height: '14px', background: 'white', borderRadius: '50%', position: 'absolute', top: '3px', left: gisSwipeActive ? '23px' : '3px', transition: '0.3s' }}></div>
                                            </div>
                                        </div>
                                        {gisSwipeActive && (
                                            <div style={{ fontSize: '0.75rem', color: '#06D6F2', marginTop: '6px', textAlign: 'center' }}>
                                                * اسحب الخط الرأسي في وسط الخريطة للمقارنة بين صور الأقمار الصناعية والأطلس التاريخي
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '12px', marginBottom: '15px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                            <span style={{ fontSize: '1.2rem' }}>🌐</span>
                                            <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#fbab15' }}>استيراد رابط وب خارجي (WMS/XYZ/GeoJSON)</span>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <input
                                                type="text"
                                                placeholder="أدخل رابط GeoJSON أو XYZ/WMS..."
                                                value={gisApiUrl}
                                                onChange={(e) => setGisApiUrl(e.target.value)}
                                                style={{ width: '100%', padding: '8px 12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', fontSize: '0.8rem', outline: 'none' }}
                                            />
                                            <button
                                                className="ds-btn secondary small"
                                                onClick={async () => {
                                                    if (!gisApiUrl.trim()) return;
                                                    try {
                                                        let type = 'geojson';
                                                        if (gisApiUrl.includes('{z}') || gisApiUrl.includes('{x}') || gisApiUrl.includes('{y}')) type = 'xyz';
                                                        else if (gisApiUrl.toLowerCase().includes('service=wms') || gisApiUrl.toLowerCase().includes('wms')) type = 'wms';
                                                        
                                                        if (type === 'geojson') {
                                                            const res = await axios.get(gisApiUrl);
                                                            const newLayerId = `remote-${Date.now()}`;
                                                            const newLayer = {
                                                                id: newLayerId,
                                                                name: 'رابط خارجي (GeoJSON)',
                                                                data: res.data,
                                                                color: '#10D9A0',
                                                                isVisible: true
                                                            };
                                                            setGeoLayers(prev => [...prev, newLayer]);
                                                            alert('✅ تم استيراد طبقة GeoJSON بنجاح!');
                                                        } else {
                                                            const newLayerId = `raster-${Date.now()}`;
                                                            const newLayer = {
                                                                id: newLayerId,
                                                                name: type === 'xyz' ? 'بلاط XYZ مخصص' : 'خدمة WMS مخصصة',
                                                                type: 'raster',
                                                                url: gisApiUrl,
                                                                coordinates: [
                                                                    [-180, 90],
                                                                    [180, 90],
                                                                    [180, -90],
                                                                    [-180, -90]
                                                                ],
                                                                isVisible: true
                                                            };
                                                            setGeoLayers(prev => [...prev, newLayer]);
                                                            alert('✅ تم إضافة خدمة الراستر بنجاح!');
                                                        }
                                                    } catch (e) {
                                                        alert('❌ فشل تحميل الرابط: يرجى التأكد من صحة الرابط وسماحية الكورس (CORS).');
                                                    }
                                                }}
                                            >
                                                تحميل واستيراد
                                            </button>
                                        </div>
                                    </div>

                                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '12px', marginBottom: '15px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ fontSize: '1.2rem' }}>🔥</span>
                                                <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#fbab15' }}>خريطة كثافة حرارية (Heatmap)</span>
                                            </div>
                                            <div
                                                onClick={() => {
                                                    const activeId = activeTableLayerId;
                                                    if (!activeId) {
                                                        alert('يرجى تحديد طبقة نشطة أولاً.');
                                                        return;
                                                    }
                                                    setLayerStyles(prev => {
                                                        const current = prev[activeId] || {};
                                                        return {
                                                            ...prev,
                                                            [activeId]: {
                                                                ...current,
                                                                heatmapEnabled: !current.heatmapEnabled
                                                            }
                                                        };
                                                    });
                                                }}
                                                style={{ width: '40px', height: '20px', background: layerStyles[activeTableLayerId]?.heatmapEnabled ? 'var(--primary)' : 'rgba(255,255,255,0.1)', borderRadius: '10px', position: 'relative', cursor: 'pointer', transition: '0.3s' }}
                                            >
                                                <div style={{ width: '14px', height: '14px', background: 'white', borderRadius: '50%', position: 'absolute', top: '3px', left: layerStyles[activeTableLayerId]?.heatmapEnabled ? '23px' : '3px', transition: '0.3s' }}></div>
                                            </div>
                                        </div>
                                        <small style={{ display: 'block', marginTop: '6px', color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                                            * يحول النقاط في الطبقة النشطة المحددة إلى خريطة كثافة حرارية متوهجة ديناميكياً.
                                        </small>
                                    </div>

                                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '12px', marginBottom: '15px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                            <span style={{ fontSize: '1.2rem' }}>✈️</span>
                                            <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#fbab15' }}>جولة المعالم والمدن التاريخية</span>
                                        </div>
                                        <button
                                            className="ds-btn primary small w-100"
                                            style={{ padding: '8px', fontSize: '0.8rem', marginBottom: '10px' }}
                                            onClick={() => {
                                                setGisTourActive(true);
                                                setGisTourStep(0);
                                                const step = TOUR_STEPS[0];
                                                if (mapRef.current) {
                                                    mapRef.current.flyTo({ center: step.coords, zoom: step.zoom, duration: 3000 });
                                                }
                                            }}
                                        >
                                            بدء جولة سياحية تاريخية
                                        </button>
                                    </div>

                                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '12px', marginBottom: '15px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                            <span style={{ fontSize: '1.2rem' }}>📍</span>
                                            <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#fbab15' }}>تحديد الموقع وحساب المسافات GPS</span>
                                        </div>
                                        <button
                                            className="ds-btn secondary small w-100"
                                            style={{ padding: '8px', fontSize: '0.8rem', marginBottom: '10px' }}
                                            onClick={() => {
                                                if (!navigator.geolocation) {
                                                    alert('متصفحك لا يدعم نظام تحديد المواقع GPS.');
                                                    return;
                                                }
                                                navigator.geolocation.getCurrentPosition(
                                                    (pos) => {
                                                        const userCoords = [pos.coords.longitude, pos.coords.latitude];
                                                        if (mapRef.current) {
                                                            mapRef.current.flyTo({ center: userCoords, zoom: 14 });
                                                        }
                                                        let closest = null;
                                                        let minDist = Infinity;
                                                        geoLayers.forEach(layer => {
                                                            if (!layer.data?.features) return;
                                                            layer.data.features.forEach(f => {
                                                                if (!f.geometry) return;
                                                                let fCoord = null;
                                                                if (f.geometry.type === 'Point') fCoord = f.geometry.coordinates;
                                                                else if (f.geometry.coordinates?.[0]?.[0]) fCoord = f.geometry.coordinates[0][0];
                                                                else if (f.geometry.coordinates?.[0]) fCoord = f.geometry.coordinates[0];
                                                                
                                                                if (fCoord) {
                                                                    const dist = haversineDistance(userCoords, fCoord);
                                                                    if (dist < minDist) {
                                                                        minDist = dist;
                                                                        closest = {
                                                                            name: f.properties?.name || f.properties?.name_ar || f.properties?.title || 'معلم جغرافي',
                                                                            category: layer.name,
                                                                            distance: dist
                                                                        };
                                                                    }
                                                                }
                                                            });
                                                        });
                                                        if (closest) {
                                                            alert(`📍 موقعك الحالي: ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}\n\nأقرب معلم تاريخي إليك هو: "${closest.name}" (${closest.category}) ويبعد عنك مسافة ${(closest.distance / 1000).toFixed(2)} كم.`);
                                                        } else {
                                                            alert(`📍 موقعك الحالي: ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}\n\nلم يتم العثور على معالم محملة لحساب المسافة.`);
                                                        }
                                                    },
                                                    (err) => {
                                                        alert('❌ فشل تحديد موقعك: يرجى إعطاء المتصفح صلاحية الوصول للـ GPS.');
                                                    },
                                                    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
                                                );
                                            }}
                                        >
                                            GPS: أقرب معلم لموقعي
                                        </button>
                                    </div>

                                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '12px', marginBottom: '15px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ fontSize: '1.2rem' }}>🔍</span>
                                                <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#fbab15' }}>استعلام بالإشارة (Reverse Geocoding)</span>
                                            </div>
                                            <div
                                                onClick={() => {
                                                    setGisReverseGeocodingActive(!gisReverseGeocodingActive);
                                                    setGisReverseGeocodingResult(null);
                                                    if (!gisReverseGeocodingActive) {
                                                        alert('انقر الآن على أي مكان في الخريطة لعرض تفاصيل الموقع وأقرب معلم.');
                                                    }
                                                }}
                                                style={{ width: '40px', height: '20px', background: gisReverseGeocodingActive ? 'var(--primary)' : 'rgba(255,255,255,0.1)', borderRadius: '10px', position: 'relative', cursor: 'pointer', transition: '0.3s' }}
                                            >
                                                <div style={{ width: '14px', height: '14px', background: 'white', borderRadius: '50%', position: 'absolute', top: '3px', left: gisReverseGeocodingActive ? '23px' : '3px', transition: '0.3s' }}></div>
                                            </div>
                                        </div>
                                        {gisReverseGeocodingActive && (
                                            <div style={{ fontSize: '0.75rem', color: '#fbab15', marginTop: '4px' }}>
                                                * اضغط على الخريطة للاستعلام
                                            </div>
                                        )}
                                        {gisReverseGeocodingResult && (
                                            <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '10px', fontSize: '0.85rem', marginTop: '10px' }}>
                                                <div>📍 الإحداثيات: <span style={{ fontFamily: 'monospace' }}>{gisReverseGeocodingResult.lat.toFixed(5)}, {gisReverseGeocodingResult.lng.toFixed(5)}</span></div>
                                                {gisReverseGeocodingResult.closestName && (
                                                    <div style={{ marginTop: '5px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '5px' }}>
                                                        أقرب معلم: <strong style={{ color: 'var(--primary)' }}>{gisReverseGeocodingResult.closestName}</strong> ({gisReverseGeocodingResult.closestCategory}) يبعد مسافة {gisReverseGeocodingResult.distance > 1000 ? (gisReverseGeocodingResult.distance / 1000).toFixed(2) + ' كم' : gisReverseGeocodingResult.distance + ' م'}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '12px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                            <span style={{ fontSize: '1.2rem' }}>💾</span>
                                            <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#fbab15' }}>حفظ وتصدير اللوحة</span>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                            <button
                                                className="ds-btn secondary small w-100"
                                                onClick={handlePrintMap}
                                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px' }}
                                            >
                                                📷 التقاط خريطة عالية الدقة HD PNG
                                            </button>
                                            <button
                                                className="ds-btn secondary small w-100"
                                                onClick={handleExportFilteredGeoJSON}
                                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px' }}
                                            >
                                                📥 تصدير الطبقة المصفاة (GeoJSON)
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </aside>

                {/* ADVANCED STYLE POPUP */}
                {stylePopup && (() => {
                    const layerId = stylePopup.layerId;
                    const layer = geoLayers.find(l => l.id === layerId);
                    const style = layerStyles[layerId] || { color: layer?.color || '#fbab15', outlineColor: '#ffffff', outlineWidth: 2, shape: 'circle', opacity: 1, fillOpacity: 0.3 };

                    const updateStyle = (key, val) => {
                        setLayerStyles(prev => ({
                            ...prev,
                            [layerId]: { ...style, [key]: val }
                        }));
                    };

                    return (
                        <div className="style-editor-popup" style={{ position: 'fixed', left: stylePopup.x, top: stylePopup.y, zIndex: 5000 }}>
                            <div className="style-editor-header">
                                <span>تنسيق الطبقة: {layer?.name}</span>
                                <button onClick={() => setStylePopup(null)}>✕</button>
                            </div>
                            <div className="style-editor-body">
                                {layer?.isRemoteSensing ? (
                                    <>
                                        <div className="style-section">
                                            <label>مخطط الألوان (Color Ramp)</label>
                                            <select 
                                                value={layer.colorRamp || 'classic'} 
                                                onChange={(e) => {
                                                    const newRamp = e.target.value;
                                                    const baseId = layer.id.replace('-raster', '').replace('-points', '').replace('-3d', '');
                                                    setGeoLayers(prev => prev.map(l => {
                                                        if (l.id === `${baseId}-raster` && l.rawResults) {
                                                            const updatedUrl = generateDemRaster(l.rawResults, l.gridSize, l.south, l.west, l.north, l.east, newRamp);
                                                            return { ...l, colorRamp: newRamp, url: updatedUrl.url };
                                                        }
                                                        if (l.id === `${baseId}-points` || l.id === baseId) {
                                                            return { ...l, colorRamp: newRamp };
                                                        }
                                                        return l;
                                                    }));
                                                }}
                                                style={{
                                                    width: '100%',
                                                    background: '#1e293b',
                                                    color: 'white',
                                                    border: '1px solid rgba(255,255,255,0.1)',
                                                    padding: '8px',
                                                    borderRadius: '8px',
                                                    marginTop: '4px',
                                                    fontFamily: 'Tajawal, sans-serif'
                                                }}
                                            >
                                                <option value="classic">كلاسيكي (أزرق - أخضر - أحمر)</option>
                                                <option value="viridis">فيريديس (بنفسجي - فيروزي - أصفر)</option>
                                                <option value="terrain">تضاريس الطبيعة (أخضر - بني - أبيض)</option>
                                                <option value="grayscale">تدرج الرمادي (أسود - أبيض)</option>
                                                <option value="rainbow">قوس قزح (كاملا)</option>
                                            </select>
                                        </div>

                                        <div className="style-section">
                                            <div className="label-row">
                                                <label>الشفافية الكلية</label>
                                                <span>{Math.round((style.opacity ?? 0.85) * 100)}%</span>
                                            </div>
                                            <input 
                                                type="range" 
                                                min="0" 
                                                max="1" 
                                                step="0.05" 
                                                value={style.opacity ?? 0.85} 
                                                onChange={(e) => {
                                                    const val = parseFloat(e.target.value);
                                                    const baseId = layer.id.replace('-raster', '').replace('-points', '').replace('-3d', '');
                                                    setLayerStyles(prev => ({
                                                        ...prev,
                                                        [`${baseId}-raster`]: { ...prev[`${baseId}-raster`], opacity: val },
                                                        [`${baseId}-points`]: { ...prev[`${baseId}-points`], opacity: val },
                                                        [`${baseId}-3d`]: { ...prev[`${baseId}-3d`], opacity: val },
                                                        [layer.id]: { ...style, opacity: val }
                                                    }));
                                                }} 
                                            />
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="style-section">
                                            <label>لون التعبئة / الأساس</label>
                                            <div className="color-row">
                                                <input type="color" value={style.color} onChange={(e) => updateStyle('color', e.target.value)} />
                                                <input type="text" value={style.color} onChange={(e) => updateStyle('color', e.target.value)} className="mono-input" />
                                            </div>
                                        </div>

                                        <div className="style-section">
                                            <label>لون الإطار (Outline)</label>
                                            <div className="color-row">
                                                <input type="color" value={style.outlineColor} onChange={(e) => updateStyle('outlineColor', e.target.value)} />
                                                <input type="text" value={style.outlineColor} onChange={(e) => updateStyle('outlineColor', e.target.value)} className="mono-input" />
                                            </div>
                                        </div>

                                        <div className="style-section">
                                            <div className="label-row">
                                                <label>سمك الإطار / الخط</label>
                                                <span>{style.outlineWidth}px</span>
                                            </div>
                                            <input type="range" min="0" max="10" step="0.5" value={style.outlineWidth} onChange={(e) => updateStyle('outlineWidth', parseFloat(e.target.value))} />
                                        </div>

                                        <div className="style-section">
                                            <div className="label-row">
                                                <label>الشفافية الكلية</label>
                                                <span>{Math.round(style.opacity * 100)}%</span>
                                            </div>
                                            <input type="range" min="0" max="1" step="0.05" value={style.opacity} onChange={(e) => updateStyle('opacity', parseFloat(e.target.value))} />
                                        </div>

                                        <div className="style-section">
                                            <div className="label-row">
                                                <label>شفافية التعبئة</label>
                                                <span>{Math.round(style.fillOpacity * 100)}%</span>
                                            </div>
                                            <input type="range" min="0" max="1" step="0.05" value={style.fillOpacity} onChange={(e) => updateStyle('fillOpacity', parseFloat(e.target.value))} />
                                        </div>

                                        {/* Symbol Picker for Points */}
                                        <div className="style-section">
                                            <label>شكل المعلم (الرموز)</label>
                                            <div className="symbol-grid">
                                                {pointShapes.map(shape => (
                                                    <div
                                                        key={shape.id}
                                                        className={`symbol-item ${style.shape === shape.id ? 'active' : ''}`}
                                                        onClick={() => updateStyle('shape', shape.id)}
                                                        title={shape.name}
                                                    >
                                                        {shape.icon}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Custom Image for Points */}
                                        {layer?.data?.features?.some(f => f.geometry?.type === 'Point') && (
                                            <div className="style-section" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px' }}>
                                                <label style={{ fontWeight: '600' }}>صورة مخصصة للنقاط (رابط URL)</label>
                                                <input 
                                                    type="text" 
                                                    placeholder="https://example.com/image.jpg" 
                                                    value={style.imageUrl || ''} 
                                                    onChange={(e) => updateStyle('imageUrl', e.target.value)} 
                                                    style={{
                                                        width: '100%',
                                                        background: '#1e293b',
                                                        color: 'white',
                                                        border: '1px solid rgba(255,255,255,0.1)',
                                                        padding: '8px',
                                                        borderRadius: '8px',
                                                        marginTop: '4px',
                                                        fontFamily: 'Tajawal, sans-serif',
                                                        fontSize: '0.8rem'
                                                    }}
                                                />
                                                {style.imageUrl && (
                                                    <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <div style={{ width: '30px', height: '30px', borderRadius: '50%', backgroundImage: `url(${style.imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', border: '1.5px solid white' }}></div>
                                                        <button 
                                                            className="ds-btn secondary small" 
                                                            onClick={() => updateStyle('imageUrl', '')}
                                                            style={{ padding: '2px 8px', fontSize: '0.65rem' }}
                                                        >
                                                            إزالة الصورة
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Data Classification (تصنيف المعالم حسب البيانات) */}
                                        <div className="style-section" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '12px', marginTop: '12px' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', color: 'var(--primary)', cursor: 'pointer' }}>
                                                <input 
                                                    type="checkbox" 
                                                    checked={!!style.classification?.enabled} 
                                                    onChange={(e) => {
                                                        const enabled = e.target.checked;
                                                        const keys = layer?.data?.features?.[0]?.properties ? Object.keys(layer.data.features[0].properties) : [];
                                                        const firstKey = keys.find(k => k !== 'id' && k !== 'color') || '';
                                                        
                                                        // Auto generate classes if enabling
                                                        let newColors = {};
                                                        if (enabled && firstKey) {
                                                            const uniqueVals = [...new Set(layer.data.features.map(f => f.properties?.[firstKey]).filter(v => v !== undefined && v !== null))];
                                                            uniqueVals.forEach((val, idx) => {
                                                                newColors[val] = ['#06D6F2', '#F5A623', '#10D9A0', '#8B5CF6', '#EC4899', '#3b82f6', '#10b981', '#f43f5e', '#eab308'][idx % 9];
                                                            });
                                                        }
                                                        updateStyle('classification', {
                                                            enabled,
                                                            property: firstKey,
                                                            colors: newColors
                                                        });
                                                     }}
                                                 />
                                                 تصنيف المعالم حسب حقل بيانات
                                            </label>

                                            {style.classification?.enabled && (
                                                <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                    <div>
                                                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>حقل التصنيف:</span>
                                                        <select
                                                            value={style.classification.property || ''}
                                                            onChange={(e) => {
                                                                const prop = e.target.value;
                                                                const uniqueVals = [...new Set(layer.data.features.map(f => f.properties?.[prop]).filter(v => v !== undefined && v !== null))];
                                                                const newColors = {};
                                                                uniqueVals.forEach((val, idx) => {
                                                                    newColors[val] = ['#06D6F2', '#F5A623', '#10D9A0', '#8B5CF6', '#EC4899', '#3b82f6', '#10b981', '#f43f5e', '#eab308'][idx % 9];
                                                                });
                                                                updateStyle('classification', {
                                                                    ...style.classification,
                                                                    property: prop,
                                                                    colors: newColors
                                                                });
                                                            }}
                                                            style={{
                                                                width: '100%',
                                                                background: '#1e293b',
                                                                color: 'white',
                                                                border: '1px solid rgba(255,255,255,0.1)',
                                                                padding: '6px',
                                                                borderRadius: '8px',
                                                                marginTop: '4px',
                                                                fontFamily: 'Tajawal, sans-serif',
                                                                fontSize: '0.8rem'
                                                            }}
                                                        >
                                                            {layer?.data?.features?.[0]?.properties && Object.keys(layer.data.features[0].properties)
                                                                .filter(k => k !== 'id' && k !== 'color')
                                                                .map(k => <option key={k} value={k}>{k}</option>)}
                                                        </select>
                                                    </div>

                                                    {/* Swatch color pickers */}
                                                    <div style={{ maxHeight: '130px', overflowY: 'auto', background: 'rgba(0,0,0,0.3)', padding: '8px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                        <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>الفئات والوانها:</span>
                                                        {Object.entries(style.classification.colors || {}).map(([val, col]) => (
                                                            <div key={val} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '6px' }}>
                                                                <span style={{ fontSize: '0.75rem', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', flex: 1, color: '#e2e8f0' }}>{val || '(فارغ)'}</span>
                                                                <input 
                                                                    type="color" 
                                                                    value={col} 
                                                                    onChange={(e) => {
                                                                        updateStyle('classification', {
                                                                            ...style.classification,
                                                                            colors: {
                                                                                ...style.classification.colors,
                                                                                [val]: e.target.value
                                                                            }
                                                                        });
                                                                    }}
                                                                    style={{ width: '24px', height: '24px', border: 'none', padding: '0', background: 'none', cursor: 'pointer', borderRadius: '4px' }}
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}

                                <div className="style-footer">
                                    <button className="ds-btn primary small w-100" onClick={() => setStylePopup(null)}>تطبيق التنسيق</button>
                                </div>
                            </div>
                        </div>
                    );
                })()}

                <footer className="statusbar">
                    <div className="status-item">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /></svg>
                        <span>{mapState.latitude.toFixed(4)}°N, {mapState.longitude.toFixed(4)}°E</span>
                    </div>
                    <div className="status-divider"></div>
                    <div className="status-item">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                        <span>{new Date().toLocaleTimeString()}</span>
                    </div>
                    <div className="status-divider"></div>
                    <button
                        id="hydro-sim-statusbar-btn"
                        onClick={() => setIsHydroSimOpen(true)}
                        title="محاكاة هيدرولوجية ثلاثية الأبعاد"
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                            padding: '3px 12px', height: '24px', borderRadius: '6px',
                            background: 'linear-gradient(135deg,rgba(6,155,215,0.25),rgba(0,80,160,0.2))',
                            border: '1px solid rgba(6,214,242,0.5)', color: '#06D6F2',
                            fontSize: '11px', fontWeight: 700, fontFamily: "'JetBrains Mono',monospace",
                            cursor: 'pointer', animation: 'hydroBarPulse 2.5s ease-in-out infinite alternate'
                        }}
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '13px', height: '13px' }}>
                            <path d="M12 2C6 8 4 12 4 15a8 8 0 0 0 16 0c0-3-2-7-8-13z"/>
                            <path d="M12 15c0-2 1-4 1-4s1 2 1 4a2 2 0 0 1-4 0z" fill="currentColor" opacity="0.5"/>
                        </svg>
                        HYDROSTUDIO
                    </button>
                </footer>
            </div>

            <div className={`design-studio ${isDesignStudioOpen ? 'active' : ''}`} id="designStudio" style={dynamicStyles}>
                <header className="ds-header">
                    <div className="ds-brand">
                        <div className="ds-brand-icon">
                            <svg viewBox="0 0 32 32" fill="none" stroke="none">
                                <path fill="var(--primary)" d="M18.5,28h-5c-0.276,0-0.5-0.224-0.5-0.5v-1c0-0.276,0.224-0.5,0.5-0.5h5c0.276,0,0.5,0.224,0.5,0.5v1 C19,27.776,18.776,28,18.5,28z M20,24.5v-1c0-0.276-0.224-0.5-0.5-0.5h-7c-0.276,0-0.5,0.224-0.5,0.5v1c0,0.276,0.224,0.5,0.5,0.5 h7C19.776,25,20,24.776,20,24.5z" />
                                <path fill="white" opacity="0.9" d="M12.005,18.932C9.611,17.55,8,14.963,8,12c0-4.418,3.582-8,8-8s8,3.582,8,8 c0,2.963-1.606,5.55-4,6.932V21.5c0,0.276-0.224-0.5-0.5-0.5H18v-5.134c0.163-0.392,1.415-2.609,1.415-2.609 c0.271-0.457,0.275-1.033,0.01-1.499C19.158,12.29,18.658,12,18.12,12h-4.24c-0.538,0-1.038,0.29-1.305,0.758 c-0.266,0.466-0.261,1.043,0.013,1.505L14,16.866V22h-1.5c-0.276,0-0.5-0.224-0.5-0.5L12.005,18.932z M17,22v-5.271 c0-0.323,1.552-2.977,1.552-2.977C18.749,13.419,18.507,13,18.12,13h-4.24c-0.387,0-0.629,0.419-0.431,0.753 c0,0,1.552,2.652,1.552,2.977V22H17z" />
                                <rect x="14.5" y="29.5" width="3" height="1" rx="0.5" fill="var(--primary)" opacity="0.8" />
                                <rect x="15" y="31" width="2" height="0.8" rx="0.4" fill="var(--primary)" opacity="0.6" />
                            </svg>
                        </div>
                        <div className="ds-brand-text">
                            <strong>PalNovaa WebApp Design Studio</strong>
                            <small>الإصدار 3.5 (دقة فائقة)</small>
                        </div>
                    </div>
                    <div className="ds-header-actions" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        {user?.role === 'admin' && (
                            <button className="ds-btn ghost" onClick={() => setIsMagicPromptOpen(true)} title="الإلهام الذكي (AI)">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '18px', height: '18px', color: 'var(--primary)' }}><path d="M15 12l-8.5 8.5-2.5-2.5 8.5-8.5 2.5 2.5zM17.5 9.5l-2.5-2.5 1.5-1.5 2.5 2.5-1.5 1.5zM12 2l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2zM20 14l.5 1 1 .5-1 .5-.5 1-.5-1-1-.5 1-.5.5-1z" /></svg>
                                <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>المساعد الذكي</span>
                            </button>
                        )}
                        <button className="ds-btn secondary" onClick={() => handleSaveDesign('draft')} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '18px', height: '18px' }}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>
                            حفظ كمسودة
                        </button>
                        <button className="ds-btn secondary" onClick={() => setIsPublishModalOpen(true)} style={{ background: '#10B981', color: 'white' }}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '18px', height: '18px' }}><path d="M22 2L11 13M22 2L15 22L11 13L2 9L22 2Z" /></svg>
                            نشر وتثبيت التطبيق
                        </button>
                        <button className="ds-btn primary" onClick={() => performActualExport(false)}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '18px', height: '18px' }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                            تصدير كملف HTML
                        </button>
                        <button className="ds-btn primary" onClick={() => performActualExport(true)} style={{ background: '#3B82F6', color: 'white' }}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '18px', height: '18px' }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                            تصدير كمشروع كامل (ZIP)
                        </button>
                        <button className="ds-close" onClick={() => setIsDesignStudioOpen(false)}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '20px', height: '20px' }}><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>
                </header>

                <div className="ds-body">
                    <aside className="ds-categories">
                        <div className="ds-cat-title">الأقسام الرئيسية</div>
                        {[
                            { id: 'layouts', label: 'التخطيطات', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="9" y1="3" x2="9" y2="21" /></svg>, count: 8 },
                            { id: 'applications', label: 'تطبيقات', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="2" y1="20" x2="22" y2="20" /><line x1="12" y1="17" x2="12" y2="20" /></svg>, count: 6 },
                            { id: 'palettes', label: 'لوحات الألوان', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" /></svg>, count: 8 },
                            { id: 'typography', label: 'الخطوط', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 7 4 4 20 4 20 7" /><line x1="9" y1="20" x2="15" y2="20" /><line x1="12" y1="4" x2="12" y2="20" /></svg>, count: 6 },
                            { id: 'basemaps', label: 'الخرائط', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" /></svg>, count: 6 },
                            { id: 'effects', label: 'التأثيرات', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>, count: 9 },
                            { id: 'builder', label: 'منشئ الصفحة', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18M3 9h6M3 15h6M15 9h6M15 15h6" /></svg>, count: pageElements.length || '+' },
                            { id: 'settings', label: 'الإعدادات', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1V15a2 2 0 0 1-2-2 2 2 0 0 1 2-2v-.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2v.09a1.65 1.65 0 0 0-1.51 1z" /></svg>, count: 8 }
                        ].map(cat => (
                            <div key={cat.id} className={`ds-cat ${activeDsCategory === cat.id ? 'active' : ''}`} onClick={() => setActiveDsCategory(cat.id)}>
                                {cat.icon}
                                <span>{cat.label}</span>
                                <span className="ds-cat-num">{cat.count}</span>
                            </div>
                        ))}
                    </aside>

                    <main className="ds-main" dir="rtl" style={{ fontFamily: 'var(--font-main)' }}>
                        {activeDsCategory === 'applications' && (
                            <div className="ds-section active">
                                <div className="ds-section-head">
                                    <h2>التطبيقات التفاعلية الجاهزة <span className="ds-tag">APPLICATIONS</span></h2>
                                    <p>اختر تطبيقاً جغرافياً جاهزاً للتشغيل المباشر وعرض وتحليل البيانات</p>
                                </div>
                                <div className="ds-grid">
                                    {[
                                        { id: 'none', title: 'بدون تطبيق (خريطة عامة)', sub: 'تصميم خريطة عامة تفاعلية تقليدية لعرض البيانات فقط', icon: '🗺️' },
                                        { id: 'covid19', title: 'خريطة انتشار كوفيد-19 (COVID-19 Map)', sub: 'تطبيق ويب متكامل لعرض حالات وإحصائيات كورونا حول العالم ومحلياً على الخريطة', icon: '🦠' },
                                        { id: 'uber', title: 'منصة توصيل الركاب (Uber Web Clone)', sub: 'نسخة ويب تفاعلية لطلب وتوصيل الركاب وتحديد المسارات وحساب أسعار الرحلات', icon: '🚗' },
                                        { id: 'guacamaya', title: 'إدارة وحجوزات الطيران (Guacamaya Airlines)', sub: 'نظام متكامل لإدارة الخطوط الجوية والرحلات وحجز المقاعد وعرض الإحصائيات التفاعلية', icon: '✈️' },
                                        { id: 'mapty', title: 'مقتفي الرياضة بالضفة (Mapty Palestine)', sub: 'تطبيق رياضي تفاعلي لتسجيل أنشطة الجري وركوب الدراجات وتحديد المواقع في مدن الضفة الغربية', icon: '🏃‍♂️' },
                                        { id: 'tourism', title: 'دليل ومنصة حجز السياحة في فلسطين (Palestine Tourism)', sub: 'منصة متكاملة للبحث وحجز الفنادق وأماكن الإقامة والوجبات التراثية مع خريطة تفاعلية لمدن فلسطين وعرض الأسعار بالشيكل', icon: '🏨' }
                                    ].map(t => (
                                        <div key={t.id} className={`ds-pick ${designSelections.commercialTemplate === t.id ? 'selected' : (t.id === 'none' && !designSelections.commercialTemplate ? 'selected' : '')}`} onClick={() => setDesignSelections(s => ({ ...s, commercialTemplate: t.id }))}>
                                            <div style={{ fontSize: '2rem', marginBottom: '10px', display: 'flex', justifyContent: 'center' }}>{t.icon}</div>
                                            <div className="ds-pick-title">{t.title}</div>
                                            <div className="ds-pick-sub" style={{ fontSize: '0.78rem', opacity: '0.7', marginTop: '6px', lineHeight: '1.4' }}>{t.sub}</div>
                                        </div>
                                    ))}
                                </div>
                                {designSelections.commercialTemplate === 'uber' && (
                                    <div className="ds-sub-config" style={{ marginTop: '20px', padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                                        <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: 'var(--primary)' }}>إعدادات تطبيق التوصيل (أوبر ويب) قبل النشر</h4>
                                        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                                            <div style={{ flex: 1, minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                <label style={{ fontSize: '0.8rem', opacity: 0.8 }}>اسم الخدمة / التطبيق:</label>
                                                <input type="text" value={designSelections.uberAppName || 'سفريات بال نوفا'} onChange={e => setDesignSelections(s => ({ ...s, uberAppName: e.target.value }))} style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', outline: 'none' }} />
                                            </div>
                                            <div style={{ flex: 1, minWidth: '150px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                <label style={{ fontSize: '0.8rem', opacity: 0.8 }}>سعر الكيلومتر (شيكل):</label>
                                                <input type="number" value={designSelections.uberRatePerKm || 5.0} onChange={e => setDesignSelections(s => ({ ...s, uberRatePerKm: parseFloat(e.target.value) || 0 }))} min="0.5" step="0.5" style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', outline: 'none' }} />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        {activeDsCategory === 'layouts' && (
                            <div className="ds-section active">
                                <div className="ds-section-head">
                                    <h2>تخطيطات الصفحة <span className="ds-tag">LAYOUTS</span></h2>
                                    <p>اختر هيكل الصفحة الأنسب لعرض الخريطة في موقعك</p>
                                </div>
                                <div className="ds-grid">
                                    {[
                                        { id: 'fullmap', title: 'الخريطة الغامرة (Immersive)', sub: 'عرض ملء الشاشة يركز على التجربة البصرية للبيانات الجغرافية', type: 'lm-fullmap' },
                                        { id: 'sidebar', title: 'التحليل المزدوج (Dual-Pane)', sub: 'لوحة جانبية تفاعلية للتحكم العميق بطبقات الخريطة والمعلومات', type: 'lm-sidebar' },
                                        { id: 'three', title: 'تخطيط الأجزاء الثلاثة (Triple)', sub: 'نظام متكامل يجمع بين الأدوات، الخريطة، ومعلومات التفاصيل في آن واحد', type: 'lm-three' },
                                        { id: 'dashboard', title: 'لوحة القيادة الجيومكانية', sub: 'واجهة احترافية تجمع الخريطة مع الإحصائيات والمؤشرات الحية بدقة عالية', type: 'lm-dashboard' },
                                        { id: 'split', title: 'التقسيم المتوازن (50/50)', sub: 'مقارنة دقيقة وسهلة بين الخريطة والمحتوى النصي جنباً إلى جنب', type: 'lm-split' },
                                        { id: 'stacked', title: 'الاستعراض العمودي (Vertical)', sub: 'خريطة في الأعلى متبوعة بقائمة بيانات مفصلة وسهلة التصفح في الأسفل', type: 'lm-stacked' },
                                        { id: 'floating', title: 'الواجهة العائمة (Minimal)', sub: 'خرائط نظيفة مع أدوات تحكم عائمة ذكية توفر مساحة عرض قصوى', type: 'lm-floating' },
                                        { id: 'modal', title: 'الخريطة المنبثقة (Modal)', sub: 'حل سريع واحترافي لعرض المواقع الجغرافية داخل سياق الصفحة الحالية', type: 'lm-modal' },
                                        { id: 'custom', title: 'تصميم مخصص (Free Design)', sub: 'ابدأ من الصفر وارسم تخطيطك الخاص بحرية كاملة باستخدام أدوات المنشئ الذكي', type: 'lm-custom' }
                                    ].map(l => (
                                        <div key={l.id} className={`ds-pick ${designSelections.layout === l.id ? 'selected' : ''}`} onClick={() => setDesignSelections(s => ({ ...s, layout: l.id }))}>
                                            <div className={`layout-mockup lm-${l.id}`}>
                                                {l.id === 'modal' ? (
                                                    <div className="lm-modal-frame">
                                                        <div className="lm-modal-bar"></div>
                                                        <div className="lm-map">
                                                            <div className="lm-pin" style={{ top: '40%', left: '50%' }}></div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="lm-map">
                                                            <div className="lm-pin" style={{ top: '30%', left: '40%' }}></div>
                                                            <div className="lm-pin cy" style={{ top: '60%', left: '70%' }}></div>
                                                            <div className="lm-pin lg" style={{ top: '45%', left: '55%' }}></div>
                                                        </div>

                                                        {l.id === 'fullmap' && (
                                                            <>
                                                                <div className="lm-search"></div>
                                                                <div className="lm-panel">
                                                                    <div className="lm-row accent thick"></div>
                                                                    <div className="lm-row short"></div>
                                                                    <div className="lm-row tiny"></div>
                                                                </div>
                                                            </>
                                                        )}

                                                        {l.id === 'sidebar' && (
                                                            <div className="lm-panel lm-sidebar">
                                                                <div className="lm-header" style={{ position: 'relative', height: '15px', marginBottom: '8px' }}></div>
                                                                {[1, 2, 3].map(i => (
                                                                    <div key={i} className="lm-item">
                                                                        <div className="lm-thumb"></div>
                                                                        <div className="lm-item-content">
                                                                            <div className="lm-row tiny"></div>
                                                                            <div className="lm-row short" style={{ opacity: 0.5 }}></div>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}

                                                        {l.id === 'three' && (
                                                            <>
                                                                <div className="lm-header"></div>
                                                                <div className="lm-tools">
                                                                    <div className="lm-tool active"></div>
                                                                    <div className="lm-tool"></div>
                                                                    <div className="lm-tool"></div>
                                                                </div>
                                                                <div className="lm-panel lm-details">
                                                                    <div className="lm-row thick accent"></div>
                                                                    <div className="lm-row short"></div>
                                                                </div>
                                                            </>
                                                        )}

                                                        {l.id === 'dashboard' && (
                                                            <>
                                                                <div className="lm-header">
                                                                    <div className="lm-spacer"></div>
                                                                    <div className="lm-dot-row"><i></i></div>
                                                                </div>
                                                                <div className="lm-stats">
                                                                    {[1, 2, 3].map(i => (
                                                                        <div key={i} className="lm-stat">
                                                                            <div className="lm-row tiny" style={{ opacity: 0.5 }}></div>
                                                                            <div className="lm-stat-num"></div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </>
                                                        )}

                                                        {l.id === 'split' && (
                                                            <div className="lm-panel">
                                                                <div className="lm-row thick accent" style={{ width: '80%', marginBottom: '10px' }}></div>
                                                                <div className="lm-grid-2">
                                                                    <div className="lm-card-ph"></div>
                                                                    <div className="lm-card-ph"></div>
                                                                    <div className="lm-card-ph"></div>
                                                                    <div className="lm-card-ph"></div>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {l.id === 'stacked' && (
                                                            <div className="lm-panel" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                                <div className="lm-row tiny accent"></div>
                                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                                    {[1, 2, 3].map(i => <div key={i} style={{ flex: 1, height: '20px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }}></div>)}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {l.id === 'floating' && (
                                                            <>
                                                                <div className="lm-panel lm-fc1">
                                                                    <div className="lm-row tiny accent"></div>
                                                                    <div className="lm-row short"></div>
                                                                </div>
                                                                <div className="lm-panel lm-fc2">
                                                                    <div className="lm-row thick accent"></div>
                                                                    <div className="lm-row"></div>
                                                                </div>
                                                            </>
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
                                        { id: 'heritage', title: 'التراث', sub: 'ألوان فلسطينية تراثية', colors: ['#CE1126', '#000000', '#FFFFFF', '#007A3D', '#F5A623'] },
                                        { id: 'ocean', title: 'أعماق المحيط', sub: 'بحر هادئ ومحيط لانهائي', colors: ['#06D6F2', '#1A2980', '#0A1628', '#26D0CE', '#F0F8FF'] },
                                        { id: 'sunset', title: 'الغروب', sub: 'غروب الصحراء الدافئ', colors: ['#FF6B6B', '#F5A623', '#8B5CF6', '#FCD34D', '#1A0E1F'] },
                                        { id: 'forest', title: 'الغابة', sub: 'طبيعة خضراء منعشة', colors: ['#10D9A0', '#059669', '#064E3B', '#A7F3D0', '#F5F4ED'] },
                                        { id: 'earth', title: 'ألوان ترابية', sub: 'ألوان ترابية كلاسيكية', colors: ['#D4C49B', '#A0826D', '#5C4033', '#F5F4ED', '#2C1810'] },
                                        { id: 'neon', title: 'نيون مستقبلي', sub: 'مستقبلي وعصري', colors: ['#06D6F2', '#8B5CF6', '#EC4899', '#050B16', '#F5A623'] },
                                        { id: 'minimal', title: 'بسيط', sub: 'بساطة وأناقة', colors: ['#FFFFFF', '#F5F4ED', '#E5E5E5', '#1A1A2E', '#F5A623'] },
                                        { id: 'shadcn_zinc', title: 'Shadcn Zinc', sub: 'رمادي داكن كلاسيكي ونظيف', colors: ['#71717a', '#09090b', '#18181b', '#27272a', '#fafafa'] },
                                        { id: 'shadcn_slate', title: 'Shadcn Slate', sub: 'لوحة سليت احترافية وذكية', colors: ['#64748b', '#020617', '#0f172a', '#1e293b', '#f8fafc'] },
                                        { id: 'shadcn_emerald', title: 'Shadcn Emerald', sub: 'زمردي حيوي وهادئ', colors: ['#10b981', '#022c22', '#064e3b', '#065f46', '#f0fdf4'] },
                                        { id: 'shadcn_violet', title: 'Shadcn Violet', sub: 'بنفسجي داكن فاخر وعصري', colors: ['#8b5cf6', '#0c0a0f', '#1e1b4b', '#312e81', '#faf5ff'] },
                                        { id: 'shadcn_rose', title: 'Shadcn Rose', sub: 'وردي ورد جوري دافئ', colors: ['#f43f5e', '#1c0d12', '#4c0519', '#881337', '#fff1f2'] },
                                        { id: 'shadcn_amber', title: 'Shadcn Amber', sub: 'أمبر دافئ برتقالي ذهبي', colors: ['#f59e0b', '#271404', '#451a03', '#78350f', '#fffbeb'] }
                                    ].map(p => (
                                        <div key={p.id} className={`ds-pick ${designSelections.palette === p.id ? 'selected' : ''}`} onClick={() => setDesignSelections(s => ({ ...s, palette: p.id }))}>
                                            <div className="palette-strip">
                                                {p.colors.map((c, i) => (
                                                    <span
                                                        key={i}
                                                        style={{ background: c, cursor: 'pointer' }}
                                                        title={c}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setDesignSelections(s => ({ ...s, palette: 'custom', customPrimary: c }));
                                                        }}
                                                        className="palette-color-segment"
                                                    ></span>
                                                ))}
                                            </div>
                                            <div className="ds-pick-title">{p.title}</div>
                                            <div className="ds-pick-sub">{p.sub}</div>
                                        </div>
                                    ))}

                                    {/* Custom Color Pick */}
                                    <div className={`ds-pick ${designSelections.palette === 'custom' ? 'selected' : ''}`} style={{ borderStyle: 'dashed' }}>
                                        <div className="palette-strip" style={{ position: 'relative' }}>
                                            <input
                                                type="color"
                                                value={designSelections.customPrimary}
                                                onChange={e => setDesignSelections(s => ({ ...s, palette: 'custom', customPrimary: e.target.value }))}
                                                style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
                                            />
                                            <span style={{ flex: 1, background: designSelections.customPrimary }}></span>
                                            <span style={{ flex: 1, background: '#0A1628' }}></span>
                                            <span style={{ flex: 1, background: '#142B47' }}></span>
                                        </div>
                                        <div className="ds-pick-title" style={{ color: 'var(--primary)' }}>لون مخصص</div>
                                        <div className="ds-pick-sub">اختر لونك الخاص</div>
                                    </div>
                                </div>

                                {designSelections.palette === 'custom' && (
                                    <div className="custom-colors-panel" style={{ marginTop: '20px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px', padding: '15px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                            <label style={{ fontSize: '0.8rem', opacity: 0.8 }}>اللون الرئيسي</label>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <input type="color" value={designSelections.customPrimary} onChange={e => setDesignSelections(s => ({ ...s, customPrimary: e.target.value }))} style={{ width: '35px', height: '35px', border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'transparent' }} />
                                                <span style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>{designSelections.customPrimary}</span>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                            <label style={{ fontSize: '0.8rem', opacity: 0.8 }}>لون الخلفية</label>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <input type="color" value={designSelections.customBg} onChange={e => setDesignSelections(s => ({ ...s, customBg: e.target.value }))} style={{ width: '35px', height: '35px', border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'transparent' }} />
                                                <span style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>{designSelections.customBg}</span>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                            <label style={{ fontSize: '0.8rem', opacity: 0.8 }}>لون الألواح والبطاقات</label>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <input type="color" value={designSelections.customSurface} onChange={e => setDesignSelections(s => ({ ...s, customSurface: e.target.value }))} style={{ width: '35px', height: '35px', border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'transparent' }} />
                                                <span style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>{designSelections.customSurface}</span>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                            <label style={{ fontSize: '0.8rem', opacity: 0.8 }}>لون النصوص</label>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <input type="color" value={designSelections.customText} onChange={e => setDesignSelections(s => ({ ...s, customText: e.target.value }))} style={{ width: '35px', height: '35px', border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'transparent' }} />
                                                <span style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>{designSelections.customText}</span>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                            <label style={{ fontSize: '0.8rem', opacity: 0.8 }}>لون الحدود والخطوط الفاصلة</label>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <input type="color" value={designSelections.customBorder} onChange={e => setDesignSelections(s => ({ ...s, customBorder: e.target.value }))} style={{ width: '35px', height: '35px', border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'transparent' }} />
                                                <span style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>{designSelections.customBorder}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
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
                                        { id: 'cairo_tajawal', title: 'Cairo + Tajawal', sub: 'عربي حديث · موصى به', fontH: "'Cairo', sans-serif", fontB: "'Tajawal', sans-serif", previewH: 'Cairo Bold', previewB: 'Tajawal Light Text', wH: 900, wB: 300 },
                                        { id: 'tajawal_inter', title: 'Tajawal + Inter', sub: 'مختلط · أنيق', fontH: "'Tajawal', sans-serif", fontB: "'Inter', sans-serif", previewH: 'Tajawal Black', previewB: 'Inter Modern Regular', wH: 900, wB: 400 },
                                        { id: 'cairo_mono', title: 'Cairo + JetBrains Mono', sub: 'تقني · للمطورين', fontH: "'Cairo', sans-serif", fontB: "'JetBrains Mono', monospace", previewH: 'Cairo Extra Bold', previewB: 'JetBrains Mono Technical', wH: 800, wB: 500 },
                                        { id: 'tajawal_ed', title: 'Tajawal Editorial', sub: 'تحريري · رسمي', fontH: "'Tajawal', sans-serif", fontB: "'Tajawal', sans-serif", previewH: 'Tajawal Bold', previewB: 'Tajawal Regular Editorial', wH: 700, wB: 400 },
                                        { id: 'display', title: 'Display Big', sub: 'عرض · بصري', fontH: "'Cairo', sans-serif", fontB: "'Tajawal', sans-serif", previewH: 'Display Cairo 1000', previewB: 'Tajawal Medium UI', wH: 1000, wB: 500, cls: 'preview-display' },
{ id: 'compact', title: 'Compact UI', sub: 'مدمج · واجهات', fontH: "'Cairo', sans-serif", fontB: "'Tajawal', sans-serif", previewH: 'Compact Cairo', previewB: 'Tajawal Extra Light', wH: 700, wB: 200, cls: 'preview-compact' }
                                    ].map(f => (
                                        <div key={f.id} className={`ds-pick ${designSelections.font === f.id ? 'selected' : ''}`} onClick={() => setDesignSelections(s => ({ ...s, font: f.id }))}>
                                            <div className={`type-preview ${f.cls || ''}`}>
                                                <div className="t-title" style={{ fontFamily: f.fontH, fontWeight: f.wH, fontSize: f.id === 'display' ? '1.4rem' : '1.1rem' }}>{f.previewH}</div>
                                                <div className="t-body" style={{ fontFamily: f.fontB, fontWeight: f.wB, fontSize: f.id === 'compact' ? '0.65rem' : '0.8rem' }}>{f.previewB}</div>
                                            </div>
                                            <div className="ds-pick-title">{f.title}</div>
                                            <div className="type-pair-name">{f.sub}</div>
                                        </div>
                                    ))}

                                    {/* Custom Font Pick */}
                                    <div className={`ds-pick ${designSelections.font === 'custom' ? 'selected' : ''}`} onClick={() => setDesignSelections(s => ({ ...s, font: 'custom' }))} style={{ borderStyle: 'dashed' }}>
                                        <div className="type-preview" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '5px', padding: '10px' }}>
                                            <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>Aa</span>
                                            <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>خط مخصص</span>
                                        </div>
                                        <div className="ds-pick-title">خط مخصص</div>
                                        <div className="type-pair-name">أدخل خطوطك الخاصة</div>
                                    </div>
                                </div>

                                {designSelections.font === 'custom' && (
                                    <div className="custom-fonts-panel" style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '15px', padding: '15px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                            <label style={{ fontSize: '0.8rem', opacity: 0.8 }}>خط العناوين الرئيسية (Heading Font)</label>
                                            <input type="text" value={designSelections.customFontHeading} onChange={e => setDesignSelections(s => ({ ...s, customFontHeading: e.target.value }))} placeholder="مثال: Cairo أو Tajawal" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '8px 12px', color: 'white', outline: 'none', fontSize: '0.85rem' }} />
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                            <label style={{ fontSize: '0.8rem', opacity: 0.8 }}>خط النصوص العامة (Body Font)</label>
                                            <input type="text" value={designSelections.customFontBody} onChange={e => setDesignSelections(s => ({ ...s, customFontBody: e.target.value }))} placeholder="مثال: Tajawal أو sans-serif" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '8px 12px', color: 'white', outline: 'none', fontSize: '0.85rem' }} />
                                        </div>
                                    </div>
                                )}


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
                                        { id: 'dark', title: 'النمط الداكن', sub: 'داكن أنيق · للتطبيقات الحديثة', type: 'bm-dark', provider: 'MAPTILER' },
                                        { id: 'light', title: 'النمط الفاتح', sub: 'فاتح ونظيف · للقراءة الواضحة', type: 'bm-light', provider: 'MAPTILER' },
                                        { id: 'satellite', title: 'قمر صناعي (هجين)', sub: 'صور أقمار صناعية مع أسماء الطرق', type: 'bm-satellite', provider: 'GOOGLE' },
                                        { id: 'satellite_pure', title: 'قمر صناعي (سادة)', sub: 'صور أقمار صناعية سادة بدون أسماء', type: 'bm-satellite', provider: 'GOOGLE' },
                                        { id: 'terrain', title: 'تضاريس', sub: 'تضاريس وارتفاعات', type: 'bm-terrain', provider: 'MAPTILER' },
                                        { id: 'vintage', title: 'خريطة عتيقة', sub: 'خريطة تاريخية كلاسيكية', type: 'bm-vintage', provider: 'MAPTILER' },
                                        { id: 'cyber', title: 'خريطة رقمية', sub: 'سايبر بانك مستقبلي', type: 'bm-cyber', provider: 'MAPTILER' }
                                    ].map(b => (
                                        <div key={b.id} className={`ds-pick ${designSelections.basemap === b.id ? 'selected' : ''}`} onClick={() => setDesignSelections(s => ({ ...s, basemap: b.id }))}>
                                            <div className={`basemap-preview ${b.type}`} style={{ display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,0.5)', position: 'relative', overflow: 'hidden' }}>
                                                <span style={{ fontSize: '0.65rem', fontWeight: 900, letterSpacing: '1px', color: 'var(--primary)', textTransform: 'uppercase', opacity: 0.9, zIndex: 2 }}>{b.provider}</span>
                                                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(45deg, rgba(6,214,242,0.1), transparent)', zIndex: 1 }}></div>
                                            </div>
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
                                        { id: 'pin', title: 'دبوس كلاسيكي', sub: 'دبوس تقليدي', cls: 'mk-pin' },
                                        { id: 'dot', title: 'نقطة متوهجة', sub: 'نقطة متوهجة', cls: 'mk-dot' },
                                        { id: 'pulse', title: 'علامة نابضة', sub: 'نبض حي مع موجة', cls: 'mk-pulse' },
                                        { id: 'cluster', title: 'تجميع', sub: 'تجميع نقاط مع عدد', cls: 'mk-cluster' },
                                        { id: 'numbered', title: 'مرقمة', sub: 'رقم داخل دائرة', cls: 'mk-num' },
                                        { id: 'square', title: 'معين', sub: 'مربع مائل عصري', cls: 'mk-square' }
                                    ].map(m => (
                                        <div key={m.id} className={`ds-pick ${designSelections.marker === m.id ? 'selected' : ''}`} onClick={() => setDesignSelections(s => ({ ...s, marker: m.id }))}>
                                            <div className="marker-preview">
                                                <div className={m.cls}>{m.id === 'cluster' ? '12' : m.id === 'numbered' ? '5' : ''}</div>
                                            </div>
                                            <div className="ds-pick-title">{m.title}</div>
                                            <div className="ds-pick-sub">{m.sub}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}


                        {activeDsCategory === 'settings' && (
                            <div className="ds-section active">
                                <div className="ds-section-head">
                                    <h2>إعدادات النظام <span className="ds-tag">SETTINGS</span></h2>
                                    <p>تحكم في خصائص الخريطة وتفاعل المستخدم</p>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    {[
                                        { id: 'show_controls', label: 'إظهار أدوات التحكم بالتكبير والتوجيه (Navigation Controls)', icon: '🧭' },
                                        { id: 'show_attribution', label: 'إظهار حقوق الملكية والترخيص (Attribution)', icon: 'ℹ️' },
                                        { id: 'enable_popups', label: 'تفعيل النوافذ المنبثقة للتفاصيل الوصفية (Interactive Popups)', icon: '💬' },
                                        { id: 'auto_rotate', label: 'الدوران السينمائي التلقائي الخامل (Cinematic Auto-Rotate)', icon: '🔄' },
                                        { id: 'enable_search', label: 'شريط البحث الذكي عن المعالم الجغرافية (Search Bar)', icon: '🔍' },
                                        { id: 'show_legend', label: 'مفتاح الخريطة التفاعلي الديناميكي (Map Legend)', icon: '📊' },
                                        { id: 'show_layer_toggle', label: 'لوحة التحكم بالطبقات وتفعيلها (Layer Control)', icon: '⊞' },
                                        { id: 'enable_scale', label: 'مقياس الرسم الجغرافي للخرائط (Scale Rule)', icon: '📏' }
                                    ].map(s => (
                                        <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px', background: 'var(--bg-soft)', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <span>{s.icon}</span>
                                                <span style={{ fontSize: '0.9rem' }}>{s.label}</span>
                                            </div>
                                            <div
                                                onClick={() => setDesignSelections(prev => ({ ...prev, [s.id]: !prev[s.id] }))}
                                                style={{
                                                    width: '45px', height: '24px', background: designSelections[s.id] ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
                                                    borderRadius: '20px', position: 'relative', cursor: 'pointer', transition: '0.3s'
                                                }}
                                            >
                                                <div style={{
                                                    width: '18px', height: '18px', background: 'white', borderRadius: '50%',
                                                    position: 'absolute', top: '3px', left: designSelections[s.id] ? '24px' : '3px', transition: '0.3s'
                                                }}></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div style={{ marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '20px' }}>
                                    <h3 style={{ fontSize: '0.95rem', color: 'var(--primary)', marginBottom: '15px' }}>تخصيص حدود الخريطة</h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                            <label style={{ fontSize: '0.8rem', opacity: 0.8 }}>زاوية انحناء الخريطة (Border Radius): {designSelections.mapBorderRadius}</label>
                                            <input type="range" min="0" max="40" value={parseInt(designSelections.mapBorderRadius || '0')} onChange={e => setDesignSelections(s => ({ ...s, mapBorderRadius: e.target.value + 'px' }))} style={{ width: '100%', accentColor: 'var(--primary)' }} />
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                            <label style={{ fontSize: '0.8rem', opacity: 0.8 }}>سمك حد الخريطة (Border Width): {designSelections.mapBorderWidth}</label>
                                            <input type="range" min="0" max="10" value={parseInt(designSelections.mapBorderWidth || '0')} onChange={e => setDesignSelections(s => ({ ...s, mapBorderWidth: e.target.value + 'px' }))} style={{ width: '100%', accentColor: 'var(--primary)' }} />
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                            <label style={{ fontSize: '0.8rem', opacity: 0.8 }}>لون حد الخريطة (Border Color)</label>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <input type="color" value={designSelections.mapBorderColor || '#ffffff'} onChange={e => setDesignSelections(s => ({ ...s, mapBorderColor: e.target.value }))} style={{ width: '35px', height: '35px', border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'transparent' }} />
                                                <span style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>{designSelections.mapBorderColor}</span>
                                            </div>
                                        </div>
                                    </div>
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
                                        { id: 'md', title: 'ظل متوسط', sub: 'ظل متوسط متوازن', cls: 'ef-shadow-md' },
                                        { id: 'lg', title: 'ظل كبير', sub: 'ظل عميق دراماتيكي', cls: 'ef-shadow-lg' },
                                        { id: 'glow', title: 'تأثير التوهج', sub: 'توهج برتقالي قوي', cls: 'ef-glow' },
                                        { id: 'glass', title: 'النمط الزجاجي', sub: 'زجاج ضبابي عصري', cls: 'ef-glass' },
                                        { id: 'sunset', title: 'تدرج الغروب', sub: 'تدرج غروب الشمس', cls: 'ef-grad-sunset' },
                                        { id: 'ocean', title: 'تدرج المحيط', sub: 'تدرج المحيط العميق', cls: 'ef-grad-ocean' },
                                        { id: 'forest', title: 'تدرج الغابة', sub: 'تدرج أخضر منعش', cls: 'ef-grad-forest' },
                                        { id: 'float', title: 'حركة الطفو', sub: 'حركة طفو ناعمة', cls: 'ef-anim-float' },
                                        { id: 'pulse', title: 'حركة النبض', sub: 'نبضة دائرية', cls: 'ef-anim-pulse' }
                                    ].map(e => (
                                        <div key={e.id} className={`ds-pick ${designSelections.effect === e.id ? 'selected' : ''}`} onClick={() => setDesignSelections(s => ({ ...s, effect: e.id }))}>
                                            <div className={`effect-preview ${e.cls}`}><div className="effect-box"></div></div>
                                            <div className="ds-pick-title">{e.title}</div>
                                            <div className="ds-pick-sub">{e.sub}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeDsCategory === 'builder' && (
                            <div className="ds-section active" style={{ padding: 0, height: '100%', position: 'relative' }}>
                                <div style={{ display: 'flex', height: '100%', gap: 0 }}>
                                    {/* Element Palette */}
                                    <div className="ds-builder-sidebar" style={{ width: '220px', background: '#0A1628', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
                                        <div className="builder-tabs" style={{ display: 'flex', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border)' }}>
                                            {[
                                                { id: 'basic', label: 'أساسي' },
                                                { id: 'comps', label: 'مكونات' },
                                                { id: 'icons', label: 'أيقونات' }
                                            ].map(t => (
                                                <div
                                                    key={t.id}
                                                    onClick={() => setBuilderTab(t.id)}
                                                    style={{ flex: 1, padding: '12px 5px', fontSize: '10px', fontWeight: '800', textAlign: 'center', cursor: 'pointer', borderBottom: builderTab === t.id ? '2px solid var(--primary)' : '2px solid transparent', color: builderTab === t.id ? 'var(--primary)' : 'var(--text-muted)', transition: 'all 0.2s' }}
                                                >
                                                    {t.label}
                                                </div>
                                            ))}
                                        </div>

                                        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 12px' }}>
                                            {builderTab === 'basic' && (
                                                <div className="builder-cat-section">
                                                    {[
                                                        { type: 'heading', label: 'عنوان رئيسي', preview: 'H₁' },
                                                        { type: 'subheading', label: 'عنوان فرعي', preview: 'H₂' },
                                                        { type: 'paragraph', label: 'كتلة نصية', preview: '¶' },
                                                        { type: 'divider', label: 'خط فاصل', preview: '—' },
                                                        { type: 'badge', label: 'شارة (Badge)', preview: '•' }
                                                    ].map(el => (
                                                        <div key={el.type} draggable onDragStart={e => { e.dataTransfer.setData('elType', el.type); e.dataTransfer.setData('elLabel', el.label); }} className="builder-el-card">
                                                            <div className="el-preview-box">{el.preview}</div>
                                                            <div className="el-label-text">{el.label}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {builderTab === 'comps' && (
                                                <div className="builder-cat-section">
                                                    {[
                                                        { type: 'btn_primary', label: 'زر رئيسي', preview: 'BTN' },
                                                        { type: 'btn_outline', label: 'زر محدد', preview: 'BTN' },
                                                        { type: 'search', label: 'حقل بحث', preview: '🔍' },
                                                        { type: 'stat', label: 'بطاقة رقمية', preview: '42' },
                                                        { type: 'card', label: 'بطاقة معلومات', preview: '▭' },
                                                        { type: 'layers', label: 'متحكم طبقات', preview: '⊞' },
                                                        { type: 'shadcn_accordion', label: 'أكورديون Shadcn', preview: 'accordion' },
                                                        { type: 'shadcn_alert', label: 'تنبيه Shadcn', preview: 'alert' },
                                                        { type: 'shadcn_avatar', label: 'صورة رمزية Shadcn', preview: 'avatar' },
                                                        { type: 'shadcn_slider', label: 'منزلق Shadcn', preview: 'slider' },
                                                        { type: 'shadcn_switch', label: 'مفتاح Shadcn', preview: 'switch' },
                                                        { type: 'shadcn_progress', label: 'تقدم Shadcn', preview: 'progress' },
                                                        { type: 'shadcn_tabs', label: 'تبويبات Shadcn', preview: 'tabs' }
                                                    ].map(el => (
                                                        <div key={el.type} draggable onDragStart={e => { e.dataTransfer.setData('elType', el.type); e.dataTransfer.setData('elLabel', el.label); }} className="builder-el-card">
                                                            <div className="el-preview-box" style={{ fontSize: '1rem' }}>{el.preview}</div>
                                                            <div className="el-label-text">{el.label}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {builderTab === 'icons' && (
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                                                    {[
                                                        { type: 'icon', label: 'موقع', icon: <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /> },
                                                        { type: 'icon', label: 'بوصلة', icon: <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" /> },
                                                        { type: 'icon', label: 'خريطة', icon: <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" /> },
                                                        { type: 'icon', label: 'بحث', icon: <circle cx="11" cy="11" r="8" /> },
                                                        { type: 'icon', label: 'نجمة', icon: <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /> },
                                                        { type: 'icon', label: 'بيت', icon: <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /> },
                                                        { type: 'icon', label: 'مستخدم', icon: <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /> },
                                                        { type: 'icon', label: 'قائمة', icon: <path d="M3 6h18M3 12h18M3 18h18" /> }
                                                    ].map((el, i) => (
                                                        <div
                                                            key={i}
                                                            draggable
                                                            onDragStart={e => {
                                                                e.dataTransfer.setData('elType', 'icon');
                                                                e.dataTransfer.setData('elLabel', el.label);
                                                                // Pass the icon path as a string
                                                                const svgStr = React.isValidElement(el.icon) ? el.icon.props.d || el.icon.props.points : '';
                                                                e.dataTransfer.setData('elIcon', svgStr);
                                                            }}
                                                            className="builder-el-card"
                                                            style={{ padding: '8px' }}
                                                        >
                                                            <div style={{ color: 'var(--primary)', marginBottom: '4px' }}>
                                                                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">{el.icon}</svg>
                                                            </div>
                                                            <div className="el-label-text" style={{ fontSize: '0.6rem' }}>{el.label}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <div className="builder-helper-section" style={{ marginTop: '30px', borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
                                            <button className="ds-btn outline small w-100" onClick={() => {
                                                const templates = [
                                                    { id: 1, type: 'search', x: 25, y: 5, w: 50 },
                                                    { id: 2, type: 'sidebar', x: 75, y: 0, w: 25, h: 100 },
                                                    { id: 3, type: 'stat', x: 5, y: 80, w: 20 }
                                                ];
                                                setPageElements(templates);
                                            }}>
                                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
                                                مساعد التوزيع
                                            </button>
                                        </div>
                                    </div>

                                    {/* Canvas Workspace */}
                                    <div className="ds-builder-canvas-area" style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
                                        <div className="canvas-header" style={{ padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span className="pulse-dot"></span>
                                                <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>مساحة التصميم الحر</span>
                                            </div>
                                            <button onClick={() => setPageElements([])} className="ds-btn ghost danger small">مسح المسودة</button>
                                        </div>

                                        <div
                                            className="builder-canvas-grid"
                                            onDragOver={e => e.preventDefault()}
                                            onDrop={e => {
                                                e.preventDefault();
                                                const rect = e.currentTarget.getBoundingClientRect();
                                                const x = Math.max(0, Math.min(85, ((e.clientX - rect.left) / rect.width) * 100));
                                                const y = Math.max(0, Math.min(85, ((e.clientY - rect.top) / rect.height) * 100));
                                                const type = e.dataTransfer.getData('elType');
                                                const label = e.dataTransfer.getData('elLabel');
                                                const icon = e.dataTransfer.getData('elIcon');
                                                const newEl = { id: Date.now(), type, text: label, icon, x, y, w: type === 'icon' ? 10 : 25, fontSize: 1, color: designSelections.customPrimary };
                                                setPageElements(prev => [...prev, newEl]);
                                                setSelectedElId(newEl.id);
                                            }}
                                            onClick={() => setSelectedElId(null)}
                                        >
                                            {/* Realistic Map Background Simulation */}
                                            <div className="canvas-map-bg">
                                                <div className="grid-overlay"></div>
                                                <div className="map-markers-hint">
                                                    <div className="hint-pin" style={{ top: '20%', left: '30%' }}></div>
                                                    <div className="hint-pin" style={{ top: '50%', left: '60%' }}></div>
                                                    <div className="hint-pin" style={{ top: '80%', left: '15%' }}></div>
                                                </div>
                                            </div>

                                            {/* Placed Elements */}
                                            {pageElements.map(el => (
                                                <div
                                                    key={el.id}
                                                    style={{ position: 'absolute', left: `${el.x}%`, top: `${el.y}%`, width: `${el.w}%`, cursor: 'move', userSelect: 'none', border: selectedElId === el.id ? '2px solid rgba(6,214,242,0.8)' : '2px solid transparent', borderRadius: '6px', padding: '4px 6px', background: selectedElId === el.id ? 'rgba(6,214,242,0.08)' : 'transparent', boxSizing: 'border-box', minWidth: '60px', transition: 'border-color 0.15s' }}
                                                    onClick={e => { e.stopPropagation(); setSelectedElId(el.id); }}
                                                    onMouseDown={e => {
                                                        e.stopPropagation();
                                                        setSelectedElId(el.id);
                                                        const startX = e.clientX, startY = e.clientY, startElX = el.x, startElY = el.y;
                                                        const canvas = e.currentTarget.parentElement;
                                                        const rect = canvas.getBoundingClientRect();
                                                        const mm = me => {
                                                            const dx = ((me.clientX - startX) / rect.width) * 100;
                                                            const dy = ((me.clientY - startY) / rect.height) * 100;
                                                            setPageElements(prev => prev.map(item => item.id === el.id ? { ...item, x: Math.max(0, Math.min(80, startElX + dx)), y: Math.max(0, Math.min(85, startElY + dy)) } : item));
                                                        };
                                                        const mu = () => { window.removeEventListener('mousemove', mm); window.removeEventListener('mouseup', mu); };
                                                        window.addEventListener('mousemove', mm);
                                                        window.addEventListener('mouseup', mu);
                                                    }}
                                                >
                                                    {el.type === 'heading' && <div style={{ color: el.color || 'var(--primary)', fontWeight: '900', fontSize: '1.1rem', fontFamily: 'var(--font-h)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{el.text}</div>}
                                                    {el.type === 'subheading' && <div style={{ color: el.color || 'rgba(255,255,255,0.9)', fontWeight: '700', fontSize: '0.9rem', fontFamily: 'var(--font-h)', whiteSpace: 'nowrap', overflow: 'hidden' }}>{el.text}</div>}
                                                    {el.type === 'paragraph' && <div style={{ color: el.color || 'inherit', fontSize: '0.7rem', opacity: 0.75, lineHeight: '1.4', fontFamily: 'var(--font-b)' }}>{el.text}</div>}
                                                    {el.type === 'btn_primary' && <button style={{ background: el.color || 'var(--primary)', color: '#000', border: 'none', borderRadius: '8px', padding: '5px 10px', fontSize: '0.72rem', fontWeight: 'bold', width: '100%', cursor: 'default', whiteSpace: 'nowrap', fontFamily: 'var(--font-b)' }}>{el.text}</button>}
                                                    {el.type === 'btn_outline' && <button style={{ background: 'transparent', color: el.color || 'var(--primary)', border: `1px solid ${el.color || 'var(--primary)'}`, borderRadius: '8px', padding: '5px 10px', fontSize: '0.72rem', fontWeight: 'bold', width: '100%', cursor: 'default', whiteSpace: 'nowrap', fontFamily: 'var(--font-b)' }}>{el.text}</button>}
                                                    {el.type === 'search' && <div style={{ background: 'rgba(0,0,0,0.3)', border: `1px solid ${el.color || 'rgba(255,255,255,0.15)'}`, borderRadius: '999px', padding: '4px 10px', fontSize: '0.7rem', opacity: 0.85, display: 'flex', alignItems: 'center', gap: '5px', color: el.color || 'inherit', fontFamily: 'var(--font-b)' }}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>{el.text}</div>}
                                                    {el.type === 'layers' && <div style={{ background: 'rgba(0,0,0,0.2)', border: `1px solid ${el.color || 'rgba(255,255,255,0.08)'}`, borderRadius: '6px', padding: '4px 8px', fontSize: '0.7rem', opacity: 0.8, color: el.color || 'inherit', fontFamily: 'var(--font-b)' }}>{el.text}</div>}
                                                    {el.type === 'stat' && <div style={{ background: 'rgba(0,0,0,0.3)', border: `1px solid ${el.color || 'rgba(255,255,255,0.08)'}`, borderRadius: '8px', padding: '6px', textAlign: 'center', fontFamily: 'var(--font-b)' }}><div style={{ color: el.color || 'var(--primary)', fontWeight: '800', fontSize: '1.1rem', fontFamily: 'var(--font-h)' }}>0</div><div style={{ fontSize: '0.65rem', opacity: 0.7 }}>{el.text}</div></div>}
                                                    {el.type === 'divider' && <hr style={{ border: 'none', borderTop: `1px solid ${el.color || 'rgba(255,255,255,0.15)'}`, margin: '4px 0' }} />}
                                                    {el.type === 'badge' && <span style={{ background: el.color || 'var(--primary)', color: '#000', borderRadius: '999px', padding: '2px 10px', fontSize: '0.7rem', fontWeight: 'bold', display: 'inline-block', fontFamily: 'var(--font-b)' }}>{el.text}</span>}
                                                    {el.type === 'card' && <div style={{ background: 'rgba(20,43,71,0.6)', border: `1px solid ${el.color || 'var(--border)'}`, borderRadius: '10px', padding: '10px', textAlign: 'right', fontFamily: 'var(--font-b)' }}><div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#fff', marginBottom: '4px' }}>{el.text}</div><div style={{ fontSize: '0.6rem', opacity: 0.6 }}>نص وصفي للبطاقة...</div></div>}
                                                    {el.type === 'shadcn_accordion' && (
                                                        <div style={{ background: 'rgba(0,0,0,0.3)', border: `1px solid ${el.color || 'rgba(255,255,255,0.1)'}`, borderRadius: '8px', padding: '6px 12px', fontSize: '0.72rem', color: '#fff', fontFamily: 'var(--font-b)' }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 'bold' }}>
                                                                <span>{el.text || 'أسئلة شائعة'}</span>
                                                                <span style={{ fontSize: '0.6rem', opacity: 0.6 }}>▼</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {el.type === 'shadcn_alert' && (
                                                        <div style={{ background: 'rgba(16,185,129,0.1)', border: `1px solid ${el.color || 'var(--primary)'}`, borderRadius: '8px', padding: '6px 10px', fontSize: '0.7rem', display: 'flex', gap: '8px', alignItems: 'center', color: '#fff', fontFamily: 'var(--font-b)' }}>
                                                            <span style={{ color: el.color || 'var(--primary)' }}>🔔</span>
                                                            <div>
                                                                <div style={{ fontWeight: 'bold', fontSize: '0.75rem' }}>تنبيه هام</div>
                                                                <div style={{ opacity: 0.8, fontSize: '0.65rem' }}>{el.text || 'رسالة التنبيه الافتراضية'}</div>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {el.type === 'shadcn_avatar' && (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'var(--font-b)' }}>
                                                            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: el.color || 'var(--primary)', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.75rem' }}>PN</div>
                                                            <div style={{ fontSize: '0.7rem', color: '#fff' }}>{el.text || 'مستخدم بال نوفا'}</div>
                                                        </div>
                                                    )}
                                                    {el.type === 'shadcn_slider' && (
                                                        <div style={{ padding: '6px 0', fontFamily: 'var(--font-b)', width: '100%' }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', opacity: 0.7, marginBottom: '4px' }}>
                                                                <span>{el.text || 'المستوى'}</span>
                                                                <span>70%</span>
                                                            </div>
                                                            <div style={{ height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '999px', position: 'relative' }}>
                                                                <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: '30%', background: el.color || 'var(--primary)', borderRadius: '999px' }}></div>
                                                                <div style={{ position: 'absolute', top: '50%', left: '30%', transform: 'translate(-50%, -50%)', width: '10px', height: '10px', borderRadius: '50%', background: '#fff', border: `2px solid ${el.color || 'var(--primary)'}` }}></div>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {el.type === 'shadcn_switch' && (
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', fontFamily: 'var(--font-b)', fontSize: '0.7rem', width: '100%' }}>
                                                            <span>{el.text || 'تفعيل الوضع'}</span>
                                                            <div style={{ width: '28px', height: '16px', background: el.color || 'var(--primary)', borderRadius: '999px', position: 'relative' }}>
                                                                <div style={{ position: 'absolute', top: '2px', left: '2px', width: '12px', height: '12px', borderRadius: '50%', background: '#000' }}></div>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {el.type === 'shadcn_progress' && (
                                                        <div style={{ padding: '4px 0', fontFamily: 'var(--font-b)', width: '100%' }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', opacity: 0.7, marginBottom: '4px' }}>
                                                                <span>{el.text || 'التقدم'}</span>
                                                                <span>60%</span>
                                                            </div>
                                                            <div style={{ height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '999px', overflow: 'hidden' }}>
                                                                <div style={{ width: '60%', height: '100%', background: el.color || 'var(--primary)', borderRadius: '999px' }}></div>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {el.type === 'shadcn_tabs' && (
                                                        <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', padding: '2px', display: 'flex', gap: '2px', fontFamily: 'var(--font-b)', width: '100%' }}>
                                                            <div style={{ flex: 1, padding: '4px 2px', fontSize: '0.65rem', fontWeight: 'bold', background: el.color || 'var(--primary)', color: '#000', borderRadius: '4px', textAlign: 'center' }}>{el.text || 'تبويب 1'}</div>
                                                            <div style={{ flex: 1, padding: '4px 2px', fontSize: '0.65rem', color: '#fff', borderRadius: '4px', textAlign: 'center', opacity: 0.6 }}>خيارات</div>
                                                        </div>
                                                    )}
                                                    {el.type === 'icon' && (
                                                        <div style={{ color: el.color || 'var(--primary)', display: 'flex', justifyContent: 'center' }}>
                                                            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2">
                                                                {el.icon && (el.icon.includes('points') ? <polygon points={el.icon} /> : <path d={el.icon} />)}
                                                            </svg>
                                                        </div>
                                                    )}
                                                    {selectedElId === el.id && (
                                                        <button onClick={e => { e.stopPropagation(); setPageElements(prev => prev.filter(i => i.id !== el.id)); setSelectedElId(null); }} style={{ position: 'absolute', top: '-8px', right: '-8px', width: '18px', height: '18px', borderRadius: '50%', background: '#EF4444', color: 'white', border: 'none', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>×</button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                        <div style={{ fontSize: '0.7rem', opacity: 0.4, textAlign: 'center' }}>اسحب لتحريك العناصر · انقر لتحديد · × للحذف</div>
                                    </div>

                                    {/* Properties Panel */}
                                    <div style={{ width: '160px', background: 'rgba(0,0,0,0.3)', borderLeft: '1px solid rgba(255,255,255,0.06)', padding: '16px 12px', flexShrink: 0, overflowY: 'auto' }}>
                                        <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', letterSpacing: '2px', marginBottom: '12px' }}>الخصائص</div>
                                        {selectedElId && (() => {
                                            const el = pageElements.find(e => e.id === selectedElId);
                                            if (!el) return <div style={{ fontSize: '0.75rem', opacity: 0.4 }}>لا يوجد تحديد</div>;
                                            return (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                    <div style={{ background: 'rgba(6,214,242,0.1)', border: '1px solid rgba(6,214,242,0.2)', borderRadius: '6px', padding: '6px 8px', fontSize: '0.75rem', color: 'var(--accent-cyan)' }}>{el.label}</div>
                                                    <div>
                                                        <label style={{ fontSize: '0.7rem', opacity: 0.6, display: 'block', marginBottom: '4px' }}>النص</label>
                                                        <input value={el.text || ''} onChange={e => setPageElements(prev => prev.map(i => i.id === el.id ? { ...i, text: e.target.value } : i))} style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '5px 8px', color: 'white', fontSize: '0.75rem', boxSizing: 'border-box' }} />
                                                    </div>
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                                                        <div><label style={{ fontSize: '0.65rem', opacity: 0.5, display: 'block', marginBottom: '2px' }}>X%</label><input type="number" value={Math.round(el.x)} min="0" max="80" onChange={e => setPageElements(prev => prev.map(i => i.id === el.id ? { ...i, x: Number(e.target.value) } : i))} style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '4px 6px', color: 'white', fontSize: '0.72rem', boxSizing: 'border-box' }} /></div>
                                                        <div><label style={{ fontSize: '0.65rem', opacity: 0.5, display: 'block', marginBottom: '2px' }}>Y%</label><input type="number" value={Math.round(el.y)} min="0" max="85" onChange={e => setPageElements(prev => prev.map(i => i.id === el.id ? { ...i, y: Number(e.target.value) } : i))} style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '4px 6px', color: 'white', fontSize: '0.72rem', boxSizing: 'border-box' }} /></div>
                                                    </div>
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                                                        <div><label style={{ fontSize: '0.65rem', opacity: 0.5, display: 'block', marginBottom: '2px' }}>العرض %</label><input type="number" value={el.w} min="5" max="100" onChange={e => setPageElements(prev => prev.map(i => i.id === el.id ? { ...i, w: Number(e.target.value) } : i))} style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '4px 6px', color: 'white', fontSize: '0.72rem', boxSizing: 'border-box' }} /></div>
                                                        <div><label style={{ fontSize: '0.65rem', opacity: 0.5, display: 'block', marginBottom: '2px' }}>اللون</label><input type="color" value={el.color || designSelections.customPrimary} onChange={e => setPageElements(prev => prev.map(i => i.id === el.id ? { ...i, color: e.target.value } : i))} style={{ width: '100%', height: '26px', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }} /></div>
                                                    </div>
                                                    <button onClick={() => { setPageElements(prev => prev.filter(i => i.id !== el.id)); setSelectedElId(null); }} style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444', borderRadius: '6px', padding: '6px', fontSize: '0.75rem', cursor: 'pointer', width: '100%' }}>حذف العنصر</button>
                                                </div>
                                            );
                                        })()}
                                        {!selectedElId && <div style={{ fontSize: '0.75rem', opacity: 0.4, textAlign: 'center', marginTop: '20px' }}>انقر على عنصر لتعديله</div>}
                                    </div>
                                </div>
                            </div>
                        )}
                    </main>

                    <aside className="ds-preview" dir="rtl" style={{ fontFamily: 'var(--font-main)' }}>
                        <div className="ds-preview-head">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                            <span>معاينة الاستجابة الحية</span>
                        </div>

                        <div className="preview-device-toggle">
                            <div className={`device-toggle-btn ${previewDevice === 'desktop' ? 'active' : ''}`} onClick={() => setPreviewDevice('desktop')}>
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
                                <span>حاسوب</span>
                            </div>
                            <div className={`device-toggle-btn ${previewDevice === 'mobile' ? 'active' : ''}`} onClick={() => setPreviewDevice('mobile')}>
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2" /><line x1="12" y1="18" x2="12.01" y2="18" /></svg>
                                <span>هاتف</span>
                            </div>
                        </div>

                        <div className="device-frame-container">
                            <div className={`${previewDevice === 'desktop' ? 'laptop-frame' : 'phone-frame'}`}>
                                <div className={`preview-mock-content layout-mockup lm-${designSelections.layout} ${designSelections.effect}`}>
                                    {(() => {
                                        const basemapMockupStyle = {
                                            satellite: {
                                                background: 'linear-gradient(135deg, #122c15, #08170e)',
                                                backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(20,80,40,0.3) 0%, transparent 80%), linear-gradient(135deg, #0d2112, #040d06)'
                                            },
                                            streets: {
                                                background: 'linear-gradient(135deg, #3a4b61, #1e2936)',
                                                backgroundImage: 'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
                                                backgroundSize: '10px 10px'
                                            },
                                            outdoors: {
                                                background: 'linear-gradient(135deg, #2e4d2a, #162814)',
                                                backgroundImage: 'radial-gradient(circle at 30% 20%, rgba(139,195,74,0.15) 0%, transparent 60%), linear-gradient(135deg, #223e1e, #0e1a0b)'
                                            },
                                            light: {
                                                background: 'linear-gradient(135deg, #e5e9f0, #c8d3e6)',
                                                backgroundImage: 'linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px)',
                                                backgroundSize: '12px 12px'
                                            },
                                            dark: {
                                                background: 'linear-gradient(135deg, #12161a, #06080a)',
                                                backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
                                                backgroundSize: '15px 15px'
                                            },
                                            palestine: {
                                                background: 'linear-gradient(135deg, #111b15, #070c09)',
                                                backgroundImage: 'radial-gradient(circle at 80% 20%, rgba(206,17,38,0.08) 0%, transparent 50%), radial-gradient(circle at 20% 80%, rgba(0,122,61,0.08) 0%, transparent 50%), linear-gradient(135deg, #0e1611, #060a08)'
                                            }
                                        }[designSelections.basemap] || {
                                            background: 'linear-gradient(135deg, #1A3458, #0F1E33)'
                                        };

                                        const mapInteractiveOverlays = (
                                            <>
                                                {/* Map pins simulating markers */}
                                                <div className="lm-pin" style={{ top: '30%', left: '40%' }}></div>
                                                <div className="lm-pin cy" style={{ top: '60%', left: '70%' }}></div>
                                                <div className="lm-pin lg" style={{ top: '45%', left: '55%' }}></div>

                                                {/* 1. Zoom Controls */}
                                                {designSelections.show_controls && (
                                                    <div className="lm-zoom-controls" style={{ position: 'absolute', top: '8px', right: '8px', display: 'flex', flexDirection: 'column', gap: '2px', zIndex: 10, background: 'rgba(10,22,40,0.85)', padding: '2px', borderRadius: '3px', border: '1px solid rgba(255,255,255,0.1)' }}>
                                                        <div style={{ width: '10px', height: '10px', display: 'grid', placeItems: 'center', fontSize: '7px', color: '#fff', fontWeight: 'bold', cursor: 'default' }}>+</div>
                                                        <div style={{ width: '10px', height: '10px', display: 'grid', placeItems: 'center', fontSize: '7px', color: '#fff', fontWeight: 'bold', cursor: 'default', borderTop: '1px solid rgba(255,255,255,0.1)' }}>-</div>
                                                    </div>
                                                )}

                                                {/* 2. Scale Ruler */}
                                                {designSelections.enable_scale && (
                                                    <div className="lm-scale-bar" style={{ position: 'absolute', bottom: '15px', right: '8px', background: 'rgba(10,22,40,0.85)', border: '1px solid #fff', borderTop: 'none', height: '3px', width: '22px', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <span style={{ fontSize: '4px', color: '#fff', transform: 'scale(0.85)', display: 'block', marginTop: '-6px', fontWeight: 'bold' }}>50م</span>
                                                    </div>
                                                )}

                                                {/* 3. Attribution */}
                                                {designSelections.show_attribution && (
                                                    <div className="lm-attribution" style={{ position: 'absolute', bottom: '2px', right: '8px', fontSize: '4.5px', opacity: 0.5, color: '#fff', zIndex: 10, pointerEvents: 'none' }}>
                                                        © OSM PalNovaa
                                                    </div>
                                                )}

                                                {/* 4. Layer Toggle Indicator */}
                                                {designSelections.show_layer_toggle && (
                                                    <div className="lm-layer-toggle-mini" style={{ position: 'absolute', top: '8px', left: '8px', width: '12px', height: '12px', background: 'rgba(10,22,40,0.9)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '3px', display: 'grid', placeItems: 'center', zIndex: 10 }}>
                                                        <svg viewBox="0 0 24 24" width="7" height="7" fill="none" stroke="var(--primary)" strokeWidth="3">
                                                            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                                                        </svg>
                                                    </div>
                                                )}

                                                {/* 5. Geocoding Search Bar Overlay */}
                                                {designSelections.enable_search && designSelections.layout !== 'fullmap' && (
                                                    <div className="lm-search-mini" style={{ position: 'absolute', top: '8px', left: '26px', right: '26px', height: '12px', background: 'rgba(10,22,40,0.9)', border: '1px solid var(--primary-glow)', borderRadius: '99px', display: 'flex', alignItems: 'center', gap: '3px', padding: '0 5px', zIndex: 10 }}>
                                                        <span style={{ fontSize: '5px', color: '#fff', opacity: 0.6 }}>🔍 بحث...</span>
                                                    </div>
                                                )}

                                                {/* 6. Cinematic Auto Rotate Compass Indicator */}
                                                {designSelections.auto_rotate && (
                                                    <div className="lm-rotate-compass" style={{ position: 'absolute', top: designSelections.show_controls ? '34px' : '8px', right: '8px', width: '12px', height: '12px', border: '1px solid var(--primary)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'spin 8s linear infinite', zIndex: 10, background: 'rgba(10,22,40,0.8)' }}>
                                                        <div style={{ width: '1px', height: '9px', background: 'var(--primary)', position: 'relative' }}>
                                                            <div style={{ position: 'absolute', top: 0, left: '-1px', width: '3px', height: '3px', background: '#EF4444', borderRadius: '50%' }}></div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* 7. Interactive Map Legend */}
                                                {designSelections.show_legend && (
                                                    <div className="lm-legend-mini" style={{ position: 'absolute', bottom: '8px', left: '8px', width: '32px', background: 'rgba(10,22,40,0.9)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', padding: '3px', zIndex: 10, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                                            <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--primary)' }}></span>
                                                            <span style={{ fontSize: '4px', color: '#fff', transform: 'scale(0.8)', transformOrigin: 'left' }}>المعالم</span>
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                                            <span style={{ width: '4px', height: '4px', background: '#06D6F2' }}></span>
                                                            <span style={{ fontSize: '4px', color: '#fff', transform: 'scale(0.8)', transformOrigin: 'left' }}>الطرق</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        );

                                        if (designSelections.layout === 'modal') {
                                            return (
                                                <div className="lm-modal-frame">
                                                    <div className="lm-modal-bar"></div>
                                                    <div className="lm-map" style={basemapMockupStyle}>
                                                        {mapInteractiveOverlays}
                                                    </div>
                                                </div>
                                            );
                                        }

                                        return (
                                            <>
                                                <div className="lm-map" style={basemapMockupStyle}>
                                                    {mapInteractiveOverlays}
                                                </div>

                                                {designSelections.layout === 'fullmap' && (
                                                    <>
                                                        <div className="lm-search"></div>
                                                        <div className="lm-panel">
                                                            <div className="lm-row accent thick"></div>
                                                            <div className="lm-row short"></div>
                                                            <div className="lm-row tiny"></div>
                                                        </div>
                                                    </>
                                                )}

                                                {designSelections.layout === 'sidebar' && (
                                                    <div className="lm-panel lm-sidebar">
                                                        <div className="lm-header" style={{ position: 'relative', height: '15px', marginBottom: '8px' }}></div>
                                                        {[1, 2, 3, 4, 5].map(i => (
                                                            <div key={i} className="lm-item">
                                                                <div className="lm-thumb"></div>
                                                                <div className="lm-item-content">
                                                                    <div className="lm-row tiny"></div>
                                                                    <div className="lm-row short" style={{ opacity: 0.5 }}></div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {designSelections.layout === 'three' && (
                                                    <>
                                                        <div className="lm-header"></div>
                                                        <div className="lm-tools">
                                                            <div className="lm-tool active"></div>
                                                            <div className="lm-tool"></div>
                                                            <div className="lm-tool"></div>
                                                            <div className="lm-tool"></div>
                                                        </div>
                                                        <div className="lm-panel lm-details">
                                                            <div className="lm-row thick accent"></div>
                                                            <div className="lm-row short"></div>
                                                            <div className="lm-row"></div>
                                                        </div>
                                                    </>
                                                )}

                                                {designSelections.layout === 'dashboard' && (
                                                    <>
                                                        <div className="lm-header">
                                                            <div className="lm-spacer"></div>
                                                            <div className="lm-dot-row"><i></i></div>
                                                        </div>
                                                        <div className="lm-stats">
                                                            {[1, 2, 3].map(i => (
                                                                <div key={i} className="lm-stat">
                                                                    <div className="lm-row tiny" style={{ opacity: 0.5 }}></div>
                                                                    <div className="lm-stat-num"></div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </>
                                                )}

                                                {designSelections.layout === 'split' && (
                                                    <div className="lm-panel">
                                                        <div className="lm-row thick accent" style={{ width: '80%', marginBottom: '10px' }}></div>
                                                        <div className="lm-grid-2">
                                                            {[1, 2, 3, 4].map(i => <div key={i} className="lm-card-ph" style={{ height: '25px' }}></div>)}
                                                        </div>
                                                    </div>
                                                )}

                                                {designSelections.layout === 'stacked' && (
                                                    <div className="lm-panel">
                                                        <div className="lm-row tiny accent" style={{ marginBottom: '6px' }}></div>
                                                        <div style={{ display: 'flex', gap: '8px', flex: 1 }}>
                                                            {[1, 2, 3].map(i => <div key={i} style={{ flex: 1, background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }}></div>)}
                                                        </div>
                                                    </div>
                                                )}

                                                {designSelections.layout === 'floating' && (
                                                    <>
                                                        <div className="lm-panel lm-fc1">
                                                            <div className="lm-row tiny accent"></div>
                                                            <div className="lm-row short"></div>
                                                        </div>
                                                        <div className="lm-panel lm-fc2">
                                                            <div className="lm-row thick accent"></div>
                                                            <div className="lm-row"></div>
                                                        </div>
                                                    </>
                                                )}

                                                {designSelections.layout === 'custom' && (
                                                    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 6 }}>
                                                        {pageElements.map(el => (
                                                            <div
                                                                key={el.id}
                                                                style={{
                                                                    position: 'absolute',
                                                                    left: `${el.x}%`,
                                                                    top: `${el.y}%`,
                                                                    width: `${el.w}%`,
                                                                    fontSize: '4px',
                                                                    padding: '1px 2px',
                                                                    borderRadius: '2px',
                                                                    lineHeight: 1,
                                                                    color: el.color || 'var(--primary)',
                                                                    boxSizing: 'border-box'
                                                                }}
                                                            >
                                                                {el.type === 'heading' && <div style={{ fontWeight: '900', fontSize: '6px', whiteSpace: 'nowrap', overflow: 'hidden' }}>{el.text}</div>}
                                                                {el.type === 'subheading' && <div style={{ fontWeight: '700', fontSize: '5px', whiteSpace: 'nowrap', overflow: 'hidden' }}>{el.text}</div>}
                                                                {el.type === 'paragraph' && <div style={{ fontSize: '3px', opacity: 0.75, overflow: 'hidden', height: '6px' }}>{el.text}</div>}
                                                                {el.type === 'btn_primary' && <div style={{ background: el.color || 'var(--primary)', color: '#000', borderRadius: '2px', height: '6px', fontSize: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>{el.text}</div>}
                                                                {el.type === 'btn_outline' && <div style={{ border: `0.5px solid ${el.color || 'var(--primary)'}`, borderRadius: '2px', height: '6px', fontSize: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>{el.text}</div>}
                                                                {el.type === 'search' && <div style={{ background: 'rgba(0,0,0,0.4)', border: '0.5px solid rgba(255,255,255,0.2)', borderRadius: '99px', height: '6px', display: 'flex', alignItems: 'center', padding: '0 2px', fontSize: '3px' }}>🔍 {el.text}</div>}
                                                                {el.type === 'layers' && <div style={{ background: 'rgba(0,0,0,0.3)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: '2px', height: '6px', fontSize: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>⊞ {el.text}</div>}
                                                                {el.type === 'stat' && <div style={{ background: 'rgba(0,0,0,0.4)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: '2px', padding: '1px', textAlign: 'center' }}><div style={{ fontWeight: '800', fontSize: '5px' }}>0</div><div style={{ fontSize: '2.5px', opacity: 0.7 }}>{el.text}</div></div>}
                                                                {el.type === 'divider' && <hr style={{ border: 'none', borderTop: '0.5px solid rgba(255,255,255,0.2)', margin: '1px 0' }} />}
                                                                {el.type === 'badge' && <span style={{ background: el.color || 'var(--primary)', color: '#000', borderRadius: '99px', padding: '0.5px 2px', fontSize: '3px', fontWeight: 'bold', display: 'inline-block' }}>{el.text}</span>}
                                                                {el.type === 'card' && <div style={{ background: 'rgba(20,43,71,0.6)', border: '0.5px solid var(--border)', borderRadius: '2px', padding: '2px' }}><div style={{ fontSize: '4px', fontWeight: 'bold', color: '#fff' }}>{el.text}</div><div style={{ fontSize: '2.5px', opacity: 0.6 }}>...</div></div>}
                                                                {el.type === 'icon' && <div style={{ display: 'flex', justifyContent: 'center' }}>⭐</div>}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>

                        <div className="preview-info" style={{ marginTop: '20px' }}>
                            <div className="preview-info-row"><span className="pi-label">التخطيط</span><span className="pi-value">{designSelections.layout}</span></div>
                            <div className="preview-info-row"><span className="pi-label">الهوية اللونية</span><span className="pi-value" style={{ color: 'var(--primary)' }}>{designSelections.palette}</span></div>
                            <div className="preview-info-row"><span className="pi-label">العرض الحالي</span><span className="pi-value">{previewDevice === 'desktop' ? 'شاشة عريضة' : 'تطبيق محمول'}</span></div>
                        </div>
                    </aside>
                </div>

                {isMagicPromptOpen && (
                    <div className="ds-overlay active" style={{ display: 'grid', placeItems: 'center', zIndex: 9999, position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)' }}>
                        <div className="ds-modal magic-modal" style={{ width: '500px', background: '#0A1628', borderRadius: '24px', border: '1px solid rgba(6,214,242,0.4)', padding: '30px', boxShadow: '0 30px 80px rgba(0,0,0,0.9)', position: 'relative' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                                <div style={{ width: '45px', height: '45px', background: 'rgba(6,214,242,0.15)', borderRadius: '14px', display: 'grid', placeItems: 'center' }}>
                                    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="var(--primary)" strokeWidth="2"><path d="M15 12l-8.5 8.5-2.5-2.5 8.5-8.5 2.5 2.5zM17.5 9.5l-2.5-2.5 1.5-1.5 2.5 2.5-1.5 1.5zM12 2l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2zM20 14l.5 1 1 .5-1 .5-.5 1-.5-1-1-.5 1-.5.5-1z" /></svg>
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1.3rem', color: 'var(--primary)', fontWeight: 800 }}>المحرك الإبداعي الذكي (AI)</h3>
                                    <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.7 }}>صف رؤيتك للمشروع وسيقوم PalNovaa بتصميم الأساس لك</p>
                                </div>
                            </div>

                            <textarea
                                value={magicPromptText}
                                onChange={(e) => setMagicPromptText(e.target.value)}
                                placeholder="مثلاً: أريد واجهة لموقع مدارس بلمسة كحلية وذهبية فخمة..."
                                style={{ width: '100%', height: '140px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '15px', padding: '15px', color: 'white', fontFamily: 'var(--font-b)', fontSize: '0.95rem', marginBottom: '25px', outline: 'none', resize: 'none', lineHeight: '1.6' }}
                            />

                            <div style={{ display: 'flex', gap: '15px' }}>
                                <button
                                    className={`ds-btn primary ${isGenerating ? 'loading' : ''}`}
                                    style={{ flex: 2, height: '50px', fontSize: '1rem' }}
                                    onClick={handleMagicGenerate}
                                    disabled={isGenerating}
                                >
                                    {isGenerating ? 'جاري التحليل والتوليد...' : 'توليد التصميم السحري'}
                                </button>
                                <button
                                    className="ds-btn ghost"
                                    style={{ flex: 1, height: '50px' }}
                                    onClick={() => setIsMagicPromptOpen(false)}
                                >
                                    إلغاء
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {isPublishModalOpen && (
                    <div className="ds-overlay active" style={{ display: 'grid', placeItems: 'center', zIndex: 9999, position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)' }}>
                        <div className="ds-modal" style={{ width: '450px', background: '#0A1628', borderRadius: '24px', border: '1px solid rgba(16,185,129,0.3)', padding: '30px', boxShadow: '0 30px 80px rgba(0,0,0,0.9)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '25px' }}>
                                <div style={{ width: '45px', height: '45px', background: 'rgba(16,185,129,0.1)', borderRadius: '12px', display: 'grid', placeItems: 'center' }}>
                                    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#10B981" strokeWidth="2"><path d="M22 2L11 13M22 2L15 22L11 13L2 9L22 2Z" /></svg>
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#10B981' }}>نشر المشروع على دومينك</h3>
                                    <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.6 }}>اجعل تصميمك متاحاً للعالم برابط خاص</p>
                                </div>
                            </div>

                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', opacity: 0.8 }}>اسم المشروع</label>
                                <input
                                    type="text"
                                    value={publishName}
                                    onChange={(e) => setPublishName(e.target.value)}
                                    placeholder="مثلاً: خريطة مدارس بوسطن"
                                    style={{ width: '100%', height: '45px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '0 15px', color: 'white', outline: 'none' }}
                                />
                            </div>

                            <div style={{ marginBottom: '25px' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', opacity: 0.8 }}>الرابط المخصص (Slug)</label>
                                <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                                    <span style={{ padding: '0 10px', fontSize: '0.8rem', opacity: 0.5, borderLeft: '1px solid rgba(255,255,255,0.1)' }}>palnovaa.com/p/</span>
                                    <input
                                        type="text"
                                        value={publishSlug}
                                        onChange={(e) => setPublishSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                                        placeholder="boston-schools"
                                        style={{ flex: 1, height: '45px', background: 'transparent', border: 'none', padding: '0 10px', color: 'white', outline: 'none' }}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '15px' }}>
                                <button
                                    className={`ds-btn primary ${isPublishing ? 'loading' : ''}`}
                                    style={{ flex: 2, height: '50px', background: '#10B981', border: 'none' }}
                                    onClick={handlePublishDesign}
                                    disabled={isPublishing}
                                >
                                    {isPublishing ? 'جاري النشر...' : 'تأكيد النشر الآن'}
                                </button>
                                <button
                                    className="ds-btn ghost"
                                    style={{ flex: 1, height: '50px' }}
                                    onClick={() => setIsPublishModalOpen(false)}
                                >
                                    إلغاء
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {isExportStudioOpen && (
                    <div className="ds-overlay active" style={{ display: 'grid', placeItems: 'center', zIndex: 99999, position: 'fixed', inset: 0, background: 'rgba(5, 12, 22, 0.85)', backdropFilter: 'blur(12px)' }}>
                        <div className="ds-modal" style={{ width: '500px', background: '#0A1628', borderRadius: '24px', border: '1.5px solid rgba(6, 214, 242, 0.35)', padding: '30px', boxShadow: '0 30px 80px rgba(0,0,0,0.9)', direction: 'rtl', textAlign: 'right' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '25px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '15px' }}>
                                <div style={{ width: '45px', height: '45px', background: 'rgba(6, 214, 242, 0.1)', borderRadius: '12px', display: 'grid', placeItems: 'center' }}>
                                    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#06D6F2" strokeWidth="2.5">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                                    </svg>
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#06D6F2', fontWeight: 'bold' }}>أستوديو تصميم وتصدير الخرائط HD</h3>
                                    <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.6 }}>قم بإعداد الخريطة الجغرافية وتصديرها بدقة عالية واحترافية متناهية</p>
                                </div>
                            </div>

                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.88rem', opacity: 0.9, fontWeight: 'bold' }}>عنوان الخريطة الرئيسي</label>
                                <input
                                    type="text"
                                    value={exportTitle}
                                    onChange={(e) => setExportTitle(e.target.value)}
                                    placeholder="أدخل عنوان الخريطة..."
                                    style={{ width: '100%', height: '42px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '0 15px', color: 'white', outline: 'none', fontSize: '0.9rem' }}
                                />
                            </div>

                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.88rem', opacity: 0.9, fontWeight: 'bold' }}>وصف الخريطة / الحواشي</label>
                                <textarea
                                    value={exportDesc}
                                    onChange={(e) => setExportDesc(e.target.value)}
                                    placeholder="أدخل وصفاً تفصيلياً أو هوامش للخريطة..."
                                    rows="3"
                                    style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '12px 15px', color: 'white', outline: 'none', fontSize: '0.85rem', resize: 'vertical', minHeight: '80px', fontFamily: 'inherit' }}
                                />
                            </div>

                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.88rem', opacity: 0.9, fontWeight: 'bold' }}>دقة التصدير والوضوح</label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                                    {[
                                        { id: 'standard', name: 'عادية (Screen)', desc: 'دقة الشاشة الحالية' },
                                        { id: 'hd', name: 'عالية (HD)', desc: '2560x1440 بكسل' },
                                        { id: 'uhd', name: 'فائقة (4K)', desc: '3840x2160 بكسل' }
                                    ].map(res => (
                                        <div 
                                            key={res.id} 
                                            onClick={() => setExportResolution(res.id)}
                                            style={{ 
                                                border: exportResolution === res.id ? '2px solid #06D6F2' : '1px solid rgba(255,255,255,0.1)', 
                                                background: exportResolution === res.id ? 'rgba(6, 214, 242, 0.08)' : 'rgba(255,255,255,0.02)', 
                                                borderRadius: '12px', padding: '10px 8px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s' 
                                            }}
                                        >
                                            <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: exportResolution === res.id ? '#06D6F2' : 'white' }}>{res.name}</div>
                                            <div style={{ fontSize: '0.65rem', opacity: 0.5, marginTop: '2px' }}>{res.desc}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div style={{ marginBottom: '25px', display: 'flex', flexDirection: 'column', gap: '10px', background: 'rgba(255,255,255,0.02)', padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span style={{ fontSize: '0.88rem', opacity: 0.9 }}>تضمين شعار المختبر (PalNovaa Lab)</span>
                                    <div 
                                        onClick={() => setExportIncludeLogo(!exportIncludeLogo)}
                                        style={{ width: '40px', height: '20px', background: exportIncludeLogo ? '#06D6F2' : 'rgba(255,255,255,0.1)', borderRadius: '10px', position: 'relative', cursor: 'pointer', transition: '0.3s' }}
                                    >
                                        <div style={{ width: '14px', height: '14px', background: 'white', borderRadius: '50%', position: 'absolute', top: '3px', left: exportIncludeLogo ? '23px' : '3px', transition: '0.3s' }}></div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span style={{ fontSize: '0.88rem', opacity: 0.9 }}>تضمين مفتاح الخريطة (Legend)</span>
                                    <div 
                                        onClick={() => setExportIncludeLegend(!exportIncludeLegend)}
                                        style={{ width: '40px', height: '20px', background: exportIncludeLegend ? '#06D6F2' : 'rgba(255,255,255,0.1)', borderRadius: '10px', position: 'relative', cursor: 'pointer', transition: '0.3s' }}
                                    >
                                        <div style={{ width: '14px', height: '14px', background: 'white', borderRadius: '50%', position: 'absolute', top: '3px', left: exportIncludeLegend ? '23px' : '3px', transition: '0.3s' }}></div>
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '15px' }}>
                                <button
                                    className={`ds-btn primary ${isExportingMap ? 'loading' : ''}`}
                                    style={{ flex: 2, height: '48px', background: '#06D6F2', border: 'none', color: 'black', fontWeight: 'bold' }}
                                    onClick={performHDExport}
                                    disabled={isExportingMap}
                                >
                                    {isExportingMap ? 'جاري تصدير الخريطة...' : 'بدء التصدير وتحميل الصورة'}
                                </button>
                                <button
                                    className="ds-btn ghost"
                                    style={{ flex: 1, height: '48px' }}
                                    onClick={() => setIsExportStudioOpen(false)}
                                >
                                    إلغاء
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ===== HYDRO SIM MODAL ===== */}
            {isHydroSimOpen && (
                <div id="hydro-studio">
                    {/* TOP BAR */}
                    <div className="hydro-topbar">
                        <div className="hydro-brand">
                            <div className="hydro-brand-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M12 2C6 8 4 12 4 15a8 8 0 0 0 16 0c0-3-2-7-8-13z"/>
                                </svg>
                            </div>
                            <div className="hydro-brand-text">
                                <strong>HYDROSTUDIO</strong>
                                <small>PALNOVAA</small>
                            </div>
                        </div>

                        <div className="hydro-topbar-divider"></div>

                        {/* Terrain Exaggeration */}
                        <div className="hydro-slider-group">
                            <label>تضخيم التضاريس</label>
                            <input type="range" id="hydro-exag" min="1" max="8" step="0.5" defaultValue="3" />
                            <span id="hydro-exag-val">3×</span>
                        </div>

                        {/* Structure Height */}
                        <div className="hydro-slider-group">
                            <label>ارتفاع الهيكل</label>
                            <input type="range" id="hydro-struct-h" min="5" max="200" step="5" defaultValue="40" />
                            <span id="hydro-struct-h-val">40م</span>
                        </div>

                        {/* Brush Intensity */}
                        <div className="hydro-slider-group">
                            <label>شدة تدفق الفرشاة</label>
                            <input type="range" id="hydro-water-vol" min="1" max="10" step="0.5" defaultValue="3" />
                            <span id="hydro-water-vol-val">3</span>
                        </div>

                        <div className="hydro-topbar-divider"></div>

                        <button className="hydro-btn success" id="hydro-sync-btn">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '4px' }}>
                                <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                            </svg>
                            مزامنة التضاريس
                        </button>

                        <button className="hydro-btn warn" id="hydro-reset-btn">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '4px' }}>
                                <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.49"/>
                            </svg>
                            إعادة تعيين
                        </button>

                        <button className="hydro-btn danger" id="hydro-close-btn">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '4px' }}>
                                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                            إغلاق
                        </button>
                    </div>

                    {/* BODY */}
                    <div className="hydro-body">
                        {/* LEFT: Tools Panel */}
                        <div className="hydro-tools">
                            <div className="hydro-section-title">وضع التشغيل</div>

                            <button className="hydro-tool-btn active" id="mode-navigate">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                                </svg>
                                التنقل
                            </button>

                            <button className="hydro-tool-btn" id="mode-draw">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                                    <path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/>
                                </svg>
                                رسم هيكل
                            </button>

                            <button className="hydro-tool-btn source-btn" id="mode-source">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                                    <path d="M12 22a8 8 0 0 0 8-8c0-4.418-8-12-8-12S4 9.582 4 14a8 8 0 0 0 8 8z"/><path d="M12 10v4"/><path d="M10 12h4"/>
                                </svg>
                                إضافة نبع تدفق
                            </button>

                            <button className="hydro-tool-btn fill-btn" id="mode-fill_select">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                                    <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"/><line x1="16" y1="8" x2="2" y2="22"/><line x1="17.5" y1="15" x2="9" y2="6.5"/>
                                </svg>
                                تعبئة حوض مائي
                            </button>

                            <button className="hydro-tool-btn water-btn" id="mode-water">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                                    <path d="M12 22a8 8 0 0 0 8-8c0-4.418-8-12-8-12S4 9.582 4 14a8 8 0 0 0 8 8z"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/>
                                </svg>
                                إضافة مياه
                            </button>

                            <button className="hydro-tool-btn inject-btn" id="mode-inject">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                                    <path d="M14.5 9.5L9.5 14.5"/><path d="M3.5 20.5L9 15"/><path d="M15 9l5.5-5.5a2.121 2.121 0 0 0-3-3L12 6"/><path d="M8 10l6 6"/><path d="M12 6l6 6"/>
                                </svg>
                                حقن حجم محدد
                            </button>

                            <button className="hydro-tool-btn erase-btn" id="mode-erase">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                                    <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/><line x1="18" y1="9" x2="12" y2="15"/><line x1="12" y1="9" x2="18" y2="15"/>
                                </svg>
                                مسح المياه
                            </button>

                            <div className="hydro-tool-divider"></div>
                            <div className="hydro-section-title">السعة والتعبئة</div>

                            <div className="hydro-param">
                                <label>تدفق النبع المستمر</label>
                                <div className="param-row">
                                    <input type="range" id="hydro-source-inflow" min="5" max="500" step="5" defaultValue="50" onInput={(e) => {
                                        const v = parseFloat(e.target.value);
                                        hydroStateRef.current.sourceInflowRate = v;
                                        e.target.nextElementSibling.textContent = v + 'م³/ث';
                                        if (hydroStateRef.current.waterSources) hydroStateRef.current.waterSources.forEach(src => src.inflowRate = v);
                                    }} />
                                    <span className="param-val" id="hydro-source-inflow-val">50م³/ث</span>
                                </div>
                            </div>

                            <div className="hydro-param">
                                <label>معدل تساقط الأمطار</label>
                                <div className="param-row">
                                    <input type="range" id="hydro-rain-rate" min="0" max="100" step="5" defaultValue="0" onInput={(e) => {
                                        const v = parseFloat(e.target.value);
                                        hydroStateRef.current.rainfallRate = v;
                                        e.target.nextElementSibling.textContent = v + ' ملم/س';
                                    }} />
                                    <span className="param-val" id="hydro-rain-rate-val">0 ملم/س</span>
                                </div>
                            </div>

                            <div className="hydro-param">
                                <label>حجم حقن المياه (م³)</label>
                                <div className="param-row" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <input type="number" id="hydro-inject-vol" min="100" max="10000000" defaultValue="10000" step="100" style={{ flex: 1, background: '#0d1e36', border: '1px solid rgba(6, 214, 242, 0.2)', color: 'white', padding: '6px 8px', borderRadius: '6px', fontSize: '13px', minWidth: '0' }} />
                                    <button className="hydro-btn success small" id="hydro-distribute-btn" style={{ padding: '6px 10px', fontSize: '11px', whiteSpace: 'nowrap', height: '31px', borderRadius: '6px' }}>توزيع بالتساوي</button>
                                </div>
                            </div>

                            <div className="hydro-param">
                                <label>منسوب التعبئة المستهدف</label>
                                <div className="param-row">
                                    <input type="range" id="hydro-fill-elev" min="0" max="1000" step="1" defaultValue="100" onInput={(e) => {
                                        const v = parseFloat(e.target.value);
                                        hydroStateRef.current.targetFillElev = v;
                                        e.target.nextElementSibling.textContent = v + 'م';
                                        if (hydroStateRef.current.fillStartPoint) {
                                            const s = hydroStateRef.current;
                                            const N = s.GRID;
                                            s.h.fill(0);
                                            const startIdx = s.fillStartPoint.gy * N + s.fillStartPoint.gx;
                                            if (s.terrain[startIdx] >= v) return;
                                            const visited = new Uint8Array(N * N);
                                            const queue = [startIdx];
                                            visited[startIdx] = 1;
                                            let head = 0;
                                            while (head < queue.length) {
                                                const idx = queue[head++];
                                                const cy = Math.floor(idx / N), cx = idx % N;
                                                s.h[idx] = Math.max(0, v - s.terrain[idx]);
                                                const neighbors = [[cy - 1, cx], [cy + 1, cx], [cy, cx - 1], [cy, cx + 1]];
                                                for (let d = 0; d < 4; d++) {
                                                    const [ny, nx] = neighbors[d];
                                                    if (ny >= 0 && ny < N && nx >= 0 && nx < N) {
                                                        const nidx = ny * N + nx;
                                                        if (!visited[nidx] && !s.barriers[nidx] && s.terrain[nidx] < v) {
                                                            visited[nidx] = 1; queue.push(nidx);
                                                        }
                                                    }
                                                }
                                            }
                                            s.flux.fill(0);
                                            if (s.map) s.map.triggerRepaint();
                                        }
                                    }} />
                                    <span className="param-val" id="hydro-fill-elev-val">100م</span>
                                </div>
                            </div>

                            <div className="hydro-tool-divider"></div>
                            <div className="hydro-section-title">نوع الهيكل</div>

                            <div className="struct-types">
                                <button className="struct-type active" data-type="wall">جدار</button>
                                <button className="struct-type" data-type="embankment">سد ترابي</button>
                                <button className="struct-type" data-type="barrier">حاجز</button>
                                <button className="struct-type" data-type="channel">قناة</button>
                            </div>

                            <div className="hydro-tool-divider"></div>
                            <div className="hydro-section-title">التضاريس</div>

                            <div className="hydro-param">
                                <label>دقة شبكة التضاريس (حجم الخلية)</label>
                                <div className="param-row">
                                    <select 
                                        className="hydro-select-input" 
                                        value={gridResolution} 
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value);
                                            setGridResolution(val);
                                            hydroStateRef.current.GRID = val;
                                        }}
                                        style={{ flex: 1, background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(6,214,242,0.3)', borderRadius: '6px', padding: '6px', outline: 'none' }}
                                    >
                                        <option value={64} style={{background: '#040d18'}}>64 × 64 (أداء فائق، دقة منخفضة)</option>
                                        <option value={128} style={{background: '#040d18'}}>128 × 128 (متوازن)</option>
                                        <option value={256} style={{background: '#040d18'}}>256 × 256 (دقة عالية، الافتراضي)</option>
                                        <option value={512} style={{background: '#040d18'}}>512 × 512 (دقة فائقة جداً)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="hydro-param">
                                <label>معامل الاحتكاك</label>
                                <div className="param-row">
                                    <input type="range" id="hydro-friction-input" min="0" max="1" step="0.05" defaultValue="0.3" />
                                    <span className="param-val" id="hydro-friction-val">0.30</span>
                                </div>
                            </div>

                            <div className="hydro-param">
                                <label>سرعة المحاكاة</label>
                                <div className="param-row">
                                    <input type="range" id="hydro-simspeed-input" min="0.5" max="4" step="0.5" defaultValue="1.5" />
                                    <span className="param-val" id="hydro-simspeed-val">1.5×</span>
                                </div>
                            </div>
                        </div>

                        {/* CENTER: Map */}
                        <div className="hydro-map-wrap" id="hydro-map-wrap">
                            <div id="hydro-map"></div>
                            <canvas id="hydro-draw-canvas"></canvas>

                            <div className="hydro-hint" id="hydro-hint">انقر لإضافة نقاط — انقر مرتين لإغلاق الشكل</div>

                            <div className="hydro-map-bar">
                                <div className="hbar-item">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '4px' }}>
                                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                                    </svg>
                                    <span id="hbar-coords">--°N, --°E</span>
                                </div>
                                <div className="hbar-item">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '4px' }}>
                                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                                    </svg>
                                    <span>تضاريس DEM 3D</span>
                                </div>
                                <div className="hbar-item">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '4px' }}>
                                        <path d="M12 2C6 8 4 12 4 15a8 8 0 0 0 16 0c0-3-2-7-8-13z"/>
                                    </svg>
                                    خلايا المياه: <span className="hbar-val" id="hbar-wvol">0</span> خلية
                                </div>
                                <div className="hbar-spacer"></div>
                                <div className="hbar-item">⚡ لا يتأثر الحفظ الرئيسي</div>
                            </div>
                        </div>

                        {/* RIGHT: Stats Panel */}
                        <div className="hydro-stats">
                            <div className="hydro-section-title">إحصائيات التشغيل</div>

                            <div className="hstat-card blue-glow">
                                <div className="hstat-label">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '4px' }}>
                                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                                    </svg>
                                    الخطوة الزمنية
                                </div>
                                <div className="hstat-val" id="stat-tick">0</div>
                                <div className="hstat-unit">frame</div>
                            </div>

                            <div className="hstat-card water-glow">
                                <div className="hstat-label">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '4px' }}>
                                        <path d="M12 2C6 8 4 12 4 15a8 8 0 0 0 16 0c0-3-2-7-8-13z"/>
                                    </svg>
                                    خلايا المياه
                                </div>
                                <div className="hstat-val water" id="stat-water">0</div>
                                <div className="hstat-unit">خلية نشطة</div>
                                <div className="hstat-bar">
                                    <div className="hstat-bar-fill water" id="stat-water-bar" style={{ width: '0%' }}></div>
                                </div>
                            </div>

                            <div className="hstat-card water-glow">
                                <div className="hstat-label">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2C6 8 4 12 4 15a8 8 0 0 0 16 0c0-3-2-7-8-13z"/></svg>
                                    السعة التخزينية للمياه
                                </div>
                                <div className="hstat-val water" id="stat-storage-vol">0</div>
                                <div className="hstat-unit" id="stat-storage-vol-unit">متر مكعب (m³)</div>
                            </div>

                            <div className="hstat-card">
                                <div className="hstat-label">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5"/></svg>
                                    المساحة السطحية للمياه
                                </div>
                                <div className="hstat-val" id="stat-storage-area">0</div>
                                <div className="hstat-unit" id="stat-storage-area-unit">هكتار (ha)</div>
                            </div>

                            <div className="hstat-card">
                                <div className="hstat-label">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18"/><path d="M18 17V9M13 17V5M8 17v-3"/></svg>
                                    أقصى منسوب مائي
                                </div>
                                <div className="hstat-val" id="stat-storage-elev">0.0</div>
                                <div className="hstat-unit">متر فوق سطح البحر</div>
                            </div>

                            <div className="hstat-card">
                                <div className="hstat-label">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/></svg>
                                    دقة شبكة التضاريس
                                </div>
                                <div className="hstat-val" id="stat-resolution">--م × --م</div>
                                <div className="hstat-unit">حجم الخلية الواحدة</div>
                            </div>
                            
                            <div className="hstat-card">
                                <div className="hstat-label">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M12 6v12M6 12h12"/></svg>
                                    مصادر التدفق النشطة
                                </div>
                                <div className="hstat-val" id="stat-sources-count">0</div>
                                <div className="hstat-unit">مصادر مياه مستمرة</div>
                                <div className="hstruct-list" id="sources-list"></div>
                            </div>

                            <div className="hstat-card">
                                <div className="hstat-label">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18"/><path d="M18 17V9M13 17V5M8 17v-3"/></svg>
                                    أقصى عمق
                                </div>
                                <div className="hstat-val" id="stat-depth">0.00</div>
                                <div className="hstat-unit">متر (m)</div>
                                <div className="hstat-bar"><div className="hstat-bar-fill" id="stat-depth-bar" style={{ width: '0%' }}></div></div>
                            </div>


                            <div className="hstat-card">
                                <div className="hstat-label">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '4px' }}>
                                        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                                    </svg>
                                    سرعة الجريان
                                </div>
                                <div className="hstat-val" id="stat-flow">0.000</div>
                                <div className="hstat-unit">وحدة/ثانية</div>
                            </div>

                            <div className="hstat-card">
                                <div className="hstat-label">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '4px' }}>
                                        <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5"/>
                                    </svg>
                                    الهياكل السدية
                                </div>
                                <div className="hstat-val" id="stat-structs">0</div>
                                <div className="hstat-unit">هيكل مرسوم</div>
                                <div className="hstruct-list" id="structs-list"></div>
                            </div>

                            <div className="hydro-legend">
                                <div className="hydro-legend-title">دليل الألوان</div>
                                <div className="legend-row">
                                    <div className="legend-swatch" style={{ background: 'linear-gradient(90deg, #001166, #0033DD)' }}></div>
                                    مياه عميقة
                                </div>
                                <div className="legend-row">
                                    <div className="legend-swatch" style={{ background: 'linear-gradient(90deg, #0055FF, #55AAFF)' }}></div>
                                    مياه متوسطة
                                </div>
                                <div className="legend-row">
                                    <div className="legend-swatch" style={{ background: 'rgba(100,180,255,0.4)' }}></div>
                                    مياه ضحلة
                                </div>
                                <div className="legend-row">
                                    <div className="legend-swatch" style={{ background: '#06D6F2' }}></div>
                                    جدار / حاجز
                                </div>
                                <div className="legend-row">
                                    <div className="legend-swatch" style={{ background: '#F5A623' }}></div>
                                    سد ترابي
                                </div>
                            </div>

                            <div className="hydro-sim-status idle" id="hydro-sim-status">
                                <div className="hydro-sim-dot"></div>
                                <span id="hydro-sim-status-text">المحاكاة متوقفة</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PalNovaaLab;
