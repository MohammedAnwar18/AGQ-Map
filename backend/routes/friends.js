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

const upload = require('../middleware/upload');
const { uploadToSupabase } = require('../utils/storage');

// رفع صورة للمحادثة
router.post('/upload-image', authenticateToken, upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // رفع لـ Supabase بدلاً من Cloudinary
        const imageUrl = await uploadToSupabase(req.file.buffer, req.file.originalname, req.file.mimetype);
        res.json({ imageUrl });
    } catch (error) {
        console.error('Chat image upload error:', error);
        res.status(500).json({ error: 'Failed to upload image' });
    }
});

module.exports = router;
