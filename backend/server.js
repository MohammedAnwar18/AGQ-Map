// PalNovaa Backend Server v3.6 - Production Ready
const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const pool = require('./config/database');

// Auto-migration: تأكد من وجود جدول ar_contents عند بدء تشغيل السيرفر
(async () => {
    try {
        // ── جدول ar_contents الأساسي ─────────────────────────────
        await pool.query(`
            CREATE TABLE IF NOT EXISTS ar_contents (
                id         SERIAL PRIMARY KEY,
                latitude   NUMERIC(12,8) NOT NULL,
                longitude  NUMERIC(12,8) NOT NULL,
                title      VARCHAR(255)  NOT NULL,
                content    TEXT,
                shape      VARCHAR(50)   DEFAULT 'panel',
                bearing    NUMERIC(7,3)  DEFAULT 0,
                pitch      NUMERIC(7,3)  DEFAULT 90,
                created_at TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
                owner_id   INTEGER REFERENCES users(id) ON DELETE SET NULL
            )
        `);

        // ── ترقية الأعمدة القديمة ────────────────────────────────
        await pool.query(`ALTER TABLE ar_contents ALTER COLUMN latitude  TYPE NUMERIC(12,8)`);
        await pool.query(`ALTER TABLE ar_contents ALTER COLUMN longitude TYPE NUMERIC(12,8)`);
        await pool.query(`ALTER TABLE ar_contents ADD COLUMN IF NOT EXISTS pitch NUMERIC(7,3) DEFAULT 90`);

        // ── أعمدة نظام AR المتقدم (v2) ──────────────────────────
        const newCols = [
            `ALTER TABLE ar_contents ADD COLUMN IF NOT EXISTS type          VARCHAR(30)   DEFAULT 'story'`,
            `ALTER TABLE ar_contents ADD COLUMN IF NOT EXISTS subtitle      TEXT`,
            `ALTER TABLE ar_contents ADD COLUMN IF NOT EXISTS model_url     TEXT`,
            `ALTER TABLE ar_contents ADD COLUMN IF NOT EXISTS image_url     TEXT`,
            `ALTER TABLE ar_contents ADD COLUMN IF NOT EXISTS trigger_radius INTEGER      DEFAULT 50`,
            `ALTER TABLE ar_contents ADD COLUMN IF NOT EXISTS fov_angle     INTEGER       DEFAULT 25`,
            `ALTER TABLE ar_contents ADD COLUMN IF NOT EXISTS scale_x       FLOAT         DEFAULT 1.0`,
            `ALTER TABLE ar_contents ADD COLUMN IF NOT EXISTS scale_y       FLOAT         DEFAULT 1.0`,
            `ALTER TABLE ar_contents ADD COLUMN IF NOT EXISTS scale_z       FLOAT         DEFAULT 1.0`,
            `ALTER TABLE ar_contents ADD COLUMN IF NOT EXISTS elevation      FLOAT         DEFAULT 0`,
            `ALTER TABLE ar_contents ADD COLUMN IF NOT EXISTS era_year      INTEGER`,
            `ALTER TABLE ar_contents ADD COLUMN IF NOT EXISTS tags          TEXT[]`,
        ];
        for (const sql of newCols) {
            await pool.query(sql);
        }

        // ── فهارس ────────────────────────────────────────────────
        await pool.query(`CREATE INDEX IF NOT EXISTS ar_contents_lat_idx  ON ar_contents (latitude)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS ar_contents_lon_idx  ON ar_contents (longitude)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS ar_contents_type_idx ON ar_contents (type)`);

        console.log('✅ ar_contents table ready (v2 — buildings, stories, nav_points)');

        // ── جدول virtual_tours ─────────────────────────────
        await pool.query(`
            CREATE TABLE IF NOT EXISTS virtual_tours (
                id          SERIAL PRIMARY KEY,
                name        VARCHAR(255)  NOT NULL,
                description TEXT,
                latitude    DOUBLE PRECISION NOT NULL,
                longitude   DOUBLE PRECISION NOT NULL,
                image_url   VARCHAR(500)  NOT NULL,
                created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
                created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL
            )
        `);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_virtual_tours_location ON virtual_tours (latitude, longitude)`);
        console.log('✅ virtual_tours table ready');

        // ── جدول fitness_runs ─────────────────────────────
        await pool.query(`
            CREATE TABLE IF NOT EXISTS fitness_runs (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                activity_type VARCHAR(50) NOT NULL,
                duration_seconds INTEGER NOT NULL,
                distance_km DOUBLE PRECISION NOT NULL,
                calories_burned DOUBLE PRECISION NOT NULL,
                avg_speed_kmh DOUBLE PRECISION NOT NULL,
                path_coordinates TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_fitness_runs_created_at ON fitness_runs(created_at)`);
        console.log('✅ fitness_runs table ready');

        // ── إضافة عمود path_coordinates لجدول posts ───────────────────────────
        await pool.query(`
            ALTER TABLE posts ADD COLUMN IF NOT EXISTS path_coordinates TEXT;
        `);
        console.log('✅ path_coordinates column verified on posts table');

        // ── جداول مساحة الدراسة Study Space ─────────────────────────────────
        await pool.query(`
            CREATE TABLE IF NOT EXISTS study_videos (
                id            SERIAL PRIMARY KEY,
                duration_hours NUMERIC(4,1) NOT NULL UNIQUE,
                youtube_url   TEXT NOT NULL,
                video_id      VARCHAR(20) NOT NULL,
                title         VARCHAR(255) DEFAULT 'فيديو دراسة',
                created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS study_books (
                id            SERIAL PRIMARY KEY,
                title         VARCHAR(255) NOT NULL,
                author        VARCHAR(255),
                description   TEXT,
                file_url      TEXT NOT NULL,
                cover_url     TEXT,
                file_size_mb  NUMERIC(10,2),
                created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        console.log('✅ study_videos & study_books tables ready');
    } catch (err) {
        console.error('⚠️ ar_contents migration error:', err.message);
    }
})();

// 1. إنشاء التطبيق
const app = express();
// Note: Gzip compression is handled automatically by Vercel's edge network
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    maxHttpBufferSize: 1e7 // 10MB buffer size to support base64 image payloads
});

// 2. إعدادات Middleware والحماية برمجياً
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 300, 
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "طلبات كثيرة جداً، يرجى المحاولة لاحقاً" }
});

app.use(limiter);
app.use(helmet({
    contentSecurityPolicy: false, 
    crossOriginResourcePolicy: false 
}));
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/uploads', express.static(path.join(__dirname, 'uploads')));

// 3. Socket.io Logic
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Authentication middleware for socket (optional but recommended)
    // Here we handle registration after connection
    socket.on('register', async (userId) => {
        socket.userId = userId;
        socket.join(`user_${userId}`);
        console.log(`User ${userId} registered to room user_${userId}`);

        // Mark user as online in DB and broadcast to all connected sockets
        try {
            const pool = require('./config/database');
            await pool.query(
                'UPDATE users SET is_online = true, last_seen = CURRENT_TIMESTAMP WHERE id = $1',
                [userId]
            );
            // Broadcast to all other clients so friend lists update
            socket.broadcast.emit('user_online', { userId });
        } catch (err) {
            console.warn('Failed to set user online:', err.message);
        }
    });

    // Real-time Messaging
    socket.on('send-message', async (data) => {
        const { receiverId, content, imageUrl, senderId: explicitSenderId } = data;
        const senderId = data.senderId || socket.userId;
        console.log(`💬 Message from ${senderId} to ${receiverId}`);
        
        try {
            const pool = require('./config/database');
            const result = await pool.query(
                `INSERT INTO messages (sender_id, receiver_id, content, image_url, created_at)
                 VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
                 RETURNING *`,
                [senderId, receiverId, content, imageUrl || null]
            );
            
            const newMessage = result.rows[0];
            console.log('✅ Message saved with ID:', newMessage.id);
            
            // Emit to receiver
            io.to(`user_${receiverId}`).emit('receive-message', newMessage);
            // Emit to sender for confirmation
            socket.emit('receive-message', newMessage);
            
            // Create notification
            const { createNotification } = require('./controllers/notificationController');
            await createNotification(receiverId, senderId, 'message', null);
            
        } catch (error) {
            console.error('Socket send-message error:', error);
        }
    });

    socket.on('get-messages', async ({ friendId, userId: explicitUserId }) => {
        const userId = socket.userId || explicitUserId;
        console.log(`📥 Loading messages for user ${userId} with friend ${friendId}`);
        try {
            const pool = require('./config/database');
            const result = await pool.query(
                `SELECT * FROM messages 
                 WHERE (sender_id = $1 AND receiver_id = $2)
                 OR (sender_id = $2 AND receiver_id = $1)
                 ORDER BY created_at ASC`,
                [userId, friendId]
            );
            
            console.log(`📍 Found ${result.rows.length} messages`);

            // Mark as read
            await pool.query(
                `UPDATE messages SET is_read = true 
                 WHERE receiver_id = $1 AND sender_id = $2`,
                [userId, friendId]
            );

            // Mark notifications as read too
            await pool.query(
                `UPDATE notifications SET is_read = true 
                 WHERE user_id = $1 AND sender_id = $2 AND type = 'message'`,
                [userId, friendId]
            );
            
            socket.emit('messages-loaded', result.rows);
        } catch (error) {
            console.error('Socket get-messages error:', error);
        }
    });

    socket.on('typing', ({ receiverId }) => {
        socket.to(`user_${receiverId}`).emit('user-typing', { userId: socket.userId });
    });

    socket.on('stop-typing', ({ receiverId }) => {
        socket.to(`user_${receiverId}`).emit('user-stop-typing', { userId: socket.userId });
    });

    // AR Workspace Synchronization
    socket.on('ar-spatial-update', (data) => {
        if (socket.userId) {
            socket.to(`user_${socket.userId}`).emit('ar-spatial-update', data);
        }
    });

    socket.on('ar-object-manipulation', (data) => {
        if (socket.userId) {
            socket.to(`user_${socket.userId}`).emit('ar-object-manipulation', data);
        }
    });
    socket.on('disconnect', async () => {
        console.log('User disconnected:', socket.userId);
        if (socket.userId) {
            try {
                const pool = require('./config/database');
                await pool.query(
                    'UPDATE users SET is_online = false, last_seen = CURRENT_TIMESTAMP WHERE id = $1',
                    [socket.userId]
                );
                // Broadcast offline to all other clients
                socket.broadcast.emit('user_offline', { userId: socket.userId });
            } catch (err) {
                console.warn('Failed to set user offline:', err.message);
            }
        }
    });
});

// Attach socket logic manually or inject into req
app.set('io', io);

// 4. تفعيل الثقة في البروكسي (مهم لبرنامج تحديد الاستهلاك على Vercel/Heroku)
app.set('trust proxy', 1);

// 5. مسار الصحة الأساسي
app.get('/health', async (req, res) => {
    try {
        const pool = require('./config/database');
        const supabase = require('./config/supabase');
        await pool.query('SELECT NOW()');
        res.json({ status: "SUCCESS", database: "CONNECTED", time: new Date() });
    } catch (e) {
        res.status(500).json({ status: "ERROR", error: e.message });
    }
});

// 6. تحميل المسارات
app.use('/auth', require('./routes/auth'));
app.use('/users', require('./routes/users'));
app.use('/friends', require('./routes/friends'));
app.use('/messages', require('./routes/messages'));
app.use('/posts', require('./routes/posts'));
app.use('/comments', require('./routes/comments'));
app.use('/ai', require('./routes/ai'));
app.use('/notifications', require('./routes/notifications'));
app.use('/news', require('./routes/news'));
app.use('/communities', require('./routes/communities'));
app.use('/shops', require('./routes/shops'));
app.use('/cameras', require('./routes/cameras'));
app.use('/admin', require('./routes/admin'));
app.use('/reels', require('./routes/reels'));
app.use('/magazines', require('./routes/magazine'));
app.use('/ar', require('./routes/ar'));
app.use('/tours', require('./routes/tours'));

// API Aliases
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/friends', require('./routes/friends'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/posts', require('./routes/posts'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/shops', require('./routes/shops'));
app.use('/api/cameras', require('./routes/cameras'));
app.use('/api/news', require('./routes/news'));
app.use('/api/communities', require('./routes/communities'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/comments', require('./routes/comments'));
app.use('/api/reels', require('./routes/reels'));
app.use('/api/magazines', require('./routes/magazine'));
app.use('/api/push', require('./routes/push'));
app.use('/api/radar', require('./routes/radar')); // <-- NEW RADAR MOUNT
app.use('/api/pages', require('./routes/pages')); // <-- NEW PAGES MOUNT
app.use('/api/storage', require('./routes/storageRoutes')); // <-- NEW STORAGE MOUNT
app.use('/api/remote-sensing', require('./routes/remoteSensing'));
app.use('/api/ar', require('./routes/ar'));
app.use('/api/tours', require('./routes/tours'));
app.use('/api/fitness', require('./routes/fitness'));
app.use('/api/study-space', require('./routes/studySpace'));




// Global Error Handler
app.use((err, req, res, next) => {
    console.error('Global Error:', err);
    res.status(err.status || 500).json({
        error: err.message || 'حدث خطأ داخلي في الخادم',
        details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

// 7. التشغيل المحلي (فقط للمبرمج)
if (!process.env.VERCEL) {
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => console.log(`🚀 API & Sockets at http://localhost:${PORT}`));
}

// 7. تصدير التطبيق لـ Vercel
module.exports = app;

