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

    // Bulk delete states
    const [selectedUsers, setSelectedUsers] = useState([]);
    const [selectedPosts, setSelectedPosts] = useState([]);

    // التحقق من صلاحيات الأدمن
    useEffect(() => {
        if (!user || user.role !== 'admin') {
            alert('Access Denied: Admin privileges required');
            navigate('/map');
        }
    }, [user, navigate]);

    // تحميل البيانات
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
                const usersData = await adminService.getAllUsers(searchQuery, currentPage, 20);
                setUsers(usersData.users);
                setPagination(usersData.pagination);
            } else if (activeTab === 'posts') {
                const postsData = await adminService.getAllPosts(currentPage, 50);
                setPosts(postsData.posts);
                setPagination(postsData.pagination);
            }
        } catch (error) {
            console.error('Failed to load data:', error);
        } finally {
            setLoading(false);
        }
    };

    // Bulk delete handlers
    const handleSelectAllUsers = (e) => {
        if (e.target.checked) {
            setSelectedUsers(users.map(u => u.id));
        } else {
            setSelectedUsers([]);
        }
    };

    const handleSelectUser = (userId) => {
        setSelectedUsers(prev =>
            prev.includes(userId)
                ? prev.filter(id => id !== userId)
                : [...prev, userId]
        );
    };

    const handleBulkDeleteUsers = async () => {
        if (selectedUsers.length === 0) {
            alert('Please select users to delete');
            return;
        }

        try {
            await Promise.all(selectedUsers.map(userId => adminService.deleteUser(userId)));
            alert(`${selectedUsers.length} user(s) deleted successfully`);
            loadData();
        } catch (error) {
            console.error('Failed to delete users:', error);
            alert('Failed to delete some users');
        }
    };

    const handleSelectAllPosts = (e) => {
        if (e.target.checked) {
            setSelectedPosts(posts.map(p => p.id));
        } else {
            setSelectedPosts([]);
        }
    };

    const handleSelectPost = (postId) => {
        setSelectedPosts(prev =>
            prev.includes(postId)
                ? prev.filter(id => id !== postId)
                : [...prev, postId]
        );
    };

    const handleBulkDeletePosts = async () => {
        if (selectedPosts.length === 0) {
            alert('Please select posts to delete');
            return;
        }

        try {
            await Promise.all(selectedPosts.map(postId => adminService.deletePost(postId)));
            alert(`${selectedPosts.length} post(s) deleted successfully`);
            loadData();
        } catch (error) {
            console.error('Failed to delete posts:', error);
            alert('Failed to delete some posts');
        }
    };

    const handleDeleteUser = async (userId) => {
        try {
            await adminService.deleteUser(userId);
            alert('User deleted successfully');
            loadData();
        } catch (error) {
            console.error('Failed to delete user:', error);
            alert('Failed to delete user');
        }
    };

    const handleToggleUserStatus = async (userId, currentStatus) => {
        const newStatus = !currentStatus;
        const action = newStatus ? 'activate' : 'suspend';

        try {
            await adminService.toggleUserStatus(userId, newStatus);
            alert(`User ${action}d successfully`);
            loadData();
        } catch (error) {
            console.error('Failed to update user status:', error);
            alert('Failed to update user status');
        }
    };

    const handleDeletePost = async (postId) => {
        try {
            await adminService.deletePost(postId);
            alert('Post deleted successfully');
            loadData();
        } catch (error) {
            console.error('Failed to delete post:', error);
            alert('Failed to delete post');
        }
    };

    const handleViewUser = (userId) => {
        navigate(`/admin/users/${userId}`);
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('ar-SA', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    if (!user || user.role !== 'admin') {
        return null;
    }

    return (
        <div className="admin-dashboard">
            {/* Sidebar / Bottom Nav (Mobile) */}
            <div className="admin-sidebar">
                <div className="admin-logo">
                    <h1>🗺️ PalNovaa</h1>
                    <p>إدارة الشبكة الاجتماعية</p>
                </div>

                <nav className="admin-nav">
                    <a
                        href="#"
                        className={`admin-nav-item ${activeTab === 'overview' ? 'active' : ''}`}
                        onClick={(e) => { e.preventDefault(); setActiveTab('overview'); setCurrentPage(1); }}
                    >
                        <span className="admin-nav-icon">📊</span>
                        <span>لوحة التحكم</span> {/* Overview */}
                    </a>
                    <a
                        href="#"
                        className={`admin-nav-item ${activeTab === 'users' ? 'active' : ''}`}
                        onClick={(e) => { e.preventDefault(); setActiveTab('users'); setCurrentPage(1); }}
                    >
                        <span className="admin-nav-icon">👥</span>
                        <span>المستخدمين</span> {/* Users */}
                    </a>
                    <a
                        href="#"
                        className={`admin-nav-item ${activeTab === 'posts' ? 'active' : ''}`}
                        onClick={(e) => { e.preventDefault(); setActiveTab('posts'); setCurrentPage(1); }}
                    >
                        <span className="admin-nav-icon">📸</span>
                        <span>المنشورات</span> {/* Posts */}
                    </a>
                    <a
                        href="#"
                        className={`admin-nav-item ${activeTab === 'map' ? 'active' : ''}`}
                        onClick={(e) => { e.preventDefault(); setActiveTab('map'); }}
                    >
                        <span className="admin-nav-icon">🗺️</span>
                        <span>عرض الخريطة</span> {/* Map View */}
                    </a>
                </nav>

                <div className="admin-logout">
                    <button onClick={() => { logout(); navigate('/login'); }}>
                        🚪 تسجيل الخروج
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="admin-main">
                {/* Header Section */}
                <div className="admin-header">
                    <div className="admin-header-text">
                        <h2>{activeTab === 'overview' ? 'لوحة التحكم الشاملة' : 
                            activeTab === 'users' ? 'إدارة المستخدمين' : 
                            activeTab === 'posts' ? 'إدارة المحتوى والمنشورات' : 'خريطة المنشورات'}</h2>
                        <p>أهلاً بك مجدداً يا {user.full_name || user.username} • {new Date().toLocaleDateString('ar-SA', { day: 'numeric', month: 'long' })}</p>
                    </div>
                </div>

                {/* Overview Tab Content */}
                {activeTab === 'overview' && (
                    <div className="admin-tab-content">
                        {loading ? (
                            <div className="loading-container">
                                <div className="spinner"></div>
                            </div>
                        ) : stats ? (
                            <>
                                <div className="stats-grid">
                                    <div className="stat-card" style={{ '--stat-color': '#fbab15' }}>
                                        <div className="stat-icon">👥</div>
                                        <div className="stat-value">
                                            {stats.totalUsers}
                                            <span className="stat-trend trend-up">↑ 12%</span>
                                        </div>
                                        <div className="stat-label">إجمالي المستخدمين</div>
                                    </div>

                                    <div className="stat-card" style={{ '--stat-color': '#10b981' }}>
                                        <div className="stat-icon">📸</div>
                                        <div className="stat-value">
                                            {stats.totalPosts}
                                            <span className="stat-trend trend-up">↑ 8%</span>
                                        </div>
                                        <div className="stat-label">إجمالي المنشورات</div>
                                    </div>

                                    <div className="stat-card" style={{ '--stat-color': '#3b82f6' }}>
                                        <div className="stat-icon">🟢</div>
                                        <div className="stat-value">
                                            {stats.activeUsers}
                                        </div>
                                        <div className="stat-label">المتصلين حالياً</div>
                                    </div>

                                    <div className="stat-card" style={{ '--stat-color': '#ef4444' }}>
                                        <div className="stat-icon">📅</div>
                                        <div className="stat-value">
                                            {stats.todayPosts}
                                        </div>
                                        <div className="stat-label">منشورات اليوم</div>
                                    </div>
                                </div>

                                {/* Quick Actions Section */}
                                <div className="admin-header" style={{ marginTop: '3rem', marginBottom: '1.5rem' }}>
                                    <div className="admin-header-text">
                                        <h3>إجراءات سريعة</h3>
                                        <p>الوصول السريع للمهام الإدارية الأكثر استخداماً</p>
                                    </div>
                                </div>
                                <div className="quick-actions-grid">
                                    <div className="quick-action-btn" onClick={() => setActiveTab('users')}>
                                        <span className="icon">👤</span>
                                        <span className="label">إضافة مستخدم</span>
                                    </div>
                                    <div className="quick-action-btn" onClick={() => setActiveTab('posts')}>
                                        <span className="icon">📝</span>
                                        <span className="label">مراجعة المنشورات</span>
                                    </div>
                                    <div className="quick-action-btn" onClick={() => setActiveTab('map')}>
                                        <span className="icon">📍</span>
                                        <span className="label">خارطة النشاط</span>
                                    </div>
                                    <div className="quick-action-btn">
                                        <span className="icon">⚙️</span>
                                        <span className="label">إعدادات النظام</span>
                                    </div>
                                </div>

                                {/* Network Activity Analysis */}
                                <div className="admin-content-card" style={{ marginTop: '3rem' }}>
                                    <div className="content-header">
                                        <h3>تحليل التفاعل ونمو الشبكة</h3>
                                    </div>
                                    <div className="activity-placeholder">
                                        <div className="placeholder-icon" style={{ fontSize: '3rem' }}>📊</div>
                                        <p style={{ maxWidth: '400px', margin: '0 auto' }}>قريباً: تحليل ذكي للبيانات والرسوم البيانية التفاعلية لتقديم إحصائيات دقيقة عن سلوك المستخدمين.</p>
                                    </div>
                                </div>
                            </>
                        ) : null}
                    </div>
                )}

                {/* Users Tab Content */}
                {activeTab === 'users' && (
                    <div className="admin-content-card">
                        <div className="content-header">
                            <div className="header-actions" style={{ display: 'flex', gap: '1.5rem', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3>قائمة المستخدمين</h3>
                                <div className="admin-search-group" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                    {selectedUsers.length > 0 && (
                                        <button className="action-btn delete" onClick={handleBulkDeleteUsers} style={{ width: 'auto', padding: '0 1.5rem', background: '#ef4444', color: 'white' }}>
                                            حذف المحدد ({selectedUsers.length})
                                        </button>
                                    )}
                                    <div className="admin-search">
                                        <span className="admin-search-icon">🔍</span>
                                        <input
                                            type="text"
                                            placeholder="البحث عن مستخدم (اسم، بريد...)"
                                            value={searchQuery}
                                            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="admin-table-wrapper">
                            {loading ? (
                                <div className="loading-container" style={{ padding: '3rem' }}><div className="spinner"></div></div>
                            ) : (
                                <table className="admin-table">
                                    <thead>
                                        <tr>
                                            <th>
                                                <input type="checkbox" checked={selectedUsers.length === users.length && users.length > 0} onChange={handleSelectAllUsers} />
                                            </th>
                                            <th>المستخدم</th>
                                            <th>البريد الإلكتروني</th>
                                            <th>تاريخ الانضمام</th>
                                            <th>المنشورات</th>
                                            <th>الحالة</th>
                                            <th>الإجراءات</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {users.map(user => (
                                            <tr key={user.id}>
                                                <td>
                                                    <input type="checkbox" checked={selectedUsers.includes(user.id)} onChange={() => handleSelectUser(user.id)} />
                                                </td>
                                                <td>
                                                    <div className="user-cell">
                                                        <img src={user.profile_picture || '/default-avatar.png'} alt={user.username} className="user-avatar" />
                                                        <div className="user-info">
                                                            <h4>{user.full_name || user.username}</h4>
                                                            <p>@{user.username}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>{user.email}</td>
                                                <td>{formatDate(user.created_at)}</td>
                                                <td>{user.posts_count}</td>
                                                <td>
                                                    <span className={`status-badge ${user.is_active ? 'active' : 'inactive'}`}>
                                                        {user.is_active ? 'نشط' : 'موقوف'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="action-buttons">
                                                        <button className="action-btn" title="عرض الملف" onClick={() => handleViewUser(user.id)}>👁️</button>
                                                        <button className="action-btn" title={user.is_active ? 'إيقاف' : 'تفعيل'} onClick={() => handleToggleUserStatus(user.id, user.is_active)}>
                                                            {user.is_active ? '🚫' : '✅'}
                                                        </button>
                                                        <button className="action-btn delete" title="حذف" onClick={() => handleDeleteUser(user.id)}>🗑️</button>
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
                                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>السابق</button>
                                {[...Array(pagination.totalPages)].map((_, i) => (
                                    <button key={i + 1} className={currentPage === i + 1 ? 'active' : ''} onClick={() => setCurrentPage(i + 1)}>{i + 1}</button>
                                ))}
                                <button onClick={() => setCurrentPage(p => Math.min(pagination.totalPages, p + 1))} disabled={currentPage === pagination.totalPages}>التالي</button>
                            </div>
                        )}
                    </div>
                )}

                {/* Posts Tab Content */}
                {activeTab === 'posts' && (
                    <div className="admin-content-card">
                        <div className="content-header">
                            <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3>إدارة المنشورات</h3>
                                {selectedPosts.length > 0 && (
                                    <button className="action-btn delete" onClick={handleBulkDeletePosts} style={{ width: 'auto', padding: '0 1.5rem', background: '#ef4444', color: 'white' }}>
                                        حذف المحدد ({selectedPosts.length})
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="admin-table-wrapper">
                            {loading ? (
                                <div className="loading-container" style={{ padding: '3rem' }}><div className="spinner"></div></div>
                            ) : (
                                <table className="admin-table">
                                    <thead>
                                        <tr>
                                            <th><input type="checkbox" checked={selectedPosts.length === posts.length && posts.length > 0} onChange={handleSelectAllPosts} /></th>
                                            <th>المنشور</th>
                                            <th>الناشر</th>
                                            <th>الموقع</th>
                                            <th>التاريخ</th>
                                            <th>الإجراءات</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {posts.map(post => (
                                            <tr key={post.id}>
                                                <td><input type="checkbox" checked={selectedPosts.includes(post.id)} onChange={() => handleSelectPost(post.id)} /></td>
                                                <td>
                                                    <div className="user-cell">
                                                        {post.image_url && <img src={post.image_url} alt="Post" className="user-avatar" style={{ borderRadius: '8px' }} />}
                                                        <div className="user-info">
                                                            <h4>{post.content?.substring(0, 40) || 'بدون نص'}...</h4>
                                                            <p>{post.address?.substring(0, 30) || 'بدون عنوان'}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className="user-info">
                                                        <h4>{post.user.full_name || post.user.username}</h4>
                                                        <p>@{post.user.username}</p>
                                                    </div>
                                                </td>
                                                <td style={{ fontSize: '0.8rem', opacity: 0.8 }}>
                                                    {post.location.latitude.toFixed(3)}, {post.location.longitude.toFixed(3)}
                                                </td>
                                                <td>{formatDate(post.created_at)}</td>
                                                <td>
                                                    <button className="action-btn delete" title="حذف" onClick={() => handleDeletePost(post.id)}>🗑️</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                )}

                {/* Map View Content */}
                {activeTab === 'map' && (
                    <div className="admin-content-card" style={{ height: '70vh', position: 'relative' }}>
                        <div style={{ 
                            position: 'absolute', 
                            inset: 0, 
                            display: 'flex', 
                            flexDirection: 'column', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            background: 'rgba(15, 23, 42, 0.8)',
                            backdropFilter: blur('10px'),
                            textAlign: 'center',
                            padding: '2rem'
                        }}>
                            <div style={{ fontSize: '5rem', marginBottom: '1.5rem' }}>🛰️</div>
                            <h3 style={{ fontSize: '2rem', marginBottom: '1rem' }}>الخارطة الإدارية التفاعلية</h3>
                            <p style={{ maxWidth: '600px', opacity: 0.7, lineHeight: 1.6 }}>
                                جاري العمل على دمج نظام التتبع الجغرافي المباشر لجميع منشورات الشبكة هنا. 
                                ستتمكن قريباً من مراقبة النشاطات جغرافياً في الوقت الفعلي.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminDashboard;
