const { uploadToSupabase } = require('../utils/storage');

async function testUpload() {
    try {
        console.log('Testing upload to Supabase...');
        const buffer = Buffer.from('Testing content');
        const url = await uploadToSupabase(buffer, 'test.txt', 'text/plain');
        console.log('Upload successful! URL:', url);
        process.exit(0);
    } catch (err) {
        console.error('Upload failed:', err);
        process.exit(1);
    }
}

testUpload();
