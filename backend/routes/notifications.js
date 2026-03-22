const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const {
    getNotifications,
    markAsRead,
    markAllAsRead,
    getUnreadCount,
    getUnreadMessagesCount
} = require('../controllers/notificationController');

// Get all notifications for user
router.get('/', authenticateToken, getNotifications);

// Get unread count
router.get('/unread-count', authenticateToken, getUnreadCount);

// Get unread messages count
router.get('/unread-messages-count', authenticateToken, getUnreadMessagesCount);

// Mark specific notification as read
router.put('/:id/read', authenticateToken, markAsRead);

// Mark all notifications as read
router.put('/read-all', authenticateToken, markAllAsRead);

module.exports = router;
