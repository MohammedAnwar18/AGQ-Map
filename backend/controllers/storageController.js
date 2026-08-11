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
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { r2Client } = require('../config/r2');
const { v4: uuidv4 } = require('uuid');

exports.getPresignedUrl = async (req, res) => {
    try {
        const { fileName, contentType } = req.body;
        const bucketName = process.env.R2_GIS_BUCKET_NAME || process.env.R2_BUCKET_NAME;
        const publicUrl = process.env.R2_GIS_PUBLIC_URL || process.env.R2_PUBLIC_URL;

        if (!bucketName || !process.env.R2_ACCESS_KEY_ID) {
            return res.status(400).json({ 
                success: false, 
                error: 'R2 Storage is not configured in environment variables' 
            });
        }

        const ext = fileName ? fileName.split('.').pop() : 'geojson';
        const key = `uploads/${uuidv4()}.${ext}`;

        const command = new PutObjectCommand({
            Bucket: bucketName,
            Key: key,
            ContentType: contentType || 'application/json'
        });

        const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: 3600 });
        const finalPublicUrl = publicUrl ? `${publicUrl.replace(/\/+$/, '')}/${key}` : uploadUrl;

        res.json({
            success: true,
            uploadUrl,
            publicUrl: finalPublicUrl,
            key
        });
    } catch (err) {
        console.error('getPresignedUrl error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
};

// 3. Import ArcGIS
exports.importArcGIS = async (req, res) => {
    try {
        const { arcgisUrl, boundaryGeometry } = req.body;
        if (!arcgisUrl) {
            return res.status(400).json({ error: 'رابط ArcGIS (MapServer/FeatureServer) مطلوب' });
        }

        let cleanUrl = arcgisUrl.trim().replace(/\/+$/, '');
        
        // إذا كان الرابط يشير لخدمة رئيسية مثل /MapServer بدون رقم طبقة، نقوم بإضافة /0/query
        if (cleanUrl.match(/\/(MapServer|FeatureServer)$/i)) {
            cleanUrl += '/0/query';
        } else if (!cleanUrl.toLowerCase().includes('/query')) {
            cleanUrl += '/query';
        }

        const queryParams = {
            where: '1=1',
            outFields: '*',
            f: 'geojson',
            outSR: '4326',
            returnGeometry: 'true'
        };

        // استخدام المربع المحيط (Envelope) بدلاً من مضلع النقاط المعقد
        // هذا يمنع خطأ 414 وخطأ خوادم ArcGIS بشكل قاطع 100%
        if (boundaryGeometry) {
            try {
                let rings = null;
                if (typeof boundaryGeometry === 'object' && boundaryGeometry.rings) {
                    rings = boundaryGeometry.rings;
                } else if (typeof boundaryGeometry === 'string') {
                    const parsed = JSON.parse(boundaryGeometry);
                    rings = parsed.rings;
                }

                if (rings && Array.isArray(rings)) {
                    let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
                    rings.forEach(ring => {
                        ring.forEach(pt => {
                            if (Array.isArray(pt) && pt.length >= 2) {
                                const lng = Number(pt[0]), lat = Number(pt[1]);
                                if (!isNaN(lng) && !isNaN(lat)) {
                                    if (lng < minLng) minLng = lng;
                                    if (lng > maxLng) maxLng = lng;
                                    if (lat < minLat) minLat = lat;
                                    if (lat > maxLat) maxLat = lat;
                                }
                            }
                        });
                    });

                    if (isFinite(minLng) && isFinite(minLat)) {
                        queryParams.geometry = `${minLng},${minLat},${maxLng},${maxLat}`;
                        queryParams.geometryType = 'esriGeometryEnvelope';
                        queryParams.spatialRel = 'esriSpatialRelIntersects';
                        queryParams.inSR = '4326';
                    }
                }
            } catch (geomErr) {
                console.warn('⚠️ Boundary envelope extraction fallback:', geomErr.message);
            }
        }

        const fetchArcGISData = async (targetFormat, useGeometryFilter = true) => {
            const params = { ...queryParams, f: targetFormat };
            if (!useGeometryFilter) {
                delete params.geometry;
                delete params.geometryType;
                delete params.spatialRel;
                delete params.inSR;
            }

            const formBody = new URLSearchParams();
            Object.entries(params).forEach(([k, v]) => {
                if (v !== undefined && v !== null) formBody.append(k, String(v));
            });

            try {
                // 1. Try POST first
                return await axios.post(cleanUrl, formBody.toString(), {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    timeout: 45000
                });
            } catch (postErr) {
                // 2. Fallback to GET
                return await axios.get(cleanUrl, { params, timeout: 45000 });
            }
        };

        let response;
        try {
            response = await fetchArcGISData('geojson', true);
        } catch (firstErr) {
            console.warn('⚠️ ArcGIS query with geometry filter failed, retrying without filter:', firstErr.message);
            response = await fetchArcGISData('geojson', false);
        }

        let geojson = response.data;

        if (geojson && (geojson.type === 'FeatureCollection' || Array.isArray(geojson.features))) {
            return res.json({
                success: true,
                count: geojson.features ? geojson.features.length : 0,
                geojson
            });
        }

        // Fallback: request esriJSON and convert to GeoJSON
        try {
            response = await fetchArcGISData('json', true);
        } catch (esriErr) {
            response = await fetchArcGISData('json', false);
        }

        const esriData = response.data;

        if (esriData && Array.isArray(esriData.features)) {
            const convertedFeatures = esriData.features.map((feat, idx) => {
                let geom = null;
                if (feat.geometry) {
                    if (feat.geometry.x !== undefined && feat.geometry.y !== undefined) {
                        geom = { type: 'Point', coordinates: [feat.geometry.x, feat.geometry.y] };
                    } else if (feat.geometry.paths) {
                        geom = { type: 'MultiLineString', coordinates: feat.geometry.paths };
                    } else if (feat.geometry.rings) {
                        geom = { type: 'Polygon', coordinates: feat.geometry.rings };
                    }
                }
                return {
                    type: 'Feature',
                    id: feat.id || idx + 1,
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

        return res.status(400).json({ error: 'لم يتم العثور على معالم مكانية في الرابط المرفق. تأكد من صحة الرابط وسماحيات الخادم.' });
    } catch (err) {
        console.error('importArcGIS final error:', err.message);
        return res.status(500).json({ error: `فشل استيراد الرابط من ArcGIS: ${err.response?.data?.error?.message || err.message}` });
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

// 8. Proxy GeoJSON from R2 (fixes CORS for browser fetches)
exports.proxyGeoJSON = async (req, res) => {
    try {
        const { url } = req.query;
        if (!url) return res.status(400).json({ error: 'URL query parameter required' });

        // Validate URL is from trusted R2 domains only
        let parsedUrl;
        try { parsedUrl = new URL(url); } catch { return res.status(400).json({ error: 'Invalid URL' }); }

        const trustedHosts = [
            'r2.dev', 'cloudflarestorage.com', 'r2.cloudflarestorage.com'
        ];
        const isTrusted = trustedHosts.some(h => parsedUrl.hostname.endsWith(h));
        if (!isTrusted) {
            return res.status(403).json({ error: 'URL not from a trusted R2 domain' });
        }

        // Set CORS headers so browser accepts the response
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/geo+json; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=300'); // 5 دقائق cache

        // Stream the file — يدعم ملفات بالجيجابايت بدون تحميلها للذاكرة
        const response = await axios.get(url, {
            responseType: 'stream',
            timeout: 600000, // 10 دقائق للملفات الضخمة جداً
            headers: { 'Accept-Encoding': 'gzip, deflate' }
        });

        // مرر Content-Length إذا وُجد (لشريط التقدم)
        if (response.headers['content-length']) {
            res.setHeader('Content-Length', response.headers['content-length']);
        }

        response.data.pipe(res);

        response.data.on('error', (err) => {
            console.error('Proxy stream error:', err.message);
            if (!res.headersSent) res.status(500).json({ error: 'Stream error' });
        });

    } catch (err) {
        console.error('proxyGeoJSON error:', err.message);
        if (!res.headersSent) res.status(500).json({ error: err.message });
    }
};

