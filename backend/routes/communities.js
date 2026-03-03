const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { getAllCommunities, joinCommunity, getCommunityPosts } = require('../controllers/communityController');

router.get('/', authenticateToken, getAllCommunities);
router.post('/:id/join', authenticateToken, joinCommunity);
router.get('/:id/posts', authenticateToken, getCommunityPosts);

module.exports = router;
