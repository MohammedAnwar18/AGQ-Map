const { r2Client } = require('../config/r2');
const { PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');

const BUCKET_NAME = process.env.R2_BUCKET_NAME;
const PUBLIC_URL = process.env.R2_PUBLIC_URL; // e.g. https://pub-xyz.r2.dev

/**
 * Uploads a file to Cloudflare R2
 * @param {Buffer} fileBuffer - File content
 * @param {string} fileName - Original file name
 * @param {string} mimeType - File mime type
 * @returns {Promise<string>} - Public URL of the uploaded file
 */
const uploadToCloud = async (fileBuffer, fileName, mimeType) => {
    try {
        if (!fileBuffer) throw new Error('No file buffer provided');

        const extension = fileName.split('.').pop();
        const key = `uploads/${uuidv4()}.${extension}`;

        const command = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            Body: fileBuffer,
            ContentType: mimeType,
        });

        await r2Client.send(command);

        // Generate public URL
        const fileUrl = `${PUBLIC_URL}/${key}`;
        console.log('✅ Upload successful to R2:', fileUrl);
        return fileUrl;

    } catch (err) {
        console.error('❌ R2 Upload Error:', err.message);
        throw err;
    }
};

/**
 * Deletes a file from Cloudflare R2 given its URL
 * @param {string} fileUrl - The full R2 URL
 */
const deleteFileFromCloud = async (fileUrl) => {
    if (!fileUrl || !fileUrl.includes(PUBLIC_URL)) return;

    try {
        // Extract key from URL
        const key = fileUrl.replace(`${PUBLIC_URL}/`, '');

        const command = new DeleteObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
        });

        await r2Client.send(command);
        console.log('🗑️ Deleted from R2:', key);
    } catch (err) {
        console.error('❌ R2 Delete Error:', err.message);
    }
};

module.exports = {
    uploadToSupabase: uploadToCloud, // Keep alias for backward compatibility
    uploadToCloud,
    deleteFileFromCloud
};
