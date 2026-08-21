const fs = require('fs');
const path = require('path');
const { r2Client } = require('../config/r2');
const { PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');

/**
 * Helper to get normalized R2 configuration from environment
 */
const getR2Config = () => {
    const bucketName = process.env.R2_BUCKET_NAME;
    let publicUrl = process.env.R2_PUBLIC_URL || '';
    
    if (publicUrl) {
        publicUrl = publicUrl.trim();
        if (!publicUrl.startsWith('http://') && !publicUrl.startsWith('https://')) {
            publicUrl = `https://${publicUrl}`;
        }
        publicUrl = publicUrl.replace(/\/+$/, '');
    }

    return { bucketName, publicUrl };
};

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
 * Uploads a file with a local fallback, and a Base64 fallback for serverless (Vercel)
 * @param {Buffer} fileBuffer - File content
 * @param {string} fileName - Original file name
 * @param {string} mimeType - File mime type
 * @returns {Promise<string>} - Public URL, local path, or Base64 data URL
 */
const uploadToCloud = async (fileBuffer, fileName, mimeType) => {
    try {
        if (!fileBuffer) throw new Error('No file buffer provided');

        const { bucketName, publicUrl } = getR2Config();

        // Check if R2 is configured
        if (!bucketName || !publicUrl) {
            console.log('⚠️ Cloudflare R2 not fully configured. Checking environment for fallback.');
            // On Vercel or serverless, local disk is read-only, so we store as Base64 in database
            if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
                console.log('📦 Serverless environment (Vercel) detected. Storing as Base64.');
                return `data:${mimeType || 'application/octet-stream'};base64,${fileBuffer.toString('base64')}`;
            }
            return await saveFileLocally(fileBuffer, fileName);
        }

        const extension = fileName ? fileName.split('.').pop() : 'png';
        const key = `uploads/${uuidv4()}.${extension}`;

        const command = new PutObjectCommand({
            Bucket: bucketName,
            Key: key,
            Body: fileBuffer,
            ContentType: mimeType || 'image/png',
        });

        await r2Client.send(command);

        // Generate public URL cleanly without trailing slash issues
        const fileUrl = `${publicUrl}/${key}`;
        console.log('✅ Upload successful to Cloudflare R2:', fileUrl);
        return fileUrl;

    } catch (err) {
        console.error('❌ R2 Upload Error, trying fallbacks:', err.message);
        try {
            // On Vercel or serverless, write will fail, so we catch and use Base64
            if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
                return `data:${mimeType || 'application/octet-stream'};base64,${fileBuffer.toString('base64')}`;
            }
            return await saveFileLocally(fileBuffer, fileName);
        } catch (localErr) {
            console.log('📦 Local write failed. Falling back to Base64 database storage.');
            return `data:${mimeType || 'application/octet-stream'};base64,${fileBuffer.toString('base64')}`;
        }
    }
};

/**
 * Deletes a file from Cloudflare R2, local storage, or ignores if Base64
 * @param {string} fileUrl - The full R2 URL, local path, or Base64 URL
 */
const deleteFileFromCloud = async (fileUrl) => {
    if (!fileUrl) return;

    // Base64 files don't need deletion from storage
    if (fileUrl.startsWith('data:')) {
        console.log('Base64 model URL. No storage deletion needed.');
        return;
    }

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

    const { bucketName, publicUrl } = getR2Config();

    if (!publicUrl || !fileUrl.includes(publicUrl)) return;

    try {
        // Extract key from URL
        const key = fileUrl.replace(`${publicUrl}/`, '');

        const command = new DeleteObjectCommand({
            Bucket: bucketName,
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
