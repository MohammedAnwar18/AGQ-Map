import React, { useState, useEffect } from 'react';
import { friendService, shopService, getImageUrl } from '../services/api';
import ProfileModal from './ProfileModal';
import './Modal.css';

// Helper: رندر أيقونة المحل بناءً على الفئة أو الصورة الحقيقية
const categoryEmoji = (category) => {
    const map = {
        'مركز تسوق': '🏢', 'Restaurant': '🍽️', 'Cafe': '☕', 'بنك': '🏦',
        'University': '🎓', 'Clothing': '👕', 'Electronics': '📱',
        'Supermarket': '🛒', 'مكتب تاكسي': '🚕', 'مجمع تجاري': '🏘️', 'Service': '⚙️',
        'بلدية': '🏩', 'Municipality': '🏩'
    };
    return map[category] || '🏪';
};

const ShopAvatar = ({ shop }) => {
    const pic = shop?.profile_picture;
    if (pic) {
        return (
            <img
                src={getImageUrl(pic)}
                alt={shop.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '12px' }}
                onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
            />
        );
    }
    return (
        <span style={{ fontSize: '1.4rem' }}>{categoryEmoji(shop?.category)}</span>
    );
};

const FriendsModal = ({ onClose, initialTab = 'friends', isShopsMode = false, currentUser, onShopClick, onShopFollowed, followedShops: propFollowedShops }) => {
    const [activeTab, setActiveTab] = useState(isShopsMode ? 'shops' : initialTab);
    const [friends, setFriends] = useState([]);
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedFriendId, setSelectedFriendId] = useState(null);

    // Shops State
    const [followedShops, setFollowedShops] = useState(propFollowedShops || []);
    const [shopSearchQuery, setShopSearchQuery] = useState('');
    const [shopSearchResults, setShopSearchResults] = useState([]);
    const [isSearchingShop, setIsSearchingShop] = useState(false);

    // Create Shop State
    const [isCreatingShop, setIsCreatingShop] = useState(false);
    const [newShopData, setNewShopData] = useState({ name: '', category: 'General', lat: '', lon: '' });
    const [isSubmittingShop, setIsSubmittingShop] = useState(false);

    // Create University State
    const [showCreateOptions, setShowCreateOptions] = useState(false);
    const [isCreatingUniversity, setIsCreatingUniversity] = useState(false);
    const [newUniversityData, setNewUniversityData] = useState({ name: '', lat: '', lon: '' });

    useEffect(() => {
        loadData();
    }, [activeTab, isShopsMode]); // Re-run when tab changes

    useEffect(() => {
        if (propFollowedShops !== undefined) {
            setFollowedShops(propFollowedShops);
        }
    }, [propFollowedShops]);

    const loadData = async () => {
        try {
            setLoading(true);

            // Only load what is necessary for the current view!
            if (isShopsMode || activeTab === 'shops') {
                const shopsData = await shopService.getFollowing();
                setFollowedShops(shopsData.shops || []);
            } else if (activeTab === 'friends') {
                const [friendsData, shopsData] = await Promise.all([
                    friendService.getFriends(),
                    shopService.getFollowing()
                ]);
                setFriends(friendsData.friends);
                setFollowedShops(shopsData.shops || []);
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
            // Optimistic UI Update for instant feedback
            setRequests(prev => prev.filter(r => r.id !== requestId));
            
            await friendService.acceptFriendRequest(requestId);
            
            // Reload silently to fetch new friends list
            friendService.getFriends().then(data => {
                setFriends(data.friends || []);
            });
        } catch (error) {
            console.error('Failed to accept request:', error);
            loadData(); // Revert if failed
        }
    };

    const handleRejectRequest = async (requestId) => {
        try {
            // Optimistic UI Update
            setRequests(prev => prev.filter(r => r.id !== requestId));
            await friendService.rejectFriendRequest(requestId);
        } catch (error) {
            console.error('Failed to reject request:', error);
            loadData(); // Revert if failed
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

            alert("تم إنشاء المحل بنجاح!");
            setIsCreatingShop(false);
            setNewShopData({ name: '', category: 'General', lat: '', lon: '' });
            await handleFollowShop(createdShop);
        } catch (error) {
            console.error("Create shop failed", error);
            const errorMsg = error.response?.data?.error || "حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.";
            alert(`فشل إنشاء المحل: ${errorMsg}`);
        } finally {
            setIsSubmittingShop(false);
        }
    };

    const handleCreateUniversity = async (e) => {
        e.preventDefault();
        if (!newUniversityData.name || !newUniversityData.lat || !newUniversityData.lon) {
            alert("يرجى تعبئة جميع الحقول المطلوبة (الاسم والموقع)");
            return;
        }

        setIsSubmittingShop(true);
        try {
            const createdShop = await shopService.create({
                name: newUniversityData.name,
                category: 'University', // Designates it as a university
                latitude: parseFloat(newUniversityData.lat),
                longitude: parseFloat(newUniversityData.lon)
            });

            alert("تم إنشاء الجامعة بنجاح!");
            setIsCreatingUniversity(false);
            setNewUniversityData({ name: '', lat: '', lon: '' });
            await handleFollowShop(createdShop);
        } catch (error) {
            console.error("Create university failed", error);
            alert("فشل إنشاء الجامعة.");
        } finally {
            setIsSubmittingShop(false);
        }
    };

    const getCurrentLocation = (isUni = false) => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((pos) => {
                if (isUni) {
                    setNewUniversityData(prev => ({
                        ...prev,
                        lat: pos.coords.latitude.toFixed(6),
                        lon: pos.coords.longitude.toFixed(6)
                    }));
                } else {
                    setNewShopData(prev => ({
                        ...prev,
                        lat: pos.coords.latitude.toFixed(6),
                        lon: pos.coords.longitude.toFixed(6)
                    }));
                }
            }, () => alert("تعذر الحصول على الموقع"));
        } else {
            alert("المتصفح لا يدعم تحديد الموقع");
        }
    };

    const isFollowingShop = (shopId) => {
        return followedShops.some(s => s.id == shopId);
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
        <>
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-container" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <h2>{isShopsMode ? 'المحلات والمؤسسات' : 'الأصدقاء'}</h2>
                        {isShopsMode && !isCreatingShop && !showCreateOptions && !isCreatingUniversity && currentUser?.role === 'admin' && (
                            <button
                                className="btn-small btn-add-friend"
                                onClick={() => setShowCreateOptions(true)}
                                style={{ borderRadius: '50%', width: '30px', height: '30px', padding: 0, fontSize: '1.2rem', background: '#10b981', color: 'white', border: 'none' }}
                                title="إضافة مكان جديد"
                            >
                                +
                            </button>
                        )}
                    </div>
                    <button className="btn-close" onClick={() => {
                        if (isCreatingShop || isCreatingUniversity || showCreateOptions) {
                            setIsCreatingShop(false);
                            setIsCreatingUniversity(false);
                            setShowCreateOptions(false);
                        } else {
                            onClose();
                        }
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
                        <button
                            className={`tab ${activeTab === 'shops' ? 'active' : ''}`}
                            onClick={() => setActiveTab('shops')}
                            style={activeTab === 'shops' ? { color: '#fbab15', borderBottomColor: '#fbab15' } : {}}
                        >
                            المحلات التي أتابعها ({followedShops.length})
                        </button>
                    </div>
                )}

                <div className="modal-content">
                    {loading ? (
                        <div className="loading-state">
                            <div className="spinner"></div>
                            <p>جاري التحميل...</p>
                        </div>
                    ) : (
                        <div className="friends-container">
                            {activeTab === 'friends' && (
                                <>
                                    {friends.length === 0 ? (
                                        <div className="empty-state">
                                            <p>ليس لديك أصدقاء حالياً</p>
                                        </div>
                                    ) : (
                                        <div className="user-list">
                                            {friends.map(friend => (
                                                <div key={friend.id} className="user-item" style={{ cursor: 'pointer', padding: '12px 15px' }}
                                                    onClick={() => setSelectedFriendId(friend.id)}
                                                >
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
                                                    <div className="chat-info" style={{ flex: 1, minWidth: 0 }}>
                                                        <div className="chat-name" style={{ fontWeight: '700', fontSize: '0.95rem' }}>
                                                            {friend.full_name || friend.username}
                                                        </div>
                                                        <div className="chat-last-message" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                                            @{friend.username}
                                                        </div>
                                                        
                                                        {/* Action Buttons Below Name */}
                                                        <div 
                                                            style={{ display: 'flex', gap: '8px', marginTop: '10px' }}
                                                            onClick={e => e.stopPropagation()}
                                                        >
                                                            <button
                                                                className={`btn-small ${friend.am_i_sharing ? 'btn-location-active' : 'btn-location'}`}
                                                                onClick={() => handleToggleLocation(friend.id)}
                                                                style={{ 
                                                                    fontFamily: 'inherit', 
                                                                    padding: '4px 10px', 
                                                                    fontSize: '0.75rem', 
                                                                    borderRadius: '8px',
                                                                    height: '28px',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '4px'
                                                                }}
                                                            >
                                                                {friend.am_i_sharing ? 'إيقاف 📍' : 'مشاركة 📍'}
                                                            </button>
                                                            <button
                                                                className="btn-small btn-reject"
                                                                onClick={() => handleRemoveFriend(friend.id)}
                                                                style={{ 
                                                                    fontFamily: 'inherit', 
                                                                    padding: '4px 10px', 
                                                                    fontSize: '0.75rem', 
                                                                    borderRadius: '8px',
                                                                    height: '28px',
                                                                    background: 'rgba(239, 68, 68, 0.1)',
                                                                    color: '#ef4444',
                                                                    border: 'none'
                                                                }}
                                                            >
                                                                إلغاء الصداقة
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Quick access to followed shops in friends tab */}
                                    {followedShops.length > 0 && (
                                        <div className="user-list" style={{ marginTop: '20px', borderTop: '1px solid var(--bg-tertiary)' }}>
                                            <h3 style={{ padding: '15px 15px 5px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>محلات ومؤسسات أتابعها</h3>
                                            {followedShops.slice(0, 3).map(shop => (
                                                <div key={shop.id} className="user-item" onClick={() => onShopClick && onShopClick(shop)} style={{ cursor: 'pointer' }}>
                                                    <div className="chat-avatar" style={{ borderRadius: '8px', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21h18v-8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8z" /><path d="M6 6h12v7H6z" /></svg>
                                                    </div>
                                                    <div className="chat-info">
                                                        <div className="chat-name">{shop.name}</div>
                                                        <div className="chat-last-message">{shop.category}</div>
                                                    </div>
                                                </div>
                                            ))}
                                            {followedShops.length > 3 && (
                                                <button 
                                                    className="btn-small" 
                                                    onClick={() => setActiveTab('shops')}
                                                    style={{ width: 'calc(100% - 30px)', margin: '10px 15px', background: 'transparent', border: '1px solid var(--bg-tertiary)' }}
                                                >
                                                    عرض الكل ({followedShops.length})
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}

                            {activeTab === 'requests' && (
                                <div className="user-list">
                                    {requests.length === 0 ? (
                                        <div className="empty-state">
                                            <p>لا يوجد طلبات صداقة معلقة</p>
                                        </div>
                                    ) : (
                                        requests.map(request => (
                                            <div key={request.id} className="user-item">
                                                <div className="chat-avatar">
                                                    {request.profile_picture ? (
                                                        <img src={getImageUrl(request.profile_picture)} alt={request.username} />
                                                    ) : (
                                                        <div className="avatar-placeholder">
                                                            {(request.username || 'U').charAt(0).toUpperCase()}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="chat-info">
                                                    <div className="chat-name">
                                                        {request.full_name || request.username}
                                                    </div>
                                                    <div className="chat-last-message">
                                                        أرسل لك طلب صداقة • {formatTime(request.created_at)}
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
                                        ))
                                    )}
                                </div>
                            )}

                            {(activeTab === 'shops' || isShopsMode) && (
                                <div className="shops-container">
                                    {showCreateOptions ? (
                                        <div style={{ padding: '30px 20px', textAlign: 'center' }}>
                                            <h3 style={{ marginBottom: '20px' }}>ماذا تريد أن تنشئ؟</h3>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                                <button 
                                                    className="btn-accept" 
                                                    style={{ padding: '15px', borderRadius: '12px', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
                                                    onClick={() => { setShowCreateOptions(false); setIsCreatingShop(true); }}
                                                >
                                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21h18v-8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8z"></path><path d="M6 6h12v7H6z"></path></svg>
                                                    إنشاء محل أو مجمع تجاري
                                                </button>
                                                <button 
                                                    className="btn-accept" 
                                                    style={{ padding: '15px', borderRadius: '12px', fontSize: '1rem', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
                                                    onClick={() => { setShowCreateOptions(false); setIsCreatingUniversity(true); }}
                                                >
                                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"></path><path d="M6 12v5c3 3 9 3 12 0v-5"></path></svg>
                                                    إنشاء جامعة أو مؤسسة تعليمية
                                                </button>
                                                <button 
                                                    className="btn-small" 
                                                    style={{ marginTop: '10px', background: 'transparent', color: 'var(--text-secondary)' }}
                                                    onClick={() => setShowCreateOptions(false)}
                                                >
                                                    إلغاء
                                                </button>
                                            </div>
                                        </div>
                                    ) : isCreatingUniversity ? (
                                        <div style={{ padding: '20px' }}>
                                            <h3 style={{ marginBottom: '15px' }}>إضافة جامعة / مؤسسة تعليمية</h3>
                                            <form onSubmit={handleCreateUniversity} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                                <div>
                                                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>اسم الجامعة / المؤسسة</label>
                                                    <input
                                                        type="text"
                                                        value={newUniversityData.name}
                                                        onChange={e => setNewUniversityData({ ...newUniversityData, name: e.target.value })}
                                                        placeholder="مثلاً: جامعة بيرزيت"
                                                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--bg-tertiary)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '1rem' }}
                                                        required
                                                    />
                                                </div>
                                                <div>
                                                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>الموقع الجغرافي</label>
                                                    <div style={{ display: 'flex', gap: '10px' }}>
                                                        <input
                                                            type="number" step="any" placeholder="خط العرض"
                                                            value={newUniversityData.lat}
                                                            onChange={e => setNewUniversityData({ ...newUniversityData, lat: e.target.value })}
                                                            style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--bg-tertiary)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                                                        />
                                                        <input
                                                            type="number" step="any" placeholder="خط الطول"
                                                            value={newUniversityData.lon}
                                                            onChange={e => setNewUniversityData({ ...newUniversityData, lon: e.target.value })}
                                                            style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--bg-tertiary)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                                                        />
                                                    </div>
                                                    <button 
                                                        type="button" className="btn-small" 
                                                        onClick={() => getCurrentLocation(true)}
                                                        style={{ marginTop: '10px', width: '100%', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: 'none' }}
                                                    >
                                                        📍 استخدام موقع الجامعة الحالي
                                                    </button>
                                                </div>
                                                <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                                                    <button type="button" onClick={() => { setIsCreatingUniversity(false); setShowCreateOptions(true); }} className="btn-small" style={{ flex: 1, background: 'transparent', border: '1px solid var(--text-muted)' }}>الخلف</button>
                                                    <button type="submit" disabled={isSubmittingShop} className="btn-small btn-accept" style={{ flex: 2 }}>{isSubmittingShop ? 'جاري الحفظ...' : 'إنشاء المؤسسة'}</button>
                                                </div>
                                            </form>
                                        </div>
                                    ) : isCreatingShop ? (
                                        <div style={{ padding: '20px' }}>
                                            <h3 style={{ marginBottom: '15px' }}>تسجيل محل جديد</h3>
                                            <form onSubmit={handleCreateShop} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                                <div>
                                                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>اسم المحل</label>
                                                    <input
                                                        type="text"
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
                                                        value={newShopData.category}
                                                        onChange={e => setNewShopData({ ...newShopData, category: e.target.value })}
                                                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--bg-tertiary)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                                                    >
                                                        <option value="General">عام</option>
                                                        <option value="بلدية">بلدية 🏩</option>
                                                        <option value="بنك">بنك 🏦</option>
                                                        <option value="مركز تسوق">مركز تسوق (مول) 🏢</option>
                                                        <option value="مجمع تجاري">مجمع تجاري 🏘️</option>
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
                                                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>الموقع الجغرافي</label>
                                                    <div style={{ display: 'flex', gap: '10px' }}>
                                                        <input
                                                            type="number" step="any" placeholder="خط العرض"
                                                            value={newShopData.lat}
                                                            onChange={e => setNewShopData({ ...newShopData, lat: e.target.value })}
                                                            style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--bg-tertiary)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                                                        />
                                                        <input
                                                            type="number" step="any" placeholder="خط الطول"
                                                            value={newShopData.lon}
                                                            onChange={e => setNewShopData({ ...newShopData, lon: e.target.value })}
                                                            style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--bg-tertiary)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                                                        />
                                                    </div>
                                                    <button 
                                                        type="button" className="btn-small" 
                                                        onClick={() => getCurrentLocation(false)}
                                                        style={{ marginTop: '10px', width: '100%', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: 'none' }}
                                                    >
                                                        📍 استخدام موقعي الحالي
                                                    </button>
                                                </div>
                                                <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                                                    <button type="button" onClick={() => { setIsCreatingShop(false); setShowCreateOptions(true); }} className="btn-small" style={{ flex: 1, background: 'transparent', border: '1px solid var(--text-muted)' }}>الخلف</button>
                                                    <button type="submit" disabled={isSubmittingShop} className="btn-small btn-accept" style={{ flex: 2 }}>{isSubmittingShop ? 'جاري الحفظ...' : 'إنشاء المحل'}</button>
                                                </div>
                                            </form>
                                        </div>
                                    ) : (
                                        <>
                                            <form onSubmit={handleShopSearch} style={{ padding: '15px', position: 'sticky', top: 0, background: 'var(--bg-secondary)', zIndex: 10, borderBottom: '1px solid var(--bg-tertiary)' }}>
                                                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', background: 'var(--bg-tertiary)', borderRadius: '12px', padding: '5px 15px' }}>
                                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
                                                        <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                                    </svg>
                                                    <input
                                                        type="text"
                                                        placeholder="ابحث عن ( مطعم , مركز تسوق , مؤسسة ..... )"
                                                        value={shopSearchQuery}
                                                        onChange={(e) => setShopSearchQuery(e.target.value)}
                                                        style={{ flex: 1, padding: '10px', background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: '0.95rem', fontFamily: 'inherit' }}
                                                        autoFocus
                                                    />
                                                    {isSearchingShop && <div className="spinner-small"></div>}
                                                </div>
                                            </form>

                                            {shopSearchResults.length > 0 && (
                                                <div className="user-list">
                                                    <h4 style={{ padding: '10px 15px', fontSize: '0.9rem', color: 'var(--primary)' }}>نتائج البحث</h4>
                                                    {shopSearchResults.map(shop => (
                                                        <div key={shop.id} className="user-item" onClick={() => onShopClick && onShopClick(shop)} style={{ cursor: 'pointer' }}>
                                                            <div className="chat-avatar" style={{
                                                                background: 'linear-gradient(135deg, #fbab15, #f59e0b)',
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                borderRadius: '12px', overflow: 'hidden', flexShrink: 0,
                                                                width: '50px', height: '50px'
                                                            }}>
                                                                <ShopAvatar shop={shop} />
                                                            </div>
                                                            <div className="chat-info" style={{ flex: 1, minWidth: 0 }}>
                                                                <div className="chat-name" style={{ fontWeight: '700' }}>{shop.name}</div>
                                                                <div className="chat-last-message" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#fbab15', display: 'inline-block' }}></span>
                                                                    {shop.category}
                                                                </div>
                                                            </div>
                                                            <div className="user-item-actions">
                                                                {isFollowingShop(shop.id) ? (
                                                                    <span style={{ color: 'var(--success)', fontSize: '0.85rem', fontWeight: 'bold' }}>متابع ✓</span>
                                                                ) : (
                                                                    <button className="btn-small btn-accept" onClick={(e) => { e.stopPropagation(); handleFollowShop(shop); }}>متابعة</button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            <div className="user-list">
                                                <h4 style={{ padding: '10px 15px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>المحلات التي أتابعها</h4>
                                                {followedShops.length === 0 ? (
                                                    <div className="empty-state">
                                                        <p>لا تتابع أي محل حالياً</p>
                                                    </div>
                                                ) : (
                                                    followedShops.map(shop => (
                                                        <div key={shop.id} className="user-item" onClick={() => onShopClick && onShopClick(shop)} style={{ cursor: 'pointer' }}>
                                                            <div className="chat-avatar" style={{
                                                                background: shop.profile_picture ? 'transparent' : 'linear-gradient(135deg, #fbab15, #f59e0b)',
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                borderRadius: '12px', overflow: 'hidden', flexShrink: 0,
                                                                width: '50px', height: '50px'
                                                            }}>
                                                                {shop.profile_picture ? (
                                                                    <img
                                                                        src={getImageUrl(shop.profile_picture)}
                                                                        alt={shop.name}
                                                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                                        onError={e => {
                                                                            e.target.style.display = 'none';
                                                                            e.target.parentElement.innerHTML = `<span style="font-size:1.3rem;color:white">${shop.name?.charAt(0) || '🏪'}</span>`;
                                                                        }}
                                                                    />
                                                                ) : (
                                                                    <span style={{ fontSize: '1.3rem', color: 'white' }}>
                                                                        {categoryEmoji(shop.category)}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="chat-info" style={{ flex: 1, minWidth: 0 }}>
                                                                <div className="chat-name" style={{ fontWeight: '700' }}>{shop.name}</div>
                                                                <div className="chat-last-message" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                    {shop.category}
                                                                </div>
                                                            </div>
                                                            <div className="user-item-actions">
                                                                <button
                                                                    className="btn-small btn-reject"
                                                                    onClick={(e) => { e.stopPropagation(); handleUnfollowShop(shop.id); }}
                                                                    style={{ border: '1px solid var(--error)', color: 'var(--error)' }}
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
                    )}
                </div>
            </div>
        </div>
        {selectedFriendId && (
            <ProfileModal
                userId={selectedFriendId}
                onClose={() => setSelectedFriendId(null)}
            />
        )}
        </>
    );
};

export default FriendsModal;
