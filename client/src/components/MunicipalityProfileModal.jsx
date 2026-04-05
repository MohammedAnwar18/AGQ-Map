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
                <div className="muni-item-nav-badge" style={{ background: section.color }}>
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
                {/* Image Upload */}
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

                {/* Name */}
                <div className="muni-form-group">
                    <label>الاسم <span style={{ color: '#ef4444' }}>*</span></label>
                    <input
                        type="text"
                        placeholder="مثال: حديقة الجدار"
                        value={form.name}
                        onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                        required
                    />
                </div>

                {/* Description */}
                <div className="muni-form-group">
                    <label>وصف مختصر (اختياري)</label>
                    <input
                        type="text"
                        placeholder="وصف قصير عن المكان"
                        value={form.description}
                        onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                    />
                </div>

                {/* Coordinates */}
                <div className="muni-form-group">
                    <label>الإحداثيات <span style={{ color: '#ef4444' }}>*</span></label>
                    <div className="muni-form-coords">
                        <input
                            type="number" step="any"
                            placeholder="خط العرض (Lat)"
                            value={form.latitude}
                            onChange={e => setForm(p => ({ ...p, latitude: e.target.value }))}
                        />
                        <input
                            type="number" step="any"
                            placeholder="خط الطول (Lon)"
                            value={form.longitude}
                            onChange={e => setForm(p => ({ ...p, longitude: e.target.value }))}
                        />
                    </div>
                    <button type="button" className="muni-loc-btn" onClick={getLocation} disabled={gettingLoc}>
                        {gettingLoc ? (
                            <span className="muni-spinner-sm" />
                        ) : (
                            <>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" />
                                    <line x1="12" y1="2" x2="12" y2="4" /><line x1="12" y1="20" x2="12" y2="22" />
                                    <line x1="2" y1="12" x2="4" y2="12" /><line x1="20" y1="12" x2="22" y2="12" />
                                </svg>
                                استخدام موقعي الحالي
                            </>
                        )}
                    </button>
                </div>

                <div className="muni-form-actions">
                    <button type="button" className="muni-btn-cancel" onClick={onCancel}>إلغاء</button>
                    <button type="submit" className="muni-btn-submit" disabled={submitting}>
                        {submitting ? <span className="muni-spinner-sm" /> : 'إضافة'}
                    </button>
                </div>
            </form>
        </div>
    );
};

// ─── Helper: Live Stream Player ───────────────────────────────────────────
const LiveStreamPlayer = ({ url }) => {
    const videoRef = useRef(null);

    useEffect(() => {
        let hls;
        if (videoRef.current) {
            const video = videoRef.current;
            if (video.canPlayType('application/vnd.apple.mpegurl')) {
                // Native HLS support (Safari/iOS)
                video.src = url;
            } else {
                // Fallback to HLS.js (load dynamically)
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/hls.js@latest';
                script.onload = () => {
                    if (window.Hls.isSupported()) {
                        hls = new window.Hls();
                        hls.loadSource(url);
                        hls.attachMedia(video);
                    }
                };
                document.head.appendChild(script);
            }
        }
        return () => {
            if (hls) hls.destroy();
        };
    }, [url]);

    return (
        <div className="muni-live-player-wrap">
            <video ref={videoRef} className="muni-live-video" controls autoPlay muted playsInline />
            <div className="muni-live-badge">بث مباشر</div>
        </div>
    );
};

// ─── Main Modal ────────────────────────────────────────────────────────────
const MunicipalityProfileModal = ({ shop: initialShop, currentUser, onClose, onNavigate }) => {
    const [shop, setShop] = useState(initialShop);
    const [items, setItems] = useState({});
    const [loading, setLoading] = useState(true);
    const [activeSection, setActiveSection] = useState(null);
    const [addingTo, setAddingTo] = useState(null);
    const [isUpdatingCover, setIsUpdatingCover] = useState(false);
    const [isUpdatingLogo, setIsUpdatingLogo] = useState(false);
    const [cropping, setCropping] = useState(null); // { file, type }
    
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
            // 1. طلب البروفايل الكامل للتأكد من وجود الغلاف والوصف وكل شيء
            const profileData = await shopService.getProfile(shop.id);
            if (profileData && profileData.shop) {
                setShop(profileData.shop);
            }

            // 2. طلب المرافق التابعة للبلدية
            const data = await municipalityService.getItems(shop.id);
            setItems(data.grouped || {});
            
            // Auto open live streams then public parks if available
            if (activeSection === null) {
                setActiveSection('live_streams');
            }
        } catch (err) {
            console.error('Failed to load municipality data:', err);
        } finally {
            setLoading(false);
        }
    };

    // المرحلة الأولى: اختيار الملف وفتحة في الـ Cropper
    const handleUpdateImage = (type, file) => {
        if (!file) return;
        if (!isAdmin) return alert('ليس لديك صلاحية لتغيير الصور');
        
        setCropping({ file, type });
    };

    // المرحلة الثانية: رفع الصورة بعد قصها
    const uploadCroppedImage = async (croppedFile) => {
        const { type } = cropping;
        setCropping(null); // إغلاق المودال 

        if (type === 'logo') setIsUpdatingLogo(true);
        else setIsUpdatingCover(true);

        try {
            console.log(`🚀 Uploading cropped ${type}...`);
            const fd = new FormData();
            if (type === 'logo') fd.append('profile_picture', croppedFile);
            else fd.append('cover_picture', croppedFile);

            const result = await shopService.updateShopImages(shop.id, fd);
            if (result.shop) {
                setShop(result.shop);
            } else {
                const updated = await shopService.getProfile(shop.id);
                if (updated && updated.shop) setShop(updated.shop);
            }
            alert('تم التحديث بنجاح! ✨');
        } catch (err) {
            console.error('❌ Upload Error:', err);
            alert('فشل التحديث: ' + (err.response?.data?.error || err.message));
        } finally {
            setIsUpdatingLogo(false);
            setIsUpdatingCover(false);
        }
    };

    const handleDelete = async (itemId) => {
        if (!confirm('هل تريد حذف هذا العنصر؟')) return;
        try {
            await municipalityService.deleteItem(itemId);
            loadItems();
        } catch (err) {
            alert('فشل الحذف');
        }
    };

    const handleNavigate = (item) => {
        if (onNavigate) {
            onNavigate({ lat: item.latitude, lng: item.longitude, name: item.name });
        }
        onClose();
    };

    const totalItems = Object.values(items).reduce((s, arr) => s + (arr?.length || 0), 0);

    return (
        <div className="muni-overlay" onClick={onClose}>
            <div className="muni-modal" onClick={e => e.stopPropagation()}>

                {/* ── Header ── */}
                <div className="muni-header">
                    <div className="muni-header-bg">
                        {shop?.cover_picture ? (
                            <img src={getImageUrl(shop.cover_picture)} alt="" className="muni-cover" />
                        ) : (
                            <div className="muni-cover-default" />
                        )}
                        <div className="muni-cover-overlay" />
                        
                        {isAdmin && (
                            <button className="muni-edit-cover" onClick={() => coverFileRef.current?.click()} disabled={isUpdatingCover}>
                                {isUpdatingCover ? <span className="muni-spinner-sm" /> : 'تغيير الغلاف 📷'}
                            </button>
                        )}
                        <input ref={coverFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleUpdateImage('cover', e.target.files[0])} />
                    </div>

                    <button className="muni-close-btn" onClick={onClose}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>

                    <div className="muni-header-content">
                        <div className="muni-logo-wrap rectangle">
                            {shop?.profile_picture ? (
                                <img src={getImageUrl(shop.profile_picture)} alt={shop.name} className="muni-logo rect" />
                            ) : (
                                <div className="muni-logo-default rect">🏛️</div>
                            )}
                            {isAdmin && (
                                <button className="muni-edit-logo" onClick={() => logoFileRef.current?.click()} disabled={isUpdatingLogo}>
                                    {isUpdatingLogo ? <span className="muni-spinner-sm" /> : '✎'}
                                </button>
                            )}
                            <input ref={logoFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleUpdateImage('logo', e.target.files[0])} />
                            
                            <div className="muni-verified-badge" title="بلدية رسمية">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                        </div>
                        <div className="muni-title-wrap">
                            <h1 className="muni-name">{shop?.name || 'بلدية'}</h1>
                            <div className="muni-sub-header">مركز الإدارة والتحكم الذكي</div>
                            {shop?.bio && <p className="muni-bio">{shop.bio}</p>}
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="muni-stats">
                        <div className="muni-stat">
                            <span className="muni-stat-value">{totalItems}</span>
                            <span className="muni-stat-label">مرفق</span>
                        </div>
                        <div className="muni-stat-divider" />
                        <div className="muni-stat">
                            <span className="muni-stat-value">{SECTIONS.length}</span>
                            <span className="muni-stat-label">قسم</span>
                        </div>
                        <div className="muni-stat-divider" />
                        <div className="muni-stat">
                            <span className="muni-stat-value">{shop?.followers_count || 0}</span>
                            <span className="muni-stat-label">متابع</span>
                        </div>
                    </div>
                </div>

                {/* ── Body ── */}
                <div className="muni-body">
                    {loading ? (
                        <div className="muni-loading">
                            <div className="muni-spinner" />
                            <p>جاري تحميل المرافق...</p>
                        </div>
                    ) : (
                        <div className="muni-sections">
                            {SECTIONS.map(section => {
                                const sectionItems = items[section.key] || [];
                                const isLiveSection = section.key === 'live_streams';
                                const isOpen = isLiveSection || activeSection === section.key;

                                return (
                                    <div key={section.key} className={`muni-section ${isLiveSection ? 'muni-section-live' : ''}`}>
                                        {/* Section Header (Hidden for live streams) */}
                                        {!isLiveSection && (
                                            <div
                                                className={`muni-section-header ${isOpen ? 'open' : ''}`}
                                                style={{ borderColor: section.borderColor }}
                                                onClick={() => setActiveSection(isOpen ? null : section.key)}
                                            >
                                                <div className="muni-section-left">
                                                    <div className="muni-section-icon" style={{ background: section.bgColor, color: section.color }}>
                                                        {section.icon}
                                                    </div>
                                                    <div className="muni-section-info">
                                                        <div className="muni-section-title" style={{ color: section.color }}>
                                                            {section.label}
                                                        </div>
                                                        <div className="muni-section-desc">{section.description}</div>
                                                    </div>
                                                </div>
                                                <div className="muni-section-right">
                                                    {sectionItems.length > 0 && (
                                                        <span className="muni-count-badge" style={{ background: section.color }}>
                                                            {sectionItems.length}
                                                        </span>
                                                    )}
                                                    {isAdmin && (
                                                        <button
                                                            className="muni-add-btn"
                                                            style={{ background: section.color }}
                                                            onClick={e => {
                                                                e.stopPropagation();
                                                                setAddingTo(section.key);
                                                                setActiveSection(section.key);
                                                            }}
                                                            title="إضافة عنصر"
                                                        >
                                                            +
                                                        </button>
                                                    )}
                                                    <div className={`muni-chevron ${isOpen ? 'open' : ''}`}>
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                            <polyline points="6 9 12 15 18 9" />
                                                        </svg>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Section Content */}
                                        {isOpen && (
                                            <div className="muni-section-content">
                                                {isLiveSection ? (
                                                    <div className="muni-live-container">
                                                        <div className="muni-live-header">
                                                            <div className="muni-live-dot" />
                                                            <span>{section.label} - الميدان الرئيسي</span>
                                                        </div>
                                                        <LiveStreamPlayer url="https://htvint.mada.ps/RamallahMunicipality/index.m3u8" />
                                                    </div>
                                                ) : (
                                                    <>
                                                        {/* Add Form */}
                                                        {addingTo === section.key && (
                                                            <AddItemForm
                                                                municipalityId={shop.id}
                                                                sectionKey={section.key}
                                                                sectionLabel={section.label}
                                                                onSuccess={() => {
                                                                    setAddingTo(null);
                                                                    loadItems();
                                                                }}
                                                                onCancel={() => setAddingTo(null)}
                                                            />
                                                        )}

                                                        {/* Items Grid */}
                                                        {sectionItems.length === 0 && addingTo !== section.key ? (
                                                            <div className="muni-empty-section">
                                                                <span style={{ fontSize: '2.5rem', opacity: 0.4 }}>{section.icon}</span>
                                                                <p>لا توجد عناصر في هذا القسم بعد</p>
                                                                {isAdmin && (
                                                                    <button
                                                                        className="muni-add-first"
                                                                        style={{ color: section.color, borderColor: section.borderColor }}
                                                                        onClick={() => setAddingTo(section.key)}
                                                                    >
                                                                        + إضافة أول عنصر
                                                                    </button>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div className="muni-items-grid">
                                                                {sectionItems.map(item => (
                                                                    <ItemCard
                                                                        key={item.id}
                                                                        item={item}
                                                                        section={section}
                                                                        isAdmin={isAdmin}
                                                                        onNavigate={handleNavigate}
                                                                        onDelete={handleDelete}
                                                                    />
                                                                ))}
                                                            </div>
                                                        )}
                                                    </>
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

            {/* ── Cropping Modal ── */}
            {cropping && (
                <ImageCropperModal
                    imageFile={cropping.file}
                    aspect={cropping.type === 'logo' ? 2 / 1 : 16 / 9} // Logo is rectangular (2:1), Cover 16:9
                    onCropDone={uploadCroppedImage}
                    onCancel={() => setCropping(null)}
                />
            )}
        </div>
    );
};


export default MunicipalityProfileModal;
