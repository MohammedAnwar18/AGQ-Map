const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { authenticateToken } = require('../middleware/auth');
const { isAdmin } = require('../middleware/adminAuth');
const { getDetections, saveDetection } = require('../controllers/orbisController');

// All Orbis routes require authentication and admin role
router.use(authenticateToken);
router.use(isAdmin);

/**
 * @route   GET /api/orbis/detections
 * @desc    Fetch historical camera detections
 * @access  Private (Admin Only)
 */
router.get('/detections', getDetections);

/**
 * @route   POST /api/orbis/detections
 * @desc    Save a camera detection event
 * @access  Private (Admin Only)
 */
router.post('/detections', upload.single('image'), saveDetection);

module.exports = router;
