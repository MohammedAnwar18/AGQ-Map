/*
 * ───────────────────────────────────────────────────────────────────────────
 *  طبقة «الرؤية الجوّية» (Aerial / Drone layer)
 * ───────────────────────────────────────────────────────────────────────────
 *
 *  نقاط بانوراما 360° مربوطة بإحداثياتٍ على الخريطة لا بمحلّ. كل نقطة
 *  (منطادٌ على الخريطة) تحمل صورةً كرويّة واحدة، وداخلها «نقاط» (hotspots)
 *  من نوع معلومة تحمل عنواناً ونصّاً وصورةً اختيارية — تماماً كبانوراما
 *  المحلّات لكنها مستقلّة عنها بجدولَيْها الخاصّين، فلا تمسّ نظام المحلّات.
 *
 *  القراءة متاحة لأي زائر (الطبقة تظهر للأدمن وحده في الواجهة)، والكتابة
 *  للأدمن العام وحده عبر وسيط ‎isAdmin‎ في المسارات.
 */

const pool = require('../config/database');
const { uploadToCloud } = require('../utils/storage');

// ── قراءة كل النقاط الجوّية مع نقاطها الداخلية ────────────────────────────
const listAerial = async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM aerial_panoramas ORDER BY created_at ASC'
        );
        const panoramas = result.rows;

        if (panoramas.length > 0) {
            const ids = panoramas.map(p => p.id);
            const hsRes = await pool.query(
                'SELECT * FROM aerial_hotspots WHERE panorama_id = ANY($1) ORDER BY id ASC',
                [ids]
            );
            const byPanorama = {};
            for (const hs of hsRes.rows) {
                if (!byPanorama[hs.panorama_id]) byPanorama[hs.panorama_id] = [];
                byPanorama[hs.panorama_id].push(hs);
            }
            for (const pano of panoramas) {
                pano.hotspots = byPanorama[pano.id] || [];
            }
        }

        res.json({ panoramas });
    } catch (e) {
        console.error('listAerial error:', e);
        res.status(500).json({ error: 'Failed to get aerial panoramas' });
    }
};

// ── إنشاء نقطةٍ جوّية جديدة (صورة 360 + إحداثيات) ─────────────────────────
const createAerial = async (req, res) => {
    try {
        const { title, latitude, longitude, equirect_url, thumbnail_url } = req.body;

        const lat = parseFloat(latitude);
        const lon = parseFloat(longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
            return res.status(400).json({ error: 'latitude and longitude are required' });
        }

        let finalEquirectUrl = equirect_url || null;
        let finalThumbnailUrl = thumbnail_url || null;

        if (req.files) {
            if (req.files.thumbnail_file) {
                const file = req.files.thumbnail_file[0];
                finalThumbnailUrl = await uploadToCloud(file.buffer, file.originalname, file.mimetype);
            }
            if (req.files.equirect_file) {
                const file = req.files.equirect_file[0];
                finalEquirectUrl = await uploadToCloud(file.buffer, file.originalname, file.mimetype);
            }
        }

        if (!finalEquirectUrl) {
            return res.status(400).json({ error: 'Equirectangular image/URL is required' });
        }
        if (!finalThumbnailUrl) finalThumbnailUrl = finalEquirectUrl;

        const createdBy = req.user ? (req.user.userId || req.user.id || null) : null;

        const result = await pool.query(
            `INSERT INTO aerial_panoramas (title, latitude, longitude, equirect_url, thumbnail_url, created_by)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [title || null, lat, lon, finalEquirectUrl, finalThumbnailUrl, createdBy]
        );
        res.status(201).json({ ...result.rows[0], hotspots: [] });
    } catch (e) {
        console.error('createAerial error:', e);
        res.status(500).json({ error: 'Failed to create aerial panorama' });
    }
};

// ── تعديل نقطةٍ جوّية (عنوان / إحداثيات) ──────────────────────────────────
const updateAerial = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, latitude, longitude } = req.body;

        const existingRes = await pool.query('SELECT * FROM aerial_panoramas WHERE id = $1', [id]);
        if (existingRes.rows.length === 0) return res.status(404).json({ error: 'Not found' });
        const existing = existingRes.rows[0];

        const lat = latitude !== undefined ? parseFloat(latitude) : existing.latitude;
        const lon = longitude !== undefined ? parseFloat(longitude) : existing.longitude;

        const result = await pool.query(
            `UPDATE aerial_panoramas
             SET title = $1, latitude = $2, longitude = $3
             WHERE id = $4 RETURNING *`,
            [title !== undefined ? title : existing.title, lat, lon, id]
        );
        res.json(result.rows[0]);
    } catch (e) {
        console.error('updateAerial error:', e);
        res.status(500).json({ error: 'Failed to update aerial panorama' });
    }
};

// ── حذف نقطةٍ جوّية (وكل نقاطها بالتتالي) ─────────────────────────────────
const deleteAerial = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM aerial_panoramas WHERE id = $1', [id]);
        res.json({ message: 'Deleted' });
    } catch (e) {
        console.error('deleteAerial error:', e);
        res.status(500).json({ error: 'Failed to delete aerial panorama' });
    }
};

// ── إضافة نقطة داخلية (صورة/نص) على الصورة الجوّية ────────────────────────
const addAerialHotspot = async (req, res) => {
    try {
        const { id } = req.params;
        const { type, pos_x, pos_y, label, value, image_url } = req.body;

        const panoRes = await pool.query('SELECT id FROM aerial_panoramas WHERE id = $1', [id]);
        if (panoRes.rows.length === 0) return res.status(404).json({ error: 'Panorama not found' });

        if (pos_x === undefined || pos_y === undefined) {
            return res.status(400).json({ error: 'pos_x and pos_y are required' });
        }

        let imageUrl = image_url || null;
        if (req.file) {
            imageUrl = await uploadToCloud(req.file.buffer, req.file.originalname, req.file.mimetype);
        }

        const result = await pool.query(
            `INSERT INTO aerial_hotspots (panorama_id, type, pos_x, pos_y, label, value, image_url)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [id, type || 'info', pos_x, pos_y, label || null, value || null, imageUrl]
        );
        res.status(201).json(result.rows[0]);
    } catch (e) {
        console.error('addAerialHotspot error:', e);
        res.status(500).json({ error: 'Failed to add hotspot' });
    }
};

// ── تعديل نقطة داخلية ─────────────────────────────────────────────────────
const updateAerialHotspot = async (req, res) => {
    try {
        const { hotspotId } = req.params;
        const { type, pos_x, pos_y, label, value, image_url } = req.body;

        const existingRes = await pool.query('SELECT * FROM aerial_hotspots WHERE id = $1', [hotspotId]);
        if (existingRes.rows.length === 0) return res.status(404).json({ error: 'Hotspot not found' });
        const existing = existingRes.rows[0];

        let imageUrl = image_url !== undefined ? (image_url || null) : existing.image_url;
        if (req.file) {
            imageUrl = await uploadToCloud(req.file.buffer, req.file.originalname, req.file.mimetype);
        }

        const result = await pool.query(
            `UPDATE aerial_hotspots
             SET type = $1, pos_x = $2, pos_y = $3, label = $4, value = $5, image_url = $6
             WHERE id = $7 RETURNING *`,
            [
                type ?? existing.type,
                pos_x ?? existing.pos_x,
                pos_y ?? existing.pos_y,
                label ?? existing.label,
                value ?? existing.value,
                imageUrl,
                hotspotId
            ]
        );
        res.json(result.rows[0]);
    } catch (e) {
        console.error('updateAerialHotspot error:', e);
        res.status(500).json({ error: 'Failed to update hotspot' });
    }
};

// ── حذف نقطة داخلية ───────────────────────────────────────────────────────
const deleteAerialHotspot = async (req, res) => {
    try {
        const { hotspotId } = req.params;
        await pool.query('DELETE FROM aerial_hotspots WHERE id = $1', [hotspotId]);
        res.json({ message: 'Hotspot deleted' });
    } catch (e) {
        console.error('deleteAerialHotspot error:', e);
        res.status(500).json({ error: 'Failed to delete hotspot' });
    }
};

module.exports = {
    listAerial,
    createAerial,
    updateAerial,
    deleteAerial,
    addAerialHotspot,
    updateAerialHotspot,
    deleteAerialHotspot
};
