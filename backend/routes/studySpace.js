const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/studySpaceController');
const { authenticateToken, isAdmin } = require('../middleware/auth');

// ─── الفيديوهات ──────────────────────────────────────────────────────────────
// جلب كل الفيديوهات المتاحة (للجميع)
router.get('/videos', authenticateToken, ctrl.getStudyVideos);

// إضافة/تحديث فيديو (أدمن فقط)
router.post('/videos', authenticateToken, isAdmin, ctrl.upsertStudyVideo);

// ─── الكتب ───────────────────────────────────────────────────────────────────
// جلب قائمة الكتب (للجميع)
router.get('/books', authenticateToken, ctrl.getStudyBooks);

// رفع كتاب جديد (أدمن فقط)
router.post('/books', authenticateToken, isAdmin, ctrl.uploadMiddleware, ctrl.uploadStudyBook);

// حذف كتاب (أدمن فقط)
router.delete('/books/:id', authenticateToken, isAdmin, ctrl.deleteStudyBook);

module.exports = router;
