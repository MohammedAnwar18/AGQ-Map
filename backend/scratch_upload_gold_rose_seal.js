const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { uploadToCloud } = require('./utils/storage');

async function run() {
    try {
        const imagePath = 'C:\\Users\\Moham\\.gemini\\antigravity\\brain\\8ff98307-1bf0-4219-95ab-9beed397c0a9\\media__1783350943100.png';
        if (!fs.existsSync(imagePath)) {
            console.error('File not found at:', imagePath);
            process.exit(1);
        }
        
        const fileBuffer = fs.readFileSync(imagePath);
        const fileName = 'enas-graduation-girl.png';
        const mimeType = 'image/png';
        
        console.log('Uploading file to Cloudflare R2...');
        const fileUrl = await uploadToCloud(fileBuffer, fileName, mimeType);
        
        console.log('\n======================================');
        console.log('🎉 UPLOAD SUCCESSFUL!');
        console.log('R2 URL:', fileUrl);
        console.log('======================================\n');
    } catch (error) {
        console.error('Upload failed:', error);
    }
}

run();
