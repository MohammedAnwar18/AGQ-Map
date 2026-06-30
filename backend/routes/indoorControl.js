const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/indoorControlController');
const { authenticateToken } = require('../middleware/auth');

// جلب قائمة المباني
router.get('/buildings', authenticateToken, ctrl.getBuildings);

// إنشاء مبنى جديد
router.post('/buildings', authenticateToken, ctrl.createBuilding);

// تحديث بيانات المبنى (الإحداثيات، الاسم، إلخ)
router.put('/buildings/:buildingId', authenticateToken, ctrl.updateBuilding);

// جلب التصميم الكامل للمبنى (الرفوف، المستويات، والمنتجات)
router.get('/layout/:buildingId', authenticateToken, ctrl.getLayout);

// حفظ أو تحديث تصميم الرفوف والمخطط
router.post('/layout/save', authenticateToken, ctrl.saveLayout);

// تحديث كمية المخزون لمنتج على رف محدد
router.put('/stock/:placementId', authenticateToken, ctrl.updateStock);

// إنشاء مهمة جديدة للموظف
router.post('/tasks', authenticateToken, ctrl.createTask);

// جلب قائمة المهام
router.get('/tasks', authenticateToken, ctrl.getTasks);

// تحديث حالة المهمة (قيد التنفيذ، مكتملة)
router.put('/tasks/:taskId', authenticateToken, ctrl.updateTaskStatus);

// تسجيل عمليات مسح الـ QR والتحركات الداخلية
router.post('/log', authenticateToken, ctrl.logScan);

// تحديث المجسمات ثلاثية الأبعاد للمبنى
router.put('/buildings/:buildingId/shapes', authenticateToken, ctrl.updateBuildingShapes);

module.exports = router;
