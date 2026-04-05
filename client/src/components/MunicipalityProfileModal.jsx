import React, { useState, useEffect, useRef } from 'react';
import { municipalityService, shopService, getImageUrl } from '../services/api';
import ImageCropperModal from './ImageCropperModal';
import './MunicipalityProfileModal.css';

// ─── Section Configuration ─────────────────────────────────────────────────
const SECTIONS = [
    {
        key: 'live_streams',
        label: 'البث المباشر',
        icon: '📡',
        color: '#ef4444',
        bgColor: 'rgba(239,68,68,0.1)',
        borderColor: 'rgba(239,68,68,0.3)',
        description: 'كاميرات مباشرة من الميادين والشوارع'
    },
    {
        key: 'public_squares',
        label: 'الميادين العامة',
        icon: '🏛️',
        color: '#8b5cf6',
        bgColor: 'rgba(139,92,246,0.1)',
        borderColor: 'rgba(139,92,246,0.3)',
        description: 'الساحات والميادين المركزية في المدينة'
    },
    {
        key: 'public_parks',
        label: 'الحدائق العامة',
        icon: '🌳',
        color: '#10b981',
        bgColor: 'rgba(16,185,129,0.1)',
        borderColor: 'rgba(16,185,129,0.3)',
        description: 'حدائق ومتنزهات للترفيه والاسترخاء'
    },
    {
        key: 'services',
        label: 'المرافق الخدماتية',
        icon: '⚙️',
        color: '#f59e0b',
        bgColor: 'rgba(245,158,11,0.1)',
        borderColor: 'rgba(245,158,11,0.3)',
        description: 'المرافق والمكاتب الحكومية والخدمية'
    },
    {
        key: 'tourism',
        label: 'المرافق السياحية',
        icon: '🗺️',
        color: '#06b6d4',
        bgColor: 'rgba(6,182,212,0.1)',
        borderColor: 'rgba(6,182,212,0.3)',
        description: 'المواقع الأثرية والسياحية والمعالم'
    },
    {
        key: 'culture',
        label: 'المرافق الثقافية والمجتمعية',
        icon: '🎭',
        color: '#ec4899',
        bgColor: 'rgba(236,72,153,0.1)',
        borderColor: 'rgba(236,72,153,0.3)',
        description: 'المراكز الثقافية والمكتبات والملاعب'
    }
];

// ─── Helper: Item Card ─────────────────────────────────────────────────────
const ItemCard = ({ item, section, isAdmin, onNavigate, onDelete }) => {
    const [imgError, setImgError] = useState(false);

    return (
        <div className="muni-item-card" onClick={() => onNavigate(item)}>
            <div className="muni-item-image-wrap">
                {item.image_url && !imgError ? (
                    <img
                        src={getImageUrl(item.image_url)}
                        alt={item.name}
                        className="muni-item-image"
                        onError={() => setImgError(true)}
                    />
                ) : (
                    <div className="muni-item-image-placeholder" style={{ background: section.bgColor }}>
                        <span style={{ fontSize: '2rem' }}>{section.icon}</span>
                    </div>
                )}
                <div className="muni-item-nav-badge" style={{ background: section.color, zIndex: 10 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                        <polygon points="3 11 22 2 13 21 11 13 3 11" />
                    </svg>
                </div>
                {isAdmin && (
                    <button
                        className="muni-item-delete"
                        onClick={e => { e.stopPropagation(); onDelete(item.id); }}
                        title="حذف"
                    >
                        ✕
                    </button>
                )}
            </div>
            <div className="muni-item-info">
                <div className="muni-item-name">{item.name}</div>
                {item.description && (
                    <div className="muni-item-desc">{item.description}</div>
                )}
            </div>
        </div>
    );
};

// ─── Helper: Add Item Form ─────────────────────────────────────────────────
const AddItemForm = ({ municipalityId, sectionKey, sectionLabel, onSuccess, onCancel }) => {
    const [form, setForm] = useState({ name: '', latitude: '', longitude: '', description: '' });
    const [image, setImage] = useState(null);
    const [preview, setPreview] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [gettingLoc, setGettingLoc] = useState(false);
    const fileRef = useRef();

    const handleImage = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setImage(file);
        setPreview(URL.createObjectURL(file));
    };

    const getLocation = () => {
        if (!navigator.geolocation) return alert('المتصفح لا يدعم الموقع');
        setGettingLoc(true);
        navigator.geolocation.getCurrentPosition(
            pos => {
                setForm(p => ({
                    ...p,
                    latitude: pos.coords.latitude.toFixed(6),
                    longitude: pos.coords.longitude.toFixed(6)
                }));
                setGettingLoc(false);
            },
            () => { alert('تعذّر الحصول على الموقع'); setGettingLoc(false); }
        );
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.name || !form.latitude || !form.longitude) {
            return alert('يرجى تعبئة الاسم والإحداثيات');
        }
        setSubmitting(true);
        try {
            const fd = new FormData();
            fd.append('name', form.name);
            fd.append('section', sectionKey);
            fd.append('latitude', form.latitude);
            fd.append('longitude', form.longitude);
            if (form.description) fd.append('description', form.description);
            if (image) fd.append('image', image);

            await municipalityService.addItem(municipalityId, fd);
            onSuccess();
        } catch (err) {
            alert('فشل الإضافة: ' + (err.response?.data?.error || err.message));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="muni-add-form">
            <div className="muni-add-form-header">
                <h4>إضافة إلى "{sectionLabel}"</h4>
                <button className="muni-add-form-close" onClick={onCancel}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
                <div className="muni-form-image-upload" onClick={() => fileRef.current?.click()}>
                    {preview ? (
                        <img src={preview} alt="preview" className="muni-form-preview" />
                    ) : (
                        <div className="muni-form-image-placeholder">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <rect x="3" y="3" width="18" height="18" rx="2" />
                                <circle cx="8.5" cy="8.5" r="1.5" />
                                <polyline points="21 15 16 10 5 21" />
                            </svg>
                            <span>اختر صورة (اختياري)</span>
                        </div>
                    )}
                    <input ref={fileRef} type="file" accept="image/*" onChange={handleImage} style={{ display: 'none' }} />
                </div>
                <div className="muni-form-group">
                    <label>الاسم <span style={{ color: '#ef4444' }}>*</span></label>
                    <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
                </div>
                <div className="muni-form-actions">
                    <button type="button" onClick={onCancel}>إلغاء</button>
                    <button type="submit" disabled={submitting}>إضافة</button>
                </div>
            </form>
        </div>
    );
};

// ─── Helper: Live Stream Player ───────────────────────────────────────────
const LiveStreamPlayer = ({ url }) => {
    const videoRef = useRef(null);

    useEffect(() => {
        if (!videoRef.current || !url) return;
        const video = videoRef.current;
        if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = url;
        } else {
            import('https://cdn.jsdelivr.net/npm/hls.js@latest/dist/hls.mjs')
                .then(m => {
                    if (m.default.isSupported()) {
                        const hls = new m.default();
                        hls.loadSource(url);
                        hls.attachMedia(video);
                    }
                })
                .catch(err => console.error("HLS polyfill failed:", err));
        }
    }, [url]);

    return (
        <div className="muni-live-player-wrap" style={{ minHeight: '180px', background: '#000' }}>
            <video ref={videoRef} className="muni-live-video" controls autoPlay muted playsInline style={{ width: '100%', height: 'auto' }} />
            <div className="muni-live-badge">بث مباشر</div>
        </div>
    );
};

// ─── Main Modal ────────────────────────────────────────────────────────────
const MunicipalityProfileModal = ({ shop: initialShop, currentUser, onClose, onNavigate }) => {
    const [shop, setShop] = useState(initialShop);
    const [items, setItems] = useState({});
    const [loading, setLoading] = useState(true);
    const [activeSection, setActiveSection] = useState('live_streams');
    const [addingTo, setAddingTo] = useState(null);
    const [isUpdatingCover, setIsUpdatingCover] = useState(false);
    const [isUpdatingLogo, setIsUpdatingLogo] = useState(false);
    const [cropping, setCropping] = useState(null); 
    
    const isAdmin = currentUser?.role === 'admin';
    const logoFileRef = useRef();
    const coverFileRef = useRef();

    useEffect(() => {
        loadItems();
    }, [shop?.id]);

    const loadItems = async () => {
        if (!shop?.id) return;
        setLoading(true);
        try {
            const profileData = await shopService.getProfile(shop.id);
            if (profileData && profileData.shop) setShop(profileData.shop);

            const data = await municipalityService.getItems(shop.id);
            setItems(data.grouped || {});
        } catch (err) {
            console.error('Failed to load municipality data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateImage = (type, file) => {
        if (!file || !isAdmin) return;
        setCropping({ file, type });
    };

    const uploadCroppedImage = async (croppedFile) => {
        const { type } = cropping;
        setCropping(null);
        if (type === 'logo') setIsUpdatingLogo(true);
        else setIsUpdatingCover(true);
        try {
            const fd = new FormData();
            if (type === 'logo') fd.append('profile_picture', croppedFile);
            else fd.append('cover_picture', croppedFile);
            const result = await shopService.updateShopImages(shop.id, fd);
            if (result.shop) setShop(result.shop);
            alert('تم التحديث! ✨');
        } catch (err) {
            alert('فشل التحديث');
        } finally {
            setIsUpdatingLogo(false);
            setIsUpdatingCover(false);
        }
    };

    const handleDelete = async (itemId) => {
        if (!confirm('حذف؟')) return;
        try {
            await municipalityService.deleteItem(itemId);
            loadItems();
        } catch (err) { alert('فشل الحذف'); }
    };

    const handleNavigate = (item) => {
        if (onNavigate) onNavigate({ lat: item.latitude, lng: item.longitude, name: item.name });
        onClose();
    };

    const totalItems = Object.values(items).reduce((s, arr) => s + (arr?.length || 0), 0);

    return (
        <div className="muni-overlay" onClick={onClose} style={{ zIndex: 1000000 }}>
            <div className="muni-modal" style={{ border: '3px solid red', minHeight: '60vh' }} onClick={e => e.stopPropagation()}>
                
                {/* Debug Header */}
                <div style={{ background: 'yellow', color: 'black', padding: '5px', fontSize: '12px', textAlign: 'center', fontWeight: 'bold' }}>
                    DEBUG: {shop?.name || 'Loading'} | Items: {totalItems}
                </div>

                <div className="muni-header">
                    <div className="muni-header-bg">
                        {shop?.cover_picture ? (
                            <img src={getImageUrl(shop.cover_picture)} alt="" className="muni-cover" />
                        ) : ( <div className="muni-cover-default" /> )}
                        <div className="muni-cover-overlay" />
                        {isAdmin && (
                            <button className="muni-edit-cover" onClick={() => coverFileRef.current?.click()}>📷</button>
                        )}
                        <input ref={coverFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleUpdateImage('cover', e.target.files[0])} />
                    </div>

                    <button className="muni-close-btn" onClick={onClose}>✕</button>

                    <div className="muni-header-content">
                        <div className="muni-logo-wrap rectangle">
                            {shop?.profile_picture ? (
                                <img src={getImageUrl(shop.profile_picture)} alt={shop.name} className="muni-logo rect" />
                            ) : ( <div className="muni-logo-default rect">🏛️</div> )}
                            {isAdmin && (
                                <button className="muni-edit-logo" onClick={() => logoFileRef.current?.click()}>✎</button>
                            )}
                            <input ref={logoFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleUpdateImage('logo', e.target.files[0])} />
                        </div>
                        <div className="muni-title-wrap">
                            <h1 className="muni-name">{shop?.name || 'البلدية'}</h1>
                            <div className="muni-sub-header">مركز الإدارة والتحكم</div>
                        </div>
                    </div>
                </div>

                <div className="muni-body">
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '20px' }}><div className="muni-spinner" /></div>
                    ) : (
                        <div className="muni-sections">
                            {SECTIONS.map(section => {
                                const sectionItems = items[section.key] || [];
                                const isOpen = activeSection === section.key;
                                return (
                                    <div key={section.key} className="muni-section">
                                        <div className="muni-section-header" onClick={() => setActiveSection(isOpen ? null : section.key)}>
                                            <span>{section.icon} {section.label}</span>
                                            {isAdmin && <button onClick={e => { e.stopPropagation(); setAddingTo(section.key); }}>+</button>}
                                        </div>
                                        {isOpen && (
                                            <div className="muni-section-content">
                                                {section.key === 'live_streams' ? (
                                                    <LiveStreamPlayer url="https://htvint.mada.ps/RamallahMunicipality/index.m3u8" />
                                                ) : (
                                                    <div className="muni-items-grid">
                                                        {sectionItems.map(item => <ItemCard key={item.id} item={item} section={section} isAdmin={isAdmin} onNavigate={handleNavigate} onDelete={handleDelete} />)}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {cropping && (
                <ImageCropperModal
                    imageFile={cropping.file}
                    aspect={cropping.type === 'logo' ? 2 / 1 : 16 / 9}
                    onCropDone={uploadCroppedImage}
                    onCancel={() => setCropping(null)}
                />
            )}
        </div>
    );
};

export default MunicipalityProfileModal;
