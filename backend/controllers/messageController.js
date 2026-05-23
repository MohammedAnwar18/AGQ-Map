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

        // تحديث الإشعارات كـ "مقروءة" أيضاً
        await pool.query(
            `UPDATE notifications SET is_read = true 
             WHERE user_id = $1 AND sender_id = $2 AND type = 'message'`,
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

/**
 * حذف رسالة واحدة
 */
const deleteMessage = async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.user.id || req.user.userId;

        // التحقق من وجود الرسالة
        const msgResult = await pool.query(
            'SELECT * FROM messages WHERE id = $1',
            [messageId]
        );

        if (msgResult.rows.length === 0) {
            return res.status(404).json({ error: 'Message not found' });
        }

        const message = msgResult.rows[0];

        // فقط المرسل أو المستقبل يمكنه حذف الرسالة
        if (message.sender_id !== userId && message.receiver_id !== userId) {
            return res.status(403).json({ error: 'Not authorized to delete this message' });
        }

        // حذف من قاعدة البيانات
        await pool.query(
            'DELETE FROM messages WHERE id = $1',
            [messageId]
        );

        // إرسال البث للطرف الآخر عبر WebSockets
        const targetUserId = message.sender_id === userId ? message.receiver_id : message.sender_id;
        const io = req.app.get('io');
        if (io) {
            io.to(`user_${targetUserId}`).emit('message-deleted', { messageId });
        }

        res.json({ message: 'Message deleted successfully', messageId });
    } catch (error) {
        console.error('Error deleting message:', error);
        res.status(500).json({ error: 'Failed to delete message' });
    }
};

/**
 * حذف المحادثة كاملة مع صديق
 */
const deleteConversation = async (req, res) => {
    try {
        const { friendId } = req.params;
        const userId = req.user.id || req.user.userId;

        // حذف كافة الرسائل بين الطرفين
        await pool.query(
            `DELETE FROM messages 
             WHERE (sender_id = $1 AND receiver_id = $2)
             OR (sender_id = $2 AND receiver_id = $1)`,
            [userId, friendId]
        );

        // إعلام الطرف الآخر بحذف المحادثة
        const io = req.app.get('io');
        if (io) {
            io.to(`user_${friendId}`).emit('conversation-deleted', { friendId: userId });
        }

        res.json({ message: 'Conversation deleted successfully' });
    } catch (error) {
        console.error('Error deleting conversation:', error);
        res.status(500).json({ error: 'Failed to delete conversation' });
    }
};

module.exports = {
    getMessages,
    sendMessage,
    deleteMessage,
    deleteConversation
};
