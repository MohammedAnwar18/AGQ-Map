const pool = require('../config/database');

/**
 * جلب علامات الواقع المعزز القريبة جغرافياً من إحداثيات المستخدم الحالية
 */
const getNearbyARContents = async (req, res) => {
    try {
        const { lat, lng, radius = 2000 } = req.query; // نصف القطر الافتراضي 2 كم
        
        if (!lat || !lng) {
            return res.status(400).json({ error: 'Latitude and Longitude are required' });
        }

        const latitude = parseFloat(lat);
        const longitude = parseFloat(lng);
        const searchRadius = parseFloat(radius);

        if (isNaN(latitude) || isNaN(longitude) || isNaN(searchRadius)) {
            return res.status(400).json({ error: 'Invalid coordinates or radius provided' });
        }

        // استعلام مكاني متقدم لحساب المسافة الدقيقة لكل نقطة وجلب النقاط داخل النطاق المحدد فقط
        const sql = `
            SELECT id, latitude, longitude, title, content, shape, bearing, created_at, owner_id,
                   ROUND(ST_Distance(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography)::numeric, 1) as distance_meters
            FROM ar_contents
            WHERE ST_DWithin(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
            ORDER BY distance_meters ASC
            LIMIT 50
        `;

        const result = await pool.query(sql, [longitude, latitude, searchRadius]);
        res.json({ contents: result.rows });
    } catch (error) {
        console.error('Get nearby AR contents error:', error);
        res.status(500).json({ error: 'Failed to fetch nearby AR contents' });
    }
};

/**
 * إنشاء وحفظ علامة واقع معزز جديدة (للأدمن فقط)
 */
const createARContent = async (req, res) => {
    try {
        const { latitude, longitude, title, content, shape = 'crystal', bearing = 0 } = req.body;
        const ownerId = req.user?.id || req.user?.userId;

        if (!ownerId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // التحقق من الصلاحيات ديناميكياً من قاعدة البيانات لتجنب مشكلة الـ JWT القديمة
        const userCheck = await pool.query('SELECT role FROM users WHERE id = $1', [ownerId]);
        const dbRole = userCheck.rows[0]?.role;

        if (dbRole !== 'admin') {
            return res.status(403).json({ error: 'Only admins can author Spatial AR Content' });
        }

        const lat = parseFloat(latitude);
        const lon = parseFloat(longitude);
        const bear = parseFloat(bearing);

        if (isNaN(lat) || isNaN(lon)) {
            return res.status(400).json({ error: 'Invalid coordinates provided' });
        }

        if (!title) {
            return res.status(400).json({ error: 'Title is required' });
        }

        const sql = `
            INSERT INTO ar_contents (latitude, longitude, title, content, shape, bearing, owner_id, location)
            VALUES ($1, $2, $3, $4, $5, $6, $7, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography)
            RETURNING *, 0.0 as distance_meters
        `;

        const result = await pool.query(sql, [lat, lon, title, content || '', shape, isNaN(bear) ? 0 : bear, ownerId]);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Create AR content error:', error);
        res.status(500).json({ error: 'Failed to create spatial AR content' });
    }
};

/**
 * حذف علامة واقع معزز (للأدمن فقط)
 */
const deleteARContent = async (req, res) => {
    try {
        const arId = parseInt(req.params.id);
        const ownerId = req.user?.id || req.user?.userId;

        if (!ownerId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // التحقق من الصلاحيات ديناميكياً من قاعدة البيانات لتجنب مشكلة الـ JWT القديمة
        const userCheck = await pool.query('SELECT role FROM users WHERE id = $1', [ownerId]);
        const dbRole = userCheck.rows[0]?.role;

        if (dbRole !== 'admin') {
            return res.status(403).json({ error: 'Only admins can delete Spatial AR Content' });
        }

        if (isNaN(arId)) {
            return res.status(400).json({ error: 'Invalid AR content ID' });
        }

        const result = await pool.query('DELETE FROM ar_contents WHERE id = $1 RETURNING id', [arId]);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'AR content not found' });
        }

        res.json({ message: 'Spatial AR content deleted successfully', id: arId });
    } catch (error) {
        console.error('Delete AR content error:', error);
        res.status(500).json({ error: 'Failed to delete spatial AR content' });
    }
};

module.exports = {
    getNearbyARContents,
    createARContent,
    deleteARContent
};
