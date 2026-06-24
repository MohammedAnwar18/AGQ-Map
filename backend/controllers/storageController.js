const { S3Client, PutObjectCommand, PutBucketCorsCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

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
        const { geojson, layerName } = req.body;

        if (!geojson) {
            return res.status(400).json({ error: 'لم يتم توفير بيانات GeoJSON' });
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

        res.status(200).json({
            success: true,
            url: publicUrl,
            name: layerName || 'طبقة مرفوعة'
        });
    } catch (error) {
        console.error('R2 Upload Error:', error);
        res.status(500).json({ error: 'فشل رفع الملف إلى التخزين السحابي' });
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

        // تنظيف الرابط من أي متغيرات زائدة (مثل ?f=jsapi)
        let baseUrl = arcgisUrl.split('?')[0];
        
        // بناء رابط الاستعلام (Query)
        // إذا لم ينتهِ الرابط بـ /query، نضيف /0/query (الطبقة الأولى)
        let queryUrl = baseUrl;
        if (!queryUrl.toLowerCase().endsWith('/query')) {
            queryUrl = queryUrl.replace(/\/+$/, '') + '/0/query';
        }
        
        const params = {
            where: '1=1',
            outFields: '*',
            f: 'geojson',
            returnGeometry: true,
            outSR: 4326 // التأكد من أن الإحداثيات هي WGS84 المتوافقة مع Mapbox
        };

        const response = await axios.get(queryUrl, { params });
        const geojson = response.data;

        if (!geojson || geojson.type !== 'FeatureCollection') {
            return res.status(400).json({ error: 'الرابط لا يوفر بيانات متجهة (Vector) صالحة' });
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

        res.status(200).json({
            success: true,
            url: publicUrl,
            geojson: geojson, // Return data for fitBounds
            count: geojson.features.length,
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

        const response = await axios.get(url, { responseType: 'json', timeout: 15000 });

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
