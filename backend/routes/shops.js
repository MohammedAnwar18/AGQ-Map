const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const shopController = require('../controllers/shopController');

// All routes require auth
router.use(authenticateToken);

router.get('/search', shopController.searchShops);
router.get('/following', shopController.getFollowedShops);
router.post('/:id/follow', shopController.followShop);
router.delete('/:id/follow', shopController.unfollowShop);

// Temporary Admin Create Route
router.post('/', shopController.createShop);

// Use Cloudinary for file uploads
const { uploadCloud } = require('../config/cloudinary');

// Shop Profile & Posts
router.get('/:id', shopController.getShopProfile);
router.put('/:id', shopController.updateShopProfile);
router.put('/:id/images', uploadCloud.fields([{ name: 'profile_picture', maxCount: 1 }, { name: 'cover_picture', maxCount: 1 }]), shopController.updateShopImages);

router.post('/:id/posts', uploadCloud.array('images', 5), shopController.createShopPost);

// Shop Products
router.post('/:id/products', uploadCloud.single('image'), shopController.addProduct);
router.put('/:id/products/:productId', uploadCloud.single('image'), shopController.updateProduct);
router.delete('/:id/products/:productId', shopController.deleteProduct);

// Ownership Delegation & Management
router.post('/:id/assign-owner', shopController.assignShopOwner); // Admin only
router.delete('/:id/owner', shopController.removeShopOwner); // Admin only
router.get('/managed/mine', shopController.getManagedShops); // Get shops owned by me
router.post('/:id/notify', shopController.sendNotificationToFollowers);

// Drivers (Taxi)
router.get('/:id/drivers', shopController.getShopDrivers);
router.post('/:id/drivers', shopController.addShopDriver);
router.delete('/:id/drivers/:driverId', shopController.removeShopDriver);

// Taxi Requests
router.post('/:id/request', shopController.requestTaxi);
router.get('/:id/requests', shopController.getShopRequests);
router.put('/requests/:requestId', shopController.updateRequestStatus);

module.exports = router;
