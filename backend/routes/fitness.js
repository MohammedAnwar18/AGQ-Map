const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { saveRun, getFriendsActiveRuns } = require('../controllers/fitnessController');

// حفظ مسار اللياقة ونشره (محمي)
router.post('/', authenticateToken, saveRun);

// جلب مسارات الأصدقاء والمستخدم المنشورة آخر 24 ساعة (محمي)
router.get('/active', authenticateToken, getFriendsActiveRuns);

module.exports = router;
