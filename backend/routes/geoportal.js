const express = require('express');
const router = express.Router();
const multer = require('multer');
const geoportalController = require('../controllers/geoportalController');
const { authenticateToken, isAdmin } = require('../middleware/auth');

// Configure Multer for memory buffer upload (GeoJSON)
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB max GeoJSON
});

// Optional Auth middleware helper
const optionalAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const jwt = require('jsonwebtoken');
        const token = authHeader.split(' ')[1];
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
            req.user = decoded;
        } catch (e) {
            req.user = { role: 'guest' };
        }
    } else {
        req.user = { role: 'guest' };
    }
    next();
};

// ----------------------------------------------------
// Public & Resolver Endpoints
// ----------------------------------------------------
router.get('/public/resolve', geoportalController.resolvePublicPortal);
router.get('/public/layers/:layerId/features', optionalAuth, geoportalController.getLayerFeatures);

// ----------------------------------------------------
// Admin Management Endpoints
// ----------------------------------------------------
router.get('/', geoportalController.getAllGeoportals);
router.get('/:idOrSlug', geoportalController.getGeoportalById);

router.post('/', authenticateToken, isAdmin, geoportalController.createGeoportal);
router.put('/:id', authenticateToken, isAdmin, geoportalController.updateGeoportal);
router.delete('/:id', authenticateToken, isAdmin, geoportalController.deleteGeoportal);

// Spatial Layer Operations
router.post('/:id/logo', authenticateToken, isAdmin, upload.single('logo'), geoportalController.uploadLogo);
router.post('/:id/layers', authenticateToken, isAdmin, upload.single('file'), geoportalController.uploadLayer);
router.patch('/layers/:layerId/style', authenticateToken, isAdmin, geoportalController.updateLayerStyle);
router.delete('/layers/:layerId', authenticateToken, isAdmin, geoportalController.deleteLayer);

module.exports = router;
