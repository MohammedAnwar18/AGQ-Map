const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure Cloudinary with user's specific credentials
cloudinary.config({
    cloud_name: 'dc6ps4bxx',
    api_key: '444951452386985',
    api_secret: 'dk3GYSZbTKnkz3gAfr32RxjG0G0'
});

// Create storage engine
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'agq_uploads', // The folder name in Cloudinary
        allowed_formats: ['jpg', 'png', 'jpeg', 'gif', 'webp', 'mp4', 'webm'], // Allow video formats as well if needed
        resource_type: 'auto' // Important for allowing videos and images automatically
    },
});

const uploadCloud = multer({ storage: storage });

module.exports = { cloudinary, uploadCloud };
