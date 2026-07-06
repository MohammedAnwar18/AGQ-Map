const pool = require('../config/database');
const { uploadToCloud } = require('../utils/storage');

/**
 * Get all photos for an event (Public)
 */
const getEventPhotos = async (req, res) => {
    try {
        const { eventSlug } = req.params;
        const slug = eventSlug || 'enas-graduation';
        
        const result = await pool.query(
            'SELECT * FROM event_photos WHERE event_slug = $1 ORDER BY created_at DESC',
            [slug]
        );
        
        res.json({ success: true, photos: result.rows });
    } catch (err) {
        console.error('Error fetching event photos:', err);
        res.status(500).json({ error: 'Failed to fetch photos' });
    }
};

/**
 * Upload a photo for an event (Public/Guest)
 */
const uploadEventPhoto = async (req, res) => {
    try {
        const { eventSlug, uploader, caption } = req.body;
        const slug = eventSlug || 'enas-graduation';
        
        if (!req.file) {
            return res.status(400).json({ error: 'No image file uploaded' });
        }
        
        // Upload photo to cloud/local fallback
        const imageUrl = await uploadToCloud(req.file.buffer, req.file.originalname, req.file.mimetype);
        
        const uploaderName = uploader ? uploader.trim() : 'ضيف بالنوفا';
        
        const result = await pool.query(
            `INSERT INTO event_photos (event_slug, image_url, uploader, caption)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [slug, imageUrl, uploaderName, caption || null]
        );
        
        res.status(201).json({ success: true, photo: result.rows[0] });
    } catch (err) {
        console.error('Error uploading event photo:', err);
        res.status(500).json({ error: 'Failed to upload photo' });
    }
};

module.exports = {
    getEventPhotos,
    uploadEventPhoto
};
