const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
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

// ─── REELS ───────────────────────────────────────────────────────────────────
router.get('/', authenticateToken, getReels);
router.get('/:id', authenticateToken, getReel);
router.post('/', authenticateToken, createReel);
router.delete('/:id', authenticateToken, deleteReel);

// ─── LIKES ───────────────────────────────────────────────────────────────────
router.post('/:id/like', authenticateToken, toggleLike);

// ─── COMMENTS ────────────────────────────────────────────────────────────────
router.get('/:id/comments', authenticateToken, getComments);
router.post('/:id/comments', authenticateToken, addComment);
router.delete('/comments/:commentId', authenticateToken, deleteComment);

module.exports = router;
