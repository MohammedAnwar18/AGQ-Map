const express = require('express');
const router = express.Router();
const cadrev = require('../controllers/cadrevController');

// أداة عامّة بلا مصادقة مستخدم؛ كلمة المرور تحمي المشروع نفسه.
router.post('/publish', cadrev.publish);
router.get('/:id/meta', cadrev.meta);
router.post('/:id/open', cadrev.open);

module.exports = router;
