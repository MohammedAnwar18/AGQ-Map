const pool = require('../config/database');
const { uploadToCloud, deleteFileFromCloud } = require('../utils/storage');
const {
    extractSingleFace,
    extractAllFaces,
    matchDescriptorAgainstEnrollments
} = require('../services/faceRecognitionService');

// GET /admin/face/people?search=&page=&limit=
exports.getAllPeople = async (req, res) => {
    try {
        const { search = '', page = 1, limit = 20 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const params = [];
        let whereClause = '';
        if (search) {
            params.push(`%${search}%`);
            whereClause = `WHERE p.name ILIKE $${params.length}`;
        }

        const countResult = await pool.query(
            `SELECT COUNT(*) FROM face_people p ${whereClause}`,
            params
        );
        const total = parseInt(countResult.rows[0].count);

        params.push(parseInt(limit), offset);
        const result = await pool.query(
            `SELECT p.id, p.name, p.info, p.created_at,
                    (SELECT photo_url FROM face_photos fp WHERE fp.person_id = p.id ORDER BY fp.created_at ASC LIMIT 1) as cover_photo,
                    (SELECT COUNT(*) FROM face_photos fp WHERE fp.person_id = p.id) as photo_count
             FROM face_people p
             ${whereClause}
             ORDER BY p.created_at DESC
             LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );

        res.json({
            people: result.rows,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (err) {
        console.error('getAllPeople error:', err);
        res.status(500).json({ error: 'فشل تحميل قائمة الأشخاص' });
    }
};

// GET /admin/face/people/:id
exports.getPersonDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const personResult = await pool.query('SELECT * FROM face_people WHERE id = $1', [id]);
        if (personResult.rows.length === 0) {
            return res.status(404).json({ error: 'الشخص غير موجود' });
        }
        const photosResult = await pool.query(
            'SELECT id, photo_url, detection_score, created_at FROM face_photos WHERE person_id = $1 ORDER BY created_at ASC',
            [id]
        );
        res.json({ person: personResult.rows[0], photos: photosResult.rows });
    } catch (err) {
        console.error('getPersonDetails error:', err);
        res.status(500).json({ error: 'فشل تحميل بيانات الشخص' });
    }
};

// POST /admin/face/people  (multipart: name, info, photos[])
exports.createPerson = async (req, res) => {
    const client = await pool.connect();
    try {
        const { name, info } = req.body;
        const files = req.files || [];

        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'اسم الشخص مطلوب' });
        }
        if (files.length === 0) {
            return res.status(400).json({ error: 'يجب رفع صورة واحدة على الأقل للشخص' });
        }

        // Validate every photo has exactly one clear detectable face BEFORE writing anything.
        const extracted = [];
        for (const file of files) {
            try {
                const face = await extractSingleFace(file.buffer);
                extracted.push({ file, face });
            } catch (faceErr) {
                return res.status(400).json({
                    error: `فشل التحقق من الصورة "${file.originalname}": ${faceErr.message}`
                });
            }
        }

        await client.query('BEGIN');

        const personResult = await client.query(
            'INSERT INTO face_people (name, info, created_by) VALUES ($1, $2, $3) RETURNING *',
            [name.trim(), info || null, req.user?.userId || null]
        );
        const person = personResult.rows[0];

        const savedPhotos = [];
        for (const { file, face } of extracted) {
            const photoUrl = await uploadToCloud(file.buffer, file.originalname, file.mimetype);
            const photoResult = await client.query(
                `INSERT INTO face_photos (person_id, photo_url, descriptor, face_box, detection_score)
                 VALUES ($1, $2, $3, $4, $5) RETURNING id, photo_url, detection_score, created_at`,
                [person.id, photoUrl, JSON.stringify(face.descriptor), JSON.stringify(face.box), face.detectionScore]
            );
            savedPhotos.push(photoResult.rows[0]);
        }

        await client.query('COMMIT');
        res.status(201).json({ person, photos: savedPhotos });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('createPerson error:', err);
        res.status(500).json({ error: 'فشل إنشاء سجل الشخص' });
    } finally {
        client.release();
    }
};

// PUT /admin/face/people/:id  (name, info)
exports.updatePerson = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, info } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'اسم الشخص مطلوب' });
        }
        const result = await pool.query(
            'UPDATE face_people SET name = $1, info = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
            [name.trim(), info || null, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'الشخص غير موجود' });
        }
        res.json({ person: result.rows[0] });
    } catch (err) {
        console.error('updatePerson error:', err);
        res.status(500).json({ error: 'فشل تحديث بيانات الشخص' });
    }
};

// DELETE /admin/face/people/:id
exports.deletePerson = async (req, res) => {
    try {
        const { id } = req.params;
        const photosResult = await pool.query('SELECT photo_url FROM face_photos WHERE person_id = $1', [id]);
        const result = await pool.query('DELETE FROM face_people WHERE id = $1 RETURNING id', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'الشخص غير موجود' });
        }
        await Promise.all(photosResult.rows.map(p => deleteFileFromCloud(p.photo_url).catch(() => {})));
        res.json({ success: true });
    } catch (err) {
        console.error('deletePerson error:', err);
        res.status(500).json({ error: 'فشل حذف الشخص' });
    }
};

// POST /admin/face/people/:id/photos  (multipart: photos[])
exports.addPersonPhotos = async (req, res) => {
    try {
        const { id } = req.params;
        const files = req.files || [];
        if (files.length === 0) {
            return res.status(400).json({ error: 'لم يتم إرفاق أي صورة' });
        }

        const personResult = await pool.query('SELECT id FROM face_people WHERE id = $1', [id]);
        if (personResult.rows.length === 0) {
            return res.status(404).json({ error: 'الشخص غير موجود' });
        }

        const savedPhotos = [];
        for (const file of files) {
            let face;
            try {
                face = await extractSingleFace(file.buffer);
            } catch (faceErr) {
                return res.status(400).json({
                    error: `فشل التحقق من الصورة "${file.originalname}": ${faceErr.message}`,
                    savedPhotos
                });
            }
            const photoUrl = await uploadToCloud(file.buffer, file.originalname, file.mimetype);
            const photoResult = await pool.query(
                `INSERT INTO face_photos (person_id, photo_url, descriptor, face_box, detection_score)
                 VALUES ($1, $2, $3, $4, $5) RETURNING id, photo_url, detection_score, created_at`,
                [id, photoUrl, JSON.stringify(face.descriptor), JSON.stringify(face.box), face.detectionScore]
            );
            savedPhotos.push(photoResult.rows[0]);
        }

        res.status(201).json({ photos: savedPhotos });
    } catch (err) {
        console.error('addPersonPhotos error:', err);
        res.status(500).json({ error: 'فشل إضافة الصور' });
    }
};

// DELETE /admin/face/photos/:photoId
exports.deletePersonPhoto = async (req, res) => {
    try {
        const { photoId } = req.params;
        const result = await pool.query('DELETE FROM face_photos WHERE id = $1 RETURNING photo_url', [photoId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'الصورة غير موجودة' });
        }
        await deleteFileFromCloud(result.rows[0].photo_url).catch(() => {});
        res.json({ success: true });
    } catch (err) {
        console.error('deletePersonPhoto error:', err);
        res.status(500).json({ error: 'فشل حذف الصورة' });
    }
};

// POST /admin/face/search  (multipart: image)
exports.searchByImage = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'يرجى رفع صورة للبحث بها' });
        }

        let faces;
        try {
            faces = await extractAllFaces(req.file.buffer);
        } catch (faceErr) {
            return res.status(400).json({ error: faceErr.message });
        }

        if (faces.length === 0) {
            return res.status(200).json({
                facesDetected: 0,
                results: [],
                message: 'لم يتم العثور على أي وجه واضح في الصورة المرفوعة. جرب صورة أوضح أو بإضاءة أفضل.'
            });
        }

        const enrollmentsResult = await pool.query(
            `SELECT fp.id as photo_id, fp.photo_url, fp.descriptor, p.id as person_id, p.name, p.info
             FROM face_photos fp
             JOIN face_people p ON p.id = fp.person_id`
        );
        const enrollments = enrollmentsResult.rows.map(row => ({
            ...row,
            descriptor: typeof row.descriptor === 'string' ? JSON.parse(row.descriptor) : row.descriptor
        }));

        const perFace = faces.map(face => ({
            box: face.box,
            detectionScore: face.detectionScore,
            imageWidth: face.imageWidth,
            imageHeight: face.imageHeight,
            candidates: enrollments.length
                ? matchDescriptorAgainstEnrollments(face.descriptor, enrollments).slice(0, 5)
                : []
        }));

        res.json({
            facesDetected: faces.length,
            faces: perFace
        });
    } catch (err) {
        console.error('searchByImage error:', err);
        res.status(500).json({ error: 'فشل تنفيذ عملية التحليل والمقارنة' });
    }
};
