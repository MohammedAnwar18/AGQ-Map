const pool = require('../config/database');
const { uploadToCloud } = require('../utils/storage');
// Removed top-level require for shpjs to avoid ERR_REQUIRE_ESM

// Helper to convert GeoJSON to a simplified SVG path string
function convertGeoJSONToPath(geojson) {
    let coords = [];
    const extract = (item) => {
        if (!item) return;
        if (item.type === 'FeatureCollection' && item.features) {
            item.features.forEach(f => extract(f.geometry));
        } else if (item.type === 'Feature' && item.geometry) {
            extract(item.geometry);
        } else if (item.type === 'GeometryCollection' && item.geometries) {
            item.geometries.forEach(g => extract(g));
        } else if (item.coordinates) {
            const flatten = (arr) => {
                if (typeof arr[0] === 'number') coords.push(arr);
                else arr.forEach(flatten);
            };
            flatten(item.coordinates);
        }
    };
    extract(geojson);

    if (coords.length === 0) return null;

    let minX = coords[0][0], maxX = coords[0][0], minY = coords[0][1], maxY = coords[0][1];
    coords.forEach(c => {
        if (c[0] < minX) minX = c[0];
        if (c[0] > maxX) maxX = c[0];
        if (c[1] < minY) minY = c[1];
        if (c[1] > maxY) maxY = c[1];
    });

    const diffX = maxX - minX || 1;
    const diffY = maxY - minY || 1;
    const padding = 20;
    const w = 1000 - (padding * 2);
    const h = 1000 - (padding * 2);

    const project = (coord) => {
        const x = padding + ((coord[0] - minX) / diffX) * w;
        const y = padding + (1 - (coord[1] - minY) / diffY) * h;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    };

    let pathData = "";
    const processGeometry = (geom) => {
        if (!geom) return;
        if (geom.type === 'Point') {
            const p = project(geom.coordinates);
            pathData += `M ${p} m -5,0 a 5,5 0 1,0 10,0 a 5,5 0 1,0 -10,0 `;
        } else if (geom.type === 'LineString') {
            pathData += "M " + geom.coordinates.map(project).join(" L ") + " ";
        } else if (geom.type === 'MultiLineString') {
            geom.coordinates.forEach(line => {
                pathData += "M " + line.map(project).join(" L ") + " ";
            });
        } else if (geom.type === 'Polygon') {
            geom.coordinates.forEach(ring => {
                pathData += "M " + ring.map(project).join(" L ") + " Z ";
            });
        } else if (geom.type === 'MultiPolygon') {
            geom.coordinates.forEach(poly => {
                poly.forEach(ring => {
                    pathData += "M " + ring.map(project).join(" L ") + " Z ";
                });
            });
        }
    };

    if (geojson.type === 'FeatureCollection') {
        geojson.features.forEach(f => processGeometry(f.geometry));
    } else {
        processGeometry(geojson);
    }

    return pathData.trim();
}

const magazineController = {
    // Get all published magazines
    getMagazines: async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT m.*, mp.content as cover_content
                FROM magazines m
                LEFT JOIN magazine_pages mp ON m.id = mp.magazine_id AND mp.page_number = 1
                WHERE m.is_published = TRUE
                ORDER BY m.created_at DESC
            `);
            res.json(result.rows);
        } catch (error) {
            console.error('Get magazines error:', error);
            res.status(500).json({ error: 'Failed to fetch magazines' });
        }
    },

    // Get all magazines (Admin only)
    getAllMagazines: async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT m.*, mp.content as cover_content
                FROM magazines m
                LEFT JOIN magazine_pages mp ON m.id = mp.magazine_id AND mp.page_number = 1
                ORDER BY m.created_at DESC
            `);
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
    },

    // Process and Upload Spatial Data (Shapefile ZIP)
    uploadSpatial: async (req, res) => {
        try {
            if (!req.file) {
                console.warn('Spatial upload: No file received');
                return res.status(400).json({ error: 'No file uploaded' });
            }
            
            console.log(`Spatial upload: Processing file ${req.file.originalname} (${req.file.mimetype}, ${req.file.size} bytes)`);
            
            let geojson;
            const isJson = req.file.originalname.toLowerCase().endsWith('.json') || 
                           req.file.originalname.toLowerCase().endsWith('.geojson') ||
                           req.file.mimetype === 'application/json' ||
                           req.file.mimetype === 'application/geo+json';

            if (isJson) {
                console.log('Detected direct JSON/GeoJSON upload');
                geojson = JSON.parse(req.file.buffer.toString());
            } else {
                // Parse Shapefile from Buffer using dynamic import for ESM compatibility
                const shpModule = await import('shpjs');
                const shp = shpModule.default || shpModule;
                geojson = await shp(req.file.buffer);
            }
            
            // Normalize to a single FeatureCollection
            if (Array.isArray(geojson)) {
                console.log(`Input contains ${geojson.length} objects, merging features...`);
                const features = geojson.flatMap(collection => collection.features || []);
                geojson = {
                    type: 'FeatureCollection',
                    features: features
                };
            }
            
            // Convert to a simplified SVG drawing path
            const drawingPath = convertGeoJSONToPath(geojson);
            
            res.json({ 
                type: 'drawing', 
                path: drawingPath,
                size: req.file.size 
            });
        } catch (error) {
            console.error('Spatial data upload error:', error);
            res.status(500).json({ 
                error: 'Failed to process shapefile', 
                details: error.message,
                message: 'Ensure it is a valid ZIP containing .shp, .dbf, etc.' 
            });
        }
    }
};

module.exports = magazineController;
