import React, { useState, useEffect } from 'react';
import { shopService, getImageUrl } from '../services/api';
import './Modal.css';

const MunicipalitiesModal = ({ onClose, currentUser, onShopClick, onShopFollowed, followedShops = [] }) => {
    const [municipalities, setMunicipalities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('all'); // 'all' or 'followed'
    
    // Creation State for Admin
    const [isCreating, setIsCreating] = useState(false);
    const [newMuni, setNewMuni] = useState({ name: '', lat: '', lon: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        loadMunicipalities();
    }, []);

    const loadMunicipalities = async () => {
        setLoading(true);
        try {
            const data = await shopService.getAllForMap();
            const shops = data.shops || [];
            // Filter only shops that are municipalities
            const filtered = shops.filter(shop => {
                const cat = (shop.category || '').toLowerCase().trim();
                return cat === 'بلدية' || cat === 'municipality';
            });
            setMunicipalities(filtered);
        } catch (error) {
            console.error("Failed to load municipalities list:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateMunicipality = async (e) => {
        e.preventDefault();
        if (!newMuni.name || !newMuni.lat || !newMuni.lon) {
            alert("يرجى ملء جميع البيانات (الاسم والموقع الجغرافي)");
            return;
        }

        setIsSubmitting(true);
        try {
            const created = await shopService.create({
                name: newMuni.name,
                category: 'بلدية',
                latitude: parseFloat(newMuni.lat),
                longitude: parseFloat(newMuni.lon),
                custom_design: {
                    palette: { name: 'Old Stone', colors: ['#F8F4ED','#EFE8D8','#D4B895','#8B6F47','#3D2817'] },
                    font: { display: 'حِرفة وتُراث', fontFamily: "'Amiri',serif" }
                }
            });

            alert("تم تسجيل بلدية جديدة بنجاح! 🏛️");
            setIsCreating(false);
            setNewMuni({ name: '', lat: '', lon: '' });
            await loadMunicipalities();
            
            // Follow automatically
            try {
                await shopService.follow(created.id);
                if (onShopFollowed) onShopFollowed(created.id, true);
            } catch (err) {
                console.error("Auto-follow created municipality failed", err);
            }
        } catch (error) {
            console.error("Create municipality failed:", error);
            alert("فشل إضافة بلدية جديدة. يرجى التحقق من المدخلات والصلاحيات.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const getMuniCurrentCoordinates = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((pos) => {
                setNewMuni(prev => ({
                    ...prev,
                    lat: pos.coords.latitude.toFixed(6),
                    lon: pos.coords.longitude.toFixed(6)
                }));
            }, () => alert("تعذر الحصول على إحداثيات الموقع الحالي. يرجى تفعيل الـ GPS والتحقق من الأذونات."), { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
        } else {
            alert("المتصفح لا يدعم تحديد الموقع الجغرافي");
        }
    };

    const isFollowing = (muniId) => {
        return followedShops.some(fs => fs.id === muniId);
    };

    const handleFollowToggle = async (e, muni) => {
        e.stopPropagation(); // Prevent clicking card (which opens details/flies to map)
        if (!currentUser) {
            alert('يرجى تسجيل الدخول لمتابعة البلديات');
            return;
        }
        try {
            if (isFollowing(muni.id)) {
                await shopService.unfollow(muni.id);
                if (onShopFollowed) onShopFollowed(muni.id, false);
            } else {
                await shopService.follow(muni.id);
                if (onShopFollowed) onShopFollowed(muni.id, true);
            }
        } catch (error) {
            console.error("Follow toggling failed:", error);
        }
    };

    const isAdmin = currentUser && currentUser.role === 'admin';

    // Filter displayed list based on search and tab selection
    const filteredMunicipalities = municipalities.filter(muni => {
        const matchesSearch = muni.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesTab = activeTab === 'all' || isFollowing(muni.id);
        return matchesSearch && matchesTab;
    });

    return (
        <div className="modal-overlay" onClick={onClose} style={{ zIndex: 10000 }}>
            <div className="modal-container" onClick={e => e.stopPropagation()} style={{ height: '80vh', maxWidth: '600px', display: 'flex', flexDirection: 'column' }}>
                
                {/* Header */}
                <div className="modal-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '15px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(135deg, #fbab15, #f59e0b)', display: 'grid', placeItems: 'center', fontSize: '1.5rem' }}>
                            🏩
                        </div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#f8fafc', fontWeight: '800' }}>البلديات والمجالس المحلية</h2>
                            <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>استكشف البلديات الرسمية، خدماتها، ومعالمها الحضرية</p>
                        </div>
                    </div>
                    <button className="modal-close" onClick={onClose}>✕</button>
                </div>

                {/* Tab Controls & Search */}
                <div style={{ padding: '15px 20px 5px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div className="tabs" style={{ marginBottom: 0 }}>
                        <button className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>
                            جميع البلديات ({municipalities.length})
                        </button>
                        <button className={`tab-btn ${activeTab === 'followed' ? 'active' : ''}`} onClick={() => setActiveTab('followed')}>
                            البلديات المتابعة ({municipalities.filter(m => isFollowing(m.id)).length})
                        </button>
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                        <input
                            type="text"
                            className="input"
                            placeholder="ابحث عن بلدية أو مجلس محلي..."
                            style={{ flex: 1, padding: '10px 15px', fontSize: '0.9rem', background: '#0b0f19', border: '1px solid rgba(255,255,255,0.05)' }}
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                        {isAdmin && !isCreating && (
                            <button className="btn-small is-primary" style={{ background: '#fbab15', color: '#0f172a', fontWeight: 'bold' }} onClick={() => setIsCreating(true)}>
                                + تسجيل بلدية
                            </button>
                        )}
                    </div>
                </div>

                {/* Form to create a municipality for admins */}
                {isCreating && (
                    <div style={{ padding: '15px 20px', background: '#0b0f19', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <form onSubmit={handleCreateMunicipality} className="news-form" style={{ margin: 0, padding: 0, background: 'none', border: 'none' }}>
                            <h4 style={{ margin: '0 0 10px 0', color: '#fbab15', fontSize: '0.95rem' }}>تسجيل بلدية جديدة على الخريطة 🏛️</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <input
                                    type="text"
                                    placeholder="اسم البلدية (مثال: بلدية القدس)..."
                                    className="input"
                                    style={{ fontSize: '0.85rem' }}
                                    value={newMuni.name}
                                    onChange={e => setNewMuni({ ...newMuni, name: e.target.value })}
                                    required
                                />
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                    <input
                                        type="number"
                                        step="any"
                                        placeholder="خط العرض (Lat)..."
                                        className="input"
                                        style={{ fontSize: '0.85rem' }}
                                        value={newMuni.lat}
                                        onChange={e => setNewMuni({ ...newMuni, lat: e.target.value })}
                                        required
                                    />
                                    <input
                                        type="number"
                                        step="any"
                                        placeholder="خط الطول (Lon)..."
                                        className="input"
                                        style={{ fontSize: '0.85rem' }}
                                        value={newMuni.lon}
                                        onChange={e => setNewMuni({ ...newMuni, lon: e.target.value })}
                                        required
                                    />
                                </div>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <button type="button" className="btn-small" style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} onClick={getMuniCurrentCoordinates}>
                                        📍 تحديد موقعي الحالي
                                    </button>
                                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>أو أدخل الإحداثيات يدوياً</span>
                                </div>
                                <div style={{ display: 'flex', gap: '8px', marginTop: '5px' }}>
                                    <button type="submit" disabled={isSubmitting} className="btn-small is-accept" style={{ flex: 1 }}>
                                        {isSubmitting ? 'جاري التسجيل...' : 'تسجيل وإضافة'}
                                    </button>
                                    <button type="button" className="btn-small btn-reject" style={{ flex: 1 }} onClick={() => setIsCreating(false)}>
                                        إلغاء
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                )}

                {/* List Container */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '10px 20px 20px' }}>
                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '150px' }}>
                            <div className="loader-ring"></div>
                        </div>
                    ) : filteredMunicipalities.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px 10px', color: '#94a3b8' }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>🏢</div>
                            <p style={{ margin: 0, fontSize: '0.9rem' }}>
                                {activeTab === 'followed' 
                                    ? 'لم تقم بمتابعة أي بلديات بعد.' 
                                    : 'لا توجد بلديات مطابقة للبحث حالياً.'}
                            </p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {filteredMunicipalities.map(muni => (
                                <div
                                    key={muni.id}
                                    className="shop-card"
                                    onClick={() => onShopClick(muni)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        background: '#0f172a',
                                        border: '1px solid rgba(255,255,255,0.03)',
                                        padding: '12px 16px',
                                        borderRadius: '16px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        direction: 'rtl'
                                    }}
                                    onMouseEnter={e => {
                                        e.currentTarget.style.borderColor = 'rgba(250, 171, 21, 0.2)';
                                        e.currentTarget.style.transform = 'translateY(-1px)';
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.03)';
                                        e.currentTarget.style.transform = 'none';
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ width: '45px', height: '45px', borderRadius: '12px', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                            {muni.profile_picture ? (
                                                <img src={getImageUrl(muni.profile_picture)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                                            ) : (
                                                <span style={{ fontSize: '1.4rem' }}>🏛️</span>
                                            )}
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <h3 style={{ margin: 0, fontSize: '0.95rem', color: '#f8fafc', fontWeight: '700' }}>{muni.name}</h3>
                                            <p style={{ margin: '3px 0 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>
                                                📍 {parseFloat(muni.latitude).toFixed(4)} , {parseFloat(muni.longitude).toFixed(4)}
                                            </p>
                                        </div>
                                    </div>
                                    
                                    <button 
                                        onClick={(e) => handleFollowToggle(e, muni)}
                                        style={{
                                            background: isFollowing(muni.id) ? 'rgba(255, 255, 255, 0.05)' : 'linear-gradient(135deg, #10b981, #059669)',
                                            color: isFollowing(muni.id) ? '#cbd5e1' : '#fff',
                                            border: isFollowing(muni.id) ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
                                            borderRadius: '10px',
                                            padding: '8px 14px',
                                            fontSize: '0.8rem',
                                            fontWeight: 'bold',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease',
                                            fontFamily: 'inherit'
                                        }}
                                    >
                                        {isFollowing(muni.id) ? 'متابعة ✓' : 'متابعة 🔔'}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

export default MunicipalitiesModal;
