import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import Map, { Source, Layer, NavigationControl, Popup } from 'react-map-gl/maplibre';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import 'maplibre-gl/dist/maplibre-gl.css';
import './PalNovaaLab.css';

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
    const [isHydroSimOpen, setIsHydroSimOpen] = useState(false);
    const [activeDsCategory, setActiveDsCategory] = useState('layouts');
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
    const [designSelections, setDesignSelections] = useState({
        layout: 'fullmap',
        palette: 'classic',
        font: 'cairo_tajawal',
        basemap: 'satellite',
        marker: 'pin',
        component: 'pill',
        effect: 'glow',
        customPrimary: '#F5A623'
    });
    const [pageElements, setPageElements] = useState([]);
    const [selectedElId, setSelectedElId] = useState(null);
    const [previewDevice, setPreviewDevice] = useState('desktop'); // 'desktop' or 'mobile'
    const [editingLayerId, setEditingLayerId] = useState(null);
    const [tempLayerName, setTempLayerName] = useState('');

    // Advanced Styling State
    const [layerStyles, setLayerStyles] = useState({}); // { layerId: { color, outlineColor, outlineWidth, shape, opacity, fillOpacity } }
    const [stylePopup, setStylePopup] = useState(null); // { layerId, x, y }
    const [openActionsLayerId, setOpenActionsLayerId] = useState(null);

    // PalStreet States
    const [palStreetLoading, setPalStreetLoading] = useState(false);
    const [palStreetProgress, setPalStreetProgress] = useState('');
    const [palStreetStats, setPalStreetStats] = useState(null);

    // Hydro Grid Resolution
    const [gridResolution, setGridResolution] = useState(256);

    // PalRemoteSensing (ASTER GDEM) States
    const [asterLoading, setAsterLoading] = useState(false);
    const [asterProgress, setAsterProgress] = useState('');
    const [asterGridSize, setAsterGridSize] = useState(10);
    const [activeAsterLayerId, setActiveAsterLayerId] = useState(null);
    const [asterViewType, setAsterViewType] = useState('raster'); // 'points' or 'raster'

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
                const yMin = Math.max(0, Math.min(...struct.gridPts.map(p => p.y)));
                const yMax = Math.min(N - 1, Math.max(...struct.gridPts.map(p => p.y)));

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

    const generateDemRaster = (results, gridSize, south, west, north, east) => {
        const canvas = document.createElement('canvas');
        const width = 256;
        const height = 256;
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        const elevations = results.map(r => r.elevation || 0);
        const minElev = Math.min(...elevations);
        const maxElev = Math.max(...elevations);
        const range = maxElev - minElev || 1;

        const getColorForElevation = (elev) => {
            const t = (elev - minElev) / range;
            let r, g, b;
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
        };

        const imgData = ctx.createImageData(width, height);
        const grid = [];
        for (let r = 0; r < gridSize; r++) {
            grid[r] = [];
            for (let c = 0; c < gridSize; c++) {
                const index = r * gridSize + c;
                grid[gridSize - 1 - r][c] = results[index].elevation || 0;
            }
        }

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const gx = (x / (width - 1)) * (gridSize - 1);
                const gy = (y / (height - 1)) * (gridSize - 1);

                const x0 = Math.floor(gx);
                const x1 = Math.min(x0 + 1, gridSize - 1);
                const y0 = Math.floor(gy);
                const y1 = Math.min(y0 + 1, gridSize - 1);

                const tx = gx - x0;
                const ty = gy - y0;

                const e00 = grid[y0][x0];
                const e10 = grid[y0][x1];
                const e01 = grid[y1][x0];
                const e11 = grid[y1][x1];

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

            const minElev = Math.min(...results.map(r => r.elevation || 0));
            const maxElev = Math.max(...results.map(r => r.elevation || 0));

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
                const rasterData = generateDemRaster(results, gridSize, south, west, north, east);
                
                newLayers.push({
                    id: `${newLayerId}-raster`,
                    name: `${layerName} (Raster)`,
                    type: 'raster',
                    url: rasterData.url,
                    coordinates: rasterData.coordinates,
                    isRemoteSensing: true,
                    minElevation: minElev,
                    maxElevation: maxElev,
                    isVisible: true
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
                    isHiddenPoints: true
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
                    isVisible: true
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

    const fetchPalStreetOSM = async (south, west, north, east, polygonFilterCoords = null) => {
        const latDim = Math.abs(north - south);
        const lngDim = Math.abs(east - west);
        const area = latDim * lngDim;
        if (area > 0.05) {
            alert("⚠️ النطاق المحدد واسع جداً! يرجى تكبير الخريطة أو تحديد منطقة أصغر لتجنب بطء الاستجابة.");
            return;
        }

        setPalStreetLoading(true);
        setPalStreetProgress("جاري الاتصال بخادم OpenStreetMap...");
        setPalStreetStats(null);

        const query = `[out:json][timeout:30];
(
  way["highway"](${south},${west},${north},${east});
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
                setPalStreetProgress(`جاري سحب الشوارع من الخادم (${url.split('/')[2]})...`);
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
            setPalStreetLoading(false);
            setPalStreetProgress("");
            alert(`❌ فشل جلب البيانات من خوادم OpenStreetMap. خطأ: ${fetchError?.message || "خطأ غير معروف"}`);
            return;
        }

        setPalStreetProgress("جاري معالجة وتصنيف مسارات الشوارع...");
        
        const features = [];
        const stats = {
            motorway: 0,
            trunk: 0,
            primary: 0,
            secondary: 0,
            tertiary: 0,
            residential: 0,
            service: 0,
            footway: 0,
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

        fetchedData.forEach(element => {
            if (element.type === 'way' && element.geometry) {
                const coords = element.geometry.map(pt => [pt.lon, pt.lat]);
                
                if (polygonFilterCoords && polygonFilterCoords[0]) {
                    const outerRing = polygonFilterCoords[0];
                    const isInside = coords.some(pt => isPointInPolygon(pt, outerRing));
                    if (!isInside) return;
                }

                const tags = element.tags || {};
                const hw = tags.highway || 'other';
                
                if (stats.hasOwnProperty(hw)) {
                    stats[hw]++;
                } else if (['motorway_link'].includes(hw)) {
                    stats.motorway++;
                } else if (['trunk_link'].includes(hw)) {
                    stats.trunk++;
                } else if (['primary_link'].includes(hw)) {
                    stats.primary++;
                } else if (['secondary_link'].includes(hw)) {
                    stats.secondary++;
                } else if (['tertiary_link'].includes(hw)) {
                    stats.tertiary++;
                } else if (['pedestrian', 'path', 'cycleway', 'living_street'].includes(hw)) {
                    stats.footway++;
                } else {
                    stats.other++;
                }

                features.push({
                    type: 'Feature',
                    id: element.id,
                    geometry: {
                        type: 'LineString',
                        coordinates: coords
                    },
                    properties: {
                        id: element.id,
                        name: tags.name || tags.name_ar || tags.name_en || 'شارع بدون اسم',
                        highway: hw,
                        surface: tags.surface || 'غير معروف',
                        oneway: tags.oneway || 'no',
                        maxspeed: tags.maxspeed || 'غير محدد',
                        ref: tags.ref || '',
                        ...tags
                    }
                });
            }
        });

        if (features.length === 0) {
            setPalStreetLoading(false);
            setPalStreetProgress("");
            alert("⚠️ لم يتم العثور على شوارع في المنطقة المحددة. يرجى تجربة منطقة أخرى.");
            return;
        }

        const newLayerId = `palstreet-${Date.now()}`;
        const layerName = `شوارع PalStreet [${features.length}]`;
        const geojson = {
            type: 'FeatureCollection',
            features: features
        };

        setGeoLayers(prev => [...prev, {
            id: newLayerId,
            name: layerName,
            data: geojson,
            isPalStreet: true,
            color: '#10D9A0',
            isVisible: true
        }]);

        setLayerStyles(prev => ({
            ...prev,
            [newLayerId]: {
                color: '#10D9A0',
                outlineColor: '#ffffff',
                outlineWidth: 2.5,
                opacity: 1,
                isPalStreet: true
            }
        }));

        setPalStreetStats(stats);
        setPalStreetLoading(false);
        setPalStreetProgress("");
        alert(`✅ تم رسم ${features.length} شارع بنجاح وتصنيفها كطبقة حية!`);
    };

    const handleExportLayer = (layer) => {
        try {
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
        if (drawingMode === 'palstreet_poly') {
            if (draftCoordinates.length > 2) {
                const polygonCoords = [[...draftCoordinates, draftCoordinates[0]]];
                let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
                draftCoordinates.forEach(([lng, lat]) => {
                    if (lng < minLng) minLng = lng;
                    if (lng > maxLng) maxLng = lng;
                    if (lat < minLat) minLat = lat;
                    if (lat > maxLat) maxLat = lat;
                });
                fetchPalStreetOSM(minLat, minLng, maxLat, maxLng, polygonCoords);
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

    const handleMapClick = (e) => {
        if (drawingMode) {
            const coord = [e.lngLat.lng, e.lngLat.lat];

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
            } else if (drawingMode === 'line' || drawingMode === 'measure' || drawingMode === 'polygon' || drawingMode === 'palstreet_poly') {
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
                        latitude: e.lngLat.lat
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
                    setSelectedFeatureInfo(null);
                    setHighlightFeatures([]);
                    setSelectedFeatures([]);
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

                const json = JSON.parse(event.target.result);
                if (json.type === 'FeatureCollection' || json.type === 'Feature') {
                    // الرفع للسيرفر (Cloudflare R2)
                    const apiUrl = window.location.origin === 'http://localhost:5173' ? 'http://localhost:5001' : '';
                    const response = await axios.post(`${apiUrl}/api/storage/upload`, {
                        geojson: json,
                        layerName: file.name
                    }, {
                        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                    });

                    if (response.data.success) {
                        const newLayerId = Date.now().toString();
                        const defaultColor = ['#06D6F2', '#F5A623', '#10D9A0', '#8B5CF6', '#EC4899'][geoLayers.length % 5];
                        
                        // تأكد من وجود معرفات لكل معلم
                        const geojsonData = response.data.geojson || json;
                        if (geojsonData.features) {
                            geojsonData.features = geojsonData.features.map((f, idx) => ({
                                ...f,
                                id: f.id || `${newLayerId}_${idx}`
                            }));
                        }

                        const newLayer = {
                            id: newLayerId,
                            name: file.name.substring(0, 19),
                            dataUrl: response.data.url,
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

                        // Fly to data
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
                                extractCoords(json);
                                if (coordinates.length > 0) {
                                    const lons = coordinates.map(c => c[0]);
                                    const lats = coordinates.map(c => c[1]);
                                    mapRef.current.fitBounds(
                                        [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]],
                                        { padding: 80, duration: 2000 }
                                    );
                                }
                            } catch (e) { console.error('Fit bounds error', e); }
                        }
                    }
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
            const apiUrl = window.location.origin === 'http://localhost:5173' ? 'http://localhost:5001' : '';
            let endpoint = '/api/storage/upload';
            let payload = { url: importLink };

            // إذا كان الرابط من ArcGIS
            if (importLink.includes('MapServer') || importLink.includes('FeatureServer')) {
                endpoint = '/api/storage/import-arcgis';
                payload = { arcgisUrl: importLink };
            }

            const response = await axios.post(`${apiUrl}${endpoint}`, payload, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });

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
                            const lons = coordinates.map(c => c[0]);
                            const lats = coordinates.map(c => c[1]);
                            mapRef.current.fitBounds(
                                [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]],
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
            const token = localStorage.getItem('token');
            const response = await axios.post('/api/storage/upload', { geojson, layerName }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return response.data.url;
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
        var gtype = geojson.features[0].geometry.type;
        
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
            // Use absolute URL if possible, or fallback to relative for proxy
            const apiUrl = window.location.origin === 'http://localhost:5173'
                ? 'http://localhost:5001'
                : '';

            const response = await axios.post(`${apiUrl}/api/ai/generate-design`, {
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
            const apiUrl = window.location.origin === 'http://localhost:5173' ? 'http://localhost:5001' : '';
            const token = localStorage.getItem('token');
            const response = await axios.post(`${apiUrl}/api/pages/save`, {
                name: publishName,
                slug: publishSlug,
                status: status,
                config: {
                    selections: designSelections,
                    elements: pageElements,
                    geoLayers: geoLayers,
                    layerStyles: layerStyles
                }
            }, {
                headers: {
                    Authorization: `Bearer ${token}`
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

            // Get custom style or default
            const style = layerStyles[layer.id] || {
                color: layer.color || '#F5A623',
                outlineColor: '#ffffff',
                outlineWidth: 2,
                shape: 'circle',
                opacity: 1,
                fillOpacity: 0.3
            };

            exportLayers.push({
                id: layer.id, name: layer.name, type: layer.type || 'vector',
                data: data,
                dataUrl: layer.dataUrl || layer.url, // Ensure we pass the URL for optimization
                coordinates: layer.coordinates, color: layer.color,
                style: style
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
            custom: { primary: designSelections.customPrimary, primaryDark: designSelections.customPrimary, bg: '#0A1628', surface: 'rgba(20, 43, 71, 0.7)', surfaceSolid: '#142B47', border: 'rgba(255, 255, 255, 0.08)', text: '#FFFFFF', primaryGlow: `${designSelections.customPrimary}44` }
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
            dark: 'https://cartodb-basemaps-a.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png',
            light: 'https://cartodb-basemaps-a.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png',
            satellite: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
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

        const layersHTML = exportLayers.map(l => `<div class="layer-item"><div style="display:flex;align-items:center;gap:10px;"><div style="width:14px;height:14px;border-radius:4px;background:${l.style?.color || l.color}"></div><span>${l.name}</span></div></div>`).join('');

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
            case 'three':
                layoutCSS = `
                    .app-container { display: flex; flex-direction: column; height: 100vh; width: 100vw; }
                    .top-nav { height: 60px; background: var(--surface-solid); border-bottom: 1px solid var(--border); display: flex; align-items: center; padding: 0 24px; z-index: 10; }
                    .main-content { flex: 1; display: flex; overflow: hidden; }
                    .left-panel { width: 300px; background: var(--surface-solid); border-left: 1px solid var(--border); padding: 20px; overflow-y: auto; }
                    #map { flex: 1; }
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
                        <div id="map"></div>
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
                            <div style="display:flex;gap:10px;">${exportLayers.slice(0, 3).map(l => `<span style="background:var(--bg);padding:5px 12px;border-radius:20px;font-size:0.8rem;border:1px solid ${l.style?.color || l.color}">${l.name}</span>`).join('')}</div>
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
                    .f-bottom-left { bottom: 40px; left: 30px; width: 400px; }
                `;
                layoutHTML = `
                    <div id="map"></div>
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
                    #map { height: 60%; width: 100%; border-bottom: 1px solid var(--border); }
                    .bottom-content { height: 40%; background: var(--surface-solid); padding: 24px; overflow-y: auto; }
                    .grid-view { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 20px; }
                `;
                layoutHTML = `
                    <div id="map"></div>
                    <div class="bottom-content card-panel">
                        <h2 style="color:var(--primary);margin-top:0;font-family:var(--font-h);">استعراض البيانات</h2>
                        <div class="grid-view">
                            ${exportLayers.map(l => `
                                <div class="layer-item" style="margin:0;">
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
                    #map { position: absolute; inset: 0; }
                `;
                layoutHTML = `
                    <div id="map"></div>
                `;
                break;
            default: // fullmap
                layoutCSS = `
                    .app-container { display: flex; height: 100vh; width: 100vw; }
                    #map { flex: 1; }
                `;
                layoutHTML = `
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
        .cel-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 16px; text-align: right; font-family: var(--font-b); }
        .cel-icon-wrap { display: flex; justify-content: center; }
        .cel-icon { width: 48px; height: 48px; }
        ` : '';

        const layersListHTML = exportLayers.map(l =>
            `<div class="cel-layer-row" onclick="map.fitBounds(${JSON.stringify(
                l.data?.features?.length > 0
                    ? (() => { try { const coords = (l.data?.features || []).flatMap(f => f.geometry?.type === 'Point' ? [f.geometry.coordinates] : f.geometry?.coordinates?.flat?.(5) || []); const lngs = coords.map(c => c[0]); const lats = coords.map(c => c[1]); return [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]]; } catch (e) { return null; } })()
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
            return `<div class="cel" style="${wStyle}">${inner}</div>`;
        }).join('\n            ')}
        </div>` : '';

        // 4. Helper to round coordinates to 6 decimal places (saves ~50% space)
        const roundCoords = (coords) => {
            if (typeof coords === 'number') return Math.round(coords * 1000000) / 1000000;
            if (Array.isArray(coords)) return coords.map(roundCoords);
            return coords;
        };

        // 5. Prepare optimized layers with full embedding for portability
        const optimizedLayers = exportLayers.map(l => {
            const clean = { ...l };
            if (clean.data && clean.data.features) {
                // Optimize each feature
                clean.data.features = clean.data.features.map(f => ({
                    ...f,
                    geometry: f.geometry ? {
                        ...f.geometry,
                        coordinates: roundCoords(f.geometry.coordinates)
                    } : null
                }));
            }
            return clean;
        });

        // 6. Calculate final bounds from optimized data
        let finalBounds = null;
        try {
            const allCoords = [];
            optimizedLayers.forEach(l => {
                if (l.data?.features) {
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
                const lngs = allCoords.map(c => c[0]);
                const lats = allCoords.map(c => c[1]);
                finalBounds = [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]];
            }
        } catch (e) { console.error("Bounds calc error", e); }

        // 7. Generate HTML Template
        const htmlTemplate = `<!DOCTYPE html>
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
        #map { flex: 1; min-height: 400px; height: 100%; width: 100%; background: #000; }

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
    <div class="app-container" style="position:relative; height: 100vh; width: 100vw; display: flex; flex-direction: column;">
        ${layoutHTML}
        ${customElsHTML}
    </div>
    <div style="position:fixed;bottom:5px;right:8px;z-index:1000;font-size:11px;color:rgba(255,255,255,0.65);text-shadow:0 0 3px rgba(0,0,0,0.6);pointer-events:none;font-family:sans-serif;">Designed in PalNovaa Studio</div>

    <script>
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
                bearing: ${bearing}
            });

            if (initialBounds) {
                map.fitBounds(initialBounds, { padding: 50, animate: false });
            }

            map.addControl(new maplibregl.NavigationControl(), 'bottom-right');

            // Push navigation control above the browser status bar
            const style = document.createElement('style');
            style.textContent = '.maplibregl-ctrl-bottom-right { bottom: 30px !important; }';
            document.head.appendChild(style);

            // Search function for custom search element
            window.doSearch = function(query) {
                const results = document.getElementById('search-results');
                if (!results) return;
                if (!query.trim()) { results.style.display = 'none'; return; }
                const found = [];
                // Search only works if data is embedded or after loading
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
                    return '<div class="cel-search-item" onclick="flyToFeature(' + i + ')">' + label + '</div>';
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
                
                // Function to generate and add shape icons to the map
                const addShapeIcon = (name, svgPath) => {
                    const canvas = document.createElement('canvas');
                    canvas.width = 64; canvas.height = 64;
                    const ctx = canvas.getContext('2d');
                    const path = new Path2D(svgPath);
                    ctx.translate(32, 32);
                    ctx.scale(2, 2);
                    ctx.translate(-12, -12); // Center a 24x24 path
                    ctx.fillStyle = '#ffffff'; // We use white and 'icon-color' paint property
                    ctx.fill(path);
                    const imageData = ctx.getImageData(0, 0, 64, 64);
                    map.addImage('shape-' + name, imageData, { sdf: true });
                };

                // Add our custom shapes
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

                    // PRIORITIZE EMBEDDED DATA: Use embedded data if available (best for portability)
                    const sourceData = layer.data || layer.dataUrl;
                    if (!sourceData) {
                        console.warn("No data for layer:", layer.name);
                        return;
                    }

                    map.addSource('src-' + layer.id, { type: 'geojson', data: sourceData });
                        
                    // Polygons
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
                    
                    // Lines
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
                    
                    // Points
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
                        // For non-circle shapes, we use the symbol layer with our generated icons
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

                    // Cursor pointers
                    ['poly-' + layer.id, 'line-' + layer.id, 'point-' + layer.id].forEach(id => {
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
            });
        } catch (e) {
            console.error("Critical Map Error:", e);
            document.body.innerHTML += '<div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(239,68,68,0.9);color:white;padding:30px;border-radius:20px;text-align:center;z-index:9999;box-shadow:0 20px 50px rgba(0,0,0,0.5);"><h2>عذراً، حدث خطأ في تحميل الخريطة</h2><p>' + e.message + '</p></div>';
        }
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
                                <path d="M9 2h6" />
                                <path d="M10 2v7.5L4.5 19a2 2 0 0 0 1.7 3h11.6a2 2 0 0 0 1.7-3L14 9.5V2" />
                                <path d="M7 16h10" />
                                <circle cx="11" cy="14" r="0.6" fill="currentColor" />
                                <circle cx="13.5" cy="17" r="0.5" fill="currentColor" />
                                <circle cx="9.5" cy="18" r="0.5" fill="currentColor" />
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
                                <path d="M9 2h6" />
                                <path d="M10 2v7.5L4.5 19a2 2 0 0 0 1.7 3h11.6a2 2 0 0 0 1.7-3L14 9.5V2" />
                                <path d="M7 16h10" />
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

                    <button className={`tool ${activeTab === 'palstreet' ? 'active' : ''}`} data-tip="استخراج شوارع PalStreet 🛣️" onClick={() => { setActiveTab('palstreet'); setDrawingMode(null); }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#ffca28' }}>
                            <path d="M6 3v18M18 3v18M12 3v4M12 10v4M12 17v4" />
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
                        >
                            <NavigationControl position="bottom-right" />

                            {geoLayers.filter(l => l.isVisible !== false).map(layer => {
                                const style = layerStyles[layer.id] || {
                                    color: layer.color || '#F5A623',
                                    outlineColor: '#ffffff',
                                    outlineWidth: 2,
                                    shape: 'circle',
                                    opacity: 1,
                                    fillOpacity: 0.3
                                };

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

                                return (
                                    <Source key={layer.id} id={`src-${layer.id}`} type="geojson" data={layer.data}>
                                        {/* Polygons */}
                                        <Layer
                                            id={`poly-${layer.id}`}
                                            type="fill"
                                            filter={['==', '$type', 'Polygon']}
                                            paint={{
                                                'fill-color': style.color,
                                                'fill-opacity': (style.fillOpacity ?? 0.3) * (style.opacity ?? 1),
                                                'fill-outline-color': style.outlineColor
                                            }}
                                        />
                                        <Layer
                                            id={`poly-line-${layer.id}`}
                                            type="line"
                                            filter={['==', '$type', 'Polygon']}
                                            paint={{
                                                'line-color': style.outlineColor,
                                                'line-width': style.outlineWidth,
                                                'line-opacity': style.opacity ?? 1
                                            }}
                                        />

                                        {/* Lines */}
                                        <Layer
                                            id={`line-${layer.id}`}
                                            type="line"
                                            filter={['==', '$type', 'LineString']}
                                            paint={{
                                                'line-color': layer.isPalStreet ? [
                                                    'match',
                                                    ['coalesce', ['get', 'highway'], ''],
                                                    'motorway', '#ef5350', 'motorway_link', '#ef5350',
                                                    'trunk', '#ff7043', 'trunk_link', '#ff7043',
                                                    'primary', '#ffca28', 'primary_link', '#ffca28',
                                                    'secondary', '#66bb6a', 'secondary_link', '#66bb6a',
                                                    'tertiary', '#26c6da', 'tertiary_link', '#26c6da',
                                                    'residential', '#42a5f5',
                                                    'service', '#b0bec5',
                                                    'footway', '#ab47bc', 'pedestrian', '#ab47bc', 'path', '#ab47bc', 'cycleway', '#ab47bc',
                                                    style.color || '#10D9A0'
                                                ] : style.color,
                                                'line-width': layer.isPalStreet ? [
                                                    'match',
                                                    ['coalesce', ['get', 'highway'], ''],
                                                    'motorway', 6.0,
                                                    'trunk', 5.0,
                                                    'primary', 4.5,
                                                    'secondary', 3.5,
                                                    'tertiary', 2.5,
                                                    'residential', 2.0,
                                                    'service', 1.5,
                                                    'footway', 1.2, 'pedestrian', 1.2, 'path', 1.0, 'cycleway', 1.0,
                                                    (style.outlineWidth ?? 2) * 2
                                                ] : (style.outlineWidth ?? 2) * 2,
                                                'line-opacity': style.opacity ?? 1
                                            }}
                                        />

                                        {/* Points */}
                                        <Layer
                                            id={`point-${layer.id}`}
                                            type="circle"
                                            filter={['==', '$type', 'Point']}
                                            paint={{
                                                'circle-radius': layer.isRemoteSensing ? [
                                                    'interpolate',
                                                    ['linear'],
                                                    ['zoom'],
                                                    10, 4,
                                                    14, 12,
                                                    17, 30
                                                ] : 7,
                                                'circle-color': layer.isRemoteSensing ? [
                                                    'interpolate',
                                                    ['linear'],
                                                    ['get', 'elevation'],
                                                    layer.minElevation || 0, '#312e81',
                                                    (layer.minElevation + layer.maxElevation)/2 || 100, '#10b981',
                                                    layer.maxElevation || 500, '#ef4444'
                                                ] : style.color,
                                                'circle-stroke-width': style.outlineWidth,
                                                'circle-stroke-color': style.outlineColor,
                                                'circle-opacity': style.opacity ?? 1,
                                                'circle-stroke-opacity': style.opacity ?? 1
                                            }}
                                        />
                                    </Source>
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
                                            {selectedFeatureInfo.properties.dataset === 'aster30m' ? 'نقطة ارتفاع (ASTER GDEM)' : (selectedFeatureInfo.properties.name || selectedFeatureInfo.properties.name_ar || selectedFeatureInfo.properties.name_en || 'شارع بدون اسم')}
                                        </h4>
                                        <div className="popup-body" style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
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
                                            ) : selectedFeatureInfo.properties.highway ? (
                                                <>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
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
                        </Map>
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
                        <div className={`panel-tab ${activeTab === 'palstreet' ? 'active' : ''}`} onClick={() => setActiveTab('palstreet')} title="PalStreet">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 3v18M18 3v18M12 3v4M12 10v4M12 17v4" /></svg>
                        </div>
                        <div className={`panel-tab ${activeTab === 'palremotesensing' ? 'active' : ''}`} onClick={() => { setActiveTab('palremotesensing'); setDrawingMode(null); }} title="PalRemoteSensing (استشعار عن بعد)">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="11" width="18" height="6" rx="2" />
                                <path d="M12 2v9M8 2h8M12 17v5M5 11V7a3 3 0 0 1 6 0v4M13 11V7a3 3 0 0 1 6 0v4" />
                            </svg>
                        </div>
                    </div>

                    <div className="panel-content">
                        {activeTab === 'layers' && (
                            <div className="tab-content">
                                <div className="panel-section">
                                    <div className="panel-section-title">إضافة بيانات</div>

                                    <div className="upload-box" onClick={() => document.getElementById('geo-upload').click()}>
                                        <input id="geo-upload" type="file" accept=".geojson,.json,.csv" onChange={handleFileUpload} style={{ display: 'none' }} />
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                                        </svg>
                                        <span>رفع ملف GeoJSON أو CSV</span>
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
                                                                const baseId = layer.id.replace('-raster', '').replace('-points', '');
                                                                setGeoLayers(prev => prev.filter(l => l.id !== layer.id && l.id !== `${baseId}-points` && l.id !== `${baseId}-raster`)); 
                                                                setLayerStyles(prev => { 
                                                                    const n = { ...prev }; 
                                                                    delete n[layer.id]; 
                                                                    delete n[`${baseId}-points`]; 
                                                                    delete n[`${baseId}-raster`]; 
                                                                    return n; 
                                                                }); 
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

                        {activeTab === 'palstreet' && (
                            <div className="tab-content" style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%', overflowY: 'auto' }}>
                                <div className="panel-section">
                                    <div className="panel-section-title">استخراج شوارع PalStreet 🛣️</div>


                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        <button
                                            className="ds-btn secondary w-100"
                                            disabled={palStreetLoading}
                                            onClick={() => {
                                                const map = mapRef.current?.getMap();
                                                if (map) {
                                                    const bounds = map.getBounds();
                                                    fetchPalStreetOSM(bounds.getSouth(), bounds.getWest(), bounds.getNorth(), bounds.getEast());
                                                }
                                            }}
                                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px' }}
                                        >
                                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/></svg>
                                            جلب من حدود الشاشة الحالية
                                        </button>

                                        <button
                                            className={`ds-btn ${drawingMode === 'palstreet_poly' ? 'primary' : 'outline'} w-100`}
                                            disabled={palStreetLoading}
                                            onClick={() => {
                                                if (drawingMode === 'palstreet_poly') {
                                                    setDrawingMode(null);
                                                    setDraftCoordinates([]);
                                                } else {
                                                    setDrawingMode('palstreet_poly');
                                                    setDraftCoordinates([]);
                                                }
                                            }}
                                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px' }}
                                        >
                                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/></svg>
                                            {drawingMode === 'palstreet_poly' ? 'إلغاء الرسم المخصص' : 'رسم منطقة مخصصة (مضلع)'}
                                        </button>
                                    </div>
                                </div>

                                {palStreetLoading && (
                                    <div className="palstreet-progress-card" style={{ padding: '15px', background: 'rgba(6, 214, 242, 0.05)', border: '1px solid rgba(6, 214, 242, 0.2)', borderRadius: '12px', textAlign: 'center' }}>
                                        <div className="loader-ring-small" style={{ margin: '0 auto 10px auto', width: '30px', height: '30px', border: '3px solid rgba(6, 214, 242, 0.1)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'ring-spin 1s linear infinite' }}></div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 'bold' }}>{palStreetProgress}</div>
                                    </div>
                                )}

                                {palStreetStats && (
                                    <div className="panel-section palstreet-stats-panel">
                                        <div className="panel-section-title">دليل وإحصائيات الشوارع 📊</div>
                                        <div className="stats-grid" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                                            {[
                                                { key: 'motorway', label: 'طرق سريعة (Motorway)', color: '#ef5350' },
                                                { key: 'trunk', label: 'طرق شريانية كبرى (Trunk)', color: '#ff7043' },
                                                { key: 'primary', label: 'طرق رئيسية (Primary)', color: '#ffca28' },
                                                { key: 'secondary', label: 'طرق ثانوية (Secondary)', color: '#66bb6a' },
                                                { key: 'tertiary', label: 'طرق فرعية (Tertiary)', color: '#26c6da' },
                                                { key: 'residential', label: 'شوارع سكنية (Residential)', color: '#42a5f5' },
                                                { key: 'service', label: 'طرق خدمات ومواقف (Service)', color: '#b0bec5' },
                                                { key: 'footway', label: 'ممرات مشاة وتراسات (Footway/Paths)', color: '#ab47bc' },
                                                { key: 'other', label: 'أخرى (Other)', color: '#e0e0e0' }
                                            ].map(item => (
                                                <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', background: item.color, boxShadow: `0 0 8px ${item.color}` }}></span>
                                                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{item.label}</span>
                                                    </div>
                                                    <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>{palStreetStats[item.key] || 0}</span>
                                                </div>
                                            ))}
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: '8px', fontWeight: 'bold' }}>
                                                <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>مجموع الشوارع المستخرجة:</span>
                                                <span style={{ color: 'var(--primary)' }}>
                                                    {Object.values(palStreetStats).reduce((a, b) => a + b, 0)}
                                                </span>
                                            </div>
                                        </div>

                                        <button
                                            className="ds-btn primary w-100"
                                            style={{ marginTop: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                            onClick={() => {
                                                const palLayer = geoLayers.find(l => l.isPalStreet);
                                                if (palLayer) {
                                                    handleExportLayer(palLayer);
                                                } else {
                                                    alert("⚠️ لم يتم العثور على طبقة PalStreet للتصدير.");
                                                }
                                            }}
                                        >
                                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                                            تصدير طبقة الشوارع (GeoJSON)
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'palremotesensing' && (
                            <div className="tab-content" style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%', overflowY: 'auto' }}>
                                <div className="panel-section">
                                    <div className="panel-section-title">الاستشعار عن بعد (ASTER GDEM 30m) 🛰️</div>
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
                                            <option value="raster">راستر مستمر (DEM Raster - Bilinear) 🗺️</option>
                                            <option value="points">شبكة نقاط ملونة (Point Grid) 📍</option>
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
                                                    تحميل البيانات كملف CSV 📊
                                                </button>
                                                <button
                                                    className="ds-btn secondary w-100"
                                                    onClick={() => exportAsterToGeoJSON(activeLayer)}
                                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px', fontSize: '0.85rem' }}
                                                >
                                                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                                                    تحميل البيانات كملف GeoJSON 📥
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })()}
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
                                <path fill="white" opacity="0.9" d="M12.005,18.932C9.611,17.55,8,14.963,8,12c0-4.418,3.582-8,8-8s8,3.582,8,8 c0,2.963-1.606,5.55-4,6.932V21.5c0,0.276-0.224,0.5-0.5,0.5H18v-5.134c0.163-0.392,1.415-2.609,1.415-2.609 c0.271-0.457,0.275-1.033,0.01-1.499C19.158,12.29,18.658,12,18.12,12h-4.24c-0.538,0-1.038,0.29-1.305,0.758 c-0.266,0.466-0.261,1.043,0.013,1.505L14,16.866V22h-1.5c-0.276,0-0.5-0.224-0.5-0.5L12.005,18.932z M17,22v-5.271 c0-0.323,1.552-2.977,1.552-2.977C18.749,13.419,18.507,13,18.12,13h-4.24c-0.387,0-0.629,0.419-0.431,0.753 c0,0,1.552,2.652,1.552,2.977V22H17z" />
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
                        <button className="ds-btn primary" onClick={performActualExport}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '18px', height: '18px' }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                            تصدير كملف HTML
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
                            { id: 'palettes', label: 'لوحات الألوان', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" /></svg>, count: 8 },
                            { id: 'typography', label: 'الخطوط', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 7 4 4 20 4 20 7" /><line x1="9" y1="20" x2="15" y2="20" /><line x1="12" y1="4" x2="12" y2="20" /></svg>, count: 6 },
                            { id: 'basemaps', label: 'الخرائط', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" /></svg>, count: 6 },
                            { id: 'effects', label: 'التأثيرات', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>, count: 9 },
                            { id: 'builder', label: 'منشئ الصفحة', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18M3 9h6M3 15h6M15 9h6M15 15h6" /></svg>, count: pageElements.length || '+' },
                            { id: 'settings', label: 'الإعدادات', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1V15a2 2 0 0 1-2-2 2 2 0 0 1 2-2v-.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2v.09a1.65 1.65 0 0 0-1.51 1z" /></svg>, count: 'Pro' }
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
                                        { id: 'minimal', title: 'بسيط', sub: 'بساطة وأناقة', colors: ['#FFFFFF', '#F5F4ED', '#E5E5E5', '#1A1A2E', '#F5A623'] }
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
                                        { id: 'dark', title: 'النمط الداكن', sub: 'داكن أنيق · للتطبيقات الحديثة', type: 'bm-dark', provider: 'MAPTILER' },
                                        { id: 'light', title: 'النمط الفاتح', sub: 'فاتح ونظيف · للقراءة الواضحة', type: 'bm-light', provider: 'MAPTILER' },
                                        { id: 'satellite', title: 'قمر صناعي', sub: 'صور أقمار صناعية', type: 'bm-satellite', provider: 'GOOGLE' },
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
                                        { id: 'show_controls', label: 'إظهار أدوات التحكم (Zoom)', icon: '🧭' },
                                        { id: 'show_attribution', label: 'إظهار حقوق الملكية', icon: 'ℹ️' },
                                        { id: 'enable_popups', label: 'تفعيل النوافذ المنبثقة', icon: '💬' },
                                        { id: 'auto_rotate', label: 'دوران تلقائي (Cinematic)', icon: '🔄' }
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
                                                        { type: 'layers', label: 'متحكم طبقات', preview: '⊞' }
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
                                    {designSelections.layout === 'modal' ? (
                                        <div className="lm-modal-frame">
                                            <div className="lm-modal-bar"></div>
                                            <div className="lm-map">
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="lm-map">
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
                                        </>
                                    )}
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
