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

// Multer configuration for admin posts
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'admin-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) {
            cb(null, true);
        } else {
            cb(new Error('Only images are allowed'));
        }
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

module.exports = router;
