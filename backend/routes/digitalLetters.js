const express = require('express');
const router = express.Router();
const digitalLetterController = require('../controllers/digitalLetterController');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Public route to view a letter by slug
router.get('/slug/:slug', digitalLetterController.getLetterBySlug);

// Admin-only routes
router.get('/', authenticateToken, isAdmin, digitalLetterController.getAllLetters);

router.post(
    '/',
    authenticateToken,
    isAdmin,
    upload.fields([
        { name: 'image', maxCount: 1 },
        { name: 'music', maxCount: 1 }
    ]),
    digitalLetterController.createLetter
);

router.put(
    '/:id',
    authenticateToken,
    isAdmin,
    upload.fields([
        { name: 'image', maxCount: 1 },
        { name: 'music', maxCount: 1 }
    ]),
    digitalLetterController.updateLetter
);

router.delete('/:id', authenticateToken, isAdmin, digitalLetterController.deleteLetter);

module.exports = router;
