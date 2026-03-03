const express = require('express');
const router = express.Router();
const { uploadCloud } = require('../config/cloudinary');

const { authenticateToken, isAdmin } = require('../middleware/auth');
const newsController = require('../controllers/newsController');

// Admin creates news
router.post('/', authenticateToken, isAdmin, uploadCloud.single('image'), newsController.createNews);

// Everyone can read news near a location
router.get('/', newsController.getNews);

module.exports = router;
