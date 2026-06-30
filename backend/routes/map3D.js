const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/map3DController');
const { authenticateToken } = require('../middleware/auth');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

// Get all 3D models
router.get('/', authenticateToken, ctrl.getModels);

// Upload a new 3D model
router.post('/', authenticateToken, upload.single('file'), ctrl.uploadModel);

// Update a 3D model
router.put('/:id', authenticateToken, ctrl.updateModel);

// Delete a 3D model
router.delete('/:id', authenticateToken, ctrl.deleteModel);

module.exports = router;
