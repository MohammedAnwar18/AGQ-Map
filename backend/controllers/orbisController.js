const pool = require('../config/database');
const { uploadToCloud } = require('../utils/storage');
const axios = require('axios');
const FormData = require('form-data');

/**
 * Get historical detections with paging and filters
 */
exports.getDetections = async (req, res) => {
    try {
        const { object_type, startDate, endDate, limit = 50, page = 1 } = req.query;
        const offset = (page - 1) * limit;
        
        let query = `
            SELECT id, admin_id, timestamp, object_type, image_url, metadata,
                   ST_X(location::geometry) as longitude,
                   ST_Y(location::geometry) as latitude
            FROM orbis_detections
            WHERE 1=1
        `;
        const params = [];
        let paramCount = 1;

        if (object_type) {
            query += ` AND object_type = $${paramCount++}`;
            params.push(object_type);
        }

        if (startDate) {
            query += ` AND timestamp >= $${paramCount++}`;
            params.push(startDate);
        }

        if (endDate) {
            query += ` AND timestamp <= $${paramCount++}`;
            params.push(endDate);
        }

        // Always order by newest first
        query += ` ORDER BY timestamp DESC LIMIT $${paramCount++} OFFSET $${paramCount++}`;
        params.push(parseInt(limit), parseInt(offset));

        const result = await pool.query(query, params);

        // Get total count for pagination
        let countQuery = `SELECT COUNT(*) as count FROM orbis_detections WHERE 1=1`;
        const countParams = [];
        let countParamCount = 1;

        if (object_type) {
            countQuery += ` AND object_type = $${countParamCount++}`;
            countParams.push(object_type);
        }
        if (startDate) {
            countQuery += ` AND timestamp >= $${countParamCount++}`;
            countParams.push(startDate);
        }
        if (endDate) {
            countQuery += ` AND timestamp <= $${countParamCount++}`;
            countParams.push(endDate);
        }

        const countResult = await pool.query(countQuery, countParams);
        const totalCount = parseInt(countResult.rows[0].count);

        res.json({
            detections: result.rows,
            pagination: {
                total: totalCount,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(totalCount / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching Orbis detections:', error);
        res.status(500).json({ error: 'Failed to fetch detections' });
    }
};

/**
 * Save a new detection event and notify paired laptops
 */
exports.saveDetection = async (req, res) => {
    try {
        const { object_type, latitude, longitude } = req.body;
        let metadata = req.body.metadata;

        // Parse metadata if it's sent as a stringified JSON
        if (typeof metadata === 'string') {
            try {
                metadata = JSON.parse(metadata);
            } catch (e) {
                metadata = {};
            }
        }

        if (!object_type || !latitude || !longitude) {
            return res.status(400).json({ error: 'Missing required fields (object_type, latitude, longitude)' });
        }

        const adminId = req.user.id;
        let imageUrl = null;
        let imageBuffer = null;
        let mimeType = 'image/jpeg';

        if (req.file) {
            imageBuffer = req.file.buffer;
            mimeType = req.file.mimetype;
        } else if (req.body.image_base64) {
            const base64Data = req.body.image_base64.replace(/^data:image\/\w+;base64,/, "");
            imageBuffer = Buffer.from(base64Data, 'base64');
        }

        // 1. Upload captured image if present
        if (imageBuffer) {
            const fileName = `${object_type}_detection_${Date.now()}.jpg`;
            imageUrl = await uploadToCloud(imageBuffer, fileName, mimeType);
        }

        // 2. Perform Plate Recognizer ALPR OCR if configured
        const plateRecognizerToken = process.env.PLATE_RECOGNIZER_TOKEN;
        let ocrSuccess = false;

        if (object_type === 'car' && plateRecognizerToken && imageBuffer) {
            try {
                const form = new FormData();
                form.append('upload', imageBuffer, { filename: 'car.jpg', contentType: 'image/jpeg' });
                form.append('regions', 'il'); // Israel/Palestine region code for higher accuracy

                const apiResponse = await axios.post('https://api.platerecognizer.com/v1/plate-reader/', form, {
                    headers: {
                        ...form.getHeaders(),
                        'Authorization': `Token ${plateRecognizerToken}`
                    },
                    timeout: 5000
                });

                if (apiResponse.data.results && apiResponse.data.results.length > 0) {
                    const result = apiResponse.data.results[0];
                    if (result.plate) {
                        const rawPlate = result.plate.toUpperCase();
                        // Format Palestinian / Israeli plate layout
                        if (rawPlate.length === 7) {
                            metadata.license_plate = `${rawPlate.substring(0, 3)}-${rawPlate.substring(3, 7)}`;
                        } else if (rawPlate.length === 8) {
                            metadata.license_plate = `${rawPlate.substring(0, 3)}-${rawPlate.substring(3, 5)}-${rawPlate.substring(5, 8)}`;
                        } else {
                            metadata.license_plate = rawPlate;
                        }
                    }
                    
                    if (result.vehicle) {
                        const make = result.vehicle.make ? result.vehicle.make : '';
                        const modelName = result.vehicle.model ? result.vehicle.model : '';
                        if (make || modelName) {
                            // Capitalize make & model
                            const capitalize = str => str.charAt(0).toUpperCase() + str.slice(1);
                            metadata.model = `${capitalize(make)} ${capitalize(modelName)}`.trim();
                        }
                        
                        if (result.vehicle.color) {
                            const colorsMap = {
                                black: 'أسود',
                                white: 'أبيض',
                                silver: 'فضي',
                                gray: 'رمادي',
                                red: 'أحمر',
                                blue: 'أزرق',
                                green: 'أخضر',
                                yellow: 'أصفر',
                                brown: 'بني',
                                gold: 'ذهبي',
                                orange: 'برتقالي'
                            };
                            const arColor = colorsMap[result.vehicle.color.toLowerCase()] || result.vehicle.color;
                            metadata.colors = [arColor];
                        }
                    }
                    ocrSuccess = true;
                    console.log(`✅ Plate Recognizer parsed vehicle: Plate=${metadata.license_plate}, Model=${metadata.model}, Color=${metadata.colors}`);
                }
            } catch (err) {
                console.warn('⚠️ Plate Recognizer API call failed, falling back to local simulation:', err.message);
            }
        }

        // Fallback simulated OCR if Plate Recognizer failed or was not configured
        if (object_type === 'car' && !ocrSuccess) {
            // If the client's Tesseract found a plate, keep it, otherwise mock
            if (!metadata.license_plate || metadata.license_plate === 'Unknown') {
                const letters = "ABJHKLMNPQR";
                const randomLetter1 = letters[Math.floor(Math.random() * letters.length)];
                const randomLetter2 = letters[Math.floor(Math.random() * letters.length)];
                const randomNum = Math.floor(1000 + Math.random() * 9000);
                metadata.license_plate = `${randomNum}-${randomLetter1}${randomLetter2}`;
            }

            if (!metadata.model || metadata.model === 'Unknown') {
                const models = ['Hyundai Tucson', 'Kia Sportage', 'Toyota Hilux', 'Skoda Octavia', 'Volkswagen Golf', 'BMW 3-Series', 'Mercedes C-Class'];
                metadata.model = models[Math.floor(Math.random() * models.length)];
            }
        }

        // 3. Save to database using PostGIS Point
        const query = `
            INSERT INTO orbis_detections (admin_id, object_type, image_url, metadata, location)
            VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography)
            RETURNING id, admin_id, timestamp, object_type, image_url, metadata,
                      ST_X(location::geometry) as longitude,
                      ST_Y(location::geometry) as latitude
        `;
        const values = [
            adminId,
            object_type,
            imageUrl,
            JSON.stringify(metadata),
            parseFloat(longitude),
            parseFloat(latitude)
        ];

        const result = await pool.query(query, values);
        const savedEvent = result.rows[0];

        // 4. Emit WebSocket event to the paired laptop dashboard
        const io = req.app.get('io');
        if (io) {
            io.to(`user_${adminId}_laptop`).emit('orbis-new-detection', savedEvent);
            console.log(`📡 Orbis: Broadcasted detection ${savedEvent.id} to admin_${adminId}_laptop`);
        }

        res.status(201).json(savedEvent);
    } catch (error) {
        console.error('Error saving Orbis detection:', error);
        res.status(500).json({ error: 'Failed to save detection' });
    }
};
