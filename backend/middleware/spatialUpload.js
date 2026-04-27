const multer = require('multer');

/**
 * Special upload middleware for spatial data (Shapefiles)
 * Allows ZIP and other related files, with a larger limit.
 */
const storage = multer.memoryStorage();

const spatialUpload = multer({
    storage: storage,
    limits: {
        fileSize: 30 * 1024 * 1024, // 30MB limit for shapefiles
    },
    fileFilter: (req, file, cb) => {
        // More permissive filter for spatial data
        cb(null, true); 
    }
});

module.exports = spatialUpload;
