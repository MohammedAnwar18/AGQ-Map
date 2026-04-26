const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { isAdmin } = require('../middleware/adminAuth');
const upload = require('../middleware/upload');
const magazineController = require('../controllers/magazineController');

// Public Routes
router.get('/', magazineController.getMagazines);
router.get('/:id', magazineController.getMagazineById);

// Protected Admin Routes
router.use(authenticateToken);

router.get('/admin/all', isAdmin, magazineController.getAllMagazines);
router.post('/', isAdmin, magazineController.createMagazine);
router.put('/:id', isAdmin, magazineController.updateMagazine);
router.delete('/:id', isAdmin, magazineController.deleteMagazine);

router.post('/page', isAdmin, magazineController.savePage);
router.post('/upload', isAdmin, upload.single('image'), magazineController.uploadImage);
router.post('/:id/cover', isAdmin, upload.single('image'), magazineController.setCoverImage);

module.exports = router;
