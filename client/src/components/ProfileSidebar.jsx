import React, { useState, useEffect } from 'react';
import { userService, getImageUrl } from '../services/api';
import './ProfileSidebar.css';

const ProfileSidebar = ({ isOpen, onClose, currentUser, onNavigate, followedShops = [], logout, socket }) => {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeSection, setActiveSection] = useState('menu'); // 'menu' or 'liked'
    const [isOnline, setIsOnline] = useState(true); // Always true for current user (they're using the app)
    const [onlineUsers, setOnlineUsers] = useState(new Set());

    useEffect(() => {
        if (isOpen && currentUser) {
            loadUserProfile();
            setActiveSection('menu'); // Reset to menu on open
        }
    }, [isOpen, currentUser]);

    // Listen to real-time online/offline events from socket
    useEffect(() => {
        if (!socket) return;

        const handleUserOnline = ({ userId }) => {
            setOnlineUsers(prev => new Set([...prev, String(userId)]));
        };
        const handleUserOffline = ({ userId }) => {
            setOnlineUsers(prev => {
                const next = new Set(prev);
                next.delete(String(userId));
                return next;
            });
        };

        socket.on('user_online', handleUserOnline);
        socket.on('user_offline', handleUserOffline);

        return () => {
            socket.off('user_online', handleUserOnline);
            socket.off('user_offline', handleUserOffline);
        };
    }, [socket]);

    const loadUserProfile = async () => {
        try {
            setLoading(true);
            const data = await userService.getUserProfile(currentUser.id);
            if (data && data.user) {
                setProfile(data.user);
            }
        } catch (error) {
            console.error("Failed to load sidebar user profile:", error);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    // Filter followed shops/municipalities
    const followedMunicipalities = followedShops.filter(shop => {
        const cat = (shop.category || '').toLowerCase().trim();
        return cat === 'بلدية' || cat === 'municipality';
    });

    const followedRegularShops = followedShops.filter(shop => {
        const cat = (shop.category || '').toLowerCase().trim();
        return cat !== 'بلدية' && cat !== 'municipality';
    });

    const displayName = profile?.full_name || currentUser?.full_name || currentUser?.username || 'مستخدم PalNovaa';
    const avatarSrc = profile?.profile_picture
        ? getImageUrl(profile.profile_picture)
        : currentUser?.profile_picture
        ? getImageUrl(currentUser.profile_picture)
        : null;

    return (
        <div className="sidebar-overlay" onClick={onClose}>
            <div className={`sidebar-container ${isOpen ? 'active' : ''}`} onClick={e => e.stopPropagation()}>

                {/* Close button inside sidebar */}
                <button className="sidebar-close-btn" onClick={onClose} title="إغلاق">✕</button>

                {/* Profile Header */}
                <div className="sidebar-profile-header">
                    <div className="sidebar-avatar-wrapper">
                        {avatarSrc ? (
                            <img src={avatarSrc} alt={displayName} className="sidebar-avatar" />
                        ) : (
                            <div className="sidebar-avatar-placeholder">
                                {displayName.charAt(0).toUpperCase()}
                            </div>
                        )}
                        {/* Real online indicator - current user is always online when app is open */}
                        <span className="online-indicator" title="متصل الآن"></span>
                    </div>

                    <div className="sidebar-user-details">
                        <h3 className="sidebar-user-name">{displayName}</h3>
                        <p className="sidebar-user-online-status">
                            <span className="status-dot"></span>
                            متصل الآن
                        </p>
                        <p className="sidebar-user-followers">
                            👥 {profile?.friends_count || 0} أصدقاء
                        </p>
                    </div>
                </div>

                {/* Horizontal divider */}
                <div className="sidebar-divider"></div>

                {/* Dynamic Content */}
                <div className="sidebar-content">
                    {activeSection === 'menu' ? (
                        <div className="sidebar-menu-list">

                            {/* Home */}
                            <button className="sidebar-menu-item active-item" onClick={() => { onNavigate('home'); onClose(); }}>
                                <div className="item-icon-box">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                                        <polyline points="9 22 9 12 15 12 15 22" />
                                    </svg>
                                </div>
                                <span className="item-label">الرئيسية</span>
                            </button>

                            {/* Search */}
                            <button className="sidebar-menu-item" onClick={() => { onNavigate('search'); onClose(); }}>
                                <div className="item-icon-box">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                        <circle cx="11" cy="11" r="8" />
                                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                    </svg>
                                </div>
                                <span className="item-label">البحث</span>
                            </button>

                            {/* Liked / Followed — Fixed bookmark icon */}
                            <button className="sidebar-menu-item" onClick={() => setActiveSection('liked')}>
                                <div className="item-icon-box">
                                    {/* Bell icon = Following/Subscriptions — visually clear */}
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                                        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                                    </svg>
                                </div>
                                <span className="item-label">المتابعات</span>
                                {followedShops.length > 0 && (
                                    <span className="badge-count">{followedShops.length}</span>
                                )}
                            </button>

                            {/* Profile */}
                            <button className="sidebar-menu-item" onClick={() => { onNavigate('profile'); onClose(); }}>
                                <div className="item-icon-box">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                        <circle cx="12" cy="7" r="4" />
                                    </svg>
                                </div>
                                <span className="item-label">الملف الشخصي</span>
                            </button>

                            {/* Settings */}
                            <button className="sidebar-menu-item" onClick={() => { onNavigate('settings'); onClose(); }}>
                                <div className="item-icon-box">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                        <circle cx="12" cy="12" r="3" />
                                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                                    </svg>
                                </div>
                                <span className="item-label">الإعدادات والخصوصية</span>
                            </button>
                        </div>
                    ) : (
                        /* Liked/Followed sub-section */
                        <div className="liked-items-view">
                            <div className="liked-header">
                                <button className="back-to-menu-btn" onClick={() => setActiveSection('menu')}>
                                    ← العودة للقائمة
                                </button>
                                <h4>المتابعات 🔔</h4>
                            </div>

                            <div className="liked-scroll-list">
                                {followedMunicipalities.length > 0 && (
                                    <div className="liked-category-block">
                                        <h5>البلديات المتابعة ({followedMunicipalities.length})</h5>
                                        {followedMunicipalities.map(shop => (
                                            <div key={shop.id} className="liked-item-row" onClick={() => { onNavigate('shop', shop); onClose(); }}>
                                                <span className="liked-item-emoji">🏛️</span>
                                                <span className="liked-item-name">{shop.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {followedRegularShops.length > 0 && (
                                    <div className="liked-category-block">
                                        <h5>المحلات والمؤسسات ({followedRegularShops.length})</h5>
                                        {followedRegularShops.map(shop => {
                                            const cat = (shop.category || '').toLowerCase().trim();
                                            const isUni = cat === 'university' || cat === 'جامعة';
                                            const isMedical = cat === 'medical' || cat === 'طبي';
                                            const emoji = isUni ? '🎓' : isMedical ? '🏥' : '🏪';
                                            return (
                                                <div key={shop.id} className="liked-item-row" onClick={() => { onNavigate('shop', shop); onClose(); }}>
                                                    <span className="liked-item-emoji">{emoji}</span>
                                                    <span className="liked-item-name">{shop.name}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {followedShops.length === 0 && (
                                    <div className="empty-liked-state">
                                        <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>🔔</div>
                                        <p>لا توجد متابعات بعد.</p>
                                        <p style={{ fontSize: '0.78rem', marginTop: '4px', color: '#475569' }}>تابع بلديات أو محلات لتظهر هنا</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="sidebar-footer">
                    {logout && (
                        <button className="sidebar-logout-btn" onClick={() => { logout(); onClose(); }}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="18" height="18">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                <polyline points="16 17 21 12 16 7" />
                                <line x1="21" y1="12" x2="9" y2="12" />
                            </svg>
                            <span>تسجيل الخروج</span>
                        </button>
                    )}
                    <span className="sidebar-version">النسخة 2.1.341 · PalNovaa</span>
                </div>

            </div>
        </div>
    );
};

export default ProfileSidebar;
