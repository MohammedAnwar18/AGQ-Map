const pool = require('../config/database');

/**
 * إنشاء منشور جديد مع موقع مكاني
 */
/**
 * إنشاء منشور جديد مع موقع مكاني
 */
const createPost = async (req, res) => {
    try {
        const { content, latitude, longitude, address, community_id } = req.body;
        const userId = req.user.userId;

        if (!latitude || !longitude) {
            return res.status(400).json({ error: 'Location (latitude, longitude) is required' });
        }

        // التحقق من صحة الإحداثيات
        if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
            return res.status(400).json({ error: 'Invalid coordinates' });
        }

        // معالجة الملفات المتعددة
        let media_urls = [];
        let image_url = null;
        let media_type = 'text';

        if (req.files && req.files.length > 0) {
            // Map all files to their URLs
            media_urls = req.files.map(file => file.path);

            // Set defaults from the first file
            image_url = media_urls[0];
            const firstFile = req.files[0];
            if (firstFile.mimetype.startsWith('video/')) {
                media_type = 'video';
            } else if (firstFile.mimetype.startsWith('image/')) {
                media_type = 'image';
            }
        } else if (req.file) {
            // Fallback for single file upload if needed (though route is array now)
            image_url = req.file.path;
            media_urls = [image_url];
            if (req.file.mimetype.startsWith('video/')) {
                media_type = 'video';
            } else {
                media_type = 'image';
            }
        }

        // إنشاء نقطة جغرافية
        const result = await pool.query(
            `INSERT INTO posts (user_id, content, image_url, media_urls, location, address, media_type, community_id)
       VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography, $7, $8, $9)
       RETURNING id, user_id, content, image_url, media_urls, media_type, community_id,
                 ST_X(location::geometry) as longitude,
                 ST_Y(location::geometry) as latitude,
                 address, created_at`,
            [userId, content, image_url, media_urls, longitude, latitude, address, media_type, community_id || null]
        );

        const post = result.rows[0];

        // الحصول على معلومات المستخدم
        const userResult = await pool.query(
            'SELECT id, username, full_name, profile_picture FROM users WHERE id = $1',
            [userId]
        );

        const newPost = {
            ...post,
            location: {
                latitude: post.latitude,
                longitude: post.longitude
            },
            user: userResult.rows[0],
            comments_count: 0,
            likes_count: 0,
            is_liked: false
        };

        // Notify via Socket.IO if it's a community post
        if (community_id) {
            const io = req.app.get('io');
            if (io) {
                // Emit to everyone for simplicity as per user request (or could be to a specific room)
                io.emit('new_community_post', {
                    communityId: community_id,
                    postId: newPost.id
                });
            }
        }

        res.status(201).json({
            message: 'Post created successfully',
            post: newPost
        });
    } catch (error) {
        console.error('Create post error:', error);
        res.status(500).json({ error: 'Server error creating post' });
    }
};

/**
 * الحصول على المنشورات ضمن نطاق جغرافي
 */
const getPosts = async (req, res) => {
    try {
        const { latitude, longitude, radius = 50000 } = req.query; // radius بالأمتار (50km default)
        const userId = req.user.userId;

        let query;
        let params;

        if (latitude && longitude) {
            // الحصول على المنشورات ضمن نطاق معين
            query = `
        SELECT 
          p.id, p.user_id, p.content, p.image_url, p.media_urls, p.media_type,
          ST_X(p.location::geometry) as longitude,
          ST_Y(p.location::geometry) as latitude,
          p.address, p.created_at,
          u.username, u.full_name, u.profile_picture,
          (SELECT COUNT(*)::int FROM comments WHERE post_id = p.id) as comments_count,
          (SELECT COUNT(*)::int FROM likes WHERE post_id = p.id) as likes_count,
          EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = $4) as is_liked,
          ST_Distance(p.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) as distance
        FROM posts p
        JOIN users u ON p.user_id = u.id
        WHERE ST_DWithin(
          p.location,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
          $3
        )
        AND p.community_id IS NULL
        AND (
          p.user_id = $4
          OR p.user_id IN (
            SELECT CASE 
              WHEN user1_id = $4 THEN user2_id 
              ELSE user1_id 
            END
            FROM friendships
            WHERE user1_id = $4 OR user2_id = $4
          )
        )
        OR (p.user_id = $4 AND p.community_id IS NULL)
        ORDER BY distance, p.created_at DESC
        LIMIT 100
      `;
            params = [longitude, latitude, radius, userId];
        } else {
            // الحصول على جميع منشورات الأصدقاء
            query = `
        SELECT 
          p.id, p.user_id, p.content, p.image_url, p.media_urls, p.media_type,
          ST_X(p.location::geometry) as longitude,
          ST_Y(p.location::geometry) as latitude,
          p.address, p.created_at,
          (SELECT COUNT(*)::int FROM comments WHERE post_id = p.id) as comments_count,
          (SELECT COUNT(*)::int FROM likes WHERE post_id = p.id) as likes_count,
          EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = $1) as is_liked,
          u.username, u.full_name, u.profile_picture
        FROM posts p
        JOIN users u ON p.user_id = u.id
        WHERE 
          p.community_id IS NULL
          AND (
            p.user_id = $1
            OR p.user_id IN (
              SELECT CASE 
                WHEN user1_id = $1 THEN user2_id 
                ELSE user1_id 
              END
              FROM friendships
              WHERE user1_id = $1 OR user2_id = $1
            )
          )
        ORDER BY p.created_at DESC
        LIMIT 100
      `;
            params = [userId];
        }

        const result = await pool.query(query, params);

        res.json({
            posts: result.rows.map(post => ({
                id: post.id,
                content: post.content,
                image_url: post.image_url,
                media_urls: post.media_urls || (post.image_url ? [post.image_url] : []),
                media_type: post.media_type || 'image',
                location: {
                    latitude: post.latitude,
                    longitude: post.longitude
                },
                address: post.address,
                created_at: post.created_at,
                distance: post.distance,
                user: {
                    id: post.user_id,
                    username: post.username,
                    full_name: post.full_name,
                    profile_picture: post.profile_picture
                },
                comments_count: post.comments_count || 0,
                likes_count: post.likes_count || 0,
                is_liked: post.is_liked || false
            }))
        });
    } catch (error) {
        console.error('Get posts error:', error);
        res.status(500).json({ error: 'Server error fetching posts' });
    }
};

/**
 * حذف منشور
 */
const deletePost = async (req, res) => {
    try {
        const { postId } = req.params;
        const userId = req.user.userId;

        const result = await pool.query(
            'DELETE FROM posts WHERE id = $1 AND user_id = $2 RETURNING id',
            [postId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Post not found or unauthorized' });
        }

        res.json({ message: 'Post deleted successfully' });
    } catch (error) {
        console.error('Delete post error:', error);
        res.status(500).json({ error: 'Server error deleting post' });
    }
};

/**
 * تبديل الإعجاب (Like/Unlike)
 */
/**
 * تبديل الإعجاب (Like/Unlike)
 */
const toggleLike = async (req, res) => {
    try {
        const { postId } = req.params;
        const userId = req.user.userId;

        // Check if like exists
        const checkLike = await pool.query(
            'SELECT * FROM likes WHERE user_id = $1 AND post_id = $2',
            [userId, postId]
        );

        let isLiked = false;

        if (checkLike.rows.length > 0) {
            // Unlike
            await pool.query(
                'DELETE FROM likes WHERE user_id = $1 AND post_id = $2',
                [userId, postId]
            );
            isLiked = false;
        } else {
            // Like
            await pool.query(
                'INSERT INTO likes (user_id, post_id) VALUES ($1, $2)',
                [userId, postId]
            );
            isLiked = true;

            // Notify Post Owner
            const postResult = await pool.query('SELECT user_id FROM posts WHERE id = $1', [postId]);
            if (postResult.rows.length > 0) {
                const postOwnerId = postResult.rows[0].user_id;
                if (postOwnerId !== userId) {
                    const { createNotification } = require('./notificationController');
                    await createNotification(postOwnerId, userId, 'like', 'أعجب بمنشورك');
                }
            }
        }

        // Get new count
        const countResult = await pool.query(
            'SELECT COUNT(*)::int as count FROM likes WHERE post_id = $1',
            [postId]
        );
        const likesCount = countResult.rows[0].count;

        res.json({
            message: isLiked ? 'Post liked' : 'Post unliked',
            likes_count: likesCount,
            is_liked: isLiked
        });

    } catch (error) {
        console.error('Toggle like error:', error);
        res.status(500).json({ error: 'Server error toggling like' });
    }
};

module.exports = { createPost, getPosts, deletePost, toggleLike };
