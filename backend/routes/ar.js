const express = require('express');
const router = express.Router();
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const ar = require('../controllers/arController');

router.get('/',          optionalAuth,    ar.getNearbyARContents);
router.get('/nearby',    optionalAuth,    ar.getNearbyARContents);
router.get('/all',       authenticateToken, ar.getAllARContents);
router.get('/stats',     authenticateToken, ar.getARStats);
router.post('/',         authenticateToken, ar.createARContent);
router.post('/building', authenticateToken, ar.createBuilding);
router.post('/story',    authenticateToken, ar.createStory);
router.post('/nav-point',authenticateToken, ar.createNavPoint);
router.put('/:id',       authenticateToken, ar.updateARContent);
router.delete('/:id',    authenticateToken, ar.deleteARContent);

module.exports = router;
