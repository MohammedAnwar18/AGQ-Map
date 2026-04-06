import React, { useState, useEffect, useRef } from 'react';
import { historicalMapService } from '../services/api';
import './HistoricalTimelinePanel.css';

const HistoricalTimelinePanel = ({ community, currentUser, onLayerChange, opacity = 0.85, onOpacityChange, onFlyTo }) => {
    const [maps, setMaps] = useState([]);
    const [selectedMap, setSelectedMap] = useState(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState({ name: '', year: '', tile_url: '', center_lat: '', center_lng: '', default_zoom: '' });
    const [saving, setSaving] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const scrollRef = useRef(null);

    const isAdmin = currentUser?.role === 'admin';

    useEffect(() => {
        if (!community?.id) return;
        loadMaps();
    }, [community?.id]);

    const loadMaps = async () => {
        try {
            setLoading(true);
            const data = await historicalMapService.getAll(community.id);
            setMaps(data.maps || []);
            // Auto-select first map if available
            if (data.maps && data.maps.length > 0) {
                const first = data.maps[0];
                setSelectedMap(first);
                onLayerChange(first.tile_url, first.name, first.year);
            }
        } catch (e) {
            console.error('Failed to load historical maps:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleSelect = (map) => {
        setSelectedMap(map);
        onLayerChange(map.tile_url, map.name, map.year);
        setShowAddForm(false);
        // Fly to the map's stored coordinates, or Palestine as fallback
        if (onFlyTo) onFlyTo(map.center_lat, map.center_lng, map.default_zoom);
    };

    const handleClearLayer = () => {
        setSelectedMap(null);
        onLayerChange(null, null, null);
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!form.name || !form.year || !form.tile_url) return;
        try {
            setSaving(true);
            const data = await historicalMapService.add(community.id, form);
            setMaps(prev => [...prev, data.map]);
            setForm({ name: '', year: '', tile_url: '', center_lat: '', center_lng: '', default_zoom: '' });
            setShowAddForm(false);
            // Auto-select the newly added map
            handleSelect(data.map);
        } catch (e) {
            console.error('Failed to add map:', e);
            alert('فشل إضافة الطبقة');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (mapId) => {
        try {
            await historicalMapService.delete(community.id, mapId);
            const updated = maps.filter(m => m.id !== mapId);
            setMaps(updated);
            setDeleteConfirm(null);
            if (selectedMap?.id === mapId) {
                if (updated.length > 0) {
                    handleSelect(updated[0]);
                } else {
                    handleClearLayer();
                }
            }
        } catch (e) {
            console.error('Delete failed:', e);
        }
    };

    return (
        <div className="historical-panel">
            {/* Header */}
            <div className="hpanel-header">
                <div className="hpanel-title">
                    <div>
                        <span
                            className={`hpanel-name ${onFlyTo ? 'hpanel-name-clickable' : ''}`}
                            onClick={onFlyTo ? () => onFlyTo() : undefined}
                            title={onFlyTo ? 'اضغط للتوجه إلى فلسطين على الخريطة' : undefined}
                        >
                            {community.name}
                        </span>
                        {selectedMap && (
                            <span className="hpanel-selected-label">
                                {selectedMap.year} — {selectedMap.name}
                            </span>
                        )}
                    </div>
                </div>
                <div className="hpanel-actions">
                    {selectedMap && (
                        <button className="hpanel-clear-btn" onClick={handleClearLayer} title="إيقاف عرض الطبقة">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    )}
                    {isAdmin && (
                        <button
                            className={`hpanel-add-btn ${showAddForm ? 'active' : ''}`}
                            onClick={() => setShowAddForm(!showAddForm)}
                            title="إضافة طبقة تاريخية"
                        >
                            {showAddForm ? '✕' : '+'}
                        </button>
                    )}
                </div>
            </div>

            {/* Add Form - Admin Only */}
            {showAddForm && isAdmin && (
                <form className="hpanel-form" onSubmit={handleAdd}>
                    <div className="hpanel-form-row">
                        <input
                            type="text"
                            placeholder="السنة (مثال: 1917)"
                            value={form.year}
                            onChange={e => setForm(p => ({ ...p, year: e.target.value }))}
                            required
                            className="hpanel-input hpanel-input-sm"
                        />
                        <input
                            type="text"
                            placeholder="الاسم (مثال: الانتداب البريطاني)"
                            value={form.name}
                            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                            required
                            className="hpanel-input"
                        />
                    </div>
                    <input
                        type="url"
                        placeholder="رابط الـ WMTS/XYZ: https://.../{z}/{x}/{y}.png"
                        value={form.tile_url}
                        onChange={e => setForm(p => ({ ...p, tile_url: e.target.value }))}
                        required
                        className="hpanel-input hpanel-input-url"
                    />
                    <div className="hpanel-form-row">
                        <input
                            type="number"
                            placeholder="خط العرض (مثال: 31.9)"
                            value={form.center_lat}
                            onChange={e => setForm(p => ({ ...p, center_lat: e.target.value }))}
                            step="0.0001"
                            className="hpanel-input"
                        />
                        <input
                            type="number"
                            placeholder="خط الطول (مثال: 35.2)"
                            value={form.center_lng}
                            onChange={e => setForm(p => ({ ...p, center_lng: e.target.value }))}
                            step="0.0001"
                            className="hpanel-input"
                        />
                        <input
                            type="number"
                            placeholder="Zoom (8)"
                            value={form.default_zoom}
                            onChange={e => setForm(p => ({ ...p, default_zoom: e.target.value }))}
                            min="1"
                            max="18"
                            className="hpanel-input hpanel-input-sm"
                        />
                    </div>
                    <button type="submit" className="hpanel-save-btn" disabled={saving}>
                        {saving ? '⏳ جاري الحفظ...' : '✓ حفظ الطبقة'}
                    </button>
                </form>
            )}

            {/* Timeline */}
            <div className="hpanel-timeline-wrap" ref={scrollRef}>
                {loading ? (
                    <div className="hpanel-loading">
                        <div className="hpanel-spinner" />
                        <span>جاري التحميل...</span>
                    </div>
                ) : maps.length === 0 ? (
                    <div className="hpanel-empty">
                        {isAdmin ? '← اضغط + لإضافة أول طبقة تاريخية' : 'لا توجد طبقات تاريخية بعد'}
                    </div>
                ) : (
                    <div className="hpanel-timeline">
                        {/* Timeline Line */}
                        <div className="hpanel-line" />

                        {maps.map((map, index) => (
                            <div
                                key={map.id}
                                className={`hpanel-entry ${selectedMap?.id === map.id ? 'active' : ''}`}
                                onClick={() => handleSelect(map)}
                            >
                                {/* Node on timeline */}
                                <div className="hpanel-node">
                                    <div className="hpanel-dot" />
                                </div>

                                {/* Card */}
                                <div className="hpanel-card">
                                    <span className="hpanel-year">{map.year}</span>
                                    <span className="hpanel-card-name">{map.name}</span>

                                    {isAdmin && (
                                        <button
                                            className="hpanel-delete-btn"
                                            onClick={e => { e.stopPropagation(); setDeleteConfirm(map.id); }}
                                            title="حذف"
                                        >
                                            🗑️
                                        </button>
                                    )}
                                </div>

                                {/* Delete confirm popup */}
                                {deleteConfirm === map.id && (
                                    <div className="hpanel-delete-confirm" onClick={e => e.stopPropagation()}>
                                        <span>حذف "{map.year}"؟</span>
                                        <div className="hpanel-confirm-btns">
                                            <button className="hpanel-confirm-yes" onClick={() => handleDelete(map.id)}>نعم</button>
                                            <button className="hpanel-confirm-no" onClick={() => setDeleteConfirm(null)}>لا</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Opacity Slider - shown when a layer is active */}
            {selectedMap && onOpacityChange && (
                <div className="hpanel-opacity-row">
                    <span className="hpanel-opacity-label">
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                            <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                        </svg>
                        الشفافية
                    </span>
                    <input
                        type="range"
                        min="0"
                        max="100"
                        value={Math.round(opacity * 100)}
                        onChange={e => onOpacityChange(Number(e.target.value) / 100)}
                        className="hpanel-opacity-slider"
                    />
                    <span className="hpanel-opacity-val">{Math.round(opacity * 100)}%</span>
                </div>
            )}

            {/* Active layer badge */}
            {selectedMap && (
                <div className="hpanel-active-badge">
                    <span className="hpanel-badge-dot" />
                    <span>طبقة نشطة: {selectedMap.year} – {selectedMap.name}</span>
                </div>
            )}
        </div>
    );
};

export default HistoricalTimelinePanel;
