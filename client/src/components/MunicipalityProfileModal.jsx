import React, { useState, useEffect } from 'react';
import { shopService, municipalityService, getImageUrl } from '../services/api';
import CommentsSection from './CommentsSection';
import ImageCropperModal from './ImageCropperModal';
import DefaultAvatar from './DefaultAvatar';
import './MunicipalityProfileModal.css';
import './Modal.css';

const MunicipalityProfileModal = ({ shop, currentUser, onClose, onFollowChange, userLocation }) => {
    const [muniData, setMuniData] = useState(shop);
    const [activeTab, setActiveTab] = useState('overview');
    const [loading, setLoading] = useState(true);

    // Items and Categories states
    const [muniItems, setMuniItems] = useState([]);
    const [groupedItems, setGroupedItems] = useState({
        live_streams: [],
        public_squares: [],
        public_parks: [],
        services: [],
        tourism: [],
        culture: []
    });
    const [activeCategory, setActiveCategory] = useState(null); // e.g. 'live_streams'
    
    // Admin / Editing states
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({
        name: shop.name || '',
        bio: shop.bio || '',
        opening_hours: shop.opening_hours || '',
        contact_info: shop.contact_info || '',
        proximity_radius: shop.proximity_radius || 200,
        enable_proximity_notifications: shop.enable_proximity_notifications || false
    });
    
    // Add Item form state
    const [isAddingItem, setIsAddingItem] = useState(false);
    const [itemForm, setItemForm] = useState({
        name: '',
        description: '',
        latitude: '',
        longitude: ''
    });
    const [itemImage, setItemImage] = useState(null);
    const [isSubmittingItem, setIsSubmittingItem] = useState(false);

    // Profile & Cover Pics
    const [localProfilePic, setLocalProfilePic] = useState(shop.profile_picture);
    const [localCoverPic, setLocalCoverPic] = useState(shop.cover_picture);
    const [cropState, setCropState] = useState({ isOpen: false, file: null, type: null, aspect: 1 });

    // News Feed states
    const [muniNews, setMuniNews] = useState([]);
    const [showNewsForm, setShowNewsForm] = useState(false);
    const [newNews, setNewNews] = useState({ title: '', content: '', external_link: '', post_type: 'news' });
    const [newsMedia, setNewsMedia] = useState(null);
    const [isSubmittingNews, setIsSubmittingNews] = useState(false);

    // Comments & Likes states
    const [comments, setComments] = useState({});
    const [activeCommentPost, setActiveCommentPost] = useState(null);
    const [newComment, setNewComment] = useState('');

    // Proximity Alert states
    const [alertMessage, setAlertMessage] = useState('');
    const [isSendingAlert, setIsSendingAlert] = useState(false);
    const [alertTarget, setAlertTarget] = useState({ radius: 500, useProximity: false });

    // Permissions check
    const isOwnerOrAdmin = currentUser && (
        currentUser.role === 'admin' || 
        String(muniData.owner_id) === String(currentUser.id || currentUser.userId)
    );
    const isSystemAdmin = currentUser && currentUser.role === 'admin';

    // Arabic display names for sections
    const sectionNames = {
        live_streams: { title: 'كاميرات البث المباشر 🎥', desc: 'بث حي ومباشر من شوارع وميادين المدينة', icon: '🎥' },
        public_squares: { title: 'الميادين والساحات العامة 🏙️', desc: 'الميادين الرئيسية والمساحات الحضرية في المدينة', icon: '🏙️' },
        public_parks: { title: 'الحدائق العامة والمنتزهات 🌳', desc: 'المساحات الخضراء والحدائق العامة المخصصة للمواطنين', icon: '🌳' },
        services: { title: 'الخدمات والمعاملات ⚙️', desc: 'الخدمات البلدية، طلبات المعاملات والإرشاد', icon: '⚙️' },
        tourism: { title: 'السياحة والمعالم الأثرية 🏛️', desc: 'المعالم الدينية والتاريخية والسياحية بالمدينة', icon: '🏛️' },
        culture: { title: 'الأنشطة الثقافية والفعاليات 🎭', desc: 'المهرجانات والندوات والأنشطة الثقافية للبلدية', icon: '🎭' }
    };

    useEffect(() => {
        loadMuniProfile();
        loadMuniItems();
    }, [shop.id]);

    const loadMuniProfile = async () => {
        try {
            const data = await shopService.getProfile(shop.id);
            setMuniData(data.shop);
            setLocalProfilePic(data.shop.profile_picture);
            setLocalCoverPic(data.shop.cover_picture);
            setMuniNews(data.posts || []);
            setEditForm({
                name: data.shop.name || '',
                bio: data.shop.bio || '',
                opening_hours: data.shop.opening_hours || '',
                contact_info: data.shop.contact_info || '',
                proximity_radius: data.shop.proximity_radius || 200,
                enable_proximity_notifications: data.shop.enable_proximity_notifications || false
            });
        } catch (error) {
            console.error("Failed to load municipality profile details:", error);
        } finally {
            setLoading(false);
        }
    };

    const loadMuniItems = async () => {
        try {
            const data = await municipalityService.getItems(shop.id);
            setMuniItems(data.items || []);
            if (data.grouped) {
                setGroupedItems(data.grouped);
            }
        } catch (error) {
            console.error("Failed to load municipality items:", error);
        }
    };

    const handleFollowToggle = async () => {
        if (!currentUser) {
            alert('يرجى تسجيل الدخول لمتابعة البلدية');
            return;
        }
        try {
            if (muniData.is_followed) {
                await shopService.unfollow(muniData.id);
                setMuniData(prev => ({ ...prev, is_followed: false, followers_count: Math.max(0, prev.followers_count - 1) }));
                if (onFollowChange) onFollowChange(muniData.id, false);
            } else {
                await shopService.follow(muniData.id);
                setMuniData(prev => ({ ...prev, is_followed: true, followers_count: prev.followers_count + 1 }));
                if (onFollowChange) onFollowChange(muniData.id, true);
            }
        } catch (e) {
            console.error(e);
        }
    };

    // Edit Profile details
    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        try {
            const updated = await shopService.updateProfile(muniData.id, editForm);
            setMuniData(prev => ({ ...prev, ...updated }));
            setIsEditing(false);
            alert('تم تحديث بيانات البلدية بنجاح! 🏛️');
        } catch (error) {
            alert('فشل تحديث البيانات، يرجى المحاولة مرة أخرى.');
        }
    };

    // File Picker & Crop setup
    const handleFileChange = (e, type) => {
        const file = e.target.files[0];
        if (!file) return;
        const aspect = type === 'profile_picture' ? 1 : 2; // Square for profile logo, landscape for cover
        setCropState({ isOpen: true, file, type, aspect });
    };

    const handleImageUpload = async (croppedFile, type) => {
        try {
            const formData = new FormData();
            formData.append(type, croppedFile);
            const response = await shopService.uploadImages(muniData.id, formData);
            if (type === 'profile_picture') {
                setLocalProfilePic(response.profile_picture);
                setMuniData(prev => ({ ...prev, profile_picture: response.profile_picture }));
            } else {
                setLocalCoverPic(response.cover_picture);
                setMuniData(prev => ({ ...prev, cover_picture: response.cover_picture }));
            }
            alert('تم تحديث الصورة بنجاح! ✅');
        } catch (error) {
            alert('فشل رفع الصورة');
        }
    };

    // Add municipality service/landmark item
    const handleAddItem = async (e) => {
        e.preventDefault();
        if (!itemForm.name || !itemForm.latitude || !itemForm.longitude) {
            alert('يرجى إدخال الاسم والإحداثيات الجغرافية');
            return;
        }

        setIsSubmittingItem(true);
        try {
            const formData = new FormData();
            formData.append('name', itemForm.name);
            formData.append('section', activeCategory);
            formData.append('latitude', parseFloat(itemForm.latitude));
            formData.append('longitude', parseFloat(itemForm.longitude));
            formData.append('description', itemForm.description);
            if (itemImage) {
                formData.append('image', itemImage);
            }

            await municipalityService.addItem(muniData.id, formData);
            alert('تمت إضافة المعلم/الخدمة بنجاح! 🏛️');
            setIsAddingItem(false);
            setItemForm({ name: '', description: '', latitude: '', longitude: '' });
            setItemImage(null);
            loadMuniItems();
        } catch (error) {
            alert('فشل إضافة العنصر، يرجى التحقق من الصلاحيات.');
        } finally {
            setIsSubmittingItem(false);
        }
    };

    const handleDeleteItem = async (itemId) => {
        if (!confirm('هل أنت متأكد من حذف هذا المعلم/الخدمة؟')) return;
        try {
            await municipalityService.deleteItem(itemId);
            alert('تم الحذف بنجاح');
            loadMuniItems();
        } catch (error) {
            alert('فشل عملية الحذف');
        }
    };

    const getItemCurrentCoordinates = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((pos) => {
                setItemForm(prev => ({
                    ...prev,
                    latitude: pos.coords.latitude.toFixed(6),
                    longitude: pos.coords.longitude.toFixed(6)
                }));
            }, () => alert("تعذر الحصول على إحداثيات الموقع الحالي. يرجى تفعيل الـ GPS والتحقق من الأذونات."), { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
        } else {
            alert("المتصفح لا يدعم تحديد الموقع الجغرافي");
        }
    };

    // News/Posts logic
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

            await shopService.createPost(muniData.id, formData);
            alert('تم نشر الخبر بنجاح! 📢');
            setShowNewsForm(false);
            setNewNews({ title: '', content: '', external_link: '', post_type: 'news' });
            setNewsMedia(null);
            loadMuniProfile();
        } catch (error) {
            alert('فشل نشر الخبر');
        } finally {
            setIsSubmittingNews(false);
        }
    };

    const handleDeleteNews = async (postId) => {
        if (!confirm('هل أنت متأكد من حذف هذا المنشور؟')) return;
        try {
            await shopService.deleteShopPost(muniData.id, postId);
            alert('تم حذف المنشور بنجاح');
            loadMuniProfile();
        } catch (error) {
            alert('فشل حذف المنشور');
        }
    };

    const handleLikePost = async (postId) => {
        try {
            const { liked } = await shopService.togglePostLike(postId);
            setMuniNews(prev => prev.map(p =>
                p.id === postId
                    ? { ...p, is_liked: liked, likes_count: liked ? (p.likes_count + 1) : (p.likes_count - 1) }
                    : p
            ));
        } catch (e) {
            console.error(e);
        }
    };

    const loadComments = async (postId) => {
        try {
            const data = await shopService.getPostComments(postId);
            setComments(prev => ({ ...prev, [postId]: data }));
        } catch (e) {
            console.error(e);
        }
    };

    const handleAddComment = async (e, postId) => {
        e.preventDefault();
        if (!newComment.trim()) return;
        try {
            const data = await shopService.addPostComment(postId, { content: newComment });
            setComments(prev => ({
                ...prev,
                [postId]: [...(prev[postId] || []), data]
            }));
            setNewComment('');
            setMuniNews(prev => prev.map(p => p.id === postId ? { ...p, comments_count: p.comments_count + 1 } : p));
        } catch (error) {
            console.error(error);
        }
    };

    // Proximity notifications form
    const handleSendProximityAlert = async (e) => {
        e.preventDefault();
        if (!alertMessage.trim()) return;
        setIsSendingAlert(true);
        try {
            const targeting = alertTarget.useProximity ? {
                lat: userLocation?.latitude || muniData.latitude,
                lon: userLocation?.longitude || muniData.longitude,
                radius: alertTarget.radius
            } : null;

            await shopService.sendProximityAlert(muniData.id, alertMessage, targeting);
            alert('تم إرسال التنبيه لجميع المتابعين بنجاح! 🔔');
            setAlertMessage('');
        } catch (e) {
            alert('فشل في إرسال التنبيه');
        } finally {
            setIsSendingAlert(false);
        }
    };

    const handleShare = () => {
        const shareUrl = `${window.location.origin}/map?shopId=${muniData.id}`;
        navigator.clipboard.writeText(shareUrl).then(() => {
            alert('تم نسخ رابط مشاركة البلدية بنجاح! ✅');
        }).catch(err => {
            alert('فشل نسخ الرابط');
        });
    };

    const triggerFlyToItem = (item) => {
        // Find map object or pass callback to parent to flyTo
        onClose(); // Close modal to view map
        const event = new CustomEvent('fly-to-coordinate', {
            detail: {
                lat: parseFloat(item.latitude),
                lon: parseFloat(item.longitude),
                zoom: 18.5,
                pitch: 45
            }
        });
        window.dispatchEvent(event);
    };

    return (
        <div className="muni-modal-overlay muni-fade-in" onClick={onClose}>
            <div className="muni-modal-container muni-slide-up" onClick={e => e.stopPropagation()}>
                
                {/* Cover and Profile Area */}
                <div className="muni-cover-section">
                    <img 
                        src={localCoverPic ? getImageUrl(localCoverPic) : 'https://images.unsplash.com/photo-1577083552431-6e5fd01aa342?q=80&w=1000'} 
                        className="muni-cover-img" 
                        alt="cover" 
                    />
                    <div className="muni-cover-overlay"></div>
                    
                    <button className="muni-close-btn" onClick={onClose} title="إغلاق">✕</button>
                    
                    {isOwnerOrAdmin && (
                        <div style={{ position: 'absolute', top: '15px', right: '15px', zIndex: 10, display: 'flex', gap: '8px' }}>
                            <label className="btn-small is-primary" style={{ cursor: 'pointer', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.2)', backdropFilter: 'blur(5px)' }}>
                                تعديل الغلاف 🖼️
                                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleFileChange(e, 'cover_picture')} />
                            </label>
                            <label className="btn-small is-primary" style={{ cursor: 'pointer', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.2)', backdropFilter: 'blur(5px)' }}>
                                تعديل الشعار 🏵️
                                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleFileChange(e, 'profile_picture')} />
                            </label>
                        </div>
                    )}

                    <div className="muni-profile-info">
                        <div className="muni-logo-wrapper">
                            {localProfilePic ? (
                                <img src={getImageUrl(localProfilePic)} className="muni-logo-img" alt="logo" />
                            ) : (
                                <div className="muni-logo-img" style={{ display: 'grid', placeItems: 'center', fontSize: '2.5rem', background: '#1e293b' }}>🏛️</div>
                            )}
                        </div>
                        <div className="muni-title-section">
                            <h2 className="muni-name">{muniData.name}</h2>
                            <p className="muni-category">
                                <span>🏩</span>
                                {muniData.category || 'بلدية'}
                            </p>
                            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '4px', fontWeight: '500' }}>
                                المتابعين: {muniData.followers_count || 0}
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="muni-follow-btn" style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '10px' }} onClick={handleShare} title="مشاركة">
                                🔗
                            </button>
                            <button className={`muni-follow-btn ${muniData.is_followed ? 'is-unfollow' : ''}`} onClick={handleFollowToggle}>
                                {muniData.is_followed ? 'إلغاء المتابعة ✖' : 'متابعة البلدية 🔔'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Tabs Panel */}
                <div className="muni-tabs">
                    <button className={`muni-tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => { setActiveTab('overview'); setActiveCategory(null); }}>
                        عن البلدية 🏛️
                    </button>
                    <button className={`muni-tab ${activeTab === 'services' ? 'active' : ''}`} onClick={() => setActiveTab('services')}>
                        الخدمات والمعالم 🗺️
                    </button>
                    <button className={`muni-tab ${activeTab === 'news' ? 'active' : ''}`} onClick={() => { setActiveTab('news'); setActiveCategory(null); }}>
                        الأخبار والقرارات 📢
                    </button>
                </div>

                {/* Modal Main Content */}
                <div className="muni-content-area">
                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
                            <div className="loader-ring"></div>
                        </div>
                    ) : (
                        <>
                            {/* OVERVIEW TAB */}
                            {activeTab === 'overview' && (
                                <div className="muni-overview-tab">
                                    {isEditing ? (
                                        <form onSubmit={handleUpdateProfile} className="news-form" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                            <div>
                                                <label style={{ fontSize: '0.9rem', color: '#94a3b8', display: 'block', marginBottom: '5px' }}>اسم البلدية</label>
                                                <input className="input" style={{ width: '100%' }} value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} required />
                                            </div>
                                            <div>
                                                <label style={{ fontSize: '0.9rem', color: '#94a3b8', display: 'block', marginBottom: '5px' }}>نبذة تعريفية</label>
                                                <textarea className="textarea" style={{ width: '100%' }} value={editForm.bio} onChange={e => setEditForm({ ...editForm, bio: e.target.value })} />
                                            </div>
                                            <div>
                                                <label style={{ fontSize: '0.9rem', color: '#94a3b8', display: 'block', marginBottom: '5px' }}>ساعات العمل الرسمي</label>
                                                <textarea className="textarea" style={{ width: '100%', minHeight: '60px' }} value={editForm.opening_hours} onChange={e => setEditForm({ ...editForm, opening_hours: e.target.value })} />
                                            </div>
                                            <div>
                                                <label style={{ fontSize: '0.9rem', color: '#94a3b8', display: 'block', marginBottom: '5px' }}>أرقام التواصل والطوارئ</label>
                                                <textarea className="textarea" style={{ width: '100%', minHeight: '60px' }} value={editForm.contact_info} onChange={e => setEditForm({ ...editForm, contact_info: e.target.value })} />
                                            </div>
                                            
                                            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '15px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                                    <label style={{ fontSize: '0.9rem', color: '#f8fafc', fontWeight: 'bold' }}>تفعيل إشعارات التقارب الجغرافي</label>
                                                    <input type="checkbox" style={{ width: '20px', height: '20px' }} checked={editForm.enable_proximity_notifications} onChange={e => setEditForm({ ...editForm, enable_proximity_notifications: e.target.checked })} />
                                                </div>
                                                {editForm.enable_proximity_notifications && (
                                                    <div>
                                                        <label style={{ fontSize: '0.85rem', color: '#94a3b8', display: 'block', marginBottom: '5px' }}>نطاق الاستهداف الجغرافي (بالمتر)</label>
                                                        <input type="number" className="input" style={{ width: '100%' }} value={editForm.proximity_radius} onChange={e => setEditForm({ ...editForm, proximity_radius: parseInt(e.target.value) || 200 })} />
                                                    </div>
                                                )}
                                            </div>

                                            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                                <button type="submit" className="btn-small is-accept" style={{ flex: 1 }}>حفظ التعديلات</button>
                                                <button type="button" className="btn-small btn-reject" style={{ flex: 1 }} onClick={() => setIsEditing(false)}>إلغاء</button>
                                            </div>
                                        </form>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                            
                                            {/* Institutional Bio */}
                                            <div className="muni-about-card">
                                                <h3>نبذة عن البلدية</h3>
                                                <p>{muniData.bio || 'لا يوجد نبذة تعريفية مضافة لهذه البلدية حتى الآن.'}</p>
                                            </div>

                                            {/* Stats Counters */}
                                            <div className="muni-stats-section">
                                                <div className="muni-quick-stats">
                                                    <div className="muni-stat-box">
                                                        <div className="muni-stat-value">{groupedItems.services?.length || 0}</div>
                                                        <div className="muni-stat-label">معاملات وخدمات</div>
                                                    </div>
                                                    <div className="muni-stat-box">
                                                        <div className="muni-stat-value">{groupedItems.public_parks?.length || 0}</div>
                                                        <div className="muni-stat-label">حدائق ومنتزهات</div>
                                                    </div>
                                                    <div className="muni-stat-box">
                                                        <div className="muni-stat-value">{groupedItems.tourism?.length || 0}</div>
                                                        <div className="muni-stat-label">معالم أثرية وسياحية</div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Details & Contacts */}
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                                <div className="muni-about-card" style={{ margin: 0 }}>
                                                    <h3 style={{ color: '#10b981' }}>ساعات الدوام الرسمي ⏰</h3>
                                                    <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem', color: '#cbd5e1', lineHeight: '1.5' }}>
                                                        {muniData.opening_hours || 'لم يتم تحديد ساعات الدوام بعد.'}
                                                    </div>
                                                </div>
                                                <div className="muni-about-card" style={{ margin: 0 }}>
                                                    <h3 style={{ color: '#3b82f6' }}>أرقام التواصل والطوارئ 📞</h3>
                                                    <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem', color: '#cbd5e1', lineHeight: '1.5' }}>
                                                        {muniData.contact_info || 'تواصل معنا عبر بلدية القدس.'}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Owner & Proximity Actions */}
                                            {isOwnerOrAdmin && (
                                                <div className="muni-about-card" style={{ background: 'rgba(250, 171, 21, 0.05)', borderColor: 'rgba(250, 171, 21, 0.2)' }}>
                                                    <h3 style={{ color: '#fbab15' }}>أدوات إدارة البلدية 🛠️</h3>
                                                    <div style={{ display: 'flex', gap: '10px', marginTop: '15px', flexWrap: 'wrap' }}>
                                                        <button className="btn-small is-primary" style={{ background: '#fbab15', color: '#0f172a' }} onClick={() => setIsEditing(true)}>تعديل بيانات وملف البلدية</button>
                                                    </div>

                                                    {/* Broadcast Alert form */}
                                                    <form onSubmit={handleCreateNews} className="news-form" style={{ marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '15px' }}>
                                                        <h4 style={{ color: '#fbab15', marginBottom: '10px', fontSize: '0.95rem' }}>إرسال إشعار فوري وتنبيه للمواطنين 🔔</h4>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                            <textarea 
                                                                className="textarea" 
                                                                placeholder="اكتب التنبيه هنا (مثل: إغلاق شارع مؤقت لأعمال الصيانة، أو انقطاع المياه)..." 
                                                                style={{ fontSize: '0.85rem', background: '#070a13' }}
                                                                value={alertMessage}
                                                                onChange={e => setAlertMessage(e.target.value)}
                                                                required
                                                            />
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                                <input type="checkbox" style={{ width: '16px', height: '16px' }} checked={alertTarget.useProximity} onChange={e => setAlertTarget({...alertTarget, useProximity: e.target.checked})} />
                                                                <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>تحديد نطاق جغرافي للتقارب فقط</label>
                                                            </div>
                                                            {alertTarget.useProximity && (
                                                                <div>
                                                                    <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '5px' }}>قطر النطاق الجغرافي (بالمتر)</label>
                                                                    <input type="number" className="input" style={{ width: '100%', fontSize: '0.8rem' }} value={alertTarget.radius} onChange={e => setAlertTarget({...alertTarget, radius: parseInt(e.target.value) || 500})} />
                                                                </div>
                                                            )}
                                                            <button 
                                                                type="button" 
                                                                className="btn-small" 
                                                                onClick={handleSendProximityAlert}
                                                                disabled={isSendingAlert || !alertMessage.trim()}
                                                                style={{ background: '#fbab15', color: '#0f172a', width: 'fit-content', alignSelf: 'flex-start' }}
                                                            >
                                                                {isSendingAlert ? 'جاري الإرسال...' : 'بث التنبيه الآن 📣'}
                                                            </button>
                                                        </div>
                                                    </form>
                                                </div>
                                            )}

                                            {/* System Admin Assignment */}
                                            {isSystemAdmin && (
                                                <div className="muni-about-card" style={{ background: 'rgba(59, 130, 246, 0.05)', borderColor: 'rgba(59, 130, 246, 0.2)' }}>
                                                    <h3 style={{ color: '#3b82f6' }}>تخصيص مسؤول البلدية (مسؤول النظام) 👑</h3>
                                                    <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                                                        <input 
                                                            type="text" 
                                                            placeholder="اسم مستخدم المسؤول..." 
                                                            className="input" 
                                                            id="muni-admin-username" 
                                                            style={{ flex: 1, background: '#0b0f19' }} 
                                                        />
                                                        <button 
                                                            className="btn-small is-primary"
                                                            onClick={async () => {
                                                                const username = document.getElementById('muni-admin-username').value;
                                                                if (!username) return alert('أدخل اسم المستخدم أولاً');
                                                                try {
                                                                    await shopService.assignOwner(muniData.id, username);
                                                                    alert('تم تخصيص مسؤول للبلدية بنجاح!');
                                                                    loadMuniProfile();
                                                                } catch (err) {
                                                                    alert('لم يتم العثور على المستخدم');
                                                                }
                                                            }}
                                                        >
                                                            تعيين
                                                        </button>
                                                        {muniData.owner_id && (
                                                            <button 
                                                                className="btn-small btn-reject"
                                                                onClick={async () => {
                                                                    if (!confirm('حذف مسؤول البلدية الحالي؟')) return;
                                                                    try {
                                                                        await shopService.removeOwner(muniData.id);
                                                                        alert('تم إزالة مسؤول البلدية');
                                                                        loadMuniProfile();
                                                                    } catch (err) {
                                                                        alert('فشل الإجراء');
                                                                    }
                                                                }}
                                                            >
                                                                إزالة المسؤول
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* SERVICES AND LANDMARKS TAB */}
                            {activeTab === 'services' && (
                                <div className="muni-services-tab">
                                    {activeCategory === null ? (
                                        /* General Categories Grid */
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                            <div style={{ textAlign: 'right', marginBottom: '5px' }}>
                                                <h3 style={{ fontSize: '1.2rem', margin: '0 0 5px 0', color: '#fbab15' }}>أقسام ومعالم المدينة</h3>
                                                <p style={{ color: '#94a3b8', margin: 0, fontSize: '0.85rem' }}>اختر قسماً لاستعراض المرافق والخدمات البلدية المتوفرة</p>
                                            </div>
                                            <div className="muni-sections-grid">
                                                {Object.entries(sectionNames).map(([key, value]) => (
                                                    <div key={key} className="muni-section-card" onClick={() => setActiveCategory(key)}>
                                                        <span className="muni-section-icon">{value.icon}</span>
                                                        <h4>{value.title.split(' ')[0]}</h4>
                                                        <span style={{ fontSize: '0.75rem' }}>
                                                            {(groupedItems[key] || []).length} عناصر
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        /* Category Details Panel */
                                        <div className="muni-category-panel" style={{ animation: 'muniFadeIn 0.3s ease' }}>
                                            <div className="muni-panel-header">
                                                <button className="muni-back-btn" onClick={() => { setActiveCategory(null); setIsAddingItem(false); }}>
                                                    ← العودة للأقسام
                                                </button>
                                                <h3 className="muni-panel-title">{sectionNames[activeCategory]?.title}</h3>
                                            </div>

                                            {/* Subtitle description */}
                                            <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '-10px 0 20px 0', textAlign: 'right' }}>
                                                {sectionNames[activeCategory]?.desc}
                                            </p>

                                            {/* Add Item form toggle (System admin only as per backend role limit) */}
                                            {isSystemAdmin && !isAddingItem && (
                                                <button 
                                                    className="btn-small is-primary" 
                                                    onClick={() => setIsAddingItem(true)}
                                                    style={{ marginBottom: '20px', display: 'block', marginRight: 'auto', background: '#fbab15', color: '#0f172a' }}
                                                >
                                                    + إضافة معلم/خدمة جديد
                                                </button>
                                            )}

                                            {/* Add Item Form */}
                                            {isAddingItem && (
                                                <form onSubmit={handleAddItem} className="news-form" style={{ background: '#0f172a', padding: '16px', borderRadius: '16px', marginBottom: '20px', border: '1px dashed rgba(232, 181, 71, 0.3)' }}>
                                                    <h4 style={{ color: '#fbab15', marginBottom: '12px', marginTop: 0 }}>إضافة عنصر جديد في قسم {sectionNames[activeCategory]?.title}</h4>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                        <input 
                                                            type="text" 
                                                            placeholder="اسم المعلم أو الخدمة..." 
                                                            className="input" 
                                                            value={itemForm.name} 
                                                            onChange={e => setItemForm({ ...itemForm, name: e.target.value })} 
                                                            required 
                                                        />
                                                        <textarea 
                                                            placeholder="تفاصيل ووصف الخدمة..." 
                                                            className="textarea" 
                                                            style={{ minHeight: '60px' }}
                                                            value={itemForm.description} 
                                                            onChange={e => setItemForm({ ...itemForm, description: e.target.value })} 
                                                        />
                                                        
                                                        {/* Coordinates Row */}
                                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                                            <input 
                                                                type="number" 
                                                                step="any" 
                                                                placeholder="خط العرض (Latitude)..." 
                                                                className="input" 
                                                                value={itemForm.latitude} 
                                                                onChange={e => setItemForm({ ...itemForm, latitude: e.target.value })} 
                                                                required 
                                                            />
                                                            <input 
                                                                type="number" 
                                                                step="any" 
                                                                placeholder="خط الطول (Longitude)..." 
                                                                className="input" 
                                                                value={itemForm.longitude} 
                                                                onChange={e => setItemForm({ ...itemForm, longitude: e.target.value })} 
                                                                required 
                                                            />
                                                        </div>

                                                        <button 
                                                            type="button" 
                                                            className="btn-small" 
                                                            style={{ alignSelf: 'flex-start', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} 
                                                            onClick={getItemCurrentCoordinates}
                                                        >
                                                            📍 جلب موقعي الحالي
                                                        </button>

                                                        {/* Image Input */}
                                                        <div>
                                                            <label style={{ fontSize: '0.85rem', color: '#94a3b8', display: 'block', marginBottom: '5px' }}>صورة توضيحية للمرفق</label>
                                                            <input type="file" accept="image/*" onChange={e => setItemImage(e.target.files[0])} />
                                                        </div>

                                                        {/* Form Buttons */}
                                                        <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
                                                            <button type="submit" disabled={isSubmittingItem} className="btn-small is-accept" style={{ flex: 1 }}>
                                                                {isSubmittingItem ? 'جاري الحفظ...' : 'إضافة للمعلم'}
                                                            </button>
                                                            <button type="button" className="btn-small btn-reject" style={{ flex: 1 }} onClick={() => setIsAddingItem(false)}>
                                                                إلغاء
                                                            </button>
                                                        </div>
                                                    </div>
                                                </form>
                                            )}

                                            {/* Items List */}
                                            <div className="muni-items-list">
                                                {(groupedItems[activeCategory] || []).length === 0 ? (
                                                    <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                                                        <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '10px' }}>📁</span>
                                                        لا توجد مرافق أو خدمات مضافة في هذا القسم حالياً.
                                                    </div>
                                                ) : (
                                                    groupedItems[activeCategory].map(item => (
                                                        <div key={item.id} className="muni-item-card">
                                                            {item.image_url && (
                                                                <img src={getImageUrl(item.image_url)} className="muni-item-image" alt={item.name} />
                                                            )}
                                                            <div className="muni-item-body">
                                                                <div className="muni-item-title-row">
                                                                    <h4 className="muni-item-name">{item.name}</h4>
                                                                    {isSystemAdmin && (
                                                                        <button 
                                                                            className="muni-btn-delete" 
                                                                            onClick={() => handleDeleteItem(item.id)}
                                                                        >
                                                                            حذف
                                                                        </button>
                                                                    )}
                                                                </div>
                                                                <p className="muni-item-desc">{item.description || 'لا يوجد وصف مضاف لهذا المعلم بعد.'}</p>
                                                                
                                                                <div className="muni-item-footer">
                                                                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                                                                        📍 {parseFloat(item.latitude).toFixed(4)} , {parseFloat(item.longitude).toFixed(4)}
                                                                    </span>
                                                                    <button className="muni-item-btn-go" onClick={() => triggerFlyToItem(item)}>
                                                                        اذهب للموقع 🗺️
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* NEWS AND POSTS TAB */}
                            {activeTab === 'news' && (
                                <div className="uni-news-tab">
                                    {isOwnerOrAdmin && !showNewsForm && (
                                        <button 
                                            className="btn-small is-primary" 
                                            onClick={() => setShowNewsForm(true)}
                                            style={{ alignSelf: 'flex-start', background: '#fbab15', color: '#0f172a', fontWeight: 'bold', border: 'none', borderRadius: '12px' }}
                                        >
                                            + كتابة منشور أو قرار جديد 📢
                                        </button>
                                    )}

                                    {showNewsForm && (
                                        <form onSubmit={handleCreateNews} className="news-form" style={{ background: '#0f172a', padding: '20px', borderRadius: '20px', border: '1px solid rgba(232, 181, 71, 0.2)' }}>
                                            <h4 style={{ color: '#fbab15', margin: '0 0 15px 0' }}>منشور أو تعميم جديد</h4>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                <input 
                                                    type="text" 
                                                    placeholder="العنوان..." 
                                                    className="input" 
                                                    value={newNews.title} 
                                                    onChange={e => setNewNews({ ...newNews, title: e.target.value })} 
                                                    required 
                                                />
                                                <textarea 
                                                    placeholder="اكتب تفاصيل الإعلان أو القرار البلدي هنا..." 
                                                    className="textarea" 
                                                    value={newNews.content} 
                                                    onChange={e => setNewNews({ ...newNews, content: e.target.value })} 
                                                    required 
                                                />
                                                <input 
                                                    type="text" 
                                                    placeholder="رابط خارجي للمزيد (اختياري)..." 
                                                    className="input" 
                                                    value={newNews.external_link} 
                                                    onChange={e => setNewNews({ ...newNews, external_link: e.target.value })} 
                                                />
                                                
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                                    <div>
                                                        <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '5px' }}>نوع المنشور</label>
                                                        <select className="select" style={{ width: '100%' }} value={newNews.post_type} onChange={e => setNewNews({ ...newNews, post_type: e.target.value })}>
                                                            <option value="news">خبر عام 📰</option>
                                                            <option value="announcement">تعميم رسمي 📜</option>
                                                            <option value="event">فعالية بلدية 🎭</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '5px' }}>إرفاق صورة أو وسائط</label>
                                                        <input type="file" accept="image/*" onChange={e => setNewsMedia(e.target.files[0])} />
                                                    </div>
                                                </div>

                                                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                                    <button type="submit" disabled={isSubmittingNews} className="btn-small is-accept" style={{ flex: 1 }}>
                                                        {isSubmittingNews ? 'جاري النشر...' : 'نشر الإعلان'}
                                                    </button>
                                                    <button type="button" className="btn-small btn-reject" style={{ flex: 1 }} onClick={() => setShowNewsForm(false)}>
                                                        إلغاء
                                                    </button>
                                                </div>
                                            </div>
                                        </form>
                                    )}

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                        {muniNews.length === 0 ? (
                                            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                                                لا توجد منشورات أو تعاميم رسمية من البلدية حالياً.
                                            </div>
                                        ) : (
                                            muniNews.map(post => (
                                                <div key={post.id} className="news-card" style={{ background: '#0f172a', padding: '20px', borderRadius: '22px', border: '1px solid rgba(255,255,255,0.04)', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', textAlign: 'right' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                            {localProfilePic ? (
                                                                <img src={getImageUrl(localProfilePic)} style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }} />
                                                            ) : (
                                                                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#1e293b', display: 'grid', placeItems: 'center', fontSize: '1.2rem' }}>🏛️</div>
                                                            )}
                                                            <div>
                                                                <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#f8fafc', display: 'block' }}>{muniData.name}</span>
                                                                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                                                    {new Date(post.created_at).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' })}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div style={{ display: 'flex', gap: '6px' }}>
                                                            <span style={{ background: post.post_type === 'announcement' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.15)', color: post.post_type === 'announcement' ? '#ef4444' : '#3b82f6', padding: '3px 10px', borderRadius: '100px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                                                                {post.post_type === 'announcement' ? 'تعميم رسمي 📜' : post.post_type === 'event' ? 'فعالية 🎭' : 'إعلان عام 📢'}
                                                            </span>
                                                            {isOwnerOrAdmin && (
                                                                <button onClick={() => handleDeleteNews(post.id)} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.85rem', cursor: 'pointer', padding: 0 }}>حذف</button>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <h3 style={{ fontSize: '1.15rem', color: '#f8fafc', fontWeight: '800', margin: '0 0 8px 0' }}>{post.title}</h3>
                                                    <p style={{ color: '#cbd5e1', fontSize: '0.95rem', lineHeight: '1.6', margin: '0 0 15px 0', whiteSpace: 'pre-wrap' }}>{post.content}</p>

                                                    {post.image_url && (
                                                        <img src={getImageUrl(post.image_url)} style={{ width: '100%', maxHeight: '350px', objectFit: 'cover', borderRadius: '16px', marginBottom: '15px', border: '1px solid rgba(255,255,255,0.05)' }} alt="post media" />
                                                    )}

                                                    {post.external_link && (
                                                        <a href={post.external_link} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', color: '#fbab15', fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '15px', textDecoration: 'none' }}>🔗 اضغط هنا لزيارة الرابط المرفق</a>
                                                    )}

                                                    {/* Comments and Likes section */}
                                                    <div style={{ display: 'flex', gap: '15px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
                                                        <button 
                                                            onClick={() => handleLikePost(post.id)} 
                                                            style={{ background: 'none', border: 'none', color: post.is_liked ? '#ef4444' : '#94a3b8', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem' }}
                                                        >
                                                            ❤️ {post.likes_count || 0}
                                                        </button>
                                                        <button 
                                                            onClick={() => {
                                                                if (activeCommentPost === post.id) {
                                                                    setActiveCommentPost(null);
                                                                } else {
                                                                    setActiveCommentPost(post.id);
                                                                    loadComments(post.id);
                                                                }
                                                            }}
                                                            style={{ background: 'none', border: 'none', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem' }}
                                                        >
                                                            💬 التعليقات ({post.comments_count || 0})
                                                        </button>
                                                    </div>

                                                    {activeCommentPost === post.id && (
                                                        <div style={{ marginTop: '15px', padding: '15px', background: '#0b0f19', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.03)' }}>
                                                            <div style={{ maxHeight: '250px', overflowY: 'auto', marginBottom: '12px' }}>
                                                                {(comments[post.id] || []).length === 0 ? (
                                                                    <p style={{ fontSize: '0.85rem', color: '#94a3b8', textAlign: 'center', padding: '10px' }}>لا توجد تعليقات بعد. كن أول من يعلق!</p>
                                                                ) : (
                                                                    comments[post.id].map(c => (
                                                                        <div key={c.id} style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                                                                            <img src={getImageUrl(c.profile_picture)} style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }} />
                                                                            <div style={{ background: '#0f172a', padding: '8px 14px', borderRadius: '16px', flex: 1 }}>
                                                                                <div style={{ fontWeight: '800', fontSize: '0.8rem', color: '#f8fafc', marginBottom: '2px' }}>{c.username}</div>
                                                                                <div style={{ fontSize: '0.9rem', color: '#cbd5e1', lineHeight: 1.4 }}>{c.content}</div>
                                                                            </div>
                                                                        </div>
                                                                    ))
                                                                )}
                                                            </div>
                                                            <form onSubmit={(e) => handleAddComment(e, post.id)} style={{ display: 'flex', gap: '10px' }}>
                                                                <input
                                                                    className="input"
                                                                    placeholder="أضف تعليقاً..."
                                                                    style={{ flex: 1, fontSize: '0.9rem', padding: '10px 15px', borderRadius: '12px', background: '#0f172a', border: '1px solid rgba(255,255,255,0.05)' }}
                                                                    value={newComment}
                                                                    onChange={e => setNewComment(e.target.value)}
                                                                />
                                                                <button type="submit" className="btn-small is-primary" style={{ borderRadius: '12px', background: '#fbab15', color: '#0f172a', fontWeight: 'bold' }}>نشر</button>
                                                            </form>
                                                        </div>
                                                    )}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

            </div>

            {/* Image Cropper modal */}
            {cropState.isOpen && (
                <ImageCropperModal
                    imageFile={cropState.file}
                    aspect={cropState.aspect}
                    onCancel={() => setCropState({ isOpen: false, file: null, type: null, aspect: 1 })}
                    onCropDone={(croppedFile) => {
                        handleImageUpload(croppedFile, cropState.type);
                        setCropState({ isOpen: false, file: null, type: null, aspect: 1 });
                    }}
                />
            )}
        </div>
    );
};

export default MunicipalityProfileModal;
