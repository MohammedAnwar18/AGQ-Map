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

    // Geoportal Custom Splash Overlay State
    const [showSplashOverlay, setShowSplashOverlay] = useState(true);
    const [splashFading, setSplashFading] = useState(false);
    const [progressPercent, setProgressPercent] = useState(25);
    const [statusText, setStatusText] = useState('جاري الاتصال بالنظام الجغرافي لبلدية بيرزيت...');

    // Live Coordinates & Projection System
    const [cursorCoords, setCursorCoords] = useState({ lat: 31.9038, lng: 35.2034 });
    const [mapScale, setMapScale] = useState('1 : 25,000');
    const [currentZoom, setCurrentZoom] = useState(13);
    const [selectedCrs, setSelectedCrs] = useState('28191'); // '28191' (Palestine Grid) | '2039' (Israeli Grid) | '4326' (Lat/Long)
    const [showCrsMenu, setShowCrsMenu] = useState(false);

    // Helper for case-insensitive property lookup
    const getFieldValue = (props, targetField) => {
        if (!props || !targetField) return null;
        if (props[targetField] !== undefined && props[targetField] !== null) return props[targetField];
        const matchKey = Object.keys(props).find(k => k.toLowerCase() === targetField.toLowerCase());
        return matchKey ? props[matchKey] : null;
    };

    // Helper to calculate true polygon geometric centroid (heart of feature)
    const getTruePolygonCentroid = (feature) => {
        if (!feature || !feature.geometry) return null;
        const geom = feature.geometry;
        let coords = geom.coordinates;

        if (geom.type === 'Point') {
            return [coords[1], coords[0]];
        }
        if (geom.type === 'Polygon') {
            coords = coords[0];
        } else if (geom.type === 'MultiPolygon') {
            let maxLen = 0;
            let largestPoly = coords[0][0];
            coords.forEach(poly => {
                if (poly[0].length > maxLen) {
                    maxLen = poly[0].length;
                    largestPoly = poly[0];
                }
            });
            coords = largestPoly;
        } else if (geom.type === 'LineString') {
            const mid = Math.floor(coords.length / 2);
            return [coords[mid][1], coords[mid][0]];
        } else {
            return null;
        }

        if (!coords || !coords.length) return null;
        let latSum = 0, lngSum = 0;
        coords.forEach(pt => {
            lngSum += pt[0];
            latSum += pt[1];
        });
        return [latSum / coords.length, lngSum / coords.length];
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
    const [showToolsBar, setShowToolsBar] = useState(false);
    const [activeTool, setActiveTool] = useState(null); // 'distance' | 'area' | 'search'
    const [measureData, setMeasureData] = useState(null);
    const [savedMeasures, setSavedMeasures] = useState([]); // 📌 List of finalized measurements
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedFeatureProps, setSelectedFeatureProps] = useState(null);

    // 🔑 Refs to hold LIVE values inside map event closures (avoid stale closure)
    const activeToolRef = useRef(null);
    const measureColorRef = useRef('#06D6F2');

    // Map refs
    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const featureGroupsRef = useRef({});
    const labelsLayerGroupRef = useRef(null);
    const measureLayerGroupRef = useRef(null);
    const previewLayerRef = useRef(null);      // 🔄 Rubber-band preview layer (live line to cursor)
    const measurePointsRef = useRef([]);
    const dblclickGuardRef = useRef(false);   // 🚫 Prevents click firing during dblclick
    const layerDataCache = useRef({});
    const hasFittedBoundsRef = useRef(false);

    // ✅ أداة تحديد الموقع بالـ GPS المباشر
    const handleLocateUser = useCallback(() => {
        if (!mapInstance.current) return;
        mapInstance.current.locate({ setView: true, maxZoom: 18, enableHighAccuracy: true });
        mapInstance.current.once('locationfound', (e) => {
            const radius = e.accuracy;
            L.circle(e.latlng, radius, { color: '#06D6F2', fillColor: '#06D6F2', fillOpacity: 0.15, weight: 2 }).addTo(mapInstance.current);
            L.circleMarker(e.latlng, {
                radius: 9,
                fillColor: '#06D6F2',
                color: '#FFFFFF',
                weight: 3,
                opacity: 1,
                fillOpacity: 1
            }).addTo(mapInstance.current);
        });
        mapInstance.current.once('locationerror', () => {
            alert('يرجى التثبت من إعطاء الصلاحية لخيار تحديد الموقع (GPS) بالمتصفح');
        });
    }, []);

    const [measureColor, setMeasureColor] = useState('#06D6F2');

    // Keep refs in sync with state every render
    activeToolRef.current = activeTool;
    measureColorRef.current = measureColor;

    // ✅ مسح وتفريغ رسومات وأرقام أداة القياس (كل شيء)
    const clearMeasurements = useCallback(() => {
        if (measureLayerGroupRef.current) {
            measureLayerGroupRef.current.clearLayers();
        }
        // Also clear rubber-band ghost
        if (previewLayerRef.current) {
            previewLayerRef.current.remove();
            previewLayerRef.current = null;
        }
        measurePointsRef.current = [];
        setMeasureData(null);
        setSavedMeasures([]);
    }, []);

    // 📌 Finalize current measurement — save it to the list and start fresh
    const finalizeMeasurement = useCallback(() => {
        const tool = activeToolRef.current;
        const pts = measurePointsRef.current;
        const color = measureColorRef.current;
        if (!tool || pts.length < 2) return;
        if (tool === 'area' && pts.length < 3) return;

        // Build a summary object from the drawn points
        let summary = null;
        if (tool === 'distance') {
            let totalDist = 0;
            for (let i = 0; i < pts.length - 1; i++) totalDist += pts[i].distanceTo(pts[i + 1]);
            const val = totalDist >= 1000 ? `${(totalDist / 1000).toFixed(2)} كم` : `${totalDist.toFixed(1)} م`;
            summary = { id: Date.now(), type: 'مسافة', value: val, color, pts: [...pts] };
        } else if (tool === 'area') {
            const radius = 6378137;
            let area = 0;
            for (let i = 0; i < pts.length; i++) {
                const p1 = pts[i]; const p2 = pts[(i + 1) % pts.length];
                area += (p2.lng - p1.lng) * (Math.PI / 180) * (2 + Math.sin(p1.lat * Math.PI / 180) + Math.sin(p2.lat * Math.PI / 180));
            }
            area = Math.abs((area * radius * radius) / 2);
            const dunam = (area / 1000).toFixed(2);
            const val = `${area.toFixed(1)} م² (‎${dunam} دونم)`;
            summary = { id: Date.now(), type: 'مساحة', value: val, color, pts: [...pts] };
        }

        if (summary) setSavedMeasures(prev => [...prev, summary]);

        // Reset points for next fresh measurement — keep the drawn lines on map
        measurePointsRef.current = [];
        setMeasureData(null);

        // Clear rubber-band
        if (previewLayerRef.current) {
            previewLayerRef.current.remove();
            previewLayerRef.current = null;
        }
    }, []);

    // ✅ دالة حساب مساحة المضلع (Spherical Polygon Area)
    const calculatePolygonArea = (latlngs) => {
        if (!latlngs || latlngs.length < 3) return 0;
        const radius = 6378137;
        let area = 0;
        const len = latlngs.length;
        for (let i = 0; i < len; i++) {
            const p1 = latlngs[i];
            const p2 = latlngs[(i + 1) % len];
            area += (p2.lng - p1.lng) * (Math.PI / 180) * (2 + Math.sin(p1.lat * Math.PI / 180) + Math.sin(p2.lat * Math.PI / 180));
        }
        area = Math.abs((area * radius * radius) / 2);
        return area;
    };

    // ✅ اعادة رسم خطوط ومضلعات القياس فوراً بستايل GeoJSON فاقع تفاعلي
    const redrawMeasurementsWithColor = (newColor, pts, tool) => {
        if (!measureLayerGroupRef.current || !pts || !pts.length) return;
        measureLayerGroupRef.current.clearLayers();

        // 1. بناء الـ GeoJSON Feature الصريح
        let geojsonFeature = null;
        if (tool === 'distance' && pts.length > 1) {
            geojsonFeature = {
                type: 'Feature',
                geometry: {
                    type: 'LineString',
                    coordinates: pts.map(p => [p.lng, p.lat])
                },
                properties: { title: 'مسافة مكانية' }
            };
        } else if (tool === 'area' && pts.length >= 3) {
            geojsonFeature = {
                type: 'Feature',
                geometry: {
                    type: 'Polygon',
                    coordinates: [[...pts.map(p => [p.lng, p.lat]), [pts[0].lng, pts[0].lat]]]
                },
                properties: { title: 'مساحة مكانية' }
            };
        }

        // 2. رسم الـ GeoJSON على الخريطة
        if (geojsonFeature) {
            const geoLayer = L.geoJSON(geojsonFeature, {
                style: () => ({
                    color: newColor,
                    weight: 4,
                    dashArray: tool === 'distance' ? '6, 6' : null,
                    fillColor: newColor,
                    fillOpacity: tool === 'area' ? 0.38 : 0,
                    opacity: 0.95
                })
            });
            measureLayerGroupRef.current.addLayer(geoLayer);
        }

        // 3. رسم نقاط التثبيت الدائرية المتوهجة (Corner Control Nodes)
        pts.forEach((p, idx) => {
            const nodeMarker = L.circleMarker(p, {
                radius: 4,
                fillColor: newColor,
                color: '#FFFFFF',
                weight: 2,
                fillOpacity: 1
            });
            nodeMarker.bindTooltip(`محطة #${idx + 1}`, { permanent: false, direction: 'top' });
            measureLayerGroupRef.current.addLayer(nodeMarker);
        });

        // 4. حساب بطاقات المسافات الإضافية فوق كل قطعة خط عائم
        if (tool === 'distance' && pts.length > 1) {
            let totalDist = 0;
            for (let i = 0; i < pts.length - 1; i++) {
                const segDist = pts[i].distanceTo(pts[i + 1]);
                totalDist += segDist;
                const midLat = (pts[i].lat + pts[i + 1].lat) / 2;
                const midLng = (pts[i].lng + pts[i + 1].lng) / 2;
                const segText = segDist >= 1000 ? `${(segDist / 1000).toFixed(2)} كم` : `${segDist.toFixed(0)} م`;

                const segMarker = L.marker([midLat, midLng], {
                    icon: L.divIcon({
                        className: 'onmap-measure-segment-label',
                        html: `<div style="color: #FFF; font-weight: 800; font-size: 12px; white-space: nowrap; text-shadow: 0 0 4px rgba(0,0,0,0.9), -1px -1px 0 rgba(0,0,0,0.8), 1px -1px 0 rgba(0,0,0,0.8), -1px 1px 0 rgba(0,0,0,0.8), 1px 1px 0 rgba(0,0,0,0.8);">${segText}</div>`,
                        iconSize: [0, 0],
                        iconAnchor: [0, 0]
                    }),
                    interactive: false
                });
                measureLayerGroupRef.current.addLayer(segMarker);
            }
            const distText = totalDist >= 1000 ? `${(totalDist / 1000).toFixed(2)} كم` : `${totalDist.toFixed(1)} متر`;
            const lastPt = pts[pts.length - 1];
            setMeasureData({
                type: 'مسافة 📏 (LineString)',
                value: distText,
                secondaryValue: totalDist >= 1000 ? `${totalDist.toFixed(1)} متر` : `${(totalDist / 1000).toFixed(3)} كم`,
                pointsCount: pts.length,
                lastCoords: `${lastPt.lat.toFixed(5)}, ${lastPt.lng.toFixed(5)}`
            });
        } else if (tool === 'area' && pts.length >= 3) {
            const areaSqM = calculatePolygonArea(pts);
            const dunam = (areaSqM / 1000).toFixed(2);
            const hectare = (areaSqM / 10000).toFixed(3);
            // On-map label: show only m² (clean, no dunams)
            const areaLabelText = `${areaSqM.toFixed(1)} م²`;
            // Stats card: show full details
            const areaText = `${areaSqM.toFixed(1)} م² (${dunam} دونم)`;

            let latSum = 0, lngSum = 0;
            pts.forEach(p => { latSum += p.lat; lngSum += p.lng; });
            const centroid = [latSum / pts.length, lngSum / pts.length];

            const areaMarker = L.marker(centroid, {
                icon: L.divIcon({
                    className: 'onmap-measure-area-label',
                    html: `<div style="color: #FFF; font-weight: 800; font-size: 13px; white-space: nowrap; text-shadow: 0 0 4px rgba(0,0,0,0.95), -1px -1px 0 rgba(0,0,0,0.85), 1px -1px 0 rgba(0,0,0,0.85), -1px 1px 0 rgba(0,0,0,0.85), 1px 1px 0 rgba(0,0,0,0.85);">${areaLabelText}</div>`,
                    iconSize: [0, 0],
                    iconAnchor: [0, 0]
                }),
                interactive: false
            });
            measureLayerGroupRef.current.addLayer(areaMarker);

            const lastPt = pts[pts.length - 1];
            setMeasureData({
                type: 'مساحة 📐 (Polygon)',
                value: areaText,
                secondaryValue: `${hectare} هكتار`,
                pointsCount: pts.length,
                lastCoords: `${lastPt.lat.toFixed(5)}, ${lastPt.lng.toFixed(5)}`
            });
        }
    };

    // ✅ تفاعل النقر المباشر على الخريطة أثناء تفعيل أداة القياس
    // Using refs to avoid stale closure + dblclick guard to skip duplicate clicks
    const handleMapClickForMeasurement = useCallback((e) => {
        if (dblclickGuardRef.current) return; // skip clicks fired during dblclick
        const tool = activeToolRef.current;
        const color = measureColorRef.current;
        if (!tool || (tool !== 'distance' && tool !== 'area')) return;
        if (!measureLayerGroupRef.current || !mapInstance.current) return;

        const pt = e.latlng;
        measurePointsRef.current.push(pt);
        redrawMeasurementsWithColor(color, measurePointsRef.current, tool);
    }, []);

    // ✨ Live rubber-band: draws a ghost line from last point to mouse cursor
    const handleMouseMoveForMeasurement = useCallback((e) => {
        const tool = activeToolRef.current;
        const color = measureColorRef.current;
        const pts = measurePointsRef.current;
        if (!tool || (tool !== 'distance' && tool !== 'area')) return;
        if (!pts.length || !measureLayerGroupRef.current || !mapInstance.current) return;

        // Clear previous preview
        if (previewLayerRef.current) {
            previewLayerRef.current.remove();
            previewLayerRef.current = null;
        }

        const lastPt = pts[pts.length - 1];
        const cursor = e.latlng;
        const liveDistance = lastPt.distanceTo(cursor);
        const liveText = liveDistance >= 1000
            ? `${(liveDistance / 1000).toFixed(2)} كم`
            : `${liveDistance.toFixed(0)} م`;

        // Ghost dashed line from last committed point to cursor
        const previewGroup = L.featureGroup();

        // Draw ghost line
        L.polyline([lastPt, cursor], {
            color: color,
            weight: 3,
            dashArray: '8, 6',
            opacity: 0.7
        }).addTo(previewGroup);

        // Live distance counter floating label near cursor
        L.marker(cursor, {
            icon: L.divIcon({
                className: 'measure-live-preview-label',
                html: `<div style="color:#FFF; font-weight:900; font-size:13px; white-space:nowrap;
                    text-shadow: 0 0 4px rgba(0,0,0,1), -1px -1px 0 rgba(0,0,0,0.9), 1px -1px 0 rgba(0,0,0,0.9),
                    -1px 1px 0 rgba(0,0,0,0.9), 1px 1px 0 rgba(0,0,0,0.9);
                    transform: translate(10px,-10px)">${liveText}</div>`,
                iconSize: [0, 0],
                iconAnchor: [0, 0]
            }),
            interactive: false
        }).addTo(previewGroup);

        previewLayerRef.current = previewGroup.addTo(mapInstance.current);
    }, []);

    // 1. Resolve & Fetch Portal Data
    useEffect(() => {
        loadPortalData();
    }, [slug]);

    const loadPortalData = async () => {
        try {
            setLoading(true);
            setProgressPercent(25);
            setStatusText('جاري الاتصال بالسيرفر الجغرافي لبلدية بيرزيت...');

            const url = slug
                ? `/api/geoportals/public/resolve?slug=${slug}`
                : `/api/geoportals/public/resolve`;

            const res = await axios.get(url);
            const data = res.data;
            setPortal(data);
            const layerArr = Array.isArray(data.layers) ? data.layers : [];
            setLayers(layerArr);

            const allLayerIds = new Set(layerArr.map(l => l.id));
            setVisibleLayerIds(allLayerIds);

            setProgressPercent(65);
            setStatusText('جاري قراءة المخططات والطبقات المكانية...');
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
                zoomControl: false,
                preferCanvas: true
            });

            // Google Maps Plain Satellite (بدون كتابات ولا أسماء — سادة ناصعة)
            L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
                attribution: '© Google Maps',
                maxZoom: 21,
                subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
            }).addTo(mapInstance.current);

            // مجموعة طبقة المسميات المستقلة لتجنب التكرار
            labelsLayerGroupRef.current = L.featureGroup().addTo(mapInstance.current);
            measureLayerGroupRef.current = L.featureGroup().addTo(mapInstance.current);

            // Listen to mousemove for live coordinates + rubber-band preview
            mapInstance.current.on('mousemove', (e) => {
                setCursorCoords({ lat: e.latlng.lat, lng: e.latlng.lng });
                handleMouseMoveForMeasurement(e);
            });

            // Listen to map click for live GIS measurement
            mapInstance.current.on('click', (e) => {
                // Clear rubber-band ghost on each committed click
                if (previewLayerRef.current) {
                    previewLayerRef.current.remove();
                    previewLayerRef.current = null;
                }
                handleMapClickForMeasurement(e);
            });

            // 📌 Double-click = finalize & save the current measurement
            mapInstance.current.on('dblclick', (e) => {
                L.DomEvent.stop(e); // prevent map zoom on dblclick
                // Set guard to block the 2 extra click events fired by dblclick
                dblclickGuardRef.current = true;
                setTimeout(() => { dblclickGuardRef.current = false; }, 400);
                finalizeMeasurement();
            });

            // Listen to zoomend for live map scale & smart label re-rendering
            mapInstance.current.on('zoomend', () => {
                const z = mapInstance.current.getZoom();
                setCurrentZoom(z);
                const scaleVal = Math.round(591657550.5 / Math.pow(2, z));
                setMapScale(`1 : ${scaleVal.toLocaleString()}`);
                updateSmartMapLabels();
            });
        }

        // Load features for active visible layers
        renderVisibleLayers();

    }, [portal, visibleLayerIds, isLoggedIn, handleMapClickForMeasurement, handleMouseMoveForMeasurement, finalizeMeasurement]);

    // ✅ تحميل طبقة واحدة مع كاش
    const fetchLayerData = useCallback(async (layer) => {
        if (layerDataCache.current[layer.id]) {
            return layerDataCache.current[layer.id];
        }

        // 1. إذا كانت الطبقة مقسّمة لأجزاء ذكية (Chunk URLs) -> اجلب الأجزاء بالتوازي واجمعها
        const chunkUrls = layer.style_config?.chunk_urls;
        if (Array.isArray(chunkUrls) && chunkUrls.length > 0) {
            try {
                const chunkResults = await Promise.all(
                    chunkUrls.map(async (url) => {
                        const res = await fetch(url, { headers: { 'Accept': 'application/json, application/geo+json, */*' } });
                        if (!res.ok) return null;
                        return await res.json();
                    })
                );
                const allFeatures = [];
                chunkResults.forEach(c => {
                    if (c && Array.isArray(c.features)) allFeatures.push(...c.features);
                    else if (c && c.type === 'Feature') allFeatures.push(c);
                });
                if (allFeatures.length > 0) {
                    const combined = { type: 'FeatureCollection', features: allFeatures };
                    layerDataCache.current[layer.id] = combined;
                    return combined;
                }
            } catch (chunkErr) {
                console.warn(`Chunk fetch failed for ${layer.layer_name}:`, chunkErr.message);
            }
        }

        // 2. إذا كانت الطبقة ملف واحد على R2 ☁️ -> اجلب مباشرة من R2 URL
        if (layer.r2_file_url) {
            try {
                const r2Res = await fetch(layer.r2_file_url, {
                    method: 'GET',
                    headers: { 'Accept': 'application/json, application/geo+json, */*' }
                });
                if (r2Res.ok) {
                    const r2Geojson = await r2Res.json();
                    if (r2Geojson && (r2Geojson.type === 'FeatureCollection' || r2Geojson.type === 'Feature')) {
                        const normalized = r2Geojson.type === 'Feature'
                            ? { type: 'FeatureCollection', features: [r2Geojson] }
                            : r2Geojson;
                        layerDataCache.current[layer.id] = normalized;
                        return normalized;
                    }
                }
            } catch (r2Err) {
                console.warn(`Direct R2 fetch failed for ${layer.layer_name}:`, r2Err.message);
            }
        }

        // 2. إذا لم تكن مخزنة في R2 -> اجلب من قاعدة البيانات (PostGIS)
        const token = localStorage.getItem('token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        try {
            const res = await axios.get(`/api/geoportals/public/layers/${layer.id}/features`, { headers });
            const data = res.data;
            layerDataCache.current[layer.id] = data;
            return data;
        } catch (err) {
            console.warn(`Layer ${layer.layer_name} fetch failed:`, err.message);
            return null;
        }
    }, []);


    // ✅ محرك رسم المسميات المكانيّة الذكي مع (Centroid & Zoom Threshold & Collision Detection)
    const updateSmartMapLabels = useCallback(() => {
        if (!mapInstance.current || !labelsLayerGroupRef.current) return;

        // 1. مسح التسميات القديمة لمنع التكرار نهائياً
        labelsLayerGroupRef.current.clearLayers();

        const activeZoom = mapInstance.current.getZoom();

        // 2. النقطة الثانية (Zoom Threshold): إخفاء المسميات عند الابتعاد والزوم المصغر (أقل من زوم 13 زوم البلدية والقطع) لمنع التراكم والاكتظاظ
        if (activeZoom < 13) return;

        const visibleLayers = layers.filter(l => visibleLayerIds.has(l.id));
        const drawnPixelPoints = [];

        visibleLayers.forEach(layer => {
            const style = layer.style_config || {};
            if (style.show_labels && style.label_field && layerDataCache.current[layer.id]) {
                const geojson = layerDataCache.current[layer.id];
                const labelColor = style.label_color || '#FFFFFF';
                const labelSize = style.label_size || 12;

                geojson.features.forEach(feature => {
                    const val = getFieldValue(feature.properties, style.label_field);
                    if (val !== null && val !== undefined && String(val).trim() !== '') {
                        // النقطة الأولى: حساب المركز الهندسي (Centroid) بقلب القطعة
                        const centroid = getTruePolygonCentroid(feature);
                        if (centroid) {
                            const containerPt = mapInstance.current.latLngToContainerPoint(centroid);

                            // النقطة الثالثة (Collision Detection): مسافة أمان 85 بكسل لمنع تداخل الأسماء والكلمات الطويلة
                            const isColliding = drawnPixelPoints.some(pt => {
                                const dx = pt.x - containerPt.x;
                                const dy = pt.y - containerPt.y;
                                return Math.sqrt(dx * dx + dy * dy) < 85;
                            });

                            if (!isColliding) {
                                drawnPixelPoints.push(containerPt);
                                const labelMarker = L.marker(centroid, {
                                    icon: L.divIcon({
                                        className: 'pure-floating-label-marker',
                                        html: `<div class="pure-floating-map-label" style="color: ${labelColor} !important; font-size: ${labelSize}px !important;">${String(val)}</div>`,
                                        iconSize: [0, 0],
                                        iconAnchor: [0, 0]
                                    }),
                                    interactive: false
                                });
                                labelsLayerGroupRef.current.addLayer(labelMarker);
                            }
                        }
                    }
                });
            }
        });
    }, [layers, visibleLayerIds]);

    // ✅ تحميل وعرض جميع الطبقات المرئية دائماً
    const renderVisibleLayers = useCallback(async () => {
        if (!mapInstance.current || !layers.length) return;

        Object.entries(featureGroupsRef.current).forEach(([id, group]) => {
            const isVisible = visibleLayerIds.has(Number(id)) || visibleLayerIds.has(id);
            if (!isVisible) {
                mapInstance.current.removeLayer(group);
            }
        });

        const visibleLayers = layers.filter(l => visibleLayerIds.has(l.id));
        setLayersLoading(true);

        // ✅ رسم قناع قص الخريطة الجوية الحية (Clipping Mask Overlay)
        const clippingMaskLayerId = portal.map_config?.clipping_mask_layer_id;
        if (clippingMaskLayerId) {
            const maskLayer = layers.find(l => String(l.id) === String(clippingMaskLayerId));
            if (maskLayer) {
                const maskGeojson = await fetchLayerData(maskLayer);
                if (maskGeojson && maskGeojson.features?.length) {
                    if (featureGroupsRef.current['clipping_mask_overlay']) {
                        mapInstance.current.removeLayer(featureGroupsRef.current['clipping_mask_overlay']);
                    }
                    const maskGroup = L.featureGroup();
                    const worldOuterRing = [
                        [90, -180],
                        [90, 180],
                        [-90, 180],
                        [-90, -180],
                        [90, -180]
                    ];

                    let holes = [];
                    maskGeojson.features.forEach(feat => {
                        if (feat.geometry?.type === 'Polygon') {
                            const ring = feat.geometry.coordinates[0].map(pt => [pt[1], pt[0]]);
                            holes.push(ring);
                        } else if (feat.geometry?.type === 'MultiPolygon') {
                            feat.geometry.coordinates.forEach(poly => {
                                const ring = poly[0].map(pt => [pt[1], pt[0]]);
                                holes.push(ring);
                            });
                        }
                    });

                    if (holes.length > 0) {
                        const paddedRenderer = L.svg({ padding: 3.0 });
                        const maskPoly = L.polygon([worldOuterRing, ...holes], {
                            renderer: paddedRenderer,
                            color: 'transparent',
                            fillColor: '#FFFFFF',
                            fillOpacity: 1,
                            interactive: false
                        });
                        maskGroup.addLayer(maskPoly);
                        featureGroupsRef.current['clipping_mask_overlay'] = maskGroup;
                        maskGroup.addTo(mapInstance.current);

                        // Lock bounds and minZoom to prevent revealing outer map on zoom out
                        const bounds = maskPoly.getBounds();
                        if (bounds && bounds.isValid() && mapInstance.current) {
                            const mapBounds = bounds.pad(0.35);
                            mapInstance.current.setMaxBounds(mapBounds);
                            mapInstance.current.options.maxBoundsViscosity = 1.0;
                            mapInstance.current.setMinZoom(12);
                        }
                    }
                }
            }
        } else if (featureGroupsRef.current['clipping_mask_overlay']) {
            mapInstance.current.removeLayer(featureGroupsRef.current['clipping_mask_overlay']);
            delete featureGroupsRef.current['clipping_mask_overlay'];
        }

        let combinedBounds = L.latLngBounds([]);

        // Sort layers by z_index (base layers first, detail layers/parcels on top)
        const sortedLayers = [...visibleLayers].sort((a, b) => (a.z_index || 0) - (b.z_index || 0));

        for (const layer of sortedLayers) {
            const style = layer.style_config || {};

            // Clear cached group if it was stored empty
            if (featureGroupsRef.current[layer.id] && featureGroupsRef.current[layer.id].getLayers().length === 0) {
                if (mapInstance.current.hasLayer(featureGroupsRef.current[layer.id])) {
                    mapInstance.current.removeLayer(featureGroupsRef.current[layer.id]);
                }
                delete featureGroupsRef.current[layer.id];
            }

            if (featureGroupsRef.current[layer.id]) {
                if (!mapInstance.current.hasLayer(featureGroupsRef.current[layer.id])) {
                    featureGroupsRef.current[layer.id].addTo(mapInstance.current);
                }
                const existingBounds = featureGroupsRef.current[layer.id].getBounds();
                if (existingBounds && existingBounds.isValid()) combinedBounds.extend(existingBounds);
                continue;
            }

            const geojson = await fetchLayerData(layer);
            if (!geojson || !geojson.features?.length) continue;

            const isTransparent = style.fill_color === 'transparent' || style.is_transparent;

            const canvasRenderer = L.canvas({ padding: 0.5 });
            const group = L.geoJSON(geojson, {
                renderer: canvasRenderer,
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
                }
            });

            featureGroupsRef.current[layer.id] = group;
            group.addTo(mapInstance.current);

            const b = group.getBounds();
            if (b && b.isValid()) combinedBounds.extend(b);
        }

        // رسم المسميات المكانيّة الذكية
        updateSmartMapLabels();

        if (!hasFittedBoundsRef.current && combinedBounds && combinedBounds.isValid() && mapInstance.current) {
            mapInstance.current.fitBounds(combinedBounds, { padding: [50, 50], maxZoom: 17 });
            hasFittedBoundsRef.current = true;
        }

        setLayersLoading(false);
        setProgressPercent(100);
        setStatusText('تهيئة الخريطة والتوجيه المباشر إلى بلدة بيرزيت...');
        setTimeout(() => {
            setSplashFading(true);
            setTimeout(() => {
                setShowSplashOverlay(false);
            }, 650);
        }, 400);
    }, [layers, visibleLayerIds, fetchLayerData, updateSmartMapLabels]);

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

    if (!portal && !loading) {
        return (
            <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#050B16', color: '#EF4444', fontFamily: 'Tajawal, sans-serif' }}>
                <h2>❌ البوابة الجغرافية المطلوبة غير موجودة</h2>
            </div>
        );
    }

    return (
        <div className="geoportal-viewer">
            {/* 🌟 Pure White Minimal Loading Screen (Medium Spinner Only — No Text) */}
            {showSplashOverlay && (
                <div className={`geoportal-splash-overlay ${splashFading ? 'fade-out' : ''}`}>
                    <div className="geoportal-minimal-spinner"></div>
                </div>
            )}
            {/* Modern Floating Top Navigation Bar (Matching exact user UI reference) */}
            <div className="geoportal-navbar-container">
                <div className="geoportal-navbar">
                    {/* Brand Section */}
                    <div className="brand-section">
                        {portal?.logo_url ? (
                            <>
                                <img
                                    src={portal.logo_url}
                                    alt={portal?.title_ar || 'Logo'}
                                    className="portal-logo-navbar"
                                />
                                <div className="brand-title-group-with-logo">
                                    <span className="brand-name">{portal?.title_ar || 'GeoPulse'}</span>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="brand-icon-box">
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                        <circle cx="12" cy="12" r="10" />
                                        <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                                    </svg>
                                </div>
                                <div className="brand-title-group">
                                    <span className="brand-name">{portal?.title_ar || 'GeoPulse'}</span>
                                </div>
                            </>
                        )}
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
                                onClick={() => {
                                    setShowLayersDropdown(!showLayersDropdown);
                                    if (showToolsBar) setShowToolsBar(false);
                                }}
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

                        {/* 🛠️ زر الأدوات التفاعلي الجديد */}
                        <button
                            className={`nav-action-btn layers-btn ${showToolsBar ? 'active' : ''}`}
                            style={{ background: showToolsBar ? '#06D6F2' : 'rgba(255, 255, 255, 0.08)', color: showToolsBar ? '#050B16' : '#FFF', border: '1px solid rgba(255, 255, 255, 0.15)' }}
                            onClick={() => {
                                setShowToolsBar(!showToolsBar);
                                if (showLayersDropdown) setShowLayersDropdown(false);
                            }}
                        >
                            <span>🛠️ الأدوات</span>
                        </button>

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

                {/* 🛠️ بار الأدوات الممتد الساحر الفاخر (Ultra-Sleek Floating Tools Bar) */}
                {showToolsBar && (
                    <div className="floating-tools-extension-bar">
                        <button
                            className={`tool-bar-item ${activeTool === 'location' ? 'active' : ''}`}
                            onClick={() => {
                                setActiveTool('location');
                                handleLocateUser();
                            }}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                <circle cx="12" cy="12" r="10" />
                                <polygon points="12 2 15 12 12 22 9 12 12 2" fill="currentColor" opacity="0.3" />
                                <circle cx="12" cy="12" r="3" fill="currentColor" />
                            </svg>
                            <span>تحديد موقعي (GPS)</span>
                        </button>

                        <button
                            className={`tool-bar-item ${activeTool === 'distance' ? 'active' : ''}`}
                            onClick={() => {
                                setActiveTool(activeTool === 'distance' ? null : 'distance');
                                clearMeasurements();
                            }}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                <path d="M2 12h20M6 8v8M12 8v8M18 8v8" />
                            </svg>
                            <span>قياس مسافة</span>
                        </button>

                        <button
                            className={`tool-bar-item ${activeTool === 'area' ? 'active' : ''}`}
                            onClick={() => {
                                setActiveTool(activeTool === 'area' ? null : 'area');
                                clearMeasurements();
                            }}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                <path d="M3 3h18v18H3z" strokeDasharray="4 4" />
                                <polygon points="3 3 21 3 21 21 3 21" fill="currentColor" opacity="0.15" />
                                <path d="M3 21L21 3" strokeWidth="1.5" />
                            </svg>
                            <span>قياس مساحة</span>
                        </button>

                        {/* 🎨 لوحة اختيار لون القياس المباشر بالخريطة */}
                        {(activeTool === 'distance' || activeTool === 'area') && (
                            <div className="measure-color-picker-palette">
                                <span style={{ fontSize: '0.75rem', color: '#94A3B8', fontWeight: 700 }}>لون الرسم:</span>
                                {['#06D6F2', '#F5A623', '#10B981', '#EF4444', '#A855F7', '#FFFFFF'].map(c => (
                                    <button
                                        key={c}
                                        className={`color-dot-btn ${measureColor === c ? 'active' : ''}`}
                                        style={{ backgroundColor: c }}
                                        title={`تغيير لون رسم القياس إلى ${c}`}
                                        onClick={() => {
                                            setMeasureColor(c);
                                            redrawMeasurementsWithColor(c, measurePointsRef.current, activeTool);
                                        }}
                                    />
                                ))}
                                <input
                                    type="color"
                                    className="custom-color-input"
                                    value={measureColor}
                                    title="اختر لون مخصص"
                                    onChange={e => {
                                        const c = e.target.value;
                                        setMeasureColor(c);
                                        redrawMeasurementsWithColor(c, measurePointsRef.current, activeTool);
                                    }}
                                />
                            </div>
                        )}

                        {(measureData || activeTool === 'distance' || activeTool === 'area') && (
                            <button
                                className="tool-bar-item clear-btn"
                                onClick={() => {
                                    clearMeasurements();
                                    setActiveTool(null);
                                }}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                    <polyline points="3 6 5 6 21 6" />
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                    <line x1="10" y1="11" x2="10" y2="17" />
                                    <line x1="14" y1="11" x2="14" y2="17" />
                                </svg>
                                <span>مسح القياس</span>
                            </button>
                        )}
                    </div>
                )}
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
                            {portal?.auth_config?.welcome_msg || 'يرجى إدخال بيانات حسابك للوصول للطبقات المكانية المحمية'}
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
                    <span>© 2026 PalNovaa. جميع الحقوق محفوظة.</span>
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
                                {selectedCrs === '28191' && 'Palestinian XY'}
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

            {/* GIS Measurement Result Card */}
            {(measureData || savedMeasures.length > 0) && (
                <div className="gis-measurement-card" style={{ borderColor: measureColor }}>
                    <div className="measure-card-header">
                        <span style={{ color: measureColor, fontWeight: 800 }}>📊 نتائج القياس</span>
                        <button onClick={clearMeasurements} title="مسح كل القياسات">✕ مسح الكل</button>
                    </div>

                    {/* Saved finalized measurements list */}
                    {savedMeasures.map((m, i) => (
                        <div key={m.id} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.08)',
                            gap: 8
                        }}>
                            <span style={{ fontSize: '0.78rem', color: '#94A3B8' }}>#{i + 1} {m.type}</span>
                            <span style={{ color: m.color, fontWeight: 800, fontSize: '0.92rem' }}>{m.value}</span>
                            <button
                                onClick={() => setSavedMeasures(prev => prev.filter(x => x.id !== m.id))}
                                style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', fontSize: '0.85rem', padding: '0 4px' }}
                                title="حذف هذا القياس"
                            >✕</button>
                        </div>
                    ))}

                    {/* Current in-progress measurement */}
                    {measureData && (
                        <div style={{ marginTop: savedMeasures.length > 0 ? 8 : 0 }}>
                            <div className="measure-card-val" style={{ color: measureColor }}>
                                {measureData.value}
                            </div>
                            {measureData.secondaryValue && (
                                <div style={{ fontSize: '0.78rem', color: '#94A3B8', marginTop: 2 }}>
                                    {measureData.secondaryValue}
                                </div>
                            )}
                            <div className="measure-card-hint" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 6, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                                <span>📍 {measureData.pointsCount} نقاط</span>
                                {measureData.lastCoords && <span style={{ fontSize: '0.72rem', color: '#64748B' }}>🌐 {measureData.lastCoords}</span>}
                            </div>
                        </div>
                    )}

                    {savedMeasures.length > 0 && (
                        <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: 8, textAlign: 'center' }}>
                            انقر مرتين لتثبيت القياس • اضغط ✕ لمسح كل شيء
                        </div>
                    )}
                </div>
            )}

            {/* Map Canvas */}
            <div ref={mapRef} className="viewer-map"></div>
        </div>
    );
}
