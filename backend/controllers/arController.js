const pool = require('../config/database');

const getNearbyARContents = async (req, res) => {
    try {
        const { lat, lng, radius = 100 } = req.query; // default 100m — proximity mode
        if (!lat || !lng) return res.status(400).json({ error: 'Latitude and Longitude are required' });

        const latitude     = parseFloat(lat);
        const longitude    = parseFloat(lng);
        const searchRadius = Math.min(parseFloat(radius), 5000); // max 5 km

        if (isNaN(latitude) || isNaN(longitude) || isNaN(searchRadius))
            return res.status(400).json({ error: 'Invalid coordinates' });

        // Haversine filter (no PostGIS needed)
        const sql = `
            SELECT id,
                   latitude::float8  AS latitude,
                   longitude::float8 AS longitude,
                   title, content, shape,
                   bearing::float8 AS bearing,
                   COALESCE(pitch::float8, 90) AS pitch,
                   created_at, owner_id,
                   ROUND((6371000 * acos(LEAST(1, GREATEST(-1,
                       cos(radians($1)) * cos(radians(latitude)) * cos(radians(longitude) - radians($2)) +
                       sin(radians($1)) * sin(radians(latitude))
                   ))))::numeric, 2) AS distance_meters
            FROM ar_contents
            WHERE (6371000 * acos(LEAST(1, GREATEST(-1,
                       cos(radians($1)) * cos(radians(latitude)) * cos(radians(longitude) - radians($2)) +
                       sin(radians($1)) * sin(radians(latitude))
                   )))) <= $3
            ORDER BY distance_meters ASC
            LIMIT 100
        `;

        const result = await pool.query(sql, [latitude, longitude, searchRadius]);
        res.json({ contents: result.rows });
    } catch (err) {
        console.error('Get nearby AR contents error:', err);
        res.status(500).json({ error: 'Failed to fetch nearby AR contents' });
    }
};

const createARContent = async (req, res) => {
    try {
        const {
            latitude, longitude,
            title, content,
            bearing = 0,
            pitch   = 90,  // default = horizontal (phone vertical)
        } = req.body;

        const ownerId = req.user?.id || req.user?.userId;
        if (!ownerId) return res.status(401).json({ error: 'Unauthorized' });

        const userCheck = await pool.query('SELECT role FROM users WHERE id = $1', [ownerId]);
        if (userCheck.rows[0]?.role !== 'admin')
            return res.status(403).json({ error: 'Only admins can publish AR content' });

        const lat   = parseFloat(latitude);
        const lon   = parseFloat(longitude);
        const bear  = parseFloat(bearing);
        const pit   = parseFloat(pitch);

        if (isNaN(lat) || isNaN(lon)) return res.status(400).json({ error: 'Invalid coordinates' });
        if (!title?.trim())            return res.status(400).json({ error: 'Title is required' });

        const sql = `
            INSERT INTO ar_contents (latitude, longitude, title, content, shape, bearing, pitch, owner_id)
            VALUES ($1, $2, $3, $4, 'panel', $5, $6, $7)
            RETURNING
                id,
                latitude::float8  AS latitude,
                longitude::float8 AS longitude,
                title, content, shape,
                bearing::float8 AS bearing,
                pitch::float8   AS pitch,
                created_at, owner_id,
                0.0 AS distance_meters
        `;

        const result = await pool.query(sql, [
            lat, lon,
            title.trim(),
            content?.trim() || '',
            isNaN(bear) ? 0   : bear,
            isNaN(pit)  ? 90  : pit,
            ownerId,
        ]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Create AR content error:', err);
        res.status(500).json({ error: 'Failed to create spatial AR content' });
    }
};

const deleteARContent = async (req, res) => {
    try {
        const arId    = parseInt(req.params.id);
        const ownerId = req.user?.id || req.user?.userId;
        if (!ownerId) return res.status(401).json({ error: 'Unauthorized' });

        const userCheck = await pool.query('SELECT role FROM users WHERE id = $1', [ownerId]);
        if (userCheck.rows[0]?.role !== 'admin')
            return res.status(403).json({ error: 'Only admins can delete AR content' });

        if (isNaN(arId)) return res.status(400).json({ error: 'Invalid AR content ID' });

        const result = await pool.query('DELETE FROM ar_contents WHERE id = $1 RETURNING id', [arId]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'AR content not found' });

        res.json({ message: 'Deleted', id: arId });
    } catch (err) {
        console.error('Delete AR content error:', err);
        res.status(500).json({ error: 'Failed to delete AR content' });
    }
};

module.exports = { getNearbyARContents, createARContent, deleteARContent };
