const pool = require('../config/database');

// Helper: extract YouTube video_id
const extractYouTubeId = (url) => {
    if (!url) return null;
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([^&\n?#]+)/,
        /^([a-zA-Z0-9_-]{11})$/
    ];
    for (const p of patterns) {
        const m = url.match(p);
        if (m) return m[1];
    }
    return null;
};

// ─── Auto-migrate: ensure reels table exists ──────────────────────────────────
const ensureTable = async () => {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS reels (
            id SERIAL PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            youtube_url TEXT NOT NULL,
            latitude FLOAT,
            longitude FLOAT,
            city VARCHAR(255),
            location_name VARCHAR(255),
            likes_count INTEGER DEFAULT 0,
            comments_count INTEGER DEFAULT 0,
            created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS reel_likes (
            id SERIAL PRIMARY KEY,
            reel_id INTEGER REFERENCES reels(id) ON DELETE CASCADE,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(reel_id, user_id)
        );
    `);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS reel_comments (
            id SERIAL PRIMARY KEY,
            reel_id INTEGER REFERENCES reels(id) ON DELETE CASCADE,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            text TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);
};

// ─── GET /api/reels  ─────────────────────────────────────────────────────────
const getReels = async (req, res) => {
    try {
        await ensureTable();
        const userId = req.user?.userId || null;
        const { lat, lng } = req.query;

        let query = `
            SELECT r.*,
                u.username AS creator_username,
                u.profile_picture AS creator_avatar
                ${userId ? `, EXISTS(SELECT 1 FROM reel_likes rl WHERE rl.reel_id = r.id AND rl.user_id = $1) AS is_liked` : `, FALSE AS is_liked`}
                ${(lat && lng) ? `,
                    ROUND(
                        6371 * acos(
                            cos(radians($${userId ? 2 : 1})) * cos(radians(r.latitude)) *
                            cos(radians(r.longitude) - radians($${userId ? 3 : 2})) +
                            sin(radians($${userId ? 2 : 1})) * sin(radians(r.latitude))
                        )::numeric, 2
                    ) AS distance_km` : ''}
            FROM reels r
            LEFT JOIN users u ON u.id = r.created_by
            ORDER BY r.created_at DESC
        `;

        const params = [];
        if (userId) params.push(userId);
        if (lat && lng) {
            params.push(parseFloat(lat));
            params.push(parseFloat(lng));
        }

        const countCheck = await pool.query('SELECT COUNT(*) FROM reels');
        if (parseInt(countCheck.rows[0].count, 10) === 0) {
            await pool.query(
                `INSERT INTO reels (title, description, youtube_url, latitude, longitude, city, location_name) VALUES
                 ($1, $2, $3, $4, $5, $6, $7),
                 ($8, $9, $10, $11, $12, $13, $14)`,
                [
                    'جولة في شوارع رام الله 🇵🇸',
                    'جولة ممتعة في مركز المدينة وشوارع رام الله الجذابة',
                    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                    31.9038,
                    35.2034,
                    'رام الله',
                    'مركز المدينة',

                    'القدس الشريف والبلدة القديمة ✨',
                    'أجواء إيمانية وتاريخية من قلب مدينة القدس الشريف',
                    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                    31.7767,
                    35.2345,
                    'القدس',
                    'البلدة القديمة'
                ]
            );
        }

        const result = await pool.query(query, params);
        res.json({ reels: result.rows });
    } catch (err) {
        console.error('getReels error:', err);
        res.status(500).json({ error: 'فشل في جلب الريلز' });
    }
};

// ─── GET /api/reels/:id  ─────────────────────────────────────────────────────
const getReel = async (req, res) => {
    try {
        await ensureTable();
        const { id } = req.params;
        const result = await pool.query('SELECT * FROM reels WHERE id = $1', [id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'الريل غير موجود' });
        res.json({ reel: result.rows[0] });
    } catch (err) {
        console.error('getReel error:', err);
        res.status(500).json({ error: 'فشل في جلب الريل' });
    }
};

// ─── POST /api/reels  ────────────────────────────────────────────────────────
const createReel = async (req, res) => {
    try {
        await ensureTable();
        const { title, description, youtube_url, latitude, longitude, city, location_name } = req.body;
        if (!title || !youtube_url) return res.status(400).json({ error: 'العنوان ورابط YouTube مطلوبان' });

        const ytId = extractYouTubeId(youtube_url);
        if (!ytId) return res.status(400).json({ error: 'رابط YouTube غير صالح' });

        const result = await pool.query(
            `INSERT INTO reels (title, description, youtube_url, latitude, longitude, city, location_name, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [title, description || null, youtube_url, latitude || null, longitude || null, city || null, location_name || null, req.user?.userId]
        );
        res.status(201).json({ reel: result.rows[0] });
    } catch (err) {
        console.error('createReel error:', err);
        res.status(500).json({ error: 'فشل في إنشاء الريل' });
    }
};

// ─── PUT /api/reels/:id  ─────────────────────────────────────────────────────
const updateReel = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, youtube_url, latitude, longitude, city, location_name } = req.body;
        const result = await pool.query(
            `UPDATE reels SET
                title = COALESCE($1, title),
                description = COALESCE($2, description),
                youtube_url = COALESCE($3, youtube_url),
                latitude = COALESCE($4, latitude),
                longitude = COALESCE($5, longitude),
                city = COALESCE($6, city),
                location_name = COALESCE($7, location_name)
             WHERE id = $8 RETURNING *`,
            [title, description, youtube_url, latitude, longitude, city, location_name, id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'الريل غير موجود' });
        res.json({ reel: result.rows[0] });
    } catch (err) {
        console.error('updateReel error:', err);
        res.status(500).json({ error: 'فشل في تحديث الريل' });
    }
};

// ─── DELETE /api/reels/:id  ──────────────────────────────────────────────────
const deleteReel = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM reels WHERE id = $1', [id]);
        res.json({ message: 'تم حذف الريل' });
    } catch (err) {
        console.error('deleteReel error:', err);
        res.status(500).json({ error: 'فشل في حذف الريل' });
    }
};

// ─── POST /api/reels/:id/like  ───────────────────────────────────────────────
const toggleLike = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.userId;
        const existing = await pool.query('SELECT id FROM reel_likes WHERE reel_id = $1 AND user_id = $2', [id, userId]);
        if (existing.rows.length > 0) {
            await pool.query('DELETE FROM reel_likes WHERE reel_id = $1 AND user_id = $2', [id, userId]);
            await pool.query('UPDATE reels SET likes_count = GREATEST(0, likes_count - 1) WHERE id = $1', [id]);
            res.json({ liked: false });
        } else {
            await pool.query('INSERT INTO reel_likes (reel_id, user_id) VALUES ($1, $2)', [id, userId]);
            await pool.query('UPDATE reels SET likes_count = likes_count + 1 WHERE id = $1', [id]);
            res.json({ liked: true });
        }
    } catch (err) {
        console.error('toggleLike error:', err);
        res.status(500).json({ error: 'فشل في تبديل الإعجاب' });
    }
};

// ─── GET /api/reels/:id/comments  ────────────────────────────────────────────
const getComments = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            `SELECT rc.*, u.username, u.profile_picture FROM reel_comments rc
             LEFT JOIN users u ON u.id = rc.user_id
             WHERE rc.reel_id = $1 ORDER BY rc.created_at ASC`, [id]
        );
        res.json({ comments: result.rows });
    } catch (err) {
        console.error('getComments error:', err);
        res.status(500).json({ error: 'فشل في جلب التعليقات' });
    }
};

// ─── POST /api/reels/:id/comments  ───────────────────────────────────────────
const addComment = async (req, res) => {
    try {
        const { id } = req.params;
        const { text } = req.body;
        if (!text?.trim()) return res.status(400).json({ error: 'التعليق فارغ' });
        const result = await pool.query(
            `INSERT INTO reel_comments (reel_id, user_id, text) VALUES ($1, $2, $3)
             RETURNING *, (SELECT username FROM users WHERE id = $2) AS username`,
            [id, req.user?.userId, text.trim()]
        );
        await pool.query('UPDATE reels SET comments_count = comments_count + 1 WHERE id = $1', [id]);
        res.status(201).json({ comment: result.rows[0] });
    } catch (err) {
        console.error('addComment error:', err);
        res.status(500).json({ error: 'فشل في إضافة التعليق' });
    }
};

// ─── DELETE /api/reels/comments/:commentId  ───────────────────────────────────
const deleteComment = async (req, res) => {
    try {
        const { commentId } = req.params;
        const c = await pool.query('SELECT * FROM reel_comments WHERE id = $1', [commentId]);
        if (c.rows.length === 0) return res.status(404).json({ error: 'التعليق غير موجود' });
        await pool.query('DELETE FROM reel_comments WHERE id = $1', [commentId]);
        await pool.query('UPDATE reels SET comments_count = GREATEST(0, comments_count - 1) WHERE id = $1', [c.rows[0].reel_id]);
        res.json({ message: 'تم حذف التعليق' });
    } catch (err) {
        console.error('deleteComment error:', err);
        res.status(500).json({ error: 'فشل في حذف التعليق' });
    }
};

module.exports = { getReels, getReel, createReel, updateReel, deleteReel, toggleLike, getComments, addComment, deleteComment };
