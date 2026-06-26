const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/database');
const multer = require('multer');

// ─── إعداد Cloudflare R2 ────────────────────────────────────────────────────
const s3Client = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});

const bucketName = process.env.R2_BUCKET_NAME;
const publicUrlBase = process.env.R2_PUBLIC_URL;

// ─── Multer: رفع الملفات في الذاكرة ────────────────────────────────────────
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 200 * 1024 * 1024 }, // 200MB max
    fileFilter: (req, file, cb) => {
        const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('نوع الملف غير مدعوم. مدعوم: PDF, JPG, PNG, WebP'));
        }
    }
});

exports.uploadMiddleware = upload.single('file');

// ─── جلب الفيديوهات المعدة للدراسة ─────────────────────────────────────────
exports.getStudyVideos = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT * FROM study_videos ORDER BY duration_hours ASC`
        );
        res.json({ videos: result.rows });
    } catch (err) {
        console.error('getStudyVideos error:', err);
        res.status(500).json({ error: 'فشل في جلب الفيديوهات' });
    }
};

// ─── أدمن: إضافة/تحديث فيديو دراسة ────────────────────────────────────────
exports.upsertStudyVideo = async (req, res) => {
    try {
        const { youtube_url, duration_hours, title } = req.body;
        if (!youtube_url || !duration_hours) {
            return res.status(400).json({ error: 'youtube_url و duration_hours مطلوبان' });
        }

        // استخراج video ID من أي صيغة رابط يوتيوب
        const videoId = extractYouTubeId(youtube_url);
        if (!videoId) {
            return res.status(400).json({ error: 'رابط يوتيوب غير صحيح' });
        }

        const result = await pool.query(
            `INSERT INTO study_videos (duration_hours, youtube_url, video_id, title)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (duration_hours) DO UPDATE SET
                 youtube_url = EXCLUDED.youtube_url,
                 video_id = EXCLUDED.video_id,
                 title = EXCLUDED.title,
                 updated_at = NOW()
             RETURNING *`,
            [parseFloat(duration_hours), youtube_url, videoId, title || `فيديو دراسة ${duration_hours} ساعة`]
        );

        res.json({ success: true, video: result.rows[0] });
    } catch (err) {
        console.error('upsertStudyVideo error:', err);
        res.status(500).json({ error: 'فشل في حفظ الفيديو' });
    }
};

// ─── جلب قائمة الكتب ────────────────────────────────────────────────────────
exports.getStudyBooks = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, title, author, description, file_url, cover_url, file_size_mb, created_at
             FROM study_books
             ORDER BY created_at DESC`
        );
        res.json({ books: result.rows });
    } catch (err) {
        console.error('getStudyBooks error:', err);
        res.status(500).json({ error: 'فشل في جلب الكتب' });
    }
};

// ─── أدمن: رفع كتاب PDF إلى R2 ──────────────────────────────────────────────
exports.uploadStudyBook = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'لا يوجد ملف' });
        }

        const { title, author, description } = req.body;
        if (!title) {
            return res.status(400).json({ error: 'عنوان الكتاب مطلوب' });
        }

        const fileKey = `study-books/${uuidv4()}-${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

        await s3Client.send(new PutObjectCommand({
            Bucket: bucketName,
            Key: fileKey,
            Body: req.file.buffer,
            ContentType: req.file.mimetype,
            ContentDisposition: 'inline', // يفتح في المتصفح مباشرة
        }));

        const fileUrl = `${publicUrlBase}/${fileKey}`;
        const fileSizeMb = (req.file.size / (1024 * 1024)).toFixed(2);

        const result = await pool.query(
            `INSERT INTO study_books (title, author, description, file_url, file_size_mb)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [title, author || null, description || null, fileUrl, fileSizeMb]
        );

        res.json({ success: true, book: result.rows[0] });
    } catch (err) {
        console.error('uploadStudyBook error:', err);
        res.status(500).json({ error: 'فشل في رفع الكتاب: ' + err.message });
    }
};

// ─── أدمن: حذف كتاب ─────────────────────────────────────────────────────────
exports.deleteStudyBook = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query(`DELETE FROM study_books WHERE id = $1`, [id]);
        res.json({ success: true });
    } catch (err) {
        console.error('deleteStudyBook error:', err);
        res.status(500).json({ error: 'فشل في حذف الكتاب' });
    }
};

// ─── Helper: استخراج YouTube video ID ───────────────────────────────────────
function extractYouTubeId(url) {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
        /^([a-zA-Z0-9_-]{11})$/ // raw video ID
    ];
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return null;
}
