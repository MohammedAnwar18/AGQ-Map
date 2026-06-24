const { S3Client, PutObjectCommand, PutBucketCorsCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const https = require('https');

// وكيل مخصص لتخطي مشاكل شهادات SSL غير الموثوقة أو منتهية الصلاحية للبلديات والجهات الحكومية
const insecureAgent = new https.Agent({
    rejectUnauthorized: false
});

// إعداد عميل Cloudflare R2
const s3Client = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});

const bucketName = process.env.R2_BUCKET_NAME;
const publicUrlBase = process.env.R2_PUBLIC_URL;

/**
 * تهيئة CORS على بكت R2 تلقائياً عند تشغيل السيرفر
 * يسمح لأي موقع (حتى المتصفحات المحلية) بجلب البيانات ورفعها منه مباشرة
 */
const configureBucketCors = async () => {
    try {
        await s3Client.send(new PutBucketCorsCommand({
            Bucket: bucketName,
            CORSConfiguration: {
                CORSRules: [{
                    AllowedHeaders: ['*'],
                    AllowedMethods: ['GET', 'HEAD', 'PUT'],
                    AllowedOrigins: ['*'],
                    ExposeHeaders: ['Content-Length', 'Content-Type'],
                    MaxAgeSeconds: 86400
                }]
            }
        }));
        console.log('✅ R2 CORS configured: all origins allowed for GET, HEAD, PUT requests');
    } catch (err) {
        console.warn('⚠️ R2 CORS config failed (may not be supported on this plan):', err.message);
    }
};
configureBucketCors();

/**
 * إنشاء رابط رفع موقع مسبقاً (Presigned URL) لرفع الملفات مباشرة من المتصفح إلى R2
 * يحل هذا مشكلة الـ 4.5MB في خوادم Vercel لملفات GeoJSON الكبيرة
 */
exports.getPresignedUrl = async (req, res) => {
    try {
        const { fileName, contentType } = req.body;
        
        // توليد اسم فريد للملف للحفاظ على أمان البيانات
        const sanitizedName = (fileName || 'layer.json').replace(/[^a-zA-Z0-9._-]/g, '_');
        const fileKey = `layers/${uuidv4()}_${sanitizedName}`;

        const params = {
            Bucket: bucketName,
            Key: fileKey,
            ContentType: contentType || 'application/json'
        };

        const command = new PutObjectCommand(params);
        // الحصول على رابط PUT موقع مسبقاً صالح لمدة ساعة واحدة
        const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        const publicUrl = `${publicUrlBase}/${fileKey}`;

        res.status(200).json({
            success: true,
            uploadUrl,
            publicUrl
        });
    } catch (error) {
        console.error('R2 Presigned URL Error:', error);
        res.status(500).json({ error: 'فشل إنشاء رابط الرفع المؤقت' });
    }
};

/**
 * رفع بيانات GeoJSON مباشرة إلى R2 (الرفع العادي عبر السيرفر)
 */
exports.uploadGeoJSON = async (req, res) => {
    try {
        let { geojson, layerName, url } = req.body;

        if (url) {
            // جلب البيانات من الرابط البعيد
            const fetchRes = await axios.get(url, { timeout: 60000, httpsAgent: insecureAgent });
            geojson = fetchRes.data;
            if (!layerName) {
                try {
                    const parts = url.split('/');
                    layerName = parts[parts.length - 1].split('?')[0] || 'طبقة مستوردة';
                } catch (e) {
                    layerName = 'طبقة مستوردة';
                }
            }
        }

        if (!geojson) {
            return res.status(400).json({ error: 'لم يتم توفير بيانات GeoJSON' });
        }

        // حساب عدد المعالم
        let count = 0;
        let bbox = null;
        if (geojson.features) {
            count = geojson.features.length;
        } else if (geojson.type === 'Feature') {
            count = 1;
        }

        // حساب bbox للـ geojson إذا لزم الأمر لمساعدته في الـ fitBounds
        if (geojson && geojson.type === 'FeatureCollection' && Array.isArray(geojson.features)) {
            let minLng = Infinity, maxLng = -Infinity;
            let minLat = Infinity, maxLat = -Infinity;
            let hasCoordinates = false;

            const updateBBox = (coord) => {
                if (Array.isArray(coord) && typeof coord[0] === 'number' && typeof coord[1] === 'number') {
                    if (coord[0] < minLng) minLng = coord[0];
                    if (coord[0] > maxLng) maxLng = coord[0];
                    if (coord[1] < minLat) minLat = coord[1];
                    if (coord[1] > maxLat) maxLat = coord[1];
                    hasCoordinates = true;
                }
            };

            const processGeometry = (geom) => {
                if (!geom) return;
                if (geom.type === 'Point') {
                    updateBBox(geom.coordinates);
                } else if (geom.type === 'MultiPoint' || geom.type === 'LineString') {
                    if (Array.isArray(geom.coordinates)) geom.coordinates.forEach(updateBBox);
                } else if (geom.type === 'MultiLineString' || geom.type === 'Polygon') {
                    if (Array.isArray(geom.coordinates)) {
                        geom.coordinates.forEach(ring => {
                            if (Array.isArray(ring)) ring.forEach(updateBBox);
                        });
                    }
                } else if (geom.type === 'MultiPolygon') {
                    if (Array.isArray(geom.coordinates)) {
                        geom.coordinates.forEach(poly => {
                            if (Array.isArray(poly)) {
                                poly.forEach(ring => {
                                    if (Array.isArray(ring)) ring.forEach(updateBBox);
                                });
                            }
                        });
                    }
                } else if (geom.type === 'GeometryCollection') {
                    if (Array.isArray(geom.geometries)) geom.geometries.forEach(processGeometry);
                }
            };

            geojson.features.forEach(f => {
                if (f.geometry) {
                    processGeometry(f.geometry);
                }
            });

            if (hasCoordinates) {
                bbox = [minLng, minLat, maxLng, maxLat];
            }
        }

        const fileName = `layers/${uuidv4()}.json`;
        const params = {
            Bucket: bucketName,
            Key: fileName,
            Body: JSON.stringify(geojson),
            ContentType: 'application/json',
            ACL: 'public-read',
        };

        await s3Client.send(new PutObjectCommand(params));
        const publicUrl = `${publicUrlBase}/${fileName}`;

        // إذا كان حجم المعالم كبيراً، لا نرسل الـ geojson في الاستجابة لتفادي تعطل المتصفح وحدود الـ Vercel
        const shouldReturnGeoJSON = count <= 2000;

        res.status(200).json({
            success: true,
            url: publicUrl,
            geojson: shouldReturnGeoJSON ? geojson : null,
            bbox: bbox,
            count: count,
            name: layerName || 'طبقة مرفوعة'
        });
    } catch (error) {
        console.error('R2 Upload/Import Error:', error);
        res.status(500).json({ error: 'فشل استيراد أو رفع الملف إلى التخزين السحابي' });
    }
};

/**
 * استيراد بيانات من ArcGIS MapServer وتحويلها إلى GeoJSON ثم رفعها
 */
exports.importArcGIS = async (req, res) => {
    try {
        const { arcgisUrl, layerName } = req.body;

        if (!arcgisUrl) {
            return res.status(400).json({ error: 'يرجى تزويد رابط ArcGIS صالح' });
        }

        // تنظيف الرابط من أي متغيرات زائدة
        let baseUrl = arcgisUrl.split('?')[0];
        
        // بناء رابط الاستعلام (Query)
        let queryUrl = baseUrl;
        if (!queryUrl.toLowerCase().endsWith('/query')) {
            queryUrl = queryUrl.replace(/\/+$/, '') + '/0/query';
        }

        let features = [];
        let objectIdField = 'OBJECTID';
        
        // 1. محاولة جلب البيانات التعريفية لمعرفة حقل المعرف الفريد
        try {
            const metadataUrl = queryUrl.replace(/\/query\/?$/i, '');
            const metaRes = await axios.get(metadataUrl, { params: { f: 'json' }, timeout: 60000, httpsAgent: insecureAgent });
            if (metaRes.data) {
                objectIdField = metaRes.data.objectIdField || 'OBJECTID';
            }
        } catch (err) {
            console.warn('Could not fetch ArcGIS layer metadata:', err.message);
        }

        // 2. المحاولة الأولى: جلب المعرفات أولاً (returnIdsOnly) ثم جلب المعالم على دفعات
        let idListSuccess = false;
        try {
            const idParams = {
                where: '1=1',
                returnIdsOnly: true,
                f: 'json'
            };
            const idResponse = await axios.get(queryUrl, { params: idParams, timeout: 60000, httpsAgent: insecureAgent });
            if (idResponse.data && Array.isArray(idResponse.data.objectIds) && idResponse.data.objectIds.length > 0) {
                const objectIds = idResponse.data.objectIds;
                const totalIds = objectIds.length;
                console.log(`[ArcGIS Import] Found ${totalIds} object IDs. Fetching features in batches...`);
                
                const idBatchSize = 1000;
                for (let i = 0; i < totalIds; i += idBatchSize) {
                    const batchIds = objectIds.slice(i, i + idBatchSize);
                    const batchParams = {
                        objectIds: batchIds.join(','),
                        outFields: '*',
                        f: 'geojson',
                        returnGeometry: true,
                        outSR: 4326
                    };
                    const batchResponse = await axios.get(queryUrl, { params: batchParams, timeout: 60000, httpsAgent: insecureAgent });
                    if (batchResponse.data && Array.isArray(batchResponse.data.features)) {
                        features = features.concat(batchResponse.data.features);
                    }
                    
                    // حد أمان أقصى لتجنب استهلاك الذاكرة
                    if (features.length >= 200000) {
                        console.warn('[ArcGIS Import] Reached safety cap of 200,000 features.');
                        break;
                    }
                }
                idListSuccess = true;
                console.log(`[ArcGIS Import] Successfully loaded ${features.length} features.`);
            }
        } catch (err) {
            console.warn('[ArcGIS Import] returnIdsOnly batching failed, falling back to offset pagination:', err.message);
        }

        // 3. المحاولة الثانية الاحتياطية: الترقيم باستخدام resultOffset و resultRecordCount
        if (!idListSuccess) {
            let offset = 0;
            const batchSize = 2000;
            let hasMore = true;
            const seenIds = new Set();

            console.log('[ArcGIS Import] Starting offset-based pagination...');
            while (hasMore) {
                const queryParams = {
                    where: '1=1',
                    outFields: '*',
                    f: 'geojson',
                    returnGeometry: true,
                    outSR: 4326,
                    resultOffset: offset,
                    resultRecordCount: batchSize,
                    orderByFields: objectIdField
                };

                const response = await axios.get(queryUrl, { params: queryParams, timeout: 60000, httpsAgent: insecureAgent });
                const data = response.data;

                if (!data || !Array.isArray(data.features) || data.features.length === 0) {
                    hasMore = false;
                    break;
                }

                let newFeaturesInBatch = 0;
                for (const feature of data.features) {
                    let fId = null;
                    if (feature.id !== undefined && feature.id !== null) {
                        fId = `id_${feature.id}`;
                    } else if (feature.properties) {
                        fId = feature.properties[objectIdField] || feature.properties.OBJECTID || feature.properties.FID || feature.properties.objectid || feature.properties.fid;
                    }
                    
                    const signature = fId ? String(fId) : JSON.stringify(feature.properties);
                    if (!seenIds.has(signature)) {
                        seenIds.add(signature);
                        features.push(feature);
                        newFeaturesInBatch++;
                    }
                }

                console.log(`[ArcGIS Import] Offset ${offset}: batch size = ${data.features.length}, new unique features = ${newFeaturesInBatch}`);

                // إذا لم يتم إضافة أي معلم جديد في الدفعة، أو إذا كانت الدفعة أصغر من الحجم المطلوب، نوقف الحلقة
                if (newFeaturesInBatch === 0 || data.features.length < batchSize) {
                    hasMore = false;
                } else {
                    offset += batchSize;
                }

                // حد أمان أقصى لتجنب نفاد ذاكرة الخادم
                if (features.length >= 200000) {
                    console.warn('[ArcGIS Import] Reached safety cap of 200,000 features.');
                    hasMore = false;
                }
            }
        }

        if (features.length === 0) {
            return res.status(400).json({ error: 'لم يتم العثور على أي معالم جغرافية صالحة في الرابط' });
        }

        const geojson = {
            type: 'FeatureCollection',
            features: features
        };

        // حساب bbox للـ geojson إذا لزم الأمر
        let bbox = null;
        let minLng = Infinity, maxLng = -Infinity;
        let minLat = Infinity, maxLat = -Infinity;
        let hasCoordinates = false;

        const updateBBox = (coord) => {
            if (Array.isArray(coord) && typeof coord[0] === 'number' && typeof coord[1] === 'number') {
                if (coord[0] < minLng) minLng = coord[0];
                if (coord[0] > maxLng) maxLng = coord[0];
                if (coord[1] < minLat) minLat = coord[1];
                if (coord[1] > maxLat) maxLat = coord[1];
                hasCoordinates = true;
            }
        };

        const processGeometry = (geom) => {
            if (!geom) return;
            if (geom.type === 'Point') {
                updateBBox(geom.coordinates);
            } else if (geom.type === 'MultiPoint' || geom.type === 'LineString') {
                if (Array.isArray(geom.coordinates)) geom.coordinates.forEach(updateBBox);
            } else if (geom.type === 'MultiLineString' || geom.type === 'Polygon') {
                if (Array.isArray(geom.coordinates)) {
                    geom.coordinates.forEach(ring => {
                        if (Array.isArray(ring)) ring.forEach(updateBBox);
                    });
                }
            } else if (geom.type === 'MultiPolygon') {
                if (Array.isArray(geom.coordinates)) {
                    geom.coordinates.forEach(poly => {
                        if (Array.isArray(poly)) {
                            poly.forEach(ring => {
                                if (Array.isArray(ring)) ring.forEach(updateBBox);
                            });
                        }
                    });
                }
            } else if (geom.type === 'GeometryCollection') {
                if (Array.isArray(geom.geometries)) geom.geometries.forEach(processGeometry);
            }
        };

        features.forEach(f => {
            if (f.geometry) {
                processGeometry(f.geometry);
            }
        });

        if (hasCoordinates) {
            bbox = [minLng, minLat, maxLng, maxLat];
        }

        // رفع النتيجة إلى R2
        const fileName = `imports/${uuidv4()}.json`;
        const uploadParams = {
            Bucket: bucketName,
            Key: fileName,
            Body: JSON.stringify(geojson),
            ContentType: 'application/json',
            ACL: 'public-read',
        };

        await s3Client.send(new PutObjectCommand(uploadParams));
        const publicUrl = `${publicUrlBase}/${fileName}`;

        // إرجاع الـ geojson فقط لو كان صغيراً لتجنب تعطل العميل
        const shouldReturnGeoJSON = features.length <= 2000;

        res.status(200).json({
            success: true,
            url: publicUrl,
            geojson: shouldReturnGeoJSON ? geojson : null,
            bbox: bbox,
            count: features.length,
            name: layerName || 'استيراد ArcGIS'
        });

    } catch (error) {
        console.error('ArcGIS Import Error:', error.message);
        if (error.response) {
            console.error('Data:', error.response.data);
            return res.status(error.response.status).json({ 
                error: 'الخادم البعيد رفض الطلب. قد يكون الرابط لا يدعم استخراج البيانات بصيغة GeoJSON.' 
            });
        }
        res.status(500).json({ error: 'فشل الاتصال بخدمة ArcGIS. تأكد من أن الرابط متاح للعامة.' });
    }
};

/**
 * بروكسي GeoJSON: يجلب البيانات من R2 ويعيدها مع CORS headers صحيحة
 * يحل مشكلة CORS عند فتح الملفات محلياً أو من أي مصدر
 */
exports.proxyGeoJSON = async (req, res) => {
    try {
        const { url } = req.query;
        if (!url) return res.status(400).json({ error: 'URL parameter required' });

        // أمان: تأكد أن الرابط ينتمي لبكت R2 الخاص بنا فقط
        const allowedDomain = process.env.R2_PUBLIC_URL || 'r2.dev';
        if (!url.includes('r2.dev') && !url.includes(allowedDomain)) {
            return res.status(403).json({ error: 'Only R2 URLs are allowed' });
        }

        const response = await axios.get(url, { responseType: 'json', timeout: 60000, httpsAgent: insecureAgent });

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET');
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.status(200).json(response.data);
    } catch (error) {
        console.error('GeoJSON Proxy Error:', error.message);
        res.status(500).json({ error: 'Failed to fetch GeoJSON from storage' });
    }
};
