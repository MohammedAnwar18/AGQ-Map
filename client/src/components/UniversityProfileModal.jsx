import React, { useState, useEffect } from 'react';
import { shopService, getImageUrl } from '../services/api';
import './UniversityProfileModal.css';

const TrashIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    </svg>
);

const HeartIcon = ({ filled }) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
    </svg>
);

const MessageIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
    </svg>
);

const EditIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
    </svg>
);

const UniversityProfileModal = ({ university, currentUser, onClose, onFollowChange, onFacilityClick }) => {
    const [activeTab, setActiveTab] = useState('overview');
    const [selectedFacilityCategory, setSelectedFacilityCategory] = useState(null);
    const [facilities, setFacilities] = useState({});
    const [isLoadingFacs, setIsLoadingFacs] = useState(true);
    
    // Create facility state
    const [isCreatingFacility, setIsCreatingFacility] = useState(false);
    const [newFacilityData, setNewFacilityData] = useState({ name: '', category: 'الكليات', icon: '🏛️', lat: '', lon: '', description: '' });

    // University News State
    const [uniNews, setUniNews] = useState([]);
    const [isSubmittingNews, setIsSubmittingNews] = useState(false);
    const [showNewsForm, setShowNewsForm] = useState(false);
    const [newNews, setNewNews] = useState({ content: '', title: '', external_link: '', post_type: 'news' });
    const [newsMedia, setNewsMedia] = useState(null);
    const [activeCommentPost, setActiveCommentPost] = useState(null);
    const [newComment, setNewComment] = useState('');
    const [comments, setComments] = useState({}); // { postId: [comments] }

    // Admin/Settings State
    const [isAssigningOwner, setIsAssigningOwner] = useState(false);
    const [ownerUsername, setOwnerUsername] = useState('');
    const [isEditingHours, setIsEditingHours] = useState(false);
    const [hoursInput, setHoursInput] = useState(university.opening_hours || '');
    const [isEditingAbout, setIsEditingAbout] = useState(false);
    const [aboutInput, setAboutInput] = useState(university.bio || '');
    const [isEditingName, setIsEditingName] = useState(false);
    const [nameInput, setNameInput] = useState(university.name || '');

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
            setUniNews(data.posts || []);
        } catch (error) {
            console.error('Failed to load university full data', error);
        }
    };

    const handleCreateNews = async (e) => {
        e.preventDefault();
        setIsSubmittingNews(true);
        try {
            const formData = new FormData();
            formData.append('content', newNews.content);
            formData.append('title', newNews.title);
            formData.append('external_link', newNews.external_link);
            formData.append('post_type', newNews.post_type);
            if (newsMedia) formData.append('images', newsMedia);

            await shopService.createPost(university.id, formData);
            alert('تم نشر الخبر بنجاح!');
            setShowNewsForm(false);
            setNewNews({ content: '', title: '', external_link: '', post_type: 'news' });
            setNewsMedia(null);
            loadUniversityData();
        } catch (e) {
            alert('فشل في نشر الخبر');
        } finally {
            setIsSubmittingNews(false);
        }
    };

    const handleLikePost = async (postId) => {
        try {
            const { liked } = await shopService.togglePostLike(postId);
            setUniNews(prev => prev.map(p => 
                p.id === postId 
                    ? { ...p, is_liked: liked, likes_count: liked ? (p.likes_count + 1) : (p.likes_count - 1) } 
                    : p
            ));
        } catch (e) { console.error(e); }
    };

    const loadComments = async (postId) => {
        try {
            const data = await shopService.getPostComments(postId);
            setComments(prev => ({ ...prev, [postId]: data }));
        } catch (e) { console.error(e); }
    };

    const handleAddComment = async (e, postId) => {
        e.preventDefault();
        if (!newComment.trim()) return;
        try {
            const comment = await shopService.addPostComment(postId, newComment);
            setComments(prev => ({ 
                ...prev, 
                [postId]: [...(prev[postId] || []), comment] 
            }));
            setUniNews(prev => prev.map(p => p.id === postId ? { ...p, comments_count: (p.comments_count || 0) + 1 } : p));
            setNewComment('');
        } catch (e) { console.error(e); }
    };

    const handleDeletePost = async (postId) => {
        if (!confirm('هل أنت متأكد من حذف هذا المنشور؟')) return;
        try {
            await shopService.deletePost(university.id, postId);
            setUniNews(prev => prev.filter(p => p.id !== postId));
            alert('تم حذف المنشور بنجاح.');
        } catch (e) {
            alert('فشل حذف المنشور.');
        }
    };

    const handleAssignOwner = async (e) => {
        e.preventDefault();
        if (!ownerUsername.trim()) return;
        try {
            await shopService.assignOwner(university.id, ownerUsername);
            alert(`تم تعيين ${ownerUsername} كمسؤول للصفحة بنجاح!`);
            setIsAssigningOwner(false);
            setOwnerUsername('');
            loadUniversityData();
        } catch (error) {
            alert(error.response?.data?.error || 'فشل تعيين المسؤول. تأكد من صحة اسم المستخدم.');
        }
    };

    const handleUpdateHours = async () => {
        try {
            await shopService.updateProfile(university.id, { opening_hours: hoursInput });
            setUniData(prev => ({ ...prev, opening_hours: hoursInput }));
            setIsEditingHours(false);
            alert('تم تحديث ساعات العمل بنجاح!');
        } catch (error) {
            alert('فشل تحديث ساعات العمل');
        }
    };

    const handleUpdateAbout = async () => {
        try {
            await shopService.updateProfile(university.id, { bio: aboutInput });
            setUniData(prev => ({ ...prev, bio: aboutInput }));
            setIsEditingAbout(false);
            alert('تم تحديث معلومات "عن الجامعة" بنجاح!');
        } catch (error) {
            alert('فشل تحديث المعلومات');
        }
    };

    const handleUpdateName = async () => {
        if (!nameInput.trim()) return;
        try {
            await shopService.updateProfile(university.id, { name: nameInput });
            setUniData(prev => ({ ...prev, name: nameInput }));
            setIsEditingName(false);
            if (onFollowChange) onFollowChange(); // Refresh maps with new name
            alert('تم تحديث اسم المؤسسة بنجاح!');
        } catch (error) {
            alert('فشل تحديث الاسم');
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
            setUniData(prev => ({ 
                ...prev, 
                is_followed: !prev.is_followed,
                followers_count: !prev.is_followed ? (prev.followers_count + 1) : (prev.followers_count - 1)
            }));
            if (onFollowChange) onFollowChange();
        } catch (e) {
            console.error('Follow toggle error', e);
        }
    };

    // Build categories derived from data + predefined
    const categories = Object.keys(facilities);

    const handleFeatureClick = (feature) => {
        if (onFacilityClick) {
            onFacilityClick(feature);
        } else {
            alert(`تم النقر على: ${feature.name}.`);
        }
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
                            {isEditingName ? (
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <input 
                                        type="text" 
                                        value={nameInput} 
                                        onChange={e => setNameInput(e.target.value)}
                                        className="input"
                                        style={{ height: '35px', padding: '5px 10px', fontSize: '1.2rem', fontWeight: 'bold' }}
                                        autoFocus
                                    />
                                    <button className="btn-small is-accept" onClick={handleUpdateName}>حفظ</button>
                                    <button className="btn-small" onClick={() => setIsEditingName(false)}>✕</button>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <h2 className="uni-name">{uniData.name}</h2>
                                    {isAdminOrOwner && (
                                        <button 
                                            onClick={() => { setIsEditingName(true); setNameInput(uniData.name); }} 
                                            style={{ 
                                                background: 'rgba(251, 171, 21, 0.15)', border: 'none', color: '#fbab15', 
                                                cursor: 'pointer', padding: '6px', borderRadius: '50%',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                transition: 'all 0.2s ease'
                                            }}
                                            title="تعديل الاسم"
                                            onMouseOver={e => e.currentTarget.style.transform = 'scale(1.1)'}
                                            onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
                                        >
                                            <EditIcon />
                                        </button>
                                    )}
                                </div>
                            )}
                            <p className="uni-category">مؤسسة تعليمية</p>
                            <div className="uni-followers-count" style={{ fontSize: '0.85rem', color: '#ccc', marginTop: '4px' }}>
                                {uniData.followers_count || 0} متابع
                            </div>
                        </div>
                        <button className={`uni-follow-btn ${uniData.is_followed ? 'is-unfollow' : ''}`} onClick={handleFollow}>
                            {uniData.is_followed ? 'إلغاء المتابعة' : 'متابعة'}
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
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                    <h3>عن الجامعة</h3>
                                    {isAdminOrOwner && !isEditingAbout && (
                                        <button 
                                            onClick={() => { setIsEditingAbout(true); setAboutInput(uniData.bio || ''); }}
                                            style={{ 
                                                background: 'rgba(251, 171, 21, 0.15)', border: 'none', color: '#fbab15', 
                                                cursor: 'pointer', padding: '6px', borderRadius: '50%',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                transition: 'all 0.2s ease'
                                            }}
                                            onMouseOver={e => e.currentTarget.style.transform = 'scale(1.1)'}
                                            onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
                                        >
                                            <EditIcon />
                                        </button>
                                    )}
                                </div>
                                {isEditingAbout ? (
                                    <div className="hours-edit-panel">
                                        <textarea 
                                            value={aboutInput} 
                                            onChange={e => setAboutInput(e.target.value)} 
                                            placeholder="اكتب نبذة عن الجامعة وطبيعة عملها..."
                                            className="textarea"
                                            rows={4}
                                        />
                                        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                            <button className="btn-small is-accept" onClick={handleUpdateAbout}>حفظ</button>
                                            <button className="btn-small" onClick={() => setIsEditingAbout(false)}>إلغاء</button>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="bio-display">{uniData.bio || 'مرحباً بك في الحرم الجامعي الذكي. لا يوجد وصف متاح حالياً.'}</p>
                                )}
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
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                    <h3>أوقات الدوام</h3>
                                    {isAdminOrOwner && !isEditingHours && (
                                        <button 
                                            onClick={() => setIsEditingHours(true)}
                                            style={{ 
                                                background: 'rgba(251, 171, 21, 0.15)', border: 'none', color: '#fbab15', 
                                                cursor: 'pointer', padding: '6px', borderRadius: '50%',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                transition: 'all 0.2s ease'
                                            }}
                                            onMouseOver={e => e.currentTarget.style.transform = 'scale(1.1)'}
                                            onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
                                        >
                                            <EditIcon />
                                        </button>
                                    )}
                                </div>
                                {isEditingHours ? (
                                    <div className="hours-edit-panel">
                                        <textarea 
                                            value={hoursInput} 
                                            onChange={e => setHoursInput(e.target.value)} 
                                            placeholder="مثلاً: يومياً من 8 صباحاً حتى 4 مساءً"
                                            className="textarea"
                                        />
                                        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                            <button className="btn-small is-accept" onClick={handleUpdateHours}>حفظ</button>
                                            <button className="btn-small" onClick={() => setIsEditingHours(false)}>إلغاء</button>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="hours-display">{uniData.opening_hours || 'غير محدد بعد.'}</p>
                                )}
                            </div>

                            
                            {isAdminOrOwner && (
                                <div className="uni-admin-actions" style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <button 
                                        className="uni-follow-btn" 
                                        style={{ background: '#3b82f6', boxShadow: '0 4px 10px rgba(59, 130, 246, 0.4)' }}
                                        onClick={() => { setActiveTab('facilities'); setIsCreatingFacility(true); }}
                                    >
                                        + إضافة مرفق جديد للجامعة
                                    </button>

                                    {/* Only System Admin can assign a page owner */}
                                    {currentUser?.role === 'admin' && (
                                        <div className="assign-owner-section" style={{ marginTop: '15px', padding: '15px', border: '1px solid #ddd', borderRadius: '12px', background: 'white' }}>
                                            <p style={{ fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '10px' }}>إدارة مسؤول الصفحة (Admin) 🛠️</p>
                                            <p style={{ fontSize: '0.8rem', color: '#666', marginBottom: '10px' }}>
                                                المسؤول الحالي: {uniData.owner_name || 'لا يوجد (إدارة النظام)'}
                                            </p>
                                            {!isAssigningOwner ? (
                                                <button className="btn-small is-primary" onClick={() => setIsAssigningOwner(true)}>تعيين مسؤول جديد</button>
                                            ) : (
                                                <form onSubmit={handleAssignOwner} style={{ display: 'flex', gap: '10px' }}>
                                                    <input 
                                                        className="input" 
                                                        placeholder="اسم المستخدم" 
                                                        value={ownerUsername} 
                                                        onChange={e => setOwnerUsername(e.target.value)}
                                                        required
                                                    />
                                                    <button type="submit" className="btn-small is-accept">تأكيد</button>
                                                    <button type="button" className="btn-small" onClick={() => setIsAssigningOwner(false)}>إلغاء</button>
                                                </form>
                                            )}
                                        </div>
                                    )}
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
                            {isAdminOrOwner && (
                                <div className="news-admin-actions" style={{ marginBottom: '20px' }}>
                                    {!showNewsForm ? (
                                        <button className="btn-small is-primary" onClick={() => setShowNewsForm(true)}>+ إضافة خبر أو إعلان جديد</button>
                                    ) : (
                                        <form onSubmit={handleCreateNews} className="news-form slide-up" style={{ background: 'var(--bg-tertiary)', padding: '20px', borderRadius: '16px' }}>
                                            <input placeholder="العنوان" className="input" value={newNews.title} onChange={e => setNewNews({...newNews, title: e.target.value})} style={{ width: '100%', marginBottom: '10px' }} required />
                                            <textarea placeholder="ماذا تريد أن تعلن؟" className="textarea" value={newNews.content} onChange={e => setNewNews({...newNews, content: e.target.value})} style={{ width: '100%', marginBottom: '10px' }} required />
                                            <input placeholder="رابط مرفق (اختياري)" className="input" value={newNews.external_link} onChange={e => setNewNews({...newNews, external_link: e.target.value})} style={{ width: '100%', marginBottom: '10px' }} />
                                            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                                                <select className="select" value={newNews.post_type} onChange={e => setNewNews({...newNews, post_type: e.target.value})} style={{ flex: 1 }}>
                                                    <option value="news">خبر 📢</option>
                                                    <option value="announcement">إعلان رسمي ✉️</option>
                                                </select>
                                                <input type="file" onChange={e => setNewsMedia(e.target.files[0])} style={{ flex: 1, fontSize: '0.8rem' }} />
                                            </div>
                                            <div style={{ display: 'flex', gap: '10px' }}>
                                                <button type="submit" className="btn-small is-accept" disabled={isSubmittingNews}>{isSubmittingNews ? 'جاري النشر...' : 'نشر'}</button>
                                                <button type="button" className="btn-small" onClick={() => setShowNewsForm(false)}>إلغاء</button>
                                            </div>
                                        </form>
                                    )}
                                </div>
                            )}

                            <div className="news-feed">
                                {uniNews.length === 0 ? (
                                    <div className="empty-state">
                                        <p>لا توجد إعلانات حالياً.</p>
                                    </div>
                                ) : (
                                    uniNews.map(post => (
                                        <div key={post.id} className="news-card slide-in-right" style={{ background: 'var(--bg-primary)', padding: '18px', borderRadius: '16px', marginBottom: '18px', border: '1px solid var(--bg-tertiary)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                                            <div className="news-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                        <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '6px', background: post.post_type === 'announcement' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', color: post.post_type === 'announcement' ? '#ef4444' : '#10b981', fontWeight: '800', textTransform: 'uppercase' }}>
                                                            {post.post_type === 'announcement' ? 'إعلان رسمي' : 'خبر'}
                                                        </span>
                                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>• {new Date(post.created_at).toLocaleDateString('ar-EG')}</span>
                                                    </div>
                                                    <h3 style={{ margin: '4px 0', fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-primary)' }}>{post.title}</h3>
                                                </div>
                                                {isAdminOrOwner && (
                                                    <button 
                                                        onClick={() => handleDeletePost(post.id)}
                                                        style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: '5px', transition: 'color 0.2s' }}
                                                        onMouseOver={e => e.currentTarget.style.color = '#ef4444'}
                                                        onMouseOut={e => e.currentTarget.style.color = '#9ca3af'}
                                                    >
                                                        <TrashIcon />
                                                    </button>
                                                )}
                                            </div>

                                            <p style={{ fontSize: '1rem', lineHeight: 1.6, color: 'var(--text-secondary)', marginBottom: '12px' }}>{post.content}</p>

                                            {post.image_url && (
                                                <div style={{ borderRadius: '12px', overflow: 'hidden', marginBottom: '12px' }}>
                                                    <img src={getImageUrl(post.image_url)} style={{ width: '100%', maxHeight: '350px', objectFit: 'cover' }} />
                                                </div>
                                            )}

                                            {post.external_link && (
                                                <a href={post.external_link.startsWith('http') ? post.external_link : `https://${post.external_link}`} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', marginBottom: '15px', color: '#3b82f6', fontSize: '0.9rem', fontWeight: 'bold', textDecoration: 'none', background: 'rgba(59, 130, 246, 0.05)', padding: '6px 12px', borderRadius: '8px' }}>
                                                    🔗 رابط المعلومات
                                                </a>
                                            )}

                                            <div className="news-card-actions" style={{ display: 'flex', gap: '24px', marginTop: '12px', borderTop: '1px solid var(--bg-tertiary)', paddingTop: '15px' }}>
                                                <button 
                                                    onClick={() => handleLikePost(post.id)} 
                                                    style={{ background: 'none', border: 'none', color: post.is_liked ? '#ef4444' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem', fontWeight: '600', transition: 'all 0.2s' }}
                                                >
                                                    <HeartIcon filled={post.is_liked} />
                                                    <span>{post.likes_count || 0}</span>
                                                </button>
                                                <button 
                                                    onClick={() => { 
                                                        if (activeCommentPost === post.id) setActiveCommentPost(null);
                                                        else { setActiveCommentPost(post.id); loadComments(post.id); } 
                                                    }} 
                                                    style={{ background: 'none', border: 'none', color: activeCommentPost === post.id ? '#3b82f6' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem', fontWeight: '600', transition: 'all 0.2s' }}
                                                >
                                                    <MessageIcon />
                                                    <span>{post.comments_count || 0}</span>
                                                </button>
                                            </div>

                                            {activeCommentPost === post.id && (
                                                <div className="comments-section" style={{ marginTop: '15px', padding: '15px', background: 'var(--bg-secondary)', borderRadius: '14px', border: '1px solid var(--bg-tertiary)' }}>
                                                    <div className="comments-list" style={{ maxHeight: '250px', overflowY: 'auto', marginBottom: '12px' }}>
                                                        {(comments[post.id] || []).length === 0 ? (
                                                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '10px' }}>لا توجد تعليقات بعد. كن أول من يعلق!</p>
                                                        ) : (
                                                            comments[post.id].map(c => (
                                                                <div key={c.id} style={{ display: 'flex', gap: '10px', marginBottom: '12px', animation: 'fadeIn 0.3s ease' }}>
                                                                    <img src={getImageUrl(c.profile_picture)} style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--bg-tertiary)' }} />
                                                                    <div style={{ background: 'var(--bg-tertiary)', padding: '8px 14px', borderRadius: '16px', flex: 1, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                                                                        <div style={{ fontWeight: '800', fontSize: '0.8rem', color: 'var(--text-primary)', marginBottom: '2px' }}>{c.username}</div>
                                                                        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{c.content}</div>
                                                                    </div>
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>
                                                    <form onSubmit={(e) => handleAddComment(e, post.id)} style={{ display: 'flex', gap: '10px' }}>
                                                        <input 
                                                            className="input" 
                                                            placeholder="أضف تعليقاً..." 
                                                            style={{ flex: 1, fontSize: '0.9rem', padding: '10px 15px', borderRadius: '12px', background: 'var(--bg-primary)', border: '1px solid var(--bg-tertiary)' }} 
                                                            value={newComment}
                                                            onChange={e => setNewComment(e.target.value)}
                                                        />
                                                        <button type="submit" className="btn-small is-primary" style={{ borderRadius: '12px' }}>نشر</button>
                                                    </form>
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

export default UniversityProfileModal;
