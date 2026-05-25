const pool = require('../config/database');

// --- 1. Get All Cameras ---
const getAllCameras = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM live_cameras ORDER BY created_at DESC');
        res.json({ cameras: result.rows });
    } catch (error) {
        console.error('Get all cameras error:', error);
        res.status(500).json({ error: 'Failed to fetch live cameras' });
    }
};

// --- 2. Create Camera ---
const createCamera = async (req, res) => {
    try {
        const { name, latitude, longitude, stream_url, crop_position } = req.body;
        const userId = req.user.id || req.user.userId;

        const lat = parseFloat(latitude);
        const lon = parseFloat(longitude);

        if (!name || isNaN(lat) || isNaN(lon) || !stream_url) {
            return res.status(400).json({ error: 'Invalid camera data or coordinates' });
        }

        const result = await pool.query(`
            INSERT INTO live_cameras (name, latitude, longitude, stream_url, crop_position, created_by)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [name, lat, lon, stream_url, crop_position || 'full', userId]);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Create camera error:', error);
        res.status(500).json({ error: 'Failed to create live camera' });
    }
};

// --- 3. Delete Camera ---
const deleteCamera = async (req, res) => {
    try {
        const cameraId = parseInt(req.params.id);
        const userId = req.user.id || req.user.userId;
        const userRole = req.user.role;

        if (isNaN(cameraId)) {
            return res.status(400).json({ error: 'Invalid camera ID' });
        }

        // Check if user is admin or creator of the camera
        const checkRes = await pool.query('SELECT created_by FROM live_cameras WHERE id = $1', [cameraId]);
        if (checkRes.rows.length === 0) {
            return res.status(404).json({ error: 'Camera not found' });
        }

        const isAuthorized = userRole === 'admin' || String(checkRes.rows[0].created_by) === String(userId);
        if (!isAuthorized) {
            return res.status(403).json({ error: 'Unauthorized to delete this camera' });
        }

        await pool.query('DELETE FROM live_cameras WHERE id = $1', [cameraId]);
        res.json({ message: 'Camera deleted successfully', cameraId });
    } catch (error) {
        console.error('Delete camera error:', error);
        res.status(500).json({ error: 'Failed to delete camera' });
    }
};
 
// --- 4. Update Camera ---
const updateCamera = async (req, res) => {
    try {
        const cameraId = parseInt(req.params.id);
        const userId = req.user.id || req.user.userId;
        const userRole = req.user.role;
        const { crop_position, name, stream_url, latitude, longitude } = req.body;

        if (isNaN(cameraId)) {
            return res.status(400).json({ error: 'Invalid camera ID' });
        }

        // Check if user is admin or creator
        const checkRes = await pool.query('SELECT created_by FROM live_cameras WHERE id = $1', [cameraId]);
        if (checkRes.rows.length === 0) {
            return res.status(404).json({ error: 'Camera not found' });
        }

        const isAuthorized = userRole === 'admin' || String(checkRes.rows[0].created_by) === String(userId);
        if (!isAuthorized) {
            return res.status(403).json({ error: 'Unauthorized to update this camera' });
        }

        const currentRes = await pool.query('SELECT * FROM live_cameras WHERE id = $1', [cameraId]);
        const current = currentRes.rows[0];

        const updatedName = name !== undefined ? name : current.name;
        const updatedStream = stream_url !== undefined ? stream_url : current.stream_url;
        const updatedLat = latitude !== undefined ? parseFloat(latitude) : current.latitude;
        const updatedLon = longitude !== undefined ? parseFloat(longitude) : current.longitude;
        const updatedCrop = crop_position !== undefined ? crop_position : current.crop_position;

        const result = await pool.query(`
            UPDATE live_cameras
            SET name = $1, stream_url = $2, latitude = $3, longitude = $4, crop_position = $5
            WHERE id = $6
            RETURNING *
        `, [updatedName, updatedStream, updatedLat, updatedLon, updatedCrop, cameraId]);

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update camera error:', error);
        res.status(500).json({ error: 'Failed to update camera' });
    }
};

module.exports = {
    getAllCameras,
    createCamera,
    deleteCamera,
    updateCamera
};
