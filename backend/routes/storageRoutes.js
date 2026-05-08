const express = require('express');
const router = express.Router();
const storageController = require('../controllers/storageController');
const auth = require('../middleware/auth'); // نفترض وجود ميدلوير للمصادقة

// مسارات التخزين والاستيراد
router.post('/upload', auth, storageController.uploadGeoJSON);
router.post('/import-arcgis', auth, storageController.importArcGIS);

module.exports = router;
