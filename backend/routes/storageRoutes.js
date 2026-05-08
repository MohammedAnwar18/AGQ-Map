const express = require('express');
const router = express.Router();
const storageController = require('../controllers/storageController');
const auth = require('../middleware/auth'); // نفترض وجود ميدلوير للمصادقة

// مسارات التخزين والاستيراد
router.post('/upload', auth.authenticateToken, storageController.uploadGeoJSON);
router.post('/import-arcgis', auth.authenticateToken, storageController.importArcGIS);

module.exports = router;
