const multer = require('multer');

/**
 * إعداد Multer لاستخدام الذاكرة بدلاً من القرص (ضروري لـ Vercel)
 */
const storage = multer.memoryStorage();

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB كحد أقصى لكل ملف (صور بانوراما عريضة)
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
            cb(null, true);
        } else {
            cb(new Error('Only images and videos are allowed'), false);
        }
    }
});

module.exports = upload;
