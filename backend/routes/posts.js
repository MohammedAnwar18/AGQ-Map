const express = require('express');
const router = express.Router();
const { uploadCloud } = require('../config/cloudinary');

const { authenticateToken } = require('../middleware/auth');
const { createPost, getPosts, deletePost, toggleLike } = require('../controllers/postController');

// إنشاء منشور جديد (محمي)
router.post('/', authenticateToken, uploadCloud.array('media', 10), createPost);

// الحصول على المنشورات (محمي)
router.get('/', authenticateToken, getPosts);

// حذف منشور (محمي)
router.delete('/:postId', authenticateToken, deletePost);

// تبديل الإعجاب (محمي)
router.post('/:postId/like', authenticateToken, toggleLike);

module.exports = router;
