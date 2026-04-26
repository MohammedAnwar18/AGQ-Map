const pool = require('../config/database');
const { uploadToCloud } = require('../utils/storage');

const magazineController = {
    // Get all published magazines
    getMagazines: async (req, res) => {
        try {
            const result = await pool.query('SELECT * FROM magazines WHERE is_published = TRUE ORDER BY created_at DESC');
            res.json(result.rows);
        } catch (error) {
            console.error('Get magazines error:', error);
            res.status(500).json({ error: 'Failed to fetch magazines' });
        }
    },

    // Get all magazines (Admin only)
    getAllMagazines: async (req, res) => {
        try {
            const result = await pool.query('SELECT * FROM magazines ORDER BY created_at DESC');
            res.json(result.rows);
        } catch (error) {
            console.error('Get all magazines error:', error);
            res.status(500).json({ error: 'Failed to fetch magazines' });
        }
    },

    // Get magazine with pages
    getMagazineById: async (req, res) => {
        try {
            const { id } = req.params;
            const magResult = await pool.query('SELECT * FROM magazines WHERE id = $1', [id]);
            if (magResult.rows.length === 0) return res.status(404).json({ error: 'Magazine not found' });

            const pagesResult = await pool.query('SELECT * FROM magazine_pages WHERE magazine_id = $1 ORDER BY page_number ASC', [id]);
            
            res.json({
                magazine: magResult.rows[0],
                pages: pagesResult.rows
            });
        } catch (error) {
            console.error('Get magazine by ID error:', error);
            res.status(500).json({ error: 'Failed to fetch magazine details' });
        }
    },

    // Create magazine (Admin only)
    createMagazine: async (req, res) => {
        try {
            const { title, description } = req.body;
            const result = await pool.query(
                'INSERT INTO magazines (title, description) VALUES ($1, $2) RETURNING *',
                [title, description]
            );
            res.status(201).json(result.rows[0]);
        } catch (error) {
            console.error('Create magazine error:', error);
            res.status(500).json({ error: 'Failed to create magazine' });
        }
    },

    // Update magazine info
    updateMagazine: async (req, res) => {
        try {
            const { id } = req.params;
            const { title, description, is_published } = req.body;
            
            const result = await pool.query(
                'UPDATE magazines SET title = $1, description = $2, is_published = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *',
                [title, description, is_published, id]
            );
            
            if (result.rows.length === 0) return res.status(404).json({ error: 'Magazine not found' });
            res.json(result.rows[0]);
        } catch (error) {
            console.error('Update magazine error:', error);
            res.status(500).json({ error: 'Failed to update magazine' });
        }
    },

    // Delete magazine
    deleteMagazine: async (req, res) => {
        try {
            const { id } = req.params;
            await pool.query('DELETE FROM magazines WHERE id = $1', [id]);
            res.json({ message: 'Magazine deleted successfully' });
        } catch (error) {
            console.error('Delete magazine error:', error);
            res.status(500).json({ error: 'Failed to delete magazine' });
        }
    },

    // Save/Update Page
    savePage: async (req, res) => {
        try {
            const { magazineId, pageNumber, content } = req.body;
            
            const result = await pool.query(
                `INSERT INTO magazine_pages (magazine_id, page_number, content, updated_at)
                 VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
                 ON CONFLICT (magazine_id, page_number)
                 DO UPDATE SET content = $3, updated_at = CURRENT_TIMESTAMP
                 RETURNING *`,
                [magazineId, pageNumber, JSON.stringify(content)]
            );
            
            res.json(result.rows[0]);
        } catch (error) {
            console.error('Save page error:', error);
            res.status(500).json({ error: 'Failed to save page' });
        }
    },

    // Upload Image
    uploadImage: async (req, res) => {
        try {
            if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
            const url = await uploadToCloud(req.file.buffer, req.file.originalname, req.file.mimetype);
            res.json({ url });
        } catch (error) {
            console.error('Magazine image upload error:', error);
            res.status(500).json({ error: 'Failed to upload image' });
        }
    },

    // Set Cover Image
    setCoverImage: async (req, res) => {
        try {
            const { id } = req.params;
            if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
            const url = await uploadToCloud(req.file.buffer, req.file.originalname, req.file.mimetype);
            
            await pool.query('UPDATE magazines SET cover_image = $1 WHERE id = $2', [url, id]);
            res.json({ url });
        } catch (error) {
            console.error('Set cover image error:', error);
            res.status(500).json({ error: 'Failed to upload cover' });
        }
    }
};

module.exports = magazineController;
