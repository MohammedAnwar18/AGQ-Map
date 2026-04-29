import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { adminService } from '../services/adminApi';
import './AdminDashboard.css';

const AdminUserDetails = () => {
    const { userId } = useParams();
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadUserDetails();
    }, [userId]);

    const loadUserDetails = async () => {
        try {
            const data = await adminService.getUserDetails(userId);
            setUser(data.user);
            setPosts(data.posts);
        } catch (error) {
            console.error('Failed to load user details:', error);
            alert('Failed to load user details');
        } finally {
            setLoading(false);
        }
    };

    const handleDeletePost = async (postId) => {
        if (!window.confirm('هل أنت متأكد من حذف هذا المنشور؟')) return;
        try {
            await adminService.deletePost(postId);
            setPosts(posts.filter(p => p.id !== postId));
            alert('تم حذف المنشور بنجاح');
        } catch (error) {
            console.error('Failed to delete post:', error);
            alert('فشل في حذف المنشور');
        }
    };

    const handleToggleStatus = async () => {
        try {
            await adminService.toggleUserStatus(userId, !user.is_active);
            setUser({ ...user, is_active: !user.is_active });
            alert(`تم ${!user.is_active ? 'تفعيل' : 'تعطيل'} الحساب بنجاح`);
        } catch (error) {
            console.error('Failed to update status:', error);
            alert('فشل في تحديث حالة الحساب');
        }
    };

    const handleDeleteUser = async () => {
        if (!window.confirm('هل أنت متأكد من حذف هذا المستخدم نهائياً؟ لا يمكن التراجع!')) return;
        try {
            await adminService.deleteUser(userId);
            alert('تم حذف الحساب بنجاح');
            navigate('/admin');
        } catch (error) {
            console.error('Failed to delete user:', error);
            alert('فشل في حذف الحساب');
        }
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('ar-SA', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatBirthDate = (dateString) => {
        if (!dateString) return 'غير متوفر';
        return new Date(dateString).toLocaleDateString('ar-SA', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const calculateAge = (dob) => {

        const diff = Date.now() - new Date(dob).getTime();
        return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
    };

    const getImageUrl = (path) => {
        if (!path) return null;
        if (path.startsWith('http')) return path;
        return `${import.meta.env.VITE_API_URL || ''}${path}`;
    };

    if (loading) {
        return (
            <div className="admin-dashboard" style={{ alignItems: 'center', justifyContent: 'center' }}>
                <div className="spinner"></div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="admin-dashboard" style={{ alignItems: 'center', justifyContent: 'center' }}>
                <h2>المستخدم غير موجود</h2>
            </div>
        );
    }

    const mapCenter = posts.length > 0 && posts[0].location
        ? [posts[0].location.latitude, posts[0].location.longitude]
        : [31.9, 35.2];

    return (
        <div className="admin-dashboard">
            <div className="admin-main" style={{ maxWidth: '1600px' }}>
                {/* Profile Header */}
                <div className="admin-header">
                    <div className="header-title-area">
                        <button 
                            className="btn-circle" 
                            onClick={() => navigate('/admin')}
                            style={{ marginBottom: '1.5rem', width: 'auto', padding: '0 1.5rem', borderRadius: '12px' }}
                        >
                            <span style={{ marginLeft: '10px' }}>🔙</span> العودة للوحة التحكم
                        </button>
                        <h2>الملف الشخصي الكامل</h2>
                        <p>إدارة بيانات المستخدم: {user.full_name || user.username} • معرف: #{user.id}</p>
                    </div>

                    <div className="action-btns">
                        <button 
                            className="btn-circle" 
                            style={{ width: 'auto', padding: '0 2rem', background: user.is_active ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', color: user.is_active ? '#ef4444' : '#10b981', border: '1px solid currentColor' }}
                            onClick={handleToggleStatus}
                        >
                            {user.is_active ? '⏸️ تعطيل الحساب' : '▶️ تفعيل الحساب'}
                        </button>
                        <button 
                            className="btn-circle destructive" 
                            style={{ width: 'auto', padding: '0 2rem' }}
                            onClick={handleDeleteUser}
                        >
                            🗑️ حذف المستخدم نهائياً
                        </button>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '3rem' }}>
                    {/* User Identity Section */}
                    <div className="admin-content-card" style={{ height: 'fit-content' }}>
                        <div style={{ padding: '3rem', textAlign: 'center' }}>
                            <div style={{ position: 'relative', display: 'inline-block', marginBottom: '2.5rem' }}>
                                <a href={getImageUrl(user.profile_picture) || '/default-avatar.png'} target="_blank" rel="noopener noreferrer">
                                    <img
                                        src={getImageUrl(user.profile_picture) || '/default-avatar.png'}
                                        alt={user.username}
                                        style={{
                                            width: '180px',
                                            height: '180px',
                                            borderRadius: '40px',
                                            objectFit: 'cover',
                                            border: '4px solid var(--accent)',
                                            boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                                            cursor: 'pointer'
                                        }}
                                        title="انقر لتكبير الصورة"
                                    />
                                </a>

                                <div style={{ 
                                    position: 'absolute', 
                                    bottom: '-10px', 
                                    right: '-10px',
                                    background: user.is_active ? '#10b981' : '#ef4444',
                                    padding: '0.5rem 1.5rem',
                                    borderRadius: '12px',
                                    fontWeight: 900,
                                    fontSize: '0.8rem',
                                    border: '3px solid #020617'
                                }}>
                                    {user.is_active ? 'نشط' : 'موقف'}
                                </div>
                            </div>

                            <h2 style={{ fontSize: '2.2rem', marginBottom: '0.5rem' }}>{user.full_name || user.username}</h2>
                            <p style={{ color: 'var(--accent)', fontSize: '1.2rem', fontWeight: 700, marginBottom: '2.5rem' }}>@{user.username}</p>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', textAlign: 'right' }}>
                                <div className="stat-mini-card" style={{ background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '24px', border: '1px solid var(--glass-border)' }}>
                                    <small style={{ color: '#64748b', display: 'block', marginBottom: '0.5rem' }}>الجنس</small>
                                    <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>{user.gender === 'male' ? 'ذكر ♂️' : user.gender === 'female' ? 'أنثى ♀️' : 'غير محدد'}</span>
                                </div>
                                <div className="stat-mini-card" style={{ background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '24px', border: '1px solid var(--glass-border)' }}>
                                    <small style={{ color: '#64748b', display: 'block', marginBottom: '0.5rem' }}>العمر</small>
                                    <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>{user.date_of_birth ? `${calculateAge(user.date_of_birth)} سنة` : '--'}</span>
                                </div>
                            </div>
                        </div>

                        <div style={{ padding: '0 3rem 3rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                <div className="info-row">
                                    <strong style={{ color: '#64748b', display: 'block', fontSize: '0.9rem', marginBottom: '0.3rem' }}>البريد الإلكتروني</strong>
                                    <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>{user.email}</p>
                                </div>
                                <div className="info-row">
                                    <strong style={{ color: '#64748b', display: 'block', fontSize: '0.9rem', marginBottom: '0.3rem' }}>تاريخ التسجيل</strong>
                                    <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>{formatDate(user.created_at)}</p>
                                </div>
                                <div className="info-row">
                                    <strong style={{ color: '#64748b', display: 'block', fontSize: '0.9rem', marginBottom: '0.3rem' }}>تاريخ الميلاد</strong>
                                    <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>{formatBirthDate(user.date_of_birth)} ({calculateAge(user.date_of_birth)} سنة)</p>
                                </div>

                                <div className="info-row">
                                    <strong style={{ color: '#64748b', display: 'block', fontSize: '0.9rem', marginBottom: '0.3rem' }}>آخر ظهور</strong>
                                    <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>{user.last_seen ? formatDate(user.last_seen) : 'غير معروف'}</p>
                                </div>
                                <div className="info-row">
                                    <strong style={{ color: '#64748b', display: 'block', fontSize: '0.9rem', marginBottom: '0.3rem' }}>الحالة الاجتماعية</strong>
                                    <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>{user.marital_status || 'غير محدد'}</p>
                                </div>
                                <div className="info-row">
                                    <strong style={{ color: '#64748b', display: 'block', fontSize: '0.9rem', marginBottom: '0.3rem' }}>مكان العمل</strong>
                                    <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>{user.workplace || 'غير محدد'}</p>
                                </div>
                                <div className="info-row">
                                    <strong style={{ color: '#64748b', display: 'block', fontSize: '0.9rem', marginBottom: '0.3rem' }}>المستوى التعليمي</strong>
                                    <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>{user.education || 'غير محدد'} - {user.institution || ''}</p>
                                </div>
                                <div className="info-row">
                                    <strong style={{ color: '#64748b', display: 'block', fontSize: '0.9rem', marginBottom: '0.3rem' }}>نوع الحساب</strong>
                                    <p style={{ fontSize: '1.1rem', fontWeight: 600, color: user.role === 'admin' ? '#ef4444' : '#fbab15' }}>{user.role === 'admin' ? 'مدير نظام' : 'مستخدم عادي'}</p>
                                </div>
                                {user.bio && (
                                    <div className="info-row" style={{ background: 'rgba(251, 171, 21, 0.05)', padding: '1.5rem', borderRadius: '20px', border: '1px solid rgba(251, 171, 21, 0.1)' }}>
                                        <strong style={{ color: 'var(--accent)', display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem' }}>نبذة تعريفية</strong>
                                        <p style={{ margin: 0, lineHeight: 1.6 }}>{user.bio}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>

                    {/* Content & Activity Section */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
                        {/* Interactive Activity Map */}
                        <div className="admin-content-card">
                            <div className="content-header">
                                <h3>النشاط الجغرافي للمستخدم</h3>
                            </div>
                            <div style={{ height: '450px', position: 'relative' }}>
                                <MapContainer
                                    center={mapCenter}
                                    zoom={13}
                                    style={{ height: '100%', width: '100%' }}
                                >
                                    <TileLayer
                                        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                                        attribution='&copy; CartoDB'
                                    />
                                    {posts.filter(p => p.location).map(post => (
                                        <Marker
                                            key={post.id}
                                            position={[post.location.latitude, post.location.longitude]}
                                        >
                                            <Popup>
                                                <div style={{ minWidth: '220px', color: '#000' }}>
                                                    {post.image_url && (
                                                        <img
                                                            src={post.image_url}
                                                            alt="Post"
                                                            style={{ width: '100%', borderRadius: '12px', marginBottom: '12px' }}
                                                        />
                                                    )}
                                                    <p style={{ margin: '0 0 10px 0', fontWeight: 600 }}>{post.content}</p>
                                                    <small style={{ color: '#666' }}>{formatDate(post.created_at)}</small>
                                                </div>
                                            </Popup>
                                        </Marker>
                                    ))}
                                </MapContainer>
                            </div>
                        </div>

                        {/* Detailed Data List */}
                        <div className="admin-content-card">
                            <div className="content-header">
                                <h3>كافة مدخلات البيانات ({posts.length})</h3>
                            </div>
                            <div className="admin-table-wrapper">
                                <table className="admin-table">
                                    <thead>
                                        <tr>
                                            <th>المحتوى والمعاينة</th>
                                            <th>الموقع</th>
                                            <th>التاريخ</th>
                                            <th>الإدارة</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {posts.map(post => (
                                            <tr key={post.id}>
                                                <td>
                                                    <div className="user-cell">
                                                        {post.image_url && (
                                                            <a href={post.image_url} target="_blank" rel="noopener noreferrer">
                                                                <img src={post.image_url} alt="Content" className="user-avatar" style={{ width: '100px', height: '70px', borderRadius: '14px', cursor: 'pointer' }} title="انقر لتكبير الصورة" />
                                                            </a>
                                                        )}
                                                        <div className="user-info">
                                                            <h4 style={{ fontSize: '1rem' }}>{post.content || 'محتوى مرئي'}</h4>
                                                        </div>
                                                    </div>

                                                </td>
                                                <td>
                                                    <span style={{ fontSize: '0.85rem', opacity: 0.7 }}>
                                                        📍 {post.address || 'إحداثيات جغرافية'}
                                                    </span>
                                                </td>
                                                <td>{formatDate(post.created_at)}</td>
                                                <td>
                                                    <button 
                                                        className="btn-circle destructive" 
                                                        style={{ width: '40px', height: '40px' }}
                                                        onClick={() => handleDeletePost(post.id)}
                                                    >
                                                        🗑️
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {posts.length === 0 && (
                                    <div style={{ padding: '5rem', textAlign: 'center', opacity: 0.5 }}>
                                        <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>📭</div>
                                        <p>لا توجد بيانات مسجلة لهذا المستخدم بعد</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminUserDetails;
