const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const ctrl = require('../controllers/rasterController');

/* طبقات الراستر.

   البلاطات تُرفع دفعاتٍ بأسماء حقول تحمل مواضعها، فنحتاج ‎any()‎
   لا ‎fields()‎: أسماء الحقول تختلف في كل دفعة.

   وحدّ البلاطة مليونان — أكبر بكثير من بلاطة ‎WebP‎ حقيقية، وأصغر
   بكثير من أن يُستعمل المسار لرفع ملفّ كامل. */
const tiles = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024, files: 40 },
    fileFilter: (req, file, cb) => cb(null, file.mimetype.startsWith('image/'))
});

/* البلاطة عامّة بلا حساب: ‎MapLibre‎ يطلبها بوسم صورة داخلي لا
   يحمل ترويسة تخويل. وهي أوّل مسار لأنّه الأكثر طلباً. */
router.get('/:id/:z/:x/:y', ctrl.getTile);

// القائمة: الخريطة تقرأ الجاهز المرئي، والأدمن يقرأ الكلّ بـ ‎?all=true‎
router.get('/', optionalAuth, ctrl.listRasters);

// البناء والإدارة — للأدمن العام، والفحص داخل المتحكّم
router.post('/', authenticateToken, ctrl.createRaster);
router.post('/:id/tiles', authenticateToken, tiles.any(), ctrl.putTiles);
router.post('/:id/finish', authenticateToken, ctrl.finishRaster);
router.patch('/:id', authenticateToken, ctrl.updateRaster);
router.delete('/:id', authenticateToken, ctrl.deleteRaster);

module.exports = router;
