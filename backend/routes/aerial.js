const express = require('express');
const router = express.Router();
const { authenticateToken, optionalAuth, isAdmin } = require('../middleware/auth');
const aerial = require('../controllers/aerialController');
const upload = require('../middleware/upload');

// القراءة متاحة (الطبقة نفسها تظهر للأدمن في الواجهة)
router.get('/', optionalAuth, aerial.listAerial);

// الكتابة للأدمن العام وحده
router.post('/', authenticateToken, isAdmin,
    upload.fields([{ name: 'thumbnail_file', maxCount: 1 }, { name: 'equirect_file', maxCount: 1 }]),
    aerial.createAerial);
router.put('/:id', authenticateToken, isAdmin, aerial.updateAerial);
router.delete('/:id', authenticateToken, isAdmin, aerial.deleteAerial);

// نقاط داخل الصورة (معلومة: صورة + نص)
router.post('/:id/hotspots', authenticateToken, isAdmin, upload.single('image'), aerial.addAerialHotspot);
router.put('/hotspots/:hotspotId', authenticateToken, isAdmin, upload.single('image'), aerial.updateAerialHotspot);
router.delete('/hotspots/:hotspotId', authenticateToken, isAdmin, aerial.deleteAerialHotspot);

module.exports = router;
