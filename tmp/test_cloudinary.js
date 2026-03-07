const { cloudinary } = require('../backend/config/cloudinary');

async function testCloudinary() {
    try {
        console.log('Testing Cloudinary upload...');
        const result = await cloudinary.uploader.upload('https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png', {
            folder: 'test_folder'
        });
        console.log('Cloudinary Successful! URL:', result.secure_url);
    } catch (e) {
        console.error('Cloudinary Failed:', e.message);
    }
    process.exit(0);
}
testCloudinary();
