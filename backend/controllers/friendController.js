const pool = require('../config/database');
const { createNotification } = require('./notificationController');

/**
 * إرسال طلب صداقة
 */
const sendFriendRequest = async (req, res) => {
    try {
        const senderId = req.user.id || req.user.userId;
        const { receiverId } = req.body;

        if (!receiverId) {
            return res.status(400).json({ error: 'Receiver ID is required' });
        }

        if (senderId === receiverId) {
            return res.status(400).json({ error: 'Cannot send friend request to yourself' });
        }

        // 1. التحقق من وجود صداقة حالية
        const existingFriendship = await pool.query(
            `SELECT * FROM friendships 
       WHERE (user1_id = $1 AND user2_id = $2) 
       OR (user1_id = $2 AND user2_id = $1)`,
            [Math.min(senderId, receiverId), Math.max(senderId, receiverId)]
        );

        if (existingFriendship.rows.length > 0) {
            return res.status(400).json({ error: 'Already friends' });
        }

        // 2. التحقق من وجود طلب معلق (في أي اتجاه)
        const pendingRequest = await pool.query(
            `SELECT * FROM friend_requests 
             WHERE ((sender_id = $1 AND receiver_id = $2) 
             OR (sender_id = $2 AND receiver_id = $1))
             AND status = 'pending'`,
            [senderId, receiverId]
        );

        if (pendingRequest.rows.length > 0) {
            return res.status(400).json({ error: 'Friend request already pending' });
        }

        // 3. التحقق من وجود سجل سابق (مرفوض أو مقبول قديماً) لنفس الاتجاه لتحديثه
        const existingRecord = await pool.query(
            `SELECT * FROM friend_requests 
             WHERE sender_id = $1 AND receiver_id = $2`,
            [senderId, receiverId]
        );

        let result;
        if (existingRecord.rows.length > 0) {
            // تحديث السجل القديم
            result = await pool.query(
                `UPDATE friend_requests 
                 SET status = 'pending', created_at = CURRENT_TIMESTAMP 
                 WHERE id = $1 
                 RETURNING id, sender_id, receiver_id, status, created_at`,
                [existingRecord.rows[0].id]
            );
        } else {
            // إنشاء طلب جديد
            result = await pool.query(
                `INSERT INTO friend_requests (sender_id, receiver_id, status)
                 VALUES ($1, $2, 'pending')
                 RETURNING id, sender_id, receiver_id, status, created_at`,
                [senderId, receiverId]
            );
        }

        // إنشاء إشعار
        await createNotification(receiverId, senderId, 'friend_request', null);

        res.status(201).json({
            message: 'Friend request sent successfully',
            request: result.rows[0]
        });
    } catch (error) {
        console.error('Send friend request error:', error);
        res.status(500).json({ error: 'Server error sending friend request' });
    }
};

/**
 * قبول طلب صداقة
 */
const acceptFriendRequest = async (req, res) => {
    let client;
    let requestDetails = null;

    try {
        client = await pool.connect();
        await client.query('BEGIN');

        const { requestId } = req.params;
        const userId = req.user.id || req.user.userId;

        // الحصول على الطلب
        const requestResult = await client.query(
            `SELECT * FROM friend_requests 
       WHERE id = $1 AND receiver_id = $2 AND status = 'pending'`,
            [requestId, userId]
        );

        if (requestResult.rows.length === 0) {
            await client.query('ROLLBACK');
            client.release();
            return res.status(404).json({ error: 'Friend request not found' });
        }

        const request = requestResult.rows[0];

        // تحديث حالة الطلب
        await client.query(
            `UPDATE friend_requests SET status = 'accepted', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
            [requestId]
        );

        // إضافة صداقة
        await client.query(
            `INSERT INTO friendships (user1_id, user2_id)
       VALUES ($1, $2)`,
            [Math.min(request.sender_id, request.receiver_id),
            Math.max(request.sender_id, request.receiver_id)]
        );

        await client.query('COMMIT');
        client.release(); 
        requestDetails = request;

    } catch (error) {
        if (client) {
            try { await client.query('ROLLBACK'); } catch (e) {}
            client.release();
        }
        console.error('Accept friend request error:', error);
        return res.status(500).json({ error: 'Server error accepting friend request' });
    }

    // إنشاء الإشعار خارج المعاملة
    try {
        if (requestDetails) {
            const userId = req.user.id || req.user.userId;
            await createNotification(requestDetails.sender_id, userId, 'friend_accepted', null);
        }
    } catch(e) {
        console.error('Failed to create notification', e);
    }

    res.json({ message: 'Friend request accepted' });
};

/**
 * رفض طلب صداقة
 */
const rejectFriendRequest = async (req, res) => {
    try {
        const { requestId } = req.params;
        const userId = req.user.id || req.user.userId;

        const result = await pool.query(
            `UPDATE friend_requests 
       SET status = 'rejected', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND receiver_id = $2 AND status = 'pending'
       RETURNING id`,
            [requestId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Friend request not found' });
        }

        res.json({ message: 'Friend request rejected' });
    } catch (error) {
        console.error('Reject friend request error:', error);
        res.status(500).json({ error: 'Server error rejecting friend request' });
    }
};

/**
 * قبول طلب صداقة باستخدام معرف المرسل (للإشعارات)
 */
const acceptBySender = async (req, res) => {
    let client;
    let requestDetails = null;

    try {
        client = await pool.connect();
        await client.query('BEGIN');

        const { senderId } = req.params;
        const userId = req.user.id || req.user.userId;

        // الحصول على الطلب
        const requestResult = await client.query(
            `SELECT * FROM friend_requests 
       WHERE sender_id = $1 AND receiver_id = $2 AND status = 'pending'`,
            [senderId, userId]
        );

        if (requestResult.rows.length === 0) {
            await client.query('ROLLBACK');
            client.release();
            return res.status(404).json({ error: 'Friend request not found' });
        }

        const request = requestResult.rows[0];

        // تحديث حالة الطلب
        await client.query(
            `UPDATE friend_requests SET status = 'accepted', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
            [request.id]
        );

        // إضافة صداقة
        await client.query(
            `INSERT INTO friendships (user1_id, user2_id)
       VALUES ($1, $2)`,
            [Math.min(request.sender_id, request.receiver_id),
            Math.max(request.sender_id, request.receiver_id)]
        );

        await client.query('COMMIT');
        client.release();
        requestDetails = request;

    } catch (error) {
        if (client) {
            try { await client.query('ROLLBACK'); } catch (e) {}
            client.release();
        }
        console.error('Accept friend request error:', error);
        return res.status(500).json({ error: 'Server error accepting friend request' });
    }

    // إنشاء الإشعار خارج المعاملة
    try {
        if (requestDetails) {
            const userId = req.user.id || req.user.userId;
            await createNotification(requestDetails.sender_id, userId, 'friend_accepted', null);
        }
    } catch(e) {
        console.error('Failed to create notification', e);
    }

    res.json({ message: 'Friend request accepted' });
};

/**
 * رفض طلب صداقة باستخدام معرف المرسل (للإشعارات)
 */
const rejectBySender = async (req, res) => {
    try {
        const { senderId } = req.params;
        const userId = req.user.id || req.user.userId;

        const result = await pool.query(
            `UPDATE friend_requests 
       SET status = 'rejected', updated_at = CURRENT_TIMESTAMP
       WHERE sender_id = $1 AND receiver_id = $2 AND status = 'pending'
       RETURNING id`,
            [senderId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Friend request not found' });
        }

        res.json({ message: 'Friend request rejected' });
    } catch (error) {
        console.error('Reject friend request error:', error);
        res.status(500).json({ error: 'Server error rejecting friend request' });
    }
};

/**
 * الحصول على طلبات الصداقة الواردة
 */
const getPendingRequests = async (req, res) => {
    try {
        const userId = req.user.id || req.user.userId;

        const result = await pool.query(
            `SELECT 
        fr.id, fr.sender_id, fr.created_at,
        u.username, u.full_name, u.profile_picture
       FROM friend_requests fr
       JOIN users u ON fr.sender_id = u.id
       WHERE fr.receiver_id = $1 AND fr.status = 'pending'
       ORDER BY fr.created_at DESC`,
            [userId]
        );

        res.json({ requests: result.rows });
    } catch (error) {
        console.error('Get pending requests error:', error);
        res.status(500).json({ error: 'Server error fetching requests' });
    }
};

/**
 * الحصول على قائمة الأصدقاء
 */
const getFriends = async (req, res) => {
    try {
        const userId = req.user.id || req.user.userId;

        const result = await pool.query(
            `SELECT 
        u.id, u.username, u.full_name, u.bio, u.profile_picture, u.is_online, u.last_seen,
        CASE 
            WHEN f.user1_id = $1 THEN f.user1_shares_location
            ELSE f.user2_shares_location
        END as am_i_sharing,
        CASE 
            WHEN f.user1_id = $1 THEN f.user2_shares_location
            ELSE f.user1_shares_location
        END as is_sharing_with_me,
        CASE 
            WHEN ((f.user1_id = $1 AND f.user2_shares_location) OR (f.user2_id = $1 AND f.user1_shares_location))
            THEN u.last_latitude 
            ELSE NULL 
        END as last_latitude,
        CASE 
            WHEN ((f.user1_id = $1 AND f.user2_shares_location) OR (f.user2_id = $1 AND f.user1_shares_location))
            THEN u.last_longitude 
            ELSE NULL 
        END as last_longitude
       FROM users u
       JOIN friendships f ON (
         (f.user1_id = $1 AND f.user2_id = u.id) OR
         (f.user2_id = $1 AND f.user1_id = u.id)
       )
       ORDER BY u.is_online DESC, u.last_seen DESC`,
            [userId]
        );

        res.json({ friends: result.rows });
    } catch (error) {
        console.error('Get friends error:', error);
        res.status(500).json({ error: 'Server error fetching friends' });
    }
};

/**
 * إلغاء الصداقة
 */
const removeFriend = async (req, res) => {
    try {
        const userId = req.user.id || req.user.userId;
        const { friendId } = req.params;

        // 1. حذف الصداقة
        const result = await pool.query(
            `DELETE FROM friendships 
       WHERE (user1_id = $1 AND user2_id = $2) OR (user1_id = $2 AND user2_id = $1)
       RETURNING id`,
            [Math.min(userId, friendId), Math.max(userId, friendId)]
        );

        // 2. حذف طلبات الصداقة المرتبطة (لمنع بقاء سجلات قديمة)
        await pool.query(
            `DELETE FROM friend_requests 
             WHERE (sender_id = $1 AND receiver_id = $2) 
             OR (sender_id = $2 AND receiver_id = $1)`,
            [userId, friendId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Friendship not found' });
        }

        res.json({ message: 'Friend removed successfully' });
    } catch (error) {
        console.error('Remove friend error:', error);
        res.status(500).json({ error: 'Server error removing friend' });
    }
};

/**
 * تبديل مشاركة الموقع مع صديق
 */
const toggleLocationSharing = async (req, res) => {
    try {
        const userId = req.user.id || req.user.userId;
        const { friendId } = req.params;

        // Determine if current user is user1 or user2 in the relationship
        // We need to update the correct column based on IDs
        // user1_id is always the smaller ID in our insertion logic, let's respect that.

        const minId = Math.min(userId, friendId);
        const maxId = Math.max(userId, friendId);

        const isUser1 = (userId == minId);

        let query;
        if (isUser1) {
            query = `UPDATE friendships 
                     SET user1_shares_location = NOT user1_shares_location 
                     WHERE user1_id = $1 AND user2_id = $2 
                     RETURNING user1_shares_location as is_sharing`;
        } else {
            query = `UPDATE friendships 
                     SET user2_shares_location = NOT user2_shares_location 
                     WHERE user1_id = $1 AND user2_id = $2 
                     RETURNING user2_shares_location as is_sharing`;
        }

        const result = await pool.query(query, [minId, maxId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Friendship not found' });
        }

        res.json({
            message: 'Location sharing updated',
            isSharing: result.rows[0].is_sharing
        });

    } catch (error) {
        console.error('Toggle location sharing error:', error);
        res.status(500).json({ error: 'Server error updating location sharing' });
    }
};

module.exports = {
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    getPendingRequests,
    getFriends,
    removeFriend,
    toggleLocationSharing,
    acceptBySender,
    rejectBySender
};
