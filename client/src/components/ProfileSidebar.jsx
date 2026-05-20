import React, { useState, useEffect } from 'react';
import { userService, getImageUrl } from '../services/api';
import './ProfileSidebar.css';

const ProfileSidebar = ({ isOpen, onClose, currentUser, onNavigate, followedShops = [], logout }) => {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeSection, setActiveSection] = useState('menu'); // 'menu' or 'liked'

    useEffect(() => {
        if (isOpen && currentUser) {
            loadUserProfile();
        }
    }, [isOpen, currentUser]);

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

    return (
        <div className="sidebar-overlay" onClick={onClose}>
            <div className={`sidebar-container ${isOpen ? 'active' : ''}`} onClick={e => e.stopPropagation()}>
                
                {/* Close button inside sidebar */}
                <button className="sidebar-close-btn" onClick={onClose} title="إغلاق">
                    ✕
                </button>

                {/* Profile Header */}
                <div className="sidebar-profile-header">
                    <div className="sidebar-avatar-wrapper">
                        {profile?.profile_picture ? (
                            <img 
                                src={getImageUrl(profile.profile_picture)} 
                                alt={profile.full_name || profile.username} 
                                className="sidebar-avatar" 
                            />
                        ) : (
                            <div className="sidebar-avatar-placeholder">
                                {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : 'P'}
                            </div>
                        )}
                        <span className="online-indicator"></span>
                    </div>
                    
                    <div className="sidebar-user-details">
                        <h3 className="sidebar-user-name">
                            {profile?.full_name || currentUser?.full_name || currentUser?.username || 'مستخدم PalNovaa'}
                        </h3>
                        <p className="sidebar-user-followers">
                            👥 {profile?.friends_count || 0} أصدقاء
                        </p>
                    </div>
                </div>

                {/* Horizontal divider */}
                <div className="sidebar-divider"></div>

                {/* Dynamic Content: Main Menu or Liked Section */}
                <div className="sidebar-content">
                    {activeSection === 'menu' ? (
                        <div className="sidebar-menu-list">
                            <button className="sidebar-menu-item active-item" onClick={() => { onNavigate('home'); onClose(); }}>
                                <div className="item-icon-box">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                                        <polyline points="9 22 9 12 15 12 15 22" />
                                    </svg>
                                </div>
                                <span className="item-label">الرئيسية</span>
                            </button>

                            <button className="sidebar-menu-item" onClick={() => { onNavigate('search'); onClose(); }}>
                                <div className="item-icon-box">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                        <circle cx="11" cy="11" r="8" />
                                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                    </svg>
                                </div>
                                <span className="item-label">البحث</span>
                            </button>

                            <button className="sidebar-menu-item" onClick={() => setActiveSection('liked')}>
                                <div className="item-icon-box">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l8.77-8.77 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                                    </svg>
                                </div>
                                <span className="item-label">المعجب بها والمتابعة</span>
                                <span className="badge-count">{followedShops.length}</span>
                            </button>

                            <button className="sidebar-menu-item" onClick={() => { onNavigate('profile'); onClose(); }}>
                                <div className="item-icon-box">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                        <circle cx="12" cy="7" r="4" />
                                    </svg>
                                </div>
                                <span className="item-label">الملف الشخصي</span>
                            </button>

                            <button className="sidebar-menu-item" onClick={() => { onNavigate('settings'); onClose(); }}>
                                <div className="item-icon-box">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                        <circle cx="12" cy="12" r="3" />
                                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                                    </svg>
                                </div>
                                <span className="item-label">الإعدادات</span>
                            </button>
                        </div>
                    ) : (
                        <div className="liked-items-view">
                            <div className="liked-header">
                                <button className="back-to-menu-btn" onClick={() => setActiveSection('menu')}>
                                    ← العودة للقائمة
                                </button>
                                <h4>المتابعات والمعجب بها 🔔</h4>
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
                                            const isUni = (shop.category || '').toLowerCase().trim() === 'university';
                                            return (
                                                <div key={shop.id} className="liked-item-row" onClick={() => { onNavigate('shop', shop); onClose(); }}>
                                                    <span className="liked-item-emoji">{isUni ? '🎓' : '🏪'}</span>
                                                    <span className="liked-item-name">{shop.name}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {followedShops.length === 0 && (
                                    <div className="empty-liked-state">
                                        <p>لا توجد بلديات أو محلات متابعة حالياً.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Section with Version and Logout */}
                <div className="sidebar-footer">
                    {logout && (
                        <button className="sidebar-logout-btn" onClick={() => { logout(); onClose(); }}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="18" height="18" style={{ transform: 'rotate(180deg)' }}>
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                <polyline points="16 17 21 12 16 7" />
                                <line x1="21" y1="12" x2="9" y2="12" />
                            </svg>
                            <span>تسجيل الخروج</span>
                        </button>
                    )}
                    <span className="sidebar-version">النسخة 2.1.340</span>
                </div>

            </div>
        </div>
    );
};

export default ProfileSidebar;
