const multer = require('multer');

/**
 * إعداد Multer لاستخدام الذاكرة بدلاً من القرص (ضروري لـ Vercel)
 */
const storage = multer.memoryStorage();

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB كحد أقصى لكل ملف
    },
    fileFilter: (req, file, cb) => {
        if (
            file.mimetype.startsWith('image/') || 
            file.mimetype.startsWith('video/') ||
            file.mimetype === 'application/zip' ||
            file.mimetype === 'application/x-zip-compressed' ||
            file.originalname.toLowerCase().endsWith('.zip')
        ) {
            cb(null, true);
        } else {
            cb(new Error('Only images, videos and ZIP files are allowed'), false);
        }
    }
});

module.exports = upload;
