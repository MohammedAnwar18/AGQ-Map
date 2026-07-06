const pool = require('../config/database');

/**
 * الحصول على إحصائيات Dashboard
 */
const getDashboardStats = async (req, res) => {
    try {
        // عدد المستخدمين
        const usersCount = await pool.query('SELECT COUNT(*) as count FROM users');

        // عدد المنشورات
        const postsCount = await pool.query('SELECT COUNT(*) as count FROM posts');

        // عدد المستخدمين النشطين (آخر 24 ساعة)
        const activeUsers = await pool.query(
            `SELECT COUNT(*) as count FROM users 
             WHERE last_seen > NOW() - INTERVAL '24 hours'`
        );

        // عدد المنشورات اليوم
        const todayPosts = await pool.query(
            `SELECT COUNT(*) as count FROM posts 
             WHERE created_at::date = CURRENT_DATE`
        );

        res.json({
            stats: {
                totalUsers: parseInt(usersCount.rows[0].count),
                totalPosts: parseInt(postsCount.rows[0].count),
                activeUsers: parseInt(activeUsers.rows[0].count),
                todayPosts: parseInt(todayPosts.rows[0].count)
            }
        });
    } catch (error) {
        console.error('Get dashboard stats error:', error);
        res.status(500).json({ error: 'Server error fetching stats' });
    }
};

/**
 * الحصول على جميع المستخدمين مع إمكانية البحث
 */
const getAllUsers = async (req, res) => {
    try {
        const { search, page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT 
                u.id, u.username, u.email, u.full_name, u.profile_picture,
                u.created_at, u.is_active, u.is_online, u.last_seen, u.role,
                u.last_latitude, u.last_longitude,
                COUNT(DISTINCT p.id) as posts_count,
                COUNT(DISTINCT f.id) as friends_count
            FROM users u
            LEFT JOIN posts p ON p.user_id = u.id
            LEFT JOIN friendships f ON (f.user1_id = u.id OR f.user2_id = u.id)
        `;

        const params = [];
        let paramCount = 1;

        if (search) {
            query += ` WHERE (u.username ILIKE $${paramCount} OR u.email ILIKE $${paramCount} OR u.full_name ILIKE $${paramCount})`;
            params.push(`%${search}%`);
            paramCount++;
        }

        query += ` GROUP BY u.id ORDER BY u.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
        params.push(limit, offset);

        const result = await pool.query(query, params);

        // عدد إجمالي المستخدمين
        let countQuery = 'SELECT COUNT(*) as count FROM users';
        if (search) {
            countQuery += ` WHERE (username ILIKE $1 OR email ILIKE $1 OR full_name ILIKE $1)`;
        }
        const countResult = await pool.query(countQuery, search ? [`%${search}%`] : []);

        res.json({
            users: result.rows,
            pagination: {
                total: parseInt(countResult.rows[0].count),
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(countResult.rows[0].count / limit)
            }
        });
    } catch (error) {
        console.error('Get all users error:', error);
        res.status(500).json({ error: 'Server error fetching users' });
    }
};

/**
 * الحصول على تفاصيل مستخدم معين
 */
const getUserDetails = async (req, res) => {
    try {
        const { userId } = req.params;

        // بيانات المستخدم
        const userResult = await pool.query(
            `SELECT 
                id, username, email, full_name, bio, profile_picture, date_of_birth,
                created_at, last_seen, is_online, is_active, role,
                marital_status, workplace, education, institution,
                last_latitude, last_longitude
             FROM users WHERE id = $1`,
            [userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        // منشورات المستخدم
        const postsResult = await pool.query(
            `SELECT 
                p.id, p.content, p.image_url, p.created_at,
                ST_Y(p.location::geometry) as latitude,
                ST_X(p.location::geometry) as longitude,
                p.address
             FROM posts p
             WHERE p.user_id = $1
             ORDER BY p.created_at DESC`,
            [userId]
        );

        res.json({
            user: userResult.rows[0],
            posts: postsResult.rows.map(post => ({
                ...post,
                location: { latitude: post.latitude, longitude: post.longitude }
            }))
        });
    } catch (error) {
        console.error('Get user details error:', error);
        res.status(500).json({ error: 'Server error fetching user details' });
    }
};

/**
 * حذف مستخدم
 */
const deleteUser = async (req, res) => {
    try {
        const { userId } = req.params;

        // التأكد من عدم حذف الأدمن نفسه
        if (parseInt(userId) === req.user.userId) {
            return res.status(400).json({ error: 'Cannot delete your own account' });
        }

        await pool.query('DELETE FROM users WHERE id = $1', [userId]);

        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Server error deleting user' });
    }
};

/**
 * تفعيل / إيقاف حساب مستخدم
 */
const toggleUserStatus = async (req, res) => {
    try {
        const { userId } = req.params;
        const { is_active } = req.body;

        // التأكد من عدم إيقاف الأدمن نفسه
        if (parseInt(userId) === req.user.userId) {
            return res.status(400).json({ error: 'Cannot suspend your own account' });
        }

        await pool.query(
            'UPDATE users SET is_active = $1 WHERE id = $2',
            [is_active, userId]
        );

        res.json({
            message: is_active ? 'User activated successfully' : 'User suspended successfully',
            is_active
        });
    } catch (error) {
        console.error('Toggle user status error:', error);
        res.status(500).json({ error: 'Server error updating user status' });
    }
};

/**
 * الحصول على جميع المنشورات
 */
const getAllPosts = async (req, res) => {
    try {
        const { page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;

        const result = await pool.query(
            `SELECT 
                p.id, p.content, p.image_url, p.created_at, p.address,
                ST_Y(p.location::geometry) as latitude,
                ST_X(p.location::geometry) as longitude,
                u.id as user_id, u.username, u.full_name, u.profile_picture
             FROM posts p
             JOIN users u ON u.id = p.user_id
             ORDER BY p.created_at DESC
             LIMIT $1 OFFSET $2`,
            [limit, offset]
        );

        const countResult = await pool.query('SELECT COUNT(*) as count FROM posts');

        res.json({
            posts: result.rows.map(post => ({
                ...post,
                location: { latitude: post.latitude, longitude: post.longitude },
                user: {
                    id: post.user_id,
                    username: post.username,
                    full_name: post.full_name,
                    profile_picture: post.profile_picture
                }
            })),
            pagination: {
                total: parseInt(countResult.rows[0].count),
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(countResult.rows[0].count / limit)
            }
        });
    } catch (error) {
        console.error('Get all posts error:', error);
        res.status(500).json({ error: 'Server error fetching posts' });
    }
};

/**
 * حذف منشور (من قبل الأدمن)
 */
const deletePost = async (req, res) => {
    try {
        const { postId } = req.params;

        await pool.query('DELETE FROM posts WHERE id = $1', [postId]);

        res.json({ message: 'Post deleted successfully' });
    } catch (error) {
        console.error('Delete post error:', error);
        res.status(500).json({ error: 'Server error deleting post' });
    }
};

/**
 * إنشاء منشور من قبل الأدمن
 */
const createAdminPost = async (req, res) => {
    try {
        const { content, latitude, longitude, address } = req.body;
        const { uploadToSupabase } = require('../utils/storage');
        let image_url = null;

        if (req.file) {
            image_url = await uploadToSupabase(req.file.buffer, req.file.originalname, req.file.mimetype);
        }

        const result = await pool.query(
            `INSERT INTO posts (user_id, content, image_url, location, address)
             VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326), $6)
             RETURNING id, content, image_url, address, created_at`,
            [req.user.userId, content, image_url, longitude, latitude, address]
        );

        res.status(201).json({
            message: 'Admin post created successfully',
            post: {
                ...result.rows[0],
                location: { latitude, longitude }
            }
        });
    } catch (error) {
        console.error('Create admin post error:', error);
        res.status(500).json({ error: 'Server error creating post' });
    }
};

/**
 * الحصول على جميع المحلات
 */
const getAllShops = async (req, res) => {
    try {
        const { search, page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;

        let query;
        let params = [];
        let result;

        try {
            // Unified query for both shops (including medical centers) and university facilities
            query = `
                WITH combined AS (
                    SELECT id, name, category, profile_picture, created_at, 'shop' as type, is_hidden, is_locked, icon_size, text_size, min_zoom, text_min_zoom
                    FROM shops
                    UNION ALL
                    SELECT id, name, category, icon as profile_picture, created_at, 'facility' as type, FALSE as is_hidden, FALSE as is_locked, icon_size, text_size, min_zoom, text_min_zoom
                    FROM university_facilities
                )
                SELECT * FROM combined
            `;
            if (search) {
                query += ` WHERE name ILIKE $1 OR category ILIKE $1`;
                params.push(`%${search}%`);
            }
            query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
            params.push(limit, offset);
            result = await pool.query(query, params);
        } catch (dbErr) {
            console.warn("Database error in getAllShops querying custom sizes/zooms, falling back to standard columns:", dbErr.message);
            params = [];
            query = `
                WITH combined AS (
                    SELECT id, name, category, profile_picture, created_at, 'shop' as type, is_hidden, is_locked
                    FROM shops
                    UNION ALL
                    SELECT id, name, category, icon as profile_picture, created_at, 'facility' as type, FALSE as is_hidden, FALSE as is_locked
                    FROM university_facilities
                )
                SELECT * FROM combined
            `;
            if (search) {
                query += ` WHERE name ILIKE $1 OR category ILIKE $1`;
                params.push(`%${search}%`);
            }
            query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
            params.push(limit, offset);
            const rawRes = await pool.query(query, params);
            result = {
                rows: rawRes.rows.map(row => ({
                    ...row,
                    icon_size: null,
                    text_size: null,
                    min_zoom: null,
                    text_min_zoom: null
                }))
            };
        }

        let countQuery = `
            WITH combined AS (
                SELECT name, category FROM shops
                UNION ALL
                SELECT name, category FROM university_facilities
            )
            SELECT COUNT(*) as count FROM combined
        `;
        if (search) {
            countQuery += ` WHERE name ILIKE $1 OR category ILIKE $1`;
        }
        const countResult = await pool.query(countQuery, search ? [`%${search}%`] : []);

        res.json({
            shops: result.rows,
            pagination: {
                total: parseInt(countResult.rows[0].count),
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(countResult.rows[0].count / limit)
            }
        });
    } catch (error) {
        console.error('Get all shops error:', error);
        res.status(500).json({ error: 'Server error fetching shops' });
    }
};

/**
 * حذف محل
 */
const deleteShop = async (req, res) => {
    try {
        const { shopId } = req.params;
        await pool.query('DELETE FROM shops WHERE id = $1', [shopId]);
        res.json({ message: 'Shop deleted successfully' });
    } catch (error) {
        console.error('Delete shop error:', error);
        res.status(500).json({ error: 'Server error deleting shop' });
    }
};

/**
 * تغيير حالة ظهور المحل (تفعيل/تعطيل)
 */
const toggleShopStatus = async (req, res) => {
    try {
        const { shopId } = req.params;
        const { is_hidden } = req.body;
        await pool.query('UPDATE shops SET is_hidden = $1 WHERE id = $2', [is_hidden, shopId]);
        res.json({ message: 'Shop status updated successfully', is_hidden });
    } catch (error) {
        console.error('Toggle shop status error:', error);
        res.status(500).json({ error: 'Server error updating shop status' });
    }
};

/**
 * قفل / فتح قفل محل (يبقى على الخريطة لكن لا يمكن فتحه)
 */
const toggleShopLock = async (req, res) => {
    try {
        const { shopId } = req.params;
        const { is_locked } = req.body;
        await pool.query('UPDATE shops SET is_locked = $1 WHERE id = $2', [is_locked, shopId]);
        res.json({ message: 'Shop lock status updated', is_locked });
    } catch (error) {
        console.error('Toggle shop lock error:', error);
        res.status(500).json({ error: 'Server error updating shop lock' });
    }
};

/**
 * إرسال إشعار من الإدارة للمستخدمين (صامت وباسم PalNovaa)
 */
const sendAdminNotification = async (req, res) => {
    try {
        const { targetUser, message } = req.body;

        if (!message || message.trim() === '') {
            return res.status(400).json({ error: 'محتوى الرسالة مطلوب' });
        }

        const { sendPushNotification } = require('../utils/pushHelper');

        // دالة مساعدة لإدخال وإرسال الإشعار لمستخدم واحد
        const deliverNotification = async (userId) => {
            // إدخال في قاعدة البيانات
            await pool.query(
                "INSERT INTO notifications (user_id, sender_id, type, message) VALUES ($1, NULL, 'admin_alert', $2)",
                [userId, message]
            );

            // إرسال تنبيه Push للهاتف (إن وجد)
            try {
                const subResult = await pool.query(
                    'SELECT id, subscription FROM push_subscriptions WHERE user_id = $1',
                    [userId]
                );

                if (subResult.rows.length > 0) {
                    const payload = {
                        title: '📢 تنبيه من PalNovaa',
                        body: message,
                        icon: '/logo.png',
                        data: {
                            url: '/notifications',
                            type: 'admin_alert'
                        }
                    };

                    subResult.rows.forEach(async (row) => {
                        const sendResult = await sendPushNotification(row.subscription, payload);
                        if (sendResult.expired) {
                            await pool.query('DELETE FROM push_subscriptions WHERE id = $1', [row.id]);
                        }
                    });
                }
            } catch (e) {
                console.warn(`Failed to push notification to user ${userId}:`, e.message);
            }
        };

        if (targetUser === 'all') {
            // جلب كافة المستخدمين النشطين
            const usersResult = await pool.query('SELECT id FROM users WHERE is_active = TRUE');
            const userIds = usersResult.rows.map(row => row.id);

            // إرسال الإشعار للجميع بالتوازي
            await Promise.all(userIds.map(userId => deliverNotification(userId)));

            res.json({ success: true, message: `تم إرسال الإشعار بنجاح إلى ${userIds.length} مستخدم.` });
        } else {
            // إرسال لمستخدم محدد
            const userId = parseInt(targetUser);
            if (isNaN(userId)) {
                return res.status(400).json({ error: 'معرف المستخدم غير صحيح' });
            }

            // التأكد من وجود المستخدم
            const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
            if (userCheck.rows.length === 0) {
                return res.status(404).json({ error: 'المستخدم المطلوب غير موجود' });
            }

            await deliverNotification(userId);
            res.json({ success: true, message: 'تم إرسال الإشعار للمستخدم بنجاح.' });
        }
    } catch (error) {
        console.error('Send admin notification error:', error);
        res.status(500).json({ error: 'خطأ في السيرفر أثناء إرسال الإشعار' });
    }
};

/**
 * الحصول على جميع المحلات، المراكز الطبية، والمرافق الجامعية لتنظيمها
 */
const getOrganizationItems = async (req, res) => {
    try {
        // 1. جلب المحلات والمراكز الطبية
        const shopsResult = await pool.query(`
            SELECT id, name, category, profile_picture, 'shop' as type, icon_size, text_size, min_zoom, text_min_zoom
            FROM shops
            ORDER BY name ASC
        `);

        // 2. جلب المرافق الجامعية مع try-catch في حال غياب الأعمدة
        let facilitiesResult;
        try {
            facilitiesResult = await pool.query(`
                SELECT id, name, category, icon as profile_picture, 'facility' as type, icon_size, text_size, min_zoom, text_min_zoom
                FROM university_facilities
                ORDER BY name ASC
            `);
        } catch (dbErr) {
            console.warn("Database error querying facility organization items, using fallbacks:", dbErr.message);
            const rawResult = await pool.query(`
                SELECT id, name, category, icon as profile_picture, 'facility' as type
                FROM university_facilities
                ORDER BY name ASC
            `);
            facilitiesResult = {
                rows: rawResult.rows.map(row => ({
                    ...row,
                    icon_size: null,
                    text_size: null,
                    min_zoom: null,
                    text_min_zoom: null
                }))
            };
        }

        // دمج النتائج ووسمها
        const shops = shopsResult.rows.map(s => {
            const isMedical = ['مركز طبي', 'عيادة', 'مستشفى', 'Medical Center', 'Clinic', 'Hospital'].includes(s.category);
            return {
                ...s,
                id: `shop-${s.id}`,
                real_id: s.id,
                display_type: isMedical ? 'مركز طبي' : 'محل/مؤسسة'
            };
        });

        const facilities = facilitiesResult.rows.map(f => ({
            ...f,
            id: `facility-${f.id}`,
            real_id: f.id,
            display_type: 'مرفق جامعي'
        }));

        res.json({
            items: [...shops, ...facilities]
        });
    } catch (error) {
        console.error('Get organization items error:', error);
        res.status(500).json({ error: 'Server error fetching organization items' });
    }
};

/**
 * تحديث تنظيم حجم وزوم المحلات، المراكز الطبية، والمرافق الجامعية
 */
const updateOrganizationItem = async (req, res) => {
    try {
        const { type, id } = req.params;
        const { icon_size, text_size, min_zoom, text_min_zoom } = req.body;

        const parsedIconSize = (icon_size === '' || icon_size === undefined || icon_size === null) ? null : parseInt(icon_size);
        const parsedTextSize = (text_size === '' || text_size === undefined || text_size === null) ? null : parseInt(text_size);
        const parsedMinZoom = (min_zoom === '' || min_zoom === undefined || min_zoom === null) ? null : parseFloat(min_zoom);
        const parsedTextMinZoom = (text_min_zoom === '' || text_min_zoom === undefined || text_min_zoom === null) ? null : parseFloat(text_min_zoom);

        if (type === 'shop') {
            let result;
            try {
                result = await pool.query(
                    `UPDATE shops SET icon_size = $1, text_size = $2, min_zoom = $3, text_min_zoom = $4 WHERE id = $5 RETURNING *`,
                    [parsedIconSize, parsedTextSize, parsedMinZoom, parsedTextMinZoom, id]
                );
            } catch (dbErr) {
                console.warn("Failed to update shop size/zoom in organization (missing columns?):", dbErr.message);
                return res.status(400).json({ error: 'Database columns do not exist. Please run migration first.' });
            }
            if (result.rowCount === 0) return res.status(404).json({ error: 'Shop not found' });
            return res.json(result.rows[0]);
        } else if (type === 'facility') {
            let result;
            try {
                result = await pool.query(
                    `UPDATE university_facilities SET icon_size = $1, text_size = $2, min_zoom = $3, text_min_zoom = $4 WHERE id = $5 RETURNING *`,
                    [parsedIconSize, parsedTextSize, parsedMinZoom, parsedTextMinZoom, id]
                );
            } catch (dbErr) {
                console.warn("Failed to update facility size/zoom in organization (missing columns?):", dbErr.message);
                return res.status(400).json({ error: 'Database columns do not exist on university_facilities table. Please run migration first.' });
            }
            if (result.rowCount === 0) return res.status(404).json({ error: 'Facility not found' });
            return res.json(result.rows[0]);
        } else {
            return res.status(400).json({ error: 'Invalid type provided' });
        }
    } catch (error) {
        console.error('Update organization item error:', error);
        res.status(500).json({ error: 'Server error updating organization item' });
    }
};

/**
 * الحصول على جميع صور الفعاليات/الدعوات للأدمن
 */
const getAllEventPhotos = async (req, res) => {
    try {
        const { search, page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;

        let query = 'SELECT * FROM event_photos';
        const params = [];
        let paramCount = 1;

        if (search) {
            query += ` WHERE (event_slug ILIKE $${paramCount} OR uploader ILIKE $${paramCount} OR caption ILIKE $${paramCount})`;
            params.push(`%${search}%`);
            paramCount++;
        }

        query += ` ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
        params.push(parseInt(limit), parseInt(offset));

        const result = await pool.query(query, params);

        // Get total count
        let countQuery = 'SELECT COUNT(*) as count FROM event_photos';
        if (search) {
            countQuery += ` WHERE (event_slug ILIKE $1 OR uploader ILIKE $1 OR caption ILIKE $1)`;
        }
        const countResult = await pool.query(countQuery, search ? [`%${search}%`] : []);
        const total = parseInt(countResult.rows[0].count);

        res.json({
            success: true,
            photos: result.rows,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Get all event photos error:', error);
        res.status(500).json({ error: 'Server error fetching event photos' });
    }
};

/**
 * حذف صورة فعالية/دعوة من قبل الأدمن
 */
const deleteEventPhoto = async (req, res) => {
    try {
        const { photoId } = req.params;

        const photoResult = await pool.query('SELECT image_url FROM event_photos WHERE id = $1', [photoId]);
        if (photoResult.rowCount === 0) {
            return res.status(404).json({ error: 'Photo not found' });
        }

        const imageUrl = photoResult.rows[0].image_url;

        // Delete from DB first
        await pool.query('DELETE FROM event_photos WHERE id = $1', [photoId]);

        // Delete from storage (cloud or local)
        try {
            const { deleteFileFromCloud } = require('../utils/storage');
            await deleteFileFromCloud(imageUrl);
        } catch (storageErr) {
            console.error('Failed to delete event photo from storage:', storageErr.message);
        }

        res.json({ success: true, message: 'Photo deleted successfully' });
    } catch (error) {
        console.error('Delete event photo error:', error);
        res.status(500).json({ error: 'Server error deleting event photo' });
    }
};

module.exports = {
    getDashboardStats,
    getAllUsers,
    getUserDetails,
    deleteUser,
    toggleUserStatus,
    getAllPosts,
    deletePost,
    createAdminPost,
    getAllShops,
    deleteShop,
    toggleShopStatus,
    toggleShopLock,
    sendAdminNotification,
    getOrganizationItems,
    updateOrganizationItem,
    getAllEventPhotos,
    deleteEventPhoto
};
