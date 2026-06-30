const pool = require('../config/database');
const { uploadToCloud, deleteFileFromCloud } = require('../utils/storage');

// 1. Get all 3D models on the map
exports.getModels = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM map_3d_models ORDER BY id DESC');
        res.json({ success: true, models: result.rows });
    } catch (err) {
        console.error('getModels error:', err);
        res.status(500).json({ error: 'فشل في جلب قائمة المجسمات ثلاثية الأبعاد' });
    }
};

// 2. Upload and save a new 3D model
exports.uploadModel = async (req, res) => {
    try {
        const { name, latitude, longitude, altitude, scale, rotation_x, rotation_y, rotation_z } = req.body;

        if (!req.file) {
            return res.status(400).json({ error: 'يجب اختيار ملف المجسم ثلاثي الأبعاد' });
        }

        if (!name || !latitude || !longitude) {
            return res.status(400).json({ error: 'الاسم والموقع الجغرافي مطلبان أساسيان' });
        }

        // Upload to Cloud (R2)
        const fileUrl = await uploadToCloud(req.file.buffer, req.file.originalname, req.file.mimetype);

        const result = await pool.query(
            `INSERT INTO map_3d_models (name, model_url, latitude, longitude, altitude, scale, rotation_x, rotation_y, rotation_z)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
            [
                name,
                fileUrl,
                parseFloat(latitude),
                parseFloat(longitude),
                parseFloat(altitude || 0),
                parseFloat(scale || 1),
                parseFloat(rotation_x || 0),
                parseFloat(rotation_y || 0),
                parseFloat(rotation_z || 0)
            ]
        );

        res.status(201).json({ success: true, model: result.rows[0] });
    } catch (err) {
        console.error('uploadModel error:', err);
        res.status(500).json({ error: 'فشل في رفع وحفظ المجسم ثلاثي الأبعاد' });
    }
};

// 3. Update 3D model properties (position, scale, rotation)
exports.updateModel = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, latitude, longitude, altitude, scale, rotation_x, rotation_y, rotation_z } = req.body;

        const result = await pool.query(
            `UPDATE map_3d_models 
             SET name = $1, latitude = $2, longitude = $3, altitude = $4, scale = $5, rotation_x = $6, rotation_y = $7, rotation_z = $8
             WHERE id = $9 RETURNING *`,
            [
                name,
                parseFloat(latitude),
                parseFloat(longitude),
                parseFloat(altitude),
                parseFloat(scale),
                parseFloat(rotation_x),
                parseFloat(rotation_y),
                parseFloat(rotation_z),
                id
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'المجسم غير موجود' });
        }

        res.json({ success: true, model: result.rows[0] });
    } catch (err) {
        console.error('updateModel error:', err);
        res.status(500).json({ error: 'فشل في تحديث بيانات المجسم ثلاثي الأبعاد' });
    }
};

// 4. Delete a 3D model
exports.deleteModel = async (req, res) => {
    try {
        const { id } = req.params;

        // Get model URL to delete from R2
        const modelRes = await pool.query('SELECT model_url FROM map_3d_models WHERE id = $1', [id]);
        if (modelRes.rows.length === 0) {
            return res.status(404).json({ error: 'المجسم غير موجود' });
        }

        const modelUrl = modelRes.rows[0].model_url;
        if (modelUrl) {
            try {
                await deleteFileFromCloud(modelUrl);
            } catch (storageErr) {
                console.error('Failed to delete file from cloud:', storageErr);
            }
        }

        await pool.query('DELETE FROM map_3d_models WHERE id = $1', [id]);
        res.json({ success: true, message: 'تم حذف المجسم ثلاثي الأبعاد بنجاح' });
    } catch (err) {
        console.error('deleteModel error:', err);
        res.status(500).json({ error: 'فشل في حذف المجسم ثلاثي الأبعاد' });
    }
};

const axios = require('axios');
exports.proxyModel = async (req, res) => {
    try {
        const { url } = req.query;
        if (!url) {
            return res.status(400).json({ error: 'مطلوب رابط المجسم' });
        }

        const response = await axios({
            method: 'get',
            url: url,
            responseType: 'stream'
        });

        res.setHeader('Content-Type', response.headers['content-type'] || 'application/octet-stream');
        if (response.headers['content-length']) {
            res.setHeader('Content-Length', response.headers['content-length']);
        }

        response.data.pipe(res);
    } catch (err) {
        console.error('Proxy error:', err.message);
        res.status(500).json({ error: 'فشل في جلب ملف المجسم عبر البروكسي' });
    }
};
