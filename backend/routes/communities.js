const express = require('express');
const router = express.Router();
const { authenticateToken, isAdmin } = require('../middleware/auth');
const { getAllCommunities, joinCommunity, getCommunityPosts, createCommunity } = require('../controllers/communityController');
const { getHistoricalMaps, addHistoricalMap, deleteHistoricalMap } = require('../controllers/historicalMapController');

router.get('/', authenticateToken, getAllCommunities);
router.post('/', authenticateToken, isAdmin, createCommunity);
router.post('/:id/join', authenticateToken, joinCommunity);
router.get('/:id/posts', authenticateToken, getCommunityPosts);

// Historical map layers routes (for atlas-type communities)
router.get('/:id/historical-maps', authenticateToken, getHistoricalMaps);
router.post('/:id/historical-maps', authenticateToken, isAdmin, addHistoricalMap);
router.delete('/:id/historical-maps/:mapId', authenticateToken, isAdmin, deleteHistoricalMap);

module.exports = router;
