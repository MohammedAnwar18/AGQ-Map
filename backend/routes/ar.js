const express = require('express');
const router = express.Router();
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const arController = require('../controllers/arController');

// جلب علامات الواقع المعزز القريبة جغرافياً (متاح للجميع/الزوار بشكل اختياري)
router.get('/', optionalAuth, arController.getNearbyARContents);

// إنشاء علامة واقع معزز جديدة (للأدمن فقط)
router.post('/', authenticateToken, arController.createARContent);

// حذف علامة واقع معزز (للأدمن فقط)
router.delete('/:id', authenticateToken, arController.deleteARContent);

module.exports = router;
