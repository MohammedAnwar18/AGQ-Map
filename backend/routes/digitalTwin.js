const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/digitalTwinController');
const { authenticateToken } = require('../middleware/auth');

// جلب أحدث مشروع للجميع (للمستكشفين والزوار)
router.get('/latest', ctrl.getLatestProject);

// حفظ المشروع (يتطلب تسجيل دخول)
router.post('/save', authenticateToken, ctrl.saveProject);

module.exports = router;
