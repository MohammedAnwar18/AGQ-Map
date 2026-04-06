const pool = require('../config/database');

// GET all historical maps for a community
const getHistoricalMaps = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            'SELECT * FROM community_historical_maps WHERE community_id = $1 ORDER BY sort_order ASC, year ASC',
            [id]
        );
        res.json({ maps: result.rows });
    } catch (error) {
        console.error('Get historical maps error:', error);
        res.status(500).json({ error: 'Server error getting historical maps' });
    }
};

// POST add a new historical map layer (admin only)
const addHistoricalMap = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, year, tile_url, center_lat, center_lng, default_zoom } = req.body;

        if (!name || !year || !tile_url) {
            return res.status(400).json({ error: 'name, year, and tile_url are required' });
        }

        // Get current max sort_order for this community
        const maxSort = await pool.query(
            'SELECT COALESCE(MAX(sort_order), -1) as max_order FROM community_historical_maps WHERE community_id = $1',
            [id]
        );
        const nextOrder = maxSort.rows[0].max_order + 1;

        const result = await pool.query(
            `INSERT INTO community_historical_maps (community_id, name, year, tile_url, sort_order, center_lat, center_lng, default_zoom)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [id, name, year, tile_url, nextOrder,
             center_lat ? parseFloat(center_lat) : null,
             center_lng ? parseFloat(center_lng) : null,
             default_zoom ? parseInt(default_zoom) : 8]
        );
        res.status(201).json({ map: result.rows[0] });
    } catch (error) {
        console.error('Add historical map error:', error);
        res.status(500).json({ error: 'Server error adding historical map' });
    }
};

// PUT update a historical map layer (admin only)
const updateHistoricalMap = async (req, res) => {
    try {
        const { mapId } = req.params;
        const { name, year, tile_url, center_lat, center_lng, default_zoom } = req.body;

        const result = await pool.query(
            `UPDATE community_historical_maps
             SET name = COALESCE($1, name),
                 year = COALESCE($2, year),
                 tile_url = COALESCE($3, tile_url),
                 center_lat = $4,
                 center_lng = $5,
                 default_zoom = COALESCE($6, default_zoom)
             WHERE id = $7
             RETURNING *`,
            [name, year, tile_url,
             center_lat ? parseFloat(center_lat) : null,
             center_lng ? parseFloat(center_lng) : null,
             default_zoom ? parseInt(default_zoom) : null,
             mapId]
        );
        res.json({ map: result.rows[0] });
    } catch (error) {
        console.error('Update historical map error:', error);
        res.status(500).json({ error: 'Server error updating historical map' });
    }
};

// DELETE a historical map layer (admin only)
const deleteHistoricalMap = async (req, res) => {
    try {
        const { mapId } = req.params;
        await pool.query('DELETE FROM community_historical_maps WHERE id = $1', [mapId]);
        res.json({ message: 'Historical map deleted successfully' });
    } catch (error) {
        console.error('Delete historical map error:', error);
        res.status(500).json({ error: 'Server error deleting historical map' });
    }
};

module.exports = { getHistoricalMaps, addHistoricalMap, deleteHistoricalMap, updateHistoricalMap };
