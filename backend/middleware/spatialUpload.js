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
        const ext = file.originalname.toLowerCase();
        if (
            ext.endsWith('.zip') || 
            ext.endsWith('.json') || 
            ext.endsWith('.geojson') ||
            file.mimetype === 'application/zip' ||
            file.mimetype === 'application/json' ||
            file.mimetype === 'application/geo+json'
        ) {
            cb(null, true);
        } else {
            cb(new Error('Only ZIP (Shapefile), JSON, or GeoJSON files are allowed'), false);
        }
    }
});

module.exports = spatialUpload;
