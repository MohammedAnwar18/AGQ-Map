import React, { useState, useEffect, useRef } from 'react';
import { historicalMapService } from '../services/api';
import './HistoricalTimelinePanel.css';

const EMPTY_FORM = { name: '', year: '', tile_url: '', center_lat: '', center_lng: '', default_zoom: '' };

const HistoricalTimelinePanel = ({ community, currentUser, onLayerChange, opacity = 0.85, onOpacityChange, onFlyTo }) => {
    const [maps, setMaps] = useState([]);
    const [selectedMap, setSelectedMap] = useState(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [editingId, setEditingId] = useState(null);   // which card is being edited
    const scrollRef = useRef(null);

    const isAdmin = currentUser?.role === 'admin';

    // Sort maps by year numerically
    const sortedMaps = [...maps].sort((a, b) => {
        const ya = parseInt(a.year) || 0;
        const yb = parseInt(b.year) || 0;
        return ya - yb;
    });

    useEffect(() => {
        if (!community?.id) return;
        loadMaps();
    }, [community?.id]);

    // Mouse-wheel → horizontal scroll on desktop
    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        const onWheel = (e) => {
            if (e.deltaY !== 0) {
                e.preventDefault();
                el.scrollLeft += e.deltaY * 1.5;
            }
        };
        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
    }, []);

    const loadMaps = async () => {
        try {
            setLoading(true);
            const data = await historicalMapService.getAll(community.id);
            const sorted = (data.maps || []).sort((a, b) => (parseInt(a.year) || 0) - (parseInt(b.year) || 0));
            setMaps(sorted);
            if (sorted.length > 0) {
                const first = sorted[0];
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
        setEditingId(null);
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
            const updated = [...maps, data.map].sort((a, b) => (parseInt(a.year) || 0) - (parseInt(b.year) || 0));
            setMaps(updated);
            setForm(EMPTY_FORM);
            setShowAddForm(false);
            handleSelect(data.map);
        } catch (e) {
            console.error('Failed to add map:', e);
            alert('فشل إضافة الطبقة');
        } finally {
            setSaving(false);
        }
    };

    const startEdit = (map, e) => {
        e.stopPropagation();
        setEditingId(map.id);
        setDeleteConfirm(null);
        setForm({
            name: map.name || '',
            year: map.year || '',
            tile_url: map.tile_url || '',
            center_lat: map.center_lat ?? '',
            center_lng: map.center_lng ?? '',
            default_zoom: map.default_zoom ?? ''
        });
    };

    const handleUpdate = async (mapId, e) => {
        e.preventDefault();
        try {
            setSaving(true);
            const data = await historicalMapService.update(community.id, mapId, form);
            const updated = maps.map(m => m.id === mapId ? data.map : m)
                .sort((a, b) => (parseInt(a.year) || 0) - (parseInt(b.year) || 0));
            setMaps(updated);
            setEditingId(null);
            setForm(EMPTY_FORM);
            if (selectedMap?.id === mapId) {
                setSelectedMap(data.map);
                onLayerChange(data.map.tile_url, data.map.name, data.map.year);
            }
        } catch (e) {
            console.error('Update failed:', e);
            alert('فشل التعديل');
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
            setEditingId(null);
            if (selectedMap?.id === mapId) {
                if (updated.length > 0) handleSelect(updated[0]);
                else handleClearLayer();
            }
        } catch (e) {
            console.error('Delete failed:', e);
        }
    };

    const FormFields = ({ onSubmit, submitLabel }) => (
        <form className="hpanel-form" onSubmit={onSubmit} onClick={e => e.stopPropagation()}>
            <div className="hpanel-form-row">
                <input type="text" placeholder="السنة (مثال: 1917)" value={form.year}
                    onChange={e => setForm(p => ({ ...p, year: e.target.value }))}
                    required className="hpanel-input hpanel-input-sm" />
                <input type="text" placeholder="الاسم (مثال: الانتداب البريطاني)" value={form.name}
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    required className="hpanel-input" />
            </div>
            <input type="url" placeholder="رابط التايل: https://.../{z}/{x}/{y}.png"
                value={form.tile_url}
                onChange={e => setForm(p => ({ ...p, tile_url: e.target.value }))}
                required className="hpanel-input hpanel-input-url" />
            <div className="hpanel-form-row">
                <input type="number" placeholder="خط العرض (31.9)" value={form.center_lat}
                    onChange={e => setForm(p => ({ ...p, center_lat: e.target.value }))}
                    step="0.0001" className="hpanel-input" />
                <input type="number" placeholder="خط الطول (35.2)" value={form.center_lng}
                    onChange={e => setForm(p => ({ ...p, center_lng: e.target.value }))}
                    step="0.0001" className="hpanel-input" />
                <input type="number" placeholder="Zoom" value={form.default_zoom}
                    onChange={e => setForm(p => ({ ...p, default_zoom: e.target.value }))}
                    min="1" max="18" className="hpanel-input hpanel-input-sm" />
            </div>
            <div className="hpanel-form-row">
                <button type="submit" className="hpanel-save-btn" disabled={saving}>
                    {saving ? '⏳ جاري الحفظ...' : submitLabel}
                </button>
                <button type="button" className="hpanel-cancel-btn"
                    onClick={() => { setEditingId(null); setShowAddForm(false); setForm(EMPTY_FORM); }}>
                    إلغاء
                </button>
            </div>
        </form>
    );

    return (
        <div className="historical-panel">
            {/* Header */}
            <div className="hpanel-header">
                <div className="hpanel-title">
                    <div>
                        <span
                            className={`hpanel-name ${onFlyTo ? 'hpanel-name-clickable' : ''}`}
                            onClick={onFlyTo ? () => onFlyTo() : undefined}
                            title={onFlyTo ? 'اضغط للعودة لمركز فلسطين' : undefined}
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
                            onClick={() => { setShowAddForm(!showAddForm); setEditingId(null); setForm(EMPTY_FORM); }}
                            title="إضافة طبقة تاريخية"
                        >
                            {showAddForm ? '✕' : '+'}
                        </button>
                    )}
                </div>
            </div>

            {/* Add Form - Admin Only */}
            {showAddForm && isAdmin && (
                <FormFields onSubmit={handleAdd} submitLabel="✓ حفظ الطبقة" />
            )}

            {/* Timeline - scrollable via touch & wheel */}
            <div className="hpanel-timeline-wrap" ref={scrollRef}>
                {loading ? (
                    <div className="hpanel-loading">
                        <div className="hpanel-spinner" />
                        <span>جاري التحميل...</span>
                    </div>
                ) : sortedMaps.length === 0 ? (
                    <div className="hpanel-empty">
                        {isAdmin ? '← اضغط + لإضافة أول طبقة تاريخية' : 'لا توجد طبقات تاريخية بعد'}
                    </div>
                ) : (
                    <div className="hpanel-timeline">
                        <div className="hpanel-line" />

                        {sortedMaps.map((map) => (
                            <div
                                key={map.id}
                                className={`hpanel-entry ${selectedMap?.id === map.id ? 'active' : ''}`}
                                onClick={() => editingId !== map.id && handleSelect(map)}
                            >
                                {/* Node on timeline */}
                                <div className="hpanel-node">
                                    <div className="hpanel-dot" />
                                </div>

                                {/* Inline Edit Form */}
                                {editingId === map.id ? (
                                    <div className="hpanel-inline-edit">
                                        <FormFields
                                            onSubmit={(e) => handleUpdate(map.id, e)}
                                            submitLabel="✓ تحديث"
                                        />
                                    </div>
                                ) : (
                                    <div className="hpanel-card">
                                        <span className="hpanel-year">{map.year}</span>
                                        <span className="hpanel-card-name">{map.name}</span>

                                        {isAdmin && (
                                            <div className="hpanel-card-actions">
                                                <button
                                                    className="hpanel-edit-btn"
                                                    onClick={e => startEdit(map, e)}
                                                    title="تعديل"
                                                >
                                                    <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                                    </svg>
                                                </button>
                                                <button
                                                    className="hpanel-delete-btn"
                                                    onClick={e => { e.stopPropagation(); setDeleteConfirm(map.id); }}
                                                    title="حذف"
                                                >
                                                    <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                                                        <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                                                    </svg>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}

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

            {/* Opacity Slider */}
            {selectedMap && onOpacityChange && (
                <div className="hpanel-opacity-row">
                    <span className="hpanel-opacity-label">
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/>
                            <line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/>
                            <line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                        </svg>
                        الشفافية
                    </span>
                    <input type="range" min="0" max="100"
                        value={Math.round(opacity * 100)}
                        onChange={e => onOpacityChange(Number(e.target.value) / 100)}
                        className="hpanel-opacity-slider" />
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
