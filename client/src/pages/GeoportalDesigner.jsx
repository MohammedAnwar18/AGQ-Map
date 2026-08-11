import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './GeoportalDesigner.css';

const API_BASE = '/api/geoportals';

export default function GeoportalDesigner() {
    const navigate = useNavigate();
    const [portals, setPortals] = useState([]);
    const [selectedPortal, setSelectedPortal] = useState(null);
    const [activeTab, setActiveTab] = useState('general'); // 'general' | 'layers' | 'map' | 'auth' | 'domain'
    const [loading, setLoading] = useState(false);
    const [layerUploading, setLayerUploading] = useState(false);
    const [logoUploading, setLogoUploading] = useState(false);

    // Form states
    const [formData, setFormData] = useState({
        title_ar: '',
        title_en: '',
        slug: '',
        description: '',
        custom_domain: '',
        primary_color: '#0F1E33',
        secondary_color: '#F5A623',
        accent_color: '#06D6F2',
        is_public: true,
        auth_config: { require_login: false, welcome_msg: 'مرحباً بكم في البوابة المكانية الرسمية' }
    });

    const [layerList, setLayerList] = useState([]);
    const [fileToUpload, setFileToUpload] = useState(null);
    const [newLayerName, setNewLayerName] = useState('');
    const [newLayerIsPrivate, setNewLayerIsPrivate] = useState(false);

    // Map refs
    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const geojsonLayersGroup = useRef(null);

    // Load user token
    const token = localStorage.getItem('token');
    const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

    // 1. Fetch Geoportals list
    useEffect(() => {
        fetchPortals();
    }, []);

    const fetchPortals = async () => {
        try {
            setLoading(true);
            const res = await axios.get(API_BASE, authHeaders);
            const list = Array.isArray(res.data) ? res.data : (res.data?.portals || res.data?.data || []);
            setPortals(list);
            if (list.length > 0 && !selectedPortal) {
                selectPortal(list[0]);
            }
        } catch (err) {
            console.error('Error fetching portals:', err);
            setPortals([]);
        } finally {
            setLoading(false);
        }
    };

    const selectPortal = async (portal) => {
        try {
            const res = await axios.get(`${API_BASE}/${portal.id}`, authHeaders);
            const fullPortal = res.data;
            setSelectedPortal(fullPortal);
            setFormData({
                title_ar: fullPortal.title_ar || '',
                title_en: fullPortal.title_en || '',
                slug: fullPortal.slug || '',
                description: fullPortal.description || '',
                custom_domain: fullPortal.custom_domain || '',
                primary_color: fullPortal.primary_color || '#0F1E33',
                secondary_color: fullPortal.secondary_color || '#F5A623',
                accent_color: fullPortal.accent_color || '#06D6F2',
                is_public: fullPortal.is_public !== undefined ? fullPortal.is_public : true,
                auth_config: fullPortal.auth_config || { require_login: false, welcome_msg: 'مرحباً بكم في البوابة المكانية الرسمية' },
                map_config: fullPortal.map_config || {}
            });
            setLayerList(fullPortal.layers || []);
        } catch (err) {
            console.error('Error getting portal detail:', err);
        }
    };

    const [layerFieldsMap, setLayerFieldsMap] = useState({});
    const labelsGroupRef = useRef(null);

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

    const layerDataCache = useRef({});

    const updateSmartDesignerLabels = useCallback(() => {
        if (!mapInstance.current || !labelsGroupRef.current || !layerList) return;
        labelsGroupRef.current.clearLayers();

        const activeZoom = mapInstance.current.getZoom();
        if (activeZoom < 13) return;

        const drawnPixelPoints = [];

        layerList.forEach(layer => {
            if (!layer.is_visible_by_default) return;
            const style = layer.style_config || {};

            if (style.show_labels && style.label_field && layerDataCache.current[layer.id]) {
                const geojson = layerDataCache.current[layer.id];
                if (geojson && geojson.features) {
                    const labelColor = style.label_color || '#FFFFFF';
                    const labelSize = style.label_size || 12;

                    geojson.features.forEach(feature => {
                        const val = getFieldValue(feature.properties, style.label_field);
                        if (val !== null && val !== undefined && String(val).trim() !== '') {
                            const centroid = getTruePolygonCentroid(feature);
                            if (centroid) {
                                const containerPt = mapInstance.current.latLngToContainerPoint(centroid);
                                const isColliding = drawnPixelPoints.some(pt => {
                                    const dx = pt.x - containerPt.x;
                                    const dy = pt.y - containerPt.y;
                                    return Math.sqrt(dx * dx + dy * dy) < 85;
                                });

                                if (!isColliding) {
                                    drawnPixelPoints.push(containerPt);
                                    const marker = L.marker(centroid, {
                                        icon: L.divIcon({
                                            className: 'pure-floating-label-marker',
                                            html: `<div class="pure-floating-map-label" style="color: ${labelColor} !important; font-size: ${labelSize}px !important;">${String(val)}</div>`,
                                            iconSize: [0, 0],
                                            iconAnchor: [0, 0]
                                        }),
                                        interactive: false
                                    });
                                    labelsGroupRef.current.addLayer(marker);
                                }
                            }
                        }
                    });
                }
            }
        });
    }, [layerList]);

    // 2. Initialize Leaflet Map
    useEffect(() => {
        if (!mapRef.current) return;

        if (!mapInstance.current) {
            mapInstance.current = L.map(mapRef.current, {
                center: [31.9038, 35.2034],
                zoom: 13,
                zoomControl: false
            });

            L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
                attribution: '© Google Maps',
                maxZoom: 21,
                subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
            }).addTo(mapInstance.current);

            L.control.zoom({ position: 'topleft' }).addTo(mapInstance.current);
            geojsonLayersGroup.current = L.featureGroup().addTo(mapInstance.current);
            labelsGroupRef.current = L.featureGroup().addTo(mapInstance.current);

            mapInstance.current.on('zoomend', () => {
                updateSmartDesignerLabels();
            });
        }

        // Render features on map
        renderLayersOnMap();
    }, [selectedPortal, layerList]);

    const renderLayersOnMap = async () => {
        if (!mapInstance.current || !geojsonLayersGroup.current || !layerList) return;

        geojsonLayersGroup.current.clearLayers();

        // ✅ رسم قناع قص الخريطة الجوية الحية في المعاينة (Clipping Mask Overlay)
        const clippingMaskLayerId = selectedPortal?.map_config?.clipping_mask_layer_id || formData.map_config?.clipping_mask_layer_id;
        if (clippingMaskLayerId) {
            const maskLayer = layerList.find(l => String(l.id) === String(clippingMaskLayerId));
            if (maskLayer) {
                try {
                    const res = await axios.get(`${API_BASE}/public/layers/${maskLayer.id}/features`, authHeaders);
                    const maskGeojson = res.data;
                    if (maskGeojson && maskGeojson.features?.length) {
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
                            geojsonLayersGroup.current.addLayer(maskPoly);
                        }
                    }
                } catch (e) {
                    console.warn('Clipping mask error:', e);
                }
            }
        }

        for (const layer of layerList) {
            if (!layer.is_visible_by_default) continue;

            try {
                const res = await axios.get(`${API_BASE}/public/layers/${layer.id}/features`, authHeaders);
                const geojson = res.data;
                layerDataCache.current[layer.id] = geojson;

                if (geojson && geojson.features && geojson.features.length > 0) {
                    // ✅ استخراج أسماء حقول الخصائص للطبقة (PostGIS)
                    const sampleProps = geojson.features[0].properties || {};
                    const fields = Object.keys(sampleProps);
                    setLayerFieldsMap(prev => ({ ...prev, [layer.id]: fields }));

                } else if (layer.r2_file_url) {
                    // ✅ طبقة R2: استخرج الحقول من properties_schema المحفوظة
                    const savedSchema = layer.style_config?.properties_schema;
                    if (Array.isArray(savedSchema) && savedSchema.length > 0) {
                        setLayerFieldsMap(prev => ({ ...prev, [layer.id]: savedSchema }));
                    }

                    // جلب من R2 لعرضها على الماب
                    try {
                        const r2Res = await fetch(layer.r2_file_url, {
                            headers: { 'Accept': 'application/json, application/geo+json, */*' }
                        });
                        if (r2Res.ok) {
                            const r2Geojson = await r2Res.json();
                            if (r2Geojson?.features?.length > 0) {
                                layerDataCache.current[layer.id] = r2Geojson;
                                // استخراج الحقول من الملف الفعلي إذا ما في schema محفوظة
                                if (!savedSchema || savedSchema.length === 0) {
                                    const fields2 = Object.keys(r2Geojson.features[0]?.properties || {});
                                    setLayerFieldsMap(prev => ({ ...prev, [layer.id]: fields2 }));
                                }
                            }
                        }
                    } catch (r2Err) {
                        console.warn('Designer R2 fetch:', r2Err.message);
                    }
                }

                if (layerDataCache.current[layer.id]?.features?.length > 0) {
                    const geojsonToRender = layerDataCache.current[layer.id];
                    const style = layer.style_config || {};
                    const isTransparent = style.fill_color === 'transparent' || style.is_transparent;

                    const leafletLayer = L.geoJSON(geojsonToRender, {
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
                        onEachFeature: (feature, l) => {
                            if (feature.properties) {
                                const popupContent = Object.entries(feature.properties)
                                    .map(([k, v]) => `<strong>${k}:</strong> ${v}`)
                                    .join('<br/>');
                                l.bindPopup(`<div style="font-family: Tajawal, sans-serif;">${popupContent}</div>`);
                            }
                        }
                    });

                    geojsonLayersGroup.current.addLayer(leafletLayer);
                }
            } catch (err) {
                console.error(`Error rendering layer ${layer.layer_name}:`, err);
            }
        }

        // ✅ رسم المسميات المكانيّة الذكية الصافية في شاشة المصمم (Centroid + Zoom Threshold + Collision Detection)
        updateSmartDesignerLabels();

        // Fit bounds if features exist
        const bounds = geojsonLayersGroup.current.getBounds();
        if (bounds.isValid()) {
            mapInstance.current.fitBounds(bounds, { padding: [40, 40] });
        }
    };

    // 3. Create or Save Portal
    const handleSavePortal = async () => {
        const payload = {
            ...formData,
            title_ar: formData.title_ar?.trim() || 'البوابة الجغرافية المكانية',
            slug: formData.slug?.trim() || `portal-${Date.now()}`
        };

        try {
            setLoading(true);
            if (selectedPortal && selectedPortal.id) {
                const res = await axios.put(`${API_BASE}/${selectedPortal.id}`, payload, authHeaders);
                alert('✅ تم حفظ التغييرات بنجاح');
                fetchPortals();
            } else {
                const res = await axios.post(API_BASE, payload, authHeaders);
                alert('🎉 تم إنشاء البوابة الجغرافية الجديدة بنجاح');
                fetchPortals();
            }
        } catch (err) {
            console.error('Error saving portal:', err);
            const errMsg = typeof err.response?.data?.error === 'string'
                ? err.response.data.error
                : (err.response?.data?.message || err.message || 'فشل في حفظ البوابة');
            alert('⚠️ ' + errMsg);
        } finally {
            setLoading(false);
        }
    };

    // 4. Upload Spatial Layer (GeoJSON) — via Presigned URL → direct to Cloudflare R2
    const [uploadProgress, setUploadProgress] = useState(0);

    // مساعد: استخراج بيانات الطبقة من ملف GeoJSON قبل الرفع
    const parseGeoJSONMeta = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const geojson = JSON.parse(e.target.result);
                const features = geojson.type === 'FeatureCollection'
                    ? geojson.features
                    : geojson.type === 'Feature' ? [geojson] : [];

                if (features.length === 0) return resolve(null);

                // نوع الهندسة
                const geomType = features[0]?.geometry?.type || 'Unknown';

                // الحقول من أول عنصر
                const firstProps = features[0]?.properties || {};
                const fields = Object.keys(firstProps);

                // Bounding Box
                let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
                const processCoords = (coords) => {
                    if (typeof coords[0] === 'number') {
                        if (coords[0] < minLng) minLng = coords[0];
                        if (coords[1] < minLat) minLat = coords[1];
                        if (coords[0] > maxLng) maxLng = coords[0];
                        if (coords[1] > maxLat) maxLat = coords[1];
                    } else coords.forEach(processCoords);
                };
                features.slice(0, 500).forEach(f => {
                    if (f.geometry?.coordinates) processCoords(f.geometry.coordinates);
                });
                const bbox = minLng === Infinity
                    ? [35.15, 31.85, 35.30, 31.95]
                    : [minLng, minLat, maxLng, maxLat];

                resolve({ geomType, fields, featureCount: features.length, bbox });
            } catch (err) {
                reject(new Error('الملف ليس GeoJSON صحيح'));
            }
        };
        reader.onerror = () => reject(new Error('فشل قراءة الملف'));
        // نقرأ أول 2MB فقط لاستخراج البيانات (لا داعي للملف كامل)
        reader.readAsText(file.slice(0, 2 * 1024 * 1024));
    });

    const handleUploadLayer = async (e) => {
        e.preventDefault();
        if (!selectedPortal) {
            alert('يرجى تحديد أو إنشاء بوابة أولاً');
            return;
        }
        if (!fileToUpload) {
            alert('يرجى اختيار ملف GeoJSON');
            return;
        }

        try {
            setLayerUploading(true);
            setUploadProgress(0);

            // ---- الخطوة 0: استخراج بيانات الطبقة من الملف محلياً ----
            let layerMeta = null;
            try {
                setUploadProgress(2);
                layerMeta = await parseGeoJSONMeta(fileToUpload);
            } catch (parseErr) {
                console.warn('GeoJSON pre-parse warning:', parseErr.message);
            }

            // ---- الخطوة 1: اطلب Presigned URL من السيرفر ----
            const presignRes = await axios.post('/api/storage/presigned-url', {
                fileName: fileToUpload.name,
                contentType: 'application/geo+json'
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!presignRes.data.success) {
                throw new Error(presignRes.data.error || 'فشل الحصول على رابط الرفع');
            }

            const { uploadUrl, publicUrl, key } = presignRes.data;

            // ---- الخطوة 2: ارفع الملف مباشرة إلى Cloudflare R2 ----
            await new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('PUT', uploadUrl, true);
                xhr.setRequestHeader('Content-Type', 'application/geo+json');

                xhr.upload.onprogress = (event) => {
                    if (event.lengthComputable) {
                        const percent = 5 + Math.round((event.loaded / event.total) * 85);
                        setUploadProgress(percent);
                    }
                };
                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve();
                    } else {
                        reject(new Error(`فشل الرفع إلى R2: ${xhr.status} ${xhr.statusText}`));
                    }
                };
                xhr.onerror = () => reject(new Error('انقطع الاتصال أثناء الرفع — تأكد من تفعيل PUT في CORS على R2'));
                xhr.send(fileToUpload);
            });

            setUploadProgress(93);

            // ---- الخطوة 3: سجّل الطبقة في قاعدة البيانات مع كامل البيانات ----
            await axios.post(`${API_BASE}/${selectedPortal.id}/layers`, {
                layer_name: newLayerName || fileToUpload.name.replace(/\.(geojson|json)$/i, ''),
                is_private: newLayerIsPrivate,
                file_url: publicUrl,
                file_key: key,
                file_size: fileToUpload.size,
                storage_type: 'r2',
                // بيانات مستخرجة من الملف
                geometry_type: layerMeta?.geomType || 'Unknown',
                feature_count: layerMeta?.featureCount || 0,
                bbox: layerMeta?.bbox || null,
                properties_schema: layerMeta?.fields || []
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setUploadProgress(100);
            alert(`✅ تم رفع الطبقة بنجاح!\n📊 ${layerMeta?.featureCount?.toLocaleString() || '?'} عنصر | ${layerMeta?.fields?.length || 0} حقل`);
            setFileToUpload(null);
            setNewLayerName('');
            setUploadProgress(0);
            selectPortal(selectedPortal);
        } catch (err) {
            console.error('Error uploading layer:', err);
            let errMsg = 'فشل في رفع الملف';
            if (typeof err.response?.data?.error === 'string') errMsg = err.response.data.error;
            else if (err.response?.data?.error?.message) errMsg = err.response.data.error.message;
            else if (err.response?.data?.message) errMsg = err.response.data.message;
            else if (err.message) errMsg = err.message;
            alert('⚠️ ' + errMsg);
            setUploadProgress(0);
        } finally {
            setLayerUploading(false);
        }
    };



    // 5a. Upload Portal Logo
    const handleUploadLogo = async (file) => {
        if (!selectedPortal?.id) {
            alert('يرجى اختيار البوابة أولاً');
            return;
        }
        try {
            setLogoUploading(true);
            const data = new FormData();
            data.append('logo', file);
            const res = await axios.post(`${API_BASE}/${selectedPortal.id}/logo`, data, {
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
            });
            const logoUrl = res.data?.logo_url;
            if (logoUrl) {
                setFormData(prev => ({ ...prev, logo_url: logoUrl }));
                alert('✅ تم رفع الشعار بنجاح! سيظهر في واجهة البوابة مباشرة');
            }
        } catch (err) {
            console.error('Error uploading logo:', err);
            alert('⚠️ فشل في رفع الشعار: ' + (err.response?.data?.error || err.message));
        } finally {
            setLogoUploading(false);
        }
    };

    // 5. Update layer styling (Real-time local state + API save)
    const handleLayerStyleChange = async (layerId, newStyle) => {
        // Update local layerList state immediately for smooth UI feedback
        setLayerList(prev => prev.map(l => l.id === layerId ? { ...l, style_config: newStyle } : l));
        try {
            await axios.patch(`${API_BASE}/layers/${layerId}/style`, { style_config: newStyle }, authHeaders);
        } catch (err) {
            console.error('Error updating layer style:', err);
        }
    };

    // 6. Delete layer
    const handleDeleteLayer = async (layerId) => {
        if (!window.confirm('هل أنت تأكد من حذف هذه الطبقة ومسح كافة عناصرها الجغرافية؟')) return;
        try {
            await axios.delete(`${API_BASE}/layers/${layerId}`, authHeaders);
            selectPortal(selectedPortal);
        } catch (err) {
            console.error('Error deleting layer:', err);
        }
    };

    return (
        <div className="designer-container">
            {/* Top Bar Navigation */}
            <div className="designer-header">
                <div className="designer-brand">
                    <button className="btn-back" onClick={() => navigate('/admin')}>
                        <span>🔙</span> للوحة الأدمن
                    </button>
                    <button className="btn-back" style={{ background: '#3B82F6', color: '#FFF' }} onClick={() => {
                        setSelectedPortal(null);
                        setFormData({ title_ar: 'بوابة جديدة', slug: `portal-${Date.now()}` });
                    }}>
                        <span>➕</span> جديدة
                    </button>
                    <div className="designer-logo-badge">
                        <span className="designer-logo-icon">🗺️</span>
                        <span>Geoportal Studio</span>
                    </div>
                </div>

                <div className="header-nav-tabs">
                    <button className={`nav-tab-btn ${activeTab === 'general' ? 'active' : ''}`} onClick={() => setActiveTab('general')}>
                        ⚙️ البوابة
                    </button>
                    <button className={`nav-tab-btn ${activeTab === 'layers' ? 'active' : ''}`} onClick={() => setActiveTab('layers')}>
                        📚 الطبقات
                    </button>
                    <button className={`nav-tab-btn ${activeTab === 'clip' ? 'active' : ''}`} onClick={() => setActiveTab('clip')}>
                        ✂️ القص
                    </button>
                    <button className={`nav-tab-btn ${activeTab === 'domain' ? 'active' : ''}`} onClick={() => setActiveTab('domain')}>
                        🌐 الدومين
                    </button>
                    <button className={`nav-tab-btn ${activeTab === 'auth' ? 'active' : ''}`} onClick={() => setActiveTab('auth')}>
                        🔒 الأمان
                    </button>
                </div>
            </div>

            <div className="designer-workspace">
                <div className="designer-sidebar">
                    {activeTab === 'general' && (
                        <div className="designer-section">
                            <div className="section-title">معلومات البوابة والمظهر</div>

                            <div className="form-group">
                                <label>اختيار البوابة للتعديل:</label>
                                <select className="form-control" value={selectedPortal?.id || ''} onChange={(e) => {
                                    const p = portals.find(x => x.id === e.target.value);
                                    if (p) selectPortal(p);
                                }}>
                                    {(Array.isArray(portals) ? portals : []).map(p => (
                                        <option key={p.id} value={p.id}>{p.title_ar} ({p.slug})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label>اسم البوابة (بالعربية):</label>
                                <input type="text" className="form-control" value={formData.title_ar} onChange={e => setFormData({ ...formData, title_ar: e.target.value })} />
                            </div>

                            <div className="form-group" style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                                <label style={{ fontWeight: 700, color: '#F5A623', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span>🏛️ شعار البلدية / المؤسسة (Portal Logo):</span>
                                </label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 8 }}>
                                    {formData.logo_url ? (
                                        <img src={formData.logo_url} alt="Portal Logo" style={{ height: 48, width: 48, objectFit: 'contain', borderRadius: 8, background: '#1E293B', padding: 4, border: '1px solid #334155' }} />
                                    ) : (
                                        <div style={{ height: 48, width: 48, borderRadius: 8, background: '#1E293B', border: '1px dashed #475569', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>🏛️</div>
                                    )}
                                    <input
                                        type="file"
                                        id="logoFileInput"
                                        accept="image/*,.png,.jpg,.jpeg,.svg,.webp,.gif,.ico,.avif"
                                        style={{ display: 'none' }}
                                        onChange={e => {
                                            if (e.target.files && e.target.files[0]) {
                                                handleUploadLogo(e.target.files[0]);
                                            }
                                        }}
                                    />
                                    <button
                                        type="button"
                                        className="btn-secondary"
                                        style={{ padding: '8px 14px', fontSize: '0.82rem', background: '#3B82F6', color: '#FFF' }}
                                        onClick={() => document.getElementById('logoFileInput').click()}
                                        disabled={logoUploading}
                                    >
                                        {logoUploading ? 'جاري الرفع لـ R2...' : '📷 رفع شعار جديد'}
                                    </button>
                                </div>
                            </div>

                            <div className="form-group" style={{ marginTop: 14 }}>
                                <label>المعرف السريع بالرابط (Slug):</label>
                                <input type="text" className="form-control" value={formData.slug} onChange={e => setFormData({ ...formData, slug: e.target.value })} />
                            </div>

                            <div className="form-group">
                                <label>وصف البوابة:</label>
                                <textarea className="form-control" rows="3" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })}></textarea>
                            </div>

                            <div className="layer-controls-grid">
                                <div className="form-group">
                                    <label>اللون الرئيسي:</label>
                                    <input type="color" className="form-control" value={formData.primary_color} onChange={e => setFormData({ ...formData, primary_color: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label>اللون الثانوي:</label>
                                    <input type="color" className="form-control" value={formData.secondary_color} onChange={e => setFormData({ ...formData, secondary_color: e.target.value })} />
                                </div>
                            </div>

                            <button className="btn-primary" onClick={handleSavePortal} disabled={loading}>
                                {loading ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                            </button>
                        </div>
                    )}

                    {/* Layer Management System */}
                    {activeTab === 'layers' && (
                        <div>
                            {/* Upload GeoJSON form */}
                            <div className="designer-section">
                                <div className="section-title">رفع طبقة GeoJSON جديدة</div>

                                <div className="upload-zone" onClick={() => document.getElementById('geojsonInput').click()}>
                                    <div className="upload-icon">📁</div>
                                    <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                                        {fileToUpload ? fileToUpload.name : 'اضغط لاختيار ملف GeoJSON مكانية'}
                                    </div>
                                    <input type="file" id="geojsonInput" accept=".geojson,.json" style={{ display: 'none' }} onChange={e => setFileToUpload(e.target.files[0])} />
                                </div>

                                {fileToUpload && (
                                    <div style={{ marginTop: 14 }}>
                                        <div className="form-group">
                                            <label>اسم الطبقة:</label>
                                            <input type="text" className="form-control" placeholder="أدخل اسم الطبقة المعروض" value={newLayerName} onChange={e => setNewLayerName(e.target.value)} />
                                        </div>

                                        <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <input type="checkbox" id="privChk" checked={newLayerIsPrivate} onChange={e => setNewLayerIsPrivate(e.target.checked)} />
                                            <label htmlFor="privChk" style={{ margin: 0 }}>طبقة محمية (تتطلب تسجيل دخول)</label>
                                        </div>

                                        <button className="btn-primary" onClick={handleUploadLayer} disabled={layerUploading}>
                                            {layerUploading ? `⬆️ جاري الرفع... ${uploadProgress}%` : 'رفع ومعالجة الطبقة'}
                                        </button>

                                        {layerUploading && (
                                            <div style={{ marginTop: 12 }}>
                                                <div style={{ background: '#1a2035', borderRadius: 8, height: 10, overflow: 'hidden' }}>
                                                    <div style={{
                                                        width: `${uploadProgress}%`,
                                                        height: '100%',
                                                        background: 'linear-gradient(90deg, #4f8ef7, #a78bfa)',
                                                        transition: 'width 0.3s ease',
                                                        borderRadius: 8
                                                    }} />
                                                </div>
                                                <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: 6, textAlign: 'center' }}>
                                                    {uploadProgress < 5 ? '🔗 جاري طلب رابط الرفع...' :
                                                     uploadProgress < 92 ? `☁️ جاري الرفع مباشرةً لـ R2... ${uploadProgress}%` :
                                                     uploadProgress < 100 ? '💾 جاري حفظ الطبقة في قاعدة البيانات...' :
                                                     '✅ اكتمل الرفع!'}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Layers List & Styling */}
                            <div className="designer-section">
                                <div className="section-title">
                                    <span>نظام الطبقات ({Array.isArray(layerList) ? layerList.length : 0})</span>
                                </div>

                                {(Array.isArray(layerList) ? layerList : []).map(layer => {
                                    const style = layer.style_config || {};
                                    return (
                                        <div key={layer.id} className="layer-item">
                                            <div className="layer-item-header">
                                                <div className="layer-name-tag">
                                                    <span className="layer-color-dot" style={{ backgroundColor: style.fill_color || '#3B82F6' }}></span>
                                                    <span>{layer.layer_name}</span>
                                                    {layer.is_private && <span style={{ fontSize: '0.7rem', background: '#EF4444', padding: '2px 6px', borderRadius: 10 }}>محمية 🔒</span>}
                                                    {layer.r2_file_url && <span style={{ fontSize: '0.65rem', background: '#0ea5e9', padding: '2px 5px', borderRadius: 8, marginLeft: 4 }}>☁️ R2</span>}
                                                    {layer.feature_count > 0 && <span style={{ fontSize: '0.65rem', color: '#94a3b8', marginLeft: 4 }}>{layer.feature_count?.toLocaleString()} عنصر</span>}
                                                </div>

                                                <div className="layer-actions">
                                                    {layer.r2_file_url && (
                                                        <button
                                                            className="icon-btn"
                                                            title="اختبر رابط الملف في R2"
                                                            onClick={() => window.open(layer.r2_file_url, '_blank')}
                                                            style={{ fontSize: '0.8rem' }}
                                                        >🔗</button>
                                                    )}
                                                    <button className="icon-btn danger" title="حذف الطبقة" onClick={() => handleDeleteLayer(layer.id)}>🗑️</button>
                                                </div>
                                            </div>

                                            <div className="layer-controls-grid">
                                                <div>
                                                    <label style={{ fontSize: '0.78rem', fontWeight: 600 }}>لون التعبئة:</label>
                                                    <input type="color" className="form-control color-picker" disabled={style.fill_color === 'transparent' || style.is_transparent} value={style.fill_color === 'transparent' ? '#3B82F6' : (style.fill_color || '#3B82F6')} onChange={e => handleLayerStyleChange(layer.id, { ...style, fill_color: e.target.value, is_transparent: false })} />
                                                </div>
                                                <div>
                                                    <label style={{ fontSize: '0.78rem', fontWeight: 600 }}>لون الحدود:</label>
                                                    <input type="color" className="form-control color-picker" value={style.stroke_color || '#1D4ED8'} onChange={e => handleLayerStyleChange(layer.id, { ...style, stroke_color: e.target.value })} />
                                                </div>
                                            </div>

                                            <div className="layer-sliders-grid" style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                                <div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8' }}>
                                                        <span>الشفافية (Opacity)</span>
                                                        <span>{Math.round((style.fill_opacity !== undefined ? style.fill_opacity : 0.45) * 100)}%</span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="0"
                                                        max="1"
                                                        step="0.05"
                                                        className="range-input"
                                                        value={style.fill_opacity !== undefined ? style.fill_opacity : 0.45}
                                                        onChange={e => handleLayerStyleChange(layer.id, { ...style, fill_opacity: parseFloat(e.target.value) })}
                                                    />
                                                </div>

                                                <div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8' }}>
                                                        <span>سمك الحدود (Stroke)</span>
                                                        <span>{style.stroke_width || 2}px</span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="1"
                                                        max="10"
                                                        step="1"
                                                        className="range-input"
                                                        value={style.stroke_width || 2}
                                                        onChange={e => handleLayerStyleChange(layer.id, { ...style, stroke_width: parseInt(e.target.value) })}
                                                    />
                                                </div>

                                                <div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8' }}>
                                                        <span>حجم النقاط (Point Radius)</span>
                                                        <span>{style.point_radius || 7}px</span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="2"
                                                        max="20"
                                                        step="1"
                                                        className="range-input"
                                                        value={style.point_radius || 7}
                                                        onChange={e => handleLayerStyleChange(layer.id, { ...style, point_radius: parseInt(e.target.value) })}
                                                    />
                                                </div>

                                                {/* Feature Labeling System */}
                                                <div style={{ gridColumn: 'span 2', marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                                                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#F5A623', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                        <span>🏷️ طباعة نصوص الخصائص ع الخريطة (Feature Labels)</span>
                                                    </div>

                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                                                        <input
                                                            type="checkbox"
                                                            id={`label_chk_${layer.id}`}
                                                            checked={style.show_labels || false}
                                                            onChange={e => handleLayerStyleChange(layer.id, { ...style, show_labels: e.target.checked })}
                                                        />
                                                        <label htmlFor={`label_chk_${layer.id}`} style={{ fontSize: '0.78rem', color: '#FFFFFF', cursor: 'pointer', margin: 0, fontWeight: 600 }}>
                                                            إظهار مسميات وقيم الحقول كـ Label على العناصر
                                                        </label>
                                                    </div>

                                                    {style.show_labels && (
                                                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 10 }}>
                                                            <div>
                                                                <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>حقل التسمية:</label>
                                                                <select
                                                                    className="form-control"
                                                                    value={style.label_field || ''}
                                                                    onChange={e => handleLayerStyleChange(layer.id, { ...style, label_field: e.target.value })}
                                                                >
                                                                    <option value="">-- اختر حقل --</option>
                                                                    {(layerFieldsMap[layer.id] || []).map(f => (
                                                                        <option key={f} value={f}>{f}</option>
                                                                    ))}
                                                                </select>
                                                            </div>

                                                            <div>
                                                                <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>لون النص:</label>
                                                                <input
                                                                    type="color"
                                                                    className="form-control color-picker"
                                                                    value={style.label_color || '#FFFFFF'}
                                                                    onChange={e => handleLayerStyleChange(layer.id, { ...style, label_color: e.target.value })}
                                                                />
                                                            </div>

                                                            <div>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8' }}>
                                                                    <span>حجم الخط</span>
                                                                    <span>{style.label_size || 12}px</span>
                                                                </div>
                                                                <input
                                                                    type="range"
                                                                    min="9"
                                                                    max="24"
                                                                    step="1"
                                                                    className="range-input"
                                                                    value={style.label_size || 12}
                                                                    onChange={e => handleLayerStyleChange(layer.id, { ...style, label_size: parseInt(e.target.value) })}
                                                                />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Spatial Map Clipping */}
                    {activeTab === 'clip' && (
                        <div className="designer-section">
                            <div className="section-title">✂️ قص الخريطة والصور الجوية (Spatial Map Clipping Mask)</div>
                            <p style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.7)', marginBottom: 16, lineHeight: 1.6 }}>
                                يتيح لك هذا الخيار تحديد طبقة مضلعات (GeoJSON) لـ **قص صور جوجل الجوية (Basemap)** بحيث يظهر للزوار على الخريطة المكان المضلع المحدد فقط، ويتحول باقي العالم الخارجي حول المساحة إلى لون أبيض ناصع ونظيف بالكامل!
                            </p>

                            <div className="form-group" style={{ marginBottom: 18 }}>
                                <label style={{ fontWeight: 700, color: '#06D6F2' }}>اختيار طبقة GeoJSON الحالية لقص الخريطة:</label>
                                <select
                                    className="form-control"
                                    value={formData.map_config?.clipping_mask_layer_id || ''}
                                    onChange={e => {
                                        const layerId = e.target.value;
                                        setFormData({
                                            ...formData,
                                            map_config: { ...formData.map_config, clipping_mask_layer_id: layerId }
                                        });
                                    }}
                                >
                                    <option value="">-- بدون قص (إظهار الخريطة كاملة) --</option>
                                    {(Array.isArray(layerList) ? layerList : []).map(l => (
                                        <option key={l.id} value={l.id}>✂️ {l.layer_name}</option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                                <button className="btn-primary" onClick={handleSavePortal} disabled={loading}>
                                    ✂️ تطبيق وقص الخريطة الآن
                                </button>
                                {formData.map_config?.clipping_mask_layer_id && (
                                    <button
                                        className="btn-secondary"
                                        style={{ background: '#EF4444', color: '#FFF' }}
                                        onClick={async () => {
                                            const updatedFormData = {
                                                ...formData,
                                                map_config: { ...formData.map_config, clipping_mask_layer_id: null }
                                            };
                                            setFormData(updatedFormData);
                                            try {
                                                setLoading(true);
                                                await axios.put(`${API_BASE}/${selectedPortal.id}`, updatedFormData, authHeaders);
                                                setSelectedPortal({ ...selectedPortal, map_config: updatedFormData.map_config });
                                                alert('✅ تم إلغاء قص الخريطة وعودتها للوضع الطبيعي الكامل');
                                            } catch (err) {
                                                alert('فشل إلغاء قص الخريطة');
                                            } finally {
                                                setLoading(false);
                                            }
                                        }}
                                    >
                                        🚫 إلغاء القص (عرض الخريطة كاملة)
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Domain White-labeling */}
                    {activeTab === 'domain' && (
                        <div className="designer-section">
                            <div className="section-title">ربط الدومين الخاص (Custom Domain)</div>
                            <p style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.6)', marginBottom: 14 }}>
                                يمكنك ربط البوابة الجغرافية بدومين خاص ببلديتك (مثال: gis.ramallah.ps) ليظهر للزوار كـ موقع مستقل بالكامل دون ظهور اسم PalNova في الرابط!
                            </p>

                            <div className="form-group">
                                <label>رابط الدومين الخاص:</label>
                                <input type="text" className="form-control" placeholder="gis.municipality.gov.ps" value={formData.custom_domain} onChange={e => setFormData({ ...formData, custom_domain: e.target.value })} />
                            </div>

                            <button className="btn-primary" onClick={handleSavePortal} disabled={loading}>
                                ربط وحفظ الدومين
                            </button>
                        </div>
                    )}

                    {/* Auth & Security */}
                    {activeTab === 'auth' && (
                        <div className="designer-section">
                            <div className="section-title">تراخيص وتسجيل الدخول للبوابة</div>

                            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <input type="checkbox" id="pubChk" checked={formData.is_public} onChange={e => setFormData({ ...formData, is_public: e.target.checked })} />
                                <label htmlFor="pubChk" style={{ margin: 0 }}>البوابة متاحة للجمهور (عرض الطبقات العامة)</label>
                            </div>

                            <div className="form-group">
                                <label>رسالة الترحيب في نافذة الدخول:</label>
                                <input type="text" className="form-control" value={formData.auth_config?.welcome_msg || ''} onChange={e => setFormData({
                                    ...formData,
                                    auth_config: { ...formData.auth_config, welcome_msg: e.target.value }
                                })} />
                            </div>

                            <button className="btn-primary" onClick={handleSavePortal} disabled={loading}>
                                حفظ إعدادات الأمان
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Map Viewport */}
            <div className="designer-map-container">
                <div className="preview-badge">معاينة البوابة الحية (Live Preview)</div>
                <div ref={mapRef} className="map-viewport"></div>
            </div>
        </div>
    );
}
