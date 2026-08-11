const axios = require('axios');
const pool = require('../config/database');

/**
 * Controller handling spatial storage and ArcGIS imports
 */

// 1. Upload GeoJSON
exports.uploadGeoJSON = async (req, res) => {
    try {
        const { geojson, name } = req.body;
        if (!geojson) {
            return res.status(400).json({ error: 'محتوى GeoJSON مطلوب' });
        }
        res.json({
            success: true,
            name: name || 'GeoJSON Layer',
            count: geojson.features ? geojson.features.length : 0,
            geojson
        });
    } catch (err) {
        console.error('uploadGeoJSON error:', err);
        res.status(500).json({ error: err.message || 'فشل تحميل الملف' });
    }
};

// 2. Presigned URL
exports.getPresignedUrl = async (req, res) => {
    try {
        res.json({ success: true, url: '' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// 3. Import ArcGIS
exports.importArcGIS = async (req, res) => {
    try {
        const { arcgisUrl, boundaryGeometry } = req.body;
        if (!arcgisUrl) {
            return res.status(400).json({ error: 'رابط ArcGIS (MapServer/FeatureServer) مطلوب' });
        }

        let queryUrl = arcgisUrl.trim();
        if (!queryUrl.toLowerCase().includes('/query')) {
            queryUrl = queryUrl.replace(/\/+$/, '') + '/query';
        }

        const queryParams = {
            where: '1=1',
            outFields: '*',
            f: 'geojson',
            outSR: '4326',
            returnGeometry: 'true'
        };

        if (boundaryGeometry) {
            queryParams.geometry = JSON.stringify(boundaryGeometry);
            queryParams.geometryType = 'esriGeometryPolygon';
            queryParams.spatialRel = 'esriSpatialRelIntersects';
            queryParams.inSR = '4326';
        }

        const response = await axios.get(queryUrl, { params: queryParams, timeout: 30000 });
        const geojson = response.data;

        if (geojson && (geojson.type === 'FeatureCollection' || geojson.features)) {
            return res.json({
                success: true,
                count: geojson.features ? geojson.features.length : 0,
                geojson
            });
        }

        // Fallback: request esriJSON and convert
        const esriParams = { ...queryParams, f: 'json' };
        const esriRes = await axios.get(queryUrl, { params: esriParams, timeout: 30000 });
        const esriData = esriRes.data;

        if (esriData && esriData.features) {
            const convertedFeatures = esriData.features.map((feat, idx) => {
                let geom = null;
                if (feat.geometry) {
                    if (feat.geometry.x && feat.geometry.y) {
                        geom = { type: 'Point', coordinates: [feat.geometry.x, feat.geometry.y] };
                    } else if (feat.geometry.paths) {
                        geom = { type: 'MultiLineString', coordinates: feat.geometry.paths };
                    } else if (feat.geometry.rings) {
                        geom = { type: 'Polygon', coordinates: feat.geometry.rings };
                    }
                }
                return {
                    type: 'Feature',
                    id: idx + 1,
                    geometry: geom,
                    properties: feat.attributes || {}
                };
            });

            return res.json({
                success: true,
                count: convertedFeatures.length,
                geojson: {
                    type: 'FeatureCollection',
                    features: convertedFeatures
                }
            });
        }

        return res.status(400).json({ error: 'لم يتم العثور على معالم مكانية في الرابط المرفق' });
    } catch (err) {
        console.error('importArcGIS error:', err.message);
        return res.status(500).json({ error: `فشل استيراد الرابط من ArcGIS: ${err.message}` });
    }
};

// 4. Get Layers
exports.getLayers = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM geoportal_layers ORDER BY id DESC LIMIT 100');
        res.json(result.rows || []);
    } catch (err) {
        res.json([]);
    }
};

// 5. Upload Repository Layer
exports.uploadRepositoryLayer = async (req, res) => {
    try {
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// 6. Update Repository Layer
exports.updateRepositoryLayer = async (req, res) => {
    try {
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// 7. Delete Repository Layer
exports.deleteRepositoryLayer = async (req, res) => {
    try {
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// 8. Proxy GeoJSON
exports.proxyGeoJSON = async (req, res) => {
    try {
        const { url } = req.query;
        if (!url) return res.status(400).json({ error: 'URL query parameter required' });
        const response = await axios.get(url, { responseType: 'stream' });
        response.data.pipe(res);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
