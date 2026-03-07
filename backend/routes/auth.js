const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { register, login, verifyOtp, getMe, logout, updateLocation, forgotPassword, resetPassword } = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

// تسجيل مستخدم جديد
router.post('/register', [
    body('username').trim().isLength({ min: 3, max: 50 }).withMessage('اسم المستخدم يجب أن يكون بين 3 و 50 حرفاً'),
    body('email').isEmail().withMessage('البريد الإلكتروني غير صالح'),
    body('password').isLength({ min: 6 }).withMessage('كلمة المرور يجب أن تكون 6 أحرف على الأقل'),
    body('full_name').optional().trim().isLength({ max: 100 }).withMessage('الاسم الكامل طويل جداً (الحد الأقصى 100 حرف)')
], register);

// تسجيل الدخول
router.post('/login', login);

// التحقق من OTP
router.post('/verify-otp', verifyOtp);

// الحصول على بيانات المستخدم الحالي (محمي)
router.get('/me', authenticateToken, getMe);

// تسجيل الخروج (محمي)
router.post('/logout', authenticateToken, logout);

// تحديث الموقع (محمي)
// تحديث الموقع (محمي)
router.put('/update-location', authenticateToken, updateLocation);

// نسيت كلمة المرور
router.post('/forgot-password', forgotPassword);

// إعادة تعيين كلمة المرور
router.post('/reset-password', resetPassword);

module.exports = router;
