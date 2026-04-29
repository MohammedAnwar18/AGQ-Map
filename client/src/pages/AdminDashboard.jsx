import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { adminService } from '../services/adminApi';

import './AdminDashboard.css';

const AdminDashboard = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('overview');
    const [stats, setStats] = useState(null);
    const [users, setUsers] = useState([]);
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pagination, setPagination] = useState(null);

    // Bulk selection states
    const [selectedUsers, setSelectedUsers] = useState([]);

    // Check admin permissions
    useEffect(() => {
        if (!user || user.role !== 'admin') {
            alert('Access Denied: Admin privileges required');
            navigate('/map');
        }
    }, [user, navigate]);

    // Load data based on tab/page
    useEffect(() => {
        if (user && user.role === 'admin') {
            loadData();
        }
    }, [activeTab, currentPage, searchQuery]);

    const loadData = async () => {
        setLoading(true);
        setSelectedUsers([]);
        try {
            if (activeTab === 'overview') {
                const statsData = await adminService.getStats();
                setStats(statsData.stats);
            } else if (activeTab === 'users') {
                const usersData = await adminService.getAllUsers(searchQuery, currentPage, 15);
                setUsers(usersData.users);
                setPagination(usersData.pagination);
            } else if (activeTab === 'posts' || activeTab === 'data' || activeTab === 'files') {
                const postsData = await adminService.getAllPosts(currentPage, 30);
                setPosts(postsData.posts);
                setPagination(postsData.pagination);
            }
        } catch (error) {
            console.error('Failed to load data:', error);
        } finally {
            setTimeout(() => setLoading(false), 400); // Smooth transition for premium feel
        }
    };

    // Bulk operations handlers
    const handleSelectAllUsers = (e) => {
        if (e.target.checked) setSelectedUsers(users.map(u => u.id));
        else setSelectedUsers([]);
    };

    const handleSelectUser = (userId) => {
        setSelectedUsers(prev =>
            prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
        );
    };

    const handleBulkDeleteUsers = async () => {
        if (selectedUsers.length === 0) return alert('يرجى تحديد مستخدمين للحذف');
        if (window.confirm(`هل أنت متأكد من حذف ${selectedUsers.length} مستخدم؟`)) {
            try {
                await Promise.all(selectedUsers.map(userId => adminService.deleteUser(userId)));
                alert('تم حذف المستخدمين بنجاح');
                loadData();
            } catch (error) {
                alert('حدث خطأ أثناء الحذف');
            }
        }
    };

    const handleDeleteUser = async (userId) => {
        if (window.confirm('هل أنت متأكد من حذف هذا المستخدم نهائياً؟')) {
            try {
                await adminService.deleteUser(userId);
                loadData();
            } catch (error) {
                alert('فشل في حذف المستخدم');
            }
        }
    };

    const handleToggleUserStatus = async (userId, currentStatus) => {
        try {
            await adminService.toggleUserStatus(userId, !currentStatus);
            loadData();
        } catch (error) {
            alert('فشل في تحديث حالة المستخدم');
        }
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('ar-SA', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    if (!user || user.role !== 'admin') return null;

    return (
        <div className="admin-dashboard">
            {/* Design Enhanced Sidebar */}
            <div className="admin-sidebar">
                <div className="admin-logo">
                    <h1>📍 PalNovaa</h1>
                    <p>SUPER ADMIN PANEL</p>
                </div>

                <nav className="admin-nav">
                    {[
                        { id: 'overview', icon: '📊', label: 'الرئيسية' },
                        { id: 'users', icon: '👥', label: 'المستخدمين' },
                        { id: 'data', icon: '📝', label: 'كل البيانات' },
                        { id: 'files', icon: '📁', label: 'ملفات الوسائط' },
                        { id: 'map', icon: '🌏', label: 'خارطة النشاط' },
                    ].map(tab => (
                        <a
                            key={tab.id}
                            href="#"
                            className={`admin-nav-item ${activeTab === tab.id ? 'active' : ''}`}
                            onClick={(e) => { e.preventDefault(); setActiveTab(tab.id); setCurrentPage(1); }}
                        >
                            <span className="admin-nav-icon">{tab.icon}</span>
                            <span>{tab.label}</span>
                        </a>
                    ))}
                </nav>

                <div className="admin-logout">
                    <button onClick={() => { logout(); navigate('/login'); }}>
                        🚪 تسجيل الخروج
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="admin-main">
                {/* Modern Header Section */}
                <div className="admin-header">
                    <div className="header-title-area">
                        <h2>{
                            activeTab === 'overview' ? 'لوحة التحكم العامة' : 
                            activeTab === 'users' ? 'إدارة الحسابات' : 
                            activeTab === 'data' ? 'إدارة المحتوى والبيانات' :
                            activeTab === 'files' ? 'مكتبة الوسائط' : 'خارطة النشاط الموحدة'
                        }</h2>
                        <p>مرحباً بك يا {user.full_name || user.username} • {new Date().toLocaleDateString('ar-SA', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    </div>
                    
                    <div className="admin-profile-snippet">
                        <div className="user-info" style={{ textAlign: 'left' }}>
                            <h4 style={{ margin: 0 }}>{user.username}</h4>
                            <p style={{ margin: 0, fontSize: '0.8rem' }}>المدير العام</p>
                        </div>
                        <img src={user.profile_picture || '/default-avatar.png'} alt="Admin" className="user-avatar" style={{ width: '45px', height: '45px' }} />
                    </div>
                </div>

                {/* Dashboard Tabs Rendering */}
                {activeTab === 'overview' && (
                    <div className="admin-tab-content">
                        {loading ? (
                            <div className="loading-container"><div className="spinner"></div></div>
                        ) : stats ? (
                            <>
                                <div className="stats-grid">
                                    <div className="stat-card" style={{ '--stat-color': '#fbab15' }}>
                                        <div className="stat-icon-wrapper">👥</div>
                                        <div className="stat-value">
                                            {stats.totalUsers}
                                        </div>
                                        <div className="stat-label">إجمالي الحسابات</div>
                                    </div>

                                    <div className="stat-card" style={{ '--stat-color': '#10b981' }}>
                                        <div className="stat-icon-wrapper">📝</div>
                                        <div className="stat-value">
                                            {stats.totalPosts}
                                        </div>
                                        <div className="stat-label">إجمالي البيانات</div>
                                    </div>

                                    <div className="stat-card" style={{ '--stat-color': '#3b82f6' }}>
                                        <div className="stat-icon-wrapper">🔥</div>
                                        <div className="stat-value">{stats.activeUsers}</div>
                                        <div className="stat-label">نشطون الآن</div>
                                    </div>

                                    <div className="stat-card" style={{ '--stat-color': '#ef4444' }}>
                                        <div className="stat-icon-wrapper">📸</div>
                                        <div className="stat-value">{stats.todayPosts}</div>
                                        <div className="stat-label">مدخلات اليوم</div>
                                    </div>
                                </div>

                                <div className="admin-content-card">
                                    <div className="content-header">
                                        <h3>آخر النشاطات على الشبكة</h3>
                                    </div>
                                    <div className="activity-placeholder" style={{ padding: '6rem 2rem', textAlign: 'center' }}>
                                        <div className="placeholder-icon" style={{ fontSize: '5rem', marginBottom: '1.5rem', opacity: 0.5 }}>📊</div>
                                        <p style={{ opacity: 0.7, fontSize: '1.3rem', maxWidth: '700px', margin: '0 auto' }}>
                                            كأدمن عام، يمكنك مراقبة كل صغيرة وكبيرة في النظام من هنا. الرسوم البيانية المتقدمة قيد المعالجة لتوفير تحليل أدق للبيانات.
                                        </p>
                                    </div>
                                </div>
                            </>
                        ) : null}
                    </div>
                )}

                {/* Users Management */}
                {activeTab === 'users' && (
                    <div className="admin-content-card">
                        <div className="content-header">
                            <h3>إدارة الحسابات والملفات الشخصية</h3>
                            <div className="admin-search">
                                <input
                                    type="text"
                                    placeholder="بحث عن مستخدم..."
                                    value={searchQuery}
                                    onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                                />
                                <span className="admin-search-icon">🔍</span>
                            </div>
                        </div>

                        <div className="admin-table-wrapper">
                            {loading ? (
                                <div className="loading-container"><div className="spinner"></div></div>
                            ) : (
                                <table className="admin-table">
                                    <thead>
                                        <tr>
                                            <th>المستخدم</th>
                                            <th>البريد الإلكتروني</th>
                                            <th>تاريخ الانضمام</th>
                                            <th>الحالة</th>
                                            <th>إجراءات الإدارة</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {users.map(u => (
                                            <tr key={u.id}>
                                                <td>
                                                    <div className="user-cell">
                                                        <div className="user-avatar-wrapper">
                                                            <img src={u.profile_picture || '/default-avatar.png'} alt={u.username} className="user-avatar" />
                                                            {u.is_active && <div className="user-status-dot"></div>}
                                                        </div>
                                                        <div className="user-info">
                                                            <h4>{u.full_name || u.username}</h4>
                                                            <p>@{u.username}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td><span style={{ opacity: 0.8, fontWeight: 600 }}>{u.email}</span></td>
                                                <td>{formatDate(u.created_at)}</td>
                                                <td>
                                                    <span className={`status-tag ${u.is_active ? 'active' : 'inactive'}`}>
                                                        {u.is_active ? 'نشط' : 'موقوف'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="action-btns">
                                                        <button className="btn-circle" title="فتح الملف الكامل" onClick={() => navigate(`/admin/users/${u.id}`)}>👤</button>
                                                        <button 
                                                            className="btn-circle" 
                                                            title={u.is_active ? 'إيقاف' : 'تفعيل'} 
                                                            onClick={() => handleToggleUserStatus(u.id, u.is_active)}
                                                            style={{ color: u.is_active ? '#ef4444' : '#10b981' }}
                                                        >
                                                            {u.is_active ? '🛡️' : '⚡'}
                                                        </button>
                                                        <button className="btn-circle destructive" title="حذف نهائي" onClick={() => handleDeleteUser(u.id)}>🗑️</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                        {pagination && pagination.totalPages > 1 && (
                            <div className="pagination">
                                {[...Array(pagination.totalPages)].map((_, i) => (
                                    <button key={i + 1} className={currentPage === i + 1 ? 'active' : ''} onClick={() => setCurrentPage(i + 1)}>{i + 1}</button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Global Data View */}
                {activeTab === 'data' && (
                    <div className="admin-content-card">
                        <div className="content-header">
                            <h3>مراجعة كافة البيانات المدخلة</h3>
                        </div>
                        <div className="admin-table-wrapper">
                            {loading ? (
                                <div className="loading-container"><div className="spinner"></div></div>
                            ) : (
                                <table className="admin-table">
                                    <thead>
                                        <tr>
                                            <th>المحتوى</th>
                                            <th>الناشر</th>
                                            <th>الموقع</th>
                                            <th>التاريخ</th>
                                            <th>التحكم</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {posts.map(p => (
                                            <tr key={p.id}>
                                                <td>
                                                    <div className="user-cell">
                                                        {p.image_url && <img src={p.image_url} alt="Post" className="user-avatar" style={{ width: '80px', height: '60px', borderRadius: '12px' }} />}
                                                        <div className="user-info">
                                                            <h4 style={{ fontSize: '1rem' }}>{p.content?.substring(0, 40) || 'محتوى مرئي'}...</h4>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className="user-info">
                                                        <h4>{p.user.full_name}</h4>
                                                        <p>@{p.user.username}</p>
                                                    </div>
                                                </td>
                                                <td><span style={{ fontSize: '0.9rem', opacity: 0.7 }}>{p.address?.substring(0, 30) || 'إحداثيات جغرافية'}</span></td>
                                                <td>{formatDate(p.created_at)}</td>
                                                <td>
                                                    <button className="btn-circle destructive" onClick={() => adminService.deletePost(p.id).then(loadData)}>🗑️</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                )}

                {/* Media Files View */}
                {activeTab === 'files' && (
                    <div className="admin-content-card">
                        <div className="content-header">
                            <h3>مكتبة الوسائط والملفات</h3>
                        </div>
                        {loading ? (
                            <div className="loading-container"><div className="spinner"></div></div>
                        ) : (
                            <div className="media-grid">
                                {posts.filter(p => p.image_url).map(p => (
                                    <div key={p.id} className="media-item">
                                        <img src={p.image_url} alt="System File" className="media-thumb" />
                                        <div className="media-info">
                                            <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem' }}>بواسطة: @{p.user.username}</p>
                                            <small style={{ opacity: 0.6 }}>{formatDate(p.created_at)}</small>
                                            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                                                <button className="btn-circle destructive" style={{ width: '36px', height: '36px', fontSize: '0.9rem' }} onClick={() => adminService.deletePost(p.id).then(loadData)}>🗑️</button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Map View */}
                {activeTab === 'map' && (
                    <div className="admin-content-card" style={{ height: '70vh', position: 'relative' }}>
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(2, 6, 23, 0.6)', borderRadius: '40px' }}>
                            <div style={{ fontSize: '7rem', filter: 'drop-shadow(0 0 30px rgba(251, 171, 21, 0.4))' }}>🌏</div>
                            <h3 style={{ fontSize: '3rem', marginBottom: '1.5rem', marginTop: '2rem', fontWeight: 900 }}>خارطة التحكم الموحدة</h3>
                            <p style={{ maxWidth: '700px', textAlign: 'center', opacity: 0.8, fontSize: '1.4rem', lineHeight: 1.6, fontWeight: 500 }}>
                                يتم حالياً دمج طبقات البيانات الجغرافية المتقدمة لتمكينك من مراقبة النشاط الحي للمستخدمين والبيانات في الوقت الفعلي.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminDashboard;
