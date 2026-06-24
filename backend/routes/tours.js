const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { isAdmin } = require('../middleware/adminAuth');
const upload = require('../middleware/upload');
const {
    getAllTours,
    createTour,
    deleteTour,
    proxyImage
} = require('../controllers/tourController');

// Public route to fetch all tours
router.get('/', getAllTours);

// Public proxy route to fetch cloud storage images without CORS errors
router.get('/proxy', proxyImage);

// Admin-only routes
router.post('/', authenticateToken, isAdmin, upload.single('image'), createTour);
router.delete('/:id', authenticateToken, isAdmin, deleteTour);

module.exports = router;
