const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { authenticateToken } = require('../middleware/auth');
const ctrl = require('../controllers/nexusController');

/* بالنوفا نكسس.

   كل المسارات تطلب حساباً — القسم لأصحاب المحلّات لا للزوّار.
   وفحص «أدمن» داخل المتحكّم كما في بقيّة المشروع، فتكون رسالة
   الرفض عربية ومفهومة لا 403 صامتة. */

/* مصغّرة منتج — بلا حساب، لأنّ وسم ‎<img>‎ لا يحمل ترويسة تخويل.
   وهو أوّل مسار لأنّه الأكثر طلباً: مرّة لكل بطاقة */
router.get('/products/:id/thumb', ctrl.getProductThumb);

// العرض: لكل صاحب حساب
router.get('/', authenticateToken, ctrl.getCatalog);
router.get('/shops/:shopId/categories', authenticateToken, ctrl.getShopCategories);

// النسخ إلى محلّ: لصاحب المحلّ
router.post('/products/:id/adopt', authenticateToken, ctrl.adoptProduct);
/* دفعة واحدة. لا يتعارض مع المسار أعلاه: ذاك ثلاثة مقاطع وهذا
   مقطعان، فلا يُقرأ «adopt-many» معرّفاً بحال */
router.post('/products/adopt-many', authenticateToken, ctrl.adoptMany);

// بناء الكتالوج: للأدمن العام وحده
router.post('/categories', authenticateToken, upload.single('image'), ctrl.addCategory);
router.put('/categories/:id', authenticateToken, upload.single('image'), ctrl.updateCategory);
router.delete('/categories/:id', authenticateToken, ctrl.deleteCategory);

router.post('/products', authenticateToken, upload.array('images', 5), ctrl.addProduct);
router.put('/products/:id', authenticateToken, upload.array('images', 5), ctrl.updateProduct);
router.delete('/products/:id', authenticateToken, ctrl.deleteProduct);

module.exports = router;
