const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { getMessages, sendMessage } = require('../controllers/messageController');

// الحصول على الرسائل مع صديق معينة
router.get('/:friendId', authenticateToken, getMessages);

// إرسال رسالة جديدة
router.post('/', authenticateToken, sendMessage);

module.exports = router;
