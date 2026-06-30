const fs = require('fs');
const path = require('path');
const { r2Client } = require('../config/r2');
const { PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');

const BUCKET_NAME = process.env.R2_BUCKET_NAME;
const PUBLIC_URL = process.env.R2_PUBLIC_URL; // e.g. https://pub-xyz.r2.dev

/**
 * Helper to save a file locally on the server
 */
const saveFileLocally = async (fileBuffer, fileName) => {
    const extension = fileName.split('.').pop();
    const uniqueName = `${uuidv4()}.${extension}`;
    const uploadDir = path.join(__dirname, '..', 'uploads');

    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = path.join(uploadDir, uniqueName);
    await fs.promises.writeFile(filePath, fileBuffer);
    
    console.log('✅ Saved file locally:', `/uploads/${uniqueName}`);
    return `/uploads/${uniqueName}`;
};

/**
 * Uploads a file to Cloudflare R2 with a local fallback if R2 is not configured or fails
 * @param {Buffer} fileBuffer - File content
 * @param {string} fileName - Original file name
 * @param {string} mimeType - File mime type
 * @returns {Promise<string>} - Public URL or local path of the uploaded file
 */
const uploadToCloud = async (fileBuffer, fileName, mimeType) => {
    try {
        if (!fileBuffer) throw new Error('No file buffer provided');

        // Check if R2 is configured
        if (!BUCKET_NAME || !PUBLIC_URL) {
            console.log('⚠️ R2 not configured. Using local storage fallback.');
            return await saveFileLocally(fileBuffer, fileName);
        }

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
        console.error('❌ R2 Upload Error, falling back to local storage:', err.message);
        try {
            return await saveFileLocally(fileBuffer, fileName);
        } catch (localErr) {
            console.error('❌ Local Storage Fallback Error:', localErr.message);
            throw err; // throw the original R2 error if local also fails
        }
    }
};

/**
 * Deletes a file from Cloudflare R2 or local storage given its URL/path
 * @param {string} fileUrl - The full R2 URL or local path
 */
const deleteFileFromCloud = async (fileUrl) => {
    if (!fileUrl) return;

    // Handle local file deletion
    if (fileUrl.startsWith('/uploads/')) {
        try {
            const filePath = path.join(__dirname, '..', fileUrl);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log('🗑️ Deleted local file:', filePath);
            }
        } catch (err) {
            console.error('❌ Local Delete Error:', err.message);
        }
        return;
    }

    if (!PUBLIC_URL || !fileUrl.includes(PUBLIC_URL)) return;

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
