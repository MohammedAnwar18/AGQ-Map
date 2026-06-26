const express = require('express');
const router = express.Router();
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');
const ar = require('../controllers/arController');

router.get('/',          optionalAuth,    ar.getNearbyARContents);
router.get('/nearby',    optionalAuth,    ar.getNearbyARContents);
router.get('/all',       authenticateToken, ar.getAllARContents);
router.get('/stats',     authenticateToken, ar.getARStats);
router.post('/',         authenticateToken, ar.createARContent);
router.post('/building', authenticateToken, ar.createBuilding);
router.post('/story',    authenticateToken, ar.createStory);
router.post('/nav-point',authenticateToken, ar.createNavPoint);
router.post('/photo-marker', authenticateToken, upload.single('photo'), ar.createPhotoMarker);
router.post('/upload-snapshot', authenticateToken, ar.uploadSnapshot);
router.put('/:id',       authenticateToken, ar.updateARContent);
router.get('/:id',       optionalAuth,    ar.getARContentById);
router.delete('/:id',    authenticateToken, ar.deleteARContent);

module.exports = router;
