const express = require('express');
const router = express.Router();
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { isAdmin } = require('../middleware/adminAuth');
const {
    getReels,
    getReel,
    createReel,
    deleteReel,
    toggleLike,
    getComments,
    addComment,
    deleteComment
} = require('../controllers/reelController');

// ─── REELS (GET = public with optional auth for is_liked) ─────────────────
router.get('/', optionalAuth, getReels);
router.get('/:id', optionalAuth, getReel);
// إنشاء الريل للأدمن فقط
router.post('/', authenticateToken, isAdmin, createReel);
// حذف الريل: أدمن يمكنه حذف أي ريل، المستخدم العادي يحذف ريله فقط (منطق في الcontroller)
router.delete('/:id', authenticateToken, deleteReel);

// ─── LIKES ───────────────────────────────────────────────────────────────────
router.post('/:id/like', authenticateToken, toggleLike);

// ─── COMMENTS ────────────────────────────────────────────────────────────────
router.get('/:id/comments', optionalAuth, getComments);
router.post('/:id/comments', authenticateToken, addComment);
router.delete('/comments/:commentId', authenticateToken, deleteComment);

module.exports = router;

