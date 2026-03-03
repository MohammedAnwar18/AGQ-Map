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
            {/* Sidebar */}
            <div className="admin-sidebar">
                <div className="admin-logo">
                    <h1>🗺️ PalNova</h1>
                    <p>Admin Dashboard</p>
                </div>

                <nav className="admin-nav">
                    <a
                        href="#"
                        className={`admin-nav-item ${activeTab === 'overview' ? 'active' : ''}`}
                        onClick={(e) => { e.preventDefault(); setActiveTab('overview'); setCurrentPage(1); }}
                    >
                        <span className="admin-nav-icon">📊</span>
                        <span>Overview</span>
                    </a>
                    <a
                        href="#"
                        className={`admin-nav-item ${activeTab === 'users' ? 'active' : ''}`}
                        onClick={(e) => { e.preventDefault(); setActiveTab('users'); setCurrentPage(1); }}
                    >
                        <span className="admin-nav-icon">👥</span>
                        <span>Users</span>
                    </a>
                    <a
                        href="#"
                        className={`admin-nav-item ${activeTab === 'posts' ? 'active' : ''}`}
                        onClick={(e) => { e.preventDefault(); setActiveTab('posts'); setCurrentPage(1); }}
                    >
                        <span className="admin-nav-icon">📸</span>
                        <span>Posts</span>
                    </a>
                    <a
                        href="#"
                        className={`admin-nav-item ${activeTab === 'map' ? 'active' : ''}`}
                        onClick={(e) => { e.preventDefault(); setActiveTab('map'); }}
                    >
                        <span className="admin-nav-icon">🗺️</span>
                        <span>Map View</span>
                    </a>

                </nav>

                <div className="admin-logout">
                    <button onClick={() => { logout(); navigate('/login'); }}>
                        🚪 Logout
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="admin-main">
                {/* Overview Tab */}
                {activeTab === 'overview' && (
                    <>
                        <div className="admin-header">
                            <h2>Dashboard Overview</h2>
                            <p>Welcome back, {user.full_name || user.username}</p>
                        </div>

                        {loading ? (
                            <div style={{ textAlign: 'center', padding: '3rem' }}>
                                <div className="spinner"></div>
                            </div>
                        ) : stats ? (
                            <div className="stats-grid">
                                <div className="stat-card">
                                    <div className="stat-header">
                                        <div className="stat-icon primary">👥</div>
                                    </div>
                                    <div className="stat-value">{stats.totalUsers}</div>
                                    <div className="stat-label">Total Users</div>
                                </div>

                                <div className="stat-card">
                                    <div className="stat-header">
                                        <div className="stat-icon success">📸</div>
                                    </div>
                                    <div className="stat-value">{stats.totalPosts}</div>
                                    <div className="stat-label">Total Posts</div>
                                </div>

                                <div className="stat-card">
                                    <div className="stat-header">
                                        <div className="stat-icon info">🟢</div>
                                    </div>
                                    <div className="stat-value">{stats.activeUsers}</div>
                                    <div className="stat-label">Active Users (24h)</div>
                                </div>

                                <div className="stat-card">
                                    <div className="stat-header">
                                        <div className="stat-icon warning">📅</div>
                                    </div>
                                    <div className="stat-value">{stats.todayPosts}</div>
                                    <div className="stat-label">Posts Today</div>
                                </div>
                            </div>
                        ) : null}
                    </>
                )}

                {/* Users Tab */}
                {activeTab === 'users' && (
                    <>
                        <div className="admin-header">
                            <h2>User Management</h2>
                            <p>Manage all registered users</p>
                        </div>

                        <div className="admin-content-card">
                            <div className="content-header">
                                <h3>All Users</h3>
                                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                    {selectedUsers.length > 0 && (
                                        <button
                                            className="btn"
                                            onClick={handleBulkDeleteUsers}
                                            style={{
                                                background: 'var(--error)',
                                                color: 'white',
                                                padding: '0.75rem 1.5rem'
                                            }}
                                        >
                                            🗑️ Delete Selected ({selectedUsers.length})
                                        </button>
                                    )}
                                    <div className="admin-search">
                                        <span className="admin-search-icon">🔍</span>
                                        <input
                                            type="text"
                                            placeholder="Search users..."
                                            value={searchQuery}
                                            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {loading ? (
                                <div style={{ textAlign: 'center', padding: '2rem' }}>
                                    <div className="spinner"></div>
                                </div>
                            ) : (
                                <>
                                    <table className="admin-table">
                                        <thead>
                                            <tr>
                                                <th style={{ width: '50px' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedUsers.length === users.length && users.length > 0}
                                                        onChange={handleSelectAllUsers}
                                                        style={{ cursor: 'pointer' }}
                                                    />
                                                </th>
                                                <th>User</th>
                                                <th>Email</th>
                                                <th>Joined</th>
                                                <th>Posts</th>
                                                <th>Status</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {users.map(user => (
                                                <tr key={user.id}>
                                                    <td>
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedUsers.includes(user.id)}
                                                            onChange={() => handleSelectUser(user.id)}
                                                            style={{ cursor: 'pointer' }}
                                                        />
                                                    </td>
                                                    <td>
                                                        <div className="user-cell">
                                                            <img
                                                                src={user.profile_picture || '/default-avatar.png'}
                                                                alt={user.username}
                                                                className="user-avatar"
                                                            />
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
                                                            <span className="status-dot"></span>
                                                            {user.is_active ? 'Active' : 'Suspended'}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <div className="action-buttons">
                                                            <button
                                                                className="action-btn view"
                                                                onClick={() => handleViewUser(user.id)}
                                                            >
                                                                View
                                                            </button>
                                                            <button
                                                                className="action-btn suspend"
                                                                onClick={() => handleToggleUserStatus(user.id, user.is_active)}
                                                            >
                                                                {user.is_active ? 'Suspend' : 'Activate'}
                                                            </button>
                                                            <button
                                                                className="action-btn delete"
                                                                onClick={() => handleDeleteUser(user.id)}
                                                            >
                                                                Delete
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>

                                    {pagination && pagination.totalPages > 1 && (
                                        <div className="pagination">
                                            <button
                                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                                disabled={currentPage === 1}
                                            >
                                                Previous
                                            </button>
                                            {[...Array(pagination.totalPages)].map((_, i) => (
                                                <button
                                                    key={i + 1}
                                                    className={currentPage === i + 1 ? 'active' : ''}
                                                    onClick={() => setCurrentPage(i + 1)}
                                                >
                                                    {i + 1}
                                                </button>
                                            ))}
                                            <button
                                                onClick={() => setCurrentPage(p => Math.min(pagination.totalPages, p + 1))}
                                                disabled={currentPage === pagination.totalPages}
                                            >
                                                Next
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </>
                )}

                {/* Posts Tab */}
                {activeTab === 'posts' && (
                    <>
                        <div className="admin-header">
                            <h2>Post Management</h2>
                            <p>Manage all posts on the platform</p>
                        </div>

                        <div className="admin-content-card">
                            <div className="content-header">
                                <h3>All Posts</h3>
                                {selectedPosts.length > 0 && (
                                    <button
                                        className="btn"
                                        onClick={handleBulkDeletePosts}
                                        style={{
                                            background: 'var(--error)',
                                            color: 'white',
                                            padding: '0.75rem 1.5rem'
                                        }}
                                    >
                                        🗑️ Delete Selected ({selectedPosts.length})
                                    </button>
                                )}
                            </div>

                            {loading ? (
                                <div style={{ textAlign: 'center', padding: '2rem' }}>
                                    <div className="spinner"></div>
                                </div>
                            ) : (
                                <>
                                    <table className="admin-table">
                                        <thead>
                                            <tr>
                                                <th style={{ width: '50px' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedPosts.length === posts.length && posts.length > 0}
                                                        onChange={handleSelectAllPosts}
                                                        style={{ cursor: 'pointer' }}
                                                    />
                                                </th>
                                                <th>Post</th>
                                                <th>Author</th>
                                                <th>Location</th>
                                                <th>Date</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {posts.map(post => (
                                                <tr key={post.id}>
                                                    <td>
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedPosts.includes(post.id)}
                                                            onChange={() => handleSelectPost(post.id)}
                                                            style={{ cursor: 'pointer' }}
                                                        />
                                                    </td>
                                                    <td>
                                                        <div className="user-cell">
                                                            {post.image_url && (
                                                                <img
                                                                    src={post.image_url}
                                                                    alt="Post"
                                                                    className="user-avatar"
                                                                    style={{ borderRadius: '8px' }}
                                                                />
                                                            )}
                                                            <div className="user-info">
                                                                <h4>{post.content?.substring(0, 50) || 'No content'}</h4>
                                                                <p>{post.address || 'No address'}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className="user-info">
                                                            <h4>{post.user.full_name || post.user.username}</h4>
                                                            <p>@{post.user.username}</p>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        {post.location.latitude.toFixed(4)}, {post.location.longitude.toFixed(4)}
                                                    </td>
                                                    <td>{formatDate(post.created_at)}</td>
                                                    <td>
                                                        <div className="action-buttons">
                                                            <button
                                                                className="action-btn delete"
                                                                onClick={() => handleDeletePost(post.id)}
                                                            >
                                                                Delete
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>

                                    {pagination && pagination.totalPages > 1 && (
                                        <div className="pagination">
                                            <button
                                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                                disabled={currentPage === 1}
                                            >
                                                Previous
                                            </button>
                                            {[...Array(Math.min(5, pagination.totalPages))].map((_, i) => {
                                                const pageNum = i + 1;
                                                return (
                                                    <button
                                                        key={pageNum}
                                                        className={currentPage === pageNum ? 'active' : ''}
                                                        onClick={() => setCurrentPage(pageNum)}
                                                    >
                                                        {pageNum}
                                                    </button>
                                                );
                                            })}
                                            <button
                                                onClick={() => setCurrentPage(p => Math.min(pagination.totalPages, p + 1))}
                                                disabled={currentPage === pagination.totalPages}
                                            >
                                                Next
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </>
                )}

                {/* Map Tab */}
                {activeTab === 'map' && (
                    <>
                        <div className="admin-header">
                            <h2>Map View</h2>
                            <p>View all posts on the map</p>
                        </div>

                        <div className="admin-content-card">
                            <div style={{ textAlign: 'center', padding: '3rem' }}>
                                <h3>🗺️ Map View Coming Soon</h3>
                                <p style={{ color: 'var(--text-muted)', marginTop: '1rem' }}>
                                    Interactive map with all posts will be available here
                                </p>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default AdminDashboard;
