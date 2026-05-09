const { S3Client, PutObjectCommand, PutBucketCorsCommand } = require('@aws-sdk/client-s3');
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
 * يسمح لأي موقع (حتى الملفات المحلية) بجلب البيانات منه
 */
const configureBucketCors = async () => {
    try {
        await s3Client.send(new PutBucketCorsCommand({
            Bucket: bucketName,
            CORSConfiguration: {
                CORSRules: [{
                    AllowedHeaders: ['*'],
                    AllowedMethods: ['GET', 'HEAD'],
                    AllowedOrigins: ['*'],
                    ExposeHeaders: ['Content-Length', 'Content-Type'],
                    MaxAgeSeconds: 86400
                }]
            }
        }));
        console.log('✅ R2 CORS configured: all origins allowed for GET requests');
    } catch (err) {
        console.warn('⚠️ R2 CORS config failed (may not be supported on this plan):', err.message);
    }
};
configureBucketCors();

/**
 * رفع بيانات GeoJSON مباشرة إلى R2
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
