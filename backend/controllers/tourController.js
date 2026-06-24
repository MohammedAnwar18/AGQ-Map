const pool = require('../config/database');
const { uploadToCloud, deleteFileFromCloud } = require('../utils/storage');

/**
 * Get all virtual tours
 */
const getAllTours = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM virtual_tours ORDER BY created_at DESC');
        res.json({ tours: result.rows });
    } catch (error) {
        console.error('Error getting virtual tours:', error);
        res.status(500).json({ error: 'Failed to get virtual tours' });
    }
};

/**
 * Create a new virtual tour (Admin Only)
 */
const createTour = async (req, res) => {
    try {
        const { name, description, latitude, longitude } = req.body;
        
        if (!name || !latitude || !longitude) {
            return res.status(400).json({ error: 'Name, latitude, and longitude are required' });
        }

        if (!req.file) {
            return res.status(400).json({ error: '360 degree image file is required' });
        }

        // Upload image to Cloud (Cloudflare R2)
        const imageUrl = await uploadToCloud(req.file.buffer, req.file.originalname, req.file.mimetype);

        // Insert into database
        const result = await pool.query(
            `INSERT INTO virtual_tours (name, description, latitude, longitude, image_url, created_by)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [name, description || '', parseFloat(latitude), parseFloat(longitude), imageUrl, req.user.userId || req.user.id]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating virtual tour:', error);
        res.status(500).json({ error: 'Failed to create virtual tour' });
    }
};

/**
 * Delete a virtual tour (Admin Only)
 */
const deleteTour = async (req, res) => {
    try {
        const { id } = req.params;

        // Find the tour to get the image URL (for deletion from R2)
        const tourRes = await pool.query('SELECT image_url FROM virtual_tours WHERE id = $1', [id]);
        if (tourRes.rows.length === 0) {
            return res.status(404).json({ error: 'Virtual tour not found' });
        }

        const imageUrl = tourRes.rows[0].image_url;

        // Delete from database
        await pool.query('DELETE FROM virtual_tours WHERE id = $1', [id]);

        // Attempt to delete file from cloud storage
        if (imageUrl) {
            try {
                await deleteFileFromCloud(imageUrl);
            } catch (err) {
                console.error('Failed to delete file from R2:', err.message);
            }
        }

        res.json({ message: 'Virtual tour deleted successfully' });
    } catch (error) {
        console.error('Error deleting virtual tour:', error);
        res.status(500).json({ error: 'Failed to delete virtual tour' });
    }
};

/**
 * Proxy image from cloud storage to bypass CORS restrictions
 */
const proxyImage = async (req, res) => {
    try {
        const { url } = req.query;
        if (!url) {
            return res.status(400).send('URL is required');
        }

        const axios = require('axios');
        const response = await axios.get(url, { responseType: 'stream' });

        res.setHeader('Content-Type', response.headers['content-type'] || 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        
        response.data.pipe(res);
    } catch (error) {
        console.error('Proxy image error:', error.message);
        res.status(500).send('Error loading image');
    }
};

module.exports = {
    getAllTours,
    createTour,
    deleteTour,
    proxyImage
};
