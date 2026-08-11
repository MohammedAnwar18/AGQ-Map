import React, { useState, useEffect, useRef } from 'react';
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
                auth_config: fullPortal.auth_config || { require_login: false, welcome_msg: 'مرحباً بكم في البوابة المكانية الرسمية' }
            });
            setLayerList(fullPortal.layers || []);
        } catch (err) {
            console.error('Error getting portal detail:', err);
        }
    };

    const [layerFieldsMap, setLayerFieldsMap] = useState({});

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
        }

        // Render features on map
        renderLayersOnMap();
    }, [selectedPortal, layerList]);

    const renderLayersOnMap = async () => {
        if (!mapInstance.current || !geojsonLayersGroup.current || !layerList) return;

        geojsonLayersGroup.current.clearLayers();

        for (const layer of layerList) {
            if (!layer.is_visible_by_default) continue;

            try {
                const res = await axios.get(`${API_BASE}/public/layers/${layer.id}/features`, authHeaders);
                const geojson = res.data;

                if (geojson && geojson.features && geojson.features.length > 0) {
                    // ✅ استخراج أسماء حقول الخصائص للطبقة
                    const sampleProps = geojson.features[0].properties || {};
                    const fields = Object.keys(sampleProps);
                    setLayerFieldsMap(prev => ({ ...prev, [layer.id]: fields }));

                    const style = layer.style_config || {};
                    const isTransparent = style.fill_color === 'transparent' || style.is_transparent;
                    const showLabels = style.show_labels;
                    const labelField = style.label_field;

                    const leafletLayer = L.geoJSON(geojson, {
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

                                // ✅ إضافة مسميات الخصائص كـ Labels مطبوعة على الخريطة
                                if (showLabels && labelField && feature.properties[labelField] !== undefined) {
                                    const val = feature.properties[labelField];
                                    if (val !== null && val !== '') {
                                        l.bindTooltip(String(val), {
                                            permanent: true,
                                            direction: 'center',
                                            className: 'map-feature-label'
                                        });
                                    }
                                }
                            }
                        }
                    });

                    geojsonLayersGroup.current.addLayer(leafletLayer);
                }
            } catch (err) {
                console.error(`Error rendering layer ${layer.layer_name}:`, err);
            }
        }

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

    // 4. Upload Spatial Layer (GeoJSON)
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

        const data = new FormData();
        data.append('file', fileToUpload);
        data.append('layer_name', newLayerName || fileToUpload.name);
        data.append('is_private', newLayerIsPrivate);

        try {
            setLayerUploading(true);
            const res = await axios.post(`${API_BASE}/${selectedPortal.id}/layers`, data, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });

            alert('✅ تم رفع ومعالجة الطبقة بنجاح في Cloudflare R2 & PostGIS');
            setFileToUpload(null);
            setNewLayerName('');
            selectPortal(selectedPortal);
        } catch (err) {
            console.error('Error uploading layer:', err);
            alert(err.response?.data?.error || 'فشل في رفع الملف');
        } finally {
            setLayerUploading(false);
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
        <div className="geoportal-designer-container">
            {/* Sidebar Controls */}
            <div className="designer-sidebar">
                <div className="designer-header">
                    <div className="designer-title">
                        <h2>تصميم البوابة الجغرافية</h2>
                        <span>Geoportal Studio</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                        <button className="icon-btn" title="إنشاء بوابة جديدة" onClick={() => {
                            setSelectedPortal(null);
                            setFormData({ title_ar: 'بوابة جديدة', slug: `portal-${Date.now()}` });
                        }}>
                            ➕ جديدة
                        </button>
                        <button className="icon-btn" title="العودة للوحة الأدمن" onClick={() => navigate('/admin')}>
                            🔙 للوحة الأدمن
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="designer-tabs">
                    <button className={`tab-btn ${activeTab === 'general' ? 'active' : ''}`} onClick={() => setActiveTab('general')}>
                        ⚙️ البوابة
                    </button>
                    <button className={`tab-btn ${activeTab === 'layers' ? 'active' : ''}`} onClick={() => setActiveTab('layers')}>
                        🗺️ الطبقات
                    </button>
                    <button className={`tab-btn ${activeTab === 'domain' ? 'active' : ''}`} onClick={() => setActiveTab('domain')}>
                        🌐 الدومين
                    </button>
                    <button className={`tab-btn ${activeTab === 'auth' ? 'active' : ''}`} onClick={() => setActiveTab('auth')}>
                        🔒 الأمان
                    </button>
                </div>

                {/* Content */}
                <div className="designer-content">
                    {/* General Settings */}
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

                            <div className="form-group">
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
                                            {layerUploading ? 'جاري المعالجة والرفع لـ R2...' : 'رفع ومعالجة الطبقة'}
                                        </button>
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
                                                </div>

                                                <div className="layer-actions">
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

                                                {/* Map Clipping Mask Option */}
                                                <div style={{ gridColumn: 'span 2', marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        <input
                                                            type="checkbox"
                                                            id={`clip_chk_${layer.id}`}
                                                            checked={style.is_clipping_mask || false}
                                                            onChange={e => handleLayerStyleChange(layer.id, { ...style, is_clipping_mask: e.target.checked })}
                                                        />
                                                        <label htmlFor={`clip_chk_${layer.id}`} style={{ fontSize: '0.78rem', color: '#10D9A0', cursor: 'pointer', margin: 0, fontWeight: 700 }}>
                                                            ✂️ قناع قص الخريطة (الصورة الجوية تظهر داخل مضلعات الطبقة فقط والحيط أبيض)
                                                        </label>
                                                    </div>
                                                </div>

                                                {/* Zoom Visibility Thresholds */}
                                                <div style={{ gridColumn: 'span 2', marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                                                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#06D6F2', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                        <span>🔍 نطاق ظهور الطبقة حسَب زوم ومقياس الخريطة</span>
                                                    </div>
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                                        <div>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8' }}>
                                                                <span>أدنى زوم للظهور (Min Zoom)</span>
                                                                <span style={{ color: '#06D6F2', fontWeight: 700 }}>Zoom {style.min_zoom !== undefined ? style.min_zoom : 1}</span>
                                                            </div>
                                                            <input
                                                                type="range"
                                                                min="1"
                                                                max="21"
                                                                step="1"
                                                                className="range-input"
                                                                value={style.min_zoom !== undefined ? style.min_zoom : 1}
                                                                onChange={e => handleLayerStyleChange(layer.id, { ...style, min_zoom: parseInt(e.target.value) })}
                                                            />
                                                        </div>

                                                        <div>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8' }}>
                                                                <span>أقصى زوم للظهور (Max Zoom)</span>
                                                                <span style={{ color: '#06D6F2', fontWeight: 700 }}>Zoom {style.max_zoom !== undefined ? style.max_zoom : 21}</span>
                                                            </div>
                                                            <input
                                                                type="range"
                                                                min="1"
                                                                max="21"
                                                                step="1"
                                                                className="range-input"
                                                                value={style.max_zoom !== undefined ? style.max_zoom : 21}
                                                                onChange={e => handleLayerStyleChange(layer.id, { ...style, max_zoom: parseInt(e.target.value) })}
                                                            />
                                                        </div>
                                                    </div>
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
