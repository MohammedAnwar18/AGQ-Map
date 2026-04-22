const pool = require('../config/database');

// ─── GET ALL REELS ───────────────────────────────────────────────────────────
exports.getReels = async (req, res) => {
    try {
        const userId = req.user?.id;
        const { limit = 30, offset = 0, lat, lng, radius = 50 } = req.query;

        // اذا تم ارسال إحداثيات — رتّب حسب القرب باستخدام دالة Haversine في SQL
        const hasLocation = lat && lng && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng));
        const userLat = hasLocation ? parseFloat(lat) : null;
        const userLng = hasLocation ? parseFloat(lng) : null;
        const radiusKm = parseFloat(radius);

        let query, params;

        if (hasLocation) {
            // ─── Location-based query: sort by distance ─────────────────────
            query = `
                SELECT 
                    r.*,
                    u.username,
                    u.full_name,
                    u.profile_picture,
                    COUNT(DISTINCT rl.id)::int AS likes_count,
                    COUNT(DISTINCT rc.id)::int AS comments_count,
                    BOOL_OR(ul.user_id IS NOT NULL) AS is_liked,
                    (
                        6371 * acos(
                            LEAST(1, cos(radians($4)) * cos(radians(r.latitude::float))
                            * cos(radians(r.longitude::float) - radians($5))
                            + sin(radians($4)) * sin(radians(r.latitude::float)))
                        )
                    ) AS distance_km
                FROM reels r
                JOIN users u ON u.id = r.user_id
                LEFT JOIN reel_likes rl ON rl.reel_id = r.id
                LEFT JOIN reel_comments rc ON rc.reel_id = r.id
                LEFT JOIN reel_likes ul ON ul.reel_id = r.id AND ul.user_id = $1
                GROUP BY r.id, u.id
                HAVING (
                    6371 * acos(
                        LEAST(1, cos(radians($4)) * cos(radians(r.latitude::float))
                        * cos(radians(r.longitude::float) - radians($5))
                        + sin(radians($4)) * sin(radians(r.latitude::float)))
                    )
                ) <= $6
                ORDER BY distance_km ASC
                LIMIT $2 OFFSET $3
            `;
            params = [userId || null, parseInt(limit), parseInt(offset), userLat, userLng, radiusKm];
        } else {
            // ─── Default query: latest first ─────────────────────────────────
            query = `
                SELECT 
                    r.*,
                    u.username,
                    u.full_name,
                    u.profile_picture,
                    COUNT(DISTINCT rl.id)::int AS likes_count,
                    COUNT(DISTINCT rc.id)::int AS comments_count,
                    BOOL_OR(ul.user_id IS NOT NULL) AS is_liked
                FROM reels r
                JOIN users u ON u.id = r.user_id
                LEFT JOIN reel_likes rl ON rl.reel_id = r.id
                LEFT JOIN reel_comments rc ON rc.reel_id = r.id
                LEFT JOIN reel_likes ul ON ul.reel_id = r.id AND ul.user_id = $1
                GROUP BY r.id, u.id
                ORDER BY r.created_at DESC
                LIMIT $2 OFFSET $3
            `;
            params = [userId || null, parseInt(limit), parseInt(offset)];
        }

        const result = await pool.query(query, params);
        res.json({ reels: result.rows, location_based: hasLocation });
    } catch (err) {
        console.error('getReels error:', err);
        res.status(500).json({ error: 'فشل في تحميل الريلز' });
    }
};


// ─── GET SINGLE REEL ─────────────────────────────────────────────────────────
exports.getReel = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;

        const result = await pool.query(`
            SELECT 
                r.*,
                u.username,
                u.full_name,
                u.profile_picture,
                COUNT(DISTINCT rl.id)::int AS likes_count,
                COUNT(DISTINCT rc.id)::int AS comments_count,
                BOOL_OR(ul.user_id IS NOT NULL) AS is_liked
            FROM reels r
            JOIN users u ON u.id = r.user_id
            LEFT JOIN reel_likes rl ON rl.reel_id = r.id
            LEFT JOIN reel_comments rc ON rc.reel_id = r.id
            LEFT JOIN reel_likes ul ON ul.reel_id = r.id AND ul.user_id = $2
            WHERE r.id = $1
            GROUP BY r.id, u.id
        `, [id, userId || null]);

        if (!result.rows[0]) return res.status(404).json({ error: 'الريل غير موجود' });
        res.json({ reel: result.rows[0] });
    } catch (err) {
        console.error('getReel error:', err);
        res.status(500).json({ error: 'فشل' });
    }
};

// ─── CREATE REEL ─────────────────────────────────────────────────────────────
exports.createReel = async (req, res) => {
    try {
        const { title, description, youtube_url, latitude, longitude, location_name, city } = req.body;
        const userId = req.user.userId || req.user.id; // دعم كلا التنسيقين

        if (!title || !youtube_url || !latitude || !longitude) {
            return res.status(400).json({ error: 'بيانات ناقصة' });
        }

        // استخراج معرف يوتيوب من الرابط إذا كان رابطاً كاملاً
        const result = await pool.query(`
            INSERT INTO reels (user_id, title, description, youtube_url, latitude, longitude, location_name, city)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `, [userId, title, description, youtube_url, latitude, longitude, location_name, city]);

        res.status(201).json({ reel: result.rows[0] });
    } catch (err) {
        console.error('createReel error:', err);
        res.status(500).json({ error: 'فشل في إنشاء الريل' });
    }
};

// ─── DELETE REEL ─────────────────────────────────────────────────────────────
exports.deleteReel = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId || req.user.id; // دعم كلا التنسيقين
        const userRole = req.user.role;

        const check = await pool.query('SELECT user_id FROM reels WHERE id = $1', [id]);
        if (!check.rows[0]) return res.status(404).json({ error: 'غير موجود' });
        // الأدمن يمكنه حذف أي ريل
        if (userRole !== 'admin' && check.rows[0].user_id !== userId) {
            return res.status(403).json({ error: 'غير مصرح' });
        }

        await pool.query('DELETE FROM reels WHERE id = $1', [id]);
        res.json({ message: 'تم الحذف' });
    } catch (err) {
        console.error('deleteReel error:', err);
        res.status(500).json({ error: 'فشل' });
    }
};

// ─── TOGGLE LIKE ─────────────────────────────────────────────────────────────
exports.toggleLike = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId || req.user.id;

        // Check if already liked
        const existing = await pool.query(
            'SELECT id FROM reel_likes WHERE reel_id = $1 AND user_id = $2',
            [id, userId]
        );

        let liked;
        if (existing.rows.length > 0) {
            await pool.query('DELETE FROM reel_likes WHERE reel_id = $1 AND user_id = $2', [id, userId]);
            liked = false;
        } else {
            await pool.query('INSERT INTO reel_likes (reel_id, user_id) VALUES ($1, $2)', [id, userId]);
            liked = true;
        }

        // Return updated count
        const count = await pool.query(
            'SELECT COUNT(*)::int FROM reel_likes WHERE reel_id = $1', [id]
        );

        res.json({ liked, likes_count: count.rows[0].count });
    } catch (err) {
        console.error('toggleLike error:', err);
        res.status(500).json({ error: 'فشل' });
    }
};

// ─── GET COMMENTS ────────────────────────────────────────────────────────────
exports.getComments = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(`
            SELECT rc.*, u.username, u.full_name, u.profile_picture
            FROM reel_comments rc
            JOIN users u ON u.id = rc.user_id
            WHERE rc.reel_id = $1
            ORDER BY rc.created_at ASC
        `, [id]);

        res.json({ comments: result.rows });
    } catch (err) {
        console.error('getComments error:', err);
        res.status(500).json({ error: 'فشل' });
    }
};

// ─── ADD COMMENT ─────────────────────────────────────────────────────────────
exports.addComment = async (req, res) => {
    try {
        const { id } = req.params;
        const { content } = req.body;
        const userId = req.user.userId || req.user.id;

        if (!content?.trim()) return res.status(400).json({ error: 'التعليق فارغ' });

        const result = await pool.query(`
            INSERT INTO reel_comments (reel_id, user_id, content)
            VALUES ($1, $2, $3)
            RETURNING *
        `, [id, userId, content.trim()]);

        // Fetch with user info
        const full = await pool.query(`
            SELECT rc.*, u.username, u.full_name, u.profile_picture
            FROM reel_comments rc
            JOIN users u ON u.id = rc.user_id
            WHERE rc.id = $1
        `, [result.rows[0].id]);

        res.status(201).json({ comment: full.rows[0] });
    } catch (err) {
        console.error('addComment error:', err);
        res.status(500).json({ error: 'فشل في إضافة التعليق' });
    }
};

// ─── DELETE COMMENT ──────────────────────────────────────────────────────────
exports.deleteComment = async (req, res) => {
    try {
        const { commentId } = req.params;
        const userId = req.user.userId || req.user.id;

        const check = await pool.query('SELECT user_id FROM reel_comments WHERE id = $1', [commentId]);
        if (!check.rows[0]) return res.status(404).json({ error: 'غير موجود' });
        if (check.rows[0].user_id !== userId) return res.status(403).json({ error: 'غير مصرح' });

        await pool.query('DELETE FROM reel_comments WHERE id = $1', [commentId]);
        res.json({ message: 'تم الحذف' });
    } catch (err) {
        console.error('deleteComment error:', err);
        res.status(500).json({ error: 'فشل' });
    }
};
