const pool = require('../config/database');
const { uploadToCloud, deleteFileFromCloud } = require('../utils/storage');

// Helper to generate slug
const generateSlug = () => {
    return Math.random().toString(36).substring(2, 8) + Date.now().toString(36).substring(4, 8);
};

/**
     * Get all digital letters (Admin only)
 */
const getAllLetters = async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM digital_letters ORDER BY created_at DESC'
        );
        res.json({ success: true, letters: result.rows });
    } catch (err) {
        console.error('Error fetching letters:', err);
        res.status(500).json({ error: 'Failed to fetch letters' });
    }
};

/**
 * Get digital letter by slug (Public)
 */
const getLetterBySlug = async (req, res) => {
    try {
        const { slug } = req.params;
        const result = await pool.query(
            'SELECT * FROM digital_letters WHERE slug = $1',
            [slug]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Letter not found' });
        }
        res.json({ success: true, letter: result.rows[0] });
    } catch (err) {
        console.error('Error fetching letter by slug:', err);
        res.status(500).json({ error: 'Failed to fetch letter' });
    }
};

/**
 * Create a new digital letter (Admin only)
 */
const createLetter = async (req, res) => {
    try {
        const { 
            title, 
            sender_name, 
            recipient_name, 
            content, 
            envelope_color, 
            seal_design, 
            slug: customSlug,
            music_url: customMusicUrl
        } = req.body;

        const userId = req.user.userId;

        // Generate or sanitize slug
        let slug = customSlug ? customSlug.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-') : generateSlug();
        if (!slug) slug = generateSlug();

        // Check if slug is unique
        const checkSlug = await pool.query('SELECT id FROM digital_letters WHERE slug = $1', [slug]);
        if (checkSlug.rows.length > 0) {
            return res.status(400).json({ error: 'Slug must be unique' });
        }

        let image_url = null;
        let music_url = customMusicUrl || null;

        // Handle file uploads (image and music/audio)
        if (req.files) {
            if (req.files.image && req.files.image[0]) {
                const imgFile = req.files.image[0];
                image_url = await uploadToCloud(imgFile.buffer, imgFile.originalname, imgFile.mimetype);
            }
            if (req.files.music && req.files.music[0]) {
                const musicFile = req.files.music[0];
                music_url = await uploadToCloud(musicFile.buffer, musicFile.originalname, musicFile.mimetype);
            }
        }

        const result = await pool.query(
            `INSERT INTO digital_letters 
                (slug, title, sender_name, recipient_name, content, image_url, music_url, envelope_color, seal_design, created_by)
             VALUES 
                ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             RETURNING *`,
            [
                slug, 
                title || 'دعوة خاصة', 
                sender_name || null, 
                recipient_name || null, 
                content || null, 
                image_url, 
                music_url, 
                envelope_color || 'maroon', 
                seal_design || 'wax-classic', 
                userId
            ]
        );

        res.status(201).json({ success: true, letter: result.rows[0] });
    } catch (err) {
        console.error('Error creating digital letter:', err);
        res.status(500).json({ error: 'Failed to create digital letter' });
    }
};

/**
 * Update an existing digital letter (Admin only)
 */
const updateLetter = async (req, res) => {
    try {
        const { id } = req.params;
        const { 
            title, 
            sender_name, 
            recipient_name, 
            content, 
            envelope_color, 
            seal_design, 
            slug: customSlug,
            music_url: customMusicUrl
        } = req.body;

        // Check if letter exists
        const letterResult = await pool.query('SELECT * FROM digital_letters WHERE id = $1', [id]);
        if (letterResult.rows.length === 0) {
            return res.status(404).json({ error: 'Letter not found' });
        }
        const existingLetter = letterResult.rows[0];

        // Validate slug if changed
        let slug = existingLetter.slug;
        if (customSlug && customSlug !== existingLetter.slug) {
            slug = customSlug.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-');
            const checkSlug = await pool.query('SELECT id FROM digital_letters WHERE slug = $1 AND id <> $2', [slug, id]);
            if (checkSlug.rows.length > 0) {
                return res.status(400).json({ error: 'Slug must be unique' });
            }
        }

        let image_url = existingLetter.image_url;
        let music_url = customMusicUrl !== undefined ? customMusicUrl : existingLetter.music_url;

        // Handle file uploads
        if (req.files) {
            if (req.files.image && req.files.image[0]) {
                // Delete old image
                if (existingLetter.image_url) {
                    await deleteFileFromCloud(existingLetter.image_url);
                }
                const imgFile = req.files.image[0];
                image_url = await uploadToCloud(imgFile.buffer, imgFile.originalname, imgFile.mimetype);
            }
            if (req.files.music && req.files.music[0]) {
                // Delete old music
                if (existingLetter.music_url) {
                    await deleteFileFromCloud(existingLetter.music_url);
                }
                const musicFile = req.files.music[0];
                music_url = await uploadToCloud(musicFile.buffer, musicFile.originalname, musicFile.mimetype);
            }
        }

        const result = await pool.query(
            `UPDATE digital_letters 
             SET slug = $1, title = $2, sender_name = $3, recipient_name = $4, content = $5, 
                 image_url = $6, music_url = $7, envelope_color = $8, seal_design = $9
             WHERE id = $10
             RETURNING *`,
            [
                slug,
                title || existingLetter.title,
                sender_name !== undefined ? sender_name : existingLetter.sender_name,
                recipient_name !== undefined ? recipient_name : existingLetter.recipient_name,
                content !== undefined ? content : existingLetter.content,
                image_url,
                music_url,
                envelope_color || existingLetter.envelope_color,
                seal_design || existingLetter.seal_design,
                id
            ]
        );

        res.json({ success: true, letter: result.rows[0] });
    } catch (err) {
        console.error('Error updating digital letter:', err);
        res.status(500).json({ error: 'Failed to update digital letter' });
    }
};

/**
 * Delete a digital letter (Admin only)
 */
const deleteLetter = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if letter exists
        const letterResult = await pool.query('SELECT * FROM digital_letters WHERE id = $1', [id]);
        if (letterResult.rows.length === 0) {
            return res.status(404).json({ error: 'Letter not found' });
        }
        const existingLetter = letterResult.rows[0];

        // Delete associated files
        if (existingLetter.image_url) {
            await deleteFileFromCloud(existingLetter.image_url);
        }
        if (existingLetter.music_url) {
            await deleteFileFromCloud(existingLetter.music_url);
        }

        await pool.query('DELETE FROM digital_letters WHERE id = $1', [id]);

        res.json({ success: true, message: 'Digital letter deleted successfully' });
    } catch (err) {
        console.error('Error deleting digital letter:', err);
        res.status(500).json({ error: 'Failed to delete digital letter' });
    }
};

module.exports = {
    getAllLetters,
    getLetterBySlug,
    createLetter,
    updateLetter,
    deleteLetter
};
