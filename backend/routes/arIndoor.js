const express = require('express');
const router = express.Router();
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const ctrl = require('../controllers/arIndoorController');

/* خرائط الواقع المعزّز الداخلية.

   مسار واحد مفتوح — الخريطة برابط المشاركة — والباقي للأدمن
   العام وحده، والفحص داخل المتحكّم كما في بقيّة المشروع. */

// عام: من يفتح الرابط يمشي بلا حساب
router.get('/public/:slug', optionalAuth, ctrl.getPublicVenue);

// إدارة
router.get('/', authenticateToken, ctrl.listVenues);
router.post('/', authenticateToken, ctrl.createVenue);
router.get('/:id', authenticateToken, ctrl.getVenue);
router.put('/:id', authenticateToken, ctrl.updateVenue);
router.put('/:id/map', authenticateToken, ctrl.saveMap);
router.delete('/:id', authenticateToken, ctrl.deleteVenue);

module.exports = router;
