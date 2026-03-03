const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const newsController = require('../controllers/newsController');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'news-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only images are allowed'));
        }
    }
});

// Admin creates news
router.post('/', authenticateToken, isAdmin, upload.single('image'), newsController.createNews);

// Everyone can read news near a location
router.get('/', newsController.getNews);

module.exports = router;
