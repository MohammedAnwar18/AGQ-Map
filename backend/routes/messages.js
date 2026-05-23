const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { getMessages, sendMessage, deleteMessage, deleteConversation } = require('../controllers/messageController');

// الحصول على الرسائل مع صديق معينة
router.get('/:friendId', authenticateToken, getMessages);

// إرسال رسالة جديدة
router.post('/', authenticateToken, sendMessage);

// حذف رسالة معينة
router.delete('/:messageId', authenticateToken, deleteMessage);

// حذف محادثة كاملة مع صديق
router.delete('/conversation/:friendId', authenticateToken, deleteConversation);

module.exports = router;
