const express = require('express');
const router = express.Router();
const { authenticateToken, optionalAuth, isAdmin } = require('../middleware/auth');
const shopController = require('../controllers/shopController');
const upload = require('../middleware/upload');

// ============================================================
// المسارات التي تتطلب مصادقة إلزامية (كتابة / حساسة)
// ============================================================

// متابعة / إلغاء متابعة محل
router.post('/:id/follow', authenticateToken, shopController.followShop);
router.delete('/:id/follow', authenticateToken, shopController.unfollowShop);

// المحلات المتابَعة (خاصة بالمستخدم)
router.get('/following', authenticateToken, shopController.getFollowedShops);

// المحلات المُدارة (خاصة بالمستخدم)
router.get('/managed/mine', authenticateToken, shopController.getManagedShops);

// إنشاء محل جديد
router.post('/', authenticateToken, shopController.createShop);

// تعديل / حذف المحل
router.put('/:id', authenticateToken, shopController.updateShopProfile);
router.delete('/:id', authenticateToken, isAdmin, shopController.deleteShop);
router.put('/:id/images', authenticateToken, upload.fields([{ name: 'profile_picture', maxCount: 1 }, { name: 'cover_picture', maxCount: 1 }]), shopController.updateShopImages);

// المنشورات (إنشاء / حذف)
router.post('/:id/posts', authenticateToken, upload.array('images', 5), shopController.createShopPost);
router.delete('/:id/posts/:postId', authenticateToken, shopController.deleteShopPost);

// المنتجات
router.post('/:id/products', authenticateToken, upload.array('images', 5), shopController.addProduct);
router.put('/:id/products/:productId', authenticateToken, upload.array('images', 5), shopController.updateProduct);
router.delete('/:id/products/:productId', authenticateToken, shopController.deleteProduct);

// إدارة الملكية
router.post('/:id/assign-owner', authenticateToken, shopController.assignShopOwner);
router.delete('/:id/owner', authenticateToken, shopController.removeShopOwner);
router.post('/:id/notify', authenticateToken, shopController.sendNotificationToFollowers);

// السائقون
router.post('/:id/drivers', authenticateToken, shopController.addShopDriver);
router.delete('/:id/drivers/:driverId', authenticateToken, shopController.removeShopDriver);

// طلبات التاكسي (إنشاء / تحديث)
router.post('/:id/request', authenticateToken, shopController.requestTaxi);
router.put('/requests/:requestId', authenticateToken, shopController.updateRequestStatus);
router.post('/request-nearest', authenticateToken, shopController.requestNearestTaxi);

// طلبات السائق الشخصية
router.get('/driver/my-requests', authenticateToken, shopController.getDriverRequests);

// التفاعلات (إعجاب / تعليق)
router.post('/posts/:postId/like', authenticateToken, shopController.togglePostLike);
router.post('/posts/:postId/comments', authenticateToken, shopController.addPostComment);

// المرافق الجامعية (إضافة)
router.post('/:id/facilities', authenticateToken, shopController.addUniversityFacility);
router.post('/facilities/:facilityId/posts', authenticateToken, upload.array('images', 5), shopController.addFacilityPost);
router.post('/facilities/:facilityId/specialties', authenticateToken, shopController.addCollegeSpecialty);
// المرافق الجامعية (حذف وتعديل - للأدمن والمسؤول)
router.delete('/facilities/:facilityId', authenticateToken, shopController.deleteUniversityFacility);
router.put('/facilities/:facilityId', authenticateToken, shopController.renameUniversityFacility);

// عناصر البلدية (إضافة / حذف)
router.post('/:id/municipality-items', authenticateToken, upload.single('image'), shopController.addMunicipalityItem);
router.delete('/municipality-items/:itemId', authenticateToken, shopController.deleteMunicipalityItem);

// ============================================================
// المسارات العامة (قراءة فقط - auth اختياري)
// ============================================================

// البحث عن محلات (عام)
router.get('/search', optionalAuth, shopController.searchShops);

// ملف المحل (عام)
router.get('/:id', optionalAuth, shopController.getShopProfile);

// السائقون (عرض - عام)
router.get('/:id/drivers', optionalAuth, shopController.getShopDrivers);

// طلبات التاكسي (عرض)
router.get('/:id/requests', authenticateToken, shopController.getShopRequests);

// المرافق الجامعية (عرض - عام)
router.get('/:id/facilities', optionalAuth, shopController.getUniversityFacilities);
router.get('/facilities/:facilityId', optionalAuth, shopController.getFacilityProfile);

// التعليقات (عرض - عام)
router.get('/posts/:postId/comments', optionalAuth, shopController.getPostComments);

// عناصر البلدية (عرض - عام)
router.get('/:id/municipality-items', optionalAuth, shopController.getMunicipalityItems);

module.exports = router;

