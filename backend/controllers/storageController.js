const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
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

        // بناء رابط الاستعلام (Query)
        // نضيف 1=1 لجلب كل البيانات، و f=geojson للحصول على الصيغة المطلوبة
        let queryUrl = arcgisUrl;
        if (!queryUrl.includes('/query')) {
            queryUrl = queryUrl.replace(/\/+$/, '') + '/0/query'; // نفترض الطبقة 0 إذا لم يحدد
        }
        
        const params = {
            where: '1=1',
            outFields: '*',
            f: 'geojson',
            returnGeometry: true
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
            count: geojson.features.length,
            name: layerName || 'استيراد ArcGIS'
        });

    } catch (error) {
        console.error('ArcGIS Import Error:', error);
        res.status(500).json({ error: 'فشل استيراد البيانات من ArcGIS. تأكد من أن الرابط يدعم Query و f=geojson' });
    }
};
