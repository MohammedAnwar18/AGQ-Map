const express = require('express');
const router = express.Router();
const storageController = require('../controllers/storageController');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');

// مسارات التخزين والاستيراد القديمة
router.post('/upload', auth.authenticateToken, storageController.uploadGeoJSON);
router.post('/presigned-url', auth.authenticateToken, storageController.getPresignedUrl);
router.post('/import-arcgis', auth.authenticateToken, storageController.importArcGIS);

// مسارات مستودع بالنوفا (PalNovaa Repository)
router.get('/layers', storageController.getLayers);
router.post('/layers', auth.authenticateToken, upload.single('file'), storageController.uploadRepositoryLayer);
router.put('/layers/:id', auth.authenticateToken, upload.single('file'), storageController.updateRepositoryLayer);
router.delete('/layers/:id', auth.authenticateToken, storageController.deleteRepositoryLayer);

// بروكسي عام لجلب بيانات GeoJSON من R2 مع ضبط CORS تلقائياً
router.get('/proxy', storageController.proxyGeoJSON);

module.exports = router;
