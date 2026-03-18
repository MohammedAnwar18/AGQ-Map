import React, { useState, useEffect } from 'react';
import { shopService, getImageUrl } from '../services/api';
import './UniversityProfileModal.css';

const UniversityProfileModal = ({ university, currentUser, onClose, onFollowChange }) => {
    const [activeTab, setActiveTab] = useState('overview');
    const [selectedFacilityCategory, setSelectedFacilityCategory] = useState(null);
    const [facilities, setFacilities] = useState({});
    const [isLoadingFacs, setIsLoadingFacs] = useState(true);
    
    // Create facility state
    const [isCreatingFacility, setIsCreatingFacility] = useState(false);
    const [newFacilityData, setNewFacilityData] = useState({ name: '', category: 'الكليات', icon: '🏛️', lat: '', lon: '', description: '' });

    // Local University State (for bio, cover, etc. not in initial search)
    const [uniData, setUniData] = useState(university);
    const [localProfilePic, setLocalProfilePic] = useState(university.profile_picture);
    const [localCoverPic, setLocalCoverPic] = useState(university.cover_picture || university.cover_image); // accommodate both
    const [isUploadingImage, setIsUploadingImage] = useState(false);

    const predefinedCategories = [
        { name: 'الكليات', defaultIcon: '🏛️' },
        { name: 'المباني', defaultIcon: '🏢' },
        { name: 'الكافتيريات', defaultIcon: '🍔' },
        { name: 'مكتبات', defaultIcon: '📖' },
        { name: 'عيادة', defaultIcon: '🩺' },
        { name: 'بنوك وصرافات', defaultIcon: '🏦' },
        { name: 'ملاعب', defaultIcon: '⚽' },
        { name: 'أخرى', defaultIcon: '📍' }
    ];

    useEffect(() => {
        loadUniversityData();
        loadFacilities();
    }, [university.id]);

    const loadUniversityData = async () => {
        try {
            const data = await shopService.getProfile(university.id);
            setUniData(data.shop);
            setLocalProfilePic(data.shop.profile_picture);
            setLocalCoverPic(data.shop.cover_picture);
        } catch (error) {
            console.error('Failed to load university full data', error);
        }
    };

    const loadFacilities = async () => {
        setIsLoadingFacs(true);
        try {
            const data = await shopService.getFacilities(university.id);
            setFacilities(data.facilities || {});
        } catch (error) {
            console.error('Failed to load facilities', error);
        } finally {
            setIsLoadingFacs(false);
        }
    };

    const handleCreateFacility = async (e) => {
        e.preventDefault();
        try {
            await shopService.addFacility(university.id, {
                ...newFacilityData,
                latitude: parseFloat(newFacilityData.lat),
                longitude: parseFloat(newFacilityData.lon)
            });
            alert('تم إضافة المرفق بنجاح!');
            setIsCreatingFacility(false);
            setNewFacilityData({ name: '', category: 'الكليات', icon: '🏛️', lat: '', lon: '', description: '' });
            loadFacilities();
        } catch (error) {
            console.error('Add facility error', error);
            alert('حدث خطأ أثناء إضافة المرفق');
        }
    };

    const getCurrentLocation = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((pos) => {
                setNewFacilityData(prev => ({
                    ...prev,
                    lat: pos.coords.latitude.toFixed(6),
                    lon: pos.coords.longitude.toFixed(6)
                }));
            }, () => alert("تعذر الحصول على الموقع"));
        } else {
            alert("المتصفح لا يدعم تحديد الموقع");
        }
    };

    const isAdminOrOwner = currentUser?.role === 'admin' || 
                         currentUser?.userId === uniData.owner_id || 
                         currentUser?.id === uniData.owner_id;

    const handleImageUpload = async (e, type) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append(type, file);

        setIsUploadingImage(true);
        try {
            const response = await shopService.uploadImages(university.id, formData);
            if (response.profile_picture || response.cover_picture) {
                if (type === 'profile_picture') {
                    setLocalProfilePic(response.profile_picture);
                } else {
                    setLocalCoverPic(response.cover_picture);
                }
                
                if (onFollowChange) onFollowChange(); 
                alert('تم تحديث الصورة بنجاح!');
            }
        } catch (error) {
            console.error('Image upload failed', error);
            alert('فشل في رفع الصورة.');
        } finally {
            setIsUploadingImage(false);
        }
    };

    const handleFollow = async () => {
        try {
            if (uniData.is_followed) {
                await shopService.unfollow(uniData.id);
            } else {
                await shopService.follow(uniData.id);
            }
            setUniData(prev => ({ ...prev, is_followed: !prev.is_followed }));
            if (onFollowChange) onFollowChange();
        } catch (e) {
            console.error('Follow toggle error', e);
        }
    };

    // Build categories derived from data + predefined
    const categories = Object.keys(facilities);

    const handleFeatureClick = (feature) => {
        // Will be implemented later: open feature page or zoom on map
        alert(`تم النقر على: ${feature.name}. سيتم لاحقاً فتح صفحة مفصلة لهذا المرفق على الخريطة!`);
    };

    return (
        <div className="university-modal-overlay fade-in" onClick={onClose}>
            <div className="university-modal-container slide-up" onClick={e => e.stopPropagation()}>
                
                {/* Header & Cover */}
                <div className="uni-cover-section">
                    <img 
                        src={localCoverPic ? getImageUrl(localCoverPic) : 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80'} 
                        alt="University Cover" 
                        className="uni-cover-img" 
                        style={{ opacity: isUploadingImage ? 0.5 : 1 }}
                    />
                    {isAdminOrOwner && (
                        <label className="upload-btn" style={{ position: 'absolute', top: '20px', right: '60px', background: 'rgba(0,0,0,0.6)', color: 'white', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', zIndex: 10, fontSize: '0.85rem' }}>
                            📷 تغيير الغلاف
                            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleImageUpload(e, 'cover_picture')} disabled={isUploadingImage} />
                        </label>
                    )}
                    <button className="uni-close-btn" onClick={onClose}>✕</button>
                    <div className="uni-cover-overlay"></div>
                    
                    <div className="uni-profile-info">
                        <div className="uni-logo-wrapper" style={{ position: 'relative' }}>
                            <img 
                                src={localProfilePic ? getImageUrl(localProfilePic) : (uniData.profile_picture ? getImageUrl(uniData.profile_picture) : 'https://cdn-icons-png.flaticon.com/512/3202/3202796.png')} 
                                alt="University Logo" 
                                className="uni-logo-img" 
                                style={{ opacity: isUploadingImage ? 0.5 : 1 }}
                            />
                            {isAdminOrOwner && (
                                <label style={{ position: 'absolute', bottom: 0, right: 0, background: '#3b82f6', color: 'white', width: '30px', height: '30px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.3)', border: '2px solid white' }}>
                                    +
                                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleImageUpload(e, 'profile_picture')} disabled={isUploadingImage} />
                                </label>
                            )}
                        </div>
                        <div className="uni-title-section">
                            <h2 className="uni-name">{uniData.name}</h2>
                            <p className="uni-category">مؤسسة تعليمية ذكية 🎓</p>
                        </div>
                        <button className="uni-follow-btn" onClick={(e) => { e.stopPropagation(); handleFollow(); }}>
                            {uniData.is_followed ? 'إلغاء المتابعة 🔔' : 'متابعة الجامعة 🔔'}
                        </button>
                    </div>
                </div>

                {/* Navigation Tabs */}
                <div className="uni-tabs">
                    <button className={`uni-tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
                        الرئيسية
                    </button>
                    <button className={`uni-tab ${activeTab === 'facilities' ? 'active' : ''}`} onClick={() => setActiveTab('facilities')}>
                        المرافق التفاعلية
                    </button>
                    <button className={`uni-tab ${activeTab === 'news' ? 'active' : ''}`} onClick={() => setActiveTab('news')}>
                        الأخبار والإعلانات
                    </button>
                </div>

                {/* Content Area */}
                <div className="uni-content-area">
                    {activeTab === 'overview' && (
                        <div className="uni-overview-tab">
                            <div className="uni-about-card">
                                <h3>عن الجامعة</h3>
                                <p>مرحباً بك في الحرم الجامعي الذكي. من خلال هذه الصفحة يمكنك استكشاف جميع مرافق الجامعة، كلياتها، وخدماتها بشكل تفاعلي على الخريطة.</p>
                            </div>
                            <div className="uni-quick-stats">
                                <div className="stat-box">
                                    <span className="stat-value">{facilities['الكليات']?.length || 0}</span>
                                    <span className="stat-label">كليات</span>
                                </div>
                                <div className="stat-box">
                                    <span className="stat-value">{Object.values(facilities).flat().length}</span>
                                    <span className="stat-label">مرفق</span>
                                </div>
                            </div>

                            <div className="uni-about-card" style={{ marginTop: '15px' }}>
                                <h3>الوصف</h3>
                                <p>{uniData.bio || 'لا يوجد وصف متاح حالياً.'}</p>
                            </div>
                            
                            {isAdminOrOwner && (
                                <div style={{ marginTop: '20px', textAlign: 'center' }}>
                                    <button 
                                        className="uni-follow-btn" 
                                        style={{ background: '#3b82f6', boxShadow: '0 4px 10px rgba(59, 130, 246, 0.4)' }}
                                        onClick={() => { setActiveTab('facilities'); setIsCreatingFacility(true); }}
                                    >
                                        + إضافة مرفق جديد للجامعة
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'facilities' && (
                        <div className="uni-facilities-tab">
                            {isCreatingFacility ? (
                                <div className="uni-create-facility slide-in-right">
                                    <button className="uni-back-btn" onClick={() => setIsCreatingFacility(false)}>
                                        &rarr; رجوع
                                    </button>
                                    <h3 className="section-title" style={{ marginTop: 0 }}>إضافة مرفق جديد</h3>
                                    <form onSubmit={handleCreateFacility} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                        <div>
                                            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>اسم المرفق</label>
                                            <input type="text" className="input" placeholder="مثل: كلية الهندسة" value={newFacilityData.name} onChange={e => setNewFacilityData({ ...newFacilityData, name: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--bg-tertiary)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} required />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>التصنيف</label>
                                            <select className="input" value={newFacilityData.category} onChange={e => {
                                                const cat = e.target.value;
                                                const defIcon = predefinedCategories.find(c => c.name === cat)?.defaultIcon || '📍';
                                                setNewFacilityData({ ...newFacilityData, category: cat, icon: defIcon });
                                            }} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--bg-tertiary)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
                                                {predefinedCategories.map(c => (
                                                    <option key={c.name} value={c.name}>{c.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>الأيقونة (إيموجي)</label>
                                            <input type="text" className="input" placeholder="🏛️" value={newFacilityData.icon} onChange={e => setNewFacilityData({ ...newFacilityData, icon: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--bg-tertiary)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} required maxLength={5} />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>الموقع على الخريطة</label>
                                            <div style={{ display: 'flex', gap: '10px' }}>
                                                <input type="number" step="any" placeholder="خط العرض" value={newFacilityData.lat} onChange={e => setNewFacilityData({ ...newFacilityData, lat: e.target.value })} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--bg-tertiary)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} required />
                                                <input type="number" step="any" placeholder="خط الطول" value={newFacilityData.lon} onChange={e => setNewFacilityData({ ...newFacilityData, lon: e.target.value })} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--bg-tertiary)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} required />
                                            </div>
                                            <button type="button" className="btn-small" onClick={getCurrentLocation} style={{ marginTop: '10px', width: '100%', background: '#10b981', color: 'white', border: 'none' }}>
                                                📍 تحديد إحداثيات موقعي الحالي
                                            </button>
                                        </div>
                                        <button type="submit" className="uni-follow-btn" style={{ marginTop: '10px' }}>حفظ المرفق</button>
                                    </form>
                                </div>
                            ) : !selectedFacilityCategory ? (
                                <div className="uni-categories-grid">
                                    {categories.length === 0 ? (
                                        <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                                            لم يتم إضافة أي مرافق بعد.<br/>
                                            {isAdminOrOwner && <button onClick={() => setIsCreatingFacility(true)} style={{ background: 'none', color: '#10b981', border: 'none', cursor: 'pointer', marginTop: '10px', fontSize: '1rem', fontWeight: 'bold' }}>إضافة مرفق الآن</button>}
                                        </div>
                                    ) : categories.map((cat, index) => (
                                        <div key={index} className="uni-category-card" onClick={() => setSelectedFacilityCategory(cat)}>
                                            <div className="cat-icon-large">
                                                {facilities[cat][0]?.icon || '📍'}
                                            </div>
                                            <h4>{cat}</h4>
                                            <span>{facilities[cat].length} مرفق</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="uni-facility-list-view slide-in-right">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                        <button className="uni-back-btn" onClick={() => setSelectedFacilityCategory(null)} style={{ marginBottom: 0 }}>
                                            &rarr; رجوع للتصنيفات
                                        </button>
                                        {isAdminOrOwner && (
                                            <button onClick={() => setIsCreatingFacility(true)} style={{ background: 'none', color: '#3b82f6', border: 'none', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 'bold' }}>
                                                + إضافة
                                            </button>
                                        )}
                                    </div>
                                    <h3 className="section-title">مرافق {selectedFacilityCategory}</h3>
                                    
                                    <div className="uni-items-list">
                                        {facilities[selectedFacilityCategory]?.map(item => (
                                            <div key={item.id} className="uni-list-item" onClick={() => handleFeatureClick(item)}>
                                                <div className="item-icon">{item.icon}</div>
                                                <div className="item-details">
                                                    <h4>{item.name}</h4>
                                                    <p>انقر لعرض التفاصيل على الخريطة</p>
                                                </div>
                                                <div className="item-action">
                                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'news' && (
                        <div className="uni-news-tab">
                            <div className="empty-state">
                                <p>لا توجد إعلانات حالياً.</p>
                            </div>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

export default UniversityProfileModal;
