const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { authenticateToken } = require('../middleware/auth');
const { searchUsers, getUserProfile, updateProfile } = require('../controllers/userController');

// إعداد Multer لرفع صور البروفايل
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

// البحث عن المستخدمين (محمي)
router.get('/search', authenticateToken, searchUsers);

// الحصول على ملف مستخدم (محمي)
router.get('/:userId', authenticateToken, getUserProfile);

// تحديث الملف الشخصي (محمي)
router.put('/profile', authenticateToken, upload.single('profile_picture'), updateProfile);

module.exports = router;
