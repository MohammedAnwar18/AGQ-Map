import React, { useState, useEffect } from 'react';
import { shopService, getImageUrl } from '../services/api';
import ImageCropperModal from './ImageCropperModal';
import './FacilityProfileModal.css';

const ShareIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
        <polyline points="16 6 12 2 8 6"></polyline>
        <line x1="12" y1="2" x2="12" y2="15"></line>
    </svg>
);

const FacilityProfileModal = ({ facilityId, onClose, currentUser }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(!!facilityId);
    const [activeTab, setActiveTab] = useState('overview');

    // For Adding Content (Admin/Owner only)
    const [showAddPost, setShowAddPost] = useState(false);
    const [newPost, setNewPost] = useState({ title: '', content: '', post_type: 'news' });
    const [showAddSpec, setShowAddSpec] = useState(false);
    const [newSpec, setNewSpec] = useState({ name: '', description: '', degree_level: 'البكالوريوس' });

    useEffect(() => {
        loadData();
    }, [facilityId]);

    useEffect(() => {
        if (data && data.facility) {
            console.log("Facility Modal Debug - currentUser:", currentUser);
            // We'll calculate is_admin here or just log what we have
        }
    }, [currentUser, data]);

    const loadData = async () => {
        if (!facilityId) return;
        setLoading(true);
        try {
            const res = await shopService.getFacilityProfile(facilityId);
            if (res && res.facility) {
                setData(res);
                if (res.facility.category === 'الكليات') {
                    setActiveTab('specialties');
                }
            } else {
                console.error('Facility data is missing or invalid');
            }
        } catch (error) {
            console.error('Fetch facility error', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddPost = async (e) => {
        e.preventDefault();
        try {
            const formData = new FormData();
            formData.append('title', newPost.title);
            formData.append('content', newPost.content);
            formData.append('post_type', newPost.post_type);
            
            await shopService.addFacilityPost(facilityId, formData);
            alert('تم نشر الخبر بنجاح!');
            setShowAddPost(false);
            setNewPost({ title: '', content: '', post_type: 'news' });
            loadData();
        } catch (e) {
            alert('فشل النشر');
        }
    };

    const handleAddSpec = async (e) => {
        e.preventDefault();
        try {
            await shopService.addCollegeSpecialty(facilityId, newSpec);
            alert('تم إضافة التخصص بنجاح!');
            setShowAddSpec(false);
            setNewSpec({ name: '', description: '', degree_level: 'البكالوريوس' });
            loadData();
        } catch (e) {
            alert('فشل الإضافة');
        }
    };

    const handleShare = () => {
        const shareUrl = `${window.location.origin}/map?facilityId=${facilityId}`;
        navigator.clipboard.writeText(shareUrl).then(() => {
            alert('تم نسخ رابط المشاركة بنجاح! ✅');
        }).catch(err => {
            console.error('Failed to copy: ', err);
            alert('فشل نسخ الرابط');
        });
    };

    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState({ name: '', description: '', icon: '' });
    const [editFiles, setEditFiles] = useState({ icon_file: null, cover_file: null });
    
    // Image Cropper State
    const [croppingState, setCroppingState] = useState({
        isOpen: false,
        file: null,
        aspect: 1,
        targetField: null // 'icon' or 'cover'
    });

    useEffect(() => {
        if (data && data.facility) {
            setEditData({
                name: data.facility.name || '',
                description: data.facility.description || '',
                icon: data.facility.icon || '🏛️'
            });
        }
    }, [data]);

    const handleUpdateFacility = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('name', editData.name);
            formData.append('description', editData.description);
            formData.append('icon', editData.icon);
            if (editFiles.icon_file) formData.append('icon_file', editFiles.icon_file);
            if (editFiles.cover_file) formData.append('cover_file', editFiles.cover_file);

            await shopService.updateUniversityFacility(facilityId, formData);
            alert('تم تحديث بيانات المرفق بنجاح! ✅');
            setIsEditing(false);
            loadData();
        } catch (error) {
            console.error('Update facility error', error);
            alert('فشل تحديث البيانات');
        } finally {
            setLoading(false);
        }
    };

    const handleFileSelect = (e, targetField) => {
        const file = e.target.files[0];
        if (file) {
            setCroppingState({
                isOpen: true,
                file: file,
                aspect: targetField === 'icon' ? 1 : 2.5, // 1:1 for logo, wider for cover
                targetField: targetField
            });
        }
    };

    const handleCropDone = (croppedFile) => {
        if (croppingState.targetField === 'icon') {
            setEditFiles({ ...editFiles, icon_file: croppedFile });
        } else {
            setEditFiles({ ...editFiles, cover_file: croppedFile });
        }
        setCroppingState({ isOpen: false, file: null, aspect: 1, targetField: null });
    };

    if (loading) return (
        <div className="facility-modal-overlay">
            <div className="facility-modal-container" style={{ padding: '50px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <button className="fac-close-btn" onClick={onClose}>✕</button>
                <div className="spinner" style={{ margin: '0 auto 20px' }}></div>
                <p style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>جاري تحميل بيانات المرفق...</p>
            </div>
        </div>
    );

    if (!data || !data.facility) return (
        <div className="facility-modal-overlay" onClick={onClose}>
            <div className="facility-modal-container" style={{ padding: '40px', textAlign: 'center', background: 'var(--bg-primary)' }}>
                <div style={{ fontSize: '3rem', marginBottom: '20px' }}>⚠️</div>
                <h3 style={{ color: 'var(--text-primary)' }}>عذراً، لم يتم العثور على بيانات هذا المرفق</h3>
                <p style={{ color: 'var(--text-muted)', marginBottom: '30px' }}>قد يكون المرفق تم حذفه أو أن هناك مشكلة في الاتصال.</p>
                <button className="btn-primary" onClick={onClose} style={{ padding: '10px 30px' }}>إغلاق</button>
            </div>
        </div>
    );

    const { facility, posts = [], specialties = [], is_admin: backendIsAdmin } = data;
    const is_admin = backendIsAdmin || (currentUser && (currentUser.role === 'admin' || String(currentUser.userId || currentUser.id) === String(facility.owner_id)));


    return (
        <div className="facility-modal-overlay" onClick={onClose}>
            <div className="facility-modal-container slide-up" onClick={e => e.stopPropagation()}>
                {/* Standard Modal Header (Sticky) */}
                <div className="modal-header" style={{ 
                    position: 'sticky', 
                    top: 0, 
                    zIndex: 1000, 
                    background: 'var(--bg-secondary)', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    padding: 'calc(env(safe-area-inset-top, 0px) + 12px) 15px 12px',
                    borderBottom: '1px solid var(--bg-tertiary)',
                    backdropFilter: 'blur(10px)'
                }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                            onClick={handleShare} 
                            style={{ 
                                background: 'rgba(251, 171, 21, 0.1)', 
                                border: 'none', 
                                color: 'var(--primary)', 
                                cursor: 'pointer',
                                padding: '10px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '50%',
                                transition: 'background 0.2s'
                            }}
                            onMouseOver={e => e.currentTarget.style.background = 'rgba(251, 171, 21, 0.2)'}
                            onMouseOut={e => e.currentTarget.style.background = 'rgba(251, 171, 21, 0.1)'}
                            title="مشاركة"
                        >
                            <ShareIcon />
                        </button>
                        
                        {is_admin && !isEditing && (
                            <button 
                                onClick={() => setIsEditing(true)}
                                style={{ 
                                    background: 'rgba(251, 171, 21, 0.1)', 
                                    border: 'none', 
                                    color: '#fbab15', 
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '50%', 
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'all 0.2s'
                                }}
                                title="تعديل المرفق"
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            </button>
                        )}
                    </div>
                    
                    <h2 style={{ 
                        margin: 0, 
                        fontSize: '1rem', 
                        fontWeight: '900', 
                        color: 'var(--text-primary)', 
                        flex: 1, 
                        textAlign: 'center',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        padding: '0 10px'
                    }}>
                        {facility?.name || 'تفاصيل المرفق'}
                    </h2>

                    <button 
                        className="btn-close" 
                        onClick={onClose} 
                        style={{ 
                            fontSize: '1.2rem', 
                            position: 'static', 
                            background: 'rgba(255,255,255,0.1)',
                            width: '40px',
                            height: '40px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '50%',
                            border: 'none',
                            color: 'var(--text-primary)'
                        }}
                    >✕</button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                    {isEditing ? (
                        <div className="fac-edit-form" style={{ padding: '25px', background: 'var(--bg-secondary)', height: 'auto' }}>
                            <h2 style={{ marginBottom: '20px', color: '#fbab15' }}>تعديل بيانات المرفق</h2>
                            <form onSubmit={handleUpdateFacility}>
                                <div className="form-group" style={{ marginBottom: '15px' }}>
                                    <label style={{ display: 'block', marginBottom: '8px', opacity: 0.8 }}>اسم المرفق</label>
                                    <input 
                                        className="input" 
                                        value={editData.name} 
                                        onChange={e => setEditData({...editData, name: e.target.value})} 
                                        required 
                                        style={{ width: '100%' }}
                                    />
                                </div>
                                <div className="form-group" style={{ marginBottom: '15px' }}>
                                    <label style={{ display: 'block', marginBottom: '8px', opacity: 0.8 }}>وصف المرفق</label>
                                    <textarea 
                                        className="textarea" 
                                        value={editData.description} 
                                        onChange={e => setEditData({...editData, description: e.target.value})} 
                                        style={{ width: '100%', minHeight: '100px' }}
                                    />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                                    <div className="edit-image-preview-container">
                                        <label style={{ display: 'block', marginBottom: '8px', opacity: 0.8, fontSize: '0.9rem' }}>الشعار (Profile/Logo)</label>
                                        <div style={{ 
                                            width: '100px', height: '100px', borderRadius: '12px', background: 'var(--bg-tertiary)', 
                                            marginBottom: '10px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            border: '2px dashed #fbab15'
                                        }}>
                                            {editFiles.icon_file ? (
                                                <img src={URL.createObjectURL(editFiles.icon_file)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            ) : (
                                                facility.icon && facility.icon.startsWith('http') ? (
                                                    <img src={getImageUrl(facility.icon)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                ) : (
                                                    <span style={{ fontSize: '2rem' }}>{editData.icon || '🏛️'}</span>
                                                )
                                            )}
                                        </div>
                                        <input 
                                            type="file" 
                                            accept="image/*"
                                            onChange={e => handleFileSelect(e, 'icon')} 
                                            style={{ fontSize: '0.8rem', width: '100%' }}
                                        />
                                        <input 
                                            placeholder="أو اكتب إيموجي هنا"
                                            className="input" 
                                            value={editData.icon} 
                                            onChange={e => setEditData({...editData, icon: e.target.value})} 
                                            style={{ width: '100%', marginTop: '5px', fontSize: '0.8rem' }}
                                        />
                                    </div>
                                    <div className="edit-image-preview-container">
                                        <label style={{ display: 'block', marginBottom: '8px', opacity: 0.8, fontSize: '0.9rem' }}>صورة الغلاف (Cover Image)</label>
                                        <div style={{ 
                                            width: '100%', height: '100px', borderRadius: '12px', background: 'var(--bg-tertiary)', 
                                            marginBottom: '10px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            border: '2px dashed #fbab15'
                                        }}>
                                            {editFiles.cover_file ? (
                                                <img src={URL.createObjectURL(editFiles.cover_file)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            ) : (
                                                <img src={getImageUrl(facility.cover_background) || 'https://images.unsplash.com/photo-1562774053-701939374585?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            )}
                                        </div>
                                        <input 
                                            type="file" 
                                            accept="image/*"
                                            onChange={e => handleFileSelect(e, 'cover')} 
                                            style={{ fontSize: '0.8rem', width: '100%' }}
                                        />
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '15px', marginTop: '30px' }}>
                                    <button type="submit" className="btn-primary" style={{ flex: 2, padding: '12px', fontWeight: 'bold' }}>حفظ التغييرات</button>
                                    <button type="button" className="btn-secondary" onClick={() => setIsEditing(false)} style={{ flex: 1, padding: '12px' }}>إلغاء</button>
                                </div>
                            </form>
                        </div>
                    ) : (
                        <>
                            <div className="fac-header">
                                <img 
                                    src={getImageUrl(facility.cover_background) || 'https://images.unsplash.com/photo-1562774053-701939374585?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80'} 
                                    className="fac-cover" 
                                    alt="Facility Cover" 
                                />
                                <div className="fac-header-content">
                                    <div className="fac-icon-large">
                                        {facility.icon && facility.icon.startsWith('http') ? (
                                            <img src={getImageUrl(facility.icon)} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '12px' }} />
                                        ) : (
                                            facility.icon || '🏛️'
                                        )}
                                    </div>
                                    <div className="fac-title-info">
                                        <h2>{facility.name}</h2>
                                        <p>{facility.category} - {facility.university_name}</p>
                                    </div>
                                </div>
                            </div>

                    <div className="fac-tabs">
                        <button className={`fac-tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>نظرة عامة</button>
                        {facility.category === 'الكليات' && (
                            <button className={`fac-tab ${activeTab === 'specialties' ? 'active' : ''}`} onClick={() => setActiveTab('specialties')}>التخصصات والبرامج</button>
                        )}
                        <button className={`fac-tab ${activeTab === 'news' ? 'active' : ''}`} onClick={() => setActiveTab('news')}>الأخبار والفعاليات</button>
                    </div>

                    <div className="fac-content">
                        {activeTab === 'overview' && (
                            <div className="fac-overview">
                                <div className="desc-card" style={{ background: 'var(--bg-secondary)', padding: '25px', borderRadius: '16px', border: '1px solid var(--bg-tertiary)' }}>
                                    <h3 style={{ marginTop: 0 }}>عن {facility.name}</h3>
                                    <p style={{ lineHeight: 1.8 }}>{facility.description || 'لا يوجد وصف متاح لهذا المرفق حالياً، سيتم تحديث المعلومات قريباً من قبل إدارة الجامعة.'}</p>
                                </div>
                            </div>
                        )}

                        {activeTab === 'specialties' && (
                            <div className="fac-specs">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                    <h3 style={{ margin: 0 }}>الأقسام والتخصصات الدراسية</h3>
                                    {is_admin && (
                                        <button className="btn-small is-primary" onClick={() => setShowAddSpec(true)}>+ إضافة تخصص</button>
                                    )}
                                </div>

                                {showAddSpec && (
                                    <form onSubmit={handleAddSpec} style={{ background: 'var(--bg-tertiary)', padding: '20px', borderRadius: '12px', marginBottom: '20px' }}>
                                        <input placeholder="اسم التخصص" className="input" value={newSpec.name} onChange={e => setNewSpec({...newSpec, name: e.target.value})} style={{ width: '100%', marginBottom: '10px' }} required />
                                        <textarea placeholder="وصف التخصص" className="textarea" value={newSpec.description} onChange={e => setNewSpec({...newSpec, description: e.target.value})} style={{ width: '100%', marginBottom: '10px' }} />
                                        <select className="select" value={newSpec.degree_level} onChange={e => setNewSpec({...newSpec, degree_level: e.target.value})} style={{ width: '100%', marginBottom: '10px' }}>
                                            <option value="البكالوريوس">دبلوم / بكالوريوس</option>
                                            <option value="الماجستير">ماجستير</option>
                                            <option value="الدكتوراة">دكتوراة</option>
                                        </select>
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <button type="submit" className="btn-small is-accept">حفظ</button>
                                            <button type="button" className="btn-small" onClick={() => setShowAddSpec(false)}>إلغاء</button>
                                        </div>
                                    </form>
                                )}

                                <div className="specs-grid">
                                    {specialties.length === 0 ? (
                                        <p style={{ color: 'var(--text-muted)' }}>لا توجد تخصصات مضافة بعد.</p>
                                    ) : (
                                        specialties.map(spec => (
                                            <div key={spec.id} className="spec-card">
                                                <span className="spec-degree">{spec.degree_level || 'البكالوريوس'}</span>
                                                <h4 style={{ margin: '5px 0' }}>{spec.name}</h4>
                                                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 0 }}>{spec.description}</p>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'news' && (
                            <div className="fac-news">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                    <h3 style={{ margin: 0 }}>حائط الأخبار والفعاليات</h3>
                                    {is_admin && (
                                        <button className="btn-small is-primary" onClick={() => setShowAddPost(true)}>+ نشر خبر/فعالية</button>
                                    )}
                                </div>

                                {showAddPost && (
                                    <form onSubmit={handleAddPost} style={{ background: 'var(--bg-tertiary)', padding: '20px', borderRadius: '12px', marginBottom: '20px' }}>
                                        <input placeholder="عنوان الخبر" className="input" value={newPost.title} onChange={e => setNewPost({...newPost, title: e.target.value})} style={{ width: '100%', marginBottom: '10px' }} required />
                                        <textarea placeholder="تفاصيل الخبر..." className="textarea" value={newPost.content} onChange={e => setNewPost({...newPost, content: e.target.value})} style={{ width: '100%', marginBottom: '10px' }} required />
                                        <select className="select" value={newPost.post_type} onChange={e => setNewPost({...newPost, post_type: e.target.value})} style={{ width: '100%', marginBottom: '10px' }}>
                                            <option value="news">خبر عادي 📢</option>
                                            <option value="event">فعالية قادمة 🎭</option>
                                            <option value="achievement">إنجاز جديد 🏆</option>
                                        </select>
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <button type="submit" className="btn-small is-accept">نشر الآن</button>
                                            <button type="button" className="btn-small" onClick={() => setShowAddPost(false)}>إلغاء</button>
                                        </div>
                                    </form>
                                )}

                                <div className="posts-wall">
                                    {posts.length === 0 ? (
                                        <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>لا توجد أخبار مضافة لهذا المرفق بعد.</p>
                                    ) : (
                                        posts.map(post => (
                                            <div key={post.id} className="fac-post-card">
                                                <div className="post-meta">
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                        <img src={getImageUrl(post.user_avatar) || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'} style={{ width: 30, height: 30, borderRadius: '50%' }} />
                                                        <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{post.username}</span>
                                                    </div>
                                                    <span className={`post-tag tag-${post.post_type}`}>
                                                        {post.post_type === 'news' ? '📢 خبر' : post.post_type === 'event' ? '🎭 فعالية' : '🏆 إنجاز'}
                                                    </span>
                                                </div>
                                                <h4 style={{ margin: '10px 0' }}>{post.title}</h4>
                                                <p style={{ fontSize: '0.95rem', color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>{post.content}</p>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '15px' }}>
                                                    {new Date(post.created_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}

            {croppingState.isOpen && (
                <ImageCropperModal 
                    imageFile={croppingState.file}
                    aspect={croppingState.aspect}
                    onCropDone={handleCropDone}
                    onCancel={() => setCroppingState({ isOpen: false, file: null, aspect: 1, targetField: null })}
                />
            )}
        </div>
            </div>
        </div>
    );
};

export default FacilityProfileModal;
