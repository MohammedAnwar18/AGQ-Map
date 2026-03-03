const express = require('express');
const router = express.Router();
const { uploadCloud } = require('../config/cloudinary');
const { authenticateToken } = require('../middleware/auth');
const { searchUsers, getUserProfile, updateProfile } = require('../controllers/userController');

// البحث عن المستخدمين (محمي)
router.get('/search', authenticateToken, searchUsers);

// الحصول على ملف مستخدم (محمي)
router.get('/:userId', authenticateToken, getUserProfile);

// تحديث الملف الشخصي (محمي)
router.put('/profile', authenticateToken, uploadCloud.single('profile_picture'), updateProfile);

module.exports = router;
