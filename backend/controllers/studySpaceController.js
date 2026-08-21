const pool = require('../config/database');

// Helper: extract YouTube video_id from URL
const extractYouTubeId = (url) => {
    if (!url) return null;
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([^&\n?#]+)/,
        /^([a-zA-Z0-9_-]{11})$/
    ];
    for (const p of patterns) {
        const m = url.match(p);
        if (m) return m[1];
    }
    return null;
};

// ─── Auto-migrate: ensure tables exist ────────────────────────────────────────
const ensureTables = async () => {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS study_videos (
            id SERIAL PRIMARY KEY,
            title VARCHAR(255),
            youtube_url TEXT NOT NULL,
            video_id VARCHAR(50),
            duration_hours FLOAT DEFAULT 2,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS study_books (
            id SERIAL PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            file_url TEXT NOT NULL,
            file_size_mb FLOAT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);
};

// ─── GET /api/study-space/videos  ─────────────────────────────────────────────
const getStudyVideos = async (req, res) => {
    try {
        await ensureTables();
        const result = await pool.query('SELECT * FROM study_videos ORDER BY duration_hours ASC');
        if (result.rows.length === 0) {
            await pool.query(
                `INSERT INTO study_videos (title, youtube_url, video_id, duration_hours) VALUES
                 ($1, $2, $3, $4),
                 ($5, $6, $7, $8)`,
                [
                    'جلسة دراسة 2 ساعة - Lofi Study Beats',
                    'https://www.youtube.com/watch?v=jfKfPfyJRdk',
                    'jfKfPfyJRdk',
                    2,
                    'جلسة دراسة 4 ساعات - Deep Focus',
                    'https://www.youtube.com/watch?v=4xDzrJKXOOY',
                    '4xDzrJKXOOY',
                    4
                ]
            );
            const seeded = await pool.query('SELECT * FROM study_videos ORDER BY duration_hours ASC');
            return res.json({ videos: seeded.rows });
        }
        res.json({ videos: result.rows });
    } catch (err) {
        console.error('getStudyVideos error:', err);
        res.status(500).json({ error: 'فشل في جلب الفيديوهات' });
    }
};

// ─── POST /api/study-space/videos  ────────────────────────────────────────────
// يقبل youtube_url ويستخرج video_id تلقائياً
const upsertStudyVideo = async (req, res) => {
    try {
        await ensureTables();
        const { youtube_url, duration_hours, title } = req.body;
        if (!youtube_url) return res.status(400).json({ error: 'رابط YouTube مطلوب' });

        const video_id = extractYouTubeId(youtube_url);
        if (!video_id) return res.status(400).json({ error: 'رابط YouTube غير صالح' });

        const hours = parseFloat(duration_hours) || 2;

        // upsert: إذا كان يوجد نفس المدة، حدّثه
        const existing = await pool.query(
            'SELECT id FROM study_videos WHERE duration_hours = $1', [hours]
        );

        let result;
        if (existing.rows.length > 0) {
            result = await pool.query(
                `UPDATE study_videos SET youtube_url = $1, video_id = $2, title = $3
                 WHERE duration_hours = $4 RETURNING *`,
                [youtube_url, video_id, title || null, hours]
            );
        } else {
            result = await pool.query(
                `INSERT INTO study_videos (youtube_url, video_id, title, duration_hours)
                 VALUES ($1, $2, $3, $4) RETURNING *`,
                [youtube_url, video_id, title || null, hours]
            );
        }

        res.json({ video: result.rows[0] });
    } catch (err) {
        console.error('upsertStudyVideo error:', err);
        res.status(500).json({ error: 'فشل في حفظ الفيديو' });
    }
};

// ─── GET /api/study-space/books  ──────────────────────────────────────────────
const getStudyBooks = async (req, res) => {
    try {
        await ensureTables();
        const result = await pool.query('SELECT * FROM study_books ORDER BY created_at DESC');
        res.json({ books: result.rows });
    } catch (err) {
        console.error('getStudyBooks error:', err);
        res.status(500).json({ error: 'فشل في جلب الكتب' });
    }
};

// ─── POST /api/study-space/books  ─────────────────────────────────────────────
const multer = require('multer');
const { uploadToCloud } = require('../utils/storage');
const uploadMiddleware = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } }).single('book');

const uploadStudyBook = async (req, res) => {
    try {
        await ensureTables();
        const { title } = req.body;
        if (!req.file) return res.status(400).json({ error: 'الملف مطلوب' });

        const key = `study-books/${Date.now()}-${req.file.originalname.replace(/\s+/g, '_')}`;
        const file_url = await uploadToCloud(req.file.buffer, key, req.file.mimetype);
        const file_size_mb = (req.file.size / (1024 * 1024)).toFixed(2);

        const result = await pool.query(
            `INSERT INTO study_books (title, file_url, file_size_mb) VALUES ($1, $2, $3) RETURNING *`,
            [title || req.file.originalname, file_url, file_size_mb]
        );
        res.status(201).json({ book: result.rows[0] });
    } catch (err) {
        console.error('uploadStudyBook error:', err);
        res.status(500).json({ error: 'فشل في رفع الكتاب' });
    }
};

// ─── DELETE /api/study-space/books/:id  ───────────────────────────────────────
const deleteStudyBook = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM study_books WHERE id = $1', [id]);
        res.json({ message: 'تم حذف الكتاب' });
    } catch (err) {
        console.error('deleteStudyBook error:', err);
        res.status(500).json({ error: 'فشل في حذف الكتاب' });
    }
};

module.exports = { getStudyVideos, upsertStudyVideo, getStudyBooks, uploadStudyBook, deleteStudyBook, uploadMiddleware };
