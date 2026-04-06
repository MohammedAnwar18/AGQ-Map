const express = require('express');
const router = express.Router();
const { authenticateToken, isAdmin } = require('../middleware/auth');
const { getAllCommunities, joinCommunity, getCommunityPosts, createCommunity } = require('../controllers/communityController');

router.get('/', authenticateToken, getAllCommunities);
router.post('/', authenticateToken, isAdmin, createCommunity);
router.post('/:id/join', authenticateToken, joinCommunity);
router.get('/:id/posts', authenticateToken, getCommunityPosts);

module.exports = router;
