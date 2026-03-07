const pool = require('../config/database');

/**
 * البحث عن المستخدمين
 */
const searchUsers = async (req, res) => {
    try {
        const { query } = req.query;
        const currentUserId = req.user.id || req.user.userId;

        if (!query || query.trim().length < 2) {
            return res.status(400).json({ error: 'Search query must be at least 2 characters' });
        }

        const searchPattern = `%${query}%`;

        const result = await pool.query(
            `SELECT 
        u.id, u.username, u.full_name, u.bio, u.profile_picture,
        CASE 
          WHEN f.id IS NOT NULL THEN true 
          ELSE false 
        END as is_friend,
        CASE 
          WHEN fr.id IS NOT NULL AND fr.status = 'pending' THEN true 
          ELSE false 
        END as has_pending_request
      FROM users u
      LEFT JOIN friendships f ON (
        (f.user1_id = $2 AND f.user2_id = u.id) OR
        (f.user2_id = $2 AND f.user1_id = u.id)
      )
      LEFT JOIN friend_requests fr ON (
        (fr.sender_id = $2 AND fr.receiver_id = u.id AND fr.status = 'pending') OR
        (fr.receiver_id = $2 AND fr.sender_id = u.id AND fr.status = 'pending')
      )
      WHERE (u.username ILIKE $1 OR u.full_name ILIKE $1)
      AND u.id != $2
      LIMIT 20`,
            [searchPattern, currentUserId]
        );

        res.json({ users: result.rows });
    } catch (error) {
        console.error('Search users error:', error);
        res.status(500).json({ error: 'Server error searching users' });
    }
};

/**
 * الحصول على ملف مستخدم
 */
const getUserProfile = async (req, res) => {
    try {
        const { userId } = req.params;
        const currentUserId = req.user.id || req.user.userId;

        const result = await pool.query(
            `SELECT 
        u.id, u.username, u.full_name, u.bio, u.profile_picture, u.created_at, u.date_of_birth, u.gender,
        CASE 
          WHEN f.id IS NOT NULL THEN true 
          ELSE false 
        END as is_friend,
        EXISTS(SELECT 1 FROM friend_requests WHERE (sender_id = $2 AND receiver_id = u.id AND status = 'pending') OR (sender_id = u.id AND receiver_id = $2 AND status = 'pending')) as has_pending_request
      FROM users u
      LEFT JOIN friendships f ON (
        (f.user1_id = $2 AND f.user2_id = u.id) OR
        (f.user2_id = $2 AND f.user1_id = u.id)
      )
      WHERE u.id = $1`,
            [userId, currentUserId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        // عدد المنشورات
        const postsCount = await pool.query(
            'SELECT COUNT(*) as count FROM posts WHERE user_id = $1 AND community_id IS NULL',
            [userId]
        );

        const friendsCount = await pool.query(
            'SELECT COUNT(*) as count FROM friendships WHERE user1_id = $1 OR user2_id = $1',
            [userId]
        );

        // عدد اللايكات
        const likesCount = await pool.query(
            `SELECT COUNT(*)::int as count 
             FROM likes 
             JOIN posts ON likes.post_id = posts.id 
             WHERE posts.user_id = $1`,
            [userId]
        );

        res.json({
            user: {
                ...result.rows[0],
                posts_count: parseInt(postsCount.rows[0].count),
                friends_count: parseInt(friendsCount.rows[0].count),
                likes_count: parseInt(likesCount.rows[0].count)
            }
        });
    } catch (error) {
        console.error('Get user profile error:', error);
        res.status(500).json({ error: 'Server error fetching profile' });
    }
};

/**
 * تحديث الملف الشخصي
 */
const updateProfile = async (req, res) => {
    try {
        const userId = req.user.id || req.user.userId;
        const { full_name, bio, gender, date_of_birth } = req.body;
        const { uploadToSupabase } = require('../utils/storage');

        let profile_picture = null;
        if (req.file) {
            profile_picture = await uploadToSupabase(req.file.buffer, req.file.originalname, req.file.mimetype);
        }

        let query = 'UPDATE users SET';
        let params = [];
        let paramCount = 1;

        if (full_name !== undefined && full_name !== 'undefined' && full_name !== 'null') {
            params.push(full_name);
            query += ` full_name = $${paramCount++},`;
        }
        if (bio !== undefined && bio !== 'undefined' && bio !== 'null') {
            params.push(bio === '' ? null : bio);
            query += ` bio = $${paramCount++},`;
        }
        if (gender !== undefined && gender !== 'undefined' && gender !== 'null') {
            params.push(gender === '' ? null : gender);
            query += ` gender = $${paramCount++},`;
        }
        if (date_of_birth !== undefined && date_of_birth !== 'undefined' && date_of_birth !== 'null') {
            const dobValue = date_of_birth === '' ? null : date_of_birth;
            params.push(dobValue);
            query += ` date_of_birth = $${paramCount++},`;
        }
        if (profile_picture) {
            params.push(profile_picture);
            query += ` profile_picture = $${paramCount++},`;
        }

        if (params.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        // إزالة الفاصلة الأخيرة
        query = query.slice(0, -1);
        params.push(userId);
        query += ` WHERE id = $${paramCount} RETURNING id, username, email, full_name, bio, profile_picture, gender, date_of_birth`;

        const result = await pool.query(query, params);

        res.json({
            message: 'Profile updated successfully',
            user: result.rows[0]
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Server error updating profile' });
    }
};

module.exports = { searchUsers, getUserProfile, updateProfile };
