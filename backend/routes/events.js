const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const upload = require('../middleware/upload');

// Public endpoints (Accessible by guest/anonymous users visiting via QR)
router.get('/photos/:eventSlug', eventController.getEventPhotos);
router.post('/upload', upload.single('image'), eventController.uploadEventPhoto);

module.exports = router;
