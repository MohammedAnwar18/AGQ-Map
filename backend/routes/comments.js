const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { getComments, addComment, deleteComment } = require('../controllers/commentController');

// الحصول على تعليقات منشور
router.get('/:postId', authenticateToken, getComments);

// إضافة تعليق
router.post('/:postId', authenticateToken, addComment);

// حذف تعليق
router.delete('/:commentId', authenticateToken, deleteComment);

module.exports = router;
