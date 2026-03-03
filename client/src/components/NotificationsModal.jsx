import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { notificationService } from '../services/api';
import './NotificationsModal.css';

const NotificationsModal = ({ onClose, onNotificationClick }) => {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchNotifications();
    }, []);

    const fetchNotifications = async () => {
        try {
            const data = await notificationService.getNotifications();
            setNotifications(data.notifications || []);
            // Optional: Mark all as read when opening? Only if requested. User requested viewing them.
        } catch (error) {
            console.error('Error fetching notifications:', error);
        } finally {
            setLoading(false);
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
        // Handle Shop Alert JSON
        if (notification.type === 'shop_alert') {
            try {
                const data = JSON.parse(notification.message);
                return `${data.shopName}: ${data.text}`;
            } catch (e) {
                return notification.message;
            }
        }

        // If content message is directly available from backend logic, use it.
        // The backend creates messages like 'أعجب بمنشورك', so we can use that if available.
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
        if (notification.type === 'shop_alert' && onNotificationClick) {
            try {
                const data = JSON.parse(notification.message);
                onNotificationClick({ ...notification, ...data });
                // Also close the modal if navigating
                onClose();
            } catch (e) {
                console.error('Error parsing notification data', e);
            }
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="notifications-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>الإشعارات</h2>
                    <button className="btn-close" onClick={onClose}>✕</button>
                </div>

                <div className="notifications-content">
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
                                        displayTitle = data.shopName; // Show shop name as title
                                        displayMessage = data.text;   // Show text as body
                                        displayIcon = '🏪'; // Shop Icon
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
                                                    <img src={displayImage} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', border: '1px solid #eee' }} />
                                                ) : (
                                                    <span style={{ fontSize: '24px' }}>{displayIcon}</span>
                                                )
                                            ) : (
                                                notification.sender_picture ? (
                                                    <img src={notification.sender_picture} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
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
                </div>
            </div>
        </div>
    );
};

export default NotificationsModal;
