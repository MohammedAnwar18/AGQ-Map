const pool = require('../config/database');

exports.createNews = async (req, res) => {
    try {
        const adminId = req.user.userId;
        const { title, description, latitude, longitude } = req.body;

        if (!title || !description || !latitude || !longitude) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const image = req.file ? req.file.path : null;

        const result = await pool.query(
            `INSERT INTO local_news (admin_id, title, description, image, location) 
             VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326)) 
             RETURNING id, title, description, image, ST_X(location::geometry) as longitude, ST_Y(location::geometry) as latitude, created_at`,
            [adminId, title, description, image, longitude, latitude]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Create news error:', error);
        res.status(500).json({ error: 'Failed to create news' });
    }
};

exports.getNews = async (req, res) => {
    try {
        const { lat, lon, radius = 5000 } = req.query; // Default 5km radius

        if (!lat || !lon) {
            return res.status(400).json({ error: 'Missing location parameters' });
        }

        const query = `
            SELECT id, title, description, image, 
                   ST_X(location::geometry) as longitude, ST_Y(location::geometry) as latitude, 
                   created_at
            FROM local_news
            WHERE ST_DWithin(
                location::geography,
                ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
                $3
            )
            ORDER BY created_at DESC
            LIMIT 50
        `;

        const result = await pool.query(query, [lon, lat, radius]);

        res.json({
            location: 'Local Region',
            articles: result.rows.map(row => ({
                id: row.id,
                title: row.title,
                description: row.description,
                image: row.image,
                publishedAt: row.created_at,
                source: { name: 'Local News' },
                url: '#', // internal URL
                latitude: row.latitude,
                longitude: row.longitude
            }))
        });

    } catch (error) {
        console.error('Fetch news error:', error);
        res.status(500).json({ error: 'Failed to fetch news' });
    }
};
