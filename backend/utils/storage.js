const { cloudinary } = require('../config/cloudinary');
const { v4: uuidv4 } = require('uuid');

/**
 * وظيفة لرفع الصور والفيديوهات - تستخدم Cloudinary حالياً لضمان الاستقرار
 * @param {Buffer} fileBuffer - محتوى الملف
 * @param {string} fileName - الاسم الأصلي للملف
 * @param {string} mimeType - نوع الملف (image/jpeg, etc)
 * @returns {Promise<string>} - رابط الملف المباشر
 */
const uploadToSupabase = async (fileBuffer, fileName, mimeType) => {
    try {
        if (!fileBuffer) throw new Error('No file buffer provided');

        // تحويل Buffer إلى Base64 ليتمكن Cloudinary من معالجته
        const base64File = `data:${mimeType};base64,${fileBuffer.toString('base64')}`;

        // الرفع إلى Cloudinary
        const result = await cloudinary.uploader.upload(base64File, {
            folder: 'agq_uploads',
            resource_type: 'auto'
        });

        console.log('✅ Upload successful to Cloudinary:', result.secure_url);
        return result.secure_url;

    } catch (err) {
        console.error('❌ Upload Utility Error:', err.message);
        throw err;
    }
};

module.exports = { uploadToSupabase };
