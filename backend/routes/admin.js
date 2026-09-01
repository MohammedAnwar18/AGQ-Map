const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { authenticateToken } = require('../middleware/auth');
const { isAdmin } = require('../middleware/adminAuth');
const {
    getDashboardStats,
    getAllUsers,
    getUserDetails,
    deleteUser,
    toggleUserStatus,
    getAllPosts,
    deletePost,
    createAdminPost,
    getAllShops,
    deleteShop,
    toggleShopStatus,
    toggleShopLock,
    setShopCoverVideo,
    sendAdminNotification,
    getOrganizationItems,
    updateOrganizationItem,
    getAllEventPhotos,
    deleteEventPhoto
} = require('../controllers/adminController');

const upload = require('../middleware/upload');

const {
    getAllPeople,
    getPersonDetails,
    createPerson,
    updatePerson,
    deletePerson,
    addPersonPhotos,
    deletePersonPhoto,
    searchByImage
} = require('../controllers/faceController');

// صور التعرف على الوجوه: حد 10 ميجابايت لكل صورة كما طُلب
const faceUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Only images are allowed'), false);
    }
});

// جميع الـ routes محمية بـ authenticateToken و isAdmin
router.use(authenticateToken);
router.use(isAdmin);

// Dashboard Stats
router.get('/stats', getDashboardStats);

// User Management
router.get('/users', getAllUsers);
router.get('/users/:userId', getUserDetails);
router.delete('/users/:userId', deleteUser);
router.patch('/users/:userId/status', toggleUserStatus);

// Post Management
router.get('/posts', getAllPosts);
router.delete('/posts/:postId', deletePost);
router.post('/posts', upload.single('image'), createAdminPost);

// Shop Management
router.get('/shops', getAllShops);
router.delete('/shops/:shopId', deleteShop);
router.patch('/shops/:shopId/status', toggleShopStatus);
router.patch('/shops/:shopId/lock', toggleShopLock);
router.patch('/shops/:shopId/cover-video', setShopCoverVideo);

// Organization Management (Size, Zoom Controls)
router.get('/organization-items', getOrganizationItems);
router.put('/organization-items/:type/:id', updateOrganizationItem);

// Event Photo Gallery Management
router.get('/event-photos', getAllEventPhotos);
router.delete('/event-photos/:photoId', deleteEventPhoto);

// Admin Notifications
router.post('/notifications/send', sendAdminNotification);

// Face Recognition — People Registry
router.get('/face/people', getAllPeople);
router.get('/face/people/:id', getPersonDetails);
router.post('/face/people', faceUpload.array('photos', 5), createPerson);
router.put('/face/people/:id', updatePerson);
router.delete('/face/people/:id', deletePerson);
router.post('/face/people/:id/photos', faceUpload.array('photos', 5), addPersonPhotos);
router.delete('/face/photos/:photoId', deletePersonPhoto);

// Face Recognition — Search by Image
router.post('/face/search', faceUpload.single('image'), searchByImage);

module.exports = router;
