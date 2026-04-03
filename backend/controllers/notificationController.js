const pool = require('../config/database');
const { sendPushNotification } = require('../utils/pushHelper');

// Get user notifications
const getNotifications = async (req, res) => {
    try {
        const userId = req.user.id || req.user.userId;

        const result = await pool.query(
            `SELECT 
                n.id,
                n.type,
                n.message,
                n.is_read,
                n.created_at,
                u.id as sender_id,
                u.username as sender_name,
                u.profile_picture as sender_picture,
                u.date_of_birth,
                u.gender,
                u.marital_status,
                u.workplace,
                u.education,
                u.institution
            FROM notifications n
            LEFT JOIN users u ON n.sender_id = u.id
            WHERE n.user_id = $1
            ORDER BY n.created_at DESC
            LIMIT 50`,
            [userId]
        );

        res.json({ notifications: result.rows });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
};

// Mark notification as read
const markAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id || req.user.userId;

        await pool.query(
            'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2',
            [id, userId]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ error: 'Failed to mark notification as read' });
    }
};

// Mark all notifications as read
const markAllAsRead = async (req, res) => {
    try {
        const userId = req.user.id || req.user.userId;

        await pool.query(
            'UPDATE notifications SET is_read = true WHERE user_id = $1',
            [userId]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        res.status(500).json({ error: 'Failed to mark all notifications as read' });
    }
};

// Get unread count
const getUnreadCount = async (req, res) => {
    try {
        const userId = req.user.id || req.user.userId;

        const result = await pool.query(
            "SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false AND type != 'message'",
            [userId]
        );

        res.json({ count: parseInt(result.rows[0].count) });
    } catch (error) {
        console.error('Error getting unread count:', error);
        res.status(500).json({ error: 'Failed to get unread count' });
    }
};

// Get unread messages count separately
const getUnreadMessagesCount = async (req, res) => {
    try {
        const userId = req.user.id || req.user.userId;

        const result = await pool.query(
            "SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false AND type = 'message'",
            [userId]
        );

        res.json({ count: parseInt(result.rows[0].count) });
    } catch (error) {
        console.error('Error getting unread messages count:', error);
        res.status(500).json({ error: 'Failed to get unread messages count' });
    }
};

// Create notification (helper function)
const createNotification = async (userId, senderId, type, message) => {
    try {
        await pool.query(
            'INSERT INTO notifications (user_id, sender_id, type, message) VALUES ($1, $2, $3, $4)',
            [userId, senderId, type, message]
        );

        // Fetch user push subscriptions
        const subResult = await pool.query(
            'SELECT id, subscription FROM push_subscriptions WHERE user_id = $1',
            [userId]
        );

        if (subResult.rows.length > 0) {
            // Fetch sender info for better notification
            const senderResult = await pool.query(
                'SELECT username FROM users WHERE id = $1',
                [senderId]
            );
            const senderName = senderResult.rows[0]?.username || 'مستخدم';

            let title = 'تنبيه جديد';
            let body = message || `لديك تنبيه جديد من ${senderName}`;

            if (type === 'friend_request') {
                title = 'طلب صداقة جديد';
                body = `أرسل لك ${senderName} طلب صداقة`;
            } else if (type === 'friend_accepted') {
                title = 'تم قبول طلب الصداقة';
                body = `وافق ${senderName} على طلب صداقتك`;
            } else if (type === 'message') {
                title = 'رسالة جديدة';
                body = `${senderName}: ${message || 'أرسل لك رسالة'}`;
            }

            const payload = {
                title,
                body,
                icon: '/logo.png', // Need to ensure this exists or use a default
                data: {
                    url: '/notifications',
                    type
                }
            };

            // Send to all registered devices for this user
            subResult.rows.forEach(async (row) => {
                const sendResult = await sendPushNotification(row.subscription, payload);
                if (sendResult.expired) {
                    // Subscription is no longer valid, delete it
                    await pool.query('DELETE FROM push_subscriptions WHERE id = $1', [row.id]);
                }
            });
        }
    } catch (error) {
        // إنشاء الإشعار اختياري - لا نوقف العملية إذا فشل
        console.warn('⚠️ Notification creation/push failed (optional):', error.message);
    }
};

module.exports = {
    getNotifications,
    markAsRead,
    markAllAsRead,
    getUnreadCount,
    getUnreadMessagesCount,
    createNotification
};
