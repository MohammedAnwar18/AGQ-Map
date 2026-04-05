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
        u.id, u.username, u.full_name, u.bio, u.profile_picture, u.role,
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
 * الحصول على ملف مستخدم مع احترام إعدادات الخصوصية
 */
const getUserProfile = async (req, res) => {
    try {
        const { userId } = req.params;
        const currentUserId = req.user.id || req.user.userId;
        const isOwnProfile = String(userId) === String(currentUserId);

        const result = await pool.query(
            `SELECT 
        u.id, u.username, u.full_name, u.bio, u.profile_picture, u.created_at, u.date_of_birth, u.gender,
        u.marital_status, u.workplace, u.education, u.institution, u.role,
        COALESCE(u.privacy_settings, '{}') as privacy_settings,
        CASE 
          WHEN f.id IS NOT NULL THEN true 
          ELSE false 
        END as is_friend,
        EXISTS(
          SELECT 1 FROM friend_requests 
          WHERE (sender_id = $2 AND receiver_id = u.id AND status = 'pending') 
             OR (sender_id = u.id AND receiver_id = $2 AND status = 'pending')
        ) as has_pending_request
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

        const userRow = { ...result.rows[0] };

        // Apply privacy settings for non-own profiles
        if (!isOwnProfile) {
            let privacy = {};
            try {
                privacy = typeof userRow.privacy_settings === 'string'
                    ? JSON.parse(userRow.privacy_settings)
                    : (userRow.privacy_settings || {});
            } catch (e) { privacy = {}; }

            if (privacy.hide_username) userRow.username = null;
            if (privacy.hide_age) userRow.date_of_birth = null;
            if (privacy.hide_marital_status) userRow.marital_status = null;
            if (privacy.hide_workplace) userRow.workplace = null;
            if (privacy.hide_education) { userRow.education = null; userRow.institution = null; }
            if (privacy.hide_gender) userRow.gender = null;
            if (privacy.hide_bio) userRow.bio = null;
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
                ...userRow,
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
 * تحديث الملف الشخصي مع دعم إعدادات الخصوصية
 */
const updateProfile = async (req, res) => {
    try {
        const userId = req.user.id || req.user.userId;
        const { full_name, bio, gender, date_of_birth, marital_status, workplace, education, institution, privacy_settings } = req.body;
        const { uploadToSupabase, deleteFileFromCloud } = require('../utils/storage');

        // Fetch old profile picture to delete later if needed
        const oldUserRes = await pool.query('SELECT profile_picture FROM users WHERE id = $1', [userId]);
        const oldProfilePic = oldUserRes.rows[0]?.profile_picture;

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
        if (marital_status !== undefined && marital_status !== 'undefined' && marital_status !== 'null') {
            params.push(marital_status === '' ? null : marital_status);
            query += ` marital_status = $${paramCount++},`;
        }
        if (workplace !== undefined && workplace !== 'undefined' && workplace !== 'null') {
            params.push(workplace === '' ? null : workplace);
            query += ` workplace = $${paramCount++},`;
        }
        if (education !== undefined && education !== 'undefined' && education !== 'null') {
            params.push(education === '' ? null : education);
            query += ` education = $${paramCount++},`;
        }
        if (institution !== undefined && institution !== 'undefined' && institution !== 'null') {
            params.push(institution === '' ? null : institution);
            query += ` institution = $${paramCount++},`;
        }
        if (privacy_settings !== undefined) {
            try {
                const ps = typeof privacy_settings === 'string' ? JSON.parse(privacy_settings) : privacy_settings;
                params.push(JSON.stringify(ps));
                query += ` privacy_settings = $${paramCount++},`;
            } catch (e) {
                // ignore invalid privacy settings
            }
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
        query += ` WHERE id = $${paramCount} RETURNING id, username, email, full_name, bio, profile_picture, gender, date_of_birth, marital_status, workplace, education, institution, role, privacy_settings`;

        const result = await pool.query(query, params);

        // Cleanup old profile picture if replaced
        if (profile_picture && oldProfilePic) {
            deleteFileFromCloud(oldProfilePic);
        }

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
