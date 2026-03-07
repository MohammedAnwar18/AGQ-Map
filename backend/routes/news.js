const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');

const { authenticateToken, isAdmin } = require('../middleware/auth');
const newsController = require('../controllers/newsController');

// Admin creates news
router.post('/', authenticateToken, isAdmin, upload.single('image'), newsController.createNews);

// Everyone can read news near a location
router.get('/', newsController.getNews);

module.exports = router;
