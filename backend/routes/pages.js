const express = require('express');
const router = express.Router();
const pageController = require('../controllers/pageController');
const { authenticateToken } = require('../middleware/auth');

// Public route to view a page
router.get('/view/:slug', pageController.getPageBySlug);

// Protected routes for management
router.post('/save', authenticateToken, pageController.savePage);
router.get('/my-pages', authenticateToken, pageController.getMyPages);

module.exports = router;
