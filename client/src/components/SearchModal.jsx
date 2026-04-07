import React, { useState } from 'react';
import { userService, friendService } from '../services/api';
import './Modal.css';

const SearchModal = ({ onClose }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);
    const [requestLoading, setRequestLoading] = useState(null);

    const handleSearch = async (e) => {
        e.preventDefault();

        if (searchQuery.trim().length < 2) return;

        try {
            setLoading(true);
            const data = await userService.searchUsers(searchQuery);
            setResults(data.users);
            setSearched(true);
        } catch (error) {
            console.error('Search failed:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSendRequest = async (userId) => {
        try {
            setRequestLoading(userId);
            await friendService.sendFriendRequest(userId);
            setResults(results.map(user =>
                user.id === userId
                    ? { ...user, has_pending_request: true }
                    : user
            ));
        } catch (error) {
            console.error('Failed to send friend request:', error);
            alert('فشل إرسال الطلب: ' + (error.response?.data?.error || 'حدث خطأ غير متوقع'));
        } finally {
            setRequestLoading(null);
        }
    };

    const handleCancelRequest = async (userId) => {
        try {
            setRequestLoading(userId);
            await friendService.cancelFriendRequest(userId);
            setResults(results.map(user =>
                user.id === userId
                    ? { ...user, has_pending_request: false }
                    : user
            ));
        } catch (error) {
            console.error('Failed to cancel friend request:', error);
        } finally {
            setRequestLoading(null);
        }
    };

    const getActionButton = (user) => {
        if (user.is_friend) {
            return (
                <button className="btn-small btn-pending" disabled>
                    صديق ✓
                </button>
            );
        }

        if (requestLoading === user.id) {
            return <div className="spinner-small"></div>;
        }

        if (user.has_pending_request) {
            return (
                <button
                    className="btn-small"
                    onClick={() => handleCancelRequest(user.id)}
                    style={{
                        background: 'rgba(251,171,21,0.15)',
                        border: '1px solid #fbab15',
                        color: '#fbab15',
                        borderRadius: '20px',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        padding: '5px 10px'
                    }}
                    title="اضغط لإلغاء طلب الصداقة"
                >
                    ✓ تم الإرسال - إلغاء؟
                </button>
            );
        }

        return (
            <button
                className="btn-small btn-add-friend"
                onClick={() => handleSendRequest(user.id)}
            >
                إضافة
            </button>
        );
    };


    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-container" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>البحث عن مستخدمين</h2>
                    <button className="btn-close" onClick={onClose}>✕</button>
                </div>

                <div className="search-input-container">
                    <form onSubmit={handleSearch}>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="input"
                            placeholder="اكتب اسم المستخدم أو الاسم الكامل..."
                            autoFocus
                        />
                    </form>
                </div>

                <div className="modal-body" style={{ padding: 0 }}>
                    {loading ? (
                        <div style={{ padding: '2rem', textAlign: 'center' }}>
                            <div className="spinner"></div>
                            <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>
                                جاري البحث...
                            </p>
                        </div>
                    ) : !searched ? (
                        <div className="empty-state">
                            <span className="empty-state-icon">🔍</span>
                            <p>ابحث عن مستخدمين جدد</p>
                            <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
                                اكتب اسم المستخدم أو الاسم الكامل
                            </p>
                        </div>
                    ) : results.length === 0 ? (
                        <div className="empty-state">
                            <span className="empty-state-icon">😕</span>
                            <p>لم نعثر على نتائج</p>
                            <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
                                جرب مصطلح بحث آخر
                            </p>
                        </div>
                    ) : (
                        <div className="user-list">
                            {results.map(user => (
                                <div key={user.id} className="user-item">
                                    <div className="chat-avatar">
                                        {user.profile_picture ? (
                                            <img src={user.profile_picture} alt={user.username} />
                                        ) : (
                                            <div className="avatar-placeholder">
                                                {user.username.charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                    </div>
                                    <div className="chat-info">
                                        <div className="chat-name">
                                            {user.full_name || user.username}
                                        </div>
                                        <div className="chat-last-message">
                                            @{user.username}
                                            {user.bio && ` • ${user.bio}`}
                                        </div>
                                    </div>
                                    <div className="user-item-actions" style={{ flexShrink: 0 }}>
                                        {getActionButton(user)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SearchModal;
