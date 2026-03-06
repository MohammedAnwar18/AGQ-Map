const supabase = require('../config/supabase');
const { v4: uuidv4 } = require('uuid');

/**
 * وظيفة لرفع الصور إلى Supabase Storage
 * @param {Buffer} fileBuffer - محتوى الملف
 * @param {string} fileName - الاسم الأصلي للملف
 * @param {string} mimeType - نوع الملف (image/jpeg, etc)
 * @returns {Promise<string>} - رابط الصورة المباشر
 */
const uploadToSupabase = async (fileBuffer, fileName, mimeType) => {
    try {
        if (!fileBuffer) throw new Error('No file buffer provided');

        // إنشاء اسم ملف فريد
        const fileExt = fileName.split('.').pop();
        const path = `${uuidv4()}.${fileExt}`;

        // رفع الملف إلى Bucket: agq_media
        const { data, error } = await supabase.storage
            .from('agq_media')
            .upload(path, fileBuffer, {
                contentType: mimeType,
                upsert: false
            });

        if (error) {
            console.error('Supabase Upload Error:', error);
            throw error;
        }

        // الحصول على الرابط العام (Public URL)
        const { data: publicUrlData } = supabase.storage
            .from('agq_media')
            .getPublicUrl(path);

        return publicUrlData.publicUrl;
    } catch (err) {
        console.error('Upload Utility Error:', err.message);
        throw err;
    }
};

module.exports = { uploadToSupabase };
