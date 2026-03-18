const express = require('express');
const router = express.Router();
const { authenticateToken, isAdmin } = require('../middleware/auth');
const shopController = require('../controllers/shopController');

// All routes require auth
router.use(authenticateToken);

router.get('/search', shopController.searchShops);
router.get('/following', shopController.getFollowedShops);
router.post('/:id/follow', shopController.followShop);
router.delete('/:id/follow', shopController.unfollowShop);

// Temporary Admin Create Route
router.post('/', shopController.createShop);

// Use Memory Storage for Supabase
const upload = require('../middleware/upload');

// Shop Profile & Posts
router.get('/:id', shopController.getShopProfile);
router.put('/:id', shopController.updateShopProfile);
router.delete('/:id', isAdmin, shopController.deleteShop);
router.put('/:id/images', upload.fields([{ name: 'profile_picture', maxCount: 1 }, { name: 'cover_picture', maxCount: 1 }]), shopController.updateShopImages);

router.post('/:id/posts', upload.array('images', 5), shopController.createShopPost);
router.delete('/:id/posts/:postId', shopController.deleteShopPost);

// Shop Products
router.post('/:id/products', upload.single('image'), shopController.addProduct);
router.put('/:id/products/:productId', upload.single('image'), shopController.updateProduct);
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

// University Facilities
router.get('/:id/facilities', shopController.getUniversityFacilities);
router.post('/:id/facilities', shopController.addUniversityFacility);
router.get('/facilities/:facilityId', shopController.getFacilityProfile);
router.post('/facilities/:facilityId/posts', upload.array('images', 5), shopController.addFacilityPost);
router.post('/facilities/:facilityId/specialties', shopController.addCollegeSpecialty);

// Post Interactions
router.post('/posts/:postId/like', shopController.togglePostLike);
router.get('/posts/:postId/comments', shopController.getPostComments);
router.post('/posts/:postId/comments', shopController.addPostComment);

module.exports = router;
