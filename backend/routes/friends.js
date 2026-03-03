const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const {
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    getPendingRequests,
    getFriends,
    removeFriend,
    toggleLocationSharing
} = require('../controllers/friendController');

// إرسال طلب صداقة (محمي)
router.post('/request', authenticateToken, sendFriendRequest);

// قبول طلب صداقة (محمي)
router.post('/request/:requestId/accept', authenticateToken, acceptFriendRequest);

// رفض طلب صداقة (محمي)
router.post('/request/:requestId/reject', authenticateToken, rejectFriendRequest);

// الحصول على الطلبات الواردة (محمي)
router.get('/requests/pending', authenticateToken, getPendingRequests);

// الحصول على قائمة الأصدقاء (محمي)
router.get('/', authenticateToken, getFriends);

// إلغاء صداقة (محمي)
router.delete('/:friendId', authenticateToken, removeFriend);

// تبديل مشاركة الموقع (محمي)
// تبديل مشاركة الموقع (محمي)
router.post('/:friendId/location-sharing', authenticateToken, toggleLocationSharing);

// إعداد Multer لرفع صور المحادثة
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'uploads/';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'chat-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only images are allowed'));
        }
    }
});

// رفع صورة للمحادثة
router.post('/upload-image', authenticateToken, upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    // Return relative path for frontend usage
    const imageUrl = `/uploads/${req.file.filename}`;
    res.json({ imageUrl });
});

module.exports = router;
