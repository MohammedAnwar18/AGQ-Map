const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const ctrl = require('../controllers/gameController');

/* عالم اللعب — كلّه خلف تسجيل الدخول: العالم لمن له حساب.
   الفحص الأدقّ (الأدمن وحده يحفظ) داخل المتحكّم. */

// بطاقة اللاعب
router.get('/me', authenticateToken, ctrl.me);
router.patch('/me', authenticateToken, ctrl.updateMe);

// العالم — قبل مسارات ‎:code‎ حتى لا تلتقطها كرقم لاعب
router.put('/world', authenticateToken, ctrl.saveWorld);
router.post('/world/open', authenticateToken, ctrl.setOpen);

// الحضور
router.post('/presence', authenticateToken, ctrl.heartbeat);
router.post('/presence/leave', authenticateToken, ctrl.leave);

// الزيارة برقم
router.get('/player/:code', authenticateToken, ctrl.lookup);
router.get('/world/:code', authenticateToken, ctrl.getWorld);

module.exports = router;
