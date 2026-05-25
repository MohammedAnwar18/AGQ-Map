const express = require('express');
const router = express.Router();
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const cameraController = require('../controllers/cameraController');

// Get all cameras (public)
router.get('/', optionalAuth, cameraController.getAllCameras);

// Create a new camera (authenticated)
router.post('/', authenticateToken, cameraController.createCamera);

// Delete a camera (authenticated: creator or admin)
router.delete('/:id', authenticateToken, cameraController.deleteCamera);

// Update a camera (authenticated: creator or admin)
router.put('/:id', authenticateToken, cameraController.updateCamera);

module.exports = router;
