const pool = require('../config/database');
const { r2Client } = require('../config/r2');
const { PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

// Helper: Calculate bounding box of a GeoJSON feature collection
function computeBBox(geojson) {
    let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;

    function processCoords(coords) {
        if (typeof coords[0] === 'number') {
            const [lng, lat] = coords;
            if (lng < minLng) minLng = lng;
            if (lat < minLat) minLat = lat;
            if (lng > maxLng) maxLng = lng;
            if (lat > maxLat) maxLat = lat;
        } else {
            coords.forEach(processCoords);
        }
    }

    if (geojson.type === 'FeatureCollection' && Array.isArray(geojson.features)) {
        geojson.features.forEach(f => {
            if (f.geometry && f.geometry.coordinates) {
                processCoords(f.geometry.coordinates);
            }
        });
    } else if (geojson.type === 'Feature' && geojson.geometry) {
        processCoords(geojson.geometry.coordinates);
    }

    if (minLng === Infinity) return [35.2034 - 0.05, 31.9038 - 0.05, 35.2034 + 0.05, 31.9038 + 0.05];
    return [minLng, minLat, maxLng, maxLat];
}

// 1. Create a new Geoportal
exports.createGeoportal = async (req, res) => {
    try {
        const {
            slug, title_ar, title_en, description,
            primary_color, secondary_color, accent_color,
            custom_domain, is_public, auth_config, map_config,
            header_links, tools_config
        } = req.body;

        if (!slug || !title_ar) {
            return res.status(400).json({ error: 'المعرف السريع (slug) وعنوان البوابة باللغة العربية مطلوبان' });
        }

        // Clean slug
        const cleanSlug = slug.toLowerCase().trim().replace(/[^a-z0-9-]/g, '-');

        const query = `
            INSERT INTO geoportals (
                slug, title_ar, title_en, description,
                primary_color, secondary_color, accent_color,
                custom_domain, is_public, auth_config, map_config,
                header_links, tools_config, created_by
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            RETURNING *;
        `;

        const values = [
            cleanSlug,
            title_ar,
            title_en || null,
            description || '',
            primary_color || '#0F1E33',
            secondary_color || '#F5A623',
            accent_color || '#06D6F2',
            custom_domain ? custom_domain.toLowerCase().trim() : null,
            is_public !== undefined ? is_public : true,
            auth_config ? JSON.stringify(auth_config) : '{"require_login": false, "welcome_msg": "مرحباً بكم في البوابة المكانية الرسمية"}',
            map_config ? JSON.stringify(map_config) : '{"center": [31.9038, 35.2034], "zoom": 13, "basemap": "satellite"}',
            header_links ? JSON.stringify(header_links) : '[{"title": "الخدمات الإلكترونية", "url": "#"}, {"title": "تواصل معنا", "url": "#"}]',
            tools_config ? JSON.stringify(tools_config) : '{"measurement": true, "identify": true, "legend": true, "export": true, "search": true}',
            req.user ? req.user.id : null
        ];

        const result = await pool.query(query, values);
        return res.status(201).json({ message: 'تم إنشاء البوابة بنجاح', portal: result.rows[0] });
    } catch (error) {
        console.error('Error creating geoportal:', error);
        if (error.code === '23505') {
            return res.status(400).json({ error: 'اسم الرابط السريع (slug) أو الدومين المخصص مستخدم بالفعل' });
        }
        return res.status(500).json({ error: 'فشل في إنشاء البوابة' });
    }
};

// 2. Get All Geoportals (Admin view)
exports.getAllGeoportals = async (req, res) => {
    try {
        const query = `
            SELECT p.*, COUNT(l.id)::int as layers_count
            FROM geoportals p
            LEFT JOIN geoportal_layers l ON l.geoportal_id = p.id
            GROUP BY p.id
            ORDER BY p.created_at DESC;
        `;
        const result = await pool.query(query);
        return res.json(result.rows);
    } catch (error) {
        console.error('Error fetching geoportals:', error);
        return res.status(500).json({ error: 'فشل في جلب البوابات الجغرافية' });
    }
};

// 3. Get Single Geoportal by ID or Slug (with layers)
exports.getGeoportalById = async (req, res) => {
    try {
        const { idOrSlug } = req.params;
        const isUuid = /^[0-9a-fA-F-]{36}$/.test(idOrSlug);

        const portalQuery = isUuid
            ? 'SELECT * FROM geoportals WHERE id = $1'
            : 'SELECT * FROM geoportals WHERE slug = $1 OR custom_domain = $1';

        const portalResult = await pool.query(portalQuery, [idOrSlug]);

        if (portalResult.rows.length === 0) {
            return res.status(404).json({ error: 'البوابة الجغرافية غير موجودة' });
        }

        const portal = portalResult.rows[0];

        // Fetch layers sorted by z_index
        const layersQuery = `
            SELECT * FROM geoportal_layers
            WHERE geoportal_id = $1
            ORDER BY z_index ASC, created_at ASC;
        `;
        const layersResult = await pool.query(layersQuery, [portal.id]);

        portal.layers = layersResult.rows;
        return res.json(portal);
    } catch (error) {
        console.error('Error fetching geoportal:', error);
        return res.status(500).json({ error: 'فشل في جلب تفاصيل البوابة' });
    }
};

// 4. Update Geoportal
exports.updateGeoportal = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            title_ar, title_en, description, slug,
            primary_color, secondary_color, accent_color,
            custom_domain, is_domain_verified, is_public,
            auth_config, map_config, header_links, tools_config,
            logo_url, favicon_url
        } = req.body;

        const query = `
            UPDATE geoportals
            SET 
                title_ar = COALESCE($1, title_ar),
                title_en = COALESCE($2, title_en),
                description = COALESCE($3, description),
                slug = COALESCE($4, slug),
                primary_color = COALESCE($5, primary_color),
                secondary_color = COALESCE($6, secondary_color),
                accent_color = COALESCE($7, accent_color),
                custom_domain = $8,
                is_domain_verified = COALESCE($9, is_domain_verified),
                is_public = COALESCE($10, is_public),
                auth_config = COALESCE($11, auth_config),
                map_config = COALESCE($12, map_config),
                header_links = COALESCE($13, header_links),
                tools_config = COALESCE($14, tools_config),
                logo_url = COALESCE($15, logo_url),
                favicon_url = COALESCE($16, favicon_url),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $17
            RETURNING *;
        `;

        const values = [
            title_ar, title_en, description, slug,
            primary_color, secondary_color, accent_color,
            custom_domain ? custom_domain.toLowerCase().trim() : null,
            is_domain_verified, is_public,
            auth_config ? JSON.stringify(auth_config) : null,
            map_config ? JSON.stringify(map_config) : null,
            header_links ? JSON.stringify(header_links) : null,
            tools_config ? JSON.stringify(tools_config) : null,
            logo_url, favicon_url,
            id
        ];

        const result = await pool.query(query, values);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'البوابة غير موجودة' });
        }

        return res.json({ message: 'تم تحديث البوابة بنجاح', portal: result.rows[0] });
    } catch (error) {
        console.error('Error updating geoportal:', error);
        return res.status(500).json({ error: 'فشل في تحديث البوابة' });
    }
};

// 5. Delete Geoportal
exports.deleteGeoportal = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM geoportals WHERE id = $1 RETURNING id', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'البوابة غير موجودة' });
        }
        return res.json({ message: 'تم حذف البوابة الجغرافية وكافة طبقاتها بنجاح' });
    } catch (error) {
        console.error('Error deleting geoportal:', error);
        return res.status(500).json({ error: 'فشل في حذف البوابة' });
    }
};

// 6. Upload Spatial Layer (GeoJSON Upload -> R2 & PostGIS)
exports.uploadLayer = async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params; // geoportal_id
        const { layer_name, is_private, style_config, file_url, file_key, file_size, storage_type } = req.body;

        // ── Mode A: Presigned URL (file already uploaded to R2 by client) ──────────
        if (storage_type === 'r2' && file_url) {
            const { geometry_type, feature_count, bbox, properties_schema } = req.body;
            const layerName = layer_name || 'طبقة جغرافية';

            // لون افتراضي حسب نوع الهندسة
            const geomType = geometry_type || 'Unknown';
            const isPoint = geomType.toLowerCase().includes('point');
            const defaultStyle = JSON.stringify({
                fill_color: isPoint ? '#F5A623' : '#3B82F6',
                fill_opacity: 0.45,
                stroke_color: isPoint ? '#D88B0E' : '#1D4ED8',
                stroke_width: 2,
                point_radius: 7,
                point_icon: 'circle'
            });
            const style = style_config
                ? (typeof style_config === 'string' ? style_config : JSON.stringify(style_config))
                : defaultStyle;

            // حفظ مخطط الحقول وروابط الأجزاء (chunk_urls) في style_config
            const { chunk_urls } = req.body;
            const styleObj = JSON.parse(style);
            if (Array.isArray(properties_schema) && properties_schema.length > 0) {
                styleObj.properties_schema = properties_schema;
            }
            if (Array.isArray(chunk_urls) && chunk_urls.length > 0) {
                styleObj.chunk_urls = chunk_urls;
            }

            const bboxValue = (Array.isArray(bbox) && bbox.length === 4)
                ? JSON.stringify(bbox)
                : JSON.stringify([35.15, 31.85, 35.30, 31.95]);

            const insertQuery = `
                INSERT INTO geoportal_layers (
                    geoportal_id, layer_name, geometry_type,
                    r2_file_key, r2_file_url, z_index,
                    is_visible_by_default, is_private,
                    style_config, feature_count, bbox
                )
                VALUES ($1, $2, $3, $4, $5,
                    (SELECT COALESCE(MAX(z_index), 0) + 1 FROM geoportal_layers WHERE geoportal_id = $1),
                    true, $6, $7, $8, $9
                )
                RETURNING *;
            `;
            const result = await pool.query(insertQuery, [
                id, layerName, geomType,
                file_key || null,
                file_url,
                is_private === true || is_private === 'true',
                JSON.stringify(styleObj),
                parseInt(feature_count) || 0,
                bboxValue
            ]);

            return res.status(201).json({
                message: 'تم تسجيل الطبقة الجغرافية بنجاح (Presigned R2)',
                layer: result.rows[0]
            });
        }


        // ── Mode B: Legacy multipart file upload ────────────────────────────────────
        if (!req.file) {
            return res.status(400).json({ error: 'يرجى إرفاق ملف GeoJSON صحيح أو استخدام Presigned URL' });
        }

        // Parse GeoJSON content
        let geojson;
        try {
            const rawData = req.file.buffer.toString('utf8');
            geojson = JSON.parse(rawData);
        } catch (e) {
            return res.status(400).json({ error: 'الملف المرفق ليس بتنسيق JSON/GeoJSON صحيح' });
        }

        if (!geojson || (geojson.type !== 'FeatureCollection' && geojson.type !== 'Feature')) {
            return res.status(400).json({ error: 'يرجى رفع ملف GeoJSON يحتوي على FeatureCollection أو Feature' });
        }

        const featuresList = geojson.type === 'FeatureCollection' ? geojson.features : [geojson];
        if (featuresList.length === 0) {
            return res.status(400).json({ error: 'الملف المرفق لا يحتوي على أي عناصر جغرافية' });
        }

        // Determine geometry type
        const geomType = featuresList[0].geometry ? featuresList[0].geometry.type : 'Polygon';
        const bbox = computeBBox(geojson);

        // Upload to Cloudflare R2 if configured
        let r2Key = `geoportals/${id}/layers/${Date.now()}_${req.file.originalname}`;
        let r2Url = null;

        const bucketName = process.env.R2_GIS_BUCKET_NAME || process.env.R2_BUCKET_NAME;
        const publicUrl = process.env.R2_GIS_PUBLIC_URL || process.env.R2_PUBLIC_URL;

        if (process.env.R2_ENDPOINT && bucketName) {
            try {
                await r2Client.send(new PutObjectCommand({
                    Bucket: bucketName,
                    Key: r2Key,
                    Body: req.file.buffer,
                    ContentType: 'application/geo+json'
                }));
                let cleanBaseUrl = publicUrl || process.env.R2_ENDPOINT || '';
                if (cleanBaseUrl) {
                    cleanBaseUrl = cleanBaseUrl.trim();
                    if (!cleanBaseUrl.startsWith('http://') && !cleanBaseUrl.startsWith('https://')) cleanBaseUrl = `https://${cleanBaseUrl}`;
                    cleanBaseUrl = cleanBaseUrl.replace(/\/+$/, '');
                }
                r2Url = `${cleanBaseUrl}/${r2Key}`;
            } catch (r2Err) {
                console.warn('⚠️ Cloudflare R2 Upload warning (continuing with DB storage):', r2Err.message);
            }
        }

        await client.query('BEGIN');

        // Insert layer metadata
        const layerName = layer_name || req.file.originalname.replace(/\.[^/.]+$/, "");
        const style = style_config ? (typeof style_config === 'string' ? style_config : JSON.stringify(style_config)) : JSON.stringify({
            fill_color: geomType.includes('Point') ? '#F5A623' : '#3B82F6',
            fill_opacity: 0.45,
            stroke_color: geomType.includes('Point') ? '#D88B0E' : '#1D4ED8',
            stroke_width: 2,
            point_radius: 7,
            point_icon: 'circle'
        });

        const insertLayerQuery = `
            INSERT INTO geoportal_layers (
                geoportal_id, layer_name, geometry_type,
                r2_file_key, r2_file_url, z_index,
                is_visible_by_default, is_private,
                style_config, feature_count, bbox
            )
            VALUES ($1, $2, $3, $4, $5, 
                (SELECT COALESCE(MAX(z_index), 0) + 1 FROM geoportal_layers WHERE geoportal_id = $1),
                true, $6, $7, $8, $9
            )
            RETURNING *;
        `;

        const layerResult = await client.query(insertLayerQuery, [
            id, layerName, geomType,
            r2Key, r2Url,
            is_private === 'true' || is_private === true,
            style, featuresList.length, JSON.stringify(bbox)
        ]);

        const layer = layerResult.rows[0];

        // Insert PostGIS features batch
        for (const feature of featuresList) {
            if (feature.geometry) {
                const geomJson = JSON.stringify(feature.geometry);
                const propsJson = JSON.stringify(feature.properties || {});

                await client.query(`
                    INSERT INTO geoportal_features (layer_id, geom, properties)
                    VALUES ($1, ST_SetSRID(ST_GeomFromGeoJSON($2), 4326), $3);
                `, [layer.id, geomJson, propsJson]);
            }
        }

        await client.query('COMMIT');
        return res.status(201).json({ message: 'تم رفع وإضافة الطبقة الجغرافية بنجاح', layer });

    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Error uploading layer:', error);
        return res.status(500).json({ error: 'فشل في رفع معالجة الطبقة الجغرافية' });
    } finally {
        client.release();
    }
};


// 7. Update Layer Style & Properties
exports.updateLayerStyle = async (req, res) => {
    try {
        const { layerId } = req.params;
        const { layer_name, z_index, is_visible_by_default, is_private, style_config, popup_config } = req.body;

        const query = `
            UPDATE geoportal_layers
            SET
                layer_name = COALESCE($1, layer_name),
                z_index = COALESCE($2, z_index),
                is_visible_by_default = COALESCE($3, is_visible_by_default),
                is_private = COALESCE($4, is_private),
                style_config = COALESCE($5, style_config),
                popup_config = COALESCE($6, popup_config),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $7
            RETURNING *;
        `;

        const values = [
            layer_name, z_index, is_visible_by_default, is_private,
            style_config ? (typeof style_config === 'string' ? style_config : JSON.stringify(style_config)) : null,
            popup_config ? (typeof popup_config === 'string' ? popup_config : JSON.stringify(popup_config)) : null,
            layerId
        ];

        const result = await pool.query(query, values);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'الطبقة الجغرافية غير موجودة' });
        }

        return res.json({ message: 'تم تحديث مظهر الطبقة بنجاح', layer: result.rows[0] });
    } catch (error) {
        console.error('Error updating layer style:', error);
        return res.status(500).json({ error: 'فشل في تحديث الطبقة' });
    }
};

// 8. Delete Layer
exports.deleteLayer = async (req, res) => {
    try {
        const { layerId } = req.params;

        // Fetch layer to clean R2 if available
        const layerRes = await pool.query('SELECT * FROM geoportal_layers WHERE id = $1', [layerId]);
        if (layerRes.rows.length > 0 && layerRes.rows[0].r2_file_key && process.env.R2_BUCKET_NAME) {
            try {
                await r2Client.send(new DeleteObjectCommand({
                    Bucket: process.env.R2_BUCKET_NAME,
                    Key: layerRes.rows[0].r2_file_key
                }));
            } catch (err) {
                console.warn('Cloudflare R2 delete file warning:', err.message);
            }
        }

        await pool.query('DELETE FROM geoportal_layers WHERE id = $1', [layerId]);
        return res.json({ message: 'تم حذف الطبقة الجغرافية بنجاح' });
    } catch (error) {
        console.error('Error deleting layer:', error);
        return res.status(500).json({ error: 'فشل في حذف الطبقة' });
    }
};

// 9. Get Features of a Layer (as GeoJSON FeatureCollection)
exports.getLayerFeatures = async (req, res) => {
    try {
        const { layerId } = req.params;

        // Fetch layer details to check privacy
        const layerRes = await pool.query('SELECT * FROM geoportal_layers WHERE id = $1', [layerId]);
        if (layerRes.rows.length === 0) {
            return res.status(404).json({ error: 'الطبقة الجغرافية غير موجودة' });
        }

        const layer = layerRes.rows[0];

        // Check privacy access control
        if (layer.is_private && (!req.user || req.user.role === 'guest')) {
            return res.status(403).json({ error: 'هذه الطبقة محمية وتتطلب تسجيل الدخول للمشاهدة' });
        }

        const query = `
            SELECT json_build_object(
                'type', 'FeatureCollection',
                'features', COALESCE(json_agg(
                    json_build_object(
                        'type', 'Feature',
                        'id', id,
                        'geometry', ST_AsGeoJSON(geom)::json,
                        'properties', properties
                    )
                ), '[]'::json)
            ) as geojson
            FROM geoportal_features
            WHERE layer_id = $1;
        `;

        const result = await pool.query(query, [layerId]);
        return res.json(result.rows[0].geojson);
    } catch (error) {
        console.error('Error fetching layer features:', error);
        return res.status(500).json({ error: 'فشل في جلب عناصر الطبقة الجغرافية' });
    }
};

// 10. Public Resolver for Custom Domain or Public Slug Access
exports.resolvePublicPortal = async (req, res) => {
    try {
        const host = req.headers['x-forwarded-host'] || req.headers.host || '';
        const cleanHost = host.split(':')[0].toLowerCase();
        const { slug } = req.query;

        let query, param;
        if (slug) {
            query = 'SELECT * FROM geoportals WHERE slug = $1';
            param = slug.toLowerCase();
        } else {
            query = 'SELECT * FROM geoportals WHERE custom_domain = $1';
            param = cleanHost;
        }

        const portalRes = await pool.query(query, [param]);
        if (portalRes.rows.length === 0) {
            return res.status(404).json({ error: 'لم يتم العثور على بوابة جغرافية مربوطة بهذه الصفحة' });
        }

        const portal = portalRes.rows[0];

        // Get layers list
        const layersRes = await pool.query(
            'SELECT id, layer_name, geometry_type, z_index, is_visible_by_default, is_private, style_config, popup_config, feature_count, bbox FROM geoportal_layers WHERE geoportal_id = $1 ORDER BY z_index ASC',
            [portal.id]
        );

        portal.layers = layersRes.rows;
        return res.json(portal);
    } catch (error) {
        console.error('Error resolving public portal:', error);
        return res.status(500).json({ error: 'فشل في تحميل البوابة الجغرافية' });
    }
};

// 10. Upload Portal Logo (Supports all image formats: PNG, JPG, SVG, WEBP, GIF, AVIF, ICO)
exports.uploadLogo = async (req, res) => {
    try {
        const { id } = req.params;
        if (!req.file) {
            return res.status(400).json({ error: 'يرجى إرفاق صورة الشعار' });
        }

        let logoKey = `geoportals/${id}/logo_${Date.now()}_${req.file.originalname}`;
        let logoUrl = null;
        const mimeType = req.file.mimetype || 'image/png';

        if (process.env.R2_ENDPOINT && process.env.R2_BUCKET_NAME) {
            try {
                await r2Client.send(new PutObjectCommand({
                    Bucket: process.env.R2_BUCKET_NAME,
                    Key: logoKey,
                    Body: req.file.buffer,
                    ContentType: mimeType
                }));
                let cleanPublicUrl = process.env.R2_PUBLIC_URL || process.env.R2_ENDPOINT || '';
                if (cleanPublicUrl) {
                    cleanPublicUrl = cleanPublicUrl.trim();
                    if (!cleanPublicUrl.startsWith('http://') && !cleanPublicUrl.startsWith('https://')) cleanPublicUrl = `https://${cleanPublicUrl}`;
                    cleanPublicUrl = cleanPublicUrl.replace(/\/+$/, '');
                }
                logoUrl = `${cleanPublicUrl}/${logoKey}`;
            } catch (r2Err) {
                console.warn('R2 Logo upload warning:', r2Err.message);
            }
        }

        if (!logoUrl) {
            const base64 = req.file.buffer.toString('base64');
            logoUrl = `data:${mimeType};base64,${base64}`;
        }

        const updateQuery = `
            UPDATE geoportals
            SET logo_url = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING *;
        `;
        const result = await pool.query(updateQuery, [logoUrl, id]);
        return res.json({ message: 'تم رفع شعار البوابة بنجاح', logo_url: logoUrl, portal: result.rows[0] });
    } catch (error) {
        console.error('Error uploading portal logo:', error);
        return res.status(500).json({ error: 'فشل في رفع الشعار' });
    }
};
