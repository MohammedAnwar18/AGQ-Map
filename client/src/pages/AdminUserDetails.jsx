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

        try {
            await adminService.deletePost(postId);
            setPosts(posts.filter(p => p.id !== postId));
            alert('Post deleted successfully');
        } catch (error) {
            console.error('Failed to delete post:', error);
            alert('Failed to delete post');
        }
    };

    const handleToggleStatus = async () => {

        try {
            await adminService.toggleUserStatus(userId, !user.is_active);
            setUser({ ...user, is_active: !user.is_active });
            alert(`User ${!user.is_active ? 'activated' : 'suspended'} successfully`);
        } catch (error) {
            console.error('Failed to update status:', error);
            alert('Failed to update user status');
        }
    };

    const handleDeleteUser = async () => {

        try {
            await adminService.deleteUser(userId);
            alert('User deleted successfully');
            navigate('/admin');
        } catch (error) {
            console.error('Failed to delete user:', error);
            alert('Failed to delete user');
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

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="spinner"></div>
            </div>
        );
    }

    if (!user) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <h2>User not found</h2>
            </div>
        );
    }

    // حساب مركز الخريطة من المنشورات
    const mapCenter = posts.length > 0
        ? [posts[0].location.latitude, posts[0].location.longitude]
        : [31.9, 35.2]; // Default center

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', padding: '2rem' }}>
            {/* Header */}
            <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <button
                    className="btn btn-secondary"
                    onClick={() => navigate('/admin')}
                >
                    ← Back to Dashboard
                </button>
                <h1 style={{ flex: 1 }}>User Details</h1>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
                {/* User Info Card */}
                <div className="admin-content-card">
                    <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                        <img
                            src={user.profile_picture || '/default-avatar.png'}
                            alt={user.username}
                            style={{
                                width: '120px',
                                height: '120px',
                                borderRadius: '50%',
                                objectFit: 'cover',
                                border: '4px solid var(--primary)',
                                marginBottom: '1rem'
                            }}
                        />
                        <h2 style={{ marginBottom: '0.5rem' }}>{user.full_name || user.username}</h2>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>@{user.username}</p>
                        <span className={`status-badge ${user.is_active ? 'active' : 'inactive'}`}>
                            <span className="status-dot"></span>
                            {user.is_active ? 'Active' : 'Suspended'}
                        </span>
                    </div>

                    <div style={{ marginBottom: '2rem' }}>
                        <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Information</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <div>
                                <strong style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Email</strong>
                                <p>{user.email}</p>
                            </div>
                            <div>
                                <strong style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Role</strong>
                                <p style={{ textTransform: 'capitalize' }}>{user.role || 'user'}</p>
                            </div>
                            <div>
                                <strong style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Joined</strong>
                                <p>{formatDate(user.created_at)}</p>
                            </div>
                            <div>
                                <strong style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Total Posts</strong>
                                <p>{posts.length}</p>
                            </div>
                            {user.bio && (
                                <div>
                                    <strong style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Bio</strong>
                                    <p>{user.bio}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <button
                            className="btn btn-secondary"
                            onClick={handleToggleStatus}
                            style={{ width: '100%' }}
                        >
                            {user.is_active ? '⏸️ Suspend User' : '▶️ Activate User'}
                        </button>
                        <button
                            className="btn"
                            onClick={handleDeleteUser}
                            style={{
                                width: '100%',
                                background: 'var(--error)',
                                color: 'white'
                            }}
                        >
                            🗑️ Delete User
                        </button>
                    </div>
                </div>

                {/* Map & Posts */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    {/* Map */}
                    <div className="admin-content-card">
                        <h3 style={{ marginBottom: '1rem' }}>📍 Posts on Map</h3>
                        <div style={{ height: '400px', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                            {posts.length > 0 ? (
                                <MapContainer
                                    center={mapCenter}
                                    zoom={12}
                                    style={{ height: '100%', width: '100%' }}
                                >
                                    <TileLayer
                                        url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
                                        attribution='&copy; CartoDB'
                                    />
                                    {posts.map(post => (
                                        <Marker
                                            key={post.id}
                                            position={[post.location.latitude, post.location.longitude]}
                                        >
                                            <Popup>
                                                <div style={{ minWidth: '200px' }}>
                                                    {post.image_url && (
                                                        <img
                                                            src={post.image_url}
                                                            alt="Post"
                                                            style={{ width: '100%', borderRadius: '8px', marginBottom: '8px' }}
                                                        />
                                                    )}
                                                    <p style={{ margin: '0 0 8px 0' }}>{post.content}</p>
                                                    <small style={{ color: '#666' }}>{formatDate(post.created_at)}</small>
                                                </div>
                                            </Popup>
                                        </Marker>
                                    ))}
                                </MapContainer>
                            ) : (
                                <div style={{
                                    height: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: 'var(--bg-primary)'
                                }}>
                                    <p style={{ color: 'var(--text-muted)' }}>No posts to display on map</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Posts List */}
                    <div className="admin-content-card">
                        <h3 style={{ marginBottom: '1rem' }}>📸 All Posts ({posts.length})</h3>
                        {posts.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {posts.map(post => (
                                    <div
                                        key={post.id}
                                        style={{
                                            padding: '1rem',
                                            background: 'var(--bg-primary)',
                                            borderRadius: 'var(--radius-lg)',
                                            border: '1px solid var(--bg-tertiary)'
                                        }}
                                    >
                                        <div style={{ display: 'flex', gap: '1rem' }}>
                                            {post.image_url && (
                                                <img
                                                    src={post.image_url}
                                                    alt="Post"
                                                    style={{
                                                        width: '100px',
                                                        height: '100px',
                                                        objectFit: 'cover',
                                                        borderRadius: 'var(--radius-md)'
                                                    }}
                                                />
                                            )}
                                            <div style={{ flex: 1 }}>
                                                <p style={{ marginBottom: '0.5rem' }}>{post.content || 'No content'}</p>
                                                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                                                    📍 {post.address || `${post.location.latitude.toFixed(4)}, ${post.location.longitude.toFixed(4)}`}
                                                </p>
                                                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                                    🕒 {formatDate(post.created_at)}
                                                </p>
                                            </div>
                                            <button
                                                className="action-btn delete"
                                                onClick={() => handleDeletePost(post.id)}
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                                <p>No posts yet</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminUserDetails;
