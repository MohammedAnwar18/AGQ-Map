const express = require('express');
const router = express.Router();
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const ctrl = require('../controllers/arModelController');

// عام: صفحة المجسّم تفتح بمسح الرمز بلا حساب
router.get('/public/:slug', optionalAuth, ctrl.getModelBySlug);

// إدارة: الأدمن العام فقط (الفحص داخل المتحكّم)
router.get('/', authenticateToken, ctrl.listModels);
router.post('/upload-url', authenticateToken, ctrl.getModelUploadUrl);
router.post('/', authenticateToken, ctrl.createModel);
router.put('/:id', authenticateToken, ctrl.updateModel);
router.delete('/:id', authenticateToken, ctrl.deleteModel);

module.exports = router;
