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

const { uploadCloud } = require('../config/cloudinary');

// رفع صورة للمحادثة
router.post('/upload-image', authenticateToken, uploadCloud.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    // Return cloudinary url
    const imageUrl = req.file.path;
    res.json({ imageUrl });
});

module.exports = router;
