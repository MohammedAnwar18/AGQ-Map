import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { notificationService, friendService, getImageUrl } from '../services/api';
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
        const request = pendingRequests.find(r => r.sender_id === senderId);
        if (!request) {
            alert('لم يتم العثور على طلب الصداقة، ربما تم قبوله بالفعل');
            return;
        }

        setActionLoading(true);
        try {
            await friendService.acceptFriendRequest(request.id);
            // Update UI
            setPendingRequests(prev => prev.filter(r => r.id !== request.id));
            setSelectedRequest(null);
            fetchNotifications(); // Refresh list
        } catch (error) {
            console.error('Error accepting friend request:', error);
            alert('فشل قبول الطلب، حاول مرة أخرى');
        } finally {
            setActionLoading(false);
        }
    };

    const handleRejectFriend = async (senderId) => {
        const request = pendingRequests.find(r => r.sender_id === senderId);
        if (!request) {
            setSelectedRequest(null);
            return;
        }

        setActionLoading(true);
        try {
            await friendService.rejectFriendRequest(request.id);
            setPendingRequests(prev => prev.filter(r => r.id !== request.id));
            setSelectedRequest(null);
            fetchNotifications();
        } catch (error) {
            console.error('Error rejecting friend request:', error);
            alert('فشل رفض الطلب، حاول مرة أخرى');
        } finally {
            setActionLoading(false);
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
        switch (type) {
            case 'friend_request': return '👥';
            case 'friend_accepted': return '✅';
            case 'new_post': return '📸';
            case 'post_comment': return '💬';
            case 'comment': return '💬';
            case 'like': return '❤️';
            case 'shop_alert': return '📢';
            default: return '🔔';
        }
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
            <div className="notifications-modal" onClick={(e) => e.stopPropagation()}>
                <div className="notifications-header">
                    <h2>{selectedRequest ? 'طلب صداقة' : 'الإشعارات'}</h2>
                    <button className="close-btn" onClick={selectedRequest ? () => setSelectedRequest(null) : onClose}>
                        {selectedRequest ? '✕' : '✕'}
                    </button>
                </div>

                <div className="notifications-content">
                    {selectedRequest ? (
                        <div className="friend-request-detail">
                            <div className="detail-header">
                                <div className="detail-image">
                                    <img src={getImageUrl(selectedRequest.sender_picture) || '/default-avatar.png'} alt={selectedRequest.sender_name} />
                                </div>
                                <h3 className="detail-name">{selectedRequest.sender_name}</h3>
                                <div className="detail-info">
                                    <span className="info-badge">العمر: {calculateAge(selectedRequest.date_of_birth) || 'غير محدد'}</span>
                                    <span className="info-badge">الجنس: {translateGender(selectedRequest.gender)}</span>
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
