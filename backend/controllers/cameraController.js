const pool = require('../config/database');

// ─── GET /api/cameras  ────────────────────────────────────────────────────────
const getAllCameras = async (req, res) => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS cameras (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                stream_url TEXT NOT NULL,
                location_name VARCHAR(255),
                latitude FLOAT,
                longitude FLOAT,
                crop_position VARCHAR(50) DEFAULT 'full',
                created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        const result = await pool.query(
            'SELECT * FROM cameras ORDER BY created_at DESC'
        );
        if (result.rows.length === 0) {
            await pool.query(
                `INSERT INTO cameras (name, stream_url, location_name, latitude, longitude, crop_position)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                    'كاميرا بلدية رام الله المباشرة',
                    'https://htvint.mada.ps/RamallahMunicipality/index.m3u8',
                    'رام الله - ميدان البلدية',
                    31.9060,
                    35.2053,
                    'full'
                ]
            );
            const updated = await pool.query('SELECT * FROM cameras ORDER BY created_at DESC');
            return res.json({ cameras: updated.rows });
        }
        res.json({ cameras: result.rows });
    } catch (err) {
        console.error('getAllCameras error:', err);
        res.status(500).json({ error: 'فشل في جلب الكاميرات' });
    }
};

// ─── POST /api/cameras  ───────────────────────────────────────────────────────
const createCamera = async (req, res) => {
    try {
        const { name, stream_url, location_name, latitude, longitude, crop_position } = req.body;
        if (!name || !stream_url) {
            return res.status(400).json({ error: 'الاسم ورابط البث مطلوبان' });
        }
        const result = await pool.query(
            `INSERT INTO cameras (name, stream_url, location_name, latitude, longitude, crop_position, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [name, stream_url, location_name || null, latitude || null, longitude || null, crop_position || 'full', req.user?.userId || null]
        );
        res.status(201).json({ camera: result.rows[0] });
    } catch (err) {
        console.error('createCamera error:', err);
        res.status(500).json({ error: 'فشل في إنشاء الكاميرا' });
    }
};

// ─── DELETE /api/cameras/:id  ─────────────────────────────────────────────────
const deleteCamera = async (req, res) => {
    try {
        const { id } = req.params;
        const cam = await pool.query('SELECT * FROM cameras WHERE id = $1', [id]);
        if (cam.rows.length === 0) return res.status(404).json({ error: 'الكاميرا غير موجودة' });
        if (req.user?.role !== 'admin' && cam.rows[0].created_by !== req.user?.userId) {
            return res.status(403).json({ error: 'غير مصرح' });
        }
        await pool.query('DELETE FROM cameras WHERE id = $1', [id]);
        res.json({ message: 'تم حذف الكاميرا' });
    } catch (err) {
        console.error('deleteCamera error:', err);
        res.status(500).json({ error: 'فشل في حذف الكاميرا' });
    }
};

// ─── PUT /api/cameras/:id  ────────────────────────────────────────────────────
const updateCamera = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, stream_url, location_name, latitude, longitude, crop_position } = req.body;
        const result = await pool.query(
            `UPDATE cameras SET
                name = COALESCE($1, name),
                stream_url = COALESCE($2, stream_url),
                location_name = COALESCE($3, location_name),
                latitude = COALESCE($4, latitude),
                longitude = COALESCE($5, longitude),
                crop_position = COALESCE($6, crop_position)
             WHERE id = $7
             RETURNING *`,
            [name, stream_url, location_name, latitude, longitude, crop_position, id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'الكاميرا غير موجودة' });
        res.json({ camera: result.rows[0] });
    } catch (err) {
        console.error('updateCamera error:', err);
        res.status(500).json({ error: 'فشل في تحديث الكاميرا' });
    }
};

module.exports = { getAllCameras, createCamera, deleteCamera, updateCamera };
