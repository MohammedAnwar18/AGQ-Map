const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { authenticateToken } = require('../middleware/auth');
const { createPost, getPosts, deletePost, toggleLike } = require('../controllers/postController');

// إعداد Multer لرفع الصور
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'post-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp|mp4|webm|ogg/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image and video files are allowed'));
        }
    }
});

// إنشاء منشور جديد (محمي)
router.post('/', authenticateToken, upload.array('media', 10), createPost);

// الحصول على المنشورات (محمي)
router.get('/', authenticateToken, getPosts);

// حذف منشور (محمي)
router.delete('/:postId', authenticateToken, deletePost);

// تبديل الإعجاب (محمي)
router.post('/:postId/like', authenticateToken, toggleLike);

module.exports = router;
