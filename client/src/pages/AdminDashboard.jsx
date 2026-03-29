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
    const [selectedPosts, setSelectedPosts] = useState([]);

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
        setSelectedPosts([]);
        try {
            if (activeTab === 'overview') {
                const statsData = await adminService.getStats();
                setStats(statsData.stats);
            } else if (activeTab === 'users') {
                const usersData = await adminService.getAllUsers(searchQuery, currentPage, 15);
                setUsers(usersData.users);
                setPagination(usersData.pagination);
            } else if (activeTab === 'posts') {
                const postsData = await adminService.getAllPosts(currentPage, 30);
                setPosts(postsData.posts);
                setPagination(postsData.pagination);
            }
        } catch (error) {
            console.error('Failed to load data:', error);
        } finally {
            setTimeout(() => setLoading(false), 300); // Smooth transition
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
                    <p>إدارة الشبكة الاجتماعية</p>
                </div>

                <nav className="admin-nav">
                    {[
                        { id: 'overview', icon: '📊', label: 'لوحة التحكم' },
                        { id: 'users', icon: '👥', label: 'المستخدمين' },
                        { id: 'posts', icon: '🖼️', label: 'المحتوى والمنشورات' },
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
                    <h2>{
                        activeTab === 'overview' ? 'نظرة عامة' : 
                        activeTab === 'users' ? 'إدارة المستخدمين' : 
                        activeTab === 'posts' ? 'إدارة المنشورات' : 'خلاصة النشاط الجغرافي'
                    }</h2>
                    <p>مرحباً بك مجدداً يا {user.full_name || user.username} • {new Date().toLocaleDateString('ar-SA', { day: 'numeric', month: 'long' })}</p>
                </div>

                {/* Dashboard Tabs Rendering */}
                {activeTab === 'overview' && (
                    <div className="admin-tab-content">
                        {loading ? (
                            <div className="loading-container"><div className="spinner"></div></div>
                        ) : stats ? (
                            <>
                                <div className="stats-grid">
                                    <div className="stat-card" style={{ '--stat-color': 'rgba(251, 171, 21, 0.2)' }}>
                                        <div className="stat-icon-wrapper">🚀</div>
                                        <div className="stat-value">
                                            {stats.totalUsers}
                                            <span className="stat-trend trend-up">+12%</span>
                                        </div>
                                        <div className="stat-label">إجمالي المستخدمين</div>
                                    </div>

                                    <div className="stat-card" style={{ '--stat-color': 'rgba(16, 185, 129, 0.2)' }}>
                                        <div className="stat-icon-wrapper">🏙️</div>
                                        <div className="stat-value">
                                            {stats.totalPosts}
                                            <span className="stat-trend trend-up">+8%</span>
                                        </div>
                                        <div className="stat-label">إجمالي المنشورات</div>
                                    </div>

                                    <div className="stat-card" style={{ '--stat-color': 'rgba(59, 130, 246, 0.2)' }}>
                                        <div className="stat-icon-wrapper">🔥</div>
                                        <div className="stat-value">{stats.activeUsers}</div>
                                        <div className="stat-label">المتصلين الآن</div>
                                    </div>

                                    <div className="stat-card" style={{ '--stat-color': 'rgba(239, 68, 68, 0.2)' }}>
                                        <div className="stat-icon-wrapper">📷</div>
                                        <div className="stat-value">{stats.todayPosts}</div>
                                        <div className="stat-label">منشورات اليوم</div>
                                    </div>
                                </div>

                                {/* Placeholder for Analytics Charts */}
                                <div className="admin-content-card" style={{ marginTop: '2rem' }}>
                                    <div className="content-header">
                                        <h3>تحليل التفاعل ونمو الشبكة</h3>
                                    </div>
                                    <div className="activity-placeholder" style={{ padding: '6rem 2rem' }}>
                                        <div className="placeholder-icon" style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>💠</div>
                                        <p style={{ opacity: 0.6, fontSize: '1.1rem' }}>سيوفر هذا القسم قريباً رسوماً بيانية تفاعلية مدعومة بالذكاء الاصطناعي لتحليل نمو قاعدة بياناتك.</p>
                                    </div>
                                </div>
                            </>
                        ) : null}
                    </div>
                )}

                {/* Users Management Sub-Module */}
                {activeTab === 'users' && (
                    <div className="admin-content-card">
                        <div className="content-header">
                            <div className="admin-search-group">
                                {selectedUsers.length > 0 && (
                                    <button className="btn-circle destructive" onClick={handleBulkDeleteUsers} style={{ width: 'auto', padding: '0 2rem' }}>
                                        حذف المحدد ({selectedUsers.length})
                                    </button>
                                )}
                                <div className="admin-search">
                                    <input
                                        type="text"
                                        placeholder="بحث عن مستخدم بالاسم أو المعرف..."
                                        value={searchQuery}
                                        onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                                    />
                                    <span className="admin-search-icon">🔍</span>
                                </div>
                            </div>
                        </div>

                        <div className="admin-table-wrapper">
                            {loading ? (
                                <div className="loading-container" style={{ padding: '6rem' }}><div className="spinner"></div></div>
                            ) : (
                                <table className="admin-table">
                                    <thead>
                                        <tr>
                                            <th><input type="checkbox" checked={selectedUsers.length === users.length && users.length > 0} onChange={handleSelectAllUsers} /></th>
                                            <th>المستخدم والملف</th>
                                            <th>البريد الإلكتروني</th>
                                            <th>تاريخ الانضمام</th>
                                            <th>الحالة</th>
                                            <th>الإجراءات السريعة</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {users.map(u => (
                                            <tr key={u.id}>
                                                <td><input type="checkbox" checked={selectedUsers.includes(u.id)} onChange={() => handleSelectUser(u.id)} /></td>
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
                                                <td><span style={{ opacity: 0.8 }}>{u.email}</span></td>
                                                <td>{formatDate(u.created_at)}</td>
                                                <td>
                                                    <span className={`status-tag ${u.is_active ? 'active' : 'inactive'}`}>
                                                        {u.is_active ? 'نشط بالكامل' : 'موقوف إدارياً'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="action-btns">
                                                        <button className="btn-circle" title="زيارة الملف" onClick={() => navigate(`/admin/users/${u.id}`)}>👤</button>
                                                        <button 
                                                            className="btn-circle" 
                                                            title={u.is_active ? 'إيقاف الصلاحيات' : 'إعادة تفعيل'} 
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

                {/* Posts/Content Tab Content (Similar Overhaul) */}
                {activeTab === 'posts' && (
                    <div className="admin-content-card">
                        <div className="content-header">
                            <h3>مراجعة محتوى الخريطة</h3>
                        </div>
                        <div className="admin-table-wrapper">
                            {loading ? (
                                <div className="loading-container" style={{ padding: '6rem' }}><div className="spinner"></div></div>
                            ) : (
                                <table className="admin-table">
                                    <thead>
                                        <tr>
                                            <th>المنشور</th>
                                            <th>الناشر</th>
                                            <th>التفاعلات</th>
                                            <th>التاريخ</th>
                                            <th>الضبط</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {posts.map(p => (
                                            <tr key={p.id}>
                                                <td>
                                                    <div className="user-cell">
                                                        {p.image_url && <img src={p.image_url} alt="Post" className="user-avatar" style={{ width: '60px', borderRadius: '12px' }} />}
                                                        <div className="user-info">
                                                            <h4 style={{ fontSize: '0.95rem' }}>{p.content?.substring(0, 30) || 'محتوى مرئي'}...</h4>
                                                            <p style={{ fontSize: '0.75rem' }}>{p.address?.substring(0, 25) || 'موقع جغرافي'}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className="user-info">
                                                        <h4>{p.user.full_name}</h4>
                                                        <p>@{p.user.username}</p>
                                                    </div>
                                                </td>
                                                <td><span style={{ fontWeight: 800 }}>{p.likes_count || 0} ❤️ / {p.comments_count || 0} 💬</span></td>
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

                {/* Map View Content Placeholder */}
                {activeTab === 'map' && (
                    <div className="admin-content-card" style={{ height: '70vh', position: 'relative' }}>
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(15, 23, 42, 0.4)', borderRadius: '32px' }}>
                            <div style={{ fontSize: '6rem', animation: 'pulse 2s infinite' }}>🌏</div>
                            <h3 style={{ fontSize: '2.5rem', marginBottom: '1.5rem', marginTop: '2rem' }}>خارطة التحكم الموحدة</h3>
                            <p style={{ maxWidth: '600px', textAlign: 'center', opacity: 0.8, fontSize: '1.2rem', lineHeight: 1.6 }}>سيتم ربط بيانات الـ GeoJSON هنا لتمكينك من مراقبة النشاط المباشر على الخريطة الإدارية بدقة متناهية.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminDashboard;
