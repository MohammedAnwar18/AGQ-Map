const { cloudinary } = require('../config/cloudinary');
const { v4: uuidv4 } = require('uuid');

/**
 * Uploads a file to Cloudinary
 * @param {Buffer} fileBuffer - File content
 * @param {string} fileName - Original file name
 * @param {string} mimeType - File mime type
 * @returns {Promise<string>} - Direct secure URL
 */
const uploadToCloud = async (fileBuffer, fileName, mimeType) => {
    try {
        if (!fileBuffer) throw new Error('No file buffer provided');

        // Convert Buffer to Base64 for Cloudinary
        const base64File = `data:${mimeType};base64,${fileBuffer.toString('base64')}`;

        // Upload to Cloudinary
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

/**
 * Deletes a file from Cloudinary given its URL
 * @param {string} fileUrl - The full Cloudinary URL
 */
const deleteFileFromCloud = async (fileUrl) => {
    if (!fileUrl || !fileUrl.includes('cloudinary')) return;

    try {
        // Extract public_id from URL (e.g., https://.../agq_uploads/abc123.jpg)
        const parts = fileUrl.split('/');
        const fileNameWithExtension = parts[parts.length - 1];
        const publicIdWithoutExtension = fileNameWithExtension.split('.')[0];
        const folder = parts[parts.length - 2];
        const publicId = `${folder}/${publicIdWithoutExtension}`;

        await cloudinary.uploader.destroy(publicId);
        console.log('🗑️ Deleted from Cloudinary:', publicId);
    } catch (err) {
        console.error('❌ Cloudinary Delete Error:', err.message);
    }
};

module.exports = {
    uploadToSupabase: uploadToCloud, // Keep alias for backward compatibility
    uploadToCloud,
    deleteFileFromCloud
};
