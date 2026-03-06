import React, { useState, useEffect } from 'react';
import { friendService, shopService, getImageUrl } from '../services/api'; // Import shopService
import './Modal.css';

const FriendsModal = ({ onClose, initialTab = 'friends', isShopsMode = false, currentUser, onShopClick, onShopFollowed, followedShops: propFollowedShops }) => {
    const [activeTab, setActiveTab] = useState(isShopsMode ? 'shops' : initialTab);
    const [friends, setFriends] = useState([]);
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);

    // Shops State
    const [followedShops, setFollowedShops] = useState(propFollowedShops || []);
    const [shopSearchQuery, setShopSearchQuery] = useState('');
    const [shopSearchResults, setShopSearchResults] = useState([]);
    const [isSearchingShop, setIsSearchingShop] = useState(false);

    // Create Shop State
    const [isCreatingShop, setIsCreatingShop] = useState(false);
    const [newShopData, setNewShopData] = useState({ name: '', category: 'General', lat: '', lon: '' });
    const [isSubmittingShop, setIsSubmittingShop] = useState(false);

    useEffect(() => {
        loadData();
    }, [activeTab, isShopsMode]); // Re-run when tab changes

    // Removed propFollowedShops useEffect to prevent it from wiping internal loadData results

    const loadData = async () => {
        try {
            setLoading(true);

            // Only load what is necessary for the current view!
            if (isShopsMode || activeTab === 'shops') {
                const shopsData = await shopService.getFollowing();
                setFollowedShops(shopsData.shops || []);
            } else if (activeTab === 'friends') {
                const friendsData = await friendService.getFriends();
                setFriends(friendsData.friends);
            } else if (activeTab === 'requests') {
                const requestsData = await friendService.getPendingRequests();
                setRequests(requestsData.requests);
            }
        } catch (error) {
            console.error('Failed to load data:', error);
        } finally {
            setLoading(false);
        }
    };



    // --- Friends Functions ---
    const handleAcceptRequest = async (requestId) => {
        try {
            await friendService.acceptFriendRequest(requestId);
            setRequests(requests.filter(r => r.id !== requestId));
            await loadData(); // Reload to update friends list
        } catch (error) {
            console.error('Failed to accept request:', error);
        }
    };

    const handleRejectRequest = async (requestId) => {
        try {
            await friendService.rejectFriendRequest(requestId);
            setRequests(requests.filter(r => r.id !== requestId));
        } catch (error) {
            console.error('Failed to reject request:', error);
        }
    };

    const handleRemoveFriend = async (friendId) => {
        if (!confirm('هل أنت متأكد من إلغاء الصداقة؟')) return;

        try {
            await friendService.removeFriend(friendId);
            setFriends(friends.filter(f => f.id !== friendId));
        } catch (error) {
            console.error('Failed to remove friend:', error);
        }
    };

    const handleToggleLocation = async (friendId) => {
        try {
            const response = await friendService.toggleLocationSharing(friendId);
            setFriends(friends.map(f => {
                if (f.id === friendId) {
                    return { ...f, am_i_sharing: response.isSharing };
                }
                return f;
            }));
        } catch (error) {
            console.error('Failed to toggle location sharing:', error);
        }
    };

    // --- Shops Functions ---
    const handleShopSearch = async (e) => {
        e.preventDefault();
        if (!shopSearchQuery.trim()) return;

        setIsSearchingShop(true);
        try {
            const result = await shopService.search(shopSearchQuery);
            setShopSearchResults(result.shops || []);
        } catch (error) {
            console.error("Search failed", error);
        } finally {
            setIsSearchingShop(false);
        }
    };

    const handleFollowShop = async (shop) => {
        try {
            const response = await shopService.follow(shop.id);
            console.log("Follow response:", response);

            // Fetch the updated following list to ensure complete shop data (like lat/lon)
            const updatedFollowing = await shopService.getFollowing();
            setFollowedShops(updatedFollowing.shops || []);

            if (onShopFollowed) onShopFollowed();
            alert(`تم متابعة ${shop.name} بنجاح! سيظهر الآن على الخريطة.`);
        } catch (error) {
            console.error("Follow failed", error);
            alert("حدث خطأ أثناء محاولة متابعة المحل. يرجى التأكد من الاتصال بالإنترنت.");
        }
    };

    const handleUnfollowShop = async (shopId) => {
        if (!confirm("هل تريد إلغاء متابعة هذا المحل؟")) return;
        try {
            await shopService.unfollow(shopId);
            setFollowedShops(prev => prev.filter(s => s.id != shopId));
            if (onShopFollowed) onShopFollowed();
        } catch (error) {
            console.error("Unfollow failed", error);
            alert("حدث خطأ أثناء محاولة إلغاء المتابعة.");
        }
    };

    const handleCreateShop = async (e) => {
        e.preventDefault();
        if (!newShopData.name || !newShopData.lat || !newShopData.lon) {
            alert("يرجى تعبئة جميع الحقول المطلوبة (الاسم والموقع)");
            return;
        }

        setIsSubmittingShop(true);
        try {
            const createdShop = await shopService.create({
                name: newShopData.name,
                category: newShopData.category,
                latitude: parseFloat(newShopData.lat),
                longitude: parseFloat(newShopData.lon)
            });

            // Auto follow the new shop or just show success
            alert("تم إنشاء المحل بنجاح!");
            setIsCreatingShop(false);
            setNewShopData({ name: '', category: 'General', lat: '', lon: '' });
            // Refresh logic if needed or auto-follow
            await handleFollowShop(createdShop);
        } catch (error) {
            console.error("Create shop failed", error);
            const errorMsg = error.response?.data?.error || "حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.";
            alert(`فشل إنشاء المحل: ${errorMsg}`);
        } finally {
            setIsSubmittingShop(false);
        }
    };

    const getCurrentLocation = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((pos) => {
                setNewShopData(prev => ({
                    ...prev,
                    lat: pos.coords.latitude.toFixed(6),
                    lon: pos.coords.longitude.toFixed(6)
                }));
            }, () => alert("تعذر الحصول على الموقع"));
        } else {
            alert("المتصفح لا يدعم تحديد الموقع");
        }
    };

    const isFollowingShop = (shopId) => {
        return followedShops.some(s => s.id == shopId); // Loose equality to handle string/number mix
    };

    const formatTime = (timestamp) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = Math.floor((now - date) / 1000);

        if (diff < 60) return 'الآن';
        if (diff < 3600) return `منذ ${Math.floor(diff / 60)} دقيقة`;
        if (diff < 86400) return `منذ ${Math.floor(diff / 3600)} ساعة`;
        return `منذ ${Math.floor(diff / 86400)} يوم`;
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-container" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <h2>{isShopsMode ? 'المحلات' : 'الأصدقاء'}</h2>
                        {isShopsMode && !isCreatingShop && currentUser?.role === 'admin' && (
                            <button
                                className="btn-small btn-add-friend"
                                onClick={() => setIsCreatingShop(true)}
                                style={{ borderRadius: '50%', width: '30px', height: '30px', padding: 0, fontSize: '1.2rem' }}
                                title="إضافة محل جديد"
                            >
                                +
                            </button>
                        )}
                    </div>
                    <button className="btn-close" onClick={() => {
                        if (isCreatingShop) setIsCreatingShop(false);
                        else onClose();
                    }}>✕</button>
                </div>

                {!isShopsMode && (
                    <div className="modal-tabs">
                        <button
                            className={`tab ${activeTab === 'friends' ? 'active' : ''}`}
                            onClick={() => setActiveTab('friends')}
                            style={activeTab === 'friends' ? { color: '#fbab15', borderBottomColor: '#fbab15' } : {}}
                        >
                            الأصدقاء ({friends.length})
                        </button>
                        <button
                            className={`tab ${activeTab === 'requests' ? 'active' : ''}`}
                            onClick={() => setActiveTab('requests')}
                            style={activeTab === 'requests' ? { color: '#fbab15', borderBottomColor: '#fbab15' } : {}}
                        >
                            الطلبات ({requests.length})
                        </button>
                    </div>
                )}

                <div className="modal-body" style={{ padding: 0, overflowY: isCreatingShop ? 'visible' : 'auto' }}>
                    {loading ? (
                        <div style={{ padding: '2rem', textAlign: 'center' }}>
                            <div className="spinner"></div>
                        </div>
                    ) : activeTab === 'friends' ? (
                        // ... Friends List UI (Same as before) ...
                        friends.length === 0 ? (
                            <div className="empty-state">
                                <p>ليس لديك أصدقاء بعد</p>
                                <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
                                    استخدم البحث لإيجاد أصدقاء جدد
                                </p>
                            </div>
                        ) : (
                            <div className="user-list">
                                {friends.map(friend => (
                                    <div key={friend.id} className="user-item">
                                        <div className="chat-avatar">
                                            {friend.profile_picture ? (
                                                <img src={getImageUrl(friend.profile_picture)} alt={friend.username} />
                                            ) : (
                                                <div className="avatar-placeholder">
                                                    {friend.username.charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                            {friend.is_online && <div className="online-indicator" />}
                                        </div>
                                        <div className="chat-info">
                                            <div className="chat-name">
                                                {friend.full_name || friend.username}
                                            </div>
                                            <div className="chat-last-message">
                                                @{friend.username}
                                            </div>
                                        </div>
                                        <div className="user-item-actions">
                                            <button
                                                className={`btn-small ${friend.am_i_sharing ? 'btn-location-active' : 'btn-location'}`}
                                                onClick={() => handleToggleLocation(friend.id)}
                                                style={{ fontFamily: 'inherit' }}
                                            >
                                                {friend.am_i_sharing ? 'إيقاف الموقع' : 'مشاركة الموقع'}
                                            </button>
                                            <button
                                                className="btn-small btn-reject"
                                                onClick={() => handleRemoveFriend(friend.id)}
                                                style={{ fontFamily: 'inherit' }}
                                            >
                                                إلغاء الصداقة
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )
                    ) : activeTab === 'requests' ? (
                        // ... Requests List UI (Same as before) ...
                        requests.length === 0 ? (
                            <div className="empty-state">
                                <p>لا توجد طلبات صداقة</p>
                            </div>
                        ) : (
                            <div className="user-list">
                                {requests.map(request => (
                                    <div key={request.id} className="user-item">
                                        <div className="chat-avatar">
                                            {request.profile_picture ? (
                                                <img src={getImageUrl(request.profile_picture)} alt={request.username} />
                                            ) : (
                                                <div className="avatar-placeholder">
                                                    {request.username.charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                        </div>
                                        <div className="chat-info">
                                            <div className="chat-name">
                                                {request.full_name || request.username}
                                            </div>
                                            <div className="chat-last-message">
                                                {formatTime(request.created_at)}
                                            </div>
                                        </div>
                                        <div className="user-item-actions">
                                            <button
                                                className="btn-small btn-accept"
                                                onClick={() => handleAcceptRequest(request.id)}
                                            >
                                                قبول
                                            </button>
                                            <button
                                                className="btn-small btn-reject"
                                                onClick={() => handleRejectRequest(request.id)}
                                            >
                                                رفض
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )
                    ) : (
                        // --- SHOPS TAB ---
                        <div className="shops-container">
                            {isCreatingShop ? (
                                <div style={{ padding: '20px' }}>
                                    <h3 style={{ marginBottom: '15px' }}>تسجيل محل جديد</h3>
                                    <form onSubmit={handleCreateShop} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                        <div>
                                            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>اسم المحل</label>
                                            <input
                                                type="text"
                                                className="input"
                                                value={newShopData.name}
                                                onChange={e => setNewShopData({ ...newShopData, name: e.target.value })}
                                                placeholder="مثلاً: مطعم القدس"
                                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--bg-tertiary)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '1rem' }}
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>التصنيف</label>
                                            <select
                                                className="input"
                                                value={newShopData.category}
                                                onChange={e => setNewShopData({ ...newShopData, category: e.target.value })}
                                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--bg-tertiary)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                                            >
                                                <option value="General">عام</option>
                                                <option value="Restaurant">مطعم</option>
                                                <option value="Cafe">مقهى</option>
                                                <option value="Clothing">ملابس</option>
                                                <option value="Electronics">إلكترونيات</option>
                                                <option value="Supermarket">سوبرماركت</option>
                                                <option value="مكتب تاكسي">مكتب تاكسي 🚕</option>
                                                <option value="Service">خدمات</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>الموقع</label>
                                            <div style={{ display: 'flex', gap: '10px' }}>
                                                <input
                                                    type="number"
                                                    step="any"
                                                    placeholder="خط العرض"
                                                    value={newShopData.lat}
                                                    onChange={e => setNewShopData({ ...newShopData, lat: e.target.value })}
                                                    style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--bg-tertiary)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                                                />
                                                <input
                                                    type="number"
                                                    step="any"
                                                    placeholder="خط الطول"
                                                    value={newShopData.lon}
                                                    onChange={e => setNewShopData({ ...newShopData, lon: e.target.value })}
                                                    style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--bg-tertiary)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                className="btn-small is-primary"
                                                onClick={getCurrentLocation}
                                                style={{ marginTop: '10px', width: '100%', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
                                            >
                                                📍 استخدام موقعي الحالي
                                            </button>
                                        </div>

                                        <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                                            <button
                                                type="button"
                                                onClick={() => setIsCreatingShop(false)}
                                                className="btn-small"
                                                style={{ flex: 1, background: 'transparent', border: '1px solid var(--text-muted)' }}
                                            >
                                                إلغاء
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={isSubmittingShop}
                                                className="btn-small btn-accept"
                                                style={{ flex: 2 }}
                                            >
                                                {isSubmittingShop ? 'جاري الحفظ...' : 'إنشاء المحل'}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            ) : (
                                <>
                                    {/* Search Bar - Redesigned */}
                                    <form onSubmit={handleShopSearch} style={{
                                        padding: '15px',
                                        position: 'sticky',
                                        top: 0,
                                        background: 'var(--bg-secondary)',
                                        zIndex: 10,
                                        borderBottom: '1px solid var(--bg-tertiary)'
                                    }}>
                                        <div style={{
                                            position: 'relative',
                                            display: 'flex',
                                            alignItems: 'center',
                                            background: 'var(--bg-tertiary)',
                                            borderRadius: '12px',
                                            padding: '5px 15px',
                                            border: '1px solid transparent',
                                            transition: 'all 0.2s'
                                        }} className="search-focus-wrapper">
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
                                                <circle cx="11" cy="11" r="8"></circle>
                                                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                            </svg>
                                            <input
                                                type="text"
                                                placeholder="ابحث عن محل (مطعم، مقهى...)"
                                                value={shopSearchQuery}
                                                onChange={(e) => setShopSearchQuery(e.target.value)}
                                                style={{
                                                    flex: 1,
                                                    padding: '10px',
                                                    background: 'transparent',
                                                    border: 'none',
                                                    outline: 'none',
                                                    color: 'var(--text-primary)',
                                                    fontSize: '0.95rem',
                                                    fontFamily: 'inherit'
                                                }}
                                                autoFocus
                                            />
                                            {isSearchingShop && <div className="spinner-small" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }}></div>}
                                        </div>
                                    </form>

                                    {/* Search Results */}
                                    {shopSearchResults.length > 0 && (
                                        <div className="user-list" style={{ borderBottom: '1px solid var(--bg-tertiary)', marginBottom: '10px' }}>
                                            <h4 style={{ padding: '15px 15px 5px', margin: 0, fontSize: '0.9rem', color: 'var(--primary)', fontWeight: '700' }}>نتائج البحث</h4>
                                            {shopSearchResults.map(shop => (
                                                <div
                                                    key={shop.id}
                                                    className="user-item"
                                                    onClick={() => onShopClick && onShopClick(shop)}
                                                    style={{ cursor: 'pointer' }}
                                                >
                                                    <div className="chat-avatar" style={{ overflow: 'visible' }}>
                                                        <div style={{
                                                            width: '50px',
                                                            height: '50px',
                                                            borderRadius: '14px',
                                                            background: 'linear-gradient(135deg, #fbab15, #f59e0b)',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            color: 'white',
                                                            boxShadow: '0 4px 6px rgba(251, 171, 21, 0.2)'
                                                        }}>
                                                            {!shop.profile_picture ? (
                                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                    <path d="M3 21h18v-8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8z"></path>
                                                                    <path d="M6 6h12v7H6z"></path>
                                                                    <path d="M6 18h12"></path>
                                                                </svg>
                                                            ) : (
                                                                <img src={getImageUrl(shop.profile_picture)} style={{ width: '100%', height: '100%', borderRadius: '14px', objectFit: 'cover' }} />
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="chat-info">
                                                        <div className="chat-name" style={{ fontSize: '1rem' }}>{shop.name}</div>
                                                        <div className="chat-last-message" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#fbab15', display: 'inline-block' }}></span>
                                                            {shop.category}
                                                        </div>
                                                    </div>
                                                    <div className="user-item-actions">
                                                        {isFollowingShop(shop.id) && (
                                                            <span style={{ color: 'var(--success)', fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                                                متابع
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Followed List */}
                                    <div className="user-list">
                                        <h4 style={{
                                            padding: '15px 15px 5px',
                                            margin: 0,
                                            fontSize: '0.9rem',
                                            color: 'var(--text-secondary)',
                                            fontWeight: '700',
                                            borderTop: shopSearchResults.length > 0 ? 'none' : '1px solid transparent' // Conditional border logic if needed
                                        }}>المحلات التي أتابعها</h4>
                                        {followedShops.length === 0 ? (
                                            <div className="empty-state" style={{ padding: '40px 20px' }}>
                                                <div style={{
                                                    width: '60px', height: '60px', margin: '0 auto 15px',
                                                    background: 'var(--bg-tertiary)', borderRadius: '50%',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    color: 'var(--text-muted)'
                                                }}>
                                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18v-8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8z"></path><path d="M6 6h12v7H6z"></path></svg>
                                                </div>
                                                <p style={{ color: 'var(--text-secondary)' }}>لا تتابع أي محل حالياً</p>
                                            </div>
                                        ) : (
                                            followedShops.map(shop => (
                                                <div
                                                    key={shop.id}
                                                    className="user-item"
                                                    onClick={() => onShopClick && onShopClick(shop)}
                                                    style={{ cursor: 'pointer' }}
                                                >
                                                    <div className="chat-avatar" style={{ overflow: 'visible' }}>
                                                        <div style={{
                                                            width: '50px',
                                                            height: '50px',
                                                            borderRadius: '14px',
                                                            background: 'linear-gradient(135deg, #fbab15, #f59e0b)',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            color: 'white',
                                                            boxShadow: '0 4px 6px rgba(251, 171, 21, 0.2)'
                                                        }}>
                                                            {!shop.profile_picture ? (
                                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                    <path d="M3 21h18v-8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8z"></path>
                                                                    <path d="M6 6h12v7H6z"></path>
                                                                    <path d="M6 18h12"></path>
                                                                </svg>
                                                            ) : (
                                                                <img src={getImageUrl(shop.profile_picture)} style={{ width: '100%', height: '100%', borderRadius: '14px', objectFit: 'cover' }} />
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="chat-info">
                                                        <div className="chat-name" style={{ fontSize: '1rem' }}>{shop.name}</div>
                                                        <div className="chat-last-message" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#fbab15', display: 'inline-block' }}></span>
                                                            {shop.category}
                                                        </div>
                                                    </div>
                                                    <div className="user-item-actions">
                                                        <button
                                                            className="btn-small btn-reject"
                                                            onClick={(e) => { e.stopPropagation(); handleUnfollowShop(shop.id); }}
                                                            style={{ border: '1px solid var(--error)', color: 'var(--error)', fontFamily: 'inherit' }}
                                                        >
                                                            إلغاء المتابعة
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default FriendsModal;
