import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { notificationService, friendService, getImageUrl } from '../services/api';
import './Modal.css';
import './NotificationsModal.css';

const NotificationsModal = ({ onClose, onNotificationClick }) => {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);

    const [selectedRequest, setSelectedRequest] = useState(null);
    const [pendingRequests, setPendingRequests] = useState([]);
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        fetchNotifications();
        fetchPendingRequests();
    }, []);

    const fetchNotifications = async () => {
        try {
            const data = await notificationService.getNotifications();
            setNotifications(data.notifications || []);
        } catch (error) {
            console.error('Error fetching notifications:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchPendingRequests = async () => {
        try {
            const data = await friendService.getPendingRequests();
            setPendingRequests(data.requests || []);
        } catch (error) {
            console.error('Error fetching pending requests:', error);
        }
    };

    const markAsRead = async (notificationId) => {
        try {
            await notificationService.markAsRead(notificationId);
            setNotifications(prev =>
                prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
            );
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    };

    const handleAcceptFriend = async (senderId) => {
        // Optimistic UI Update: remove it instantly
        setNotifications(prev => prev.filter(n => !(n.type === 'friend_request' && n.sender_id === senderId)));
        setSelectedRequest(null);
        
        try {
            await friendService.acceptBySender(senderId);
        } catch (error) {
            console.error('Error accepting friend request:', error);
        }
    };

    const handleRejectFriend = async (senderId) => {
        // Optimistic UI Update
        setNotifications(prev => prev.filter(n => !(n.type === 'friend_request' && n.sender_id === senderId)));
        setSelectedRequest(null);

        try {
            await friendService.rejectBySender(senderId);
        } catch (error) {
            console.error('Error rejecting friend request:', error);
        }
    };

    const calculateAge = (dob) => {
        if (!dob) return null;
        const birthDate = new Date(dob);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    };

    const translateGender = (gender) => {
        if (gender === 'male') return 'ذكر';
        if (gender === 'female') return 'أنثى';
        return gender || 'غير محدد';
    };

    const getNotificationIcon = (type) => {
        return '🔔'; // Simple bell icon for all as user requested no emojis or cluttered look
    };

    const getNotificationMessage = (notification) => {
        if (notification.type === 'shop_alert') {
            try {
                const data = JSON.parse(notification.message);
                return `${data.shopName}: ${data.text}`;
            } catch (e) {
                return notification.message;
            }
        }

        if (notification.message) return `${notification.sender_name || 'شخص ما'} ${notification.message}`;

        switch (notification.type) {
            case 'friend_request': return `${notification.sender_name} أرسل لك طلب صداقة`;
            case 'friend_accepted': return `${notification.sender_name} قبل طلب صداقتك`;
            case 'new_post': return `${notification.sender_name} نشر منشوراً جديداً`;
            case 'post_comment': return `${notification.sender_name} علق على منشورك`;
            case 'comment': return `${notification.sender_name} علق على منشورك`;
            case 'like': return `${notification.sender_name} أعجب بمنشورك`;
            default: return notification.message || 'إشعار جديد';
        }
    };

    const formatTime = (timestamp) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'الآن';
        if (minutes < 60) return `منذ ${minutes} دقيقة`;
        if (hours < 24) return `منذ ${hours} ساعة`;
        return `منذ ${days} يوم`;
    };

    const handleNotificationClick = (notification) => {
        markAsRead(notification.id);

        if (notification.type === 'friend_request') {
            setSelectedRequest(notification);
            return;
        }

        if (notification.type === 'shop_alert' && onNotificationClick) {
            try {
                const data = JSON.parse(notification.message);
                onNotificationClick({ ...notification, ...data });
                onClose();
            } catch (e) {
                console.error('Error parsing notification data', e);
            }
        }
    };


    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-container" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 25px)', paddingBottom: '1.2rem' }}>
                    <h2>{selectedRequest ? 'طلب صداقة' : 'الإشعارات'}</h2>
                    <button className="btn-close" onClick={selectedRequest ? () => setSelectedRequest(null) : onClose} style={{ marginTop: '5px' }}>
                        ✕
                    </button>
                </div>

                <div className="modal-body notifications-content">
                    {selectedRequest ? (
                        <div className="friend-request-detail">
                            <div className="detail-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', marginBottom: '1.5rem' }}>
                                    {/* Gender (Right Side) */}
                                    {selectedRequest.gender && (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', width: '50px' }}>
                                            <div style={{
                                                width: '40px', height: '40px', borderRadius: '50%',
                                                background: selectedRequest.gender === 'male' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(236, 72, 153, 0.1)',
                                                color: selectedRequest.gender === 'male' ? '#3b82f6' : '#ec4899',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                boxShadow: '0 4px 10px rgba(0,0,0,0.05)',
                                                border: `1px solid ${selectedRequest.gender === 'male' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(236, 72, 153, 0.2)'}`
                                            }}>
                                                {selectedRequest.gender === 'male' ? (
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M16 3h5v5"></path>
                                                        <path d="M21 3l-6.75 6.75"></path>
                                                        <circle cx="10" cy="14" r="6"></circle>
                                                    </svg>
                                                ) : (
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M12 15v7"></path>
                                                        <path d="M9 19h6"></path>
                                                        <circle cx="12" cy="9" r="6"></circle>
                                                    </svg>
                                                )}
                                            </div>
                                            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#e2e8f0' }}>
                                                {selectedRequest.gender === 'male' ? 'ذكر' : 'أنثى'}
                                            </span>
                                        </div>
                                    )}

                                    <div className="detail-image" style={{ margin: 0 }}>
                                        <img src={getImageUrl(selectedRequest.sender_picture) || '/default-avatar.png'} alt={selectedRequest.sender_name} />
                                    </div>

                                    {/* Age (Left Side) */}
                                    {selectedRequest.date_of_birth && (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', width: '50px' }}>
                                            <div style={{
                                                width: '40px', height: '40px', borderRadius: '50%',
                                                background: 'rgba(16, 185, 129, 0.1)', color: '#10b981',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                boxShadow: '0 4px 10px rgba(0,0,0,0.05)',
                                                border: '1px solid rgba(16, 185, 129, 0.2)'
                                            }}>
                                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <circle cx="12" cy="12" r="10"></circle>
                                                    <polyline points="12 6 12 12 16 14"></polyline>
                                                </svg>
                                            </div>
                                            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#e2e8f0' }}>
                                                {calculateAge(selectedRequest.date_of_birth)} سنة
                                            </span>
                                        </div>
                                    )}
                                </div>
                                <h3 className="detail-name">{selectedRequest.sender_name}</h3>
                                <div className="detail-info">
                                    {selectedRequest.marital_status && (
                                        <span className="info-badge" style={{ 
                                            background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', 
                                            borderColor: 'rgba(245, 158, 11, 0.2)', fontWeight: '600',
                                            display: 'flex', alignItems: 'center', gap: '5px'
                                        }}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l8.77-8.77 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                                            </svg>
                                            {selectedRequest.marital_status === 'single' ? (selectedRequest.gender === 'male' ? 'أعزب' : selectedRequest.gender === 'female' ? 'عزباء' : 'أعزب/عزباء') :
                                                selectedRequest.marital_status === 'married' ? (selectedRequest.gender === 'male' ? 'متزوج' : selectedRequest.gender === 'female' ? 'متزوجة' : 'متزوج/متزوجة') :
                                                    selectedRequest.marital_status === 'engaged' ? (selectedRequest.gender === 'male' ? 'خاطب' : selectedRequest.gender === 'female' ? 'مخطوبة' : 'خاطب/مخطوبة') :
                                                        selectedRequest.marital_status === 'divorced' ? (selectedRequest.gender === 'male' ? 'مطلق' : selectedRequest.gender === 'female' ? 'مطلقة' : 'مطلق/مطلقة') :
                                                            selectedRequest.marital_status === 'widowed' ? (selectedRequest.gender === 'male' ? 'أرمل' : selectedRequest.gender === 'female' ? 'أرملة' : 'أرمل/أرملة') : selectedRequest.marital_status}
                                        </span>
                                    )}
                                    {selectedRequest.workplace && (
                                        <span className="info-badge" style={{ 
                                            background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', 
                                            borderColor: 'rgba(59, 130, 246, 0.3)', fontWeight: '600',
                                            display: 'flex', alignItems: 'center', gap: '5px'
                                        }}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                                                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
                                            </svg>
                                            {selectedRequest.workplace}
                                        </span>
                                    )}
                                    {selectedRequest.education && (
                                        <span className="info-badge" style={{ 
                                            background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', 
                                            borderColor: 'rgba(139, 92, 246, 0.3)', fontWeight: '600',
                                            display: 'flex', alignItems: 'center', gap: '5px'
                                        }}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
                                                <path d="M6 12v5c3 3 9 3 12 0v-5"></path>
                                            </svg>
                                            {selectedRequest.education === 'student' ? (selectedRequest.institution ? `يدرس في ${selectedRequest.institution}` : 'طالب جامعة') :
                                                selectedRequest.education === 'graduate' ? (selectedRequest.institution ? `خريج من ${selectedRequest.institution}` : 'خريج') :
                                                    selectedRequest.education === 'not_studying' ? 'لا يدرس' : selectedRequest.education}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="detail-actions">
                                <button
                                    className="btn-accept"
                                    onClick={() => handleAcceptFriend(selectedRequest.sender_id)}
                                    disabled={actionLoading}
                                >
                                    {actionLoading ? 'جاري القبول...' : 'الموافقة على الطلب'}
                                </button>
                                <button
                                    className="btn-reject"
                                    onClick={() => handleRejectFriend(selectedRequest.sender_id)}
                                    disabled={actionLoading}
                                >
                                    {actionLoading ? 'جاري الرفض...' : 'رفض الطلب'}
                                </button>
                                <button className="btn-back" onClick={() => setSelectedRequest(null)}>العودة</button>
                            </div>
                        </div>
                    ) : (
                        <>
                            {loading ? (
                                <div className="loading-state">
                                    <div className="spinner"></div>
                                    <p>جاري التحميل...</p>
                                </div>
                            ) : notifications.length === 0 ? (
                                <div className="empty-state">
                                    <span className="empty-icon">🔔</span>
                                    <p>لا توجد إشعارات جديدة</p>
                                </div>
                            ) : (
                                <div className="notifications-list">
                                    {notifications.map(notification => {
                                        let displayMessage = getNotificationMessage(notification);
                                        let displayIcon = getNotificationIcon(notification.type);
                                        let displayTitle = null;
                                        let displayImage = null;

                                        if (notification.type === 'shop_alert') {
                                            try {
                                                const data = JSON.parse(notification.message);
                                                displayTitle = data.shopName;
                                                displayMessage = data.text;
                                                displayIcon = '🏪';
                                                if (data.shopImage) displayImage = data.shopImage;
                                            } catch (e) { }
                                        }

                                        return (
                                            <div
                                                key={notification.id}
                                                className={`notification-item ${!notification.is_read ? 'unread' : ''}`}
                                                onClick={() => handleNotificationClick(notification)}
                                            >
                                                <div className="notification-icon">
                                                    {notification.type === 'shop_alert' ? (
                                                        displayImage ? (
                                                            <img src={getImageUrl(displayImage)} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', border: '1px solid #eee' }} />
                                                        ) : (
                                                            <span style={{ fontSize: '24px' }}>{displayIcon}</span>
                                                        )
                                                    ) : (
                                                        notification.sender_picture ? (
                                                            <img src={getImageUrl(notification.sender_picture)} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
                                                        ) : (
                                                            <span style={{ fontSize: '24px' }}>{displayIcon}</span>
                                                        )
                                                    )}
                                                </div>
                                                <div className="notification-content">
                                                    {displayTitle && <strong style={{ display: 'block', fontSize: '0.9rem', marginBottom: 2 }}>{displayTitle}</strong>}
                                                    <p className="notification-message">
                                                        {displayMessage}
                                                    </p>
                                                    <span className="notification-time">
                                                        {formatTime(notification.created_at)}
                                                    </span>
                                                </div>
                                                {!notification.is_read && (
                                                    <div className="unread-dot"></div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default NotificationsModal;
