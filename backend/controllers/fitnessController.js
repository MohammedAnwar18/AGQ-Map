const pool = require('../config/database');

// Ensure fitness_runs table exists
const ensureTables = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS fitness_runs (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                activity_type VARCHAR(50) DEFAULT 'walk',
                duration_seconds INTEGER DEFAULT 0,
                distance_km FLOAT DEFAULT 0,
                calories_burned INTEGER DEFAULT 0,
                avg_speed_kmh FLOAT DEFAULT 0,
                path_coordinates JSONB NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_fitness_runs_user_id ON fitness_runs(user_id);`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_fitness_runs_created_at ON fitness_runs(created_at);`);
    } catch (err) {
        console.warn('⚠️ fitness_runs table migration warning:', err.message);
    }
};

/**
 * حفظ مسار لياقة جديد
 * POST /api/fitness
 */
const saveRun = async (req, res) => {
    try {
        await ensureTables();
        const userId = req.user.userId;
        const {
            activity_type = 'walk',
            duration_seconds = 0,
            distance_km = 0,
            calories_burned = 0,
            avg_speed_kmh = 0,
            path_coordinates
        } = req.body;

        if (!path_coordinates || !Array.isArray(path_coordinates) || path_coordinates.length < 2) {
            return res.status(400).json({ error: 'إحداثيات المسار غير صالحة أو غير كافية' });
        }

        const result = await pool.query(
            `INSERT INTO fitness_runs 
             (user_id, activity_type, duration_seconds, distance_km, calories_burned, avg_speed_kmh, path_coordinates)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [
                userId,
                activity_type,
                parseInt(duration_seconds) || 0,
                parseFloat(distance_km) || 0,
                parseInt(calories_burned) || 0,
                parseFloat(avg_speed_kmh) || 0,
                JSON.stringify(path_coordinates)
            ]
        );

        res.status(201).json({
            message: 'تم حفظ المسار بنجاح',
            run: result.rows[0]
        });
    } catch (err) {
        console.error('saveRun error:', err);
        res.status(500).json({ error: 'فشل في حفظ مسار اللياقة' });
    }
};

/**
 * جلب مسارات اللياقة النشطة (آخر 24 ساعة) للأصدقاء والمستخدم
 * GET /api/fitness/active
 */
const getFriendsActiveRuns = async (req, res) => {
    try {
        await ensureTables();
        const userId = req.user.userId;

        const result = await pool.query(
            `SELECT 
                r.id,
                r.user_id,
                r.activity_type,
                r.duration_seconds,
                r.distance_km,
                r.calories_burned,
                r.avg_speed_kmh,
                r.path_coordinates,
                r.created_at,
                u.username,
                u.full_name,
                u.profile_picture
             FROM fitness_runs r
             JOIN users u ON r.user_id = u.id
             WHERE r.created_at >= NOW() - INTERVAL '24 hours'
               AND (
                 r.user_id = $1 
                 OR r.user_id IN (
                     SELECT CASE WHEN user1_id = $1 THEN user2_id ELSE user1_id END 
                     FROM friendships 
                     WHERE user1_id = $1 OR user2_id = $1
                 )
               )
             ORDER BY r.created_at DESC
             LIMIT 100`,
            [userId]
        );

        const runs = result.rows.map(row => ({
            ...row,
            path_coordinates: typeof row.path_coordinates === 'string'
                ? JSON.parse(row.path_coordinates)
                : row.path_coordinates
        }));

        res.json({ runs });
    } catch (err) {
        console.error('getFriendsActiveRuns error:', err);
        res.status(500).json({ error: 'فشل في جلب مسارات اللياقة النشطة', runs: [] });
    }
};

module.exports = {
    saveRun,
    getFriendsActiveRuns
};
