const pool = require('../config/database');
const { createNotification } = require('./notificationController');

/**
 * الحصول على الرسائل مع صديق
 */
const getMessages = async (req, res) => {
    try {
        const { friendId } = req.params;
        const userId = req.user.userId;

        const result = await pool.query(
            `SELECT * FROM messages 
             WHERE (sender_id = $1 AND receiver_id = $2)
             OR (sender_id = $2 AND receiver_id = $1)
             ORDER BY created_at ASC`,
            [userId, friendId]
        );

        // تحديث الرسائل كـ "مقروءة"
        await pool.query(
            `UPDATE messages SET is_read = true 
             WHERE receiver_id = $1 AND sender_id = $2`,
            [userId, friendId]
        );

        res.json({ messages: result.rows });
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
};

/**
 * إرسال رسالة جديدة
 */
const sendMessage = async (req, res) => {
    try {
        const { receiverId, content, imageUrl } = req.body;
        const senderId = req.user.userId;

        if (!receiverId || (!content && !imageUrl)) {
            return res.status(400).json({ error: 'Missing message data' });
        }

        const result = await pool.query(
            `INSERT INTO messages (sender_id, receiver_id, content, image_url, created_at)
             VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
             RETURNING *`,
            [senderId, receiverId, content || '', imageUrl || null]
        );

        const newMessage = result.rows[0];

        // إرسال إشعار
        await createNotification(receiverId, senderId, 'message', content || 'أرسل لك صورة');

        // محاولة البث عبر WebSockets إذا كان متاحاً (اختياري)
        const io = req.app.get('io');
        if (io) {
            io.to(`user_${receiverId}`).emit('receive-message', newMessage);
        }

        res.status(201).json({ message: newMessage });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
};

module.exports = {
    getMessages,
    sendMessage
};
