import React, { useState, useEffect } from 'react';
import { shopService, getImageUrl } from '../services/api';
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
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');

    // For Adding Content (Admin/Owner only)
    const [showAddPost, setShowAddPost] = useState(false);
    const [newPost, setNewPost] = useState({ title: '', content: '', post_type: 'news' });
    const [showAddSpec, setShowAddSpec] = useState(false);
    const [newSpec, setNewSpec] = useState({ name: '', description: '', degree_level: 'البكالوريوس' });

    useEffect(() => {
        loadData();
    }, [facilityId]);

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await shopService.getFacilityProfile(facilityId);
            setData(res);
            if (res.facility.category === 'الكليات') {
                setActiveTab('specialties');
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

    if (loading) return (
        <div className="facility-modal-overlay">
            <div className="facility-modal-container" style={{ padding: '50px', textAlign: 'center' }}>
                جاري التحميل...
            </div>
        </div>
    );

    if (!data) return null;

    const { facility, posts, specialties, is_admin } = data;

    return (
        <div className="facility-modal-overlay" onClick={onClose}>
            <div className="facility-modal-container slide-up" onClick={e => e.stopPropagation()}>
                <div style={{ position: 'absolute', top: '15px', left: '15px', display: 'flex', gap: '10px', zIndex: 100 }}>
                    <button 
                        onClick={handleShare} 
                        style={{ 
                            background: 'rgba(0,0,0,0.5)', 
                            border: '1px solid rgba(255,255,255,0.2)', 
                            color: 'white', 
                            padding: '6px 12px', 
                            borderRadius: '8px', 
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '0.85rem'
                        }}
                    >
                        <ShareIcon /> مشاركة
                    </button>
                    <button className="fac-close-btn" onClick={onClose} style={{ position: 'static' }}>✕</button>
                </div>

                <div className="fac-header">
                    <img 
                        src={facility.cover_background || 'https://images.unsplash.com/photo-1562774053-701939374585?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80'} 
                        className="fac-cover" 
                        alt="Facility Cover" 
                    />
                    <div className="fac-header-content">
                        <div className="fac-icon-large">
                            {facility.icon || '🏛️'}
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
                                <p style={{ lineHeight: 1.8 }}>{facility.description || 'لا يوجد وصف متاح لهذا المرفق حالياً، سيتم تحديث المعلومات قريباً م قبل إدارة الجامعة.'}</p>
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
            </div>
        </div>
    );
};

export default FacilityProfileModal;
