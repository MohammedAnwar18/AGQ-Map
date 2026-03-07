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
    createAdminPost
} = require('../controllers/adminController');

const upload = require('../middleware/upload');

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

module.exports = router;
