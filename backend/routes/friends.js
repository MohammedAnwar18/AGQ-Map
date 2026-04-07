const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const {
    sendFriendRequest,
    cancelFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    getPendingRequests,
    getFriends,
    removeFriend,
    toggleLocationSharing,
    acceptBySender,
    rejectBySender
} = require('../controllers/friendController');

// إرسال طلب صداقة (محمي)
router.post('/request', authenticateToken, sendFriendRequest);

// إلغاء طلب صداقة أُرسل (من طرف المرسل)
router.delete('/request/cancel/:receiverId', authenticateToken, cancelFriendRequest);

// قبول طلب صداقة (محمي)
router.post('/request/:requestId/accept', authenticateToken, acceptFriendRequest);

// قبول طلب صداقة بمعرف المرسل (محمي)
router.post('/request/sender/:senderId/accept', authenticateToken, acceptBySender);

// رفض طلب صداقة (محمي)
router.post('/request/:requestId/reject', authenticateToken, rejectFriendRequest);

// رفض طلب صداقة بمعرف المرسل (محمي)
router.post('/request/sender/:senderId/reject', authenticateToken, rejectBySender);

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
